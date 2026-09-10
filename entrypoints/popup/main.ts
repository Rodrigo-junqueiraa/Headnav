import type { DetectionStatus, RuntimeMessage, StatusResponse } from '@/lib/messages';

const dot = document.querySelector<HTMLSpanElement>('#dot');
const toggleButton = document.querySelector<HTMLButtonElement>('#toggle');
const grantButton = document.querySelector<HTMLButtonElement>('#grant');
const errorEl = document.querySelector<HTMLDivElement>('#error');
const hintEl = document.querySelector<HTMLDivElement>('#hint');

const faceEl = document.querySelector<HTMLSpanElement>('#face');
const fpsEl = document.querySelector<HTMLSpanElement>('#fps');
const yawEl = document.querySelector<HTMLSpanElement>('#yaw');
const pitchEl = document.querySelector<HTMLSpanElement>('#pitch');
const rollEl = document.querySelector<HTMLSpanElement>('#roll');

let running = false;

function setRunning(value: boolean): void {
  running = value;
  if (toggleButton) toggleButton.textContent = value ? 'Stop' : 'Start';
  dot?.classList.toggle('on', value);
  if (!value) resetReadouts();
}

function setBar(id: string, value: number): void {
  const fill = document.querySelector<HTMLDivElement>(`#${id}`);
  const label = document.querySelector<HTMLSpanElement>(`#${id}Val`);
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  if (fill) fill.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}%`;
}

function resetReadouts(): void {
  for (const el of [faceEl, fpsEl, yawEl, pitchEl, rollEl]) {
    if (el) el.textContent = '—';
  }
  setBar('blinkLeft', 0);
  setBar('blinkRight', 0);
  setBar('jawOpen', 0);
}

function renderStatus(status: DetectionStatus): void {
  if (faceEl) faceEl.textContent = status.faceDetected ? 'yes' : 'no';
  if (fpsEl) fpsEl.textContent = String(status.fps);
  if (yawEl) yawEl.textContent = `${status.yaw.toFixed(1)}°`;
  if (pitchEl) pitchEl.textContent = `${status.pitch.toFixed(1)}°`;
  if (rollEl) rollEl.textContent = `${status.roll.toFixed(1)}°`;
  setBar('blinkLeft', status.blinkLeft);
  setBar('blinkRight', status.blinkRight);
  setBar('jawOpen', status.jawOpen);
}

function showError(message: string): void {
  if (errorEl) errorEl.textContent = message;
  if (hintEl) {
    hintEl.textContent = 'If the camera is blocked, click "Camera access" and allow it, then start again.';
  }
}

toggleButton?.addEventListener('click', () => {
  const type: RuntimeMessage['type'] = running ? 'STOP_DETECTION' : 'START_DETECTION';
  if (errorEl) errorEl.textContent = '';
  if (hintEl) hintEl.textContent = '';
  chrome.runtime.sendMessage({ type }).then(() => setRunning(!running)).catch(() => {});
});

grantButton?.addEventListener('click', () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') });
});

chrome.runtime.onMessage.addListener((message) => {
  const runtimeMessage = message as RuntimeMessage;
  if (runtimeMessage.type === 'DETECTION_STATUS') {
    setRunning(true);
    renderStatus(runtimeMessage.payload);
  } else if (runtimeMessage.type === 'DETECTION_ERROR') {
    showError(runtimeMessage.payload.message);
  }
});

chrome.runtime
  .sendMessage({ type: 'QUERY_STATUS' })
  .then((response: StatusResponse | undefined) => setRunning(Boolean(response?.running)))
  .catch(() => setRunning(false));
