import { describe, expect, it, vi } from 'vitest';
import { SerenityComposeController } from './compose-controller.js';

describe('SerenityComposeController', () => {
  it('uses only the fixed Serenity project and never targets Docker Desktop or unrelated containers', async () => {
    const run = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const controller = new SerenityComposeController(run, 'C:\\Serenity\\docker-compose.yml');
    await controller.startInfrastructure();
    await controller.stopInfrastructure();
    expect(run.mock.calls).toEqual([
      ['docker', ['compose', '-p', 'serenity-local', '-f', 'C:\\Serenity\\docker-compose.yml', 'up', '-d', 'db', 'redis']],
      ['docker', ['compose', '-p', 'serenity-local', '-f', 'C:\\Serenity\\docker-compose.yml', 'down']],
    ]);
    expect(JSON.stringify(run.mock.calls)).not.toMatch(/Docker Desktop|stop .*container/i);
  });
});
