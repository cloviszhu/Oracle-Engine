import { createHash } from 'node:crypto';
import { z } from 'zod';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function computePayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(payload))).digest('hex');
}

export type LifecycleObservation =
  | { kind: 'found'; payloadHash: string }
  | { kind: 'missing_transient' }
  | { kind: 'explicit_deleted' }
  | { kind: 'missing_confirmed'; consecutiveChecks: number; requiredChecks: number };

export function planLifecycleObservation(input: { currentHash: string; observation: LifecycleObservation }) {
  const observation = input.observation;
  if (observation.kind === 'found') {
    return observation.payloadHash === input.currentHash
      ? { action: 'unchanged' as const }
      : { action: 'append_version' as const };
  }
  if (observation.kind === 'missing_transient') {
    return { action: 'verification_pending' as const, clearRestrictedText: false as const };
  }
  if (observation.kind === 'explicit_deleted') {
    return { action: 'tombstone' as const, visibility: 'deleted' as const, clearRestrictedText: true as const };
  }
  if (observation.consecutiveChecks >= observation.requiredChecks) {
    return { action: 'tombstone' as const, visibility: 'unavailable' as const, clearRestrictedText: true as const };
  }
  return { action: 'verification_pending' as const, clearRestrictedText: false as const };
}

const productionPolicySchema = z
  .object({
    confirmed: z.literal(true),
    confirmedBy: z.string().min(1).max(128),
    confirmedAt: z.string().datetime(),
    policyVersion: z.string().min(1).max(128),
    allowedTombstoneFields: z
      .array(z.enum(['provider', 'external_id', 'visibility', 'status_at', 'payload_hash']))
      .min(1),
  })
  .strict();

export function validateProductionPolicy(input: unknown) {
  return productionPolicySchema.parse(input);
}
