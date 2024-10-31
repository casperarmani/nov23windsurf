import os
from fastapi import FastAPI, File, Form, UploadFile, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2AuthorizationCodeBearer
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from chatbot import Chatbot
from database import create_user, get_user_by_email, insert_chat_message, get_chat_history
from database import insert_video_analysis, get_video_analysis_history, check_user_exists
from dotenv import load_dotenv
import uvicorn
from supabase.client import create_client, Client
import uuid
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import time
import jwt
from fastapi.responses import Response
from redis_storage import RedisFileStorage
from redis_manager import RedisManager
import asyncio
import secrets
import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

load_dotenv()

redis_url = os.getenv('REDIS_URL')
if not redis_url:
    raise ValueError("REDIS_URL environment variable is not set")

redis_storage = RedisFileStorage(redis_url)
redis_manager = RedisManager(redis_url)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables")

supabase: Client = create_client(supabase_url, supabase_key)

app = FastAPI(
    title="Video Analysis Chatbot",
    description="A FastAPI application for video analysis with chatbot capabilities",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
chatbot = Chatbot()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
)

@app.middleware("http")
async def count_requests(request: Request, call_next):
    """Count total requests for metrics"""
    if not hasattr(app.state, "request_count"):
        app.state.request_count = 0
    app.state.request_count += 1
    response = await call_next(request)
    return response

@app.on_event("startup")
async def startup_event():
    """Initialize application state and start background tasks"""
    app.state.start_time = time.time()
    # Start background cleanup task
    asyncio.create_task(cleanup_background())

async def cleanup_background():
    """Background task for cleanup operations"""
    while True:
        await redis_storage.cleanup_expired_files()
        await redis_manager.cleanup_expired_sessions()
        await redis_manager.cleanup_expired_cache()
        await asyncio.sleep(300)  # Run every 5 minutes

async def refresh_jwt_token():
    """Refresh the JWT token using Supabase refresh token"""
    try:
        refresh_response = await supabase.auth.refresh_session()
        if refresh_response and hasattr(refresh_response, 'session') and refresh_response.session:
            return True
        return False
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        return False

async def get_current_user(request: Request, return_none=False):
    """Get current user with improved error handling"""
    try:
        session_id = request.cookies.get('session_id')
        if not session_id:
            if return_none:
                return None
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        session_data = redis_manager.get_session(session_id)
        if not session_data:
            if return_none:
                return None
            raise HTTPException(status_code=401, detail="Not authenticated")

        # Ensure session has required fields
        if not isinstance(session_data, dict) or 'id' not in session_data:
            if return_none:
                return None
            raise HTTPException(status_code=401, detail="Invalid session data")

        last_refresh = session_data.get('last_refresh', 0)
        if time.time() - last_refresh > 3000:  # 50 minutes
            try:
                refresh_success = await refresh_jwt_token()
                if refresh_success:
                    session_data['last_refresh'] = time.time()
                    redis_manager.set_session(session_id, session_data)
                else:
                    if return_none:
                        return None
                    raise HTTPException(status_code=401, detail="Session expired")
            except Exception as e:
                logger.error(f"Token refresh error: {str(e)}")
                if return_none:
                    return None
                raise HTTPException(status_code=401, detail="Session expired")

        return session_data
    except Exception as e:
        logger.error(f"Error in get_current_user: {str(e)}")
        if return_none:
            return None
        raise HTTPException(status_code=401, detail="Authentication error")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Main page route"""
    user = await get_current_user(request, return_none=True)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("index.html", {"request": request})

@app.get('/login', response_class=HTMLResponse)
async def login_page(request: Request):
    """Login page route"""
    return templates.TemplateResponse("login.html", {"request": request})

@app.get('/signup', response_class=HTMLResponse)
async def signup_page(request: Request):
    """Signup page route"""
    return templates.TemplateResponse("signup.html", {"request": request})

@app.post('/logout')
async def logout(request: Request, response: Response):
    """Handle user logout by removing session"""
    session_id = request.cookies.get('session_id')
    if session_id:
        try:
            await redis_manager.delete_session(session_id)
        except Exception as e:
            logger.error(f"Error during logout: {str(e)}")
        finally:
            response.delete_cookie(key="session_id")
    return {"success": True, "message": "Logout successful"}

@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "redis": {
                "status": "unknown",
                "details": None
            },
            "supabase": {
                "status": "unknown",
                "details": None
            }
        }
    }
    
    try:
        redis_health = await redis_manager.check_health()
        health_status["services"]["redis"] = {
            "status": redis_health["status"],
            "details": redis_health
        }
        if redis_health["status"] != "healthy":
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["redis"] = {
            "status": "unhealthy",
            "details": {"error": str(e)}
        }
        health_status["status"] = "unhealthy"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_url}/health",
                headers={"apikey": supabase_key},
                timeout=5.0
            )
            
            if response.status_code == 200:
                health_status["services"]["supabase"] = {
                    "status": "healthy",
                    "details": response.json()
                }
            else:
                health_status["services"]["supabase"] = {
                    "status": "degraded",
                    "details": {"status_code": response.status_code}
                }
                health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["supabase"] = {
            "status": "unhealthy",
            "details": {"error": str(e)}
        }
        health_status["status"] = "unhealthy"
    
    return health_status

@app.get("/metrics")
async def metrics():
    """Metrics endpoint for monitoring"""
    try:
        redis_metrics = await redis_manager.get_metrics()
        
        metrics_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "redis": redis_metrics,
            "app": {
                "uptime": time.time() - app.state.start_time if hasattr(app.state, "start_time") else 0,
                "requests_total": app.state.request_count if hasattr(app.state, "request_count") else 0,
            }
        }
        return metrics_data
    except Exception as e:
        logger.error(f"Error collecting metrics: {str(e)}")
        return {
            "error": "Failed to collect metrics",
            "detail": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3000, reload=True)
