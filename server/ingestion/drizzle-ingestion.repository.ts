import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  contentItems,
  contentLifecycleEvents,
  contentRelations,
  contentVersions,
  externalUsage,
  ingestionRuns,
  processingIntents,
  researchCards,
  sourceAccounts,
  sourceSyncStates,
} from '../../drizzle/schema.js';
import type { createDatabase } from '../infrastructure/database/client.js';
import type { XContentPage, XNormalizedContent } from '../infrastructure/x/content-source.adapter.js';
import { XProviderError } from '../infrastructure/x/x-api.client.js';
import { computePayloadHash } from './content-lifecycle.js';
import { compareXIds } from './poll-source.service.js';

type Database = ReturnType<typeof createDatabase>;

function contentId(externalId: string): string {
  return `x--${externalId}`;
}

function requiredPublishedAt(item: XNormalizedContent): Date {
  if (!item.createdAt) {
    throw new XProviderError('provider_unavailable', true, 200);
  }
  const date = new Date(item.createdAt);
  if (Number.isNaN(date.getTime())) {
    throw new XProviderError('provider_unavailable', true, 200);
  }
  return date;
}

function affectedRows(result: unknown): number {
  if (!Array.isArray(result)) return 0;
  const header = result[0];
  if (header !== null && typeof header === 'object' && 'affectedRows' in header) {
    return Number((header as { affectedRows: unknown }).affectedRows);
  }
  return 0;
}

export class DrizzleIngestionRepository {
  constructor(
    private readonly database: Database,
    private readonly maxRawPayloadBytes: number,
  ) {}

  async upsertStableAccount(input: {
    provider: 'x';
    externalUserId: string;
    username: string;
    displayName?: string;
  }): Promise<string> {
    const sourceId = `source--${input.provider}--${input.externalUserId}`;
    const now = new Date();
    await this.database.transaction(async (transaction) => {
      await transaction
        .insert(sourceAccounts)
        .values({
          id: sourceId,
          provider: input.provider,
          externalUserId: input.externalUserId,
          username: input.username,
          displayName: input.displayName,
          enabled: false,
          createdAt: now,
          updatedAt: now,
        })
        .onDuplicateKeyUpdate({
          set: { username: input.username, displayName: input.displayName, updatedAt: now },
        });
      await transaction
        .insert(sourceSyncStates)
        .values({ sourceAccountId: sourceId, status: 'idle', updatedAt: now })
        .onDuplicateKeyUpdate({ set: { updatedAt: now } });
    });
    return sourceId;
  }

  async beginRun(input: { sourceId: string; mode: 'poll' | 'compensation' }): Promise<string> {
    const runId = randomUUID();
    await this.database.insert(ingestionRuns).values({
      id: runId,
      sourceAccountId: input.sourceId,
      mode: input.mode,
      status: 'processing',
      correlationId: randomUUID(),
      startedAt: new Date(),
    });
    return runId;
  }

  async persistPage(input: { runId: string; sourceId: string; page: XContentPage }): Promise<void> {
    await this.persistObservedPage({
      sourceId: input.sourceId,
      page: input.page,
      operation: 'get_user_posts',
    });
  }

  async persistLookupPage(page: XContentPage): Promise<void> {
    await this.persistObservedPage({ page, operation: 'lookup_posts' });
  }

