import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
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

async function processTrack(filePath: string): Promise<{ added: boolean; updated: boolean }> {
  try {
    const metadata = await parseFile(filePath);
    const stats = await stat(filePath);

    const title = metadata.common.title || 'Unknown Title';
    const artist = metadata.common.artist || 'Unknown Artist';
    const album = metadata.common.album || 'Unknown Album';
    const trackNumber = metadata.common.track?.no || null;
    const discNumber = metadata.common.disk?.no || null;
    const releaseDate = metadata.common.date || metadata.common.originaldate || null;
    const duration = metadata.format.duration ? Math.round(metadata.format.duration) : null;

    // Get or create artist
    const artistId = await getOrCreateArtist(artist);

    // Get or create album
    const artworkUrl = metadata.common.picture?.[0] 
      ? `/api/artwork/${encodeURIComponent(filePath)}` 
      : null;
    const albumId = await getOrCreateAlbum(album, artistId, releaseDate, artworkUrl);

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

