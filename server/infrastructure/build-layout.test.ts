import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('server and worker delivery layout', () => {
  it('builds server, shared, and schema sources into stable dist paths', async () => {
    const config = JSON.parse(await readFile('tsconfig.server.json', 'utf8')) as {
      compilerOptions: { rootDir: string; outDir: string };
      include: string[];
    };

    expect(config.compilerOptions).toMatchObject({ rootDir: '.', outDir: 'dist' });
    expect(config.include).toEqual(
      expect.arrayContaining(['server/**/*.ts', 'shared/**/*.ts', 'drizzle/**/*.ts']),
    );
  });

  it('provides explicit migration, worker, and test cleanup commands', async () => {
    const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(manifest.scripts).toMatchObject({
      'db:migrate': expect.any(String),
      'dev:worker': expect.any(String),
      'start:worker': 'cross-env NODE_ENV=production node dist/server/worker.js',
      'test:clean': expect.any(String),
    });
  });

  it('keeps legacy AI aliases and application secrets out of infrastructure-only Compose', async () => {
    const environmentExample = await readFile('.env.example', 'utf8');
    const compose = await readFile('docker-compose.yml', 'utf8');

    const approvedKeyName = ['OPENAI', 'API', 'KEY'].join('_');
    const legacyKeyName = ['AI', 'API', 'KEY'].join('_');
    expect(environmentExample).toContain(`${approvedKeyName}=`);
    expect(environmentExample).not.toMatch(new RegExp(`^${legacyKeyName}=`, 'm'));
    expect(compose).not.toMatch(new RegExp(`^\\s*${legacyKeyName}:`, 'm'));
    expect(compose).not.toContain('local-root-only');
    expect(compose).not.toContain('SESSION_SECRET');
    expect(compose).not.toMatch(/^\s{2}(api|worker):/m);
    expect(compose).toContain('127.0.0.1:${SERENITY_MYSQL_PORT:-33060}:3306');
  });
});
