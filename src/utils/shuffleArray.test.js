import { describe, it, expect } from 'vitest';
import { shuffleArray } from './shuffleArray';

describe('shuffleArray', () => {
  it('returns an array with the same elements', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const result = shuffleArray(input);

    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5];
    const original = [...input];
    shuffleArray(input);

    expect(input).toEqual(original);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray(['only'])).toEqual(['only']);
  });
});