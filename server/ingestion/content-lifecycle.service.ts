import {
  planLifecycleObservation,
  type LifecycleObservation,
} from './content-lifecycle.js';

interface LifecycleRepository {
  markVerificationPending(contentId: string): Promise<unknown>;
  applyTombstone(contentId: string, visibility: 'deleted' | 'unavailable'): Promise<unknown>;
}

export class ContentLifecycleService {
  constructor(private readonly repository: LifecycleRepository) {}

  async reconcile(
    contentId: string,
    currentHash: string,
    observation: LifecycleObservation,
  ): Promise<ReturnType<typeof planLifecycleObservation>> {
    const plan = planLifecycleObservation({ currentHash, observation });
    if (plan.action === 'verification_pending') {
      await this.repository.markVerificationPending(contentId);
    } else if (plan.action === 'tombstone') {
      await this.repository.applyTombstone(contentId, plan.visibility);
    }
    return plan;
  }
}
