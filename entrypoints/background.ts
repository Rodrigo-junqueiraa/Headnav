import type { RuntimeMessage } from '@/lib/messages';

const OFFSCREEN_URL = 'offscreen.html';

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function startDetection(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Run the webcam and face-landmark detection locally for hands-free navigation.',
  });
}

async function stopDetection(): Promise<void> {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
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
      default:
        return false;
    }
  });
});
