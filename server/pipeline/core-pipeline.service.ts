import {
  scoreImportance,
  type ImportanceFeatures,
  type ImportancePolicy,
  type ImportanceScoreFact,
} from '../importance/importance-scorer.js';

export interface CoreContentEvent {
  eventKey: string;
  sourceId: string;
  contentType: 'post' | 'reply' | 'quote';
  text: string;
}

export interface CoreArchiveResult {
  status: 'created' | 'revision' | 'duplicate';
  contentId: string;
  contentVersionId: string;
  existingCardId?: string;
}

export interface CoreContextResult {
  completeness: 'complete' | 'partial';
  missing: string[];
}

export interface CoreAnalysisResult {
  cardId: string;
  confidenceScore: number;
  features: ImportanceFeatures;
}

export interface CorePipelinePorts {
  archive(event: CoreContentEvent): Promise<CoreArchiveResult>;
  buildContext(archive: CoreArchiveResult, event: CoreContentEvent): Promise<CoreContextResult>;
  analyze(input: {
    archive: CoreArchiveResult;
    event: CoreContentEvent;
    context: CoreContextResult;
  }): Promise<CoreAnalysisResult>;
  publishToWeb(input: {
    archive: CoreArchiveResult;
    analysis: CoreAnalysisResult;
    context: CoreContextResult;
    importance: ImportanceScoreFact;
  }): Promise<unknown>;
  saveImportanceFact(fact: ImportanceScoreFact): Promise<unknown>;
  saveNotificationCandidate(fact: ImportanceScoreFact): Promise<unknown>;
  enqueueNotification(fact: ImportanceScoreFact): Promise<unknown>;
  recordNotificationFailure(input: { cardId: string; errorCode: string }): Promise<unknown>;
  recordFailure(input: {
    contentId: string;
    contentVersionId: string;
    stage: 'context' | 'analysis' | 'publish';
    retryable: boolean;
    errorCode: string;
  }): Promise<unknown>;
}

export class CorePipelineService {
  constructor(
    private readonly ports: CorePipelinePorts,
    private readonly options: {
      notificationsEnabled: boolean;
      importancePolicy: ImportancePolicy;
    },
  ) {}

  async process(event: CoreContentEvent): Promise<
    | { status: 'reused'; cardId: string; searchable: true }
    | {
      status: 'published';
      cardId: string;
      contentVersionId: string;
      searchable: true;
      contextCompleteness: CoreContextResult['completeness'];
      importanceDecision: ImportanceScoreFact['decision'];
      notificationStatus: 'not_candidate' | 'disabled' | 'queued' | 'failed';
    }
  > {
    const archive = await this.ports.archive(event);
    if (archive.status === 'duplicate' && archive.existingCardId) {
      return { status: 'reused', cardId: archive.existingCardId, searchable: true };
    }

    let context: CoreContextResult;
    try {
      context = await this.ports.buildContext(archive, event);
    } catch (error) {
      await this.recordStageFailure(archive, 'context', error);
      throw error;
    }

    let analysis: CoreAnalysisResult;
    try {
      analysis = await this.ports.analyze({ archive, event, context });
    } catch (error) {
      await this.recordStageFailure(archive, 'analysis', error);
      throw error;
    }

    const importance = scoreImportance({
      cardId: analysis.cardId,
      confidenceScore: analysis.confidenceScore,
      features: analysis.features,
    }, this.options.importancePolicy);

    try {
      await this.ports.publishToWeb({ archive, analysis, context, importance });
      await this.ports.saveImportanceFact(importance);
      if (importance.decision === 'notify_candidate') {
        await this.ports.saveNotificationCandidate(importance);
      }
    } catch (error) {
      await this.recordStageFailure(archive, 'publish', error);
      throw error;
    }

    let notificationStatus: 'not_candidate' | 'disabled' | 'queued' | 'failed' =
      importance.decision === 'notify_candidate'
      ? 'disabled' as const
      : 'not_candidate' as const;
    if (importance.decision === 'notify_candidate' && this.options.notificationsEnabled) {
      try {
        await this.ports.enqueueNotification(importance);
        notificationStatus = 'queued';
      } catch (error) {
        notificationStatus = 'failed';
        await this.ports.recordNotificationFailure({
          cardId: analysis.cardId,
          errorCode: error instanceof Error && error.name ? error.name : 'UnknownError',
        }).catch(() => undefined);
      }
    }

    return {
      status: 'published',
      cardId: analysis.cardId,
      contentVersionId: archive.contentVersionId,
      searchable: true,
      contextCompleteness: context.completeness,
      importanceDecision: importance.decision,
      notificationStatus,
    };
  }

  private async recordStageFailure(
    archive: CoreArchiveResult,
    stage: 'context' | 'analysis' | 'publish',
    error: unknown,
  ): Promise<void> {
    await this.ports.recordFailure({
      contentId: archive.contentId,
      contentVersionId: archive.contentVersionId,
      stage,
      retryable: true,
      errorCode: error instanceof Error && error.name ? error.name : 'UnknownError',
    });
  }
}
