export interface ArtistState {
	name: string;
	lastChecked: string; // ISO timestamp
	lastReleaseDate?: string;
	deezerId?: number;
}

export interface SyncState {
	artists: Record<number, ArtistState>;
	lastFullSync?: string; // ISO timestamp
	version: string; // For future migrations
}

