type StageStatus = 'pending' | 'processing' | 'succeeded' | 'retryable_failed' | 'blocked'
  | 'dead_letter' | 'outcome_unknown';

interface OperationsInput {
  ingestionRuns: Array<{ mode: 'poll' | 'compensation'; status: string }>;
  stages: Array<{ stage: 'ingest' | 'context' | 'analysis' | 'score' | 'notify'; status: StageStatus; errorCode?: string }>;
  worker?: { status: string; heartbeatAt: string };
  notification: { enabled: boolean; configured: boolean; backlog: number };
  budget: { blocked: boolean; dailyBudgetCents: number; spentCents: number };
  visibility?: { firstObservedAt: string; visibleAt?: string; sloMinutes: number; blockedReason?: string };
}

export function buildOperationsStatus(input: OperationsInput) {
  const coreStages = input.stages.filter((item) => item.stage !== 'notify');
  const coreFailed = coreStages.some((item) => item.status === 'blocked' || item.status === 'dead_letter');
  const corePending = coreStages.some((item) => item.status !== 'succeeded');
  const visibility = input.visibility ? buildVisibilityStatus(input.visibility) : undefined;
  return {
    core: { status: coreFailed ? 'blocked' : corePending ? 'processing' : 'succeeded' },
    ingestion: {
      poll: countStatuses(input.ingestionRuns.filter((run) => run.mode === 'poll')),
      compensation: countStatuses(input.ingestionRuns.filter((run) => run.mode === 'compensation')),
    },
    stages: input.stages.map((item) => ({
      ...item,
      errorCode: item.errorCode ? safeErrorCode(item.errorCode) : undefined,
    })),
    worker: input.worker,
    notification: input.notification.enabled
      ? {
          enabled: true,
          configured: input.notification.configured,
          status: input.notification.configured ? 'enabled' : 'configuration_required',
          backlog: input.notification.backlog,
        }
      : { enabled: false, configured: false, status: 'disabled', backlog: 0 },
    budget: { ...input.budget, status: input.budget.blocked ? 'blocked' : 'available' },
    visibility,
  };
}

interface RecoveryRepository {
  findRecoverable(id: string): Promise<{
    id: string;
    status: string;
    manualRetryAllowed: boolean;
  } | undefined>;
  createAttempt(id: string, actorId: string): Promise<unknown>;
}

export class RecoveryService {
  constructor(private readonly repository: RecoveryRepository) {}

  async retry(id: string, actorId: string): Promise<unknown> {
    const work = await this.repository.findRecoverable(id);
    if (
      !work
      || !work.manualRetryAllowed
      || (work.status !== 'blocked' && work.status !== 'dead_letter')
    ) {
      throw new Error('not_recoverable');
    }
    return this.repository.createAttempt(id, actorId);
  }
}

function countStatuses(values: Array<{ status: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value.status] = (counts[value.status] ?? 0) + 1;
  return counts;
}

function buildVisibilityStatus(input: NonNullable<OperationsInput['visibility']>) {
  if (!input.visibleAt) {
    return { ...input, status: 'pending', metSlo: false, blockedReason: safeErrorCode(input.blockedReason) };
  }
  const durationMinutes = Math.max(0, (
    new Date(input.visibleAt).getTime() - new Date(input.firstObservedAt).getTime()
  ) / 60_000);
  return {
    ...input,
    durationMinutes,
    metSlo: durationMinutes <= input.sloMinutes,
    status: 'visible',
    blockedReason: safeErrorCode(input.blockedReason),
  };
}

function safeErrorCode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^[a-z0-9_]{1,64}$/.test(value) && !/secret|token|password|cookie|webhook|key/i.test(value)
    ? value
    : '[REDACTED]';
}
