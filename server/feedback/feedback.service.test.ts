import { describe, expect, it, vi } from 'vitest';
import { FeedbackService } from './feedback.service.js';

describe('append-only feedback', () => {
  it.each(['important', 'known', 'irrelevant', 'follow', 'translation_error', 'analysis_error'])(
    'accepts %s and binds the authenticated actor on the server',
    async (type) => {
      const repository = { append: vi.fn().mockResolvedValue({ id: 'feedback-1' }) };
      const service = new FeedbackService(repository);
      await service.submit('father', { cardId: 'card-1', cardVersion: 1, type, note: '短备注' });
      expect(repository.append).toHaveBeenCalledWith(expect.objectContaining({
        actorId: 'father', cardId: 'card-1', cardVersion: 1, type,
      }));
    },
  );

  it('rejects unknown types, long notes and forged actor fields', async () => {
    const repository = { append: vi.fn() };
    const service = new FeedbackService(repository);
    await expect(service.submit('father', {
      cardId: 'card-1', cardVersion: 1, type: 'trade',
    })).rejects.toThrow();
    await expect(service.submit('father', {
      cardId: 'card-1', cardVersion: 1, type: 'important', note: 'x'.repeat(1001),
    })).rejects.toThrow();
    await expect(service.submit('father', {
      cardId: 'card-1', cardVersion: 1, type: 'important', actorId: 'requester',
    })).rejects.toThrow();
    expect(repository.append).not.toHaveBeenCalled();
  });

  it('propagates a missing-card rejection without manufacturing feedback', async () => {
    const repository = { append: vi.fn().mockRejectedValue(new Error('card_not_found')) };
    await expect(new FeedbackService(repository).submit('father', {
      cardId: 'missing', cardVersion: 1, type: 'known',
    })).rejects.toThrow(/card_not_found/);
  });
});
