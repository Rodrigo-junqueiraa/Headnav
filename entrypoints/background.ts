import { OneEuroFilter } from '@/lib/cursor/oneEuroFilter';
import { mapPoseToNormalized } from '@/lib/cursor/poseToScreen';
import { JawHoldDetector } from '@/lib/gestures/jawHold';
import { WinkHoldDetector } from '@/lib/gestures/winkHold';
import { t } from '@/lib/i18n/translate';
import type { DetectionStatus, ForwardResponse, GestureKind, RuntimeMessage, StatusResponse } from '@/lib/messages';
import { FacePresenceTracker } from '@/lib/tracking/facePresence';
import { SpeechGestureGuard } from '@/lib/voice/speechGestureGuard';
import { DEFAULT_SPEECH_MODE, loadSpeechMode, type SpeechMode } from '@/lib/voice/speechMode';

type DictationSession = { id: string; tabId: number | null };

const OFFSCREEN_URL = 'sensors.html';
const CONTENT_SCRIPT_FILE = 'content-scripts/pageCursor.js';
const PAGE_URL_PATTERNS = ['http://*/*', 'https://*/*'];
const CURSOR_FILTER_CONFIG = { minCutoff: 0.5, beta: 0.6 };
const FACE_LOST_STOP_MS = 1000;
const CAMERA_BADGE_COLOR = '#15803d';
const MICROPHONE_BADGE_COLOR = '#dc2626';
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
let session: DictationSession | null = null;
let microphoneOn = false;
let faceStopSentFor: string | null = null;

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

async function injectIntoOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: PAGE_URL_PATTERNS });
  await Promise.all(
    tabs.map((tab) => {
      if (tab.id === undefined || tab.discarded) return Promise.resolve();
      return chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT_FILE] })
        .then(
          () => undefined,
          () => undefined,
        );
    }),
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

function currentSpeechMode(): Promise<SpeechMode> {
  return loadSpeechMode().catch(() => DEFAULT_SPEECH_MODE);
}

function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function startSession(sessionId: string, tabId: number | null): Promise<ForwardResponse> {
  const mode = await currentSpeechMode();
  session = { id: sessionId, tabId };
  const response = await forwardToSensors({ type: 'SPEECH_START', payload: { mode, sessionId } });
  if (!response.ok && session?.id === sessionId) session = null;
  return response;
}

async function stopSession(sessionId: string | null): Promise<ForwardResponse> {
  if (sessionId !== null && session?.id !== sessionId) return { ok: false };
  return forwardToSensors({ type: 'SPEECH_STOP' });
}

async function abortSession(sessionId: string | null): Promise<ForwardResponse> {
  if (sessionId !== null && session?.id !== sessionId) return { ok: false };
  const aborted = session;
  session = null;
  if (aborted?.tabId != null) {
    const notice: RuntimeMessage = { type: 'SPEECH_ERROR', payload: { code: 'aborted', sessionId: aborted.id } };
    chrome.tabs.sendMessage(aborted.tabId, notice).catch(() => {});
  }
  return forwardToSensors({ type: 'SPEECH_ABORT' });
}

function abortSessionOfTab(matches: (sessionTabId: number) => boolean): void {
  if (session?.tabId == null || !matches(session.tabId)) return;
  void abortSession(session.id);
}

async function updateActionBadge(): Promise<void> {
  const running = await hasOffscreenDocument();
  const badge = microphoneOn ? t('actionBadgeMicrophone') : running ? t('actionBadgeCamera') : '';
  await chrome.action.setBadgeText({ text: badge });
  if (badge !== '') {
    await chrome.action.setBadgeBackgroundColor({ color: microphoneOn ? MICROPHONE_BADGE_COLOR : CAMERA_BADGE_COLOR });
  }
  const title = microphoneOn ? 'actionTitleMicrophoneOn' : running ? 'actionTitleCameraOn' : 'actionTitleOff';
  await chrome.action.setTitle({ title: t(title) });
}

