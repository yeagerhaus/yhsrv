# Stage 1: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
# Copy lockfile if it exists (optional)
COPY bun.lockb* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Build TypeScript
RUN bun run build

# Stage 2: Runtime
FROM oven/bun:1-alpine

# Install FFmpeg and runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    postgresql-client \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package.json ./
# Copy lockfile if it exists (optional)
COPY bun.lockb* ./

# Install production dependencies only
RUN bun install --production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy any necessary config files
COPY --from=builder /app/tsconfig.json ./

# Create directories for music and cache
RUN mkdir -p /music /cache/transcodes

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start server
CMD ["bun", "dist/src/server.js"]
