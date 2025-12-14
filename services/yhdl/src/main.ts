#!/usr/bin/env node

import { Command } from "commander";
import { downloadArtist } from "./cli/download.js";
import { syncCommand } from "./cli/sync.js";
import pc from "picocolors";

const program = new Command();

program
	.name("yhdl")
	.description("Download artist discographies from Deezer with intelligent folder management")
	.version("1.0.0");

// Download command (existing functionality)
const downloadCmd = program
	.command("download")
	.alias("d")
	.description("Download discography for a specific artist")
	.argument("<artist>", "Artist name to search and download")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.option("--dry-run", "Preview what would be downloaded without actually downloading")
	.action((artist, opts) => {
		// Create a temporary command to pass args
		const tempCmd = new Command();
		tempCmd.args = [artist];
		Object.assign(tempCmd.opts(), opts);
		downloadArtist(tempCmd).catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Sync command (new functionality)
program
	.command("sync")
	.alias("s")
	.description("Sync entire music library - check all artists for new releases")
	.option("--full", "Force check all artists (ignore last check time)")
	.option("--artist <name>", "Sync specific artist only")
	.option("--dry-run", "Preview what would be downloaded without actually downloading")
	.option("-c, --concurrency <n>", "Parallel artist checks", "5")
	.option("--since <hours>", "Only check artists not checked in last N hours", "24")
	.option("-b, --bitrate <type>", "Bitrate: flac, 320, 128", "flac")
	.action(() => {
		syncCommand().catch((e) => {
			console.error(pc.red("Error:"), e.message);
			process.exit(1);
		});
	});

// Parse arguments
const args = process.argv.slice(2);

// Backward compatibility: if first arg is not a command and not a flag, treat as artist
if (args.length > 0 && !args[0].startsWith("-") && args[0] !== "download" && args[0] !== "d" && args[0] !== "sync" && args[0] !== "s") {
	// Insert "download" command before the artist name
	process.argv = ["node", "yhdl", "download", ...args];
	program.parse();
} else {
	program.parse();
}
