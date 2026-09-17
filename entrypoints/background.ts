import { mapPoseToNormalized } from '@/lib/cursor';
import { OneEuroFilter } from '@/lib/filter';
import type { DetectionStatus, RuntimeMessage } from '@/lib/messages';
import { WinkHoldDetector } from '@/lib/wink';

const OFFSCREEN_URL = 'offscreen.html';
const CURSOR_FILTER_CONFIG = { minCutoff: 0.5, beta: 0.6 };
const cursorFilterX = new OneEuroFilter(CURSOR_FILTER_CONFIG);
const cursorFilterY = new OneEuroFilter(CURSOR_FILTER_CONFIG);
const winkDetector = new WinkHoldDetector();
let gestureActive = false;

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function notifyTabs(running: boolean): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const message: RuntimeMessage = { type: 'DETECTION_STATE', payload: { running } };
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

function handleDetectionStatus(status: DetectionStatus): void {
  const wink = winkDetector.update(status.blinkLeft, status.blinkRight, status.timestamp);

  if (wink.side !== null) {
    gestureActive = true;
    void sendToActiveTab({
      type: 'NAVIGATION_GESTURE',
      payload: { side: wink.side, progress: wink.progress, fired: wink.fired !== null },
    });
    return;
  }

  if (gestureActive) {
    gestureActive = false;
    cursorFilterX.reset();
    cursorFilterY.reset();
    void sendToActiveTab({ type: 'NAVIGATION_GESTURE', payload: { side: null, progress: 0, fired: false } });
  }

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
  gestureActive = false;
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: 'Run the webcam and face-landmark detection locally for hands-free navigation.',
    });
  }
  await notifyTabs(true);
}

async function stopDetection(): Promise<void> {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
  winkDetector.reset();
  gestureActive = false;
  await notifyTabs(false);
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
        hasOffscreenDocument().then((running) => sendResponse({ running }));
        return true;
      case 'DETECTION_STATUS':
        handleDetectionStatus(runtimeMessage.payload);
        return false;
      default:
        return false;
    }
  });
});
