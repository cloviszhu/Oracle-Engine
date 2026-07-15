import { describe, expect, it, vi } from 'vitest';
import { bootstrapSerenitySource } from './serenity-bootstrap.service.js';

describe('Serenity source bootstrap', () => {
  it('binds the current handle to the stable provider user id idempotently', async () => {
    const upsertStableAccount = vi.fn().mockResolvedValue('source-serenity');
    const result = await bootstrapSerenitySource(
      {
        resolveAccount: vi.fn().mockResolvedValue({
          externalUserId: 'stable-123', username: 'aleabitoreddit', displayName: 'Serenity',
          providerRequestId: 'req-1', evidenceKind: 'mock',
        }),
      },
      { upsertStableAccount },
    );

    expect(upsertStableAccount).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'x', externalUserId: 'stable-123', username: 'aleabitoreddit' }),
    );
    expect(result.sourceId).toBe('source-serenity');
    expect(result.evidenceKind).toBe('mock');
  });
});
