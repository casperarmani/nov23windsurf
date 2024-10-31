import redis
from redis.connection import ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError
import time
import logging
import json
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta
import random

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self, redis_url: str):
        # Initialize connection pool
        self.pool = ConnectionPool.from_url(
            url=redis_url,
            max_connections=10,  # Maximum number of connections in the pool
            socket_timeout=5.0,  # Socket timeout
            socket_connect_timeout=2.0,  # Connection timeout
            retry_on_timeout=True  # Retry on timeout
        )
        
        # Initialize Redis client with connection pool
        self.redis = redis.Redis(connection_pool=self.pool)
        
        # Prefixes for different types of keys
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
        
        # Retry configuration
        self.max_retries = 3
        self.base_delay = 0.1  # 100ms
        self.max_delay = 2.0   # 2 seconds

    def _build_key(self, prefix: str, key: str) -> str:
        """Build Redis key with prefix"""
        return f"{prefix}{key}"

    def _retry_operation(self, operation, *args, **kwargs):
        """Execute Redis operation with retry logic"""
        for attempt in range(self.max_retries):
            try:
                return operation(*args, **kwargs)
            except (ConnectionError, TimeoutError) as e:
                if attempt == self.max_retries - 1:
                    logger.error(f"Redis operation failed after {self.max_retries} attempts: {str(e)}")
                    raise
                
                # Calculate delay with exponential backoff and jitter
                delay = min(self.base_delay * (2 ** attempt) + random.uniform(0, 0.1), self.max_delay)
                logger.warning(f"Redis operation failed, retrying in {delay:.2f}s. Error: {str(e)}")
                time.sleep(delay)

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
        """Check if the request is within rate limits using distributed rate limiting"""
        try:
            key = f"{self.rate_prefix}{user_id}:{ip_address}"
            
            # Use Redis pipeline for atomic operations
            with self.redis.pipeline() as pipe:
                try:
                    # Watch the key for changes
                    pipe.watch(key)
                    current = pipe.get(key)
                    
                    if current is None:
                        # Start transaction
                        pipe.multi()
                        pipe.set(key, 1, ex=self.rate_limit_ttl)
                        pipe.execute()
                        return True
                    
                    count = int(current)
                    if count >= self.rate_limit_requests:
                        return False
                    
                    # Start transaction
                    pipe.multi()
                    pipe.incr(key)
                    pipe.execute()
                    return True
                    
                except redis.WatchError:
                    # Key modified, retry operation
                    return self.check_rate_limit(user_id, ip_address)
                
        except Exception as e:
            logger.error(f"Error checking rate limit: {str(e)}")
            # Default to allowing the request in case of errors
            return True

    def delete_session(self, session_id: str) -> bool:
        """Delete session from Redis"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            return bool(self._retry_operation(self.redis.delete, key))
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            return False

    def set_session(self, session_id: str, data: Dict, ttl: Optional[int] = None) -> bool:
        """Store session data in Redis"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            serialized_data = self._serialize_value(data)
            return bool(self._retry_operation(
                self.redis.set,
                key,
                serialized_data,
                ex=(ttl or self.session_ttl)
            ))
        except Exception as e:
            logger.error(f"Error setting session: {e}")
            return False

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Retrieve session data from Redis"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            data = self._retry_operation(self.redis.get, key)
            if data:
                return self._deserialize_value(data, dict)
            return None
        except Exception as e:
            logger.error(f"Error getting session: {e}")
            return None

    def set_cache(self, cache_key: str, data: Any, ttl: Optional[int] = None) -> bool:
        """Store data in Redis cache"""
        try:
            key = self._build_key(self.cache_prefix, cache_key)
            serialized_data = self._serialize_value(data)
            return bool(self._retry_operation(
                self.redis.set,
                key,
                serialized_data,
                ex=(ttl or self.cache_ttl)
            ))
        except Exception as e:
            logger.error(f"Error setting cache: {str(e)}")
            return False

    def get_cache(self, cache_key: str) -> Optional[Any]:
        """Retrieve data from Redis cache"""
        try:
            key = self._build_key(self.cache_prefix, cache_key)
            data = self._retry_operation(self.redis.get, key)
            if data:
                return self._deserialize_value(data, dict)
            return None
        except Exception as e:
            logger.error(f"Error getting cache: {str(e)}")
            return None

    def invalidate_cache(self, pattern: str) -> bool:
        """Invalidate cache entries matching pattern"""
        try:
            pattern = self._build_key(self.cache_prefix, pattern)
            cursor = 0
            deleted_keys = 0
            
            while True:
                cursor, keys = self._retry_operation(self.redis.scan, cursor, match=pattern)
                if keys:
                    self._retry_operation(self.redis.delete, *keys)
                    deleted_keys += len(keys)
                if cursor == 0:
                    break
                    
            return True
        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")
            return False

    async def cleanup_expired_sessions(self):
        """Cleanup expired sessions"""
        try:
            pattern = f"{self.session_prefix}*"
            cursor = 0
            cleaned = 0
            
            while True:
                cursor, keys = self._retry_operation(self.redis.scan, cursor, match=pattern)
                for key in keys:
                    if not self._retry_operation(self.redis.ttl, key):
                        self._retry_operation(self.redis.delete, key)
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
                cursor, keys = self._retry_operation(self.redis.scan, cursor, match=pattern)
                for key in keys:
                    if not self._retry_operation(self.redis.ttl, key):
                        self._retry_operation(self.redis.delete, key)
                        cleaned += 1
                if cursor == 0:
                    break
                    
            logger.info(f"Cleaned up {cleaned} expired cache entries")
        except Exception as e:
            logger.error(f"Error cleaning up cache: {e}")

    def get_pool_stats(self) -> Dict:
        """Get connection pool statistics"""
        return {
            "max_connections": self.pool.max_connections,
            "current_connections": len(self.pool._in_use_connections),
            "available_connections": len(self.pool._available_connections)
        }
