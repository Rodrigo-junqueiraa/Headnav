import { checkLocalVoice, installLocalVoice, type LocalVoiceStatus } from '@/lib/voice/localVoice';
import { loadSpeechMode, parseSpeechMode, saveSpeechMode, type SpeechMode } from '@/lib/voice/speechMode';

type DeviceAccess = {
  permission: PermissionName;
  constraints: MediaStreamConstraints;
  label: string;
  grantedHint: string;
  button: HTMLButtonElement | null;
  status: HTMLDivElement | null;
};

const PERMISSION_TEXT: Record<PermissionState, string> = {
  granted: 'allowed',
  prompt: 'not allowed yet',
  denied: "blocked. Allow it in Chrome's site settings for this extension",
};

const PERMISSION_CLASS: Record<PermissionState, string> = {
  granted: 'ok',
  prompt: '',
  denied: 'error',
};

const LOCAL_VOICE_TEXT: Record<LocalVoiceStatus, string> = {
  available: 'installed',
  downloadable: 'not installed for HeadNav yet',
  downloading: 'downloading…',
  unavailable: 'not available for this language in this Chrome',
  unsupported: 'not supported by this Chrome version',
};

const LOCAL_VOICE_CLASS: Record<LocalVoiceStatus, string> = {
  available: 'ok',
  downloadable: '',
  downloading: '',
  unavailable: 'error',
  unsupported: 'error',
};

const DOWNLOAD_POLL_MS = 2000;
const voiceLang = navigator.language;

const devices: DeviceAccess[] = [
  {
    permission: 'camera',
    constraints: { video: true, audio: false },
    label: 'Camera',
    grantedHint: 'You can close this tab and start HeadNav from the toolbar.',
    button: document.querySelector<HTMLButtonElement>('#grantCamera'),
    status: document.querySelector<HTMLDivElement>('#cameraStatus'),
  },
  {
    permission: 'microphone',
    constraints: { video: false, audio: true },
    label: 'Microphone',
    grantedHint: 'Voice dictation can be used while HeadNav is on.',
    button: document.querySelector<HTMLButtonElement>('#grantMicrophone'),
    status: document.querySelector<HTMLDivElement>('#microphoneStatus'),
  },
];

const localVoiceStatusEl = document.querySelector<HTMLDivElement>('#localVoiceStatus');
const installButton = document.querySelector<HTMLButtonElement>('#installLocalVoice');
const modeInputs = document.querySelectorAll<HTMLInputElement>('input[name="speechMode"]');

function setStatus(element: HTMLElement | null, text: string, state: string): void {
  if (!element) return;
  element.textContent = text;
  element.className = `status ${state}`;
}

function showPermission(device: DeviceAccess, state: PermissionState): void {
  const hint = state === 'granted' ? ` ${device.grantedHint}` : '';
  setStatus(device.status, `${device.label}: ${PERMISSION_TEXT[state]}.${hint}`, PERMISSION_CLASS[state]);
}

function watchPermission(device: DeviceAccess): void {
  navigator.permissions
    .query({ name: device.permission })
    .then((status) => {
      showPermission(device, status.state);
      status.addEventListener('change', () => showPermission(device, status.state));
    })
    .catch(() => {});
}

async function requestAccess(device: DeviceAccess): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(device.constraints);
    stream.getTracks().forEach((track) => track.stop());
    showPermission(device, 'granted');
  } catch (error: unknown) {
    setStatus(device.status, `${device.label} access was blocked: ${String(error)}`, 'error');
  }
}

function showLocalVoice(status: LocalVoiceStatus): void {
  setStatus(localVoiceStatusEl, `Local voice (${voiceLang}): ${LOCAL_VOICE_TEXT[status]}.`, LOCAL_VOICE_CLASS[status]);
  if (installButton) installButton.disabled = status !== 'downloadable';
}

async function refreshLocalVoice(): Promise<void> {
  const status = await checkLocalVoice(voiceLang);
  showLocalVoice(status);
  if (status === 'downloading') setTimeout(() => void refreshLocalVoice(), DOWNLOAD_POLL_MS);
}

async function installFromClick(): Promise<void> {
  showLocalVoice('downloading');
  if (await installLocalVoice(voiceLang)) {
    await refreshLocalVoice();
    return;
  }
  setStatus(localVoiceStatusEl, `Local voice (${voiceLang}): could not be installed.`, 'error');
  if (installButton) installButton.disabled = false;
}

function selectMode(mode: SpeechMode): void {
  for (const input of modeInputs) input.checked = input.value === mode;
}

for (const device of devices) {
  device.button?.addEventListener('click', () => {
    void requestAccess(device);
  });
  watchPermission(device);
}

installButton?.addEventListener('click', () => {
  void installFromClick();
});

for (const input of modeInputs) {
  input.addEventListener('change', () => {
    if (input.checked) void saveSpeechMode(parseSpeechMode(input.value));
  });
}

loadSpeechMode()
  .then(selectMode)
  .catch(() => {});
void refreshLocalVoice();
