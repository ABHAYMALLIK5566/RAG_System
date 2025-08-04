import hashlib
import hmac
import secrets
import re
import html
import bleach
import ipaddress
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64
import logging
from ..core.config import settings

logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security patterns for input validation
SECURITY_PATTERNS = {
    'sql_injection': [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)",
        r"('|(\\x27)|(\\x2D)|(\\x3B))",
        r"(\-\-|\#|\/\*|\*\/)",
        r"(\bOR\b|\bAND\b).*(\=|\>|\<)",
    ],
    'xss': [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"vbscript:",
        r"onload=",
        r"onerror=",
        r"onclick=",
        r"onmouseover=",
    ],
    'path_traversal': [
        r"\.\./",
        r"\.\.\\",
        r"%2e%2e%2f",
        r"%2e%2e%5c",
    ],
    'command_injection': [
        r"[;&|`]",
        r"\$\(",
        r"``",
        r"\${",
    ]
}

class SecurityManager:
    """Centralized security management"""
    
    def __init__(self):
        self.blocked_ips: set = set()
        self.failed_attempts: Dict[str, List[datetime]] = {}
        self.rate_limits: Dict[str, List[datetime]] = {}
        
    def is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is blocked"""
        return ip in self.blocked_ips
    
    def block_ip(self, ip: str, duration_minutes: int = 60):
        """Block IP address"""
        self.blocked_ips.add(ip)
        # In production, implement with Redis/database for persistence
        logger.warning(f"IP {ip} blocked for {duration_minutes} minutes")
    
    def unblock_ip(self, ip: str):
        """Unblock IP address"""
        self.blocked_ips.discard(ip)
        logger.info(f"IP {ip} unblocked")
    
    def record_failed_attempt(self, identifier: str) -> int:
        """Record failed login attempt and return count"""
        now = datetime.utcnow()
        if identifier not in self.failed_attempts:
            self.failed_attempts[identifier] = []
        
        # Remove attempts older than 1 hour
        self.failed_attempts[identifier] = [
            attempt for attempt in self.failed_attempts[identifier]
            if now - attempt < timedelta(hours=1)
        ]
        
        self.failed_attempts[identifier].append(now)
        return len(self.failed_attempts[identifier])
    
    def clear_failed_attempts(self, identifier: str):
        """Clear failed attempts for identifier"""
        self.failed_attempts.pop(identifier, None)
    
    def check_rate_limit(self, identifier: str, max_requests: int, window_minutes: int) -> bool:
        """Check if identifier is within rate limits"""
        now = datetime.utcnow()
        if identifier not in self.rate_limits:
            self.rate_limits[identifier] = []
        
        # Remove old requests outside the window
        cutoff = now - timedelta(minutes=window_minutes)
        self.rate_limits[identifier] = [
            request_time for request_time in self.rate_limits[identifier]
            if request_time > cutoff
        ]
        
        # Check if within limits
        if len(self.rate_limits[identifier]) >= max_requests:
            return False
        
        # Record this request
        self.rate_limits[identifier].append(now)
        return True

# Global security manager instance
security_manager = SecurityManager()

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def generate_secure_token(length: int = 32) -> str:
    """Generate cryptographically secure random token"""
    return secrets.token_urlsafe(length)

def generate_api_key() -> tuple[str, str]:
    """Generate API key pair (key_id, secret)"""
    key_id = secrets.token_urlsafe(16)  # 16 bytes = 22 chars
    secret = secrets.token_urlsafe(32)  # 32 bytes = 43 chars
    return key_id, secret

def hash_api_key(key: str) -> str:
    """Hash API key for storage"""
    return hashlib.sha256(key.encode()).hexdigest()

def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """Verify API key against hash"""
    return hmac.compare_digest(hash_api_key(plain_key), hashed_key)

def sanitize_input(text: str, allow_html: bool = False) -> str:
    """Sanitize user input"""
    if not text:
        return ""
    
    # HTML escape if HTML not allowed
    if not allow_html:
        text = html.escape(text)
    else:
        # Use bleach to clean HTML
        allowed_tags = ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']
        text = bleach.clean(text, tags=allowed_tags, strip=True)
    
    # Remove null bytes and control characters
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    
    return text

def validate_input(text: str, check_patterns: List[str] = None) -> Dict[str, Any]:
    """Validate input for security threats"""
    if not text:
        return {"is_safe": True, "threats": []}
    
    threats = []
    
    # Check specified patterns or all patterns
    patterns_to_check = check_patterns or list(SECURITY_PATTERNS.keys())
    
    for threat_type in patterns_to_check:
        if threat_type in SECURITY_PATTERNS:
            for pattern in SECURITY_PATTERNS[threat_type]:
                if re.search(pattern, text, re.IGNORECASE):
                    threats.append({
                        "type": threat_type,
                        "pattern": pattern,
                        "severity": "high" if threat_type in ["sql_injection", "command_injection"] else "medium"
                    })
    
    return {
        "is_safe": len(threats) == 0,
        "threats": threats,
        "sanitized": sanitize_input(text)
    }

def validate_ip_address(ip: str) -> bool:
    """Validate IP address format"""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False

def is_private_ip(ip: str) -> bool:
    """Check if IP is private/internal"""
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_username(username: str) -> Dict[str, Any]:
    """Validate username"""
    errors = []
    
    if len(username) < 3:
        errors.append("Username must be at least 3 characters")
    if len(username) > 50:
        errors.append("Username must be less than 50 characters")
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        errors.append("Username can only contain letters, numbers, underscores, and hyphens")
    
    # Check for reserved usernames
    reserved = ['admin', 'root', 'system', 'api', 'test', 'user', 'null', 'undefined']
    if username.lower() in reserved:
        errors.append("Username is reserved")
    
    return {
        "is_valid": len(errors) == 0,
        "errors": errors
    }

def validate_password(password: str) -> Dict[str, Any]:
    """Validate password strength"""
    errors = []
    score = 0
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters")
    else:
        score += 1
    
    if len(password) >= 12:
        score += 1
    
    if re.search(r'[a-z]', password):
        score += 1
    else:
        errors.append("Password must contain lowercase letters")
    
    if re.search(r'[A-Z]', password):
        score += 1
    else:
        errors.append("Password must contain uppercase letters")
    
    if re.search(r'\d', password):
        score += 1
    else:
        errors.append("Password must contain numbers")
    
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        score += 1
    else:
        errors.append("Password must contain special characters")
    
    # Check for common patterns
    common_patterns = [
        r'123456',
        r'password',
        r'qwerty',
        r'abc123',
        r'admin',
    ]
    
    for pattern in common_patterns:
        if re.search(pattern, password, re.IGNORECASE):
            errors.append("Password contains common patterns")
            score -= 1
            break
    
    strength_levels = {
        0: "very_weak",
        1: "weak", 
        2: "weak",
        3: "fair",
        4: "good",
        5: "strong",
        6: "very_strong"
    }
    
    return {
        "is_valid": len(errors) == 0,
        "errors": errors,
        "score": max(0, score),
        "strength": strength_levels.get(max(0, score), "weak")
    }

def create_security_headers() -> Dict[str, str]:
    """Create security headers for responses"""
    return {
        # Comment out all security headers for development
        # "X-Content-Type-Options": "nosniff",
        # "X-Frame-Options": "DENY",
        # "X-XSS-Protection": "1; mode=block",
        # "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        # "Content-Security-Policy": "...",
        # "Referrer-Policy": "strict-origin-when-cross-origin",
        # "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }

def encrypt_sensitive_data(data: str, key: Optional[str] = None) -> str:
    """Encrypt sensitive data"""
    if key is None:
        key = Fernet.generate_key()
    else:
        key = key.encode() if isinstance(key, str) else key
    
    fernet = Fernet(key)
    encrypted = fernet.encrypt(data.encode())
    return base64.urlsafe_b64encode(encrypted).decode()

def decrypt_sensitive_data(encrypted_data: str, key: str) -> str:
    """Decrypt sensitive data"""
    key = key.encode() if isinstance(key, str) else key
    fernet = Fernet(key)
    
    decoded = base64.urlsafe_b64decode(encrypted_data.encode())
    decrypted = fernet.decrypt(decoded)
    return decrypted.decode()

def generate_csrf_token() -> str:
    """Generate CSRF token"""
    return secrets.token_urlsafe(32)

def verify_csrf_token(token: str, expected: str) -> bool:
    """Verify CSRF token"""
    return hmac.compare_digest(token, expected)

def mask_sensitive_data(data: str, mask_char: str = "*", show_last: int = 4) -> str:
    """Mask sensitive data for logging"""
    if len(data) <= show_last:
        return mask_char * len(data)
    
    return mask_char * (len(data) - show_last) + data[-show_last:]

def log_security_event(event_type: str, message: str, severity: str = "medium", **kwargs):
    """Log security event"""
    event_data = {
        "event_type": event_type,
        "message": message,
        "severity": severity,
        "timestamp": datetime.utcnow().isoformat(),
        **kwargs
    }
    
    logger.warning(f"SECURITY_EVENT: {event_data}")
    
    # In production, send to SIEM/security monitoring system
    return event_data 