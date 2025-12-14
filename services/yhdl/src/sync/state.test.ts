import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import {
	loadState,
	saveState,
	updateArtistCheck,
	getLastCheck,
	shouldSkipArtist,
	getAllArtistIds,
	updateLastFullSync,
} from "./state.js";
import type { SyncState } from "./types.js";

describe("Sync State", () => {
	const testStatePath = path.join(os.tmpdir(), `yhdl-state-test-${Date.now()}.json`);

	beforeEach(() => {
		if (fs.existsSync(testStatePath)) {
			fs.unlinkSync(testStatePath);
		}
	});

	afterEach(() => {
		if (fs.existsSync(testStatePath)) {
			fs.unlinkSync(testStatePath);
		}
	});

	test("loadState returns default state for non-existent file", () => {
		const state = loadState(testStatePath);
		expect(state.artists).toEqual({});
		expect(state.version).toBe("1.0.0");
	});

	test("saveState and loadState work together", () => {
		const testState: SyncState = {
			artists: {
				123: {
					name: "Test Artist",
					lastChecked: new Date().toISOString(),
					deezerId: 123,
				},
			},
			version: "1.0.0",
		};

		saveState(testStatePath, testState);
		const loaded = loadState(testStatePath);

		expect(loaded.artists[123]).toBeDefined();
		expect(loaded.artists[123].name).toBe("Test Artist");
	});

	test("updateArtistCheck adds artist to state", () => {
		const state: SyncState = {
			artists: {},
			version: "1.0.0",
		};

		const checkTime = new Date();
		updateArtistCheck(state, 456, "New Artist", checkTime);

		expect(state.artists[456]).toBeDefined();
		expect(state.artists[456].name).toBe("New Artist");
		expect(state.artists[456].lastChecked).toBe(checkTime.toISOString());
	});

	test("getLastCheck returns null for unknown artist", () => {
		const state: SyncState = {
			artists: {},
			version: "1.0.0",
		};

		expect(getLastCheck(state, 999)).toBeNull();
	});

	test("getLastCheck returns date for known artist", () => {
		const checkTime = new Date("2024-01-01T00:00:00Z");
		const state: SyncState = {
			artists: {
				789: {
					name: "Artist",
					lastChecked: checkTime.toISOString(),
					deezerId: 789,
				},
			},
			version: "1.0.0",
		};

		const lastCheck = getLastCheck(state, 789);
		expect(lastCheck).not.toBeNull();
		expect(lastCheck?.getTime()).toBe(checkTime.getTime());
	});

	test("shouldSkipArtist returns false for never-checked artist", () => {
		const state: SyncState = {
			artists: {},
			version: "1.0.0",
		};

		expect(shouldSkipArtist(state, 999, 24)).toBe(false);
	});

	test("shouldSkipArtist returns true for recently-checked artist", () => {
		const state: SyncState = {
			artists: {
				111: {
					name: "Artist",
					lastChecked: new Date().toISOString(), // Just now
					deezerId: 111,
				},
			},
			version: "1.0.0",
		};

		expect(shouldSkipArtist(state, 111, 24)).toBe(true);
	});

	test("shouldSkipArtist returns false for old-checked artist", () => {
		const oldDate = new Date();
		oldDate.setHours(oldDate.getHours() - 48); // 2 days ago

		const state: SyncState = {
			artists: {
				222: {
					name: "Artist",
					lastChecked: oldDate.toISOString(),
					deezerId: 222,
				},
			},
			version: "1.0.0",
		};

		expect(shouldSkipArtist(state, 222, 24)).toBe(false);
	});

	test("getAllArtistIds returns all artist IDs", () => {
		const state: SyncState = {
			artists: {
				1: { name: "Artist 1", lastChecked: new Date().toISOString(), deezerId: 1 },
				2: { name: "Artist 2", lastChecked: new Date().toISOString(), deezerId: 2 },
				3: { name: "Artist 3", lastChecked: new Date().toISOString(), deezerId: 3 },
			},
			version: "1.0.0",
		};

		const ids = getAllArtistIds(state);
		expect(ids).toContain(1);
		expect(ids).toContain(2);
		expect(ids).toContain(3);
		expect(ids.length).toBe(3);
	});

	test("updateLastFullSync sets timestamp", () => {
		const state: SyncState = {
			artists: {},
			version: "1.0.0",
		};

		const syncTime = new Date("2024-01-01T12:00:00Z");
		updateLastFullSync(state, syncTime);

		expect(state.lastFullSync).toBe(syncTime.toISOString());
	});
});

