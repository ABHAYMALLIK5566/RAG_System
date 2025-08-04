import time
import logging
import os
from typing import Callable, Optional
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from ..core.config import settings

from .security import (
    security_manager, 
    validate_input, 
    sanitize_input, 
    create_security_headers,
    log_security_event,
    validate_ip_address
)
from .auth import auth_manager, get_current_user, verify_api_key
from .models import User, UserRole

logger = logging.getLogger(__name__)

class SecurityMiddleware(BaseHTTPMiddleware):
    """Comprehensive security middleware"""
    
    def __init__(self, app, enable_rate_limiting: bool = True, enable_ip_blocking: bool = True):
        super().__init__(app)
        self.enable_rate_limiting = enable_rate_limiting
        self.enable_ip_blocking = enable_ip_blocking
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        try:
            # 1. IP Blocking Check
            if self.enable_ip_blocking and client_ip:
                if security_manager.is_ip_blocked(client_ip):
                    log_security_event(
                        "blocked_ip_request",
                        f"Request from blocked IP: {client_ip}",
                        "high",
                        ip_address=client_ip,
                        endpoint=str(request.url),
                        method=request.method
                    )
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"error": "Access denied", "code": "IP_BLOCKED"},
                        headers=create_security_headers()
                    )
            
            # 2. Rate Limiting
            if self.enable_rate_limiting and client_ip:
                if not self._check_rate_limits(request, client_ip):
                    log_security_event(
                        "rate_limit_exceeded",
                        f"Rate limit exceeded for IP: {client_ip}",
                        "medium",
                        ip_address=client_ip,
                        endpoint=str(request.url),
                        method=request.method
                    )
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"error": "Rate limit exceeded", "code": "RATE_LIMITED"},
                        headers={
                            **create_security_headers(),
                            "Retry-After": "60"
                        }
                    )
            
            # 3. Input Validation for POST/PUT/PATCH requests
            if request.method in ["POST", "PUT", "PATCH"]:
                await self._validate_request_input(request)
            
            # 4. Security Headers Check
            self._validate_request_headers(request)
            
            # Process request
            response = await call_next(request)
            
            # 5. Add security headers to response
            security_headers = create_security_headers()
            for header, value in security_headers.items():
                response.headers[header] = value
            
            # 6. Log successful request
            processing_time = time.time() - start_time
            self._log_request(request, response, processing_time, client_ip)
            
            return response
        
        except HTTPException as e:
            # Handle HTTP exceptions with security headers
            return JSONResponse(
                status_code=e.status_code,
                content={"error": e.detail, "code": "HTTP_EXCEPTION"},
                headers=create_security_headers()
            )
        
        except Exception as e:
            # Handle unexpected errors
            logger.error(f"Security middleware error: {e}")
            log_security_event(
                "middleware_error",
                f"Security middleware error: {str(e)}",
                "high",
                ip_address=client_ip,
                endpoint=str(request.url),
                method=request.method
            )
            
            # In debug mode, return a more informative error
            if getattr(settings, 'debug', False):
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={"error": "Security middleware error", "details": str(e), "code": "MIDDLEWARE_ERROR"},
                    headers=create_security_headers()
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={"error": "Internal server error", "code": "MIDDLEWARE_ERROR"},
                    headers=create_security_headers()
                )
    
    def _get_client_ip(self, request: Request) -> Optional[str]:
        """Extract client IP address"""
        # Check X-Forwarded-For header (from load balancer/proxy)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP (original client)
            client_ip = forwarded_for.split(",")[0].strip()
            if validate_ip_address(client_ip):
                return client_ip
        
        # Check X-Real-IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip and validate_ip_address(real_ip):
            return real_ip
        
        # Fall back to direct connection IP
        if hasattr(request.client, "host"):
            return request.client.host
        
        return None
    
    def _check_rate_limits(self, request: Request, client_ip: str) -> bool:
        """Check various rate limits"""
        # Skip rate limiting in test mode or debug mode with relaxed security
        if (getattr(settings, 'test_mode', False) or 
            (getattr(settings, 'debug', False) and getattr(settings, 'relaxed_security_in_debug', True))):
            return True
        
        endpoint = str(request.url.path)
        
        # Global rate limit per IP
        if not security_manager.check_rate_limit(f"global_{client_ip}", 1000, 60):  # 1000 req/hour (more reasonable)
            return False
        
        # API endpoint specific limits
        if endpoint.startswith("/api/"):
            if not security_manager.check_rate_limit(f"api_{client_ip}", 300, 60):  # 300 req/hour (more reasonable)
                return False
        
        # Authentication endpoint limits
        auth_endpoints = ["/api/v1/auth/login", "/api/v1/auth/register"]
        if endpoint in auth_endpoints:
            if not security_manager.check_rate_limit(f"auth_{client_ip}", 20, 60):  # 20 attempts/hour (more reasonable)
                return False
        
        # WebSocket connection limits
        if endpoint.startswith("/ws"):
            if not security_manager.check_rate_limit(f"ws_{client_ip}", 10, 60):  # 10 connections/hour
                return False
        
        return True
    
    async def _validate_request_input(self, request: Request):
        """Validate request input for security threats"""
        try:
            # Skip aggressive validation in test mode or debug mode with relaxed security
            if (getattr(settings, 'test_mode', False) or 
                (getattr(settings, 'debug', False) and getattr(settings, 'relaxed_security_in_debug', True))):
                # In test/debug mode, be less aggressive with validation
                return
            
            # Skip validation for documentation and health endpoints
            if request.url.path in ["/docs", "/redoc", "/openapi.json", "/health", "/"]:
                return
            
            # Get request body if present
            if hasattr(request, '_body'):
                body = request._body
            else:
                body = await request.body()
                request._body = body
            
            if body:
                body_text = body.decode('utf-8', errors='ignore')
                
                # Validate input for security threats
                validation_result = validate_input(body_text)
                
                if not validation_result["is_safe"]:
                    threats = validation_result["threats"]
                    high_severity_threats = [t for t in threats if t["severity"] == "high"]
                    
                    if high_severity_threats:
                        log_security_event(
                            "high_severity_input_threat",
                            f"High severity input threat detected: {high_severity_threats}",
                            "critical",
                            ip_address=self._get_client_ip(request),
                            endpoint=str(request.url),
                            method=request.method,
                            threats=threats
                        )
                        
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid input detected"
                        )
        
        except UnicodeDecodeError:
            # Invalid UTF-8 encoding
            log_security_event(
                "invalid_encoding_detected",
                "Invalid UTF-8 encoding in request body",
                "medium",
                ip_address=self._get_client_ip(request),
                endpoint=str(request.url),
                method=request.method
            )
    
    def _validate_request_headers(self, request: Request):
        """Validate request headers for security issues"""
        # Check for header injection attempts
        for header_name, header_value in request.headers.items():
            if isinstance(header_value, str):
                if '\r' in header_value or '\n' in header_value:
                    log_security_event(
                        "header_injection_attempt",
                        f"Header injection detected in {header_name}",
                        "high",
                        ip_address=self._get_client_ip(request),
                        endpoint=str(request.url),
                        method=request.method,
                        header_name=header_name
                    )
                    
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid header format"
                    )
        
        # Check for suspicious user agents
        user_agent = request.headers.get("user-agent", "").lower()
        suspicious_patterns = [
            "sqlmap", "nmap", "nikto", "burp", "owasp", "havij",
            "sqlninja", "acunetix", "netsparker", "appscan"
        ]
        
        for pattern in suspicious_patterns:
            if pattern in user_agent:
                log_security_event(
                    "suspicious_user_agent",
                    f"Suspicious user agent detected: {user_agent}",
                    "medium",
                    ip_address=self._get_client_ip(request),
                    endpoint=str(request.url),
                    method=request.method,
                    user_agent=user_agent
                )
                break
    
    def _log_request(self, request: Request, response: Response, processing_time: float, client_ip: str):
        """Log request for monitoring"""
        logger.info(
            f"REQUEST: {request.method} {request.url} - "
            f"Status: {response.status_code} - "
            f"IP: {client_ip} - "
            f"Time: {processing_time:.3f}s - "
            f"UA: {request.headers.get('user-agent', 'Unknown')[:100]}"
        )

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Authentication middleware for protected routes"""
    
    def __init__(self, app, protected_paths: list = None):
        print("[DEBUG] AuthenticationMiddleware __init__ called")
        super().__init__(app)
        self.protected_paths = protected_paths or [
            "/api/v1/rag/documents",
            "/api/v1/rag/query", 
            "/api/v1/rag/search",
            "/api/v1/admin",
            "/api/v1/auth/me"
        ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        print(f"[DEBUG] AuthenticationMiddleware dispatch called for path: {request.url.path}")
        path = request.url.path
        
        # Debug logging
        logger.info(f"AUTH_MIDDLEWARE: Processing path: {path}")
        logger.info(f"AUTH_MIDDLEWARE: Protected paths: {self.protected_paths}")
        
        # Allow OPTIONS requests (CORS preflight) without authentication
        if request.method == "OPTIONS":
            response = await call_next(request)
            return response
        
        # Check if path requires authentication
        is_protected = any(path.startswith(protected_path) for protected_path in self.protected_paths)
        logger.info(f"AUTH_MIDDLEWARE: Path {path} is protected: {is_protected}")
        
        if is_protected:
            # Try to authenticate user
            try:
                user = None
                api_key = None
                
                # Check for Bearer token
                auth_header = request.headers.get("authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    token = auth_header.split(" ")[1]
                    
                    # Verify token (this handles both real and mock tokens)
                    token_data = auth_manager.verify_token(token)
                    if token_data:
                        # Create user from token data (token_data is a dict)
                        # Fix role parsing - handle both enum names and values
                        role_str = token_data.get("role") or "user"
                        if role_str.startswith("UserRole."):
                            # Extract the enum value from "UserRole.ADMIN" -> "admin"
                            role_value = role_str.split(".")[1].lower()
                        else:
                            role_value = role_str
                        
                        # Convert role string to UserRole enum
                        try:
                            user_role = UserRole(role_value)
                        except (ValueError, TypeError):
                            user_role = UserRole.USER
                        
                        # Ensure we have a valid user ID
                        user_id = token_data.get("sub") or token_data.get("user_id") or "unknown"
                        if user_id is None:
                            user_id = "unknown"
                        
                        user = User(
                            id=user_id,
                            username=token_data.get("username") or "unknown",
                            email="user@example.com",
                            hashed_password="",
                            role=user_role
                        )
                        
                        # Store token permissions in user metadata for permission checking
                        token_permissions = token_data.get("permissions", [])
                        user.metadata["token_permissions"] = token_permissions
                        
                        # Debug logging for testing
                        logger.debug(f"Token authenticated successfully: {token_data.get('username')}")
                        try:
                            with open('/tmp/auth_debug.txt', 'a') as f:
                                f.write(f"[AUTH_MIDDLEWARE] User created: {user.username}, Role: {user.role}, Permissions: {user.metadata.get('token_permissions', [])}\n")
                        except Exception as file_exc:
                            logger.error(f"Failed to write debug file: {file_exc}")
                
                # Check for API key
                api_key_header = request.headers.get("x-api-key")
                if api_key_header and not user:  # Only check API key if no user token
                    try:
                        api_key = await auth_manager.authenticate_api_key(
                            api_key_header, 
                            self._get_client_ip(request)
                        )
                    except Exception as api_error:
                        logger.debug(f"API key authentication failed: {api_error}")
                        api_key = None
                
                # If no authentication method succeeded, return 401
                if not user and not api_key:
                    logger.debug(f"No valid authentication found for path: {path}")
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "error": "Authentication required",
                            "code": "AUTHENTICATION_REQUIRED"
                        },
                        headers={
                            **create_security_headers(),
                            "WWW-Authenticate": "Bearer"
                        }
                    )
                
                # Add authentication info to request state
                request.state.user = user
                request.state.api_key = api_key
                
                logger.debug(f"Authentication successful for path: {path}")
                
            except Exception as e:
                logger.error(f"Authentication error: {e}")
                logger.debug(f"Authentication error details", exc_info=True)
                
                # Return 401 for authentication errors
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "error": "Authentication failed",
                        "code": "AUTHENTICATION_FAILED"
                    },
                    headers=create_security_headers()
                )
        
        # Continue to next middleware/handler
        response = await call_next(request)
        return response

    def _get_client_ip(self, request: Request) -> Optional[str]:
        """Extract client IP address"""
        # Check X-Forwarded-For header (from load balancer/proxy)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # Take the first IP (original client)
            client_ip = forwarded_for.split(",")[0].strip()
            if validate_ip_address(client_ip):
                return client_ip
        
        # Check X-Real-IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip and validate_ip_address(real_ip):
            return real_ip
        
        # Fall back to direct connection IP
        if hasattr(request.client, "host"):
            return request.client.host
        
        return None

class AuthorizationMiddleware(BaseHTTPMiddleware):
    """Authorization middleware for role-based access control"""
    
    def __init__(self, app, role_requirements: dict = None):
        super().__init__(app)
        self.role_requirements = role_requirements or {
            "/api/v1/admin": "admin",
            "/api/v1/rag/documents/bulk": "developer",
            "/api/v1/rag/cache/clear": "admin"
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        
        # Check if path has role requirements
        required_role = None
        for protected_path, role in self.role_requirements.items():
            if path.startswith(protected_path):
                required_role = role
                break
        
        if required_role:
            user = getattr(request.state, "user", None)
            api_key = getattr(request.state, "api_key", None)
            
            # Check user role
            has_permission = False
            if user:
                # Implement role hierarchy check
                pass  # TODO: Implement role checking
            
            if api_key:
                # Check API key role
                pass  # TODO: Implement API key role checking
            
            if not has_permission:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": f"Insufficient privileges. Required role: {required_role}",
                        "code": "INSUFFICIENT_PRIVILEGES"
                    },
                    headers=create_security_headers()
                )
        
        response = await call_next(request)
        return response

# Convenience functions for middleware setup
def security_middleware(enable_rate_limiting: bool = True, enable_ip_blocking: bool = True):
    """Create security middleware instance"""
    def middleware_factory(app):
        return SecurityMiddleware(app, enable_rate_limiting, enable_ip_blocking)
    return middleware_factory

def authentication_middleware(protected_paths: list = None):
    """Create authentication middleware instance"""
    def middleware_factory(app):
        return AuthenticationMiddleware(app, protected_paths)
    return middleware_factory

def authorization_middleware(role_requirements: dict = None):
    """Create authorization middleware instance"""
    def middleware_factory(app):
        return AuthorizationMiddleware(app, role_requirements)
    return middleware_factory 