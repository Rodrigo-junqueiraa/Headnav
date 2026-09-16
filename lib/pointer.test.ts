import { describe, it, expect } from 'vitest';
import { attractToTarget, smoothPointer } from './pointer';

const smoothing = { freeTauMs: 40, precisionTauMs: 200, escapeRadiusPx: 60 };
const origin = { x: 100, y: 100 };

describe('smoothPointer', () => {
  it('does not move when no time has passed', () => {
    expect(smoothPointer(origin, { x: 110, y: 100 }, 0, false, smoothing)).toEqual(origin);
  });

  it('moves part of the way toward the target', () => {
    const next = smoothPointer(origin, { x: 110, y: 100 }, 16, false, smoothing);
    expect(next.x).toBeGreaterThan(100);
    expect(next.x).toBeLessThan(110);
    expect(next.y).toBe(100);
  });

  it('converges to the target over time', () => {
    const next = smoothPointer(origin, { x: 110, y: 90 }, 1000, false, smoothing);
    expect(next.x).toBeCloseTo(110, 3);
    expect(next.y).toBeCloseTo(90, 3);
  });

  it('moves less in precision mode for small offsets', () => {
    const target = { x: 110, y: 100 };
    const free = smoothPointer(origin, target, 16, false, smoothing);
    const precise = smoothPointer(origin, target, 16, true, smoothing);
    expect(precise.x - origin.x).toBeLessThan(free.x - origin.x);
  });

  it('escapes precision mode for large, deliberate moves', () => {
    const target = { x: 400, y: 100 };
    const free = smoothPointer(origin, target, 16, false, smoothing);
    const precise = smoothPointer(origin, target, 16, true, smoothing);
    expect(precise.x).toBeCloseTo(free.x, 6);
  });
});

describe('attractToTarget', () => {
  const rect = { left: 100, top: 100, right: 200, bottom: 140 };
  const magnet = { captureMarginPx: 20, insetPx: 4 };

  it('leaves a point inside the target unchanged', () => {
    expect(attractToTarget({ x: 150, y: 120 }, rect, magnet)).toEqual({ x: 150, y: 120 });
  });

  it('holds a nearby point just inside the edge', () => {
    expect(attractToTarget({ x: 210, y: 150 }, rect, magnet)).toEqual({ x: 196, y: 136 });
  });

  it('releases the point once it leaves the capture margin', () => {
    expect(attractToTarget({ x: 225, y: 120 }, rect, magnet)).toBeNull();
  });

  it('centers on an axis thinner than the inset', () => {
    const thin = { left: 100, top: 100, right: 200, bottom: 106 };
    expect(attractToTarget({ x: 150, y: 110 }, thin, magnet)).toEqual({ x: 150, y: 103 });
  });
});
