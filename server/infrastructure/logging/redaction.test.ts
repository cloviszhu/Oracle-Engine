import { describe, expect, it } from 'vitest';
import { redactForLog } from './redaction.js';

describe('central log redaction', () => {
  it('redacts sensitive fields recursively while retaining correlation metadata', () => {
    const result = redactForLog({
      correlationId: 'corr-1',
      authorization: 'Bearer canary',
      nested: { webhookUrl: 'https://secret', cookie: 'session=secret', requestId: 'req-1' },
    });

    expect(result).toEqual({
      correlationId: 'corr-1',
      authorization: '[REDACTED]',
      nested: { webhookUrl: '[REDACTED]', cookie: '[REDACTED]', requestId: 'req-1' },
    });
  });
});
