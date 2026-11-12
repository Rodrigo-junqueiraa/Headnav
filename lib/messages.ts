import type { SpeechMode } from '@/lib/voice/speechMode';

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

export type DetectionErrorCode = 'cameraFailed' | 'videoFailed' | 'modelFailed' | 'framesStalled';

export type SpeechPhase = 'listening' | 'sound' | 'speech' | 'ended';

export type SpeechErrorCode = SpeechRecognitionErrorCode | 'unsupported' | 'startFailed' | 'localUnavailable';

export type RuntimeMessage =
  | { type: 'START_DETECTION' }
  | { type: 'STOP_DETECTION' }
  | { type: 'QUERY_STATUS' }
  | { type: 'DETECTION_STATUS'; payload: DetectionStatus }
  | { type: 'DETECTION_STATE'; payload: { running: boolean } }
  | { type: 'CURSOR_MOVE'; payload: { x: number; y: number } }
  | { type: 'GESTURE_HOLD'; payload: { kind: GestureKind | null; progress: number; fired: boolean } }
  | { type: 'CLICKING_PAUSED'; payload: { paused: boolean } }
  | { type: 'DETECTION_ERROR'; payload: { code: DetectionErrorCode; detail: string } }
  | { type: 'VOICE_TEST_START' }
  | { type: 'VOICE_TEST_STOP' }
  | { type: 'SPEECH_START'; payload: { mode: SpeechMode } }
  | { type: 'SPEECH_STOP' }
  | { type: 'SPEECH_STATUS'; payload: { phase: SpeechPhase; lang: string; mode: SpeechMode } }
  | { type: 'SPEECH_RESULT'; payload: { text: string; isFinal: boolean } }
  | { type: 'SPEECH_ERROR'; payload: { code: SpeechErrorCode } }
  | { type: 'VOICE_ACTIVE'; payload: { active: boolean } }
  | { type: 'FACE_PRESENCE'; payload: { present: boolean } };

export type ForwardResponse = { ok: boolean };

export type StatusResponse = { running: boolean; clickingPaused: boolean; voiceActive: boolean; facePresent: boolean };
