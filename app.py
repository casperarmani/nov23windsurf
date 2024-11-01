import os
from fastapi import FastAPI, File, Form, UploadFile, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import OAuth2AuthorizationCodeBearer
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.requests import Request
from starlette.middleware.trustedhost import TrustedHostMiddleware
from chatbot import Chatbot
from database import create_user, get_user_by_email, insert_chat_message, get_chat_history
from database import insert_video_analysis, get_video_analysis_history, check_user_exists
from dotenv import load_dotenv
import uvicorn
from supabase.client import create_client, Client
import uuid
import logging
import time
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
import jwt
import secrets
import httpx
from fastapi.responses import Response
from redis_storage import RedisFileStorage
from redis_manager import RedisManager, TaskType, TaskPriority
from ddtrace import patch
from ddtrace.contrib.fastapi import FastAPIMiddleware

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize resources
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

# Initialize FastAPI app
app = FastAPI(
    title="Video Analysis Chatbot",
    description="A FastAPI application for video analysis with chatbot capabilities",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
chatbot = Chatbot()

# Configure Datadog APM
patch(fastapi=True)
app.add_middleware(FastAPIMiddleware)

# Add middleware
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

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    try:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "redis": await redis_manager.health_check()
            }
        }
        
        # Check Supabase connection
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
            logger.error(f"Supabase health check failed: {str(e)}")
        
        return health_status
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def metrics():
    """Metrics endpoint for monitoring"""
    try:
        metrics_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "redis": await redis_manager.get_metrics(),
            "app": {
                "uptime": time.time() - app.state.start_time if hasattr(app.state, "start_time") else 0,
                "requests_total": app.state.request_count if hasattr(app.state, "request_count") else 0,
                "monitoring": {
                    "datadog_enabled": bool(os.getenv('DD_API_KEY')),
                    "service": "video-analysis-chatbot",
                    "environment": "production"
                }
            }
        }
        return metrics_data
    except Exception as e:
        logger.error(f"Error collecting metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.on_event("startup")
async def startup_event():
    """Initialize app state and start background tasks"""
    app.state.start_time = time.time()
    app.state.request_count = 0

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3000, reload=True)
