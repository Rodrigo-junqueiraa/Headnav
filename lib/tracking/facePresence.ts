export type FacePresenceConfig = {
  lostAfterMs: number;
};

export const DEFAULT_FACE_PRESENCE: FacePresenceConfig = {
  lostAfterMs: 300,
};

export class FacePresenceTracker {
  private readonly config: FacePresenceConfig;
  private present = true;
  private missingSinceMs: number | null = null;

  constructor(config: Partial<FacePresenceConfig> = {}) {
    this.config = { ...DEFAULT_FACE_PRESENCE, ...config };
  }

  reset(): void {
    this.present = true;
    this.missingSinceMs = null;
  }

  update(faceDetected: boolean, timestampMs: number): boolean {
    if (faceDetected) {
      this.present = true;
      this.missingSinceMs = null;
      return true;
    }

    this.missingSinceMs ??= timestampMs;
    if (timestampMs - this.missingSinceMs >= this.config.lostAfterMs) this.present = false;
    return this.present;
  }

  missingForMs(timestampMs: number): number {
    return this.missingSinceMs === null ? 0 : timestampMs - this.missingSinceMs;
  }
}
