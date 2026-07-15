import { describe, expect, it, vi } from 'vitest';
import { createFamilyAccountDigests } from './account-hasher.js';
import { verifyPassword } from '../../server/auth/family-auth.service.js';

describe('family account hashing', () => {
  it('uses independent random salts and revokes only changed actors', async () => {
    const revoke = vi.fn(async () => undefined);
    const first = await createFamilyAccountDigests([
      { actorId: 'father', username: 'father', password: 'same-password-123' },
      { actorId: 'requester', username: 'requester', password: 'same-password-123' },
    ], [], revoke);
    expect(first[0]?.passwordScrypt).not.toBe(first[1]?.passwordScrypt);
    expect(await verifyPassword('same-password-123', first[0]!.passwordScrypt)).toBe(true);
    expect(revoke).not.toHaveBeenCalled();

    const second = await createFamilyAccountDigests([
      { actorId: 'father', username: 'father', password: 'changed-password-123' },
      { actorId: 'requester', username: 'requester', password: '' },
    ], first, revoke);
    expect(second[1]).toEqual(first[1]);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('father');
  });

  it('requires exactly two unique usernames and strong non-empty initial passwords', async () => {
    await expect(createFamilyAccountDigests([
      { actorId: 'father', username: 'same', password: 'short' },
      { actorId: 'requester', username: 'same', password: 'short' },
    ], [], async () => undefined)).rejects.toThrow(/两个不同用户名/);
  });
});
