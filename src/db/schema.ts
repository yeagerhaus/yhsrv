import { Kysely, sql } from 'kysely';

export interface Database {
  tracks: TrackTable;
  artists: ArtistTable;
  albums: AlbumTable;
  sonic_analysis: SonicAnalysisTable;
  transcode_cache: TranscodeCacheTable;
  spotify_metadata: SpotifyMetadataTable;
  sync_state: SyncStateTable;
}

export interface TrackTable {
  id: string;
  title: string;
  artist_id: string | null;
  album_id: string | null;
  path: string;
  format: string;
  duration: number | null;
  file_size: number;
  track_number: number | null;
  disc_number: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ArtistTable {
  id: string;
  name: string;
  spotify_id: string | null;
  deezer_id: number | null;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface AlbumTable {
  id: string;
  title: string;
  artist_id: string | null;
  release_date: string | null;
  artwork_url: string | null;
  spotify_id: string | null;
  deezer_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface SonicAnalysisTable {
  id: string;
  track_id: string;
  bpm: number | null;
  key: string | null;
  energy: number | null;
  danceability: number | null;
  valence: number | null;
  tempo: number | null;
  loudness: number | null;
  analysis_json: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface TranscodeCacheTable {
  id: string;
  track_id: string;
  format: string;
  bitrate: number;
  path: string;
  file_size: number;
  created_at: Date;
}

export interface SpotifyMetadataTable {
  id: string;
  track_id: string;
  spotify_id: string;
  metadata_json: Record<string, unknown>;
  synced_at: Date;
  created_at: Date;
}

export interface SyncStateTable {
  id: string;
  artist_id: string;
  source: 'spotify' | 'deezer';
  last_checked: Date;
  last_synced: Date | null;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function createSchema(db: Kysely<Database>): Promise<void> {
  // Create artists table
  await db.schema
    .createTable('artists')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('name', 'varchar(500)', (col) => col.notNull())
    .addColumn('spotify_id', 'varchar(255)')
    .addColumn('deezer_id', 'integer')
    .addColumn('metadata_json', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .execute();

  // Create albums table
  await db.schema
    .createTable('albums')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('title', 'varchar(500)', (col) => col.notNull())
    .addColumn('artist_id', 'varchar(255)')
    .addColumn('release_date', 'varchar(50)')
    .addColumn('artwork_url', 'text')
    .addColumn('spotify_id', 'varchar(255)')
    .addColumn('deezer_id', 'integer')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addForeignKeyConstraint('albums_artist_id_fk', ['artist_id'], 'artists', ['id'], (cb) => cb.onDelete('set null'))
    .execute();

  // Create tracks table
  await db.schema
    .createTable('tracks')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('title', 'varchar(500)', (col) => col.notNull())
    .addColumn('artist_id', 'varchar(255)')
    .addColumn('album_id', 'varchar(255)')
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('format', 'varchar(50)', (col) => col.notNull())
    .addColumn('duration', 'integer')
    .addColumn('file_size', 'bigint', (col) => col.notNull())
    .addColumn('track_number', 'integer')
    .addColumn('disc_number', 'integer')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addForeignKeyConstraint('tracks_artist_id_fk', ['artist_id'], 'artists', ['id'], (cb) => cb.onDelete('set null'))
    .addForeignKeyConstraint('tracks_album_id_fk', ['album_id'], 'albums', ['id'], (cb) => cb.onDelete('set null'))
    .execute();

  // Create sonic_analysis table
  await db.schema
    .createTable('sonic_analysis')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('track_id', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('bpm', 'real')
    .addColumn('key', 'varchar(10)')
    .addColumn('energy', 'real')
    .addColumn('danceability', 'real')
    .addColumn('valence', 'real')
    .addColumn('tempo', 'real')
    .addColumn('loudness', 'real')
    .addColumn('analysis_json', 'jsonb')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addForeignKeyConstraint('sonic_analysis_track_id_fk', ['track_id'], 'tracks', ['id'], (cb) => cb.onDelete('cascade'))
    .execute();

  // Create transcode_cache table
  await db.schema
    .createTable('transcode_cache')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('track_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('format', 'varchar(50)', (col) => col.notNull())
    .addColumn('bitrate', 'integer', (col) => col.notNull())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('file_size', 'bigint', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addForeignKeyConstraint('transcode_cache_track_id_fk', ['track_id'], 'tracks', ['id'], (cb) => cb.onDelete('cascade'))
    .execute();

  // Create spotify_metadata table
  await db.schema
    .createTable('spotify_metadata')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('track_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('spotify_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('metadata_json', 'jsonb', (col) => col.notNull())
    .addColumn('synced_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addForeignKeyConstraint('spotify_metadata_track_id_fk', ['track_id'], 'tracks', ['id'], (cb) => cb.onDelete('cascade'))
    .execute();

  // Create sync_state table
  await db.schema
    .createTable('sync_state')
    .ifNotExists()
    .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
    .addColumn('artist_id', 'varchar(255)', (col) => col.notNull())
    .addColumn('source', 'varchar(50)', (col) => col.notNull())
    .addColumn('last_checked', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('last_synced', 'timestamp')
    .addColumn('status', 'varchar(50)', (col) => col.defaultTo('pending').notNull())
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull())
    .addForeignKeyConstraint('sync_state_artist_id_fk', ['artist_id'], 'artists', ['id'], (cb) => cb.onDelete('cascade'))
    .execute();

  // Create indexes
  await db.schema
    .createIndex('idx_tracks_artist_id')
    .ifNotExists()
    .on('tracks')
    .column('artist_id')
    .execute();

  await db.schema
    .createIndex('idx_tracks_album_id')
    .ifNotExists()
    .on('tracks')
    .column('album_id')
    .execute();

  await db.schema
    .createIndex('idx_albums_artist_id')
    .ifNotExists()
    .on('albums')
    .column('artist_id')
    .execute();

  await db.schema
    .createIndex('idx_transcode_cache_track_format_bitrate')
    .ifNotExists()
    .on('transcode_cache')
    .columns(['track_id', 'format', 'bitrate'])
    .execute();

  await db.schema
    .createIndex('idx_sync_state_artist_source')
    .ifNotExists()
    .on('sync_state')
    .columns(['artist_id', 'source'])
    .execute();
}

