import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecretVault } from './secret-vault.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

async function root() {
  const value = await mkdtemp(join(tmpdir(), 'serenity-vault-'));
  roots.push(value);
  return value;
}

describe('SecretVault', () => {
  it('stores only protected bytes and exposes configured metadata without values', async () => {
    const directory = await root();
    const restrictToCurrentUser = vi.fn(async () => undefined);
    const vault = new SecretVault({
      directory,
      protection: {
        isAvailable: () => true,
        encrypt: (value) => Buffer.from(value.toString('base64'), 'utf8'),
        decrypt: (value) => Buffer.from(value.toString('utf8'), 'base64'),
      },
      restrictToCurrentUser,
      now: () => new Date('2026-07-15T10:00:00.000Z'),
    });

    const canaryOne = 'canary-ai-value';
    const canaryTwo = 'canary-x-value';
    await vault.save({ aiApiKey: canaryOne, xBearerToken: canaryTwo });

    expect(restrictToCurrentUser).toHaveBeenCalledTimes(1);
    expect((await readFile(join(directory, 'secrets.vault'))).toString()).not.toContain('canary');
    expect(await vault.load()).toEqual({ aiApiKey: canaryOne, xBearerToken: canaryTwo });
    const state = await vault.getConfiguredState();
    expect(JSON.stringify(state)).not.toContain('canary');
    expect(state.aiApiKey).toEqual({ configured: true, updatedAt: '2026-07-15T10:00:00.000Z' });
  });

  it('fails closed without writing plaintext when protection or ACL is unavailable', async () => {
    const directory = await root();
    const vault = new SecretVault({
      directory,
      protection: { isAvailable: () => false, encrypt: () => Buffer.alloc(0), decrypt: () => Buffer.alloc(0) },
      restrictToCurrentUser: async () => { throw new Error('ACL failed'); },
    });

    const canaryValue = 'never-write-this-canary';
    await expect(vault.save({ aiApiKey: canaryValue })).rejects.toThrow(/系统加密/);
    await expect(readFile(join(directory, 'secrets.vault'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
