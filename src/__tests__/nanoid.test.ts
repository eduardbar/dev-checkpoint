import { describe, it, expect } from 'vitest';
import { nanoid } from '../utils/nanoid';

/** URL-safe alphabet used by nanoid */
const URL_SAFE_RE = /^[A-HJ-NP-Za-km-z2-9]+$/;

describe('nanoid', () => {
  it('returns a string of the requested length (default 6)', () => {
    expect(nanoid()).toHaveLength(6);
  });

  it('returns a string of a custom length', () => {
    expect(nanoid(12)).toHaveLength(12);
    expect(nanoid(1)).toHaveLength(1);
    expect(nanoid(32)).toHaveLength(32);
  });

  it('only contains URL-safe characters from the custom alphabet', () => {
    for (let i = 0; i < 100; i++) {
      expect(nanoid(10)).toMatch(URL_SAFE_RE);
    }
  });

  it('does not include ambiguous characters (0, O, I, l)', () => {
    const ids = Array.from({ length: 1000 }, () => nanoid(10)).join('');
    expect(ids).not.toMatch(/[0OIl]/);
  });

  it('produces no collisions in 1000 runs with length 6', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(nanoid());
    }
    // With 58^6 ≈ 38B possibilities, 1000 unique IDs is virtually guaranteed
    expect(ids.size).toBe(1000);
  });

  it('each call produces a different ID', () => {
    const a = nanoid();
    const b = nanoid();
    // Probability of collision is 1/38B — effectively impossible
    expect(a).not.toBe(b);
  });
});
