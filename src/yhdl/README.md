# yhdl Integration

This directory contains the integrated yhdl code for Deezer synchronization.

## Integration Notes

The yhdl code should be placed in the following structure:

```
src/yhdl/
├── library/          # Library scanning (from yhdl/src/library/)
├── sync/             # Sync engine (from yhdl/src/sync/)
├── deezer/           # Deezer API client (from yhdl/src/deezer/)
├── downloader/       # Download logic (from yhdl/src/downloader/)
├── folder-resolver.ts
└── config.ts
```

## Adaptations Made

1. **Database Integration**: Uses shared `db` instance from `../../db/index.ts`
2. **Configuration**: Uses shared `config` from `../../config/index.ts`
3. **Library Service**: Integrates with `../../services/library/` for scanning

## Usage

The yhdl functionality is exposed through the sync service at `src/services/sync/deezer.ts` and API endpoints at `src/api/sync.ts`.

