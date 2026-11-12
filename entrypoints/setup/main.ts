import { t, translatePage, type MessageKey } from '@/lib/i18n/translate';
import { checkLocalVoice, installLocalVoice, type LocalVoiceStatus } from '@/lib/voice/localVoice';
import { loadSpeechMode, parseSpeechMode, saveSpeechMode, type SpeechMode } from '@/lib/voice/speechMode';

type DeviceAccess = {
  permission: PermissionName;
  constraints: MediaStreamConstraints;
  label: MessageKey;
  grantedHint: MessageKey;
  button: HTMLButtonElement | null;
  status: HTMLDivElement | null;
};

const PERMISSION_TEXT: Record<PermissionState, MessageKey> = {
  granted: 'setupPermissionGranted',
  prompt: 'setupPermissionPrompt',
  denied: 'setupPermissionDenied',
};

const PERMISSION_CLASS: Record<PermissionState, string> = {
  granted: 'ok',
  prompt: '',
  denied: 'error',
};

const LOCAL_VOICE_TEXT: Record<LocalVoiceStatus, MessageKey> = {
  available: 'setupLocalVoiceAvailable',
  downloadable: 'setupLocalVoiceDownloadable',
  downloading: 'setupLocalVoiceDownloading',
  unavailable: 'setupLocalVoiceUnavailable',
  unsupported: 'setupLocalVoiceUnsupported',
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
    label: 'setupDeviceCamera',
    grantedHint: 'setupCameraGrantedHint',
    button: document.querySelector<HTMLButtonElement>('#grantCamera'),
    status: document.querySelector<HTMLDivElement>('#cameraStatus'),
  },
  {
    permission: 'microphone',
    constraints: { video: false, audio: true },
    label: 'setupDeviceMicrophone',
    grantedHint: 'setupMicrophoneGrantedHint',
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
  const line = t('setupPermissionLine', [t(device.label), t(PERMISSION_TEXT[state])]);
  const hint = state === 'granted' ? ` ${t(device.grantedHint)}` : '';
  setStatus(device.status, `${line}${hint}`, PERMISSION_CLASS[state]);
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
    setStatus(device.status, t('setupAccessBlocked', [t(device.label), String(error)]), 'error');
  }
}

function showLocalVoice(status: LocalVoiceStatus): void {
  setStatus(
    localVoiceStatusEl,
    t('setupLocalVoiceLine', [voiceLang, t(LOCAL_VOICE_TEXT[status])]),
    LOCAL_VOICE_CLASS[status],
  );
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
  setStatus(localVoiceStatusEl, t('setupLocalVoiceLine', [voiceLang, t('setupLocalVoiceFailed')]), 'error');
  if (installButton) installButton.disabled = false;
}

function selectMode(mode: SpeechMode): void {
  for (const input of modeInputs) input.checked = input.value === mode;
}

translatePage();
document.title = t('setupTitle');

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
