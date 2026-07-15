import { describe, expect, it } from 'vitest';
import { aiAuthBinding, resolveBoundAIKey } from './ai-auth-binding.js';

describe('AI credential endpoint binding', () => {
  it('reuses a stored key only for the same preset and normalized origin', () => {
    const saved = { authBinding: aiAuthBinding({ providerPreset: 'openai', baseUrl: '' }) };
    expect(resolveBoundAIKey({ providerPreset: 'openai', baseUrl: 'https://api.openai.com/' }, saved, 'stored-key')).toBe('stored-key');
    expect(resolveBoundAIKey({ providerPreset: 'openai', baseUrl: 'https://attacker.example' }, saved, 'stored-key')).toBeUndefined();
    expect(resolveBoundAIKey({ providerPreset: 'custom', baseUrl: 'https://api.openai.com' }, saved, 'stored-key')).toBeUndefined();
  });
});
