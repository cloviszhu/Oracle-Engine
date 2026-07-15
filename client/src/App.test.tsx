// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  }));
}

describe('private research workspace', () => {
  it('returns unauthenticated visitors to a family login without exposing secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => response({ code: 'unauthorized' }, 401)));
    render(<App />);
    expect(await screen.findByRole('heading', { name: '家人登录' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/api.?key|webhook|secret/i);
  });

  it('restores a session, shows latest intelligence and sends combined filters', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => response({ actorId: 'father' }))
      .mockImplementation(() => response({
        items: [{
          id: 'content-1', content_type: 'reply', published_at: '2026-07-15T00:00:00Z',
          translation: '这可能会改善供应链。', confidence: 'medium', importance_score: '82.5',
          decision: 'notify_candidate',
        }],
      }));
    vi.stubGlobal('fetch', fetch);
    render(<App />);

    expect(await screen.findByText('这可能会改善供应链。')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('关键词'), 'accelerator');
    await userEvent.selectOptions(screen.getByLabelText('重要性'), 'candidate');
    fireEvent.submit(screen.getByRole('form', { name: '情报筛选' }));
    await waitFor(() => expect(String(fetch.mock.calls.at(-1)?.[0])).toContain('keyword=accelerator'));
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain('importance=candidate');
  });

  it('renders strict research layers, context gaps and append-only feedback', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => response({ actorId: 'father' }))
      .mockImplementationOnce(() => response({ items: [{ id: 'content-1', translation: '摘要', published_at: '2026-07-15T00:00:00Z' }] }))
      .mockImplementationOnce(() => response({
        id: 'content-1', body: 'It may improve.', translation: '这可能改善。',
        author_judgment: [{ text: 'Serenity 的判断' }], others_content: [{ text: '他人说法' }],
        ai_explanation: [{ text: 'AI 解释' }], unverified_inferences: [{ text: '待验证推断' }],
        evidence: [{ claim: '证据一' }], uncertainties: ['上下文缺失'], viewpoint_change: '样本不足',
        contextCompleteness: 'partial', card_id: 'card-1', card_version: 1,
      }))
      .mockImplementationOnce(() => response({ id: 'feedback-1' }));
    vi.stubGlobal('fetch', fetch);
    render(<App />);
    await userEvent.click(await screen.findByText('摘要'));

    for (const text of ['原文与来源', '忠实翻译', 'Serenity 判断', '他人内容', 'AI 解释', '未验证推断', '证据', '不确定性', '观点变化']) {
      expect(await screen.findByRole('heading', { name: text })).toBeTruthy();
    }
    await userEvent.click(screen.getByRole('button', { name: '已知' }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/intelligence/card-1/feedback', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByText('反馈已记录')).toBeTruthy();
  });

  it('shows core stages separately from an optional disabled notification branch', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => response({ actorId: 'requester' }))
      .mockImplementationOnce(() => response({ items: [] }))
      .mockImplementationOnce(() => response({
        core: { status: 'succeeded' },
        stages: [
          { stage: 'ingest', status: 'succeeded' }, { stage: 'context', status: 'succeeded' },
          { stage: 'analysis', status: 'succeeded' }, { stage: 'score', status: 'succeeded' },
        ],
        notification: { enabled: false, status: 'disabled', backlog: 0 },
      })));
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: '运行状态' }));
    expect(await screen.findByText('可选提醒未启用')).toBeTruthy();
    expect(screen.getByText('核心流水线正常')).toBeTruthy();
    expect(screen.getByText('X 未真实同步')).toBeTruthy();
    expect(screen.getByText('AI 未启用')).toBeTruthy();
    expect(screen.getByText('飞书 disabled')).toBeTruthy();
  });

  it('shows an auditable manual retry action for blocked notifications', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => response({ actorId: 'requester', csrfToken: 'csrf' }))
      .mockImplementationOnce(() => response({ items: [] }))
      .mockImplementationOnce(() => response({
        core: { status: 'succeeded' },
        stages: [],
        notification: {
          enabled: true,
          status: 'enabled',
          backlog: 1,
          recoverable: [{ id: 'delivery-1', status: 'blocked', manualRetryAllowed: true }],
        },
      }))
      .mockImplementationOnce(() => response({ id: 'recovery-1', status: 'pending' }))
      .mockImplementationOnce(() => response({
        core: { status: 'succeeded' }, stages: [],
        notification: { enabled: true, status: 'enabled', backlog: 1, recoverable: [] },
      }));
    vi.stubGlobal('fetch', fetch);
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: '运行状态' }));
    await userEvent.click(await screen.findByRole('button', { name: '重试提醒 delivery-1' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/operations/retry/delivery-1',
      expect.objectContaining({ method: 'POST' }),
    ));
    expect(await screen.findByText('已创建新的恢复尝试')).toBeTruthy();
  });
});
