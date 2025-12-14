# Docker Setup Guide

## Quick Start

After restarting Windows to enable Docker:

### 1. Start All Services

```powershell
docker-compose -f docker/docker-compose.yml up -d
```

This will:
- Start PostgreSQL container
- Build and start the music server container
- Set up all networking and volumes

### 2. Initialize Database Schema

```powershell
docker-compose -f docker/docker-compose.yml exec yhsrv npm run migrate
```

### 3. Check Status

```powershell
docker-compose -f docker/docker-compose.yml ps
```

### 4. View Logs

```powershell
# All services
docker-compose -f docker/docker/docker-compose.yml logs -f

# Just the music server
docker-compose -f docker/docker-compose.yml logs -f yhsrv

# Just PostgreSQL
docker-compose -f docker/docker-compose.yml logs -f postgres
```

## Environment Variables

The docker-compose.yml sets these automatically:
- `DATABASE_URL=postgresql://yhsrv:password@postgres:5432/yhsrv`
- `MUSIC_ROOT_PATH=/music`
- `TRANSCODE_CACHE_PATH=/cache/transcodes`

## Mounting Your Music Library

Update the `MUSIC_LIBRARY_PATH` environment variable or edit docker-compose.yml:

```yaml
volumes:
  - C:/path/to/your/music:/music:ro
```

Or set it when starting:
```powershell
$env:MUSIC_LIBRARY_PATH="C:/Music"
docker-compose -f docker/docker-compose.yml up -d
```

## Useful Commands

```powershell
# Stop all services
docker-compose -f docker/docker-compose.yml down

# Stop and remove volumes (deletes database!)
docker-compose -f docker/docker-compose.yml down -v

# Rebuild after code changes
docker-compose -f docker/docker-compose.yml up -d --build

# Access PostgreSQL directly
docker-compose -f docker/docker-compose.yml exec postgres psql -U yhsrv -d yhsrv

# Access music server container shell
docker-compose -f docker/docker-compose.yml exec yhsrv sh
```

## Troubleshooting

### Database connection issues
- Make sure PostgreSQL container is running: `docker ps`
- Check logs: `docker-compose -f docker/docker-compose.yml logs postgres`

### Port conflicts
- If port 5432 is already in use, change it in docker-compose.yml:
  ```yaml
  ports:
    - "5433:5432"  # Use 5433 on host
  ```

### Music library not accessible
- Check volume mount in docker-compose.yml
- Ensure path uses forward slashes: `C:/Music` not `C:\Music`
- On Windows, you may need to share the drive in Docker Desktop settings

