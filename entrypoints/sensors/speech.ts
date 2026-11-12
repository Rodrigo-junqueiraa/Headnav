import type { RuntimeMessage, SpeechErrorCode, SpeechPhase } from '@/lib/messages';
import { checkLocalVoice, getRecognitionConstructor } from '@/lib/voice/localVoice';
import type { SpeechMode } from '@/lib/voice/speechMode';

const MAX_LISTENING_MS = 15000;

let recognition: SpeechRecognition | null = null;
let requestId = 0;

function send(message: RuntimeMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function sendPhase(phase: SpeechPhase, mode: SpeechMode, sessionId: string): void {
  send({ type: 'SPEECH_STATUS', payload: { phase, lang: navigator.language, mode, sessionId } });
}

function sendError(code: SpeechErrorCode, sessionId: string): void {
  send({ type: 'SPEECH_ERROR', payload: { code, sessionId } });
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

function createRecognition(
  Recognition: SpeechRecognitionConstructor,
  mode: SpeechMode,
  sessionId: string,
): SpeechRecognition {
  const instance = new Recognition();
  instance.lang = navigator.language;
  instance.continuous = false;
  instance.interimResults = true;
  instance.maxAlternatives = 1;
  if (mode === 'local') instance.processLocally = true;

  instance.addEventListener('audiostart', () => sendPhase('listening', mode, sessionId));
  instance.addEventListener('soundstart', () => sendPhase('sound', mode, sessionId));
  instance.addEventListener('speechstart', () => sendPhase('speech', mode, sessionId));
  instance.addEventListener('result', (event) => {
    send({ type: 'SPEECH_RESULT', payload: { ...readTranscript(event), sessionId } });
  });
  instance.addEventListener('error', (event) => sendError(event.error, sessionId));
  instance.addEventListener('end', () => {
    if (recognition === instance) recognition = null;
    sendPhase('ended', mode, sessionId);
  });

  return instance;
}

export async function startSpeech(mode: SpeechMode, sessionId: string): Promise<void> {
  if (recognition) recognition.abort();
  const request = ++requestId;

  const Recognition = getRecognitionConstructor();
  if (!Recognition) {
    sendError('unsupported', sessionId);
    return;
  }

  if (mode === 'local' && (await checkLocalVoice(navigator.language)) !== 'available') {
    if (request === requestId) sendError('localUnavailable', sessionId);
    return;
  }

  if (request !== requestId) return;

  const instance = createRecognition(Recognition, mode, sessionId);
  try {
    instance.start();
  } catch {
    sendError('startFailed', sessionId);
    return;
  }

  recognition = instance;
  const listeningLimit = setTimeout(() => instance.stop(), MAX_LISTENING_MS);
  instance.addEventListener('end', () => clearTimeout(listeningLimit));
}

export function stopSpeech(): void {
  requestId += 1;
  recognition?.stop();
}

export function abortSpeech(): void {
  requestId += 1;
  recognition?.abort();
}
