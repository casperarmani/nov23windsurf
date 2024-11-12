from datetime import timedelta

class SessionConfig:
    SLIDING_WINDOW = 3600  # 1 hour sliding window
    ABSOLUTE_MAX = 86400   # 24 hour maximum session lifetime
    GRACE_PERIOD = 300     # 5 minute grace period for renewal
    CLEANUP_INTERVAL = 600 # 10 minute cleanup interval
    
    # Cookie settings
    COOKIE_NAME = "session_id"
    COOKIE_SECURE = True
    COOKIE_HTTPONLY = True
    COOKIE_SAMESITE = "lax"