  private async persistObservedPage(input: {
    sourceId?: string;
    page: XContentPage;
    operation: 'get_user_posts' | 'lookup_posts';
  }): Promise<void> {
    const fetchedAt = new Date();
    const primaryIds = new Set(input.page.items.map((item) => item.id));
    const allItems = new Map<string, XNormalizedContent>();
    for (const item of [...input.page.included, ...input.page.items]) allItems.set(item.id, item);

    await this.database.transaction(async (transaction) => {
      for (const item of allItems.values()) {
        const rawPayloadBytes = Buffer.byteLength(JSON.stringify(item.raw), 'utf8');
        if (rawPayloadBytes > this.maxRawPayloadBytes) {
          throw new Error('X payload exceeds MAX_RAW_PAYLOAD_BYTES');
        }
        const internalContentId = contentId(item.id);
        const payloadHash = computePayloadHash(item.raw);
        const publishedAt = requiredPublishedAt(item);
        const sourceUrl = `https://x.com/i/web/status/${item.id}`;
        await transaction
          .insert(contentItems)
          .values({
            id: internalContentId,
            provider: 'x',
            externalId: item.id,
            sourceAccountId: primaryIds.has(item.id) ? input.sourceId ?? null : null,
            authorExternalId: item.authorId,
            sourceUrl,
            contentType: item.replyToId ? 'reply' : item.quoteIds.length > 0 ? 'quote' : 'post',
            visibility: 'active',
            firstObservedAt: fetchedAt,
            lastObservedAt: fetchedAt,
            publishedAt,
          })
          .onDuplicateKeyUpdate({
            set: {
              authorExternalId: item.authorId,
              sourceUrl,
              visibility: 'active',
              lastObservedAt: fetchedAt,
            },
          });

        const [existing] = await transaction
          .select({ id: contentVersions.id, version: contentVersions.version })
          .from(contentVersions)
          .where(
            and(
              eq(contentVersions.contentId, internalContentId),
              eq(contentVersions.payloadHash, payloadHash),
            ),
          )
          .limit(1);
        if (existing) continue;

        const [latest] = await transaction
          .select({ id: contentVersions.id, version: contentVersions.version })
          .from(contentVersions)
          .where(eq(contentVersions.contentId, internalContentId))
          .orderBy(desc(contentVersions.version))
          .limit(1);
        const versionId = randomUUID();
        const version = (latest?.version ?? 0) + 1;
        await transaction.insert(contentVersions).values({
          id: versionId,
          contentId: internalContentId,
          version,
          externalEditId: item.editHistoryIds.at(-1),
          payloadHash,
          body: item.text,
          rawPayload: item.raw,
          rawPayloadBytes,
          providerRequestId: input.page.providerRequestId,
          publishedAt,
          fetchedAt,
        });
        await transaction
          .update(contentItems)
          .set({ currentVersionId: versionId, visibility: 'active', lastObservedAt: fetchedAt })
          .where(eq(contentItems.id, internalContentId));
        if (latest) {
          await transaction.insert(contentLifecycleEvents).values({
            id: randomUUID(),
            contentId: internalContentId,
            fromVisibility: 'active',
            toVisibility: 'active',
            evidenceCategory: 'provider_edit',
            providerRequestId: input.page.providerRequestId,
            occurredAt: fetchedAt,
            confirmedAt: fetchedAt,
          });
        }

        for (const relation of [
          ...(item.replyToId ? [{ type: 'reply_to' as const, id: item.replyToId }] : []),
          ...item.quoteIds.map((id) => ({ type: 'quotes' as const, id })),
        ]) {
          await transaction
            .insert(contentRelations)
            .values({
              id: randomUUID(),
              fromContentId: internalContentId,
              relationType: relation.type,
              toContentId: allItems.has(relation.id) ? contentId(relation.id) : null,
              toExternalId: relation.id,
              missingReason: allItems.has(relation.id) ? null : 'not_returned_by_provider',
              createdAt: fetchedAt,
            })
            .onDuplicateKeyUpdate({
              set: {
                toContentId: allItems.has(relation.id) ? contentId(relation.id) : null,
                missingReason: allItems.has(relation.id) ? null : 'not_returned_by_provider',
              },
            });
        }

        if (input.sourceId && primaryIds.has(item.id)) {
          const idempotencyKey = `${internalContentId}--${payloadHash}`;
          await transaction
            .insert(processingIntents)
            .values({
              id: randomUUID(),
              contentId: internalContentId,
              contentVersionId: versionId,
              stage: 'context',
              idempotencyKey,
              status: 'pending',
              availableAt: fetchedAt,
              createdAt: fetchedAt,
              updatedAt: fetchedAt,
            })
            .onDuplicateKeyUpdate({ set: { updatedAt: fetchedAt } });
        }
      }

      await transaction.insert(externalUsage).values({
        id: randomUUID(),
        provider: 'x',
        operation: input.operation,
        apiVersion: '2',
        providerRequestId: input.page.providerRequestId,
        status: 'succeeded',
        resourceUnits: input.page.items.length + input.page.included.length,
        occurredAt: fetchedAt,
      });
    });
  }

