import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  cursorPageSchema,
  deliveryStatusSchema,
  pipelineStageSchema,
  processingStatusSchema,
} from './base.js';

describe('shared base contracts', () => {
  it('accepts stable pipeline and delivery states', () => {
    expect(pipelineStageSchema.parse('analysis')).toBe('analysis');
    expect(processingStatusSchema.parse('dead_letter')).toBe('dead_letter');
    expect(deliveryStatusSchema.parse('outcome_unknown')).toBe('outcome_unknown');
  });

  it('rejects raw payloads and internal stacks in public errors', () => {
    expect(() =>
      apiErrorSchema.parse({
        code: 'PROVIDER_ERROR',
        message: 'provider failed',
        rawPayload: { authorization: 'secret' },
      }),
    ).toThrow();
  });

  it('bounds cursor pagination', () => {
    expect(cursorPageSchema.parse({ limit: 50 })).toEqual({ limit: 50 });
    expect(() => cursorPageSchema.parse({ limit: 501 })).toThrow();
  });
});
