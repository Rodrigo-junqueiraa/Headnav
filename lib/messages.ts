export type DetectionStatus = {
  running: boolean;
  faceDetected: boolean;
  fps: number;
  yaw: number;
  pitch: number;
  roll: number;
  blinkLeft: number;
  blinkRight: number;
  jawOpen: number;
  timestamp: number;
};

export type GestureKind = 'back' | 'forward' | 'pause';

export type RuntimeMessage =
  | { type: 'START_DETECTION' }
  | { type: 'STOP_DETECTION' }
  | { type: 'QUERY_STATUS' }
  | { type: 'DETECTION_STATUS'; payload: DetectionStatus }
  | { type: 'DETECTION_STATE'; payload: { running: boolean } }
  | { type: 'CURSOR_MOVE'; payload: { x: number; y: number } }
  | { type: 'GESTURE_HOLD'; payload: { kind: GestureKind | null; progress: number; fired: boolean } }
  | { type: 'CLICKING_PAUSED'; payload: { paused: boolean } }
  | { type: 'DETECTION_ERROR'; payload: { message: string } };

export type StatusResponse = { running: boolean; clickingPaused: boolean };
