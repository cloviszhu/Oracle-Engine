import { z } from 'zod';

export const entityIdSchema = z.string().min(1).max(128);
export const pipelineStageSchema = z.enum(['ingest', 'context', 'analysis', 'score']);
export const processingStatusSchema = z.enum([
  'pending',
  'processing',
  'succeeded',
  'retryable_failed',
  'blocked',
  'dead_letter',
]);
export const deliveryStatusSchema = z.enum([
  'pending',
  'sending',
  'sent',
  'retryable_failed',
  'outcome_unknown',
  'blocked',
  'dead_letter',
  'suppressed',
]);
export const blockReasonSchema = z.enum([
  'budget',
  'configuration',
  'policy',
  'permission',
  'capability',
]);

export const cursorPageSchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.number().int().min(1).max(500).default(50),
  })
  .strict();

export const apiErrorSchema = z
  .object({
    code: z.string().min(1).max(64),
    message: z.string().min(1).max(500),
    correlationId: z.string().min(1).max(128).optional(),
    retryable: z.boolean().optional(),
  })
  .strict();

export const processingEnvelopeSchema = z
  .object({
    intentId: entityIdSchema,
    stage: pipelineStageSchema,
    correlationId: entityIdSchema,
    fencingToken: z.number().int().nonnegative(),
  })
  .strict();

export type PipelineStage = z.infer<typeof pipelineStageSchema>;
export type ProcessingStatus = z.infer<typeof processingStatusSchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
