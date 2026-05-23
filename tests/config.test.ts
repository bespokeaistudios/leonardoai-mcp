import { describe, expect, it } from 'vitest';
import { getApiKey, LeonardoConfigError } from '../src/config.js';

describe('config', () => {
  it('reads LEONARDO_AI_API before LEONARDO_API_KEY', () => {
    expect(getApiKey({ LEONARDO_AI_API: 'primary', LEONARDO_API_KEY: 'fallback' })).toBe('primary');
  });

  it('falls back to LEONARDO_API_KEY', () => {
    expect(getApiKey({ LEONARDO_API_KEY: 'fallback' })).toBe('fallback');
  });

  it('throws a useful error when no key is configured', () => {
    expect(() => getApiKey({})).toThrow(LeonardoConfigError);
    expect(() => getApiKey({})).toThrow(/LEONARDO_AI_API/);
  });
});
