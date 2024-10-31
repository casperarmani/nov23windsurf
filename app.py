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
from database import create_user, get_user_by_email, insert_chat_message, get_chat_history, insert_video_analysis, get_video_analysis_history, check_user_exists
from dotenv import load_dotenv
import uvicorn
from supabase.client import create_client, Client
import uuid
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import time
import jwt
from fastapi.responses import Response
from redis_storage import RedisFileStorage
from redis_manager import RedisManager
import asyncio
import secrets
import httpx

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

async def refresh_jwt_token():
    """Refresh the JWT token using Supabase refresh token"""
    try:
        refresh_response = await supabase.auth.refresh_session()
        if refresh_response and refresh_response.session:
            return True
        return False
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        return False

def get_current_user(request: Request, return_none=False):
    """Get current user with token refresh logic"""
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

    # Check if access token needs refresh (every 50 minutes)
    last_refresh = session_data.get('last_refresh', 0)
    if time.time() - last_refresh > 3000:  # 50 minutes
        try:
            refresh_success = asyncio.run(refresh_jwt_token())
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

async def cleanup_background():
    while True:
        await redis_storage.cleanup_expired_files()
        await redis_manager.cleanup_expired_sessions()
        await redis_manager.cleanup_expired_cache()
        await asyncio.sleep(300)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_background())

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get('/login', response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get('/signup', response_class=HTMLResponse)
async def signup_page(request: Request):
    return templates.TemplateResponse("signup.html", {"request": request})

@app.post("/send_message")
async def send_message(
    request: Request,
    background_tasks: BackgroundTasks,
    message: str = Form(""),
    videos: List[UploadFile] = File(None)
):
    user = get_current_user(request)
    client_ip = request.client.host
    
    if not redis_manager.check_rate_limit(user['id'], client_ip):
        raise HTTPException(status_code=429, detail="Too many requests")

    if not user or 'id' not in user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = uuid.UUID(user['id'])
    
    if not await check_user_exists(user_id):
        raise HTTPException(status_code=400, detail="User does not exist")
    
    if videos and len(videos) > 0:
        responses = []
        
        try:
            for video in videos:
                content = await video.read()
                file_size = len(content)
                
                if file_size > redis_storage.max_file_size:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File size exceeds maximum limit of {redis_storage.max_file_size / (1024 * 1024)}MB"
                    )
                
                file_id = str(uuid.uuid4())
                
                if not await redis_storage.store_file(file_id, content):
                    raise HTTPException(status_code=500, detail="Failed to store file")
                
                try:
                    await insert_chat_message(
                        user_id, 
                        f"[Uploaded video: {video.filename or 'video'}]", 
                        'text'
                    )
                    
                    analysis_result, metadata = await chatbot.analyze_video(file_id, video.filename, message)
                    
                    if metadata:
                        await insert_video_analysis(
                            user_id=user_id,
                            upload_file_name=video.filename or "uploaded_video",
                            analysis=analysis_result,
                            video_duration=metadata.get('duration'),
                            video_format=metadata.get('format')
                        )
                    else:
                        await insert_video_analysis(
                            user_id=user_id,
                            upload_file_name=video.filename or "uploaded_video",
                            analysis=analysis_result
                        )
                    
                    await insert_chat_message(user_id, analysis_result, 'bot')
                    responses.append(analysis_result)
                    
                finally:
                    background_tasks.add_task(redis_storage.delete_file, file_id)
            
            combined_response = "\n\n---\n\n".join(responses)
            return {"response": combined_response}
            
        except Exception as e:
            logger.error(f"Error processing videos: {str(e)}")
            return {"response": f"An error occurred while processing videos: {str(e)}"}
    else:
        await insert_chat_message(user_id, message, 'text')
        response = await chatbot.send_message(message)
        await insert_chat_message(user_id, response, 'bot')
        return {"response": response}

@app.post('/refresh_token')
async def refresh_token(request: Request):
    """Endpoint to refresh the JWT token"""
    try:
        success = await refresh_jwt_token()
        if success:
            return {"success": True, "message": "Token refreshed successfully"}
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "Failed to refresh token"}
        )
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": str(e)}
        )