function setMicrophoneOn(on: boolean): void {
  if (on === microphoneOn) return;
  microphoneOn = on;
  void updateActionBadge().catch(() => {});
}

function stopListeningWithoutFace(timestampMs: number): void {
  if (!session || !microphoneOn || faceStopSentFor === session.id) return;
  if (facePresence.missingForMs(timestampMs) < FACE_LOST_STOP_MS) return;
  faceStopSentFor = session.id;
  void stopSession(session.id);
}

function relaySpeechEvent(message: RuntimeMessage, sessionId: string, finished: boolean): void {
  if (session?.id !== sessionId) return;
  if (session.tabId !== null) chrome.tabs.sendMessage(session.tabId, message).catch(() => {});
  if (finished) session = null;
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
  stopListeningWithoutFace(status.timestamp);
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
  await updateActionBadge().catch(() => {});
  await broadcastToTabs({ type: 'DETECTION_STATE', payload: { running: true } });
}

async function stopDetection(): Promise<void> {
  if (session) await abortSession(null);
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
  microphoneOn = false;
  faceStopSentFor = null;
  await updateActionBadge().catch(() => {});
  await broadcastToTabs({ type: 'DETECTION_STATE', payload: { running: false } });
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        Promise.all([hasOffscreenDocument(), currentSpeechMode()]).then(([running, speechMode]) => {
          const status: StatusResponse = { running, clickingPaused, voiceActive, facePresent, speechMode };
          sendResponse(status);
        });
        return true;
      case 'DETECTION_STATUS':
        handleDetectionStatus(runtimeMessage.payload);
        return false;
      case 'VOICE_TEST_START':
        startSession(newSessionId(), null)
          .then(sendResponse)
          .catch(() => sendResponse({ ok: false }));
        return true;
      case 'VOICE_TEST_STOP':
        stopSession(null)
          .then(sendResponse)
          .catch(() => sendResponse({ ok: false }));
        return true;
      case 'DICTATION_START':
        startSession(runtimeMessage.payload.sessionId, sender.tab?.id ?? null)
          .then(sendResponse)
          .catch(() => sendResponse({ ok: false }));
        return true;
      case 'DICTATION_STOP':
        stopSession(runtimeMessage.payload.sessionId)
          .then(sendResponse)
          .catch(() => sendResponse({ ok: false }));
        return true;
      case 'DICTATION_ABORT':
        abortSession(runtimeMessage.payload.sessionId)
          .then(sendResponse)
          .catch(() => sendResponse({ ok: false }));
        return true;
      case 'SPEECH_STATUS': {
        const ended = runtimeMessage.payload.phase === 'ended';
        if (ended) speechGuard.end(Date.now());
        else speechGuard.start(Date.now());
        setMicrophoneOn(!ended);
        relaySpeechEvent(runtimeMessage, runtimeMessage.payload.sessionId, ended);
        return false;
      }
      case 'SPEECH_RESULT':
        relaySpeechEvent(runtimeMessage, runtimeMessage.payload.sessionId, false);
        return false;
      case 'SPEECH_ERROR':
        speechGuard.end(Date.now());
        setMicrophoneOn(false);
        relaySpeechEvent(runtimeMessage, runtimeMessage.payload.sessionId, true);
        return false;
      default:
        return false;
    }
  });

  chrome.runtime.onInstalled.addListener(() => {
    void injectIntoOpenTabs().catch(() => {});
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => abortSessionOfTab((sessionTabId) => sessionTabId !== tabId));
  chrome.tabs.onRemoved.addListener((tabId) => abortSessionOfTab((sessionTabId) => sessionTabId === tabId));
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'loading' && changeInfo.url === undefined) return;
    abortSessionOfTab((sessionTabId) => sessionTabId === tabId);
  });

  void updateActionBadge().catch(() => {});
});
