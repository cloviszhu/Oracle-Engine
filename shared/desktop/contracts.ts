import { z } from 'zod';

export const LAUNCHER_METHODS = [
  'getSetupStatus',
  'runEnvironmentChecks',
  'saveSettings',
  'probeAI',
  'startSerenity',
  'stopSerenity',
  'getHealth',
  'openWorkspace',
  'createBackup',
  'exportDiagnostics',
] as const;

export const secretConfiguredStateSchema = z.object({
  configured: z.boolean(),
  updatedAt: z.string().datetime().optional(),
  hint: z.string().max(128).optional(),
}).strict();

export type SecretConfiguredState = z.infer<typeof secretConfiguredStateSchema>;
export type EnvironmentCheckStatus = 'pass' | 'warning' | 'fail';
export interface EnvironmentCheckResult {
  code: string;
  label: string;
  status: EnvironmentCheckStatus;
  message: string;
  action?: { label: string; url?: string };
}
export type ProviderProtocol = 'responses' | 'chat_completions';
export interface AISettingsInput {
  enabled: boolean;
  providerPreset: 'openai' | 'custom';
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey?: string;
  model: string;
  reasoning: 'low' | 'medium' | 'high';
  inputCostPerMillionCents: number;
  outputCostPerMillionCents: number;
  maxRequestCostCents: number;
  dailyBudgetCents: number;
}
export interface FamilyAccountInput { actorId: string; username: string; password?: string }
export interface LauncherSettingsInput {
  familyAccounts: FamilyAccountInput[];
  ai?: AISettingsInput;
  x?: { enabled: boolean; token?: string; policyConfirmed: boolean };
  feishu?: { enabled: boolean; webhookUrl?: string; signingSecret?: string };
}
export interface SetupStatus {
  configured: boolean;
  accountsConfigured?: boolean;
  ai?: SecretConfiguredState & { enabled: boolean };
  x?: SecretConfiguredState & { enabled: boolean };
  feishu?: SecretConfiguredState & { enabled: boolean };
}
export interface CapabilityProbeResult {
  compatible: boolean;
  requestedModel: string;
  actualModel?: string;
  providerRequestId?: string;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  category?: string;
  missing?: string[];
  probeVersion: string;
}
export interface ServiceHealthSummary {
  overall: 'stopped' | 'starting' | 'healthy' | 'degraded' | 'failed';
  services: Array<{ name: 'mysql' | 'redis' | 'migration' | 'api' | 'worker'; status: string; message?: string }>;
  workspaceUrl?: string;
}
export interface ArtifactResult { path: string; createdAt: string }

export interface SerenityLauncherApi {
  getSetupStatus(): Promise<SetupStatus>;
  runEnvironmentChecks(): Promise<EnvironmentCheckResult[]>;
  saveSettings(settings: LauncherSettingsInput): Promise<SetupStatus>;
  probeAI(settings: AISettingsInput): Promise<CapabilityProbeResult>;
  startSerenity(): Promise<ServiceHealthSummary>;
  stopSerenity(): Promise<ServiceHealthSummary>;
  getHealth(): Promise<ServiceHealthSummary>;
  openWorkspace(): Promise<{ opened: boolean; url?: string }>;
  createBackup(): Promise<ArtifactResult>;
  exportDiagnostics(): Promise<ArtifactResult>;
}

declare global {
  interface Window { serenityLauncher: SerenityLauncherApi }
}
