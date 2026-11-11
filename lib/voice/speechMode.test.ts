import { describe, it, expect } from 'vitest';
import { DEFAULT_SPEECH_MODE, parseSpeechMode } from './speechMode';

describe('parseSpeechMode', () => {
  it('keeps a stored online or local choice', () => {
    expect(parseSpeechMode('online')).toBe('online');
    expect(parseSpeechMode('local')).toBe('local');
  });

  it('falls back to the default when nothing valid is stored', () => {
    expect(parseSpeechMode(undefined)).toBe(DEFAULT_SPEECH_MODE);
    expect(parseSpeechMode('cloud')).toBe(DEFAULT_SPEECH_MODE);
    expect(parseSpeechMode(1)).toBe(DEFAULT_SPEECH_MODE);
  });

  it('defaults to online', () => {
    expect(DEFAULT_SPEECH_MODE).toBe('online');
  });
});
