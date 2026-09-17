export type JawConfig = {
  holdMs: number;
  openThreshold: number;
  keepThreshold: number;
  flickerMs: number;
};

export const DEFAULT_JAW_CONFIG: JawConfig = {
  holdMs: 1400,
  openThreshold: 0.35,
  keepThreshold: 0.2,
  flickerMs: 400,
};

export type JawState = {
  active: boolean;
  progress: number;
  fired: boolean;
};

export class JawHoldDetector {
  private readonly config: JawConfig;
  private active = false;
  private startedAtMs = 0;
  private lastSeenMs = 0;
  private fired = false;

  constructor(config: Partial<JawConfig> = {}) {
    this.config = { ...DEFAULT_JAW_CONFIG, ...config };
  }

  reset(): void {
    this.active = false;
    this.fired = false;
  }

  update(jawOpen: number, timestampMs: number): JawState {
    const threshold = this.active ? this.config.keepThreshold : this.config.openThreshold;

    if (jawOpen < threshold) {
      if (this.active && !this.fired && timestampMs - this.lastSeenMs <= this.config.flickerMs) {
        return { active: true, progress: this.progressAt(timestampMs), fired: false };
      }
      this.reset();
      return { active: false, progress: 0, fired: false };
    }

    if (!this.active) {
      this.active = true;
      this.startedAtMs = timestampMs;
      this.fired = false;
    }
    this.lastSeenMs = timestampMs;

    if (this.fired) return { active: true, progress: 1, fired: false };

    const progress = this.progressAt(timestampMs);
    if (progress < 1) return { active: true, progress, fired: false };

    this.fired = true;
    return { active: true, progress: 1, fired: true };
  }

  private progressAt(timestampMs: number): number {
    return Math.min(1, (timestampMs - this.startedAtMs) / this.config.holdMs);
  }
}
