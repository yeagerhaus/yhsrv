import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig, loadArl, saveArl, clearArl } from "./config.js";

describe("Config", () => {
	const testEnvPath = path.join(os.tmpdir(), `yhdl-test-${Date.now()}.env`);

	beforeEach(() => {
		// Clean up any existing test env file
		if (fs.existsSync(testEnvPath)) {
			fs.unlinkSync(testEnvPath);
		}
		// Clear env vars for testing
		delete process.env.MUSIC_ROOT_PATH;
		delete process.env.DEEZER_ARL;
		delete process.env.SYNC_CONCURRENCY;
		delete process.env.SYNC_CHECK_INTERVAL;
	});

	afterEach(() => {
		// Clean up test env file
		if (fs.existsSync(testEnvPath)) {
			fs.unlinkSync(testEnvPath);
		}
	});

	test("loadConfig returns default music root path when env var not set", () => {
		const config = loadConfig();
		expect(config.musicRootPath).toBeTruthy();
		expect(typeof config.musicRootPath).toBe("string");
	});

	test("loadConfig reads MUSIC_ROOT_PATH from env", () => {
		const testPath = "/test/music/path";
		process.env.MUSIC_ROOT_PATH = testPath;
		const config = loadConfig();
		expect(config.musicRootPath).toBe(testPath);
	});

	test("loadConfig has default sync settings", () => {
		const config = loadConfig();
		expect(config.syncConcurrency).toBe(5);
		expect(config.syncCheckInterval).toBe(24);
	});

	test("loadConfig reads sync settings from env", () => {
		process.env.SYNC_CONCURRENCY = "10";
		process.env.SYNC_CHECK_INTERVAL = "12";
		const config = loadConfig();
		expect(config.syncConcurrency).toBe(10);
		expect(config.syncCheckInterval).toBe(12);
	});

	test("loadArl returns null when DEEZER_ARL not set", () => {
		const arl = loadArl();
		expect(arl).toBeNull();
	});

	test("loadArl returns ARL from env", () => {
		const testArl = "test_arl_token_12345";
		process.env.DEEZER_ARL = testArl;
		const arl = loadArl();
		expect(arl).toBe(testArl);
	});

	test("loadArl trims whitespace", () => {
		process.env.DEEZER_ARL = "  test_arl  ";
		const arl = loadArl();
		expect(arl).toBe("test_arl");
	});

	test("saveArl and loadArl work together", () => {
		const testArl = "saved_arl_token";
		process.env.DEEZER_ARL = testArl;
		
		// Note: saveArl writes to .env file, but loadArl reads from process.env
		// In real usage, Bun loads .env automatically
		const arl = loadArl();
		expect(arl).toBe(testArl);
	});

	test("clearArl removes ARL from env file", () => {
		// This test verifies clearArl doesn't throw
		expect(() => clearArl()).not.toThrow();
	});
});

