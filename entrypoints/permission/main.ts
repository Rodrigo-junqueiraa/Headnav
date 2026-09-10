const grantButton = document.querySelector<HTMLButtonElement>('#grant');
const statusEl = document.querySelector<HTMLDivElement>('#status');

function setStatus(text: string, state: 'ok' | 'error'): void {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = state;
}

async function requestCamera(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach((track) => track.stop());
    setStatus('Camera access granted. You can close this tab and start HeadNav from the toolbar.', 'ok');
  } catch (error: unknown) {
    setStatus(`Camera access was blocked: ${String(error)}`, 'error');
  }
}

grantButton?.addEventListener('click', () => {
  void requestCamera();
});
