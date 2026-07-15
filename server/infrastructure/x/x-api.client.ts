import type {
  EvidenceKind,
  XContentPage,
  XContentSourceAdapter,
  XNormalizedContent,
} from './content-source.adapter.js';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type XErrorCategory =
  | 'authentication'
  | 'permission'
  | 'budget'
  | 'rate_limit'
  | 'provider_unavailable'
  | 'invalid_request';

export class XProviderError extends Error {
  constructor(
    public readonly category: XErrorCategory,
    public readonly retryable: boolean,
    public readonly status: number,
    public readonly providerRequestId?: string,
  ) {
    super(`X API request failed: ${category}`);
    this.name = 'XProviderError';
  }
}

interface XApiClientOptions {
  bearerToken: string;
  fetch?: Fetch;
  evidenceKind?: EvidenceKind;
  baseUrl?: string;
  deadlineMs?: number;
}

const POST_FIELDS = [
  'author_id',
  'conversation_id',
  'created_at',
  'edit_history_tweet_ids',
  'in_reply_to_user_id',
  'referenced_tweets',
  'text',
].join(',');
const EXPANSIONS = [
  'author_id',
  'edit_history_tweet_ids',
  'in_reply_to_user_id',
  'referenced_tweets.id',
  'referenced_tweets.id.author_id',
].join(',');

interface RawPost {
  id?: unknown;
  author_id?: unknown;
  text?: unknown;
  created_at?: unknown;
  conversation_id?: unknown;
  in_reply_to_user_id?: unknown;
  edit_history_tweet_ids?: unknown;
  referenced_tweets?: unknown;
  [key: string]: unknown;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizePost(value: RawPost): XNormalizedContent {
  const id = optionalString(value.id);
  const authorId = optionalString(value.author_id);
  if (!id || !authorId) {
    throw new XProviderError('provider_unavailable', true, 200);
  }
  const references = Array.isArray(value.referenced_tweets)
    ? value.referenced_tweets.filter(
        (item): item is { type: string; id: string } =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as { type?: unknown }).type === 'string' &&
          typeof (item as { id?: unknown }).id === 'string',
      )
    : [];
  return {
    id,
    authorId,
    text: typeof value.text === 'string' ? value.text : '',
    createdAt: optionalString(value.created_at),
    conversationId: optionalString(value.conversation_id),
    inReplyToUserId: optionalString(value.in_reply_to_user_id),
    replyToId: references.find((reference) => reference.type === 'replied_to')?.id,
    quoteIds: references.filter((reference) => reference.type === 'quoted').map((reference) => reference.id),
    editHistoryIds: Array.isArray(value.edit_history_tweet_ids)
      ? value.edit_history_tweet_ids.filter((item): item is string => typeof item === 'string')
      : [id],
    raw: { ...value },
  };
}

function safeObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export class XApiClient implements XContentSourceAdapter {
  private readonly fetch: Fetch;
  private readonly evidenceKind: EvidenceKind;
  private readonly baseUrl: string;
  private readonly deadlineMs: number;

  constructor(private readonly options: XApiClientOptions) {
    if (!options.bearerToken.trim()) {
      throw new Error('X bearer token is required');
    }
    this.fetch = options.fetch ?? globalThis.fetch;
    this.evidenceKind = options.evidenceKind ?? 'real_api';
    this.baseUrl = options.baseUrl ?? 'https://api.x.com';
    this.deadlineMs = options.deadlineMs ?? 20_000;
  }

  async resolveAccount(username: string) {
    const url = new URL(`/2/users/by/username/${encodeURIComponent(username)}`, this.baseUrl);
    url.searchParams.set('user.fields', 'id,name,username');
    const { body, requestId } = await this.request(url);
    const data = safeObject(body.data);
    const externalUserId = optionalString(data.id);
    const resolvedUsername = optionalString(data.username);
    if (!externalUserId || !resolvedUsername) {
      throw new XProviderError('provider_unavailable', true, 200, requestId);
    }
    return {
      externalUserId,
      username: resolvedUsername,
      displayName: optionalString(data.name),
      providerRequestId: requestId,
      evidenceKind: this.evidenceKind,
    };
  }

  async listUserContent(input: {
    userId: string;
    sinceId?: string;
    paginationToken?: string;
    maxResults?: number;
  }): Promise<XContentPage> {
    const url = new URL(`/2/users/${encodeURIComponent(input.userId)}/tweets`, this.baseUrl);
    this.applyPostParameters(url);
    url.searchParams.set('max_results', String(input.maxResults ?? 100));
    if (input.sinceId) url.searchParams.set('since_id', input.sinceId);
    if (input.paginationToken) url.searchParams.set('pagination_token', input.paginationToken);
    return this.requestContentPage(url);
  }

  async lookupContent(ids: string[]): Promise<XContentPage> {
    if (ids.length < 1 || ids.length > 100) {
      throw new Error('X lookup batch must contain between 1 and 100 ids');
    }
    const url = new URL('/2/tweets', this.baseUrl);
    this.applyPostParameters(url);
    url.searchParams.set('ids', ids.join(','));
    return this.requestContentPage(url);
  }

  private applyPostParameters(url: URL): void {
    url.searchParams.set('tweet.fields', POST_FIELDS);
    url.searchParams.set('expansions', EXPANSIONS);
    url.searchParams.set('user.fields', 'id,name,username');
  }

  private async requestContentPage(url: URL): Promise<XContentPage> {
    const { body, requestId, status } = await this.request(url);
    const data = Array.isArray(body.data) ? (body.data as RawPost[]).map(normalizePost) : [];
    const includes = safeObject(body.includes);
    const included = Array.isArray(includes.tweets)
      ? (includes.tweets as RawPost[]).map(normalizePost)
      : [];
    const meta = safeObject(body.meta);
    const errors = Array.isArray(body.errors) ? body.errors.length : 0;
    return {
      items: data,
      included,
      newestId: optionalString(meta.newest_id),
      nextToken: optionalString(meta.next_token),
      providerRequestId: requestId,
      evidenceKind: this.evidenceKind,
      rawAudit: {
        status,
        resultCount: typeof meta.result_count === 'number' ? meta.result_count : data.length,
        newestId: optionalString(meta.newest_id),
        oldestId: optionalString(meta.oldest_id),
        partialErrorCount: errors,
      },
    };
  }

  private async request(url: URL): Promise<{
    body: Record<string, unknown>;
    requestId?: string;
    status: number;
  }> {
    let response: Response;
    try {
      response = await this.fetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.options.bearerToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.deadlineMs),
      });
    } catch (error) {
      if (error instanceof XProviderError) throw error;
      throw new XProviderError('provider_unavailable', true, 0);
    }
    const requestId = response.headers.get('x-request-id') ?? undefined;
    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = safeObject(text ? JSON.parse(text) : {});
    } catch {
      throw new XProviderError('provider_unavailable', true, response.status, requestId);
    }
    if (!response.ok) {
      throw classifyResponseError(response.status, body, requestId);
    }
    return { body, requestId, status: response.status };
  }
}

function classifyResponseError(
  status: number,
  body: Record<string, unknown>,
  requestId?: string,
): XProviderError {
  const providerText = `${String(body.title ?? '')} ${String(body.detail ?? '')}`;
  if (status === 401) return new XProviderError('authentication', false, status, requestId);
  if (status === 402 || (status === 403 && /credit|budget|usage|spending/i.test(providerText))) {
    return new XProviderError('budget', false, status, requestId);
  }
  if (status === 403) return new XProviderError('permission', false, status, requestId);
  if (status === 429) return new XProviderError('rate_limit', true, status, requestId);
  if (status >= 500) return new XProviderError('provider_unavailable', true, status, requestId);
  return new XProviderError('invalid_request', false, status, requestId);
}
