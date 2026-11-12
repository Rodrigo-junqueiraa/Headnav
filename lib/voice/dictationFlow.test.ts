import { describe, it, expect } from 'vitest';
import {
  CLOSED_DICTATION,
  advanceDictation,
  type DictationEvent,
  type DictationState,
  type DictationTiming,
} from './dictationFlow';

const timing: DictationTiming = {
  readyTimeoutMs: 20000,
  startTimeoutMs: 6000,
  listeningLimitMs: 20000,
  errorTimeoutMs: 15000,
};

function run(events: Array<[DictationEvent, number]>, start: DictationState = CLOSED_DICTATION): DictationState {
  let state = start;
  for (const [event, nowMs] of events) {
    state = advanceDictation(state, event, nowMs, timing).state;
  }
  return state;
}

describe('advanceDictation', () => {
  it('opens ready to speak without touching the microphone', () => {
    const step = advanceDictation(CLOSED_DICTATION, { type: 'open' }, 0, timing);
    expect(step.state.stage).toBe('ready');
    expect(step.effect).toBeNull();
  });

  it('turns the microphone on only when the user asks to speak', () => {
    const ready = run([[{ type: 'open' }, 0]]);
    const step = advanceDictation(ready, { type: 'speak' }, 100, timing);
    expect(step.state.stage).toBe('starting');
    expect(step.effect).toBe('startMic');
  });

  it('follows the transcript while listening and reviews the final text', () => {
    const state = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'listening' }, 300],
      [{ type: 'transcript', text: 'vídeos de', isFinal: false }, 900],
      [{ type: 'transcript', text: 'vídeos de gatos ', isFinal: true }, 1500],
      [{ type: 'ended' }, 1600],
    ]);
    expect(state.stage).toBe('review');
    expect(state.text).toBe('vídeos de gatos');
    expect(state.isFinal).toBe(true);
  });

  it('keeps the interim text visible while the user is still speaking', () => {
    const state = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'listening' }, 300],
      [{ type: 'transcript', text: 'vídeos', isFinal: false }, 900],
    ]);
    expect(state.stage).toBe('listening');
    expect(state.text).toBe('vídeos');
    expect(state.isFinal).toBe(false);
  });

  it('accepts a transcript that arrives before the listening signal', () => {
    const state = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'transcript', text: 'oi', isFinal: false }, 400],
    ]);
    expect(state.stage).toBe('listening');
    expect(state.text).toBe('oi');
  });

  it('reports no speech when the session ends without text', () => {
    const state = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'listening' }, 300],
      [{ type: 'ended' }, 8000],
    ]);
    expect(state.stage).toBe('error');
    expect(state.errorCode).toBe('no-speech');
  });

  it('shows recognition errors', () => {
    const state = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'failed', code: 'not-allowed' }, 200],
    ]);
    expect(state.stage).toBe('error');
    expect(state.errorCode).toBe('not-allowed');
  });

  it('closes quietly when the recognition was aborted', () => {
    const state = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'listening' }, 300],
      [{ type: 'failed', code: 'aborted' }, 400],
    ]);
    expect(state.stage).toBe('closed');
  });

  it('asks to stop the microphone when the user is done, and waits for the end', () => {
    const listening = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'listening' }, 300],
    ]);
    const step = advanceDictation(listening, { type: 'finish' }, 2000, timing);
    expect(step.effect).toBe('stopMic');
    expect(step.state.stage).toBe('listening');
  });

  it('aborts the microphone when closed while capturing', () => {
    const listening = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'listening' }, 300],
    ]);
    const step = advanceDictation(listening, { type: 'close' }, 1000, timing);
    expect(step.state.stage).toBe('closed');
    expect(step.effect).toBe('abortMic');
  });

  it('aborts the microphone when another field is opened while capturing', () => {
    const starting = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
    ]);
    const step = advanceDictation(starting, { type: 'open' }, 500, timing);
    expect(step.state.stage).toBe('ready');
    expect(step.effect).toBe('abortMic');
  });

  it('starts over from the review and from an error', () => {
    const review = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'transcript', text: 'oi', isFinal: true }, 400],
      [{ type: 'ended' }, 500],
    ]);
    const again = advanceDictation(review, { type: 'speak' }, 900, timing);
    expect(again.state.stage).toBe('starting');
    expect(again.state.text).toBe('');
    expect(again.effect).toBe('startMic');

    const failed = run([[{ type: 'failed', code: 'network' }, 1000]], again.state);
    expect(advanceDictation(failed, { type: 'speak' }, 1200, timing).effect).toBe('startMic');
  });

  it('closes an untouched panel after the ready timeout', () => {
    const ready = run([[{ type: 'open' }, 0]]);
    expect(advanceDictation(ready, { type: 'tick' }, 19999, timing).state.stage).toBe('ready');
    expect(advanceDictation(ready, { type: 'tick' }, 20000, timing).state.stage).toBe('closed');
  });

  it('gives up when the microphone does not open in time', () => {
    const starting = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 1000],
    ]);
    const step = advanceDictation(starting, { type: 'tick' }, 7000, timing);
    expect(step.state.stage).toBe('error');
    expect(step.state.errorCode).toBe('startFailed');
    expect(step.effect).toBe('abortMic');
  });

  it('stops listening at the limit and keeps what was heard', () => {
    const listening = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 0],
      [{ type: 'listening' }, 0],
      [{ type: 'transcript', text: 'texto longo', isFinal: false }, 5000],
    ]);
    const step = advanceDictation(listening, { type: 'tick' }, 20000, timing);
    expect(step.state.stage).toBe('review');
    expect(step.state.text).toBe('texto longo');
    expect(step.effect).toBe('abortMic');
  });

  it('closes an error message after its timeout', () => {
    const failed = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 0],
      [{ type: 'failed', code: 'network' }, 1000],
    ]);
    expect(advanceDictation(failed, { type: 'tick' }, 16000, timing).state.stage).toBe('closed');
  });

  it('ignores late events that no longer apply', () => {
    const review = run([
      [{ type: 'open' }, 0],
      [{ type: 'speak' }, 100],
      [{ type: 'transcript', text: 'oi', isFinal: true }, 400],
      [{ type: 'ended' }, 500],
    ]);
    for (const event of [
      { type: 'listening' },
      { type: 'transcript', text: 'atrasado', isFinal: true },
      { type: 'ended' },
      { type: 'failed', code: 'network' },
      { type: 'finish' },
    ] satisfies DictationEvent[]) {
      expect(advanceDictation(review, event, 600, timing).state).toBe(review);
    }
    expect(advanceDictation(CLOSED_DICTATION, { type: 'close' }, 0, timing).state).toBe(CLOSED_DICTATION);
  });
});
