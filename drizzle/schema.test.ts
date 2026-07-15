import { getTableConfig } from 'drizzle-orm/mysql-core';
import { describe, expect, it } from 'vitest';
import { businessSchema, contentItems, processingIntents } from './schema.js';

describe('business database schema', () => {
  it('contains the audited identity, version, pipeline, research, notification, and usage tables', () => {
    expect(Object.keys(businessSchema).sort()).toEqual([
      'budgetReservations',
      'cardEntities',
      'contentItems',
      'contentLifecycleEvents',
      'contentRelations',
      'contentVersions',
      'externalUsage',
      'importanceScores',
      'ingestionRuns',
      'notificationAttempts',
      'notificationDeliveries',
      'processingAttempts',
      'processingIntents',
      'researchCards',
      'sourceAccounts',
      'sourceSyncStates',
      'userFeedback',
      'workerHeartbeats',
    ]);
  });

  it('uses provider identity and stage idempotency unique indexes', () => {
    const contentIndexes = getTableConfig(contentItems).indexes.map((index) => index.config.name);
    const intentIndexes = getTableConfig(processingIntents).indexes.map((index) => index.config.name);

    expect(contentIndexes).toContain('content_items_provider_external_uidx');
    expect(intentIndexes).toContain('processing_intents_stage_key_uidx');
  });
});
