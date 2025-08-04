#!/bin/sh

# Generate config.js with runtime environment variables
cat > /app/dist/config.js << EOF
window.APP_CONFIG = {
  API_BASE_URL: '${VITE_API_BASE_URL:-http://rag-api:8000}',
  APP_NAME: '${VITE_APP_NAME:-RAG Query System}',
  DEBUG_MODE: ${VITE_DEBUG_MODE:-true}
};
EOF

echo "--- Contents of /app/dist ---"
ls -l /app/dist

echo "--- Contents of /app/dist/config.js ---"
cat /app/dist/config.js

# Start the server with proper static file serving
exec serve dist -l 3000 --single 