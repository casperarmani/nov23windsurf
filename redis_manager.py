import redis
import time
import logging
import json
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
        self.session_prefix = "session:"
        self.cache_prefix = "cache:"
        self.rate_prefix = "rate:"
        self.video_prefix = "video:"
        
        # Default TTL values
        self.session_ttl = 3600  # 1 hour
        self.cache_ttl = 300     # 5 minutes
        self.rate_limit_ttl = 60 # 1 minute
        
        # Rate limiting configurations
        self.rate_limit_requests = 100  # requests per window
        self.rate_limit_window = 60     # window in seconds

    def _build_key(self, prefix: str, key: str) -> str:
        """Build Redis key with prefix"""
        return f"{prefix}{key}"

    def _serialize_value(self, value: Any) -> str:
        """Serialize value to string format"""
        try:
            if isinstance(value, (dict, list)):
                return json.dumps(value)
            elif isinstance(value, (int, float, bool)):
                return str(value)
            elif isinstance(value, bytes):
                return value.decode('utf-8')
            return str(value)
        except Exception as e:
            logger.error(f"Error serializing value: {str(e)}")
            raise ValueError(f"Unable to serialize value: {str(e)}")

    def _deserialize_value(self, value: Optional[bytes], default_type: Any = str) -> Any:
        """Deserialize value from bytes"""
        if value is None:
            return None
        
        try:
            str_value = value.decode('utf-8')
            
            if default_type == bool:
                return str_value.lower() == "true"
            elif default_type == int:
                return int(str_value)
            elif default_type == float:
                return float(str_value)
            elif default_type in (dict, list):
                return json.loads(str_value)
            return str_value
        except (ValueError, json.JSONDecodeError) as e:
            logger.error(f"Error deserializing value: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during deserialization: {e}")
            return None

    def check_rate_limit(self, user_id: str, ip_address: str) -> bool:
        """Check if the request is within rate limits"""
        key = f"{self.rate_prefix}{user_id}:{ip_address}"
        current = self.redis.get(key)
        if current is None:
            self.redis.set(key, 1, ex=self.rate_limit_ttl)
            return True
        count = int(current)
        if count >= self.rate_limit_requests:
            return False
        self.redis.incr(key)
        return True

    def delete_session(self, session_id: str) -> bool:
        """Delete session from Redis"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            self.redis.delete(key)
            logger.info(f"Session deleted: {key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            return False

    # Session Management
    def set_session(self, session_id: str, data: Dict, ttl: Optional[int] = None) -> bool:
        """Store session data in Redis"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            serialized_data = self._serialize_value(data)
            self.redis.set(key, serialized_data, ex=ttl or self.session_ttl)
            logger.info(f"Session stored successfully: {key}")
            return True
        except Exception as e:
            logger.error(f"Error setting session: {e}")
            return False

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Retrieve session data from Redis"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            data = self.redis.get(key)
            if data:
                logger.info(f"Session found: {key}")
                return self._deserialize_value(data, dict)
            logger.info(f"Session not found: {key}")
            return None
        except Exception as e:
            logger.error(f"Error getting session: {e}")
            return None

    # Cache Management
    def set_cache(self, cache_key: str, data: Any, ttl: Optional[int] = None) -> bool:
        """Store data in Redis cache"""
        try:
            key = self._build_key(self.cache_prefix, cache_key)
            serialized_data = self._serialize_value(data)
            self.redis.set(key, serialized_data, ex=ttl or self.cache_ttl)
            logger.info(f"Cache set successfully: {key}")
            return True
        except Exception as e:
            logger.error(f"Error setting cache for key {cache_key}: {str(e)}")
            return False

    def get_cache(self, cache_key: str) -> Optional[Any]:
        """Retrieve data from Redis cache"""
        try:
            key = self._build_key(self.cache_prefix, cache_key)
            data = self.redis.get(key)
            if data:
                logger.info(f"Cache hit for key: {key}")
                deserialized_data = self._deserialize_value(data, dict)
                if deserialized_data is None:
                    logger.warning(f"Cache data corrupted for key: {key}, invalidating cache")
                    self.invalidate_cache(cache_key)
                    return None
                return deserialized_data
            logger.info(f"Cache miss for key: {key}")
            return None
        except Exception as e:
            logger.error(f"Error getting cache for key {cache_key}: {str(e)}")
            return None

    def invalidate_cache(self, pattern: str) -> bool:
        """Invalidate cache entries matching pattern"""
        try:
            pattern = self._build_key(self.cache_prefix, pattern)
            cursor = 0
            deleted_keys = 0
            while True:
                cursor, keys = self.redis.scan(cursor, match=pattern)
                if keys:
                    self.redis.delete(*keys)
                    deleted_keys += len(keys)
                if cursor == 0:
                    break
            logger.info(f"Invalidated {deleted_keys} cache keys matching pattern: {pattern}")
            return True
        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")
            return False

    # Cleanup tasks
    async def cleanup_expired_sessions(self):
        """Cleanup expired sessions"""
        try:
            pattern = f"{self.session_prefix}*"
            cursor = 0
            cleaned = 0
            while True:
                cursor, keys = self.redis.scan(cursor, match=pattern)
                for key in keys:
                    if not self.redis.ttl(key):
                        self.redis.delete(key)
                        cleaned += 1
                if cursor == 0:
                    break
            logger.info(f"Cleaned up {cleaned} expired sessions")
        except Exception as e:
            logger.error(f"Error cleaning up sessions: {e}")

    async def cleanup_expired_cache(self):
        """Cleanup expired cache entries"""
        try:
            pattern = f"{self.cache_prefix}*"
            cursor = 0
            cleaned = 0
            while True:
                cursor, keys = self.redis.scan(cursor, match=pattern)
                for key in keys:
                    if not self.redis.ttl(key):
                        self.redis.delete(key)
                        cleaned += 1
                if cursor == 0:
                    break
            logger.info(f"Cleaned up {cleaned} expired cache entries")
        except Exception as e:
            logger.error(f"Error cleaning up cache: {e}")
