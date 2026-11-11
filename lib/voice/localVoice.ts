export type LocalVoiceStatus = SpeechRecognitionAvailabilityStatus | 'unsupported';

export function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  return globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
}

export async function checkLocalVoice(lang: string): Promise<LocalVoiceStatus> {
  const Recognition = getRecognitionConstructor();
  if (!Recognition?.available) return 'unsupported';
  return Recognition.available({ langs: [lang], processLocally: true }).catch(() => 'unavailable' as const);
}

export async function installLocalVoice(lang: string): Promise<boolean> {
  const Recognition = getRecognitionConstructor();
  if (!Recognition?.install) return false;
  return Recognition.install({ langs: [lang], processLocally: true }).catch(() => false);
}
