# yhdl Service

This is the yhdl music library synchronization service, integrated into the music server.

## Integration Notes

The yhdl code has been refactored to:
- Use shared database connection from `../../src/db/index.ts`
- Use shared configuration from `../../src/config/index.js`
- Integrate with the music server's library service
- Maintain its own service interface for clean separation

## Structure

```
services/yhdl/
├── src/
│   ├── cli/              # CLI commands (if needed)
│   ├── library/          # Library scanning
│   ├── sync/             # Sync engine
│   ├── deezer/           # Deezer API client
│   ├── downloader/       # Download & decryption logic
│   ├── folder-resolver.ts
│   └── index.ts          # Main service exports
└── README.md
```

## Usage

Import and use from the music server:

```typescript
import { syncLibrary, scanLibrary } from '../services/yhdl/src/index.js';
```

