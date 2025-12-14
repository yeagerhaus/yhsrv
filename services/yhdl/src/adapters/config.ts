/**
 * Configuration Adapter for yhdl
 * 
 * Adapts yhdl's configuration needs to use the shared music server config.
 */

import { config } from '../../../src/config/index.js';

export interface Config {
	musicRootPath: string;
	syncStatePath?: string;
	errorLogPath?: string;
	syncConcurrency?: number;
	syncCheckInterval?: number; // hours
	deezerArl?: string;
}

// Export yhdl-specific config derived from main config
export function getYhdlConfig(): Config {
	return {
		deezerArl: config.deezer.arl || undefined,
		musicRootPath: config.music.rootPath,
		syncConcurrency: config.deezer.syncConcurrency,
		syncCheckInterval: config.deezer.syncCheckInterval,
		statePath: '.yhdl/sync-state.json', // Fallback, but we'll use DB
		errorLogPath: '.yhdl/sync-errors.json',
	};
}

// Re-export main config for advanced usage
export { config };

