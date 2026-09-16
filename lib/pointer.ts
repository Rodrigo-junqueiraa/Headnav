export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type PointerSmoothingConfig = {
  freeTauMs: number;
  precisionTauMs: number;
  escapeRadiusPx: number;
};

export const DEFAULT_POINTER_SMOOTHING: PointerSmoothingConfig = {
  freeTauMs: 35,
  precisionTauMs: 250,
  escapeRadiusPx: 80,
};

export type MagnetConfig = {
  captureMarginPx: number;
  insetPx: number;
};

export const DEFAULT_MAGNET: MagnetConfig = {
  captureMarginPx: 24,
  insetPx: 4,
};

export function smoothPointer(
  current: Point,
  target: Point,
  elapsedMs: number,
  precision: boolean,
  config: PointerSmoothingConfig = DEFAULT_POINTER_SMOOTHING,
): Point {
  const distance = Math.hypot(target.x - current.x, target.y - current.y);
  const escape = Math.min(1, distance / config.escapeRadiusPx);
  const tauMs = precision
    ? config.precisionTauMs + (config.freeTauMs - config.precisionTauMs) * escape
    : config.freeTauMs;
  const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / tauMs);

  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
  };
}

function clampToSpan(value: number, min: number, max: number, inset: number): number {
  const low = min + inset;
  const high = max - inset;
  if (low > high) return (min + max) / 2;
  return Math.min(high, Math.max(low, value));
}

export function attractToTarget(point: Point, rect: Rect, config: MagnetConfig = DEFAULT_MAGNET): Point | null {
  const margin = config.captureMarginPx;
  const captured =
    point.x >= rect.left - margin &&
    point.x <= rect.right + margin &&
    point.y >= rect.top - margin &&
    point.y <= rect.bottom + margin;
  if (!captured) return null;

  return {
    x: clampToSpan(point.x, rect.left, rect.right, config.insetPx),
    y: clampToSpan(point.y, rect.top, rect.bottom, config.insetPx),
  };
}
