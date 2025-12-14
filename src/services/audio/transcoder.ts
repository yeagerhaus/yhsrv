import ffmpeg from 'fluent-ffmpeg';
import { existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

export interface TranscodeOptions {
  format: 'mp3' | 'm4a' | 'aac';
  bitrate: number;
}

export interface TranscodeResult {
  path: string;
  fileSize: number;
  cached: boolean;
}

// Ensure cache directory exists
function ensureCacheDir(): void {
  const cacheDir = config.music.transcodeCachePath;
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
}

// Generate cache file path
function getCachePath(trackId: string, format: string, bitrate: number): string {
  ensureCacheDir();
  const filename = `${trackId}-${format}-${bitrate}kbps.${format}`;
  return join(config.music.transcodeCachePath, filename);
}

// Check if cached transcode exists
async function getCachedTranscode(
  trackId: string,
  format: string,
  bitrate: number
): Promise<TranscodeResult | null> {
  const cachePath = getCachePath(trackId, format, bitrate);
  
  if (existsSync(cachePath)) {
    const stats = statSync(cachePath);
    return {
      path: cachePath,
      fileSize: stats.size,
      cached: true,
    };
  }
  
  return null;
}

// Save transcode to cache database
async function saveTranscodeCache(
  trackId: string,
  format: string,
  bitrate: number,
  path: string,
  fileSize: number
): Promise<void> {
  const id = randomUUID();
  
  await db
    .insertInto('transcode_cache')
    .values({
      id,
      track_id: trackId,
      format,
      bitrate,
      path,
      file_size: fileSize,
      created_at: new Date(),
    })
    .onConflict((oc) => oc
      .columns(['track_id', 'format', 'bitrate'])
      .doUpdateSet({
        path,
        file_size: fileSize,
        created_at: new Date(),
      })
    )
    .execute();
}

// Transcode audio file using FFmpeg
export async function transcodeTrack(
  inputPath: string,
  trackId: string,
  options: TranscodeOptions
): Promise<TranscodeResult> {
  // Check cache first
  const cached = await getCachedTranscode(trackId, options.format, options.bitrate);
  if (cached) {
    return cached;
  }

  // Generate output path
  const outputPath = getCachePath(trackId, options.format, options.bitrate);
  ensureCacheDir();

  // Transcode using FFmpeg
  return new Promise((resolve, reject) => {
    const command = ffmpeg(inputPath)
      .setFfmpegPath(config.ffmpeg.ffmpegPath)
      .setFfprobePath(config.ffmpeg.ffprobePath)
      .audioCodec(options.format === 'mp3' ? 'libmp3lame' : options.format === 'm4a' ? 'aac' : 'aac')
      .audioBitrate(options.bitrate)
      .format(options.format)
      .on('end', async () => {
        try {
          const stats = statSync(outputPath);
          await saveTranscodeCache(trackId, options.format, options.bitrate, outputPath, stats.size);
          resolve({
            path: outputPath,
            fileSize: stats.size,
            cached: false,
          });
        } catch (error) {
          reject(new Error(`Failed to save transcode cache: ${error instanceof Error ? error.message : String(error)}`));
        }
      })
      .on('error', (error) => {
        reject(new Error(`FFmpeg transcoding failed: ${error.message}`));
      })
      .save(outputPath);
  });
}

// Get track file path from database
export async function getTrackPath(trackId: string): Promise<string> {
  const track = await db
    .selectFrom('tracks')
    .select('path')
    .where('id', '=', trackId)
    .executeTakeFirst();

  if (!track) {
    throw new Error(`Track not found: ${trackId}`);
  }

  if (!existsSync(track.path)) {
    throw new Error(`Track file not found: ${track.path}`);
  }

  return track.path;
}

// Get or transcode track for streaming
export async function getStreamableTrack(
  trackId: string,
  format?: string,
  bitrate?: number
): Promise<{ path: string; format: string; contentType: string }> {
  const trackPath = await getTrackPath(trackId);
  const track = await db
    .selectFrom('tracks')
    .select(['format', 'path'])
    .where('id', '=', trackId)
    .executeTakeFirst();

  if (!track) {
    throw new Error(`Track not found: ${trackId}`);
  }

  const sourceFormat = track.format.toLowerCase();
  const targetFormat = (format || sourceFormat).toLowerCase() as 'mp3' | 'm4a' | 'aac';
  const targetBitrate = bitrate || config.audio.defaultTranscodeBitrate;

  // If source format matches target and no bitrate change needed, return original
  if (sourceFormat === targetFormat && sourceFormat !== 'flac') {
    return {
      path: trackPath,
      format: sourceFormat,
      contentType: getContentType(sourceFormat),
    };
  }

  // If source is FLAC or format/bitrate change needed, transcode
  if (sourceFormat === 'flac' || sourceFormat !== targetFormat) {
    const transcodeResult = await transcodeTrack(trackPath, trackId, {
      format: targetFormat as 'mp3' | 'm4a' | 'aac',
      bitrate: targetBitrate,
    });

    return {
      path: transcodeResult.path,
      format: targetFormat,
      contentType: getContentType(targetFormat),
    };
  }

  // Return original
  return {
    path: trackPath,
    format: sourceFormat,
    contentType: getContentType(sourceFormat),
  };
}

function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
  };
  return contentTypes[format.toLowerCase()] || 'application/octet-stream';
}

