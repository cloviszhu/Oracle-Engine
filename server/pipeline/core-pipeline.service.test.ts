import { describe, expect, it, vi } from 'vitest';
import { CorePipelineService, type CorePipelinePorts } from './core-pipeline.service.js';

const highFeatures = {
  industryRelevance: 90,
  novelty: 85,
  viewpointChange: 80,
  evidenceQuality: 90,
  timelinessCatalyst: 85,
  uncertaintyPenalty: 5,
};
const lowFeatures = {
  industryRelevance: 10,
  novelty: 10,
  viewpointChange: 0,
  evidenceQuality: 20,
  timelinessCatalyst: 5,
  uncertaintyPenalty: 10,
};

function fixture(options: {
  duplicate?: boolean;
  revision?: boolean;
  missingContext?: boolean;
  analysisFailure?: Error;
  notificationsEnabled?: boolean;
  features?: typeof highFeatures;
} = {}) {
  const calls: string[] = [];
  const ports: CorePipelinePorts = {
    archive: vi.fn(async () => {
      calls.push('archive');
      return {
        status: options.duplicate ? 'duplicate' : options.revision ? 'revision' : 'created',
        contentId: 'content-1',
        contentVersionId: options.revision ? 'version-2' : 'version-1',
        ...(options.duplicate ? { existingCardId: 'card-existing' } : {}),
      };
    }),
    buildContext: vi.fn(async () => {
      calls.push('context');
      return {
        completeness: options.missingContext ? 'partial' : 'complete',
        missing: options.missingContext ? ['quoted-post-not-archived'] : [],
      };
    }),
    analyze: vi.fn(async () => {
      calls.push('analysis');
      if (options.analysisFailure) throw options.analysisFailure;
      return {
        cardId: options.revision ? 'card-2' : 'card-1',
        confidenceScore: 0.9,
        features: options.features ?? highFeatures,
      };
    }),
    publishToWeb: vi.fn(async () => calls.push('web')),
    saveImportanceFact: vi.fn(async () => calls.push('importance')),
    saveNotificationCandidate: vi.fn(async () => calls.push('candidate')),
    enqueueNotification: vi.fn(async () => calls.push('delivery')),
    recordFailure: vi.fn(async () => calls.push('failure')),
  };
  return {
    calls,
    ports,
    service: new CorePipelineService(ports, {
      notificationsEnabled: options.notificationsEnabled ?? false,
      importancePolicy: {
        version: 'importance-v1',
        threshold: 70,
        minimumConfidence: 0.7,
        weights: {
          industryRelevance: 0.25,
          novelty: 0.2,
          viewpointChange: 0.15,
          evidenceQuality: 0.2,
          timelinessCatalyst: 0.2,
          uncertaintyPenalty: 0.2,
        },
      },
    }),
  };
}

describe('core acquisition-to-private-web pipeline', () => {
  it.each(['post', 'reply', 'quote'] as const)(
    'archives and publishes a high-value %s while notification is disabled',
    async (contentType) => {
      const { service, ports, calls } = fixture();
      const result = await service.process({
        eventKey: `event-${contentType}`,
        sourceId: `source-${contentType}`,
        contentType,
        text: 'untrusted external content',
      });

      expect(result).toMatchObject({ status: 'published', searchable: true, contextCompleteness: 'complete' });
      expect(ports.saveNotificationCandidate).toHaveBeenCalledOnce();
      expect(ports.enqueueNotification).not.toHaveBeenCalled();
      expect(calls).toEqual(['archive', 'context', 'analysis', 'web', 'importance', 'candidate']);
    },
  );

  it('keeps low-value content searchable without producing a candidate or delivery', async () => {
    const { service, ports } = fixture({ features: lowFeatures });
    const result = await service.process({
      eventKey: 'low', sourceId: 'low', contentType: 'post', text: 'ordinary update',
    });
    expect(result).toMatchObject({ status: 'published', searchable: true, importanceDecision: 'suppress' });
    expect(ports.publishToWeb).toHaveBeenCalledOnce();
    expect(ports.saveNotificationCandidate).not.toHaveBeenCalled();
    expect(ports.enqueueNotification).not.toHaveBeenCalled();
  });

  it('returns the durable result for duplicate input, including after a process restart', async () => {
    const firstProcess = fixture({ duplicate: true });
    const secondProcess = new CorePipelineService(firstProcess.ports, {
      notificationsEnabled: false,
      importancePolicy: {
        version: 'importance-v1', threshold: 70, minimumConfidence: 0.7,
        weights: { industryRelevance: 0.25, novelty: 0.2, viewpointChange: 0.15, evidenceQuality: 0.2, timelinessCatalyst: 0.2, uncertaintyPenalty: 0.2 },
      },
    });
    await expect(secondProcess.process({
      eventKey: 'same', sourceId: 'same', contentType: 'post', text: 'same',
    })).resolves.toEqual({ status: 'reused', cardId: 'card-existing', searchable: true });
    expect(firstProcess.calls).toEqual(['archive']);
  });

  it('creates a new archived card version for an edited source event', async () => {
    const { service, ports } = fixture({ revision: true });
    const result = await service.process({
      eventKey: 'edit-2', sourceId: 'source-1', contentType: 'post', text: 'edited',
    });
    expect(result).toMatchObject({ status: 'published', cardId: 'card-2', contentVersionId: 'version-2' });
    expect(ports.publishToWeb).toHaveBeenCalledOnce();
  });

  it('preserves missing-context evidence instead of silently treating it as complete', async () => {
    const { service, ports } = fixture({ missingContext: true });
    const result = await service.process({
      eventKey: 'missing', sourceId: 'missing', contentType: 'quote', text: 'quoted source missing',
    });
    expect(result).toMatchObject({ status: 'published', contextCompleteness: 'partial' });
    expect(ports.publishToWeb).toHaveBeenCalledWith(expect.objectContaining({
      context: { completeness: 'partial', missing: ['quoted-post-not-archived'] },
    }));
  });

  it('keeps the archive and records a visible stage failure when the model fails', async () => {
    const failure = new Error('provider unavailable');
    const { service, ports } = fixture({ analysisFailure: failure });
    await expect(service.process({
      eventKey: 'failed', sourceId: 'failed', contentType: 'reply', text: 'failed analysis',
    })).rejects.toThrow('provider unavailable');
    expect(ports.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      contentId: 'content-1', stage: 'analysis', retryable: true,
    }));
    expect(ports.publishToWeb).not.toHaveBeenCalled();
  });

  it('only creates a delivery after durable candidate storage when notifications are enabled', async () => {
    const { service, calls } = fixture({ notificationsEnabled: true });
    await service.process({
      eventKey: 'enabled', sourceId: 'enabled', contentType: 'post', text: 'important',
    });
    expect(calls.indexOf('candidate')).toBeLessThan(calls.indexOf('delivery'));
  });
});
