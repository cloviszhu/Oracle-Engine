import { z } from 'zod';

const optionalTrimmed = (maximum: number) => z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().trim().min(1).max(maximum).optional(),
);

const contentQuerySchema = z.object({
  keyword: optionalTrimmed(200),
  ticker: z.preprocess(
    (value) => typeof value === 'string' ? value.toUpperCase() : value,
    z.string().regex(/^[A-Z0-9.-]{1,32}$/).optional(),
  ),
  topic: optionalTrimmed(100),
  importance: z.enum(['all', 'candidate', 'suppressed']).default('all'),
  contentType: z.enum(['post', 'reply', 'quote']).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['published_desc', 'published_asc', 'importance_desc']).default('published_desc'),
  cursor: z.string().max(1_024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((value, context) => {
  if (value.dateFrom && value.dateTo && new Date(value.dateFrom) > new Date(value.dateTo)) {
    context.addIssue({ code: 'custom', message: 'dateFrom must not be after dateTo' });
  }
  if (value.cursor) {
    try {
      decodeContentCursor(value.cursor);
    } catch {
      context.addIssue({ code: 'custom', message: 'cursor is invalid' });
    }
  }
});

export type ContentQuery = z.infer<typeof contentQuerySchema>;

export function parseContentQuery(value: unknown): ContentQuery {
  return contentQuerySchema.parse(value);
}

const cursorSchema = z.object({
  publishedAt: z.string().datetime({ offset: true }),
  id: z.string().min(1).max(128),
  importanceScore: z.number().min(0).max(100).optional(),
}).strict();

export type ContentCursor = z.infer<typeof cursorSchema>;

export function encodeContentCursor(cursor: ContentCursor): string {
  return Buffer.from(JSON.stringify(cursorSchema.parse(cursor)), 'utf8').toString('base64url');
}

export function decodeContentCursor(value: string): ContentCursor {
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
  } catch {
    throw new Error('content cursor is invalid');
  }
}

const FORBIDDEN_DETAIL_KEYS = new Set([
  'rawpayload', 'token', 'secret', 'webhookurl', 'cookie', 'password', 'passwordscrypt',
]);

export function sanitizeContentDetail(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeContentDetail);
  if (value === null || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_DETAIL_KEYS.has(key.toLocaleLowerCase('en-US'))) continue;
    output[key] = sanitizeContentDetail(child);
  }
  return output;
}