  async completeRunAndAdvanceCursor(input: {
    runId: string;
    sourceId: string;
    expectedSinceId?: string;
    nextSinceId?: string;
    pages: number;
    items: number;
  }): Promise<boolean> {
    const now = new Date();
    let cursorAdvanced = false;
    if (
      input.nextSinceId &&
      (!input.expectedSinceId || compareXIds(input.nextSinceId, input.expectedSinceId) > 0)
    ) {
      const expected = input.expectedSinceId
        ? sql`since_id = ${input.expectedSinceId}`
        : sql`since_id IS NULL`;
      const result = await this.database.execute(sql`
        UPDATE source_sync_states
        SET since_id = ${input.nextSinceId}, last_success_at = ${now}, status = 'idle',
            error_code = NULL, updated_at = ${now}
        WHERE source_account_id = ${input.sourceId} AND ${expected}
      `);
      cursorAdvanced = affectedRows(result) === 1;
    } else {
      await this.database
        .update(sourceSyncStates)
        .set({ lastSuccessAt: now, status: 'idle', errorCode: null, updatedAt: now })
        .where(eq(sourceSyncStates.sourceAccountId, input.sourceId));
    }
    await this.database
      .update(ingestionRuns)
      .set({ status: 'succeeded', pages: input.pages, items: input.items, finishedAt: now })
      .where(eq(ingestionRuns.id, input.runId));
    return cursorAdvanced;
  }

  async failRun(runId: string, error: unknown): Promise<void> {
    const errorCode = error instanceof XProviderError ? `x_${error.category}` : 'internal_error';
    const status = error instanceof XProviderError && !error.retryable ? 'blocked' : 'retryable_failed';
    await this.database
      .update(ingestionRuns)
      .set({ status, errorCode, finishedAt: new Date() })
      .where(eq(ingestionRuns.id, runId));
  }

  async markVerificationPending(internalContentId: string): Promise<void> {
    const now = new Date();
    await this.database.transaction(async (transaction) => {
      await transaction
        .update(contentItems)
        .set({ visibility: 'verification_pending', lastObservedAt: now })
        .where(eq(contentItems.id, internalContentId));
      await transaction.insert(contentLifecycleEvents).values({
        id: randomUUID(),
        contentId: internalContentId,
        fromVisibility: 'active',
        toVisibility: 'verification_pending',
        evidenceCategory: 'provider_missing_unconfirmed',
        occurredAt: now,
      });
    });
  }

  async applyTombstone(
    internalContentId: string,
    visibility: 'deleted' | 'unavailable',
  ): Promise<void> {
    const now = new Date();
    await this.database.transaction(async (transaction) => {
      await transaction
        .update(contentVersions)
        .set({ body: null, rawPayload: null, rawPayloadBytes: 0, clearedAt: now })
        .where(eq(contentVersions.contentId, internalContentId));
      await transaction
        .update(researchCards)
        .set({
          translation: '[内容按平台政策清除]',
          authorJudgment: [],
          othersContent: [],
          aiExplanation: [],
          unverifiedInferences: [],
          viewpointChange: null,
          evidence: [],
          uncertainties: ['内容已删除或不可访问'],
        })
        .where(eq(researchCards.contentId, internalContentId));
      await transaction
        .update(contentItems)
        .set({ visibility, lastObservedAt: now })
        .where(eq(contentItems.id, internalContentId));
      await transaction.insert(contentLifecycleEvents).values({
        id: randomUUID(),
        contentId: internalContentId,
        fromVisibility: 'verification_pending',
        toVisibility: visibility,
        evidenceCategory: 'provider_removal_confirmed',
        occurredAt: now,
        confirmedAt: now,
      });
    });
  }
}
