import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';
// @ts-ignore - music-metadata has conditional exports that TypeScript struggles with
import { parseFile } from 'music-metadata';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';
import { randomUUID } from 'crypto';

export interface ScanResult {
  tracksScanned: number;
  tracksAdded: number;
  tracksUpdated: number;
  artistsAdded: number;
  albumsAdded: number;
  errors: Array<{ path: string; error: string }>;
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav', '.wma']);

function isAudioFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

async function findAudioFiles(dir: string, files: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await findAudioFiles(fullPath, files);
      } else if (entry.isFile() && isAudioFile(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
    console.warn(`Cannot read directory ${dir}:`, error);
  }
  
  return files;
}

async function getOrCreateArtist(name: string): Promise<string> {
  if (!name || name.trim() === '') {
    name = 'Unknown Artist';
  }

  // Normalize artist name for ID generation
  const normalizedName = name.toLowerCase().trim();
  const artistId = randomUUID();

  // Check if artist exists
  const existing = await db
    .selectFrom('artists')
    .select('id')
    .where('name', '=', name)
    .executeTakeFirst();

  if (existing) {
    return existing.id;
  }

  // Create new artist
  await db
    .insertInto('artists')
    .values({
      id: artistId,
      name: name.trim(),
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  return artistId;
}

async function getOrCreateAlbum(
  title: string,
  artistId: string | null,
  releaseDate?: string,
  artworkUrl?: string
): Promise<string> {
  if (!title || title.trim() === '') {
    title = 'Unknown Album';
  }

  const albumId = randomUUID();

  // Check if album exists (by title and artist)
  const existing = await db
    .selectFrom('albums')
    .select('id')
    .where('title', '=', title.trim())
    .where('artist_id', '=', artistId)
    .executeTakeFirst();

  if (existing) {
    return existing.id;
  }

  // Create new album
  await db
    .insertInto('albums')
    .values({
      id: albumId,
      title: title.trim(),
      artist_id: artistId,
      release_date: releaseDate || null,
      artwork_url: artworkUrl || null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  return albumId;
}

/**
 * Extract metadata using ffprobe as fallback when music-metadata fails
 */
async function extractMetadataWithFFprobe(filePath: string): Promise<{
  title: string;
  artist: string;
  album: string;
  trackNumber: number | null;
  discNumber: number | null;
  releaseDate: string | null;
  duration: number | null;
}> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const tags = format.tags || {};
        const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio');

        // Extract metadata from tags
        const title = tags.TITLE || tags.title || 'Unknown Title';
        const artist = tags.ARTIST || tags.artist || 'Unknown Artist';
        const album = tags.ALBUM || tags.album || 'Unknown Album';
        const trackNumber = tags.TRACK || tags.track ? parseInt(String(tags.TRACK || tags.track).split('/')[0], 10) : null;
        const discNumber = tags.DISC || tags.disc ? parseInt(String(tags.DISC || tags.disc).split('/')[0], 10) : null;
        const releaseDate = tags.DATE || tags.date || tags.YEAR || tags.year || null;
        const duration = format.duration ? Math.round(parseFloat(format.duration)) : null;

        resolve({
          title,
          artist,
          album,
          trackNumber: isNaN(trackNumber!) ? null : trackNumber,
          discNumber: isNaN(discNumber!) ? null : discNumber,
          releaseDate,
          duration,
        });
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to run ffprobe: ${error.message}`));
    });
  });
}

async function processTrack(filePath: string): Promise<{ added: boolean; updated: boolean }> {
  try {
    let metadata: any;
    let useFFprobe = false;

    // Try music-metadata first
    try {
      metadata = await parseFile(filePath);
    } catch (error) {
      // If music-metadata fails (e.g., "Invalid FLAC preamble"), fall back to ffprobe
      if (error instanceof Error && error.message.includes('FLAC preamble')) {
        console.warn(`music-metadata failed for ${filePath}, using ffprobe fallback`);
        useFFprobe = true;
      } else {
        throw error;
      }
    }

    const stats = await stat(filePath);

    let title: string;
    let artist: string;
    let album: string;
    let trackNumber: number | null;
    let discNumber: number | null;
    let releaseDate: string | null;
    let duration: number | null;

    if (useFFprobe) {
      // Use ffprobe fallback
      const ffprobeMetadata = await extractMetadataWithFFprobe(filePath);
      title = ffprobeMetadata.title;
      artist = ffprobeMetadata.artist;
      album = ffprobeMetadata.album;
      trackNumber = ffprobeMetadata.trackNumber;
      discNumber = ffprobeMetadata.discNumber;
      releaseDate = ffprobeMetadata.releaseDate;
      duration = ffprobeMetadata.duration;
    } else {
      // Use music-metadata result
      title = metadata.common.title || 'Unknown Title';
      artist = metadata.common.artist || 'Unknown Artist';
      album = metadata.common.album || 'Unknown Album';
      trackNumber = metadata.common.track?.no || null;
      discNumber = metadata.common.disk?.no || null;
      releaseDate = metadata.common.date || metadata.common.originaldate || null;
      duration = metadata.format.duration ? Math.round(metadata.format.duration) : null;
    }

    // Get or create artist
    const artistId = await getOrCreateArtist(artist);

    // Get or create album
    // Note: artwork detection from ffprobe would require additional parsing
    const artworkUrl = !useFFprobe && metadata?.common?.picture?.[0] 
      ? `/api/artwork/${encodeURIComponent(filePath)}` 
      : null;
    const albumId = await getOrCreateAlbum(album, artistId, releaseDate || undefined, artworkUrl || undefined);

    // Generate track ID from file path hash or use UUID
    const trackId = randomUUID();

    // Check if track exists
    const existing = await db
      .selectFrom('tracks')
      .select('id')
      .where('path', '=', filePath)
      .executeTakeFirst();

    if (existing) {
      // Update existing track
      await db
        .updateTable('tracks')
        .set({
          title: title.trim(),
          artist_id: artistId,
          album_id: albumId,
          format: extname(filePath).toLowerCase().slice(1),
          duration,
          file_size: stats.size,
          track_number: trackNumber,
          disc_number: discNumber,
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .execute();

      return { added: false, updated: true };
    } else {
      // Insert new track
      await db
        .insertInto('tracks')
        .values({
          id: trackId,
          title: title.trim(),
          artist_id: artistId,
          album_id: albumId,
          path: filePath,
          format: extname(filePath).toLowerCase().slice(1),
          duration,
          file_size: stats.size,
          track_number: trackNumber,
          disc_number: discNumber,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      return { added: true, updated: false };
    }
  } catch (error) {
    throw new Error(`Failed to process track ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function scanLibrary(): Promise<ScanResult> {
  const result: ScanResult = {
    tracksScanned: 0,
    tracksAdded: 0,
    tracksUpdated: 0,
    artistsAdded: 0,
    albumsAdded: 0,
    errors: [],
  };

  console.log(`Scanning music library at: ${config.music.rootPath}`);

  // Find all audio files
  const audioFiles = await findAudioFiles(config.music.rootPath);
  console.log(`Found ${audioFiles.length} audio files`);

  // Process each file
  for (const filePath of audioFiles) {
    try {
      result.tracksScanned++;
      const { added, updated } = await processTrack(filePath);
      
      if (added) {
        result.tracksAdded++;
      }
      if (updated) {
        result.tracksUpdated++;
      }

      // Progress indicator
      if (result.tracksScanned % 100 === 0) {
        console.log(`Processed ${result.tracksScanned}/${audioFiles.length} tracks...`);
      }
    } catch (error) {
      result.errors.push({
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`Error processing ${filePath}:`, error);
    }
  }

  // Count artists and albums
  const artistCount = await db
    .selectFrom('artists')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();
  result.artistsAdded = Number(artistCount?.count || 0);

  const albumCount = await db
    .selectFrom('albums')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();
  result.albumsAdded = Number(albumCount?.count || 0);

  console.log('Scan complete:', result);
  return result;
}

