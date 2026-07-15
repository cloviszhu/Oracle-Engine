import { describe, expect, it } from 'vitest';
import {
  decodeContentCursor,
  encodeContentCursor,
  parseContentQuery,
  sanitizeContentDetail,
} from './content-query.js';

describe('private content query contract', () => {
  it('accepts bounded combined filters and a whitelisted stable sort', () => {
    expect(parseContentQuery({
      keyword: 'accelerator', ticker: 'NVDA', topic: 'AI', importance: 'candidate',
      contentType: 'reply', dateFrom: '2026-07-01T00:00:00.000Z',
      dateTo: '2026-07-15T00:00:00.000Z', sort: 'published_desc', limit: '50',
    })).toMatchObject({ ticker: 'NVDA', contentType: 'reply', limit: 50 });
  });

  it('rejects unknown filters, unsafe sort fields and oversized pages', () => {
    expect(() => parseContentQuery({ actorId: 'father' })).toThrow();
    expect(() => parseContentQuery({ sort: 'raw_payload' })).toThrow();
    expect(() => parseContentQuery({ limit: '1000' })).toThrow();
  });

  it('round-trips a stable composite cursor and rejects tampering', () => {
    const cursor = encodeContentCursor({ publishedAt: '2026-07-15T00:00:00.000Z', id: 'content-1' });
    expect(decodeContentCursor(cursor)).toEqual({
      publishedAt: '2026-07-15T00:00:00.000Z', id: 'content-1',
    });
    expect(() => decodeContentCursor('not-a-cursor')).toThrow(/cursor/i);
  });

  it('never exposes raw provider payloads or secrets in detail responses', () => {
    const detail = sanitizeContentDetail({
      id: 'content-1', body: 'public source text', rawPayload: { token: 'canary' },
      card: { translation: '中文', nested: { webhookUrl: 'canary' } },
    });
    expect(detail).toEqual({ id: 'content-1', body: 'public source text', card: { translation: '中文', nested: {} } });
    expect(JSON.stringify(detail)).not.toContain('canary');
  });
});
