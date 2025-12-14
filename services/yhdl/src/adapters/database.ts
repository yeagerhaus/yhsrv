/**
 * Database Adapter for yhdl
 * 
 * Adapts yhdl's database needs to use the shared music server database.
 */

import { db } from '../../../../src/db/index.js';
import type { Database } from '../../../../src/db/schema.js';

// Re-export database for yhdl to use
export { db };

// Helper functions for yhdl-specific database operations
export async function getArtistByDeezerId(deezerId: number) {
  return db
    .selectFrom('artists')
    .selectAll()
    .where('deezer_id', '=', deezerId)
    .executeTakeFirst();
}

export async function getOrCreateArtistByName(name: string, deezerId?: number) {
  // Check if exists
  const existing = await db
    .selectFrom('artists')
    .select('id')
    .where('name', '=', name)
    .executeTakeFirst();

  if (existing) {
    // Update deezer_id if provided
    if (deezerId) {
      await db
        .updateTable('artists')
        .set({ deezer_id: deezerId, updated_at: new Date() })
        .where('id', '=', existing.id)
        .execute();
    }
    return existing.id;
  }

  // Create new
  const { randomUUID } = await import('crypto');
  const id = randomUUID();
  await db
    .insertInto('artists')
    .values({
      id,
      name,
      deezer_id: deezerId || null,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .execute();

  return id;
}

