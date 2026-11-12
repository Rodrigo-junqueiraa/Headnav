export type SpeechGestureGuardConfig = {
  cooldownMs: number;
  maxSessionMs: number;
};

export const DEFAULT_SPEECH_GESTURE_GUARD: SpeechGestureGuardConfig = {
  cooldownMs: 1000,
  maxSessionMs: 20000,
};

export class SpeechGestureGuard {
  private readonly config: SpeechGestureGuardConfig;
  private startedAtMs: number | null = null;
  private endedAtMs: number | null = null;

  constructor(config: Partial<SpeechGestureGuardConfig> = {}) {
    this.config = { ...DEFAULT_SPEECH_GESTURE_GUARD, ...config };
  }

  reset(): void {
    this.startedAtMs = null;
    this.endedAtMs = null;
  }

  start(timestampMs: number): void {
    if (this.startedAtMs === null || timestampMs - this.startedAtMs >= this.config.maxSessionMs) {
      this.startedAtMs = timestampMs;
    }
    this.endedAtMs = null;
  }

  end(timestampMs: number): void {
    if (this.startedAtMs === null) return;
    this.startedAtMs = null;
    this.endedAtMs = timestampMs;
  }

  isSuppressing(timestampMs: number): boolean {
    if (this.startedAtMs !== null) {
      const expiresAtMs = this.startedAtMs + this.config.maxSessionMs;
      return timestampMs < expiresAtMs + this.config.cooldownMs;
    }
    return this.endedAtMs !== null && timestampMs - this.endedAtMs < this.config.cooldownMs;
  }
}
