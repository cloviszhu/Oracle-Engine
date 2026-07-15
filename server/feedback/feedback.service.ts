import { z } from 'zod';

export const feedbackTypes = [
  'important',
  'known',
  'irrelevant',
  'follow',
  'translation_error',
  'analysis_error',
] as const;

const feedbackInputSchema = z.object({
  cardId: z.string().min(1).max(36),
  cardVersion: z.number().int().positive(),
  type: z.enum(feedbackTypes),
  note: z.string().trim().min(1).max(1_000).optional(),
}).strict();

export type FeedbackAppend = z.infer<typeof feedbackInputSchema> & {
  actorId: string;
  createdAt: Date;
};

interface FeedbackRepository {
  append(feedback: FeedbackAppend): Promise<unknown>;
}

export class FeedbackService {
  constructor(
    private readonly repository: FeedbackRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async submit(actorId: string, value: unknown): Promise<unknown> {
    if (!actorId.trim()) throw new Error('actorId is required');
    const input = feedbackInputSchema.parse(value);
    return this.repository.append({ ...input, actorId, createdAt: this.now() });
  }
}
