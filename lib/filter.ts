export type OneEuroConfig = {
  minCutoff: number;
  beta: number;
  dCutoff: number;
};

export const DEFAULT_ONE_EURO_CONFIG: OneEuroConfig = {
  minCutoff: 1,
  beta: 0.5,
  dCutoff: 1,
};

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

class LowPassFilter {
  private hatXPrev = 0;
  private initialized = false;

  filter(x: number, alpha: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.hatXPrev = x;
      return x;
    }
    const hatX = alpha * x + (1 - alpha) * this.hatXPrev;
    this.hatXPrev = hatX;
    return hatX;
  }

  reset(): void {
    this.initialized = false;
  }
}

export class OneEuroFilter {
  private readonly config: OneEuroConfig;
  private readonly xFilter = new LowPassFilter();
  private readonly dxFilter = new LowPassFilter();
  private xPrev = 0;
  private tPrevMs = 0;
  private started = false;

  constructor(config: Partial<OneEuroConfig> = {}) {
    this.config = { ...DEFAULT_ONE_EURO_CONFIG, ...config };
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.started = false;
  }

  filter(x: number, timestampMs: number): number {
    if (!this.started) {
      this.started = true;
      this.xPrev = x;
      this.tPrevMs = timestampMs;
      return this.xFilter.filter(x, 1);
    }

    const dt = Math.max(1e-3, (timestampMs - this.tPrevMs) / 1000);
    const dx = (x - this.xPrev) / dt;
    const edx = this.dxFilter.filter(dx, smoothingFactor(this.config.dCutoff, dt));
    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(edx);
    const hatX = this.xFilter.filter(x, smoothingFactor(cutoff, dt));

    this.xPrev = x;
    this.tPrevMs = timestampMs;
    return hatX;
  }
}
