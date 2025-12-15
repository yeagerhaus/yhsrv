# YH Music Server

A self-hosted music server with advanced features like Sonic Analysis, Sweet Fades, and Spotify/Deezer integration. Built with TypeScript, Bun, Fastify, PostgreSQL, and FFmpeg.

## Features

- **Music Streaming**: Stream tracks with HTTP range request support
- **Audio Transcoding**: On-demand transcoding from FLAC to MP3/M4A/AAC (320kbps, 128kbps)
- **Sonic Analysis**: Extract BPM, key, energy, danceability, valence, and more from audio files
- **Sweet Fades**: Seamless crossfades between tracks in playlists
- **Spotify Integration**: OAuth authentication and metadata syncing
- **Deezer Integration**: Library synchronization via yhdl (subprocess mode)
- **Library Management**: Automatic scanning and indexing of music files (scans on startup)
- **Lossless Audio Support**: Full support for FLAC and other lossless formats with ffprobe fallback
- **Cloudflared Tunnel**: Optional public access via Cloudflare tunnel

## Prerequisites

- **Bun** 1.0+ (recommended) or Node.js 20+
- PostgreSQL 16+
- FFmpeg and FFprobe
- Docker and Docker Compose (for containerized deployment)

## Quick Start

### Automated Setup (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd yhsrv
```

2. Create and configure `.env` file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run the setup script:
```bash
bun run setup
```

This will:
- Check prerequisites (FFmpeg, PostgreSQL, Docker)
- Install dependencies
- Create necessary directories
- Run database migrations
- Optionally set up Docker containers

### Using Docker Compose

1. Configure your `.env` file (see Configuration section)

2. Update the music library path in `docker/docker-compose.yml`:
```yaml
volumes:
  - /path/to/your/music:/music:ro  # Update this path
```

3. Run setup with Docker:
```bash
bun run setup:docker
```

The setup script will automatically:
- Build and start all containers
- Run database migrations
- Display the Cloudflared tunnel URL (if enabled)

**Example output:**
```
🌐 Cloudflared Tunnel URL:
   https://noted-chuck-lucky-nothing.trycloudflare.com

   You can access the API at:
   https://noted-chuck-lucky-nothing.trycloudflare.com/api/health
   https://noted-chuck-lucky-nothing.trycloudflare.com/api/library/stats
```

Or manually:
```bash
# Build and start services
docker-compose -f docker/docker-compose.yml up -d --build

# Run migrations
docker-compose -f docker/docker-compose.yml exec yhsrv bun run migrate

# Get Cloudflared tunnel URL
bun run tunnel-url

# Scan your library
curl -X POST http://localhost:8080/api/library/scan
```

### Manual Installation

1. Install Bun: https://bun.sh

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables (see `.env.example`)

4. Ensure PostgreSQL is running and accessible

5. Initialize database:
```bash
bun run migrate
```

6. Build and start:
```bash
bun run build
bun start
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options:

- `DATABASE_URL`: PostgreSQL connection string
- `MUSIC_ROOT_PATH`: Path to your music library
- `SPOTIFY_CLIENT_ID`: Spotify OAuth client ID
- `SPOTIFY_CLIENT_SECRET`: Spotify OAuth client secret
- `SPOTIFY_REDIRECT_URI`: Spotify OAuth redirect URI (must match your app settings)
- `DEEZER_ARL`: Deezer ARL token for yhdl integration (optional)
- `FFMPEG_PATH`: Path to FFmpeg binary (default: `ffmpeg`)
- `FFPROBE_PATH`: Path to FFprobe binary (default: `ffprobe`)
- `DEFAULT_TRANSCODE_BITRATE`: Default bitrate for transcoding (default: `320`)
- `SUPPORTED_FORMATS`: Comma-separated list of supported formats (default: `flac,mp3,m4a,aac,ogg,wav`)
- `SKIP_STARTUP_SCAN`: Set to `true` to skip automatic library scan on startup (default: `false`)

### Docker Configuration

The Docker setup includes:
- **PostgreSQL**: Database server
- **yhsrv**: Main application server
- **cloudflared**: Optional Cloudflare tunnel for public access

Update the music library mount path in `docker/docker-compose.yml` to match your system.

## API Endpoints

### Health & Status
- `GET /api/health` - Health check endpoint

### Library Management
- `GET /api/library/stats` - Get library statistics (tracks, artists, albums, file sizes)
- `POST /api/library/scan` - Trigger library scan to index music files

### Tracks
- `GET /api/tracks` - List all tracks (with pagination and filters)
  - Query params: `page`, `limit`, `artist`, `album`, `format`
- `GET /api/tracks/:id` - Get track details
- `GET /api/tracks/:id/analysis` - Get sonic analysis for track (BPM, key, energy, etc.)

### Artists
- `GET /api/artists` - List all artists (with pagination)
  - Query params: `page`, `limit`, `search`
- `GET /api/artists/:id` - Get artist with albums and tracks

### Albums
- `GET /api/albums` - List all albums (with pagination)
  - Query params: `page`, `limit`, `search`
- `GET /api/albums/:id` - Get album with tracks (ordered by disc/track number)

