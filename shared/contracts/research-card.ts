import { z } from 'zod';

const sourceIdsSchema = z.array(z.string().min(1).max(128)).max(20);
const citedTextSchema = z
  .object({ text: z.string().min(1).max(4_000), sourceIds: sourceIdsSchema.min(1) })
  .strict();

export const researchCardDraftSchema = z
  .object({
    original: z
      .object({
        sourceId: z.string().min(1).max(128),
        text: z.string().min(1).max(50_000),
        sourceUrl: z.string().url().max(2_048),
      })
      .strict(),
    faithfulTranslation: z.string().min(1).max(50_000),
    contentType: z.enum(['post', 'reply', 'quote']),
    serenityStatements: z.array(citedTextSchema).max(30),
    otherPartyStatements: z.array(citedTextSchema).max(30),
    aiInterpretations: z.array(citedTextSchema).max(30),
    unverifiedInferences: z.array(citedTextSchema).max(30),
    viewpointChange: z
      .object({
        status: z.enum(['insufficient_history', 'no_change', 'changed', 'uncertain']),
        summary: z.string().min(1).max(4_000),
        sourceIds: sourceIdsSchema,
      })
      .strict(),
    entities: z
      .array(
        z
          .object({
            type: z.enum(['company', 'ticker', 'topic']),
            value: z.string().min(1).max(255),
            market: z.enum(['a_share', 'other', 'unknown']),
            verificationStatus: z.enum(['source_supported', 'needs_verification', 'unverified']),
            sourceIds: sourceIdsSchema,
          })
          .strict(),
      )
      .max(50),
    evidence: z
      .array(
        z
          .object({ claim: z.string().min(1).max(4_000), sourceIds: sourceIdsSchema.min(1) })
          .strict(),
      )
      .max(50),
    uncertainties: z.array(z.string().min(1).max(2_000)).max(30),
    confidence: z
      .object({
        level: z.enum(['low', 'medium', 'high']),
        score: z.number().min(0).max(1),
      })
      .strict(),
    importanceFeatures: z
      .object({
        novelty: z.number().min(0).max(100),
        materiality: z.number().min(0).max(100),
        evidenceStrength: z.number().min(0).max(100),
        viewpointChange: z.number().min(0).max(100),
        urgency: z.number().min(0).max(100),
      })
      .strict(),
  })
  .strict();

export type ResearchCardDraft = z.infer<typeof researchCardDraftSchema>;
export const researchCardJsonSchema = z.toJSONSchema(researchCardDraftSchema);
