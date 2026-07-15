import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactResult } from '../../shared/desktop/contracts.js';

const forbiddenKey = /(?:secret|token|password|api.?key|credential|provider.?body|raw.?body|stack|cookie|authorization)/i;

export class DiagnosticsService {
  constructor(private readonly options: {
    destinationRoot: string;
    version: string;
    collect(): Promise<unknown>;
    canaries?: string[];
    now?: () => Date;
  }) {}

  async export(): Promise<ArtifactResult> {
    const now = this.options.now?.() ?? new Date();
    const createdAt = now.toISOString();
    const collected = await this.options.collect();
    const rawContent = JSON.stringify(collected);
    if ((this.options.canaries ?? []).some((canary) => canary && rawContent.includes(canary))) {
      throw new Error('诊断源数据命中敏感 canary，已拒绝导出');
    }
    const payload = sanitize({ version: this.options.version, createdAt, diagnostics: collected }, this.options.canaries ?? []);
    const content = `${JSON.stringify(payload, null, 2)}\n`;
    if ((this.options.canaries ?? []).some((canary) => canary && content.includes(canary))) {
      throw new Error('诊断包命中敏感 canary，已拒绝导出');
    }
    await mkdir(this.options.destinationRoot, { recursive: true });
    const path = join(this.options.destinationRoot, `${createdAt.replace(/[:.]/g, '-')}-diagnostics.json`);
    await writeFile(path, content, { encoding: 'utf8', mode: 0o600 });
    return { path, createdAt };
  }
}

function sanitize(value: unknown, canaries: string[]): unknown {
  if (typeof value === 'string') {
    let output = value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
      .replace(/https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[A-Za-z0-9-]+/gi, '[REDACTED_WEBHOOK]');
    for (const canary of canaries) if (canary) output = output.replaceAll(canary, '[REDACTED]');
    return output;
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, canaries));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !forbiddenKey.test(key))
      .map(([key, child]) => [key, sanitize(child, canaries)]));
  }
  return value;
}
