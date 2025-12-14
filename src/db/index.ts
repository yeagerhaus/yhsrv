import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { config } from '../config/index.js';
import type { Database } from './schema.js';
import { createSchema } from './schema.js';

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: config.database.url,
    max: 10,
  }),
});

export const db = new Kysely<Database>({
  dialect,
});

// Initialize database schema on first connection
let schemaInitialized = false;

export async function initializeDatabase(): Promise<void> {
  if (!schemaInitialized) {
    await createSchema(db);
    schemaInitialized = true;
  }
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}

