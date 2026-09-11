import { mapPoseToNormalized } from '@/lib/cursor';
import { OneEuroFilter } from '@/lib/filter';
import type { RuntimeMessage } from '@/lib/messages';

const OFFSCREEN_URL = 'offscreen.html';
const CURSOR_FILTER_CONFIG = { minCutoff: 0.5, beta: 0.6 };
const cursorFilterX = new OneEuroFilter(CURSOR_FILTER_CONFIG);
const cursorFilterY = new OneEuroFilter(CURSOR_FILTER_CONFIG);

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

async function sendCursorMove(x: number, y: number): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id === undefined) return;
  const message: RuntimeMessage = { type: 'CURSOR_MOVE', payload: { x, y } };
  chrome.tabs.sendMessage(tab.id, message).catch(() => {});
}

async function startDetection(): Promise<void> {
  cursorFilterX.reset();
  cursorFilterY.reset();
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
      case 'DETECTION_STATUS': {
        const { x, y } = mapPoseToNormalized(runtimeMessage.payload.yaw, runtimeMessage.payload.pitch);
        const timestamp = runtimeMessage.payload.timestamp;
        void sendCursorMove(cursorFilterX.filter(x, timestamp), cursorFilterY.filter(y, timestamp));
        return false;
      }
      default:
        return false;
    }
  });
});
