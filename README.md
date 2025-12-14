# YH Music Server

A self-hosted music server with advanced features like Sonic Analysis, Sweet Fades, and Spotify/Deezer integration. Built with TypeScript, Fastify, PostgreSQL, and FFmpeg.

## Features

- **Music Streaming**: Stream tracks with HTTP range request support
- **Audio Transcoding**: On-demand transcoding from FLAC to MP3 (320kbps, 128kbps)
- **Sonic Analysis**: Extract BPM, key, energy, danceability, and more from audio files
- **Sweet Fades**: Seamless crossfades between tracks in playlists
- **Spotify Integration**: OAuth authentication and metadata syncing
- **Deezer Integration**: Library synchronization via yhdl
- **Library Management**: Automatic scanning and indexing of music files
- **Lossless Audio Support**: Full support for FLAC and other lossless formats

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- FFmpeg
- Docker and Docker Compose (for containerized deployment)

## Installation

### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd yhsrv
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Edit `.env` and configure:
   - Database credentials
   - Music library path
   - Spotify OAuth credentials
   - Deezer ARL token (optional)

4. Start services:
```bash
docker-compose -f docker/docker-compose.yml up -d
```

5. Initialize database schema:
```bash
docker-compose -f docker/docker-compose.yml exec yhsrv npm run migrate
```

### Manual Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see `.env.example`)

3. Initialize database:
```bash
npm run migrate
```

4. Build and start:
```bash
npm run build
npm start
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options:

- `DATABASE_URL`: PostgreSQL connection string
- `MUSIC_ROOT_PATH`: Path to your music library
- `SPOTIFY_CLIENT_ID`: Spotify OAuth client ID
- `SPOTIFY_CLIENT_SECRET`: Spotify OAuth client secret
- `DEEZER_ARL`: Deezer ARL token for yhdl integration
- `FFMPEG_PATH`: Path to FFmpeg binary (default: `/usr/bin/ffmpeg`)

## API Endpoints

### Library Management
- `GET /api/library/stats` - Get library statistics
- `POST /api/library/scan` - Trigger library scan

### Tracks
- `GET /api/tracks` - List all tracks (with pagination and filters)
- `GET /api/tracks/:id` - Get track details
- `GET /api/tracks/:id/analysis` - Get sonic analysis for track

### Artists
- `GET /api/artists` - List all artists
- `GET /api/artists/:id` - Get artist with albums and tracks

### Albums
- `GET /api/albums` - List all albums
- `GET /api/albums/:id` - Get album with tracks

### Streaming
- `GET /api/stream/:id?format=mp3&bitrate=320` - Stream track (with optional transcoding)

### Playlists
- `POST /api/playlist/stream` - Create and stream playlist with crossfades

### Spotify Integration
- `GET /api/auth/spotify` - Initiate Spotify OAuth
- `GET /api/auth/spotify/callback` - OAuth callback handler
- `POST /api/spotify/sync/track/:id` - Sync track metadata from Spotify
- `POST /api/spotify/sync/artist/:id` - Sync artist metadata from Spotify

### Deezer Sync
- `POST /api/sync/deezer` - Trigger Deezer library sync
- `POST /api/sync/deezer/artist/:id` - Sync specific artist from Deezer
- `GET /api/sync/status` - Get sync status

### Health Check
- `GET /api/health` - Health check endpoint

## yhdl Integration

The yhdl code should be integrated into `src/yhdl/` directory. See `src/yhdl/README.md` for integration instructions.

Once integrated, the Deezer sync endpoints will be fully functional.

## Development

```bash
# Development mode with hot reload
npm run dev

# Build
npm run build

# Run migrations
npm run migrate

# Run tests
npm test
```

## Docker Commands

```bash
# Build image
docker build -f docker/Dockerfile -t yhsrv .

# Start services
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f yhsrv

# Stop services
docker-compose -f docker/docker-compose.yml down
```

## Architecture

- **API Server**: Fastify REST API
- **Database**: PostgreSQL with Kysely query builder
- **Audio Processing**: FFmpeg for transcoding and analysis
- **Metadata**: music-metadata for ID3 tag reading
- **Integrations**: Spotify OAuth + API, Deezer via yhdl

## License

MIT
