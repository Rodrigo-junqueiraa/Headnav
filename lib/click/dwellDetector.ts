export type DwellConfig = {
  dwellMs: number;
  graceMs: number;
  rearmDistancePx: number;
};

export const DEFAULT_DWELL_CONFIG: DwellConfig = {
  dwellMs: 1500,
  graceMs: 300,
  rearmDistancePx: 20,
};

export type DwellState = {
  progress: number;
  fired: boolean;
};

export class DwellDetector<Target> {
  private readonly config: DwellConfig;
  private initialized = false;
  private current: Target | null = null;
  private currentSinceMs = 0;
  private candidate: Target | null = null;
  private candidateSinceMs = 0;
  private leftAtMs: number | null = null;
  private armed = false;
  private disarmX = 0;
  private disarmY = 0;

  constructor(config: Partial<DwellConfig> = {}) {
    this.config = { ...DEFAULT_DWELL_CONFIG, ...config };
  }

  reset(): void {
    this.initialized = false;
    this.leftAtMs = null;
    this.armed = false;
  }

  update(target: Target | null, x: number, y: number, timestampMs: number): DwellState {
    if (!this.initialized) {
      this.initialized = true;
      this.current = target;
      this.currentSinceMs = timestampMs;
      this.disarm(x, y);
      return { progress: 0, fired: false };
    }

    if (target === this.current) {
      this.leftAtMs = null;
    } else {
      this.trackCandidate(target, x, y, timestampMs);
    }

    if (this.current === null || !this.armed) return { progress: 0, fired: false };

    const progress = Math.min(1, (timestampMs - this.currentSinceMs) / this.config.dwellMs);
    if (progress < 1 || target !== this.current) return { progress, fired: false };

    this.disarm(x, y);
    return { progress: 1, fired: true };
  }

  private trackCandidate(target: Target | null, x: number, y: number, timestampMs: number): void {
    if (this.leftAtMs === null) {
      this.leftAtMs = timestampMs;
      this.candidate = target;
      this.candidateSinceMs = timestampMs;
    } else if (target !== this.candidate) {
      this.candidate = target;
      this.candidateSinceMs = timestampMs;
    }

    if (timestampMs - this.leftAtMs < this.config.graceMs) return;

    this.current = this.candidate;
    this.currentSinceMs = this.candidateSinceMs;
    this.leftAtMs = null;
    if (Math.hypot(x - this.disarmX, y - this.disarmY) > this.config.rearmDistancePx) {
      this.armed = true;
    }
  }

  private disarm(x: number, y: number): void {
    this.armed = false;
    this.disarmX = x;
    this.disarmY = y;
  }
}
