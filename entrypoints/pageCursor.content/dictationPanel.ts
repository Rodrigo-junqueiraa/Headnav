import { t, type MessageKey } from '@/lib/i18n/translate';
import type { SpeechErrorCode } from '@/lib/messages';
import type { DictationState } from '@/lib/voice/dictationFlow';
import type { SpeechMode } from '@/lib/voice/speechMode';

export type PanelAction = 'speak' | 'finish' | 'insert' | 'search' | 'close';
export type PanelPlacement = 'upper' | 'lower';

type ButtonTone = 'primary' | 'positive' | 'neutral';
type ButtonSpec = { action: PanelAction; label: MessageKey; tone: ButtonTone } | null;
type SlotSpecs = [ButtonSpec, ButtonSpec, ButtonSpec];

export const PANEL_HOST_ID = 'headnav-dictation';
const EDGE_OFFSET_PX = 136;
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const IDLE_BORDER = '#334155';
const LISTENING_BORDER = '#ef4444';
const HIGHLIGHT_BORDER = '#ffffff';

const TONE_COLORS: Record<ButtonTone, string> = {
  primary: '#2563eb',
  positive: '#16a34a',
  neutral: '#475569',
};

const ERROR_TEXT: Record<SpeechErrorCode, MessageKey> = {
  'no-speech': 'panelErrorNoSpeech',
  network: 'panelErrorNetwork',
  'not-allowed': 'panelErrorMicBlocked',
  'service-not-allowed': 'panelErrorMicBlocked',
  'audio-capture': 'panelErrorNoMicrophone',
  'language-not-supported': 'panelErrorLocalUnavailable',
  localUnavailable: 'panelErrorLocalUnavailable',
  unsupported: 'panelErrorUnsupported',
  aborted: 'panelErrorGeneric',
  'phrases-not-supported': 'panelErrorGeneric',
  startFailed: 'panelErrorGeneric',
};

const RETRYABLE_ERRORS = new Set<SpeechErrorCode>(['no-speech', 'network', 'aborted', 'phrases-not-supported', 'startFailed']);

function speakLabel(mode: SpeechMode, again: boolean): MessageKey {
  if (mode === 'online') return again ? 'panelAllowAndSpeakAgain' : 'panelAllowAndSpeak';
  return again ? 'panelSpeakAgain' : 'panelSpeak';
}

function canRetry(state: DictationState): boolean {
  return state.stage === 'error' && RETRYABLE_ERRORS.has(state.errorCode ?? 'startFailed');
}

function slotsFor(state: DictationState, mode: SpeechMode, searchField: boolean): SlotSpecs {
  const close: ButtonSpec = { action: 'close', label: 'panelClose', tone: 'neutral' };
  const cancel: ButtonSpec = { action: 'close', label: 'panelCancel', tone: 'neutral' };
  switch (state.stage) {
    case 'ready':
      return [{ action: 'speak', label: speakLabel(mode, false), tone: 'primary' }, null, close];
    case 'starting':
      return [null, null, cancel];
    case 'listening':
      return [null, { action: 'finish', label: 'panelDone', tone: 'positive' }, cancel];
    case 'review': {
      const commit: ButtonSpec = searchField
        ? { action: 'search', label: 'panelSearch', tone: 'primary' }
        : { action: 'insert', label: 'panelInsert', tone: 'primary' };
      return [{ action: 'speak', label: speakLabel(mode, true), tone: 'neutral' }, commit, cancel];
    }
    case 'error': {
      const retryLabel: MessageKey = mode === 'online' ? 'panelAllowAndTryAgain' : 'panelTryAgain';
      const retry: ButtonSpec = canRetry(state) ? { action: 'speak', label: retryLabel, tone: 'neutral' } : null;
      return [retry, null, close];
    }
    default:
      return [null, null, close];
  }
}

