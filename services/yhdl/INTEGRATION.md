# yhdl Integration Guide

## Step 1: Copy yhdl Repository

Copy the entire yhdl repository contents into this `services/yhdl/` directory. The structure should be:

```
services/yhdl/
├── src/
│   ├── cli/              # From yhdl/src/cli/
│   ├── library/          # From yhdl/src/library/
│   ├── sync/             # From yhdl/src/sync/
│   ├── api/              # From yhdl/src/api/ (if exists)
│   ├── deezer/           # From yhdl/src/deezer/
│   ├── downloader/       # From yhdl/src/downloader/
│   ├── folder-resolver.ts
│   └── config.ts
├── test/                 # From yhdl/test/ (if needed)
├── package.json          # From yhdl (merge dependencies)
└── README.md
```

## Step 2: Refactoring Points

After copying, you'll need to refactor these areas:

### 1. Configuration (`src/config.ts` or similar)

**Before:**
```typescript
import dotenv from 'dotenv';
const config = loadConfig();
```

**After:**
```typescript
import { getYhdlConfig } from './adapters/config.js';
const config = getYhdlConfig();
```

### 2. Database Access

**Before:**
```typescript
import { db } from './db';
```

**After:**
```typescript
import { db } from './adapters/database.js';
```

### 3. Library Scanning

If yhdl has its own library scanner, you can either:
- Use the server's scanner: `import { serverScanLibrary } from './adapters/library.js'`
- Keep yhdl's scanner if it has unique features

### 4. State Management

yhdl's sync state should use the shared `sync_state` table in the database instead of JSON files.

**Refactor:**
- Replace file-based state with database calls
- Use `updateDeezerSyncState()` from `src/services/sync/deezer.ts`

### 5. Track Format Enum

**Before:**
```typescript
enum TrackFormats {
  FLAC = 'flac',
  MP3 = 'mp3',
}
```

**After:**
```typescript
type TrackFormats = 'flac' | 'mp3' | 'm4a';
```

### 6. Main Exports (`src/index.ts`)

Update `services/yhdl/src/index.ts` to export the actual yhdl functions:

```typescript
// Replace placeholder exports with actual yhdl exports
export { syncLibrary } from './sync/index.js';
export { scanLibrary } from './library/index.js';
// ... etc
```

## Step 3: Update Dependencies

Merge yhdl's dependencies into the main `package.json`:

```bash
# Check yhdl's package.json for dependencies
# Add any missing ones to root package.json
```

Common dependencies that might need adding:
- Deezer API client libraries
- Download/decryption libraries
- Any yhdl-specific utilities

## Step 4: Test Integration

1. Ensure `DEEZER_ARL` is set in `.env`
2. Test library scan: `POST /api/sync/deezer`
3. Test artist sync: `POST /api/sync/deezer/artist/:id`

## Notes

- Keep yhdl code as a service module - don't merge it into main server code
- Use adapters for shared resources (database, config)
- Maintain yhdl's API surface for clean separation
- Update imports to use relative paths from `services/yhdl/`

