# Stage 1: Build
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine

# Install FFmpeg and runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json ./
RUN npm ci --only=production --ignore-scripts

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create directories for music and cache
RUN mkdir -p /music /cache/transcodes

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server.js"]

