// Main programmatic API entry point
export * from "./api/index.js";

// Re-export for convenience
export { syncLibrary, checkArtist, type SyncOptions, type SyncResult } from "./sync/sync.js";
export { scanLibrary, type LibraryArtist, type ScanOptions } from "./library/scanner.js";

