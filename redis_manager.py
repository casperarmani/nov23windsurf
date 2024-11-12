import redis
from redis.connection import ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError
import time
import logging
import json
from typing import Optional, Any, Dict, List, Union, Tuple
from datetime import datetime, timedelta
import random
from enum import Enum
import asyncio
import hashlib
import ipaddress

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CircuitState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

class TaskPriority(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class TaskType(Enum):
    VIDEO_PROCESSING = "video_processing"
    VIDEO_ANALYSIS = "video_analysis"
    MAINTENANCE = "maintenance"

class TaskStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class SecurityEvent(Enum):
    INVALID_FINGERPRINT = "invalid_fingerprint"
    IP_MISMATCH = "ip_mismatch"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    FORCED_LOGOUT = "forced_logout"

class RedisManager:
    def __init__(self, redis_url: str):
        self.pool = ConnectionPool.from_url(
            url=redis_url,
            max_connections=10,
            socket_timeout=5.0,
            socket_connect_timeout=2.0,
            retry_on_timeout=True
        )
        
        self.redis = redis.Redis(connection_pool=self.pool)
        
        self.circuit_state = CircuitState.CLOSED
        self.error_threshold = 5
        self.reset_timeout = 60
        self.error_count = 0
        self.last_error_time = 0
        
        self.session_prefix = "session:"
        self.cache_prefix = "cache:"
        self.rate_prefix = "rate:"
        self.queue_prefix = "queue:"
        self.dlq_prefix = "dlq:"
        self.result_prefix = "result:"
        
        self.security_prefix = "security:"
        self.fingerprint_prefix = "fingerprint:"
        self.ip_prefix = "ip:"
        self.revoked_prefix = "revoked:"
        self.suspicious_prefix = "suspicious:"
        
        self.session_ttl = 3600
        self.cache_ttl = 300
        self.rate_limit_ttl = 60
        self.result_ttl = 86400
        
        self.max_sessions_per_ip = 5
        self.max_failed_attempts = 5
        self.suspicious_threshold = 10
        self.ip_change_limit = 3
        self.fingerprint_ttl = 86400  # 24 hours
        
        self.rate_limit_requests = 100
        self.rate_limit_window = 60
        
        self.max_retries = 3
        self.base_delay = 0.1
        self.max_delay = 2.0
        self.retry_delay = 5
        self.task_timeout = 300

    def _build_key(self, prefix: str, key: str) -> str:
        return f"{prefix}{key}"

    def _check_circuit_state(self):
        if self.circuit_state == CircuitState.OPEN:
            if time.time() - self.last_error_time > self.reset_timeout:
                self.circuit_state = CircuitState.HALF_OPEN
                logger.info("Circuit breaker state changed to HALF_OPEN")
            else:
                raise ConnectionError("Circuit breaker is OPEN")
        return self.circuit_state == CircuitState.CLOSED

    def _handle_error(self, error: Exception):
        self.error_count += 1
        if self.error_count >= self.error_threshold:
            self.circuit_state = CircuitState.OPEN
            self.last_error_time = time.time()
            logger.warning(f"Circuit breaker opened due to {self.error_count} errors")
        logger.error(f"Redis operation error: {str(error)}")

    def _handle_success(self):
        if self.circuit_state == CircuitState.HALF_OPEN:
            self.circuit_state = CircuitState.CLOSED
            self.error_count = 0
            logger.info("Circuit breaker reset to CLOSED state")

    def _retry_operation(self, operation, *args, **kwargs):
        if not self._check_circuit_state():
            raise ConnectionError("Circuit breaker is preventing operation")
        
        for attempt in range(self.max_retries):
            try:
                result = operation(*args, **kwargs)
                self._handle_success()
                return result
            except (ConnectionError, TimeoutError) as e:
                if attempt == self.max_retries - 1:
                    self._handle_error(e)
                    raise
                delay = min(self.base_delay * (2 ** attempt) + random.uniform(0, 0.1), self.max_delay)
                logger.warning(f"Redis operation failed, retrying in {delay:.2f}s. Error: {str(e)}")
                time.sleep(delay)

    def _serialize_value(self, value: Any) -> str:
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

    def validate_session(self, session_id: str) -> Tuple[bool, Optional[Dict]]:
        """Validate a session and return its data if valid"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            session_data = self._retry_operation(self.redis.get, key)
            
            if not session_data:
                return False, None
                
            session_data = self._deserialize_value(session_data, dict)
            if not session_data or not isinstance(session_data, dict):
                return False, None
                
            last_refresh = session_data.get('last_refresh', 0)
            current_time = time.time()
            
            if current_time - last_refresh > self.session_ttl:
                self._retry_operation(self.redis.delete, key)
                return False, None
                
            return True, session_data
            
        except Exception as e:
            logger.error(f"Error validating session: {str(e)}")
            return False, None

    def set_session(self, session_id: str, data: Dict, ttl: Optional[int] = None) -> bool:
        """Set a new session with the given data"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            data['last_refresh'] = time.time()
            serialized_data = self._serialize_value(data)
            return bool(self._retry_operation(self.redis.set, key, serialized_data, ex=(ttl or self.session_ttl)))
        except Exception as e:
            logger.error(f"Error setting session: {str(e)}")
            return False

    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get session data if it exists and is valid"""
        try:
            is_valid, session_data = self.validate_session(session_id)
            return session_data if is_valid else None
        except Exception as e:
            logger.error(f"Error getting session: {str(e)}")
            return None

    def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        try:
            key = self._build_key(self.session_prefix, session_id)
            return bool(self._retry_operation(self.redis.delete, key))
        except Exception as e:
            logger.error(f"Error deleting session: {str(e)}")
            return False

    async def refresh_session(self, session_id: str) -> bool:
        """Refresh a session if it exists and is within refresh threshold"""
        try:
            is_valid, session_data = self.validate_session(session_id)
            if not is_valid or not session_data:
                return False

            current_time = time.time()
            last_refresh = session_data.get('last_refresh', 0)
            
            # Only refresh if within threshold of expiration
            if current_time - last_refresh > (self.session_ttl - self.session_ttl / 6):
                session_data['last_refresh'] = current_time
                return self.set_session(session_id, session_data, self.session_ttl)
            
            return True
            
        except Exception as e:
            logger.error(f"Error refreshing session: {str(e)}")
            return False

    async def cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        try:
            pattern = f"{self.session_prefix}*"
            cursor = 0
            cleaned = 0
            
            while True:
                cursor, keys = self._retry_operation(self.redis.scan, cursor, match=pattern)
                current_time = time.time()
                
                for key in keys:
                    try:
                        session_data = self._retry_operation(self.redis.get, key)
                        if session_data:
                            session_data = self._deserialize_value(session_data, dict)
                            if session_data and isinstance(session_data, dict):
                                last_refresh = session_data.get('last_refresh', 0)
                                if current_time - last_refresh > self.session_ttl:
                                    self._retry_operation(self.redis.delete, key)
                                    cleaned += 1
                    except Exception as e:
                        logger.error(f"Error processing session key {key}: {str(e)}")
                        continue
                        
                if cursor == 0:
                    break
                    
            logger.info(f"Cleaned up {cleaned} expired sessions")
            
        except Exception as e:
            logger.error(f"Error in session cleanup: {str(e)}")

    def check_rate_limit(self, resource: str, identifier: str) -> bool:
        try:
            key = f"{self.rate_prefix}{resource}:{identifier}"
            with self.redis.pipeline() as pipe:
                try:
                    pipe.watch(key)
                    current = pipe.get(key)
                    if current is None:
                        pipe.multi()
                        pipe.set(key, 1, ex=self.rate_limit_ttl)
                        pipe.execute()
                        return True
                    count = int(current)
                    if count >= self.rate_limit_requests:
                        return False
                    pipe.multi()
                    pipe.incr(key)
                    pipe.execute()
                    return True
                except redis.WatchError:
                    return self.check_rate_limit(resource, identifier)
        except Exception as e:
            logger.error(f"Error checking rate limit: {str(e)}")
            return True

    def set_cache(self, cache_key: str, data: Any, ttl: Optional[int] = None) -> bool:
        try:
            key = self._build_key(self.cache_prefix, cache_key)
            serialized_data = self._serialize_value(data)
            return bool(self._retry_operation(self.redis.set, key, serialized_data, ex=(ttl or self.cache_ttl)))
        except Exception as e:
            logger.error(f"Error setting cache: {str(e)}")
            return False

    def get_cache(self, cache_key: str) -> Optional[Any]:
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
            logger.error(f"Error invalidating cache: {str(e)}")
            return False

    async def refresh_session(self, session_id: str) -> bool:
        try:
            key = self._build_key(self.session_prefix, session_id)
            session_data = self.get_session(session_id)
            if session_data:
                session_data['last_keepalive'] = time.time()
                return self.set_session(session_id, session_data, self.session_ttl)
            return False
        except Exception as e:
            logger.error(f"Error refreshing session: {str(e)}")
            return False

    def _get_queue_key(self, priority: TaskPriority, task_type: TaskType) -> str:
        return f"{self.queue_prefix}{priority.value}:{task_type.value}"

    def _get_dlq_key(self, task_type: TaskType) -> str:
        return f"{self.dlq_prefix}{task_type.value}"

    def _get_result_key(self, task_id: str) -> str:
        return f"{self.result_prefix}{task_id}"

    def enqueue_task(self, task_type: TaskType, payload: Dict[str, Any], priority: TaskPriority = TaskPriority.MEDIUM) -> Optional[str]:
        try:
            task_id = str(random.getrandbits(64))
            timestamp = time.time()
            task_data = {
                "task_id": task_id,
                "type": task_type.value,
                "payload": payload,
                "status": TaskStatus.PENDING.value,
                "priority": priority.value,
                "created_at": timestamp,
                "retries": 0,
                "last_retry": None,
                "error": None
            }
            
            queue_key = self._get_queue_key(priority, task_type)
            with self.redis.pipeline() as pipe:
                try:
                    pipe.watch(queue_key)
                    pipe.multi()
                    pipe.zadd(queue_key, {json.dumps(task_data): timestamp})
                    pipe.execute()
                    logger.info(f"Task {task_id} enqueued successfully")
                    return task_id
                except redis.WatchError:
                    logger.error(f"Queue {queue_key} was modified, retrying operation")
                    return self.enqueue_task(task_type, payload, priority)
        except Exception as e:
            logger.error(f"Error enqueueing task: {str(e)}")
            return None

    def dequeue_task(self, queue_name: str) -> Optional[Dict[str, Any]]:
        try:
            with self.redis.pipeline() as pipe:
                while True:
                    try:
                        pipe.watch(queue_name)
                        tasks = self.redis.zrange(queue_name, 0, 0, withscores=True)
                        if not tasks:
                            return None
                        task_json, score = tasks[0]
                        task_data = json.loads(task_json)
                        pipe.multi()
                        pipe.zrem(queue_name, task_json)
                        task_data["status"] = TaskStatus.PROCESSING.value
                        task_data["started_at"] = time.time()
                        pipe.execute()
                        return task_data
                    except redis.WatchError:
                        continue
        except Exception as e:
            logger.error(f"Error dequeuing task: {str(e)}")
            return None

    def get_queue_status(self) -> Dict[str, Any]:
        try:
            status = {
                "queues": {},
                "dead_letter_queues": {},
                "total_pending": 0,
                "total_processing": 0,
                "total_failed": 0
            }
            
            for priority in TaskPriority:
                for task_type in TaskType:
                    queue_key = self._get_queue_key(priority, task_type)
                    dlq_key = self._get_dlq_key(task_type)
                    queue_length = self.redis.zcard(queue_key)
                    dlq_length = self.redis.zcard(dlq_key)
                    status["queues"][f"{priority.value}:{task_type.value}"] = queue_length
                    status["dead_letter_queues"][task_type.value] = dlq_length
                    status["total_pending"] += queue_length
                    status["total_failed"] += dlq_length
                    
            return status
        except Exception as e:
            logger.error(f"Error getting queue status: {str(e)}")
            return {}

    async def cleanup_expired_cache(self):
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
            logger.error(f"Error cleaning up cache: {str(e)}")

    async def health_check(self) -> Dict[str, Any]:
        health_info = {
            "status": "healthy",
            "circuit_state": self.circuit_state.value,
            "pool_stats": self.get_pool_stats(),
            "latency_ms": None,
            "errors": []
        }

        try:
            start_time = time.time()
            await asyncio.to_thread(self._retry_operation, self.redis.ping)
            latency = (time.time() - start_time) * 1000
            health_info["latency_ms"] = round(latency, 2)
            keyspace_info = await asyncio.to_thread(self._retry_operation, self.redis.info, "keyspace")
            health_info["keyspace"] = keyspace_info
        except Exception as e:
            health_info["status"] = "unhealthy"
            health_info["errors"].append(str(e))

        return health_info

    async def get_metrics(self) -> Dict[str, Any]:
        try:
            metrics = {
                "pool_stats": self.get_pool_stats(),
                "operations": {
                    "processed_tasks": 0,
                    "failed_tasks": 0,
                    "queued_tasks": 0,
                    "used_memory": "0",
                    "used_memory_peak": "0"
                }
            }

            info = await asyncio.to_thread(self._retry_operation, self.redis.info)
            if info:
                metrics["operations"].update({
                    "processed_tasks": info.get("total_commands_processed", 0),
                    "used_memory": info.get("used_memory_human", "0"),
                    "used_memory_peak": info.get("used_memory_peak_human", "0")
                })

            queue_status = self.get_queue_status()
            metrics["operations"]["queued_tasks"] = queue_status.get("total_pending", 0)
            metrics["operations"]["failed_tasks"] = queue_status.get("total_failed", 0)

            return metrics
        except Exception as e:
            logger.error(f"Error getting metrics: {str(e)}")
            return {}

    def get_pool_stats(self) -> Dict:
        return {
            "max_connections": self.pool.max_connections,
            "current_connections": len(self.pool._in_use_connections),
            "available_connections": len(self.pool._available_connections)
        }

    def generate_fingerprint(self, user_agent: str, ip: str) -> str:
        """Generate a session fingerprint based on user agent and IP"""
        fingerprint_data = f"{user_agent}:{ip}".encode('utf-8')
        return hashlib.sha256(fingerprint_data).hexdigest()

    def validate_ip_address(self, ip: str) -> bool:
        """Validate IP address format"""
        try:
            ipaddress.ip_address(ip)
            return True
        except ValueError:
            return False

    async def create_session_with_security(self, session_id: str, data: Dict, user_agent: str, ip: str) -> bool:
        """Create a new session with security measures"""
        if not self.validate_ip_address(ip):
            logger.error(f"Invalid IP address format: {ip}")
            return False

        try:
            # Generate fingerprint
            fingerprint = self.generate_fingerprint(user_agent, ip)
            
            # Check IP-based session limit
            ip_sessions_key = f"{self.ip_prefix}{ip}"
            if self.redis.scard(ip_sessions_key) >= self.max_sessions_per_ip:
                logger.warning(f"Maximum sessions exceeded for IP: {ip}")
                self.record_security_event(SecurityEvent.RATE_LIMIT_EXCEEDED, ip)
                return False
            
            # Store session with security metadata
            session_data = {
                **data,
                "fingerprint": fingerprint,
                "ip": ip,
                "created_at": time.time(),
                "last_refresh": time.time(),
                "refresh_count": 0,
                "ip_changes": []
            }
            
            key = self._build_key(self.session_prefix, session_id)
            
            # Use pipeline for atomic operations
            with self.redis.pipeline() as pipe:
                pipe.multi()
                pipe.set(key, self._serialize_value(session_data), ex=self.session_ttl)
                pipe.sadd(ip_sessions_key, session_id)
                pipe.set(f"{self.fingerprint_prefix}{session_id}", fingerprint, ex=self.fingerprint_ttl)
                pipe.execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Error creating secure session: {str(e)}")
            return False

    async def validate_session_security(self, session_id: str, current_fingerprint: str, current_ip: str) -> bool:
        """Validate session security aspects"""
        try:
            session_data = self.get_session(session_id)
            if not session_data:
                return False
            
            # Check if session is revoked
            if self.redis.sismember(f"{self.revoked_prefix}sessions", session_id):
                logger.warning(f"Attempted access to revoked session: {session_id}")
                return False
            
            # Validate fingerprint
            stored_fingerprint = session_data.get("fingerprint")
            if stored_fingerprint != current_fingerprint:
                self.record_security_event(SecurityEvent.INVALID_FINGERPRINT, session_id)
                return False
            
            # Track IP changes
            stored_ip = session_data.get("ip")
            if stored_ip != current_ip:
                ip_changes = session_data.get("ip_changes", [])
                if len(ip_changes) >= self.ip_change_limit:
                    self.record_security_event(SecurityEvent.IP_MISMATCH, session_id)
                    return False
                
                # Update IP change history
                ip_changes.append({
                    "old_ip": stored_ip,
                    "new_ip": current_ip,
                    "timestamp": time.time()
                })
                session_data["ip_changes"] = ip_changes
                session_data["ip"] = current_ip
                
                # Update session data
                self.set_session(session_id, session_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating session security: {str(e)}")
            return False

    def record_security_event(self, event: SecurityEvent, identifier: str, details: Dict = None):
        """Record security events for monitoring"""
        try:
            event_data = {
                "event": event.value,
                "identifier": identifier,
                "timestamp": time.time(),
                "details": details or {}
            }
            
            # Store event in Redis
            event_key = f"{self.security_prefix}events:{int(time.time())}"
            self.redis.set(event_key, self._serialize_value(event_data), ex=86400)  # Store for 24 hours
            
            # Update suspicious activity counter
            if event != SecurityEvent.FORCED_LOGOUT:
                suspicious_key = f"{self.suspicious_prefix}{identifier}"
                self.redis.incr(suspicious_key)
                self.redis.expire(suspicious_key, 3600)  # Reset after 1 hour
                
                # Check suspicious threshold
                if int(self.redis.get(suspicious_key) or 0) >= self.suspicious_threshold:
                    self.revoke_sessions_for_identifier(identifier)
                    
        except Exception as e:
            logger.error(f"Error recording security event: {str(e)}")

    def revoke_sessions_for_identifier(self, identifier: str):
        """Revoke all sessions for a specific identifier (user_id or IP)"""
        try:
            # Add to revoked sessions set
            self.redis.sadd(f"{self.revoked_prefix}sessions", identifier)
            
            # Record revocation event
            self.record_security_event(
                SecurityEvent.FORCED_LOGOUT,
                identifier,
                {"reason": "suspicious_activity_threshold_exceeded"}
            )
            
        except Exception as e:
            logger.error(f"Error revoking sessions: {str(e)}")

    async def get_security_metrics(self) -> Dict:
        """Get security-related metrics"""
        try:
            current_time = time.time()
            hour_ago = current_time - 3600
            
            metrics = {
                "security_events": {
                    "total": 0,
                    "by_type": {},
                    "recent_events": []
                },
                "active_sessions": self.redis.scard(f"{self.session_prefix}*"),
                "revoked_sessions": self.redis.scard(f"{self.revoked_prefix}sessions"),
                "suspicious_activities": self.redis.keys(f"{self.suspicious_prefix}*")
            }
            
            # Collect recent security events
            event_keys = self.redis.keys(f"{self.security_prefix}events:*")
            for key in event_keys:
                event_data = self._deserialize_value(self.redis.get(key), dict)
                if event_data and event_data.get("timestamp", 0) > hour_ago:
                    metrics["security_events"]["total"] += 1
                    event_type = event_data["event"]
                    metrics["security_events"]["by_type"][event_type] = metrics["security_events"]["by_type"].get(event_type, 0) + 1
                    metrics["security_events"]["recent_events"].append(event_data)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error getting security metrics: {str(e)}")
            return {}

    async def health_check(self) -> Dict:
        """Check Redis health status and return metrics"""
        try:
            # Basic connectivity test
            self.redis.ping()
            
            return {
                "status": "healthy",
                "circuit_state": self.circuit_state.value,
                "error_count": self.error_count,
                "connection_pool": {
                    "max_connections": self.pool.max_connections,
                    "current_connections": len(self.pool._in_use_connections) if hasattr(self.pool, '_in_use_connections') else 0,
                    "available_connections": len(self.pool._available_connections) if hasattr(self.pool, '_available_connections') else 0
                },
                "metrics": {
                    "active_sessions": len(self.redis.keys(f"{self.session_prefix}*")),
                    "cached_items": len(self.redis.keys(f"{self.cache_prefix}*")),
                    "rate_limited_items": len(self.redis.keys(f"{self.rate_prefix}*")),
                    "security_events": len(self.redis.keys(f"{self.security_prefix}*"))
                }
            }
        except Exception as e:
            logger.error(f"Redis health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "circuit_state": self.circuit_state.value,
                "error": str(e)
            }