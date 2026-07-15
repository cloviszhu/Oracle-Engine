import { promisify } from 'node:util';
import { scrypt } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { FamilyAuthService, type SessionRecord } from './family-auth.service.js';

const derive = promisify(scrypt);

async function digest(password: string, salt: string): Promise<string> {
  const value = await derive(password, Buffer.from(salt), 32, { N: 16_384, r: 8, p: 1 }) as Buffer;
  return `scrypt$16384$8$1$${Buffer.from(salt).toString('base64url')}$${value.toString('base64url')}`;
}

async function fixture() {
  const records = new Map<string, SessionRecord>();
  const store = {
    put: vi.fn(async (record: SessionRecord) => { records.set(record.tokenHash, record); }),
    get: vi.fn(async (tokenHash: string) => records.get(tokenHash)),
    delete: vi.fn(async (tokenHash: string) => { records.delete(tokenHash); }),
    deleteActor: vi.fn(async (actorId: string) => {
      for (const [key, value] of records) if (value.actorId === actorId) records.delete(key);
    }),
  };
  const limiter = { consume: vi.fn().mockResolvedValue(true) };
  const service = new FamilyAuthService({
    accounts: [
      { actorId: 'father', username: 'father', passwordScrypt: await digest('father-pass', 'father-salt') },
      { actorId: 'requester', username: 'requester', passwordScrypt: await digest('requester-pass', 'requester-salt') },
    ],
    sessionSecret: 's'.repeat(32), sessionTtlSeconds: 3600,
    secureCookies: true, store, limiter,
    now: () => new Date('2026-07-15T00:00:00Z'),
  });
  return { service, store, limiter, records };
}

describe('family authentication', () => {
  it('logs in either fixed family account and stores only a token hash with absolute expiry', async () => {
    const { service, store } = await fixture();
    const login = await service.login('father', 'father-pass', '127.0.0.1');

    expect(login.actorId).toBe('father');
    expect(login.sessionCookie).toContain('HttpOnly');
    expect(login.sessionCookie).toContain('SameSite=Strict');
    expect(login.sessionCookie).toContain('Secure');
    const stored = store.put.mock.calls[0]?.[0];
    expect(stored).toMatchObject({ actorId: 'father', expiresAt: '2026-07-15T01:00:00.000Z' });
    expect(login.sessionCookie).not.toContain(stored?.tokenHash ?? 'never');
    expect(JSON.stringify(stored)).not.toContain('father-pass');
  });

  it('authenticates a signed server-side session and rejects a rotated signing secret', async () => {
    const { service, store, limiter } = await fixture();
    const login = await service.login('requester', 'requester-pass', '127.0.0.1');
    const cookieValue = login.sessionCookie.split(';')[0]?.split('=')[1] ?? '';
    await expect(service.authenticate(cookieValue)).resolves.toEqual({ actorId: 'requester' });

    const rotated = new FamilyAuthService({
      accounts: [], sessionSecret: 'r'.repeat(32), sessionTtlSeconds: 3600,
      secureCookies: true, store, limiter,
    });
    await expect(rotated.authenticate(cookieValue)).rejects.toThrow(/invalid_session/);
  });

  it('requires both trusted origin and derived CSRF token for state changes', async () => {
    const { service } = await fixture();
    const login = await service.login('father', 'father-pass', '127.0.0.1');
    const cookieValue = login.sessionCookie.split(';')[0]?.split('=')[1] ?? '';

    await expect(service.authorizeStateChange({
      cookieValue, csrfToken: login.csrfToken, origin: 'https://serenity.example',
      expectedOrigin: 'https://serenity.example',
    })).resolves.toEqual({ actorId: 'father' });
    await expect(service.authorizeStateChange({
      cookieValue, csrfToken: 'wrong', origin: 'https://serenity.example',
      expectedOrigin: 'https://serenity.example',
    })).rejects.toThrow(/csrf/);
  });

  it('rate-limits by account and IP before accepting credentials', async () => {
    const { service, limiter } = await fixture();
    limiter.consume.mockResolvedValueOnce(false);
    await expect(service.login('father', 'father-pass', '127.0.0.1')).rejects.toThrow(/rate_limited/);
  });

  it('deletes sessions on logout and actor password rotation', async () => {
    const { service, store } = await fixture();
    const login = await service.login('father', 'father-pass', '127.0.0.1');
    const cookieValue = login.sessionCookie.split(';')[0]?.split('=')[1] ?? '';
    await service.logout(cookieValue);
    expect(store.delete).toHaveBeenCalledOnce();
    await service.revokeActorSessions('father');
    expect(store.deleteActor).toHaveBeenCalledWith('father');
  });
});
