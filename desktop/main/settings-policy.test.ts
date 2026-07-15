import { describe, expect, it, vi } from 'vitest';
import { validateOptionalIntegrations } from './settings-policy.js';

describe('optional integration policy', () => {
  it('keeps X and Feishu disabled without creating tests or work', async () => {
    const testX = vi.fn();
    const testFeishu = vi.fn();
    await expect(validateOptionalIntegrations({
      x: { enabled: false, policyConfirmed: false }, feishu: { enabled: false },
    }, { testX, testFeishu })).resolves.toEqual({ xEnabled: false, feishuEnabled: false });
    expect(testX).not.toHaveBeenCalled();
    expect(testFeishu).not.toHaveBeenCalled();
  });

  it('requires complete pairs and explicit successful tests before enabling', async () => {
    await expect(validateOptionalIntegrations({ x: { enabled: true, policyConfirmed: false } }, {
      testX: vi.fn(), testFeishu: vi.fn(),
    })).rejects.toThrow(/Token.*政策确认/);
    const testX = vi.fn().mockResolvedValue(true);
    const testFeishu = vi.fn().mockResolvedValue(true);
    await expect(validateOptionalIntegrations({
      x: { enabled: true, token: 'x-test-token', policyConfirmed: true },
      feishu: { enabled: true, webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/test', signingSecret: 'sign-test' },
    }, { testX, testFeishu })).resolves.toEqual({ xEnabled: true, feishuEnabled: true });
  });
});
