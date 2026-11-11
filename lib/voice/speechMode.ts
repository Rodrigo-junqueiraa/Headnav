export type SpeechMode = 'online' | 'local';

export const DEFAULT_SPEECH_MODE: SpeechMode = 'online';

const SPEECH_MODE_KEY = 'speechMode';

export function parseSpeechMode(value: unknown): SpeechMode {
  return value === 'local' || value === 'online' ? value : DEFAULT_SPEECH_MODE;
}

export async function loadSpeechMode(): Promise<SpeechMode> {
  const stored = await chrome.storage.local.get(SPEECH_MODE_KEY);
  return parseSpeechMode(stored[SPEECH_MODE_KEY]);
}

export async function saveSpeechMode(mode: SpeechMode): Promise<void> {
  await chrome.storage.local.set({ [SPEECH_MODE_KEY]: mode });
}
