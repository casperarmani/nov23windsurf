from datetime import datetime
import uuid
import logging
from typing import List, Optional
from fastapi import HTTPException

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
            logger.info(f"Fetching chat sessions for user: {user_id}")
            response = self.supabase.table('chat_sessions')\
                .select('id,user_id,title,created_at,updated_at')\
                .eq('user_id', user_id)\
                .is_('deleted_at', 'null')\
                .order('updated_at', desc=True)\
                .execute()
            
            if not response.data:
                logger.info(f"No chat sessions found for user: {user_id}")
                return []
                
            return response.data
        except Exception as e:
            logger.error(f"Error fetching chat sessions: {str(e)}")
            if 'violates foreign key constraint' in str(e):
                raise HTTPException(status_code=400, detail="Invalid user ID")
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
            logger.info(f"Fetching chat history for user: {user_id}, session: {session_id}")
            
            # Build base query with proper column names and timestamp field
            select_columns = [
                'id', 'user_id', 'session_id', 'message', 
                'chat_type', '"TIMESTAMP"', 'last_updated'
            ]
            
            query = self.supabase.table('user_chat_history')\
                .select(','.join(select_columns))\
                .eq('user_id', user_id)\
                .is_('deleted_at', 'null')
            
            # Add session filtering if provided
            if session_id:
                logger.info(f"Filtering by session ID: {session_id}")
                query = query.eq('session_id', session_id)
            
            # Add ordering and limit
            query = query.order('"TIMESTAMP"', desc=True).limit(limit)
            
            logger.debug(f"Executing query for chat history")
            response = query.execute()
            
            if not response.data:
                logger.info(f"No chat history found for user: {user_id}")
                return []
            
            logger.info(f"Found {len(response.data)} chat messages")
            return response.data
            
        except Exception as e:
            logger.error(f"Database error in get_chat_history: {str(e)}")
            if 'violates foreign key constraint' in str(e):
                raise HTTPException(status_code=400, detail="Invalid user ID")
            if 'column' in str(e).lower() and 'does not exist' in str(e).lower():
                raise HTTPException(status_code=500, detail="Database schema error")
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
    async def create_user(self, email: str) -> dict:
        """Create a new user in the database."""
        try:
            response = self.supabase.table("users").insert({
                "email": email
            }).execute()
            return response.data[0] if response.data else {}
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            if 'duplicate key' in str(e).lower():
                raise HTTPException(status_code=400, detail="User already exists")
            raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

    async def get_user_by_email(self, email: str) -> dict:
        """Get user by email from the database."""
        try:
            response = self.supabase.table("users")\
                .select("*")\
                .eq("email", email)\
                .execute()
            return response.data[0] if response.data else {}
        except Exception as e:
            logger.error(f"Error getting user by email: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to get user: {str(e)}")

# End of Database class
