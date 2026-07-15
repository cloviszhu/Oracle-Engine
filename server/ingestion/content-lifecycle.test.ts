import { describe, expect, it } from 'vitest';
import {
  computePayloadHash,
  planLifecycleObservation,
  validateProductionPolicy,
} from './content-lifecycle.js';

describe('content version and lifecycle policy', () => {
  it('produces a stable hash independent of object key order', () => {
    expect(computePayloadHash({ id: '1', text: 'same' })).toBe(
      computePayloadHash({ text: 'same', id: '1' }),
    );
  });

  it('appends a version only when the normalized payload changes', () => {
    expect(planLifecycleObservation({ currentHash: 'a', observation: { kind: 'found', payloadHash: 'a' } })).toMatchObject({ action: 'unchanged' });
    expect(planLifecycleObservation({ currentHash: 'a', observation: { kind: 'found', payloadHash: 'b' } })).toMatchObject({ action: 'append_version' });
  });

  it('keeps archived text when lookup absence is transient', () => {
    expect(planLifecycleObservation({ currentHash: 'a', observation: { kind: 'missing_transient' } })).toEqual({
      action: 'verification_pending', clearRestrictedText: false,
    });
  });

  it('clears restricted text only for explicit or threshold-confirmed absence', () => {
    expect(planLifecycleObservation({ currentHash: 'a', observation: { kind: 'explicit_deleted' } })).toEqual({
      action: 'tombstone', visibility: 'deleted', clearRestrictedText: true,
    });
    expect(
      planLifecycleObservation({
        currentHash: 'a', observation: { kind: 'missing_confirmed', consecutiveChecks: 3, requiredChecks: 3 },
      }),
    ).toEqual({ action: 'tombstone', visibility: 'unavailable', clearRestrictedText: true });
  });

  it('requires a named, versioned policy confirmation before production sync', () => {
    expect(() => validateProductionPolicy({ confirmed: true, confirmedBy: '', confirmedAt: '', policyVersion: '', allowedTombstoneFields: [] })).toThrow();
    expect(
      validateProductionPolicy({
        confirmed: true, confirmedBy: 'reviewer', confirmedAt: '2026-07-15T00:00:00Z',
        policyVersion: 'x-policy-2026-07', allowedTombstoneFields: ['provider', 'external_id', 'status_at'],
      }),
    ).toMatchObject({ confirmedBy: 'reviewer' });
  });
});
