import { describe, expect, it, vi } from 'vitest';
import { ContentLifecycleService } from './content-lifecycle.service.js';

describe('content lifecycle service', () => {
  it('records pending verification without clearing archived text', async () => {
    const repository = { markVerificationPending: vi.fn(), applyTombstone: vi.fn() };
    const service = new ContentLifecycleService(repository);

    await service.reconcile('content-1', 'hash-1', { kind: 'missing_transient' });

    expect(repository.markVerificationPending).toHaveBeenCalledWith('content-1');
    expect(repository.applyTombstone).not.toHaveBeenCalled();
  });

  it('clears restricted fields only after an explicit deletion decision', async () => {
    const repository = { markVerificationPending: vi.fn(), applyTombstone: vi.fn() };
    const service = new ContentLifecycleService(repository);

    await service.reconcile('content-1', 'hash-1', { kind: 'explicit_deleted' });

    expect(repository.applyTombstone).toHaveBeenCalledWith('content-1', 'deleted');
  });
});
