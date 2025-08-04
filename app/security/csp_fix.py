from fastapi import Request
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

def create_swagger_friendly_csp() -> str:
    """Create CSP that allows Swagger UI to work"""
    return (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://fastapi.tiangolo.com; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )

class CSPMiddleware(BaseHTTPMiddleware):
    """Content Security Policy middleware"""
    
    def __init__(self, app, csp_header: str = None):
        super().__init__(app)
        self.csp_header = csp_header or create_swagger_friendly_csp()
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Set CSP header for documentation pages
        if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
            response.headers["Content-Security-Policy"] = self.csp_header
        
        return response 