import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createDatabase, createDatabasePool } from './client.js';
import { readDatabaseUrl } from './database.config.js';

const pool = createDatabasePool(readDatabaseUrl());

try {
  await migrate(createDatabase(pool), { migrationsFolder: 'drizzle/migrations' });
} finally {
  await pool.end();
}
