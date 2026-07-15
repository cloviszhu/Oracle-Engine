import { describe, expect, it, vi } from 'vitest';
import { FeishuDeliveryError } from '../infrastructure/notifications/feishu.adapter.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';

const work = {
  deliveryId: 'delivery-1',
  attempt: 1,
  message: {
    contentId: 'content-1',
    cardId: 'card-1', title: '重要情报', faithfulTranslation: '翻译',
    serenityJudgment: '判断', uncertainties: ['不确定'], importanceReason: 'score 80',
    sourceUrl: 'https://x.com/aleabitoreddit/status/1',
  },
};

function fixture(send: ReturnType<typeof vi.fn>, attempt = 1, maxAttempts = 3) {
  const repository = {
    beginAttempt: vi.fn().mockResolvedValue({ ...work, attempt }),
    finishAttempt: vi.fn().mockResolvedValue(undefined),
  };
  return {
    repository,
    service: new NotificationDeliveryService(repository, { send }, { maxAttempts }),
  };
}

describe('notification delivery state transitions', () => {
  it('records a successful signed delivery and provider ids', async () => {
    const { service, repository } = fixture(
      vi.fn().mockResolvedValue({ providerRequestId: 'request-1', providerMessageId: 'message-1' }),
    );
    await expect(service.deliver('delivery-1')).resolves.toEqual({ status: 'sent' });
    expect(repository.finishAttempt).toHaveBeenCalledWith(expect.objectContaining({
      deliveryId: 'delivery-1', attempt: 1, status: 'sent',
      providerRequestId: 'request-1', providerId: 'message-1', manualRetryAllowed: false,
    }));
  });

  it('keeps confirmed transient failure retryable below the cap and dead-letters at the cap', async () => {
    const error = new FeishuDeliveryError('provider_unavailable', true, false, 503, 'request-1');
    const below = fixture(vi.fn().mockRejectedValue(error), 2, 3);
    await expect(below.service.deliver('delivery-1')).resolves.toEqual({ status: 'retryable_failed' });
    expect(below.repository.finishAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: 'retryable_failed', manualRetryAllowed: false,
    }));

    const capped = fixture(vi.fn().mockRejectedValue(error), 3, 3);
    await expect(capped.service.deliver('delivery-1')).resolves.toEqual({ status: 'dead_letter' });
    expect(capped.repository.finishAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: 'dead_letter', manualRetryAllowed: true,
    }));
  });

  it('records a successful retry after a confirmed transient failure', async () => {
    const repository = {
      beginAttempt: vi.fn()
        .mockResolvedValueOnce({ ...work, attempt: 1 })
        .mockResolvedValueOnce({ ...work, attempt: 2 }),
      finishAttempt: vi.fn().mockResolvedValue(undefined),
    };
    const adapter = {
      send: vi.fn()
        .mockRejectedValueOnce(new FeishuDeliveryError('provider_unavailable', true, false, 503))
        .mockResolvedValueOnce({ providerMessageId: 'message-1' }),
    };
    const service = new NotificationDeliveryService(repository, adapter, { maxAttempts: 3 });

    await expect(service.deliver('delivery-1')).resolves.toEqual({ status: 'retryable_failed' });
    await expect(service.deliver('delivery-1')).resolves.toEqual({ status: 'sent' });
    expect(repository.finishAttempt).toHaveBeenNthCalledWith(2, expect.objectContaining({
      attempt: 2, status: 'sent', providerId: 'message-1',
    }));
  });

  it('marks ambiguous timeout outcome unknown and never schedules an automatic resend', async () => {
    const error = new FeishuDeliveryError('outcome_unknown', false, true);
    const { service, repository } = fixture(vi.fn().mockRejectedValue(error));
    await expect(service.deliver('delivery-1')).resolves.toEqual({ status: 'outcome_unknown' });
    expect(repository.finishAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: 'outcome_unknown', manualRetryAllowed: false,
    }));
  });

  it('blocks explicit signature rejection for visible manual recovery', async () => {
    const error = new FeishuDeliveryError('signature_rejected', false, false, 400);
    const { service, repository } = fixture(vi.fn().mockRejectedValue(error));
    await expect(service.deliver('delivery-1')).resolves.toEqual({ status: 'blocked' });
    expect(repository.finishAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: 'blocked', errorCode: 'signature_rejected', manualRetryAllowed: true,
    }));
  });

  it('treats an unexpected post-dispatch exception as outcome unknown', async () => {
    const { service, repository } = fixture(vi.fn().mockRejectedValue(new Error('unexpected')));
    await expect(service.deliver('delivery-1')).resolves.toEqual({ status: 'outcome_unknown' });
    expect(repository.finishAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: 'outcome_unknown', errorCode: 'outcome_unknown',
    }));
  });

  it('does nothing when durable work is no longer deliverable', async () => {
    const repository = { beginAttempt: vi.fn().mockResolvedValue(undefined), finishAttempt: vi.fn() };
    const adapter = { send: vi.fn() };
    const service = new NotificationDeliveryService(repository, adapter, { maxAttempts: 3 });
    await expect(service.deliver('delivery-1')).resolves.toEqual({ status: 'not_deliverable' });
    expect(adapter.send).not.toHaveBeenCalled();
  });
});
