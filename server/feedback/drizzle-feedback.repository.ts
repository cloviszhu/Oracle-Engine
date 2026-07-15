import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { researchCards, userFeedback } from '../../drizzle/schema.js';
import type { createDatabase } from '../infrastructure/database/client.js';
import type { FeedbackAppend } from './feedback.service.js';

type Database = ReturnType<typeof createDatabase>;

export class DrizzleFeedbackRepository {
  constructor(private readonly database: Database) {}

  async append(feedback: FeedbackAppend): Promise<unknown> {
    const [card] = await this.database
      .select({ id: researchCards.id })
      .from(researchCards)
      .where(and(
        eq(researchCards.id, feedback.cardId),
        eq(researchCards.version, feedback.cardVersion),
      ))
      .limit(1);
    if (!card) throw new Error('card_not_found');
    const record = {
      id: randomUUID(),
      cardId: feedback.cardId,
      cardVersion: feedback.cardVersion,
      actorId: feedback.actorId,
      type: feedback.type,
      note: feedback.note,
      createdAt: feedback.createdAt,
    };
    await this.database.insert(userFeedback).values(record);
    return record;
  }
}
