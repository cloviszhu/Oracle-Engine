import { describe, expect, it, vi } from 'vitest';
import {
  FeishuDeliveryError,
  FeishuNotificationAdapter,
  generateFeishuSignature,
  isFeishuTimestampWithinWindow,
} from './feishu.adapter.js';

const webhookUrl = 'https://open.feishu.cn/open-apis/bot/v2/hook/test';
const signingSecret = 'test-signing-secret';
const message = {
  contentId: 'content-1',
  cardId: 'card-1',
  title: 'AI 芯片供应链出现新信号',
  faithfulTranslation: '原文忠实翻译，保留可能性表述。',
  serenityJudgment: 'Serenity 判断供给约束可能继续。',
  uncertainties: ['尚未获得公司公告交叉验证'],
  importanceReason: 'importance-v1: score 82 >= 70',
  sourceUrl: 'https://x.com/aleabitoreddit/status/1',
};

describe('signed Feishu custom-bot adapter', () => {
  it('matches the official HmacSHA256 empty-message fixed vector', () => {
    expect(generateFeishuSignature('1720000000', signingSecret)).toBe(
      '/1mDr2AF2wsHfeIfu1NEqEotM5tNCZNxBzZOLoTBs+Y=',
    );
  });

  it('recognizes timestamps inside and outside the one-hour verification window', () => {
    const now = new Date('2024-07-03T09:46:40Z');
    expect(isFeishuTimestampWithinWindow('1720000000', now)).toBe(true);
    expect(isFeishuTimestampWithinWindow('1719996399', now)).toBe(false);
  });

  it('sends a signed layered card with an absolute HTTPS private detail link', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 0, msg: 'success', data: { message_id: 'message-1' } }),
      { status: 200, headers: { 'x-request-id': 'feishu-request-1' } },
    ));
    const adapter = new FeishuNotificationAdapter({
      webhookUrl, signingSecret, appBaseUrl: 'https://serenity.example', fetch,
      now: () => new Date('2024-07-03T09:46:40Z'),
    });

    await expect(adapter.send(message)).resolves.toEqual({
      providerRequestId: 'feishu-request-1', providerMessageId: 'message-1',
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(url).toBe(webhookUrl);
    expect(body).toMatchObject({
      timestamp: '1720000000',
      sign: '/1mDr2AF2wsHfeIfu1NEqEotM5tNCZNxBzZOLoTBs+Y=',
      msg_type: 'interactive',
    });
    expect(JSON.stringify(body)).toContain('忠实翻译');
    expect(JSON.stringify(body)).toContain('Serenity 判断');
    expect(JSON.stringify(body)).toContain('未验证与不确定性');
    expect(JSON.stringify(body)).toContain('https://serenity.example/intelligence/content-1');
    expect(JSON.stringify(body)).toContain(message.sourceUrl);
  });

  it('classifies an explicit signature rejection as blocked and redacts configuration', async () => {
    const adapter = new FeishuNotificationAdapter({
      webhookUrl, signingSecret, appBaseUrl: 'https://serenity.example',
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 19021, msg: 'sign match fail' }), { status: 400 }),
      ),
    });
    const error = await adapter.send(message).catch((value: unknown) => value);
    expect(error).toBeInstanceOf(FeishuDeliveryError);
    expect(error).toMatchObject({
      category: 'signature_rejected', retryable: false, outcomeUnknown: false,
    });
    expect(JSON.stringify(error)).not.toContain(signingSecret);
    expect(JSON.stringify(error)).not.toContain(webhookUrl);
  });

  it('distinguishes explicit retryable responses from ambiguous request outcomes', async () => {
    const explicit = new FeishuNotificationAdapter({
      webhookUrl, signingSecret, appBaseUrl: 'https://serenity.example',
      fetch: vi.fn().mockResolvedValue(new Response('{}', { status: 503 })),
    });
    await expect(explicit.send(message)).rejects.toMatchObject({
      retryable: true, outcomeUnknown: false,
    });

    const ambiguous = new FeishuNotificationAdapter({
      webhookUrl, signingSecret, appBaseUrl: 'https://serenity.example',
      fetch: vi.fn().mockRejectedValue(new Error('socket closed after write')),
    });
    await expect(ambiguous.send(message)).rejects.toMatchObject({
      retryable: false, outcomeUnknown: true,
    });
  });

  it('rejects non-HTTPS detail origins and incomplete signed configuration', () => {
    expect(() => new FeishuNotificationAdapter({
      webhookUrl, signingSecret: '', appBaseUrl: 'https://serenity.example',
    })).toThrow(/configuration/i);
    expect(() => new FeishuNotificationAdapter({
      webhookUrl, signingSecret, appBaseUrl: 'http://serenity.example',
    })).toThrow(/HTTPS/i);
    expect(() => new FeishuNotificationAdapter({
      webhookUrl: 'https://attacker.example/open-apis/bot/v2/hook/test',
      signingSecret, appBaseUrl: 'https://serenity.example',
    })).toThrow(/official Feishu/i);
  });

  it('renders untrusted summary text without arbitrary links or mention tags', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    const adapter = new FeishuNotificationAdapter({
      webhookUrl, signingSecret, appBaseUrl: 'https://serenity.example', fetch,
    });
    await adapter.send({
      ...message,
      faithfulTranslation: '<at user_id="all">all</at> [伪造详情](https://attacker.example/path)',
    });
    const body = String((fetch.mock.calls[0]?.[1] as RequestInit).body);
    expect(body).not.toContain('<at');
    expect(body).not.toContain('https://attacker.example');
    expect(body).toContain(message.sourceUrl);
  });
});