@app.post('/login')
async def login_post(request: Request, response: Response, email: str = Form(...), password: str = Form(...)):
    if not redis_manager.check_rate_limit("anonymous", request.client.host):
        raise HTTPException(status_code=429, detail="Too many requests")

    try:
        auth_response = supabase.auth.sign_in_with_password({"email": email, "password": password})
        user = auth_response.user
        if user and user.email:
            db_user = await get_user_by_email(user.email)
            
            session_id = secrets.token_urlsafe(32)
            session_data = {
                'id': str(db_user['id']),
                'email': user.email,
                'last_refresh': time.time()
            }
            
            if redis_manager.set_session(session_id, session_data):
                response.set_cookie(
                    key="session_id",
                    value=session_id,
                    httponly=True,
                    secure=True,
                    samesite="lax",
                    max_age=3600
                )
                return {"success": True, "message": "Login successful"}
            else:
                raise ValueError("Failed to create session")
        else:
            raise ValueError("Invalid user data received from Supabase")
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return JSONResponse({"success": False, "message": str(e)}, status_code=400)

@app.post('/signup')
async def signup_post(request: Request, response: Response, email: str = Form(...), password: str = Form(...)):
    if not redis_manager.check_rate_limit("anonymous", request.client.host):
        raise HTTPException(status_code=429, detail="Too many requests")

    try:
        auth_response = supabase.auth.sign_up({"email": email, "password": password})
        user = auth_response.user
        if user and user.email:
            db_user = await create_user(user.email)
            
            session_id = secrets.token_urlsafe(32)
            session_data = {
                'id': str(db_user['id']),
                'email': user.email,
                'last_refresh': time.time()
            }
            
            if redis_manager.set_session(session_id, session_data):
                response.set_cookie(
                    key="session_id",
                    value=session_id,
                    httponly=True,
                    secure=True,
                    samesite="lax",
                    max_age=3600
                )
                return {"success": True, "message": "Signup successful"}
            else:
                return JSONResponse({"success": False, "message": "Failed to create session"}, status_code=400)
        else:
            return JSONResponse({"success": False, "message": "Signup failed"}, status_code=400)
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        return JSONResponse({"success": False, "message": str(e)}, status_code=400)

@app.post('/logout')
async def logout(request: Request, response: Response):
    session_id = request.cookies.get('session_id')
    if session_id:
        redis_manager.delete_session(session_id)
        response.delete_cookie(key="session_id")
    return {"success": True, "message": "Logout successful"}

@app.get("/auth_status")
async def auth_status(request: Request):
    user = get_current_user(request, return_none=True)
    return {
        "authenticated": user is not None,
        "user": user if user else None,
        "current_path": request.url.path
    }

@app.get("/chat_history")
async def chat_history(request: Request):
    try:
        user = get_current_user(request, return_none=True)
        if not user:
            return {"history": []}
        
        cache_key = f"chat_history:{user['id']}"
        try:
            cached_history = redis_manager.get_cache(cache_key)
            if cached_history is not None:
                logger.info(f"Returning cached chat history for user {user['id']}")
                return {"history": cached_history}
        except Exception as cache_error:
            logger.error(f"Error retrieving chat history from cache: {str(cache_error)}")
        
        try:
            user_id = uuid.UUID(user['id'])
            history = await get_chat_history(user_id)
            
            try:
                if not redis_manager.set_cache(cache_key, history):
                    logger.warning(f"Failed to cache chat history for user {user['id']}")
            except Exception as cache_error:
                logger.error(f"Error caching chat history: {str(cache_error)}")
            
            return {"history": history}
            
        except Exception as db_error:
            logger.error(f"Error fetching chat history from database: {str(db_error)}")
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to fetch chat history"}
            )
            
    except Exception as e:
        logger.error(f"Unexpected error in chat history endpoint: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

@app.get("/video_analysis_history")
async def video_analysis_history(request: Request):
    try:
        user = get_current_user(request, return_none=True)
        if not user:
            return {"history": []}
        
        cache_key = f"video_history:{user['id']}"
        try:
            cached_history = redis_manager.get_cache(cache_key)
            if cached_history is not None:
                logger.info(f"Returning cached video history for user {user['id']}")
                return {"history": cached_history}
        except Exception as cache_error:
            logger.error(f"Error retrieving video history from cache: {str(cache_error)}")
        
        try:
            user_id = uuid.UUID(user['id'])
            history = await get_video_analysis_history(user_id)
            
            try:
                if not redis_manager.set_cache(cache_key, history):
                    logger.warning(f"Failed to cache video history for user {user['id']}")
            except Exception as cache_error:
                logger.error(f"Error caching video history: {str(cache_error)}")
            
            return {"history": history}
            
        except Exception as db_error:
            logger.error(f"Error fetching video history from database: {str(db_error)}")
            return JSONResponse(
                status_code=500,
                content={"error": "Failed to fetch video analysis history"}
            )
            
    except Exception as e:
        logger.error(f"Unexpected error in video history endpoint: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3000, reload=True)
