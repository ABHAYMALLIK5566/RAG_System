import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from ...security.auth import auth_manager, get_current_user
from ...security.models import (
    LoginRequest, LoginResponse, RefreshTokenRequest, 
    PasswordChangeRequest, UserCreate, User, UserRole, ROLE_PERMISSIONS
)
from ...security.security import (
    hash_password, verify_password, validate_password, validate_username, 
    validate_email, log_security_event
)
from ...core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    request: Request
):
    """
    Login endpoint with security monitoring
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Authenticate user
        user = await auth_manager.authenticate_user(
            username=login_data.username,
            password=login_data.password,
            ip_address=client_ip
        )
        
        if not user:
            # Log failed login attempt
            log_security_event(
                "login_failed",
                f"Failed login attempt for username: {login_data.username}",
                "medium",
                ip_address=client_ip,
                username=login_data.username
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.jwt_access_token_expire_minutes)
        
        # Safely get user role and permissions
        try:
            user_role = UserRole(user.role) if isinstance(user.role, str) else user.role
            role_permissions = ROLE_PERMISSIONS.get(user_role, [])
            permissions = [p.value if hasattr(p, 'value') else str(p) for p in role_permissions]
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid user role '{user.role}', using default permissions: {e}")
            user_role = UserRole.USER
            permissions = [p.value if hasattr(p, 'value') else str(p) for p in ROLE_PERMISSIONS.get(UserRole.USER, [])]
        
        access_token = auth_manager.create_access_token(
            data={
                "sub": user.id,
                "username": user.username,
                "role": str(user_role),
                "permissions": permissions
            },
            expires_delta=access_token_expires
        )
        
        # Create refresh token
        refresh_token = auth_manager.create_refresh_token(
            data={"sub": user.id, "username": user.username}
        )
        
        # Log successful login
        log_security_event(
            "login_success",
            f"Successful login for user: {user.username}",
            "low",
            ip_address=client_ip,
            username=user.username,
            user_id=user.id
        )
        
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.jwt_access_token_expire_minutes * 60,
            user=user
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        log_security_event(
            "login_error",
            f"Login system error for username: {login_data.username}",
            "high",
            ip_address=client_ip,
            username=login_data.username,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login system error"
        )

@router.post("/token")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """
    OAuth2 compatible token endpoint for getting JWT tokens
    Uses real database authentication and tracks login details
    """
    try:
        client_ip = getattr(request.client, 'host', 'unknown') if request.client else "unknown"
        
        # Use real authentication against database
        user = await auth_manager.authenticate_user(
            username=form_data.username,
            password=form_data.password,
            ip_address=client_ip
        )
        
        if not user:
            # Log failed login attempt
            try:
                log_security_event(
                    "token_auth_failed",
                    f"Failed token authentication for username: {form_data.username}",
                    "medium",
                    ip_address=client_ip,
                    username=form_data.username
                )
            except Exception:
                logger.warning(f"Failed auth attempt for {form_data.username} from {client_ip}")
            
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token with proper error handling
        try:
            access_token_expires = timedelta(minutes=settings.jwt_access_token_expire_minutes)
            
            # Safely get user role and permissions
            try:
                user_role = UserRole(user.role) if isinstance(user.role, str) else user.role
                role_permissions = ROLE_PERMISSIONS.get(user_role, [])
                permissions = [p.value if hasattr(p, 'value') else str(p) for p in role_permissions]
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid user role '{user.role}', using default permissions: {e}")
                user_role = UserRole.USER
                permissions = [p.value if hasattr(p, 'value') else str(p) for p in ROLE_PERMISSIONS.get(UserRole.USER, [])]
            
            access_token = auth_manager.create_access_token(
                data={
                    "sub": user.id,
                    "username": user.username,
                    "role": str(user_role),
                    "permissions": permissions
                },
                expires_delta=access_token_expires
            )
        except Exception as e:
            logger.error(f"Failed to create access token: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token creation failed"
            )
        
        # Log success (with error handling)
        try:
            log_security_event(
                "token_auth_success",
                f"Successful token authentication for user: {user.username}",
                "low",
                ip_address=client_ip,
                username=user.username,
                user_id=user.id
            )
        except Exception:
            logger.info(f"Successful auth for {user.username} from {client_ip}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.jwt_access_token_expire_minutes * 60
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in token endpoint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error"
        )

@router.post("/refresh")
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    request: Request
):
    """
    Refresh access token using refresh token
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Verify refresh token
        token_data = auth_manager.verify_token(refresh_data.refresh_token)
        if not token_data:
            log_security_event(
                "invalid_refresh_token",
                "Invalid refresh token used",
                "medium",
                ip_address=client_ip
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Create new access token
        access_token_expires = timedelta(minutes=settings.jwt_access_token_expire_minutes)
        access_token = auth_manager.create_access_token(
            data={
                "sub": token_data.user_id,
                "username": token_data.username,
                "role": token_data.role.value if token_data.role else UserRole.USER.value
            },
            expires_delta=access_token_expires
        )
        
        log_security_event(
            "token_refreshed",
            f"Token refreshed for user: {token_data.username}",
            "low",
            ip_address=client_ip,
            username=token_data.username,
            user_id=token_data.user_id
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.jwt_access_token_expire_minutes * 60
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )

@router.post("/register")
async def register_user(
    user_data: UserCreate,
    request: Request
):
    """
    User registration endpoint (if enabled)
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Check if registration is enabled (you may want to disable this in production)
    if not getattr(settings, 'enable_registration', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User registration is disabled"
        )
    
    try:
        # Validate username
        username_validation = validate_username(user_data.username)
        if not username_validation["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid username: {', '.join(username_validation['errors'])}"
            )
        
        # Validate email
        if not validate_email(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format"
            )
        
        # Validate password
        password_validation = validate_password(user_data.password)
        if not password_validation["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid password: {', '.join(password_validation['errors'])}"
            )
        
        # Hash password
        hashed_password = hash_password(user_data.password)
        
        # Create user (this would typically go to database)
        user = User(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            role=user_data.role,
            metadata=user_data.metadata
        )
        
        # Log registration
        log_security_event(
            "user_registered",
            f"New user registered: {user.username}",
            "low",
            ip_address=client_ip,
            username=user.username,
            user_id=user.id
        )
        
        return {
            "message": "User registered successfully",
            "user_id": user.id,
            "username": user.username,
            "email": user.email
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        log_security_event(
            "registration_error",
            f"Registration failed for username: {user_data.username}",
            "medium",
            ip_address=client_ip,
            username=user_data.username,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/logout")
async def logout(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme)
):
    """
    Logout endpoint - revokes the current token
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if token:
        # Revoke the token
        auth_manager.revoke_token(token)
        
        # Get user info from token for logging
        token_data = auth_manager.verify_token(token)
        if token_data:
            log_security_event(
                "user_logout",
                f"User logged out: {token_data.username}",
                "low",
                ip_address=client_ip,
                username=token_data.username,
                user_id=token_data.user_id
            )
    
    return {"message": "Successfully logged out"}

@router.options("/me")
async def options_me():
    """Handle CORS preflight requests for /me endpoint"""
    return {"message": "OK"}

@router.get("/me")
async def get_current_user_info(
    request: Request,
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Get current user information - GET method only
    """
    print(f"[DEBUG] /me endpoint: Request method = {request.method}")
    print(f"[DEBUG] /me endpoint: Request headers = {dict(request.headers)}")
    
    # Check if this is a GET request
    if request.method != "GET":
        raise HTTPException(
            status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
            detail="Only GET method is allowed for this endpoint"
        )
    
    # Try to get user from request state first (set by middleware)
    user_from_state = getattr(request.state, 'user', None)
    
    # If no user in state, try to authenticate directly
    if not user_from_state:
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            print(f"[DEBUG] /me endpoint: Token received: {token[:20]}...")
            
            # Verify token directly
            token_data = auth_manager.verify_token(token)
            if token_data:
                print(f"[DEBUG] /me endpoint: Token verified successfully")
                # Create user from token data
                user_id = token_data.get("sub")
                username = token_data.get("username") or "unknown"
                role_str = token_data.get("role")
                
                try:
                    # Handle role string format (e.g., "UserRole.ADMIN" -> "admin")
                    if role_str and role_str.startswith("UserRole."):
                        role_value = role_str.split(".")[1].lower()
                    else:
                        role_value = role_str or "user"
                    
                    role = UserRole(role_value)
                except (ValueError, TypeError):
                    role = UserRole.USER
                
                user_from_state = User(
                    id=user_id,
                    username=username,
                    email="user@example.com",
                    hashed_password="",
                    role=role
                )
                print(f"[DEBUG] /me endpoint: Created user: {user_from_state.username}, Role: {user_from_state.role}")
            else:
                print(f"[DEBUG] /me endpoint: Token verification failed")
    
    # Use user from state or fallback to dependency
    user = user_from_state or current_user
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "created_at": user.created_at,
        "last_login": user.last_login
    }

@router.post("/change-password")
async def change_password(
    password_data: PasswordChangeRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Change user password
    """
    client_ip = request.client.host if request.client else "unknown"
    
    try:
        # Verify current password
        if not auth_manager.verify_password(password_data.current_password, current_user.hashed_password):
            log_security_event(
                "password_change_failed",
                f"Invalid current password for user: {current_user.username}",
                "medium",
                ip_address=client_ip,
                username=current_user.username,
                user_id=current_user.id
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        # Validate new password
        password_validation = validate_password(password_data.new_password)
        if not password_validation["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid new password: {', '.join(password_validation['errors'])}"
            )
        
        # Hash new password
        new_hashed_password = hash_password(password_data.new_password)
        
        # Update user password (in production, update in database)
        current_user.hashed_password = new_hashed_password
        current_user.updated_at = datetime.utcnow()
        
        log_security_event(
            "password_changed",
            f"Password changed for user: {current_user.username}",
            "low",
            ip_address=client_ip,
            username=current_user.username,
            user_id=current_user.id
        )
        
        return {"message": "Password changed successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )

@router.put("/profile")
async def update_profile(
    profile_data: dict,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Update user profile information
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Debug logging
    logger.info(f"Profile update request received for user: {current_user.username}")
    logger.info(f"Profile data: {profile_data}")
    
    try:
        # Extract profile data
        username = profile_data.get("username")
        email = profile_data.get("email")
        current_password = profile_data.get("currentPassword")
        new_password = profile_data.get("newPassword")
        
        logger.info(f"Extracted data - username: {username}, email: {email}, current_password: {'*' * len(current_password) if current_password else None}, new_password: {'*' * len(new_password) if new_password else None}")
        
        # Handle password change if provided
        if current_password and new_password:
            # Verify current password
            if not verify_password(current_password, current_user.hashed_password):
                log_security_event(
                    "profile_update_failed",
                    f"Invalid current password for profile update: {current_user.username}",
                    "medium",
                    ip_address=client_ip,
                    username=current_user.username,
                    user_id=current_user.id
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect"
                )
            
            # Validate new password
            password_validation = validate_password(new_password)
            if not password_validation["is_valid"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid new password: {', '.join(password_validation['errors'])}"
                )
            
            # Hash new password and update in database
            new_hashed_password = hash_password(new_password)
            
            # Update password in database
            from ...core.database import db_manager
            logger.info(f"Updating password for user {current_user.id} in database")
            try:
                result = await db_manager.execute_command(
                    "UPDATE users SET hashed_password = $1, updated_at = $2 WHERE id = $3",
                    new_hashed_password,
                    datetime.utcnow(),
                    current_user.id
                )
                logger.info(f"Database update result: {result}")
            except Exception as e:
                logger.error(f"Database update failed: {e}")
                raise
            
            # Update the current user object
            current_user.hashed_password = new_hashed_password
        
        # Handle profile information update
        if username and username != current_user.username:
            # Validate username
            username_validation = validate_username(username)
            if not username_validation["is_valid"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid username: {', '.join(username_validation['errors'])}"
                )
            current_user.username = username
        
        if email and email != current_user.email:
            # Validate email
            if not validate_email(email):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid email format"
                )
            current_user.email = email
        
        # Update timestamp
        current_user.updated_at = datetime.utcnow()
        
        log_security_event(
            "profile_updated",
            f"Profile updated for user: {current_user.username}",
            "low",
            ip_address=client_ip,
            username=current_user.username,
            user_id=current_user.id
        )
        
        return {
            "message": "Profile updated successfully",
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "full_name": current_user.full_name,
                "role": current_user.role,
                "is_active": current_user.is_active,
                "is_verified": current_user.is_verified,
                "created_at": current_user.created_at,
                "last_login": current_user.last_login
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Profile update error: {e}")
        logger.error(f"Profile data received: {profile_data}")
        logger.error(f"Current user: {current_user.id} - {current_user.username}")
        log_security_event(
            "profile_update_error",
            f"Profile update failed for user: {current_user.username}",
            "medium",
            ip_address=client_ip,
            username=current_user.username,
            user_id=current_user.id,
            error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )

@router.get("/demo-credentials")
async def get_demo_credentials():
    """
    Get demo credentials for testing (remove in production)
    """
    if not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found"
        )
    
    return {
        "message": "Demo credentials for testing",
        "credentials": [
            {
                "username": "admin",
                "password": "admin123",
                "role": "admin",
                "permissions": "All permissions"
            },
            {
                "username": "user", 
                "password": "user123",
                "role": "user",
                "permissions": "Basic permissions"
            }
        ],
        "usage": "Use these credentials with POST /api/v1/auth/token"
    }

@router.get("/test-token")
async def test_token_creation():
    """
    Test token creation endpoint for debugging
    """
    if not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found"
        )
    
    try:
        # Test token creation
        test_data = {
            "sub": "test-user-id",
            "username": "test",
            "role": "user"
        }
        
        token = auth_manager.create_access_token(test_data)
        
        # Test token verification
        token_data = auth_manager.verify_token(token)
        
        return {
            "message": "Token creation test successful",
            "token_created": True,
            "token_length": len(token),
            "token_verified": token_data is not None,
            "token_data": {
                "user_id": token_data.user_id if token_data else None,
                "username": token_data.username if token_data else None,
                "role": token_data.role.value if token_data and token_data.role else None
            } if token_data else None
        }
        
    except Exception as e:
        logger.error(f"Token test failed: {e}")
        return {
            "message": "Token creation test failed",
            "error": str(e),
            "token_created": False
        } 