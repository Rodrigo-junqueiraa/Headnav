import type { RuntimeMessage, SpeechErrorCode, SpeechPhase } from '@/lib/messages';

const MAX_LISTENING_MS = 15000;

let recognition: SpeechRecognition | null = null;
let listeningLimit: ReturnType<typeof setTimeout> | undefined;

function send(message: RuntimeMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function sendPhase(phase: SpeechPhase): void {
  send({ type: 'SPEECH_STATUS', payload: { phase, lang: navigator.language } });
}

function sendError(code: SpeechErrorCode): void {
  send({ type: 'SPEECH_ERROR', payload: { code } });
}

function readTranscript(event: SpeechRecognitionEvent): { text: string; isFinal: boolean } {
  let text = '';
  let isFinal = true;
  for (const result of event.results) {
    text += result[0]?.transcript ?? '';
    isFinal &&= result.isFinal;
  }
  return { text: text.trim(), isFinal };
}

function createRecognition(): SpeechRecognition | null {
  const Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
  if (!Recognition) return null;

  const instance = new Recognition();
  instance.lang = navigator.language;
  instance.continuous = false;
  instance.interimResults = true;
  instance.maxAlternatives = 1;

  instance.addEventListener('audiostart', () => sendPhase('listening'));
  instance.addEventListener('soundstart', () => sendPhase('sound'));
  instance.addEventListener('speechstart', () => sendPhase('speech'));
  instance.addEventListener('result', (event) => {
    send({ type: 'SPEECH_RESULT', payload: readTranscript(event) });
  });
  instance.addEventListener('error', (event) => sendError(event.error));
  instance.addEventListener('end', () => {
    clearTimeout(listeningLimit);
    if (recognition === instance) recognition = null;
    sendPhase('ended');
  });

  return instance;
}

export function startSpeech(): void {
  if (recognition) return;

  const instance = createRecognition();
  if (!instance) {
    sendError('unsupported');
    return;
  }

  try {
    instance.start();
  } catch {
    sendError('startFailed');
    return;
  }

  recognition = instance;
  listeningLimit = setTimeout(() => instance.stop(), MAX_LISTENING_MS);
}

export function stopSpeech(): void {
  recognition?.stop();
}
