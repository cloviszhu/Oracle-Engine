// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(cleanup);

describe('launcher shell', () => {
  it('shows the Chinese local setup entry without requiring backend availability', async () => {
    render(<App launcher={{ getSetupStatus: vi.fn().mockResolvedValue({ configured: false }) } as never} />);
    expect(screen.getByRole('heading', { name: 'Serenity 家庭启动器' })).toBeInTheDocument();
    expect(await screen.findByText('首次设置')).toBeInTheDocument();
    expect(screen.getByText('无需终端或手工编辑 .env')).toBeInTheDocument();
  });

  it('completes the GUI-only setup with AI, X and Feishu skipped by default', async () => {
    const launcher = {
      getSetupStatus: vi.fn().mockResolvedValue({ configured: false }),
      runEnvironmentChecks: vi.fn().mockResolvedValue([{ code: 'windows-version', label: 'Windows 版本', status: 'pass', message: '系统版本受支持' }]),
      saveSettings: vi.fn().mockResolvedValue({ configured: true }),
      probeAI: vi.fn(),
    } as never;
    render(<App launcher={launcher} />);
    await userEvent.click(await screen.findByRole('button', { name: '开始设置' }));
    await userEvent.click(screen.getByRole('button', { name: '运行环境检查' }));
    expect(await screen.findByText('系统版本受支持')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    await userEvent.type(screen.getByLabelText('账号 1 用户名'), 'father');
    await userEvent.type(screen.getByLabelText('账号 1 密码'), 'father-password-123');
    await userEvent.type(screen.getByLabelText('账号 2 用户名'), 'requester');
    await userEvent.type(screen.getByLabelText('账号 2 密码'), 'requester-password-123');
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('checkbox', { name: '启用 AI 分析' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: '跳过 AI' }));
    expect(screen.getByText('X 未真实同步')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '跳过 X' }));
    expect(screen.getByText('飞书 disabled')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '跳过飞书' }));
    await userEvent.click(screen.getByRole('button', { name: '保存并完成' }));
    expect(await screen.findByText('日常管理')).toBeInTheDocument();
    expect((launcher as { saveSettings: ReturnType<typeof vi.fn> }).saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      ai: expect.objectContaining({ enabled: false }), x: { enabled: false, policyConfirmed: false }, feishu: { enabled: false },
    }));
    expect((launcher as { probeAI: ReturnType<typeof vi.fn> }).probeAI).not.toHaveBeenCalled();
  });

  it('shows daily controls and fixed disabled integration states after setup', async () => {
    const launcher = {
      getSetupStatus: vi.fn().mockResolvedValue({ configured: true, ai: { enabled: false, configured: false }, x: { enabled: false, configured: false }, feishu: { enabled: false, configured: false } }),
      getHealth: vi.fn().mockResolvedValue({ overall: 'healthy', services: [] }),
      startSerenity: vi.fn(), stopSerenity: vi.fn(), openWorkspace: vi.fn(), createBackup: vi.fn(), exportDiagnostics: vi.fn(),
    } as never;
    render(<App launcher={launcher} />);
    expect(await screen.findByText('日常管理')).toBeInTheDocument();
    expect(screen.getByText('X 未真实同步')).toBeInTheDocument();
    expect(screen.getByText('AI 未启用')).toBeInTheDocument();
    expect(screen.getByText('飞书 disabled')).toBeInTheDocument();
    for (const name of ['启动服务', '停止服务', '健康检查', '打开私有网页', '创建备份', '导出诊断']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('loads non-sensitive existing settings for safe modification without requiring old passwords', async () => {
    const launcher = {
      getSetupStatus: vi.fn().mockResolvedValue({
        configured: true, ai: { enabled: true, configured: true }, x: { enabled: true, configured: true }, feishu: { enabled: true, configured: true },
        editable: {
          familyAccounts: [{ actorId: 'father', username: 'father' }, { actorId: 'requester', username: 'requester' }],
          ai: { enabled: true, providerPreset: 'custom', protocol: 'chat_completions', baseUrl: 'https://models.example.test', model: 'family-model', reasoning: 'medium', inputCostPerMillionCents: 1, outputCostPerMillionCents: 2, maxRequestCostCents: 3, dailyBudgetCents: 4 },
          x: { enabled: true, policyConfirmed: true }, feishu: { enabled: true },
        },
      }),
      runEnvironmentChecks: vi.fn().mockResolvedValue([{ code: 'windows-version', label: 'Windows 版本', status: 'pass', message: '系统版本受支持' }]),
      startSerenity: vi.fn(), stopSerenity: vi.fn(), getHealth: vi.fn(), openWorkspace: vi.fn(), createBackup: vi.fn(), exportDiagnostics: vi.fn(),
    } as never;
    render(<App launcher={launcher} />);
    await userEvent.click(await screen.findByRole('button', { name: '修改设置' }));
    await userEvent.click(screen.getByRole('button', { name: '运行环境检查' }));
    await userEvent.click(await screen.findByRole('button', { name: '下一步' }));
    expect(screen.getByLabelText('账号 1 用户名')).toHaveValue('father');
    expect(screen.getByLabelText('账号 1 密码')).toHaveValue('');
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('button', { name: '测试 AI 连接' })).toBeEnabled();
  });
});
