import 'dotenv/config';
import { createDatabase, createDatabasePool } from '../server/infrastructure/database/client.js';
import { parseRuntimeConfig } from '../server/infrastructure/runtime-config.js';
import { XApiClient } from '../server/infrastructure/x/x-api.client.js';
import { DrizzleIngestionRepository } from '../server/ingestion/drizzle-ingestion.repository.js';
import { bootstrapSerenitySource } from '../server/ingestion/serenity-bootstrap.service.js';

const config = parseRuntimeConfig(process.env);
if (!config.x.bearerToken) {
  throw new Error('X_API_BEARER_TOKEN is required to bootstrap Serenity');
}
const pool = createDatabasePool(config.databaseUrl);
try {
  const repository = new DrizzleIngestionRepository(
    createDatabase(pool),
    config.work.maxRawPayloadBytes,
  );
  const result = await bootstrapSerenitySource(
    new XApiClient({
      bearerToken: config.x.bearerToken,
      deadlineMs: config.work.externalDeadlineMs,
    }),
    repository,
  );
  process.stdout.write(`Serenity source ready: ${result.sourceId}\n`);
} finally {
  await pool.end();
}
