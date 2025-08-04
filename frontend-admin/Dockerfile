# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Set build argument for API URL and use it as environment variable during build
ARG VITE_API_BASE_URL=http://rag-api:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the application for production
RUN npm run build

# Copy config.js to dist folder for runtime configuration
COPY public/config.js dist/

# Remove dev dependencies after build
RUN npm prune --production --legacy-peer-deps

# Install a simple HTTP server to serve the static files
RUN npm install -g serve

# Set environment variable for runtime
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Make the startup script executable
RUN chmod +x start.sh

# Expose the port the app runs on
EXPOSE 3000

# Start the application with the startup script
CMD ["./start.sh"] 