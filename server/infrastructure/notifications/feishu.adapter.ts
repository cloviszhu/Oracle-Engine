import { createHmac } from 'node:crypto';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface FeishuNotificationMessage {
  contentId: string;
  cardId: string;
  title: string;
  faithfulTranslation: string;
  serenityJudgment: string;
  uncertainties: string[];
  importanceReason: string;
  sourceUrl: string;
}

export type FeishuErrorCategory =
  | 'signature_rejected'
  | 'provider_rejected'
  | 'provider_unavailable'
  | 'outcome_unknown';

export class FeishuDeliveryError extends Error {
  constructor(
    public readonly category: FeishuErrorCategory,
    public readonly retryable: boolean,
    public readonly outcomeUnknown: boolean,
    public readonly status?: number,
    public readonly providerRequestId?: string,
  ) {
    super(`Feishu delivery failed: ${category}`);
    this.name = 'FeishuDeliveryError';
  }
}

export class FeishuNotificationAdapter {
  private readonly fetch: Fetch;
  private readonly now: () => Date;
  private readonly deadlineMs: number;
  private readonly detailOrigin: URL;

  constructor(private readonly options: {
    webhookUrl: string;
    signingSecret: string;
    appBaseUrl: string;
    fetch?: Fetch;
    now?: () => Date;
    deadlineMs?: number;
  }) {
    let webhook: URL;
    let appBase: URL;
    try {
      webhook = new URL(options.webhookUrl);
      appBase = new URL(options.appBaseUrl);
    } catch {
      throw new Error('Feishu signed configuration requires valid URLs');
    }
    if (!options.signingSecret.trim() || webhook.protocol !== 'https:') {
      throw new Error('Feishu signed configuration requires webhook and signing secret');
    }
    if (
      webhook.hostname !== 'open.feishu.cn'
      || !webhook.pathname.startsWith('/open-apis/bot/v2/hook/')
    ) {
      throw new Error('Feishu webhook must use the official Feishu custom-bot endpoint');
    }
    if (appBase.protocol !== 'https:') {
      throw new Error('Feishu private detail links require HTTPS');
    }
    if (options.deadlineMs !== undefined && (
      !Number.isFinite(options.deadlineMs) || options.deadlineMs <= 0
    )) {
      throw new Error('deadlineMs must be positive');
    }
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
    this.deadlineMs = options.deadlineMs ?? 20_000;
    this.detailOrigin = appBase;
  }

  async send(message: FeishuNotificationMessage): Promise<{
    providerRequestId?: string;
    providerMessageId?: string;
  }> {
    const timestamp = String(Math.floor(this.now().getTime() / 1_000));
    const body = buildFeishuCard(
      message,
      new URL(`/intelligence/${encodeURIComponent(message.contentId)}`, this.detailOrigin).toString(),
      timestamp,
      generateFeishuSignature(timestamp, this.options.signingSecret),
    );

    let response: Response;
    try {
      response = await this.fetch(this.options.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.deadlineMs),
      });
    } catch {
      throw new FeishuDeliveryError('outcome_unknown', false, true);
    }

    const requestId = response.headers.get('x-request-id') ?? undefined;
    const text = await response.text();
    let responseBody: Record<string, unknown>;
    try {
      const parsed = text ? JSON.parse(text) : {};
      responseBody = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      throw new FeishuDeliveryError('outcome_unknown', false, true, response.status, requestId);
    }

    const providerCode = numberValue(responseBody.code ?? responseBody.StatusCode);
    if (!response.ok || (providerCode !== undefined && providerCode !== 0)) {
      if (providerCode === 19021) {
        throw new FeishuDeliveryError('signature_rejected', false, false, response.status, requestId);
      }
      const retryable = response.status === 429 || response.status >= 500;
      throw new FeishuDeliveryError(
        retryable ? 'provider_unavailable' : 'provider_rejected',
        retryable,
        false,
        response.status,
        requestId,
      );
    }
    if (providerCode === undefined) {
      throw new FeishuDeliveryError('outcome_unknown', false, true, response.status, requestId);
    }
    const data = objectValue(responseBody.data);
    return {
      providerRequestId: requestId,
      providerMessageId: stringValue(data?.message_id),
    };
  }
}

export function generateFeishuSignature(timestamp: string, signingSecret: string): string {
  if (!/^\d{10,}$/.test(timestamp) || !signingSecret) {
    throw new Error('Feishu signature requires timestamp and secret');
  }
  return createHmac('sha256', `${timestamp}\n${signingSecret}`)
    .update('')
    .digest('base64');
}

export function isFeishuTimestampWithinWindow(
  timestamp: string,
  now: Date,
  windowSeconds = 3_600,
): boolean {
  if (!/^\d+$/.test(timestamp) || !Number.isFinite(windowSeconds) || windowSeconds < 0) {
    return false;
  }
  return Math.abs(Math.floor(now.getTime() / 1_000) - Number(timestamp)) <= windowSeconds;
}

function buildFeishuCard(
  message: FeishuNotificationMessage,
  detailUrl: string,
  timestamp: string,
  sign: string,
) {
  return {
    timestamp,
    sign,
    msg_type: 'interactive',
    card: {
      schema: '2.0',
      config: { wide_screen_mode: true },
      header: {
        template: 'orange',
        title: { tag: 'plain_text', content: sanitizeCardText(message.title) },
      },
      body: {
        elements: [
          { tag: 'markdown', content: `**忠实翻译**\n${sanitizeCardText(message.faithfulTranslation)}` },
          { tag: 'markdown', content: `**Serenity 判断**\n${sanitizeCardText(message.serenityJudgment)}` },
          {
            tag: 'markdown',
            content: `**未验证与不确定性**\n${message.uncertainties.length > 0
              ? message.uncertainties.map((item) => `- ${sanitizeCardText(item)}`).join('\n')
              : '- 暂无已记录项'}`,
          },
          { tag: 'markdown', content: `**重要性理由**\n${sanitizeCardText(message.importanceReason)}` },
          { tag: 'markdown', content: `[查看私有详情](${detailUrl}) · [查看来源](${message.sourceUrl})` },
        ],
      },
    },
  };
}

function sanitizeCardText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)]+/giu, '[外部链接已省略]')
    .replace(/<[^>]*>/gu, '')
    .replace(/\\/gu, '\\\\')
    .replace(/([*_[\]()~`>#+\-=|{}.!])/gu, '\\$1');
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
