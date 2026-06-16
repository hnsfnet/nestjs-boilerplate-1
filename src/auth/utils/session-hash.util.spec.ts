import { generateSessionHash } from './session-hash.util';

describe('generateSessionHash', () => {
  it('should return a 64-character hex string (SHA-256 output)', () => {
    const hash = generateSessionHash();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce different hashes on consecutive calls', () => {
    const hash1 = generateSessionHash();
    const hash2 = generateSessionHash();
    expect(hash1).not.toBe(hash2);
  });
});
