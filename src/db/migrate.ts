import { initializeDatabase, closeDatabase } from './index.js';

async function migrate() {
  try {
    console.log('Initializing database schema...');
    await initializeDatabase();
    console.log('Database schema initialized successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

migrate();

