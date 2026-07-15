import 'dotenv/config';
import { sourceAccounts, sourceSyncStates } from '../drizzle/schema.js';
import { createDatabase, createDatabasePool } from '../server/infrastructure/database/client.js';
import { readDatabaseUrl } from '../server/infrastructure/database/database.config.js';

const databaseUrl = readDatabaseUrl();
if (process.env.NODE_ENV !== 'test' || !databaseUrl.includes('test')) {
  throw new Error('Refusing to seed a database that is not explicitly marked as test');
}

const pool = createDatabasePool(databaseUrl);
const database = createDatabase(pool);
const now = new Date();
try {
  await database
    .insert(sourceAccounts)
    .values({
      id: 'source-serenity-test', provider: 'x', externalUserId: 'test-serenity-user',
      username: 'aleabitoreddit', displayName: 'Serenity', enabled: false,
      createdAt: now, updatedAt: now,
    })
    .onDuplicateKeyUpdate({ set: { username: 'aleabitoreddit', updatedAt: now } });
  await database
    .insert(sourceSyncStates)
    .values({ sourceAccountId: 'source-serenity-test', status: 'idle', updatedAt: now })
    .onDuplicateKeyUpdate({ set: { status: 'idle', updatedAt: now } });
} finally {
  await pool.end();
}
