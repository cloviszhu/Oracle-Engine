import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns the stable service health payload', () => {
    expect(new HealthController().getHealth()).toEqual({
      status: 'ok',
      service: 'serenity-intelligence-monitor',
    });
  });
});
