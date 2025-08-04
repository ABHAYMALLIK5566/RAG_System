#!/bin/sh

# Generate config.js with runtime environment variables
cat > /app/dist/config.js << EOF
window.APP_CONFIG = {
  API_BASE_URL: '${VITE_API_BASE_URL:-http://localhost:8000}',
  APP_NAME: '${VITE_APP_NAME:-RAG System Admin}',
  DEBUG_MODE: ${VITE_DEBUG_MODE:-true}
};
EOF

# Start the server with proper static file serving
exec serve dist -l 3000 --single 