export type CursorMapOptions = {
  yawRangeDeg: number;
  pitchRangeDeg: number;
  deadzoneDeg: number;
  responseExponent: number;
  centerGain: number;
  invertX: boolean;
  invertY: boolean;
};

export const DEFAULT_CURSOR_OPTIONS: CursorMapOptions = {
  yawRangeDeg: 11,
  pitchRangeDeg: 9,
  deadzoneDeg: 1,
  responseExponent: 2,
  centerGain: 0.9,
  invertX: true,
  invertY: false,
};

function axisToNormalized(
  angleDeg: number,
  rangeDeg: number,
  deadzoneDeg: number,
  exponent: number,
  centerGain: number,
  invert: boolean,
): number {
  const sign = Math.sign(angleDeg);
  const magnitude = Math.max(0, Math.abs(angleDeg) - deadzoneDeg);
  const span = Math.max(1e-6, rangeDeg - deadzoneDeg);
  const t = Math.min(1, magnitude / span);
  const curved = centerGain * t + (1 - centerGain) * Math.pow(t, exponent);
  const normalized = 0.5 + sign * curved * 0.5;
  return invert ? 1 - normalized : normalized;
}

export function mapPoseToNormalized(
  yawDeg: number,
  pitchDeg: number,
  options: Partial<CursorMapOptions> = {},
): { x: number; y: number } {
  const opts = { ...DEFAULT_CURSOR_OPTIONS, ...options };
  return {
    x: axisToNormalized(yawDeg, opts.yawRangeDeg, opts.deadzoneDeg, opts.responseExponent, opts.centerGain, opts.invertX),
    y: axisToNormalized(pitchDeg, opts.pitchRangeDeg, opts.deadzoneDeg, opts.responseExponent, opts.centerGain, opts.invertY),
  };
}
