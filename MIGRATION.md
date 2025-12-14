# Migration from Go to TypeScript

This project has been migrated from Go to TypeScript. The old Go files can be removed:

## Files to Remove (Optional)

- `main.go`
- `Dockerfile` (old one, new one is in `docker/Dockerfile`)
- `internal/` directory (old Go handlers, models, utils)
- `Makefile` (if not needed)

## New Structure

The new TypeScript implementation is in the `src/` directory with the following structure:

- `src/server.ts` - Main server entry point
- `src/api/` - API routes
- `src/services/` - Business logic services
- `src/db/` - Database schema and migrations
- `src/config/` - Configuration management
- `src/yhdl/` - Placeholder for yhdl integration

## Next Steps

1. Remove old Go files (optional)
2. Copy yhdl code into `src/yhdl/` directory
3. Configure `.env` file with your settings
4. Run `npm install` to install dependencies
5. Run `npm run migrate` to initialize database
6. Start the server with `npm run dev` or `npm start`

