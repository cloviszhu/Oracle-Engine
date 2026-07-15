import { describe, expect, it, vi } from 'vitest';
import { XApiClient, XProviderError } from './x-api.client.js';

const bearerToken = ['test', 'bearer', 'value'].join('-');

function jsonResponse(body: unknown, status = 200, requestId = 'x-request-1'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

describe('X official API client', () => {
  it('resolves the stable user id by username through the official server endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ data: { id: '1234567890123456789', username: 'aleabitoreddit', name: 'Serenity' } }),
    );
    const client = new XApiClient({ bearerToken, fetch, evidenceKind: 'mock' });

    const account = await client.resolveAccount('aleabitoreddit');

    expect(account).toEqual({
      externalUserId: '1234567890123456789',
      username: 'aleabitoreddit',
      displayName: 'Serenity',
      providerRequestId: 'x-request-1',
      evidenceKind: 'mock',
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/2/users/by/username/aleabitoreddit');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${bearerToken}`);
    expect(JSON.stringify(account)).not.toContain(bearerToken);
  });

  it('requests replies, references, conversation and edit history while preserving pagination', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: '20', author_id: '123', text: 'reply text', created_at: '2026-07-15T00:00:00Z',
            conversation_id: '10', in_reply_to_user_id: '456', edit_history_tweet_ids: ['20'],
            referenced_tweets: [{ type: 'replied_to', id: '10' }, { type: 'quoted', id: '11' }],
          },
        ],
        includes: { tweets: [{ id: '10', author_id: '456', text: 'parent' }] },
        meta: { newest_id: '20', next_token: 'next-page', result_count: 1 },
      }),
    );
    const client = new XApiClient({ bearerToken, fetch, evidenceKind: 'mock' });

    const page = await client.listUserContent({
      userId: '123', sinceId: '9', paginationToken: 'page-1', maxResults: 100,
    });

    expect(page.items[0]).toMatchObject({ id: '20', conversationId: '10', replyToId: '10', quoteIds: ['11'] });
    expect(page.included[0]).toMatchObject({ id: '10', text: 'parent' });
    expect(page.nextToken).toBe('next-page');
    expect(page.evidenceKind).toBe('mock');
    const url = new URL(fetch.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/2/users/123/tweets');
    expect(url.searchParams.get('since_id')).toBe('9');
    expect(url.searchParams.get('pagination_token')).toBe('page-1');
    expect(url.searchParams.get('exclude')).toBeNull();
    expect(url.searchParams.get('tweet.fields')).toContain('referenced_tweets');
    expect(url.searchParams.get('tweet.fields')).toContain('edit_history_tweet_ids');
    expect(url.searchParams.get('expansions')).toContain('referenced_tweets.id');
  });

  it('looks up recent content in bounded official batches', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: '1', author_id: '123', text: 'one' }] }));
    const client = new XApiClient({ bearerToken, fetch, evidenceKind: 'mock' });

    const result = await client.lookupContent(['1', '2']);

    const url = new URL(fetch.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe('/2/tweets');
    expect(url.searchParams.get('ids')).toBe('1,2');
    expect(result.items[0]?.id).toBe('1');
  });

  it.each([
    [401, 'authentication', false],
    [403, 'permission', false],
    [402, 'budget', false],
    [429, 'rate_limit', true],
    [503, 'provider_unavailable', true],
  ] as const)('classifies HTTP %s without leaking provider payloads', async (status, category, retryable) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ title: 'request rejected' }, status));
    const client = new XApiClient({ bearerToken, fetch, evidenceKind: 'mock' });

    const error = await client.resolveAccount('aleabitoreddit').catch((value: unknown) => value);

    expect(error).toBeInstanceOf(XProviderError);
    expect(error).toMatchObject({ category, retryable, status });
    expect(JSON.stringify(error)).not.toContain(bearerToken);
  });
});
