import { describe, it, expect } from 'vitest';
import { SpeechGestureGuard } from './speechGestureGuard';

const config = { cooldownMs: 1000, maxSessionMs: 20000 };

describe('SpeechGestureGuard', () => {
  it('lets gestures run while nobody is speaking', () => {
    const guard = new SpeechGestureGuard(config);
    expect(guard.isSuppressing(0)).toBe(false);
    expect(guard.isSuppressing(5000)).toBe(false);
  });

  it('suppresses gestures from the moment the microphone opens', () => {
    const guard = new SpeechGestureGuard(config);
    guard.start(100);
    expect(guard.isSuppressing(100)).toBe(true);
    expect(guard.isSuppressing(9000)).toBe(true);
  });

  it('keeps suppressing for the cooldown after speech ends, then lets go', () => {
    const guard = new SpeechGestureGuard(config);
    guard.start(0);
    guard.end(4000);
    expect(guard.isSuppressing(4500)).toBe(true);
    expect(guard.isSuppressing(4999)).toBe(true);
    expect(guard.isSuppressing(5000)).toBe(false);
  });

  it('measures the session from its first start, not from later phases', () => {
    const guard = new SpeechGestureGuard(config);
    guard.start(0);
    guard.start(3000);
    guard.start(6000);
    expect(guard.isSuppressing(20999)).toBe(true);
    expect(guard.isSuppressing(21000)).toBe(false);
  });

  it('gives gestures back on its own when the end of speech never arrives', () => {
    const guard = new SpeechGestureGuard(config);
    guard.start(0);
    expect(guard.isSuppressing(19000)).toBe(true);
    expect(guard.isSuppressing(21000)).toBe(false);
  });

  it('starts a fresh session after an expired one', () => {
    const guard = new SpeechGestureGuard(config);
    guard.start(0);
    guard.start(30000);
    expect(guard.isSuppressing(45000)).toBe(true);
  });

  it('ignores an end without a start', () => {
    const guard = new SpeechGestureGuard(config);
    guard.end(1000);
    expect(guard.isSuppressing(1200)).toBe(false);
  });

  it('clears everything on reset', () => {
    const guard = new SpeechGestureGuard(config);
    guard.start(0);
    guard.reset();
    expect(guard.isSuppressing(10)).toBe(false);
  });
});
