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

function setStatus(device: DeviceAccess, text: string, state: string): void {
  if (!device.status) return;
  device.status.textContent = text;
  device.status.className = `status ${state}`;
}

function showPermission(device: DeviceAccess, state: PermissionState): void {
  const hint = state === 'granted' ? ` ${device.grantedHint}` : '';
  setStatus(device, `${device.label}: ${PERMISSION_TEXT[state]}.${hint}`, PERMISSION_CLASS[state]);
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
    setStatus(device, `${device.label} access was blocked: ${String(error)}`, 'error');
  }
}

for (const device of devices) {
  device.button?.addEventListener('click', () => {
    void requestAccess(device);
  });
  watchPermission(device);
}
