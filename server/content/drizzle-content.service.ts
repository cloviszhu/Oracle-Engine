import { sql, type SQL } from 'drizzle-orm';
import type { createDatabase } from '../infrastructure/database/client.js';
import {
  decodeContentCursor,
  encodeContentCursor,
  type ContentQuery,
} from './content-query.js';

type Database = ReturnType<typeof createDatabase>;

export class DrizzleContentService {
  constructor(private readonly database: Database) {}

  async list(query: ContentQuery) {
    const conditions: SQL[] = [sql`c.visibility = 'active'`];
    if (query.keyword) {
      const keyword = `%${query.keyword}%`;
      conditions.push(sql`(v.body LIKE ${keyword} OR rc.translation LIKE ${keyword})`);
    }
    if (query.ticker) conditions.push(sql`EXISTS (
      SELECT 1 FROM card_entities ce
      WHERE ce.card_id = rc.id AND ce.type = 'ticker' AND ce.normalized_value = ${query.ticker.toLocaleLowerCase('en-US')}
    )`);
    if (query.topic) conditions.push(sql`EXISTS (
      SELECT 1 FROM card_entities ce
      WHERE ce.card_id = rc.id AND ce.type = 'topic' AND ce.normalized_value = ${query.topic.toLocaleLowerCase('en-US')}
    )`);
    if (query.importance === 'candidate') conditions.push(sql`iscore.decision = 'notify_candidate'`);
    if (query.importance === 'suppressed') conditions.push(sql`iscore.decision = 'suppress'`);
    if (query.contentType) conditions.push(sql`c.content_type = ${query.contentType}`);
    if (query.dateFrom) conditions.push(sql`c.published_at >= ${new Date(query.dateFrom)}`);
    if (query.dateTo) conditions.push(sql`c.published_at <= ${new Date(query.dateTo)}`);
    if (query.cursor) {
      const cursor = decodeContentCursor(query.cursor);
      const publishedAt = new Date(cursor.publishedAt);
      if (query.sort === 'published_desc') {
        conditions.push(sql`(c.published_at < ${publishedAt} OR (c.published_at = ${publishedAt} AND c.id < ${cursor.id}))`);
      } else if (query.sort === 'published_asc') {
        conditions.push(sql`(c.published_at > ${publishedAt} OR (c.published_at = ${publishedAt} AND c.id > ${cursor.id}))`);
      } else {
        if (cursor.importanceScore === undefined) throw new Error('importance cursor requires a score');
        conditions.push(sql`(
          iscore.total_score < ${cursor.importanceScore}
          OR (iscore.total_score = ${cursor.importanceScore} AND c.published_at < ${publishedAt})
          OR (iscore.total_score = ${cursor.importanceScore} AND c.published_at = ${publishedAt} AND c.id < ${cursor.id})
        )`);
      }
    }
    const order = query.sort === 'published_asc'
      ? sql`c.published_at ASC, c.id ASC`
      : query.sort === 'importance_desc'
        ? sql`iscore.total_score DESC, c.published_at DESC, c.id DESC`
        : sql`c.published_at DESC, c.id DESC`;
    const result = await this.database.execute(sql`
      SELECT c.id, c.external_id, c.source_url, c.content_type, c.published_at,
             v.body, rc.id AS card_id, rc.translation, rc.confidence,
             iscore.total_score AS importance_score, iscore.decision
      FROM content_items c
      JOIN content_versions v ON v.id = c.current_version_id
      LEFT JOIN research_cards rc ON rc.content_version_id = v.id
      LEFT JOIN importance_scores iscore ON iscore.card_id = rc.id
      WHERE ${sql.join(conditions, sql` AND `)}
      ORDER BY ${order}
      LIMIT ${query.limit + 1}
    `);
    const rows = rowsOf(result);
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last
        ? encodeContentCursor({
            publishedAt: new Date(String(last.published_at)).toISOString(),
            id: String(last.id),
            ...(query.sort === 'importance_desc'
              ? { importanceScore: Number(last.importance_score) }
              : {}),
          })
        : undefined,
    };
  }

  timeline(query: ContentQuery) {
    return this.list({ ...query, sort: 'published_desc' });
  }

  async detail(id: string) {
    const [detailResult, relationsResult, deliveriesResult] = await Promise.all([
      this.database.execute(sql`
        SELECT c.id, c.external_id, c.source_url, c.content_type, c.visibility, c.published_at,
               v.body, rc.id AS card_id, rc.version AS card_version, rc.translation,
               rc.author_judgment, rc.others_content, rc.ai_explanation,
               rc.unverified_inferences, rc.viewpoint_change, rc.evidence, rc.uncertainties,
               rc.confidence, rc.confidence_score, iscore.total_score AS importance_score,
               iscore.decision, iscore.reason
        FROM content_items c
        LEFT JOIN content_versions v ON v.id = c.current_version_id
        LEFT JOIN research_cards rc ON rc.content_version_id = v.id
        LEFT JOIN importance_scores iscore ON iscore.card_id = rc.id
        WHERE c.id = ${id}
        LIMIT 1
      `),
      this.database.execute(sql`
        SELECT relation_type, to_content_id, to_external_id, missing_reason
        FROM content_relations WHERE from_content_id = ${id}
      `),
      this.database.execute(sql`
        SELECT nd.channel, nd.status, nd.sent_at, nd.error_code
        FROM notification_deliveries nd
        JOIN importance_scores iscore ON iscore.id = nd.score_id
        JOIN research_cards rc ON rc.id = iscore.card_id
        WHERE rc.content_id = ${id}
      `),
    ]);
    const detail = rowsOf(detailResult)[0];
    if (!detail) throw new Error('content_not_found');
    return {
      ...detail,
      context: rowsOf(relationsResult),
      contextCompleteness: rowsOf(relationsResult).some((row) => row.missing_reason)
        ? 'partial'
        : 'complete',
      notifications: rowsOf(deliveriesResult),
    };
  }
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(result) || !Array.isArray(result[0])) return [];
  return result[0].filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object');
}