function messageFor(state: DictationState, mode: SpeechMode): MessageKey {
  switch (state.stage) {
    case 'ready':
      return mode === 'online' ? 'panelOnlineNotice' : 'panelLocalNotice';
    case 'starting':
      return 'panelStarting';
    case 'listening':
      return 'panelListening';
    case 'review':
      return 'panelReview';
    default:
      return ERROR_TEXT[state.errorCode ?? 'startFailed'];
  }
}

function css(rules: string[]): string {
  return rules.join('; ');
}

export class DictationPanel {
  private readonly onAction: (action: PanelAction) => void;
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private readonly frame: HTMLDivElement;
  private readonly title: HTMLSpanElement;
  private readonly modeTag: HTMLSpanElement;
  private readonly message: HTMLDivElement;
  private readonly micLine: HTMLDivElement;
  private readonly transcript: HTMLDivElement;
  private readonly notice: HTMLDivElement;
  private readonly slots: HTMLButtonElement[];
  private pulse: Animation | null = null;
  private highlighted: HTMLButtonElement | null = null;

  constructor(onAction: (action: PanelAction) => void) {
    this.onAction = onAction;

    this.host = document.createElement('div');
    this.host.id = PANEL_HOST_ID;
    this.host.style.cssText = css([
      'all: initial',
      'position: fixed',
      'left: 50%',
      'transform: translateX(-50%)',
      'width: min(760px, calc(100vw - 48px))',
      'z-index: 2147483646',
      'display: none',
    ]);
    this.root = this.host.attachShadow({ mode: 'closed' });

    this.frame = document.createElement('div');
    this.frame.style.cssText = css([
      'box-sizing: border-box',
      'width: 100%',
      'padding: 20px 24px 24px',
      'border-radius: 18px',
      `border: 3px solid ${IDLE_BORDER}`,
      'background: #0f172a',
      'color: #f8fafc',
      `font: 400 18px/1.4 ${FONT_STACK}`,
      'text-align: left',
      'letter-spacing: normal',
      'box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45)',
    ]);

    const header = document.createElement('div');
    header.style.cssText = css(['display: flex', 'align-items: center', 'justify-content: space-between', 'gap: 12px']);
    this.title = document.createElement('span');
    this.title.style.cssText = css(['font-size: 21px', 'font-weight: 700']);
    this.modeTag = document.createElement('span');
    this.modeTag.style.cssText = css([
      'padding: 4px 12px',
      'border-radius: 999px',
      'background: #1e293b',
      'color: #cbd5e1',
      'font-size: 15px',
      'white-space: nowrap',
    ]);
    header.append(this.title, this.modeTag);

    this.message = document.createElement('div');
    this.message.style.cssText = css(['margin-top: 12px', 'color: #cbd5e1', 'min-height: 25px']);

    this.micLine = document.createElement('div');
    this.micLine.style.cssText = css([
      'display: none',
      'align-items: center',
      'gap: 8px',
      'margin-top: 8px',
      'color: #fca5a5',
      'font-weight: 600',
    ]);
    const micDot = document.createElement('span');
    micDot.style.cssText = css(['width: 12px', 'height: 12px', 'border-radius: 50%', `background: ${LISTENING_BORDER}`]);
    const micText = document.createElement('span');
    micText.textContent = t('panelMicOn');
    this.micLine.append(micDot, micText);

    this.transcript = document.createElement('div');
    this.transcript.style.cssText = css([
      'display: none',
      'margin-top: 10px',
      'font-size: 28px',
      'font-weight: 600',
      'line-height: 1.3',
      'max-height: 112px',
      'overflow: hidden',
      'overflow-wrap: anywhere',
    ]);

    this.notice = document.createElement('div');
    this.notice.style.cssText = css(['display: none', 'margin-top: 10px', 'color: #fbbf24', 'font-size: 15px']);

    const row = document.createElement('div');
    row.style.cssText = css(['display: flex', 'gap: 40px', 'margin-top: 18px']);
    this.slots = [0, 1, 2].map(() => {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = css([
        'flex: 1 1 0',
        'min-width: 0',
        'min-height: 88px',
        'padding: 10px 14px',
        'border: 3px solid transparent',
        'border-radius: 14px',
        `font: 700 21px/1.2 ${FONT_STACK}`,
        'color: #ffffff',
        'cursor: pointer',
      ]);
      button.addEventListener('click', () => this.activate(button));
      row.appendChild(button);
      return button;
    });

    this.frame.append(header, this.message, this.micLine, this.transcript, this.notice, row);
    this.root.appendChild(this.frame);
  }

