/**
 * State management for yhdl sync
 * Uses database instead of JSON files for persistence
 */

import { db } from '../adapters/database.js';
import { updateDeezerSyncState } from '../../../../src/services/sync/deezer.js';
import type { SyncState, ArtistState } from './types.js';

// In-memory state cache (loaded from DB on demand)
let stateCache: SyncState | null = null;

/**
 * Load sync state from database
 */
export function loadState(_statePath?: string): SyncState {
	// Return cached state or load from DB
	if (stateCache) {
		return stateCache;
	}

	// Initialize empty state
	stateCache = {
		artists: {},
		version: "1.0.0",
	};

	// Load from database (async, but we need sync interface for compatibility)
	// This will be populated as artists are checked
	return stateCache;
}

/**
 * Save sync state to database
 * Note: Individual artist states are saved via updateDeezerSyncState
 */
export function saveState(_statePath: string, state: SyncState): void {
	// Update cache
	stateCache = state;
	// Individual artist states are already saved via updateDeezerSyncState
	// This function is kept for compatibility
}

/**
 * Update artist check timestamp (uses database)
 */
export function updateArtistCheck(
	state: SyncState,
	artistId: number,
	artistName: string,
	timestamp: Date = new Date()
): void {
	// Update in-memory state
	state.artists[artistId] = {
		name: artistName,
		lastChecked: timestamp.toISOString(),
		deezerId: artistId,
		...(state.artists[artistId] || {}),
	};

	// Update database asynchronously (fire and forget)
	(async () => {
		try {
			const { getOrCreateArtistByName } = await import('../adapters/database.js');
			const dbArtistId = await getOrCreateArtistByName(artistName, artistId);
			await updateDeezerSyncState(dbArtistId, 'completed');
		} catch (error) {
			console.error(`Failed to update artist check in database:`, error);
		}
	})();
}

/**
 * Update artist's last release date
 */
export function updateArtistLastRelease(
	state: SyncState,
	artistId: number,
	releaseDate: string
): void {
	if (!state.artists[artistId]) {
		state.artists[artistId] = {
			name: "",
			lastChecked: new Date().toISOString(),
			deezerId: artistId,
		};
	}
	state.artists[artistId].lastReleaseDate = releaseDate;
}

/**
 * Get last check timestamp for an artist (from in-memory state or database)
 */
export function getLastCheck(state: SyncState, artistId: number): Date | null {
	// Check in-memory state first
	const artist = state.artists[artistId];
	if (artist?.lastChecked) {
		try {
			return new Date(artist.lastChecked);
		} catch {
			return null;
		}
	}

	// If not in memory, return null (database check would be async, so we skip for now)
	// The state will be populated as artists are checked
	return null;
}

/**
 * Check if artist should be skipped (checked recently)
 */
export function shouldSkipArtist(
	state: SyncState,
	artistId: number,
	checkIntervalHours: number
): boolean {
	const lastCheck = getLastCheck(state, artistId);
	if (!lastCheck) {
		return false;
	}

	const hoursSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);
	return hoursSinceCheck < checkIntervalHours;
}

/**
 * Get all artist IDs from state
 */
export function getAllArtistIds(state: SyncState): number[] {
	return Object.keys(state.artists)
		.map((id) => parseInt(id, 10))
		.filter((id) => !isNaN(id));
}

/**
 * Update last full sync timestamp
 */
export function updateLastFullSync(state: SyncState, timestamp: Date = new Date()): void {
	state.lastFullSync = timestamp.toISOString();
}
