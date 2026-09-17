export type WinkSide = 'left' | 'right';

export type WinkConfig = {
  holdMs: number;
  minClosed: number;
  minDifference: number;
  keepClosed: number;
  keepDifference: number;
  maxOpen: number;
  flickerMs: number;
};

export const DEFAULT_WINK_CONFIG: WinkConfig = {
  holdMs: 2000,
  minClosed: 0.22,
  minDifference: 0.1,
  keepClosed: 0.14,
  keepDifference: 0.06,
  maxOpen: 0.55,
  flickerMs: 400,
};

export type WinkState = {
  side: WinkSide | null;
  progress: number;
  fired: WinkSide | null;
};

export function detectWinkSide(
  blinkLeft: number,
  blinkRight: number,
  config: WinkConfig = DEFAULT_WINK_CONFIG,
  activeSide: WinkSide | null = null,
): WinkSide | null {
  const closed = Math.max(blinkLeft, blinkRight);
  const open = Math.min(blinkLeft, blinkRight);
  const side: WinkSide = blinkLeft >= blinkRight ? 'left' : 'right';
  const holding = activeSide === side;
  const minClosed = holding ? config.keepClosed : config.minClosed;
  const minDifference = holding ? config.keepDifference : config.minDifference;

  if (closed < minClosed) return null;
  if (open > config.maxOpen) return null;
  if (closed - open < minDifference) return null;
  return side;
}

export class WinkHoldDetector {
  private readonly config: WinkConfig;
  private side: WinkSide | null = null;
  private startedAtMs = 0;
  private lastSeenMs = 0;
  private fired = false;

  constructor(config: Partial<WinkConfig> = {}) {
    this.config = { ...DEFAULT_WINK_CONFIG, ...config };
  }

  reset(): void {
    this.side = null;
    this.fired = false;
  }

  update(blinkLeft: number, blinkRight: number, timestampMs: number): WinkState {
    const side = detectWinkSide(blinkLeft, blinkRight, this.config, this.side);

    if (side === null) {
      if (this.side !== null && !this.fired && timestampMs - this.lastSeenMs <= this.config.flickerMs) {
        return { side: this.side, progress: this.progressAt(timestampMs), fired: null };
      }
      this.reset();
      return { side: null, progress: 0, fired: null };
    }

    if (side !== this.side) {
      this.side = side;
      this.startedAtMs = timestampMs;
      this.fired = false;
    }
    this.lastSeenMs = timestampMs;

    if (this.fired) return { side, progress: 1, fired: null };

    const progress = this.progressAt(timestampMs);
    if (progress < 1) return { side, progress, fired: null };

    this.fired = true;
    return { side, progress: 1, fired: side };
  }

  private progressAt(timestampMs: number): number {
    return Math.min(1, (timestampMs - this.startedAtMs) / this.config.holdMs);
  }
}
