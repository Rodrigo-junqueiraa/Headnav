import type { SpeechErrorCode } from '@/lib/messages';

export type DictationStage = 'closed' | 'ready' | 'starting' | 'listening' | 'review' | 'error';

export type DictationState = {
  stage: DictationStage;
  text: string;
  isFinal: boolean;
  errorCode: SpeechErrorCode | null;
  sinceMs: number;
};

export type DictationEvent =
  | { type: 'open' }
  | { type: 'speak' }
  | { type: 'listening' }
  | { type: 'transcript'; text: string; isFinal: boolean }
  | { type: 'ended' }
  | { type: 'failed'; code: SpeechErrorCode }
  | { type: 'finish' }
  | { type: 'close' }
  | { type: 'tick' };

export type DictationEffect = 'startMic' | 'stopMic' | 'abortMic' | null;

export type DictationStep = {
  state: DictationState;
  effect: DictationEffect;
};

export type DictationTiming = {
  readyTimeoutMs: number;
  startTimeoutMs: number;
  listeningLimitMs: number;
  errorTimeoutMs: number;
};

export const DEFAULT_DICTATION_TIMING: DictationTiming = {
  readyTimeoutMs: 20000,
  startTimeoutMs: 6000,
  listeningLimitMs: 20000,
  errorTimeoutMs: 15000,
};

export const CLOSED_DICTATION: DictationState = {
  stage: 'closed',
  text: '',
  isFinal: false,
  errorCode: null,
  sinceMs: 0,
};

function enter(
  stage: DictationStage,
  nowMs: number,
  fields: Partial<Omit<DictationState, 'stage' | 'sinceMs'>> = {},
): DictationState {
  return { ...CLOSED_DICTATION, ...fields, stage, sinceMs: nowMs };
}

function isCapturing(state: DictationState): boolean {
  return state.stage === 'starting' || state.stage === 'listening';
}

function afterSpeech(state: DictationState, nowMs: number): DictationState {
  const text = state.text.trim();
  return text === '' ? enter('error', nowMs, { errorCode: 'no-speech' }) : enter('review', nowMs, { text, isFinal: true });
}

function onTick(state: DictationState, nowMs: number, timing: DictationTiming): DictationStep {
  const elapsedMs = nowMs - state.sinceMs;
  if (state.stage === 'ready' && elapsedMs >= timing.readyTimeoutMs) {
    return { state: CLOSED_DICTATION, effect: null };
  }
  if (state.stage === 'starting' && elapsedMs >= timing.startTimeoutMs) {
    return { state: enter('error', nowMs, { errorCode: 'startFailed' }), effect: 'abortMic' };
  }
  if (state.stage === 'listening' && elapsedMs >= timing.listeningLimitMs) {
    return { state: afterSpeech(state, nowMs), effect: 'abortMic' };
  }
  if (state.stage === 'error' && elapsedMs >= timing.errorTimeoutMs) {
    return { state: CLOSED_DICTATION, effect: null };
  }
  return { state, effect: null };
}

export function advanceDictation(
  state: DictationState,
  event: DictationEvent,
  nowMs: number,
  timing: DictationTiming = DEFAULT_DICTATION_TIMING,
): DictationStep {
  const unchanged: DictationStep = { state, effect: null };

  switch (event.type) {
    case 'open':
      return { state: enter('ready', nowMs), effect: isCapturing(state) ? 'abortMic' : null };
    case 'close':
      if (state.stage === 'closed') return unchanged;
      return { state: CLOSED_DICTATION, effect: isCapturing(state) ? 'abortMic' : null };
    case 'tick':
      return onTick(state, nowMs, timing);
    case 'speak':
      if (state.stage !== 'ready' && state.stage !== 'review' && state.stage !== 'error') return unchanged;
      return { state: enter('starting', nowMs), effect: 'startMic' };
    case 'listening':
      if (state.stage !== 'starting') return unchanged;
      return { state: enter('listening', nowMs), effect: null };
    case 'transcript':
      if (state.stage === 'starting') {
        return { state: enter('listening', nowMs, { text: event.text, isFinal: event.isFinal }), effect: null };
      }
      if (state.stage !== 'listening') return unchanged;
      return { state: { ...state, text: event.text, isFinal: event.isFinal }, effect: null };
    case 'ended':
      if (state.stage === 'starting') return { state: enter('error', nowMs, { errorCode: 'no-speech' }), effect: null };
      if (state.stage !== 'listening') return unchanged;
      return { state: afterSpeech(state, nowMs), effect: null };
    case 'failed':
      if (!isCapturing(state)) return unchanged;
      if (event.code === 'aborted') return { state: CLOSED_DICTATION, effect: null };
      return { state: enter('error', nowMs, { errorCode: event.code }), effect: null };
    case 'finish':
      if (state.stage !== 'listening') return unchanged;
      return { state, effect: 'stopMic' };
  }
}