  attach(parent: HTMLElement): void {
    parent.appendChild(this.host);
  }

  owns(element: Element | null): boolean {
    return element === this.host;
  }

  render(state: DictationState, mode: SpeechMode, placement: PanelPlacement, searchField: boolean): void {
    this.host.style.display = 'block';
    this.host.style.top = placement === 'upper' ? `${EDGE_OFFSET_PX}px` : 'auto';
    this.host.style.bottom = placement === 'lower' ? `${EDGE_OFFSET_PX}px` : 'auto';

    this.title.textContent = t('panelTitle');
    this.modeTag.textContent = t(mode === 'online' ? 'panelModeOnline' : 'panelModeLocal');
    this.message.textContent = t(messageFor(state, mode));

    const listening = state.stage === 'listening';
    this.micLine.style.display = listening ? 'flex' : 'none';

    const showText = (listening || state.stage === 'review') && state.text !== '';
    this.transcript.style.display = showText ? 'block' : 'none';
    this.transcript.textContent = state.text;
    this.transcript.style.color = state.isFinal ? '#ffffff' : '#94a3b8';
    this.transcript.style.fontStyle = state.isFinal ? 'normal' : 'italic';

    const showNotice = mode === 'online' && (state.stage === 'review' || canRetry(state));
    this.notice.style.display = showNotice ? 'block' : 'none';
    this.notice.textContent = showNotice ? t('panelOnlineNotice') : '';

    slotsFor(state, mode, searchField).forEach((spec, index) => {
      const button = this.slots[index];
      if (button) this.applySlot(button, spec);
    });

    this.setListening(listening);
  }

  hide(): void {
    this.host.style.display = 'none';
    this.highlight(null);
    this.setListening(false);
  }

  detach(): void {
    this.hide();
    this.host.remove();
  }

  buttonAt(x: number, y: number): HTMLButtonElement | null {
    if (this.host.style.display === 'none') return null;
    const button = this.root.elementFromPoint(x, y)?.closest('button') ?? null;
    return button && !button.disabled && this.slots.includes(button) ? button : null;
  }

  highlight(button: HTMLButtonElement | null): void {
    if (button === this.highlighted) return;
    if (this.highlighted) this.highlighted.style.borderColor = 'transparent';
    if (button) button.style.borderColor = HIGHLIGHT_BORDER;
    this.highlighted = button;
  }

  activate(button: HTMLButtonElement): void {
    const action = button.dataset.action as PanelAction | undefined;
    if (action && !button.disabled) this.onAction(action);
  }

  private applySlot(button: HTMLButtonElement, spec: ButtonSpec): void {
    if (spec === null) {
      button.disabled = true;
      button.style.visibility = 'hidden';
      delete button.dataset.action;
      if (this.highlighted === button) this.highlight(null);
      return;
    }
    button.disabled = false;
    button.style.visibility = 'visible';
    button.style.background = TONE_COLORS[spec.tone];
    button.textContent = t(spec.label);
    button.dataset.action = spec.action;
  }

  private setListening(listening: boolean): void {
    this.frame.style.borderColor = listening ? LISTENING_BORDER : IDLE_BORDER;
    if (listening && !this.pulse) {
      this.pulse = this.frame.animate(
        [{ boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.6)' }, { boxShadow: '0 0 0 16px rgba(239, 68, 68, 0)' }],
        { duration: 1400, iterations: Infinity },
      );
    } else if (!listening && this.pulse) {
      this.pulse.cancel();
      this.pulse = null;
    }
  }
}
