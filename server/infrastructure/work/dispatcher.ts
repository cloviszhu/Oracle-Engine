import type { PipelineStage } from '../../../shared/contracts/base.js';
import { buildStableJobId } from './coordination.js';

export interface DispatchableIntent {
  id: string;
  stage: PipelineStage;
  correlationId: string;
  fencingToken: number;
}

export interface IntentDispatchRepository {
  listDispatchable(limit: number): Promise<DispatchableIntent[]>;
  markDispatched(intentId: string): Promise<void>;
}

export interface WorkQueuePublisher {
  add(
    name: PipelineStage,
    payload: {
      intentId: string;
      stage: PipelineStage;
      correlationId: string;
      fencingToken: number;
    },
    options: { jobId: string },
  ): Promise<unknown>;
}

export async function dispatchPendingIntents(
  repository: IntentDispatchRepository,
  queue: WorkQueuePublisher,
  limit: number,
): Promise<number> {
  const intents = await repository.listDispatchable(limit);
  let dispatched = 0;

  for (const intent of intents) {
    await queue.add(
      intent.stage,
      {
        intentId: intent.id,
        stage: intent.stage,
        correlationId: intent.correlationId,
        fencingToken: intent.fencingToken,
      },
      { jobId: buildStableJobId({ stage: intent.stage, intentId: intent.id }) },
    );
    await repository.markDispatched(intent.id);
    dispatched += 1;
  }

  return dispatched;
}
