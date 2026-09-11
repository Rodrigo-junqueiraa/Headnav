import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from './filter';

function feed(filter: OneEuroFilter, values: number[], stepMs = 50): number[] {
  return values.map((value, index) => filter.filter(value, index * stepMs));
}

describe('OneEuroFilter', () => {
  it('returns the first sample unchanged', () => {
    expect(new OneEuroFilter().filter(0.5, 0)).toBe(0.5);
  });

  it('keeps a constant signal constant', () => {
    const out = feed(new OneEuroFilter(), new Array(20).fill(0.3));
    for (const value of out) expect(value).toBeCloseTo(0.3, 6);
  });

  it('reduces jitter around a steady value', () => {
    const noisy: number[] = [];
    for (let i = 0; i < 80; i += 1) noisy.push(0.5 + (i % 2 === 0 ? 0.05 : -0.05));
    const out = feed(new OneEuroFilter(), noisy).slice(30);
    const amplitude = Math.max(...out) - Math.min(...out);
    expect(amplitude).toBeLessThan(0.05);
  });

  it('eventually follows a step change', () => {
    const f = new OneEuroFilter();
    feed(f, new Array(20).fill(0));
    let last = 0;
    for (let i = 0; i < 60; i += 1) last = f.filter(1, (20 + i) * 50);
    expect(last).toBeGreaterThan(0.9);
  });

  it('resets its state', () => {
    const f = new OneEuroFilter();
    feed(f, new Array(10).fill(0.8));
    f.reset();
    expect(f.filter(0.2, 0)).toBe(0.2);
  });
});
