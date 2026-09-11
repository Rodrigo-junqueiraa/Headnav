import { describe, it, expect } from 'vitest';
import { mapPoseToNormalized, DEFAULT_CURSOR_OPTIONS } from './cursor';

describe('mapPoseToNormalized', () => {
  it('centers on a neutral pose', () => {
    expect(mapPoseToNormalized(0, 0)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('stays centered inside the deadzone', () => {
    expect(mapPoseToNormalized(1.5, -1.5, { deadzoneDeg: 2 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('moves right for positive yaw and left for negative without inversion', () => {
    expect(mapPoseToNormalized(25, 0, { invertX: false }).x).toBeGreaterThan(0.5);
    expect(mapPoseToNormalized(-25, 0, { invertX: false }).x).toBeLessThan(0.5);
  });

  it('mirrors the x axis by default to match the camera, keeps y direct', () => {
    expect(DEFAULT_CURSOR_OPTIONS.invertX).toBe(true);
    expect(DEFAULT_CURSOR_OPTIONS.invertY).toBe(false);
    expect(mapPoseToNormalized(30, 0).x).toBeLessThan(0.5);
    expect(mapPoseToNormalized(0, 30).y).toBeGreaterThan(0.5);
  });

  it('follows a pure power curve when centerGain is 0', () => {
    const half = mapPoseToNormalized(11, 0, {
      invertX: false,
      yawRangeDeg: 20,
      deadzoneDeg: 2,
      responseExponent: 2,
      centerGain: 0,
    }).x;
    expect(half).toBeCloseTo(0.625, 3);
  });

  it('centerGain keeps the center responsive (no dead pull)', () => {
    const common = { invertX: false, yawRangeDeg: 20, deadzoneDeg: 2, responseExponent: 2 } as const;
    const pure = mapPoseToNormalized(4, 0, { ...common, centerGain: 0 }).x;
    const blended = mapPoseToNormalized(4, 0, { ...common, centerGain: 0.6 }).x;
    expect(blended).toBeGreaterThan(pure);
  });

  it('clamps to [0, 1] beyond the configured range', () => {
    expect(mapPoseToNormalized(90, 90, { invertX: false, invertY: false })).toEqual({ x: 1, y: 1 });
    expect(mapPoseToNormalized(-90, -90, { invertX: false, invertY: false })).toEqual({ x: 0, y: 0 });
  });

  it('inverts each axis when requested', () => {
    expect(mapPoseToNormalized(25, 0, { invertX: true }).x).toBeLessThan(0.5);
    expect(mapPoseToNormalized(0, 25, { invertY: true }).y).toBeLessThan(0.5);
  });
});