### Streaming
- `GET /api/stream/:id` - Stream track with HTTP range support
  - Query params: `format` (mp3, m4a, aac), `bitrate` (128, 320, etc.)
  - Supports on-the-fly transcoding (FLAC → MP3, etc.)

### Playlists (Sweet Fades)
- `POST /api/playlist/stream` - Create and stream playlist with crossfades
  - Body: `{ track_ids: string[], fade?: boolean, duration?: number }`

### Spotify Integration
- `GET /api/auth/spotify` - Initiate Spotify OAuth flow
- `GET /api/auth/spotify/callback` - Handle OAuth callback
- `POST /api/spotify/sync/track/:id` - Sync track metadata from Spotify
- `POST /api/spotify/sync/artist/:id` - Sync artist metadata from Spotify
- `POST /api/spotify/sync/artist/:id/tracks` - Sync all tracks for an artist from Spotify

### Deezer Sync
- `POST /api/sync/deezer` - Trigger Deezer library sync
  - Body: `{ fullSync?: boolean, dryRun?: boolean, concurrency?: number }`
- `POST /api/sync/deezer/artist/:id` - Sync specific artist from Deezer
- `GET /api/sync/status` - Get sync status

## yhdl Integration

yhsrv integrates with [yhdl](https://github.com/yeagerhaus/yhdl) for Deezer library synchronization. Currently, yhdl runs as a subprocess (CLI mode).

**Current Status:**
- yhdl is called as a subprocess for Deezer sync operations
- Configuration is passed via environment variables
- Sync state is managed in the yhsrv database

**Future Enhancement:**
Once yhdl is enhanced as a library (see `YHDL_LIBRARY_ENHANCEMENT_PLAN.md`), it will be imported directly for better integration and type safety.

**Setup:**
1. Ensure `DEEZER_ARL` is set in your `.env` file
2. Optionally set `YHDL_PATH` if yhdl is installed in a non-standard location
3. Use the sync endpoints to trigger library synchronization

## Development

### Local Development (without Docker)
```bash
# Development mode with hot reload (runs locally, requires local PostgreSQL)
bun run dev

# Build TypeScript
bun run build

# Run migrations (local database)
bun run migrate

# Run tests
bun test
```

### Docker Development (recommended)
```bash
# Initial setup (one-time, builds containers and runs migrations)
bun run setup:docker

# Start/restart containers (use this for daily development)
bun run docker:up

# Stop containers
bun run docker:down

# View logs
bun run docker:logs

# Restart a specific service
bun run docker:restart yhsrv

# Get Cloudflared tunnel URL
bun run tunnel-url
```

### Setup Scripts
```bash
# Full setup (checks prerequisites, installs deps, runs migrations)
bun run setup

# Docker-only setup (automatically displays Cloudflared URL)
bun run setup:docker
```

## Docker Commands

```bash
# Build and start all services
docker-compose -f docker/docker-compose.yml up -d --build

# Get Cloudflared tunnel URL (quick command)
bun run tunnel-url

# View logs
docker-compose -f docker/docker-compose.yml logs -f yhsrv

# View Cloudflared logs (to see tunnel URL)
docker-compose -f docker/docker-compose.yml logs cloudflared

# View all logs
docker-compose -f docker/docker-compose.yml logs -f

# Stop services
docker-compose -f docker/docker-compose.yml down

# Restart a service
docker-compose -f docker/docker-compose.yml restart yhsrv

# Execute commands in container
docker-compose -f docker/docker-compose.yml exec yhsrv bun run migrate
docker-compose -f docker/docker-compose.yml exec yhsrv sh

# Rebuild after code changes
docker-compose -f docker/docker-compose.yml up -d --build
```

## Troubleshooting

### FLAC Files Not Scanning

If some FLAC files fail with "Invalid FLAC preamble" errors:
- The scanner automatically falls back to `ffprobe` for metadata extraction
- Ensure `ffprobe` is installed and accessible
- Check that the files are valid FLAC files (not corrupted)

### Cloudflared Tunnel Not Working

- The tunnel URL changes each time cloudflared restarts
- Get the current URL: `bun run tunnel-url`
- Or check logs: `docker-compose -f docker/docker-compose.yml logs cloudflared`
- The setup script automatically displays the URL when starting Docker
- For a permanent URL, set up a named Cloudflare tunnel with an account

### Database Connection Issues

- Ensure PostgreSQL is running and accessible
- Check `DATABASE_URL` in your `.env` file
- For Docker: ensure the `postgres` service is healthy before starting `yhsrv`

### Music Library Not Found

- Verify the path in `MUSIC_ROOT_PATH` (or `docker-compose.yml` for Docker)
- Ensure the path is accessible and contains audio files
- Check file permissions

## Architecture

- **Runtime**: Bun (fast JavaScript runtime)
- **API Server**: Fastify REST API
- **Database**: PostgreSQL with Kysely query builder
- **Audio Processing**: FFmpeg/FFprobe for transcoding and analysis
- **Metadata**: music-metadata library with ffprobe fallback
- **Integrations**: 
  - Spotify OAuth + API
  - Deezer via yhdl (subprocess mode)
- **Tunneling**: Cloudflared for optional public access

## License

MIT
