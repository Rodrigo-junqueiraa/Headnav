import type { RuntimeMessage, SpeechErrorCode, SpeechPhase } from '@/lib/messages';
import { checkLocalVoice, getRecognitionConstructor } from '@/lib/voice/localVoice';
import type { SpeechMode } from '@/lib/voice/speechMode';

const MAX_LISTENING_MS = 15000;

let recognition: SpeechRecognition | null = null;
let listeningLimit: ReturnType<typeof setTimeout> | undefined;
let requestId = 0;

function send(message: RuntimeMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function sendPhase(phase: SpeechPhase, mode: SpeechMode): void {
  send({ type: 'SPEECH_STATUS', payload: { phase, lang: navigator.language, mode } });
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

function createRecognition(Recognition: SpeechRecognitionConstructor, mode: SpeechMode): SpeechRecognition {
  const instance = new Recognition();
  instance.lang = navigator.language;
  instance.continuous = false;
  instance.interimResults = true;
  instance.maxAlternatives = 1;
  if (mode === 'local') instance.processLocally = true;

  instance.addEventListener('audiostart', () => sendPhase('listening', mode));
  instance.addEventListener('soundstart', () => sendPhase('sound', mode));
  instance.addEventListener('speechstart', () => sendPhase('speech', mode));
  instance.addEventListener('result', (event) => {
    send({ type: 'SPEECH_RESULT', payload: readTranscript(event) });
  });
  instance.addEventListener('error', (event) => sendError(event.error));
  instance.addEventListener('end', () => {
    clearTimeout(listeningLimit);
    if (recognition === instance) recognition = null;
    sendPhase('ended', mode);
  });

  return instance;
}

export async function startSpeech(mode: SpeechMode): Promise<void> {
  if (recognition) return;
  const request = ++requestId;

  const Recognition = getRecognitionConstructor();
  if (!Recognition) {
    sendError('unsupported');
    return;
  }

  if (mode === 'local' && (await checkLocalVoice(navigator.language)) !== 'available') {
    if (request === requestId) sendError('localUnavailable');
    return;
  }

  if (request !== requestId || recognition) return;

  const instance = createRecognition(Recognition, mode);
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
  requestId += 1;
  recognition?.stop();
}
