import { OneEuroFilter } from '@/lib/cursor/oneEuroFilter';
import { mapPoseToNormalized } from '@/lib/cursor/poseToScreen';
import { JawHoldDetector } from '@/lib/gestures/jawHold';
import { WinkHoldDetector } from '@/lib/gestures/winkHold';
import type { DetectionStatus, ForwardResponse, GestureKind, RuntimeMessage, StatusResponse } from '@/lib/messages';
import { FacePresenceTracker } from '@/lib/tracking/facePresence';
import { SpeechGestureGuard } from '@/lib/voice/speechGestureGuard';
import { loadSpeechMode } from '@/lib/voice/speechMode';

const OFFSCREEN_URL = 'sensors.html';
const CURSOR_FILTER_CONFIG = { minCutoff: 0.5, beta: 0.6 };
const cursorFilterX = new OneEuroFilter(CURSOR_FILTER_CONFIG);
const cursorFilterY = new OneEuroFilter(CURSOR_FILTER_CONFIG);
const winkDetector = new WinkHoldDetector();
const jawDetector = new JawHoldDetector();
const speechGuard = new SpeechGestureGuard();
const facePresence = new FacePresenceTracker();
let gestureActive = false;
let clickingPaused = false;
let voiceActive = false;
let facePresent = true;

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function broadcastToTabs(message: RuntimeMessage): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined ? Promise.resolve() : chrome.tabs.sendMessage(tab.id, message).catch(() => {}),
    ),
  );
}

async function sendToActiveTab(message: RuntimeMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}

async function forwardToSensors(message: RuntimeMessage): Promise<ForwardResponse> {
  if (!(await hasOffscreenDocument())) return { ok: false };
  const response = (await chrome.runtime.sendMessage(message).catch(() => undefined)) as ForwardResponse | undefined;
  return { ok: Boolean(response?.ok) };
}

function sendGestureHold(kind: GestureKind | null, progress: number, fired: boolean): void {
  void sendToActiveTab({ type: 'GESTURE_HOLD', payload: { kind, progress, fired } });
}

function updateVoiceActive(timestampMs: number): void {
  const active = speechGuard.isSuppressing(timestampMs);
  if (active === voiceActive) return;
  voiceActive = active;
  winkDetector.reset();
  jawDetector.reset();
  void broadcastToTabs({ type: 'VOICE_ACTIVE', payload: { active } });
}

function runFaceGestures(status: DetectionStatus): boolean {
  const wink = winkDetector.update(status.blinkLeft, status.blinkRight, status.timestamp);

  if (wink.side !== null) {
    gestureActive = true;
    jawDetector.reset();
    sendGestureHold(wink.side === 'left' ? 'back' : 'forward', wink.progress, wink.fired !== null);
    return true;
  }

  const jaw = jawDetector.update(status.jawOpen, status.timestamp);

  if (jaw.fired) {
    clickingPaused = !clickingPaused;
    void broadcastToTabs({ type: 'CLICKING_PAUSED', payload: { paused: clickingPaused } });
  }

  if (jaw.active) {
    gestureActive = true;
    sendGestureHold('pause', jaw.progress, jaw.fired);
    return true;
  }

  return false;
}

function endGestureHold(): void {
  if (!gestureActive) return;
  gestureActive = false;
  cursorFilterX.reset();
  cursorFilterY.reset();
  sendGestureHold(null, 0, false);
}

function updateFacePresence(status: DetectionStatus): void {
  const present = facePresence.update(status.faceDetected, status.timestamp);
  if (present === facePresent) return;
  facePresent = present;
  winkDetector.reset();
  jawDetector.reset();
  cursorFilterX.reset();
  cursorFilterY.reset();
  endGestureHold();
  void broadcastToTabs({ type: 'FACE_PRESENCE', payload: { present } });
}

function handleDetectionStatus(status: DetectionStatus): void {
  updateVoiceActive(status.timestamp);
  updateFacePresence(status);
  if (!status.faceDetected) return;
  if (!voiceActive && runFaceGestures(status)) return;

  endGestureHold();

  const { x, y } = mapPoseToNormalized(status.yaw, status.pitch);
  void sendToActiveTab({
    type: 'CURSOR_MOVE',
    payload: { x: cursorFilterX.filter(x, status.timestamp), y: cursorFilterY.filter(y, status.timestamp) },
  });
}

async function startDetection(): Promise<void> {
  cursorFilterX.reset();
  cursorFilterY.reset();
  winkDetector.reset();
  jawDetector.reset();
  speechGuard.reset();
  facePresence.reset();
  gestureActive = false;
  clickingPaused = false;
  voiceActive = false;
  facePresent = true;
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification:
        'Run the webcam and face-landmark detection locally for hands-free navigation, and the microphone when the user starts voice dictation.',
    });
  }
  await broadcastToTabs({ type: 'DETECTION_STATE', payload: { running: true } });
}

async function stopDetection(): Promise<void> {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
  winkDetector.reset();
  jawDetector.reset();
  speechGuard.reset();
  facePresence.reset();
  gestureActive = false;
  clickingPaused = false;
  voiceActive = false;
  facePresent = true;
  await broadcastToTabs({ type: 'DETECTION_STATE', payload: { running: false } });
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const runtimeMessage = message as RuntimeMessage;

    switch (runtimeMessage.type) {
      case 'START_DETECTION':
        startDetection()
          .then(() => sendResponse({ ok: true }))
          .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
        return true;
      case 'STOP_DETECTION':
        stopDetection()
          .then(() => sendResponse({ ok: true }))
          .catch((error: unknown) => sendResponse({ ok: false, error: String(error) }));
        return true;
      case 'QUERY_STATUS':
        hasOffscreenDocument().then((running) => {
          const status: StatusResponse = { running, clickingPaused, voiceActive, facePresent };
          sendResponse(status);
        });
        return true;
      case 'DETECTION_STATUS':
        handleDetectionStatus(runtimeMessage.payload);
        return false;
      case 'VOICE_TEST_START':
        loadSpeechMode()
          .then((mode) => forwardToSensors({ type: 'SPEECH_START', payload: { mode } }))
          .then(sendResponse)
          .catch(() => sendResponse({ ok: false }));
        return true;
      case 'VOICE_TEST_STOP':
        forwardToSensors({ type: 'SPEECH_STOP' })
          .then(sendResponse)
          .catch(() => sendResponse({ ok: false }));
        return true;
      case 'SPEECH_STATUS':
        if (runtimeMessage.payload.phase === 'ended') speechGuard.end(Date.now());
        else speechGuard.start(Date.now());
        return false;
      case 'SPEECH_ERROR':
        speechGuard.end(Date.now());
        return false;
      default:
        return false;
    }
  });
});
