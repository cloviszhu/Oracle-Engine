import { drizzle } from 'drizzle-orm/mysql2';
import { createPool, type Pool } from 'mysql2/promise';
import * as schema from '../../../drizzle/schema.js';

export function createDatabasePool(databaseUrl: string): Pool {
  return createPool({ uri: databaseUrl, connectionLimit: 10, timezone: 'Z' });
}

export function createDatabase(pool: Pool) {
  return drizzle(pool, { schema, mode: 'default' });
}
