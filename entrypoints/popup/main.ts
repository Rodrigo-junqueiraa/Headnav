import { t, translatePage, type MessageKey } from '@/lib/i18n/translate';
import type {
  DetectionErrorCode,
  DetectionStatus,
  ForwardResponse,
  RuntimeMessage,
  SpeechErrorCode,
  SpeechPhase,
  StatusResponse,
} from '@/lib/messages';
import type { SpeechMode } from '@/lib/voice/speechMode';

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

const voiceButton = document.querySelector<HTMLButtonElement>('#voiceTest');
const voiceStatusEl = document.querySelector<HTMLSpanElement>('#voiceStatus');
const transcriptEl = document.querySelector<HTMLDivElement>('#transcript');

const PHASE_TEXT: Record<Exclude<SpeechPhase, 'listening'>, MessageKey> = {
  sound: 'popupVoiceSound',
  speech: 'popupVoiceSpeech',
  ended: 'popupVoiceEnded',
};

const MODE_TEXT: Record<SpeechMode, MessageKey> = {
  online: 'speechModeOnline',
  local: 'speechModeLocal',
};

const DETECTION_ERROR_TEXT: Record<DetectionErrorCode, MessageKey> = {
  cameraFailed: 'errorCameraFailed',
  videoFailed: 'errorVideoFailed',
  modelFailed: 'errorModelFailed',
  framesStalled: 'errorFramesStalled',
};

const MICROPHONE_BLOCKED: SpeechErrorCode[] = ['not-allowed', 'service-not-allowed', 'audio-capture'];

let running = false;
let voiceActive = false;
let voiceFailed = false;

function setRunning(value: boolean): void {
  running = value;
  if (toggleButton) toggleButton.textContent = t(value ? 'popupStop' : 'popupStart');
  dot?.classList.toggle('on', value);
  if (voiceButton) voiceButton.disabled = !value;
  if (!value) {
    resetReadouts();
    resetVoice();
  }
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
  if (faceEl) faceEl.textContent = t(status.faceDetected ? 'popupYes' : 'popupNo');
  if (fpsEl) fpsEl.textContent = String(status.fps);
  if (yawEl) yawEl.textContent = `${status.yaw.toFixed(1)}°`;
  if (pitchEl) pitchEl.textContent = `${status.pitch.toFixed(1)}°`;
  if (rollEl) rollEl.textContent = `${status.roll.toFixed(1)}°`;
  setBar('blinkLeft', status.blinkLeft);
  setBar('blinkRight', status.blinkRight);
  setBar('jawOpen', status.jawOpen);
}

function showError(code: DetectionErrorCode, detail: string): void {
  if (errorEl) errorEl.textContent = t(DETECTION_ERROR_TEXT[code], detail);
  if (hintEl) hintEl.textContent = t('popupCameraHint');
}

function setVoiceStatus(text: string): void {
  if (voiceStatusEl) voiceStatusEl.textContent = text;
}

function setVoiceActive(value: boolean): void {
  voiceActive = value;
  if (voiceButton) voiceButton.textContent = t(value ? 'popupStopVoiceTest' : 'popupTestVoice');
}

function resetVoice(): void {
  setVoiceActive(false);
  voiceFailed = false;
  setVoiceStatus('—');
  if (transcriptEl) transcriptEl.textContent = '';
}

function renderSpeechPhase(phase: SpeechPhase, lang: string, mode: SpeechMode): void {
  setVoiceActive(phase !== 'ended');
  if (phase === 'ended' && voiceFailed) return;
  setVoiceStatus(phase === 'listening' ? t('popupVoiceListening', [lang, t(MODE_TEXT[mode])]) : t(PHASE_TEXT[phase]));
}

function renderTranscript(text: string, isFinal: boolean): void {
  if (!transcriptEl) return;
  transcriptEl.textContent = text;
  transcriptEl.classList.toggle('interim', !isFinal);
}

function showSpeechError(code: SpeechErrorCode): void {
  voiceFailed = true;
  setVoiceActive(false);
  setVoiceStatus(t('popupVoiceError', code));
  if (hintEl && MICROPHONE_BLOCKED.includes(code)) {
    hintEl.textContent = t('popupMicHint');
  } else if (hintEl && code === 'localUnavailable') {
    hintEl.textContent = t('popupLocalVoiceHint');
  }
}

toggleButton?.addEventListener('click', () => {
  const type: RuntimeMessage['type'] = running ? 'STOP_DETECTION' : 'START_DETECTION';
  if (errorEl) errorEl.textContent = '';
  if (hintEl) hintEl.textContent = '';
  chrome.runtime.sendMessage({ type }).then(() => setRunning(!running)).catch(() => {});
});

grantButton?.addEventListener('click', () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
});

voiceButton?.addEventListener('click', () => {
  const type: RuntimeMessage['type'] = voiceActive ? 'VOICE_TEST_STOP' : 'VOICE_TEST_START';
  if (!voiceActive) {
    voiceFailed = false;
    renderTranscript('', true);
    setVoiceStatus(t('popupVoiceStarting'));
    if (hintEl) hintEl.textContent = '';
  }
  chrome.runtime
    .sendMessage({ type })
    .then((response: ForwardResponse | undefined) => {
      if (!response?.ok) setVoiceStatus(t('popupVoiceUnavailable'));
    })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((message) => {
  const runtimeMessage = message as RuntimeMessage;
  if (runtimeMessage.type === 'DETECTION_STATUS') {
    setRunning(true);
    renderStatus(runtimeMessage.payload);
  } else if (runtimeMessage.type === 'DETECTION_ERROR') {
    showError(runtimeMessage.payload.code, runtimeMessage.payload.detail);
  } else if (runtimeMessage.type === 'SPEECH_STATUS') {
    renderSpeechPhase(runtimeMessage.payload.phase, runtimeMessage.payload.lang, runtimeMessage.payload.mode);
  } else if (runtimeMessage.type === 'SPEECH_RESULT') {
    renderTranscript(runtimeMessage.payload.text, runtimeMessage.payload.isFinal);
  } else if (runtimeMessage.type === 'SPEECH_ERROR') {
    showSpeechError(runtimeMessage.payload.code);
  }
});

translatePage();

chrome.runtime
  .sendMessage({ type: 'QUERY_STATUS' })
  .then((response: StatusResponse | undefined) => setRunning(Boolean(response?.running)))
  .catch(() => setRunning(false));
