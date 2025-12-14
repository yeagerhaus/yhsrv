export interface LibraryArtist {
	name: string;
	path: string;
	source: "metadata" | "folder";
	fileCount?: number;
}

export interface ScanOptions {
	includeMetadata?: boolean;
	includeFolders?: boolean;
	maxDepth?: number;
}

