import type { ResearchEnvelope } from './research-contract.js';
import type {
  ResearchModelAdapter,
  ResearchModelResult,
} from './research-model.adapter.js';

export interface ResearchAnalysisRepository {
  findSucceeded(analysisKey: string): Promise<unknown | undefined>;
  saveSucceeded(target: ResearchAnalysisTarget, result: ResearchModelResult): Promise<unknown>;
}

export interface ResearchAnalysisTarget {
  analysisKey: string;
  contentId: string;
  contentVersionId: string;
  cardVersion: number;
  promptVersion: string;
}

export type BudgetReservation =
  | { allowed: true; reservationId: string }
  | { allowed: false; reason: 'budget' | 'rate_limit' | 'in_progress' };

export interface ResearchBudgetGuard {
  reserve(input: {
    analysisKey: string;
    estimatedCostCents: number;
  }): Promise<BudgetReservation>;
  settle(reservationId: string, actualCostCents: number): Promise<void>;
  release(reservationId: string): Promise<void>;
}

export class ResearchAnalysisService {
  constructor(
    private readonly repository: ResearchAnalysisRepository,
    private readonly budget: ResearchBudgetGuard,
    private readonly adapter: ResearchModelAdapter,
  ) {}

  async analyze(input: ResearchAnalysisTarget & {
    envelope: ResearchEnvelope;
    estimatedCostCents: number;
  }): Promise<
    | { status: 'reused'; value: unknown }
    | { status: 'blocked'; reason: 'budget' | 'rate_limit' | 'in_progress' }
    | { status: 'created'; value: unknown }
  > {
    const existing = await this.repository.findSucceeded(input.analysisKey);
    if (existing !== undefined) return { status: 'reused', value: existing };

    const reservation = await this.budget.reserve({
      analysisKey: input.analysisKey,
      estimatedCostCents: input.estimatedCostCents,
    });
    if (!reservation.allowed) return { status: 'blocked', reason: reservation.reason };

    try {
      const result = await this.adapter.analyze(input.envelope);
      const target: ResearchAnalysisTarget = {
        analysisKey: input.analysisKey,
        contentId: input.contentId,
        contentVersionId: input.contentVersionId,
        cardVersion: input.cardVersion,
        promptVersion: input.promptVersion,
      };
      const value = await this.repository.saveSucceeded(target, result);
      await this.budget.settle(reservation.reservationId, result.costCents);
      return { status: 'created', value };
    } catch (error) {
      await this.budget.release(reservation.reservationId);
      throw error;
    }
  }
}
