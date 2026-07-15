import type { LauncherSettingsInput } from '../../shared/desktop/contracts.js';

interface IntegrationTests {
  testX(token: string): Promise<boolean>;
  testFeishu(webhookUrl: string, signingSecret: string): Promise<boolean>;
}

export async function validateOptionalIntegrations(settings: Pick<LauncherSettingsInput, 'x' | 'feishu'>, tests: IntegrationTests) {
  let xEnabled = false;
  let feishuEnabled = false;
  if (settings.x?.enabled) {
    if (!settings.x.token || !settings.x.policyConfirmed) throw new Error('启用 X 需要 Token 和政策确认');
    if (!(await tests.testX(settings.x.token))) throw new Error('X 连接测试未通过');
    xEnabled = true;
  }
  if (settings.feishu?.enabled) {
    if (!settings.feishu.webhookUrl || !settings.feishu.signingSecret) throw new Error('启用飞书需要 Webhook 与签名密钥');
    if (!(await tests.testFeishu(settings.feishu.webhookUrl, settings.feishu.signingSecret))) throw new Error('飞书签名测试未通过');
    feishuEnabled = true;
  }
  return { xEnabled, feishuEnabled };
}
