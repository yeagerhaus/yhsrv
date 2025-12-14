/**
 * Configuration adapter for yhdl
 * Uses shared music server configuration
 */

import { getYhdlConfig } from './adapters/config.js';
import type { Config } from './adapters/config.js';
import path from 'path';

// Re-export config functions that maintain compatibility
export function loadConfig(): Config {
	return getYhdlConfig();
}

/**
 * Load ARL from shared config
 */
export function loadArl(): string | null {
	const config = getYhdlConfig();
	return config.deezerArl || null;
}

/**
 * Save ARL - updates the shared config's environment
 * Note: In production, this should update the .env file
 */
export function saveArl(arl: string): void {
	// Update environment variable (this will persist in the process)
	process.env.DEEZER_ARL = arl;
	// TODO: Optionally write to .env file if needed
}

/**
 * Clear ARL from environment
 */
export function clearArl(): void {
	delete process.env.DEEZER_ARL;
}

/**
 * Get the .env file path (for display purposes)
 */
export function getEnvPathForDisplay(): string {
	// Return path to root .env file
	return path.join(process.cwd(), '.env');
}

export type { Config };
