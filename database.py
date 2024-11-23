from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import uuid
from typing import List, Optional
from fastapi import HTTPException

class Database:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def create_chat_session(self, user_id: str, title: str = "New Chat") -> dict:
        try:
            response = self.supabase.table('chat_sessions').insert({
                'user_id': user_id,
                'title': title
            }).execute()
            return response.data[0]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create chat session: {str(e)}")

    async def get_user_chat_sessions(self, user_id: str) -> List[dict]:
        try:
            response = self.supabase.table('chat_sessions')\
                .select('*')\
                .eq('user_id', user_id)\
                .order('updated_at', desc=True)\
                .execute()
            return response.data
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get chat sessions: {str(e)}")

    async def update_chat_session(self, session_id: str, title: str) -> dict:
        try:
            response = self.supabase.table('chat_sessions')\
                .update({'title': title, 'updated_at': datetime.utcnow().isoformat()})\
                .eq('id', session_id)\
                .execute()
            return response.data[0]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update chat session: {str(e)}")

    async def get_chat_history(self, user_id: str, session_id: Optional[str] = None, limit: int = 50) -> List[dict]:
        try:
            logger.info(f"Fetching chat history for user {user_id} and session {session_id}")
            
            # Build query with exact column names and proper timestamp field
            query = self.supabase.table('user_chat_history')\
                .select('id,user_id,session_id,message,chat_type,"TIMESTAMP"')\
                .eq('user_id', user_id)\
                .is_('deleted_at', 'null')\
                .order('TIMESTAMP', desc=True)\
                .limit(limit)
            
            if session_id:
                query = query.eq('session_id', session_id)
            
            response = query.execute()
            
            if not response.data:
                logger.info(f"No chat history found for user {user_id}")
                return []
            
            # Format response to match frontend expectations
            formatted_messages = [{
                'id': msg['id'],
                'user_id': msg['user_id'],
                'session_id': msg['session_id'],
                'message': msg['message'],
                'chat_type': msg['chat_type'],
                'timestamp': msg['TIMESTAMP']
            } for msg in response.data]
            
            logger.info(f"Retrieved {len(formatted_messages)} messages for user {user_id}")
            return formatted_messages
        except Exception as e:
            logger.error(f"Database error in get_chat_history: {str(e)}")
            if 'violates foreign key constraint' in str(e):
                raise HTTPException(status_code=400, detail="Invalid user ID")
            raise HTTPException(status_code=500, detail=f"Failed to get chat history: {str(e)}")

    async def save_chat_message(self, user_id: str, message: str, response: str, session_id: Optional[str] = None) -> dict:
        try:
            # If no session_id provided, create a new session
            if not session_id:
                session = await self.create_chat_session(user_id)
                session_id = session['id']
            
            current_time = datetime.utcnow().isoformat()
            
            # Save user message (message must not be NULL as per schema)
            user_msg = self.supabase.table('user_chat_history').insert({
                'user_id': user_id,
                'session_id': session_id,
                'message': message,  # Required field
                'chat_type': 'text',
                'TIMESTAMP': current_time,
                'last_updated': current_time
            }).execute()

            # Save bot response (bot's message is the response)
            bot_msg = self.supabase.table('user_chat_history').insert({
                'user_id': user_id,
                'session_id': session_id,
                'message': response,  # Required field
                'chat_type': 'bot',
                'TIMESTAMP': current_time,
                'last_updated': current_time
            }).execute()

            # Update session's updated_at timestamp
            self.supabase.table('chat_sessions')\
                .update({'updated_at': current_time})\
                .eq('id', session_id)\
                .execute()

            return {'user_message': user_msg.data[0], 'bot_message': bot_msg.data[0]}
        except Exception as e:
            if 'violates check constraint' in str(e):
                raise HTTPException(status_code=400, detail="Message cannot be empty")
            if 'violates foreign key constraint' in str(e):
                raise HTTPException(status_code=400, detail="Invalid session or user ID")
            raise HTTPException(status_code=500, detail=f"Failed to save chat message: {str(e)}")
import os
from supabase.client import create_client, Client
from typing import List, Dict, Optional
import uuid

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL or SUPABASE_ANON_KEY is missing from environment variables")

supabase: Client = create_client(supabase_url, supabase_key)

async def create_user(email: str) -> Dict:
    response = supabase.table("users").insert({"email": email}).execute()
    return response.data[0] if response.data else {}

async def get_user_by_email(email: str) -> Dict:
    response = supabase.table("users").select("*").eq("email", email).execute()
    return response.data[0] if response.data else {}

async def check_user_exists(user_id: uuid.UUID) -> bool:
    response = supabase.table("users").select("id").eq("id", str(user_id)).execute()
    return len(response.data) > 0

async def insert_chat_message(user_id: uuid.UUID, message: str, chat_type: str = 'text') -> Dict:
    user_exists = await check_user_exists(user_id)
    if not user_exists:
        raise ValueError(f"User with id {user_id} does not exist")
    response = supabase.table("user_chat_history").insert({
        "user_id": str(user_id),
        "message": message,
        "chat_type": chat_type
    }).execute()
    return response.data[0] if response.data else {}

async def get_chat_history(user_id: uuid.UUID, limit: int = 50) -> List[Dict]:
    response = supabase.table("user_chat_history").select("*").eq("user_id", str(user_id)).order("TIMESTAMP", desc=True).limit(limit).execute()
    return response.data

async def insert_video_analysis(user_id: uuid.UUID, upload_file_name: str, analysis: str, video_duration: Optional[str] = None, video_format: Optional[str] = None) -> Dict:
    response = supabase.table("video_analysis_output").insert({
        "user_id": str(user_id),
        "upload_file_name": upload_file_name,
        "analysis": analysis,
        "video_duration": video_duration,
        "video_format": video_format
    }).execute()
    return response.data[0] if response.data else {}

async def get_video_analysis_history(user_id: uuid.UUID, limit: int = 10) -> List[Dict]:
    response = supabase.table("video_analysis_output").select("*").eq("user_id", str(user_id)).order("TIMESTAMP", desc=True).limit(limit).execute()
    return response.data
