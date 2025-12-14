import ffmpeg from 'fluent-ffmpeg';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { getTrackPath } from './transcoder.js';
import { getTrackAnalysis } from './sonic-analysis.js';

export interface FadeOptions {
  duration?: number; // Fade duration in seconds (default: 3)
  fadeIn?: boolean;
  fadeOut?: boolean;
}

export interface CrossfadeOptions {
  duration?: number; // Crossfade duration in seconds (default: 3)
  overlap?: number; // Overlap duration in seconds
}

// Generate fade-in/fade-out for a single track
export async function applyFade(
  trackId: string,
  options: FadeOptions = {}
): Promise<string> {
  const trackPath = await getTrackPath(trackId);
  const fadeDuration = options.duration || 3;
  const fadeIn = options.fadeIn !== false;
  const fadeOut = options.fadeOut !== false;

  // Get track duration
  const track = await db
    .selectFrom('tracks')
    .select('duration')
    .where('id', '=', trackId)
    .executeTakeFirst();

  if (!track || !track.duration) {
    throw new Error(`Track duration not available for track ${trackId}`);
  }

  const duration = track.duration;
  
  // Generate output path
  const outputPath = join(
    config.music.transcodeCachePath,
    `${trackId}-fade-${fadeDuration}s.mp3`
  );

  // Check if already exists
  if (existsSync(outputPath)) {
    return outputPath;
  }

  return new Promise((resolve, reject) => {
    let command = ffmpeg(trackPath)
      .setFfmpegPath(config.ffmpeg.ffmpegPath)
      .setFfprobePath(config.ffmpeg.ffprobePath);

    // Build fade filter
    const filters: string[] = [];

    if (fadeIn) {
      filters.push(`afade=t=in:st=0:d=${fadeDuration}`);
    }

    if (fadeOut && duration > fadeDuration * 2) {
      const fadeOutStart = duration - fadeDuration;
      filters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeDuration}`);
    }

    if (filters.length > 0) {
      command = command.audioFilters(filters);
    }

    command
      .format('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(320)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (error) => {
        reject(new Error(`Fade generation failed: ${error.message}`));
      })
      .save(outputPath);
  });
}

// Generate crossfade between two tracks
export async function createCrossfade(
  trackId1: string,
  trackId2: string,
  options: CrossfadeOptions = {}
): Promise<string> {
  const fadeDuration = options.duration || 3;
  const overlap = options.overlap || fadeDuration;

  const track1Path = await getTrackPath(trackId1);
  const track2Path = await getTrackPath(trackId2);

  // Get track durations
  const track1 = await db
    .selectFrom('tracks')
    .select('duration')
    .where('id', '=', trackId1)
    .executeTakeFirst();

  const track2 = await db
    .selectFrom('tracks')
    .select('duration')
    .where('id', '=', trackId2)
    .executeTakeFirst();

  if (!track1?.duration || !track2?.duration) {
    throw new Error('Track durations not available');
  }

  // Generate output path
  const outputPath = join(
    config.music.transcodeCachePath,
    `crossfade-${trackId1}-${trackId2}-${fadeDuration}s.mp3`
  );

  // Check if already exists
  if (existsSync(outputPath)) {
    return outputPath;
  }

  // Calculate fade points based on track analysis
  const analysis1 = await getTrackAnalysis(trackId1);
  const analysis2 = await getTrackAnalysis(trackId2);

  // Determine optimal fade points
  // Fade out from track1 near the end
  const track1FadeOutStart = Math.max(0, track1.duration - fadeDuration);
  
  // Fade in track2 from the beginning
  const track2FadeInStart = 0;

  return new Promise((resolve, reject) => {
    // Use FFmpeg complex filter to create crossfade
    const command = ffmpeg()
      .setFfmpegPath(config.ffmpeg.ffmpegPath)
      .setFfprobePath(config.ffmpeg.ffprobePath)
      .input(track1Path)
      .input(track2Path)
      .complexFilter([
        // Fade out track1
        `[0:a]afade=t=out:st=${track1FadeOutStart}:d=${fadeDuration}[a0]`,
        // Fade in track2
        `[1:a]afade=t=in:st=${track2FadeInStart}:d=${fadeDuration}[a1]`,
        // Concatenate with crossfade
        `[a0][a1]acrossfade=d=${overlap}[out]`,
      ])
      .outputOptions(['-map', '[out]'])
      .format('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(320)
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (error) => {
        reject(new Error(`Crossfade generation failed: ${error.message}`));
      })
      .save(outputPath);
  });
}

// Generate seamless playlist stream with crossfades
export async function createPlaylistStream(
  trackIds: string[],
  fadeDuration: number = 3
): Promise<string> {
  if (trackIds.length < 2) {
    throw new Error('Playlist must contain at least 2 tracks');
  }

  // Generate crossfades between consecutive tracks
  const crossfadePaths: string[] = [];
  
  for (let i = 0; i < trackIds.length - 1; i++) {
    const crossfadePath = await createCrossfade(
      trackIds[i],
      trackIds[i + 1],
      { duration: fadeDuration }
    );
    crossfadePaths.push(crossfadePath);
  }

  // Concatenate all crossfaded segments
  const outputPath = join(
    config.music.transcodeCachePath,
    `playlist-${randomUUID()}.mp3`
  );

  return new Promise((resolve, reject) => {
    let command = ffmpeg()
      .setFfmpegPath(config.ffmpeg.ffmpegPath)
      .setFfprobePath(config.ffmpeg.ffprobePath);

    // Add all crossfade files as inputs
    crossfadePaths.forEach((path) => {
      command = command.input(path);
    });

    // Concatenate using filter_complex
    const filter = crossfadePaths
      .map((_, i) => `[${i}:a]`)
      .join('') + `concat=n=${crossfadePaths.length}:v=0:a=1[out]`;

    command
      .complexFilter([filter])
      .outputOptions(['-map', '[out]'])
      .format('mp3')
      .audioCodec('libmp3lame')
      .audioBitrate(320)
      .on('end', () => {
        // Clean up intermediate crossfade files
        crossfadePaths.forEach((path) => {
          if (existsSync(path)) {
            try {
              unlinkSync(path);
            } catch (error) {
              console.warn(`Failed to clean up ${path}:`, error);
            }
          }
        });
        resolve(outputPath);
      })
      .on('error', (error) => {
        reject(new Error(`Playlist stream generation failed: ${error.message}`));
      })
      .save(outputPath);
  });
}

