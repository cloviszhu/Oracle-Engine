import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { createDatabase, createDatabasePool } from '../server/infrastructure/database/client.js';
import { readDatabaseUrl } from '../server/infrastructure/database/database.config.js';

const databaseUrl = readDatabaseUrl();
if (process.env.NODE_ENV !== 'test' || !databaseUrl.includes('test')) {
  throw new Error('Refusing to clean a database that is not explicitly marked as test');
}

const pool = createDatabasePool(databaseUrl);
const database = createDatabase(pool);
try {
  await database.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const table of [
    'notification_attempts', 'notification_deliveries', 'importance_scores', 'card_entities',
    'user_feedback', 'research_cards', 'processing_attempts', 'processing_intents',
    'content_relations', 'content_lifecycle_events', 'content_versions', 'content_items',
    'ingestion_runs', 'source_sync_states', 'source_accounts', 'external_usage',
    'budget_reservations', 'worker_heartbeats',
  ]) {
    await database.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
  }
  await database.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
} finally {
  await pool.end();
}
