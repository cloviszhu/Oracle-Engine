import {
  bigint,
  boolean,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

const id = (name: string) => varchar(name, { length: 128 });
const createdAt = () => datetime('created_at', { mode: 'date', fsp: 3 }).notNull();
const processingStatuses = [
  'pending',
  'processing',
  'succeeded',
  'retryable_failed',
  'blocked',
  'dead_letter',
] as const;
const deliveryStatuses = [
  'pending',
  'sending',
  'sent',
  'retryable_failed',
  'outcome_unknown',
  'blocked',
  'dead_letter',
  'suppressed',
] as const;

export const sourceAccounts = mysqlTable(
  'source_accounts',
  {
    id: id('id').primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    externalUserId: varchar('external_user_id', { length: 128 }).notNull(),
    username: varchar('username', { length: 128 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    enabled: boolean('enabled').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex('source_accounts_provider_external_uidx').on(
      table.provider,
      table.externalUserId,
    ),
  ],
);

export const sourceSyncStates = mysqlTable('source_sync_states', {
  sourceAccountId: id('source_account_id')
    .primaryKey()
    .references(() => sourceAccounts.id),
  sinceId: varchar('since_id', { length: 128 }),
  lastSuccessAt: datetime('last_success_at', { mode: 'date', fsp: 3 }),
  lastAttemptAt: datetime('last_attempt_at', { mode: 'date', fsp: 3 }),
  nextPollAt: datetime('next_poll_at', { mode: 'date', fsp: 3 }),
  status: varchar('status', { length: 32 }).notNull(),
  errorCode: varchar('error_code', { length: 64 }),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
});

export const ingestionRuns = mysqlTable(
  'ingestion_runs',
  {
    id: id('id').primaryKey(),
    sourceAccountId: id('source_account_id')
      .notNull()
      .references(() => sourceAccounts.id),
    mode: mysqlEnum('mode', ['poll', 'compensation', 'verification']).notNull(),
    status: mysqlEnum('status', processingStatuses).notNull(),
    correlationId: id('correlation_id').notNull(),
    pages: int('pages').notNull().default(0),
    items: int('items').notNull().default(0),
    errorCode: varchar('error_code', { length: 64 }),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }).notNull(),
    finishedAt: datetime('finished_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [index('ingestion_runs_source_started_idx').on(table.sourceAccountId, table.startedAt)],
);

export const contentItems = mysqlTable(
  'content_items',
  {
    id: id('id').primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    externalId: varchar('external_id', { length: 128 }).notNull(),
    sourceAccountId: id('source_account_id').references(() => sourceAccounts.id),
    authorExternalId: varchar('author_external_id', { length: 128 }).notNull(),
    sourceUrl: varchar('source_url', { length: 2048 }).notNull(),
    contentType: mysqlEnum('content_type', ['post', 'reply', 'quote']).notNull(),
    visibility: mysqlEnum('visibility', [
      'active',
      'verification_pending',
      'deleted',
      'unavailable',
    ]).notNull(),
    currentVersionId: id('current_version_id'),
    firstObservedAt: datetime('first_observed_at', { mode: 'date', fsp: 3 }).notNull(),
    lastObservedAt: datetime('last_observed_at', { mode: 'date', fsp: 3 }).notNull(),
    publishedAt: datetime('published_at', { mode: 'date', fsp: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex('content_items_provider_external_uidx').on(table.provider, table.externalId),
    index('content_items_published_idx').on(table.publishedAt, table.id),
  ],
);

export const contentVersions = mysqlTable(
  'content_versions',
  {
    id: id('id').primaryKey(),
    contentId: id('content_id')
      .notNull()
      .references(() => contentItems.id),
    version: int('version').notNull(),
    externalEditId: varchar('external_edit_id', { length: 128 }),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    body: text('body'),
    rawPayload: json('raw_payload').$type<Record<string, unknown>>(),
    rawPayloadBytes: int('raw_payload_bytes').notNull().default(0),
    providerRequestId: varchar('provider_request_id', { length: 255 }),
    publishedAt: datetime('published_at', { mode: 'date', fsp: 3 }).notNull(),
    fetchedAt: datetime('fetched_at', { mode: 'date', fsp: 3 }).notNull(),
    clearedAt: datetime('cleared_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [
    uniqueIndex('content_versions_content_hash_uidx').on(table.contentId, table.payloadHash),
    uniqueIndex('content_versions_content_version_uidx').on(table.contentId, table.version),
  ],
);

export const contentLifecycleEvents = mysqlTable(
  'content_lifecycle_events',
  {
    id: id('id').primaryKey(),
    contentId: id('content_id')
      .notNull()
      .references(() => contentItems.id),
    fromVisibility: varchar('from_visibility', { length: 32 }),
    toVisibility: varchar('to_visibility', { length: 32 }).notNull(),
    evidenceCategory: varchar('evidence_category', { length: 64 }).notNull(),
    providerRequestId: varchar('provider_request_id', { length: 255 }),
    reason: varchar('reason', { length: 500 }),
    occurredAt: datetime('occurred_at', { mode: 'date', fsp: 3 }).notNull(),
    confirmedAt: datetime('confirmed_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [index('content_lifecycle_content_time_idx').on(table.contentId, table.occurredAt)],
);

export const contentRelations = mysqlTable(
  'content_relations',
  {
    id: id('id').primaryKey(),
    fromContentId: id('from_content_id')
      .notNull()
      .references(() => contentItems.id),
    relationType: mysqlEnum('relation_type', [
      'reply_to',
      'quotes',
      'edit_predecessor',
      'conversation',
    ]).notNull(),
    toContentId: id('to_content_id').references(() => contentItems.id),
    toExternalId: varchar('to_external_id', { length: 128 }).notNull(),
    missingReason: varchar('missing_reason', { length: 255 }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('content_relations_direction_uidx').on(
      table.fromContentId,
      table.relationType,
      table.toExternalId,
    ),
  ],
);

export const processingIntents = mysqlTable(
  'processing_intents',
  {
    id: id('id').primaryKey(),
    contentId: id('content_id').references(() => contentItems.id),
    contentVersionId: id('content_version_id').references(() => contentVersions.id),
    stage: mysqlEnum('stage', ['ingest', 'context', 'analysis', 'score']).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    status: mysqlEnum('status', processingStatuses).notNull(),
    blockReason: varchar('block_reason', { length: 64 }),
    manualRetryAllowed: boolean('manual_retry_allowed').notNull().default(false),
    availableAt: datetime('available_at', { mode: 'date', fsp: 3 }).notNull(),
    createdAt: createdAt(),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex('processing_intents_stage_key_uidx').on(table.stage, table.idempotencyKey),
    index('processing_intents_dispatch_idx').on(table.status, table.availableAt),
  ],
);

export const processingAttempts = mysqlTable(
  'processing_attempts',
  {
    id: id('id').primaryKey(),
    intentId: id('intent_id')
      .notNull()
      .references(() => processingIntents.id),
    attempt: int('attempt').notNull(),
    status: mysqlEnum('status', processingStatuses).notNull(),
    leaseOwner: varchar('lease_owner', { length: 128 }),
    leaseExpiresAt: datetime('lease_expires_at', { mode: 'date', fsp: 3 }),
    fencingToken: bigint('fencing_token', { mode: 'bigint', unsigned: true }).notNull(),
    errorCode: varchar('error_code', { length: 64 }),
    errorCategory: varchar('error_category', { length: 64 }),
    provider: varchar('provider', { length: 32 }),
    providerVersion: varchar('provider_version', { length: 128 }),
    requestedByActorId: varchar('requested_by_actor_id', { length: 64 }),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }).notNull(),
    finishedAt: datetime('finished_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [uniqueIndex('processing_attempts_intent_attempt_uidx').on(table.intentId, table.attempt)],
);

export const researchCards = mysqlTable(
  'research_cards',
  {
    id: id('id').primaryKey(),
    contentId: id('content_id')
      .notNull()
      .references(() => contentItems.id),
    contentVersionId: id('content_version_id')
      .notNull()
      .references(() => contentVersions.id),
    version: int('version').notNull(),
    analysisKey: varchar('analysis_key', { length: 255 }).notNull(),
    translation: text('translation').notNull(),
    authorJudgment: json('author_judgment').$type<unknown[]>().notNull(),
    othersContent: json('others_content').$type<unknown[]>().notNull(),
    aiExplanation: json('ai_explanation').$type<unknown[]>().notNull(),
    unverifiedInferences: json('unverified_inferences').$type<unknown[]>().notNull(),
    viewpointChange: text('viewpoint_change'),
    evidence: json('evidence').$type<unknown[]>().notNull(),
    uncertainties: json('uncertainties').$type<unknown[]>().notNull(),
    confidence: mysqlEnum('confidence', ['low', 'medium', 'high']).notNull(),
    confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }).notNull(),
    promptVersion: varchar('prompt_version', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 32 }).notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    providerRequestId: varchar('provider_request_id', { length: 255 }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('research_cards_analysis_key_uidx').on(table.analysisKey),
    uniqueIndex('research_cards_content_version_uidx').on(table.contentId, table.version),
  ],
);

export const cardEntities = mysqlTable(
  'card_entities',
  {
    id: id('id').primaryKey(),
    cardId: id('card_id')
      .notNull()
      .references(() => researchCards.id),
    type: mysqlEnum('type', ['company', 'ticker', 'topic']).notNull(),
    normalizedValue: varchar('normalized_value', { length: 255 }).notNull(),
    displayValue: varchar('display_value', { length: 255 }).notNull(),
    verificationStatus: mysqlEnum('verification_status', [
      'verified_source',
      'needs_verification',
      'unverified',
    ]).notNull(),
  },
  (table) => [uniqueIndex('card_entities_card_type_value_uidx').on(table.cardId, table.type, table.normalizedValue)],
);

export const importanceScores = mysqlTable(
  'importance_scores',
  {
    id: id('id').primaryKey(),
    cardId: id('card_id')
      .notNull()
      .references(() => researchCards.id),
    policyVersion: varchar('policy_version', { length: 64 }).notNull(),
    features: json('features').$type<Record<string, number>>().notNull(),
    weights: json('weights').$type<Record<string, number>>().notNull(),
    totalScore: decimal('total_score', { precision: 7, scale: 3 }).notNull(),
    threshold: decimal('threshold', { precision: 7, scale: 3 }).notNull(),
    decision: mysqlEnum('decision', ['notify_candidate', 'suppress']).notNull(),
    reason: varchar('reason', { length: 1000 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex('importance_scores_card_policy_uidx').on(table.cardId, table.policyVersion)],
);

export const notificationDeliveries = mysqlTable(
  'notification_deliveries',
  {
    id: id('id').primaryKey(),
    scoreId: id('score_id')
      .notNull()
      .references(() => importanceScores.id),
    channel: varchar('channel', { length: 32 }).notNull(),
    contentEventKey: varchar('content_event_key', { length: 255 }).notNull(),
    cardVersion: int('card_version').notNull(),
    dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
    policyVersion: varchar('policy_version', { length: 64 }).notNull(),
    status: mysqlEnum('status', deliveryStatuses).notNull(),
    providerId: varchar('provider_id', { length: 255 }),
    errorCode: varchar('error_code', { length: 64 }),
    manualRetryAllowed: boolean('manual_retry_allowed').notNull().default(false),
    createdAt: createdAt(),
    sentAt: datetime('sent_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [
    uniqueIndex('notification_deliveries_dedupe_uidx').on(table.channel, table.dedupeKey),
    uniqueIndex('notification_deliveries_user_event_uidx').on(
      table.channel,
      table.contentEventKey,
      table.cardVersion,
      table.policyVersion,
    ),
  ],
);

export const notificationAttempts = mysqlTable(
  'notification_attempts',
  {
    id: id('id').primaryKey(),
    deliveryId: id('delivery_id')
      .notNull()
      .references(() => notificationDeliveries.id),
    attempt: int('attempt').notNull(),
    status: mysqlEnum('status', deliveryStatuses).notNull(),
    providerRequestId: varchar('provider_request_id', { length: 255 }),
    errorCode: varchar('error_code', { length: 64 }),
    startedAt: datetime('started_at', { mode: 'date', fsp: 3 }).notNull(),
    finishedAt: datetime('finished_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [uniqueIndex('notification_attempts_delivery_attempt_uidx').on(table.deliveryId, table.attempt)],
);

export const notificationRecoveryRequests = mysqlTable(
  'notification_recovery_requests',
  {
    id: id('id').primaryKey(),
    deliveryId: id('delivery_id')
      .notNull()
      .references(() => notificationDeliveries.id),
    actorId: varchar('actor_id', { length: 64 }).notNull(),
    previousStatus: mysqlEnum('previous_status', ['blocked', 'dead_letter']).notNull(),
    requestedAt: datetime('requested_at', { mode: 'date', fsp: 3 }).notNull(),
  },
  (table) => [index('notification_recovery_delivery_time_idx').on(table.deliveryId, table.requestedAt)],
);

export const userFeedback = mysqlTable(
  'user_feedback',
  {
    id: id('id').primaryKey(),
    cardId: id('card_id')
      .notNull()
      .references(() => researchCards.id),
    cardVersion: int('card_version').notNull(),
    actorId: varchar('actor_id', { length: 64 }).notNull(),
    type: mysqlEnum('type', [
      'important',
      'known',
      'irrelevant',
      'follow',
      'translation_error',
      'analysis_error',
    ]).notNull(),
    note: varchar('note', { length: 1000 }),
    createdAt: createdAt(),
  },
  (table) => [index('user_feedback_card_actor_idx').on(table.cardId, table.actorId, table.createdAt)],
);

export const externalUsage = mysqlTable(
  'external_usage',
  {
    id: id('id').primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    operation: varchar('operation', { length: 64 }).notNull(),
    apiVersion: varchar('api_version', { length: 128 }),
    protocol: varchar('protocol', { length: 32 }),
    providerHost: varchar('provider_host', { length: 255 }),
    requestedModel: varchar('requested_model', { length: 128 }),
    model: varchar('model', { length: 128 }),
    providerRequestId: varchar('provider_request_id', { length: 255 }),
    requestId: varchar('request_id', { length: 255 }),
    status: varchar('status', { length: 32 }).notNull(),
    inputUnits: bigint('input_units', { mode: 'number', unsigned: true }).notNull().default(0),
    outputUnits: bigint('output_units', { mode: 'number', unsigned: true }).notNull().default(0),
    resourceUnits: bigint('resource_units', { mode: 'number', unsigned: true }).notNull().default(0),
    costCents: decimal('cost_cents', { precision: 12, scale: 4 }).notNull().default('0'),
    pricingVersion: varchar('pricing_version', { length: 64 }),
    promptVersion: varchar('prompt_version', { length: 64 }),
    schemaVersion: varchar('schema_version', { length: 64 }),
    probeVersion: varchar('probe_version', { length: 32 }),
    occurredAt: datetime('occurred_at', { mode: 'date', fsp: 3 }).notNull(),
  },
  (table) => [index('external_usage_provider_time_idx').on(table.provider, table.occurredAt)],
);

export const budgetReservations = mysqlTable(
  'budget_reservations',
  {
    id: id('id').primaryKey(),
    provider: varchar('provider', { length: 32 }).notNull(),
    budgetDate: varchar('budget_date', { length: 10 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    reservedCents: decimal('reserved_cents', { precision: 12, scale: 4 }).notNull(),
    settledCents: decimal('settled_cents', { precision: 12, scale: 4 }),
    status: mysqlEnum('status', ['reserved', 'settled', 'released']).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('budget_reservations_provider_key_uidx').on(table.provider, table.idempotencyKey),
    index('budget_reservations_daily_idx').on(table.provider, table.budgetDate, table.status),
  ],
);

export const workerHeartbeats = mysqlTable('worker_heartbeats', {
  workerId: varchar('worker_id', { length: 128 }).primaryKey(),
  startedAt: datetime('started_at', { mode: 'date', fsp: 3 }).notNull(),
  heartbeatAt: datetime('heartbeat_at', { mode: 'date', fsp: 3 }).notNull(),
  status: mysqlEnum('status', ['starting', 'ready', 'stopping']).notNull(),
  version: varchar('version', { length: 64 }).notNull(),
});

export const businessSchema = {
  sourceAccounts,
  sourceSyncStates,
  ingestionRuns,
  contentItems,
  contentVersions,
  contentLifecycleEvents,
  contentRelations,
  processingIntents,
  processingAttempts,
  researchCards,
  cardEntities,
  importanceScores,
  notificationDeliveries,
  notificationAttempts,
  notificationRecoveryRequests,
  userFeedback,
  externalUsage,
  budgetReservations,
  workerHeartbeats,
};

export const schema = businessSchema;
