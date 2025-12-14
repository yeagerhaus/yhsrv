import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  server: z.object({
    port: z.number().default(8080),
    host: z.string().default('0.0.0.0'),
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  }),
  database: z.object({
    url: z.string().url(),
    host: z.string().default('localhost'),
    port: z.number().default(5432),
    name: z.string().default('yhsrv'),
    user: z.string().default('yhsrv'),
    password: z.string().default('password'),
  }),
  music: z.object({
    rootPath: z.string(),
    transcodeCachePath: z.string(),
  }),
  spotify: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string().url(),
  }),
  deezer: z.object({
    arl: z.string().optional(),
    syncConcurrency: z.number().default(5),
    syncCheckInterval: z.number().default(24),
  }),
  ffmpeg: z.object({
    ffmpegPath: z.string().default('/usr/bin/ffmpeg'),
    ffprobePath: z.string().default('/usr/bin/ffprobe'),
  }),
  audio: z.object({
    defaultTranscodeBitrate: z.number().default(320),
    supportedFormats: z.array(z.string()).default(['flac', 'mp3', 'm4a', 'aac', 'ogg', 'wav']),
  }),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'yhsrv'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'yhsrv'}`;

  const rawConfig = {
    server: {
      port: parseInt(process.env.PORT || '8080', 10),
      host: process.env.HOST || '0.0.0.0',
      nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    },
    database: {
      url: databaseUrl,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      name: process.env.DB_NAME || 'yhsrv',
      user: process.env.DB_USER || 'yhsrv',
      password: process.env.DB_PASSWORD || 'password',
    },
    music: {
      rootPath: process.env.MUSIC_ROOT_PATH || './music',
      transcodeCachePath: process.env.TRANSCODE_CACHE_PATH || './cache/transcodes',
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8080/api/auth/spotify/callback',
    },
    deezer: {
      arl: process.env.DEEZER_ARL,
      syncConcurrency: parseInt(process.env.SYNC_CONCURRENCY || '5', 10),
      syncCheckInterval: parseInt(process.env.SYNC_CHECK_INTERVAL || '24', 10),
    },
    ffmpeg: {
      ffmpegPath: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
      ffprobePath: process.env.FFPROBE_PATH || '/usr/bin/ffprobe',
    },
    audio: {
      defaultTranscodeBitrate: parseInt(process.env.DEFAULT_TRANSCODE_BITRATE || '320', 10),
      supportedFormats: (process.env.SUPPORTED_FORMATS || 'flac,mp3,m4a,aac,ogg,wav').split(','),
    },
  };

  return configSchema.parse(rawConfig);
}

export const config = loadConfig();
export type { Config };

