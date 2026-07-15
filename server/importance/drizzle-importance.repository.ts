import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { importanceScores } from '../../drizzle/schema.js';
import type { createDatabase } from '../infrastructure/database/client.js';
import type { ImportanceScoreFact } from './importance-scorer.js';

type Database = ReturnType<typeof createDatabase>;

export function toImportanceScoreRecord(
  id: string,
  fact: ImportanceScoreFact,
  createdAt: Date,
) {
  return {
    id,
    cardId: fact.cardId,
    policyVersion: fact.policyVersion,
    features: { ...fact.features },
    weights: { ...fact.weights },
    totalScore: fact.totalScore.toFixed(3),
    threshold: fact.threshold.toFixed(3),
    decision: fact.decision,
    reason: fact.reason,
    createdAt,
  };
}

export class DrizzleImportanceScoreRepository {
  constructor(private readonly database: Database) {}

  async save(fact: ImportanceScoreFact): Promise<unknown> {
    return this.database.transaction(async (transaction) => {
      await transaction
        .insert(importanceScores)
        .values(toImportanceScoreRecord(randomUUID(), fact, new Date()))
        .onDuplicateKeyUpdate({ set: { policyVersion: fact.policyVersion } });
      const [record] = await transaction
        .select()
        .from(importanceScores)
        .where(and(
          eq(importanceScores.cardId, fact.cardId),
          eq(importanceScores.policyVersion, fact.policyVersion),
        ))
        .limit(1);
      if (!record) throw new Error('Importance score persistence did not return a record');
      return record;
    });
  }
}
