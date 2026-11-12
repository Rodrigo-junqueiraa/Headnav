import { findClickTarget, performClick, type ClickTarget } from '@/lib/click/clickTarget';
import { DwellDetector } from '@/lib/click/dwellDetector';
import { attractToTarget, smoothPointer, type Point } from '@/lib/cursor/pointerMotion';
import { EdgeScrollDetector, edgeAt, edgeDepth, findScrollable, scrollSpeed } from '@/lib/gestures/edgeScroll';
import type { ForwardResponse, GestureKind, RuntimeMessage, StatusResponse } from '@/lib/messages';
import {
  CLOSED_DICTATION,
  advanceDictation,
  type DictationEffect,
  type DictationEvent,
  type DictationState,
} from '@/lib/voice/dictationFlow';
import { DEFAULT_SPEECH_MODE, type SpeechMode } from '@/lib/voice/speechMode';
import { findTextField } from '@/lib/voice/textField';
import { DictationPanel, type PanelAction, type PanelPlacement } from './dictationPanel';

type OverlayKind = GestureKind | 'scrollUp' | 'scrollDown';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  main() {
    const CURSOR_ID = 'headnav-cursor';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const DOT_SIZE = 32;
    const RING_SIZE = 52;
    const RING_STROKE = 4;
    const RING_SHADOW_STROKE = RING_STROKE + 2;
    const RING_RADIUS = (RING_SIZE - RING_SHADOW_STROKE) / 2;
    const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
    const DOT_COLOR = 'rgba(37, 99, 235, 0.35)';
    const PAUSED_DOT_COLOR = 'rgba(148, 163, 184, 0.3)';
    const VOICE_DOT_COLOR = 'rgba(239, 68, 68, 0.55)';
    const FACE_LOST_DOT_COLOR = 'rgba(100, 116, 139, 0.35)';
    const CLICK_COLOR = 'rgba(34, 197, 94, 0.85)';
    const DWELL_COLOR = '#f59e0b';
    const NAVIGATION_COLOR = '#38bdf8';
    const PAUSE_COLOR = '#a78bfa';
    const SCROLL_COLOR = '#34d399';
    const FRAME_GAP_RESET_MS = 500;
    const MAGNET_MAX_AREA_RATIO = 0.25;

    if (document.getElementById(CURSOR_ID)) return;

    const cursor = document.createElement('div');
    cursor.id = CURSOR_ID;
    cursor.style.cssText = [
      'position: fixed',
      'top: 0',
      'left: 0',
      'margin: 0',
      'padding: 0',
      `width: ${RING_SIZE}px`,
      `height: ${RING_SIZE}px`,
      'pointer-events: none',
      'z-index: 2147483647',
      'will-change: transform',
      'display: none',
    ].join('; ');

    const dot = document.createElement('div');
    dot.style.cssText = [
      'position: absolute',
      `top: ${(RING_SIZE - DOT_SIZE) / 2}px`,
      `left: ${(RING_SIZE - DOT_SIZE) / 2}px`,
      `width: ${DOT_SIZE}px`,
      `height: ${DOT_SIZE}px`,
      'box-sizing: border-box',
      'border-radius: 50%',
      'border: 3px solid rgba(255, 255, 255, 0.95)',
      `background: ${DOT_COLOR}`,
      'box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.55), 0 1px 6px rgba(0, 0, 0, 0.45)',
    ].join('; ');

    const badge = document.createElement('div');
    badge.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      `width: ${RING_SIZE}px`,
      `height: ${RING_SIZE}px`,
      'display: none',
      'align-items: center',
      'justify-content: center',
      'font: 700 17px system-ui, -apple-system, sans-serif',
      'color: #ffffff',
      'text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85)',
    ].join('; ');

    const ring = document.createElementNS(SVG_NS, 'svg');
    ring.setAttribute('viewBox', `0 0 ${RING_SIZE} ${RING_SIZE}`);
    ring.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      `width: ${RING_SIZE}px`,
      `height: ${RING_SIZE}px`,
      'overflow: visible',
      'transform: rotate(-90deg)',
    ].join('; ');

    const createArc = (stroke: string, width: number): SVGCircleElement => {
      const arc = document.createElementNS(SVG_NS, 'circle');
      arc.setAttribute('cx', String(RING_SIZE / 2));
      arc.setAttribute('cy', String(RING_SIZE / 2));
      arc.setAttribute('r', String(RING_RADIUS));
      arc.setAttribute('fill', 'none');
      arc.setAttribute('stroke', stroke);
      arc.setAttribute('stroke-width', String(width));
      arc.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE));
      arc.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE));
      ring.appendChild(arc);
      return arc;
    };

    const shadowArc = createArc('rgba(0, 0, 0, 0.55)', RING_SHADOW_STROKE);
    const progressArc = createArc(DWELL_COLOR, RING_STROKE);
    cursor.append(dot, ring, badge);

    const dwell = new DwellDetector<Element>();
    const edgeScroll = new EdgeScrollDetector();
    let raw: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let display: Point = raw;
    let hasPosition = false;
    let magnet: Element | null = null;
    let gesture: GestureKind | null = null;
    let overlay: OverlayKind | null = null;
    let clickingPaused = false;
    let voiceActive = false;
    let faceLost = false;
    let lastFrameMs: number | null = null;
    let frameId: number | null = null;
    let dictation: DictationState = CLOSED_DICTATION;
    let dictationField: HTMLElement | null = null;
    let dictationPlacement: PanelPlacement = 'lower';
    let dictationSessionId: string | null = null;
    let speechMode: SpeechMode = DEFAULT_SPEECH_MODE;
    let panelLocked = false;
    const panel = new DictationPanel((action) => handlePanelAction(action));

    const render = (point: Point): void => {
      cursor.style.transform = `translate(${point.x - RING_SIZE / 2}px, ${point.y - RING_SIZE / 2}px)`;
    };

    const setProgress = (progress: number): void => {
      const offset = String(RING_CIRCUMFERENCE * (1 - progress));
      shadowArc.setAttribute('stroke-dashoffset', offset);
      progressArc.setAttribute('stroke-dashoffset', offset);
    };

    const overlayColor = (kind: OverlayKind): string => {
      if (kind === 'pause') return PAUSE_COLOR;
      if (kind === 'scrollUp' || kind === 'scrollDown') return SCROLL_COLOR;
      return NAVIGATION_COLOR;
    };

    const overlaySymbol = (kind: OverlayKind): string => {
      if (kind === 'back') return '←';
      if (kind === 'forward') return '→';
      if (kind === 'scrollUp') return '↑';
      if (kind === 'scrollDown') return '↓';
      return clickingPaused ? '▶' : '⏸';
    };

    const idleSymbol = (): string | null => {
      if (voiceActive) return '🎤';
      if (faceLost) return '?';
      if (clickingPaused) return '⏸';
      return null;
    };

    const restingDotColor = (): string => {
      if (voiceActive) return VOICE_DOT_COLOR;
      if (faceLost) return FACE_LOST_DOT_COLOR;
      return clickingPaused ? PAUSED_DOT_COLOR : DOT_COLOR;
    };

    const applyDotStyle = (): void => {
      dot.style.background = restingDotColor();
      dot.style.opacity = (clickingPaused || faceLost) && !voiceActive ? '0.6' : '1';
    };

    const setOverlay = (kind: OverlayKind | null): void => {
      overlay = kind;
      if (kind === null) {
        const symbol = idleSymbol();
        progressArc.setAttribute('stroke', DWELL_COLOR);
        badge.textContent = symbol ?? '';
        badge.style.display = symbol === null ? 'none' : 'flex';
        setProgress(0);
        return;
      }
      progressArc.setAttribute('stroke', overlayColor(kind));
      badge.textContent = overlaySymbol(kind);
      badge.style.display = 'flex';
      setProgress(0);
    };

    const setPaused = (paused: boolean): void => {
      clickingPaused = paused;
      applyDotStyle();
      magnet = null;
      dwell.reset();
      if (overlay === null) setOverlay(null);
    };

    const flash = (color: string): void => {
      dot.animate(
        [
          { transform: 'scale(1)', backgroundColor: color },
          { transform: 'scale(1.5)', backgroundColor: color },
          { transform: 'scale(1)', backgroundColor: restingDotColor() },
        ],
        { duration: 280, easing: 'ease-out' },
      );
    };

    const canMagnetize = (element: Element): boolean => {
      const { width, height } = element.getBoundingClientRect();
      return width * height <= window.innerWidth * window.innerHeight * MAGNET_MAX_AREA_RATIO;
    };

    const clearEdgeOverlay = (): void => {
      edgeScroll.reset();
      if (overlay === 'scrollUp' || overlay === 'scrollDown') setOverlay(null);
    };

    const setVoiceActive = (active: boolean): void => {
      voiceActive = active;
      applyDotStyle();
      magnet = null;
      dwell.reset();
      clearEdgeOverlay();
      if (overlay === null) setOverlay(null);
    };

    const setFacePresent = (present: boolean): void => {
      faceLost = !present;
      applyDotStyle();
      magnet = null;
      dwell.reset();
      clearEdgeOverlay();
      if (overlay === null) setOverlay(null);
    };

    const runEdgeScroll = (elapsedMs: number, now: number): boolean => {
      const edge = edgeAt(raw.y, window.innerHeight);
      if (edge === null) {
        clearEdgeOverlay();
        return false;
      }

      const scrollable = findScrollable(document.elementFromPoint(display.x, display.y), edge);
      if (scrollable === null) {
        clearEdgeOverlay();
        return false;
      }

      magnet = null;
      dwell.reset();
      display = smoothPointer(display, raw, elapsedMs, false);
      render(display);

      const state = edgeScroll.update(edge, now);
      const kind: OverlayKind = edge === 'up' ? 'scrollUp' : 'scrollDown';
      if (overlay !== kind) setOverlay(kind);
      setProgress(state.progress);

      if (state.scrolling) {
        const distance = (scrollSpeed(edgeDepth(raw.y, window.innerHeight)) * elapsedMs) / 1000;
        scrollable.scrollBy(0, edge === 'up' ? -distance : distance);
      }

      return true;
    };

    const isCapturing = (): boolean => dictation.stage === 'starting' || dictation.stage === 'listening';

    const newSessionId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    const sendDictation = (message: RuntimeMessage): Promise<ForwardResponse | undefined> =>
      chrome.runtime.sendMessage(message).catch(() => undefined);

    const runDictationEffect = (effect: DictationEffect): void => {
      if (effect === 'startMic') {
        const sessionId = newSessionId();
        dictationSessionId = sessionId;
        void sendDictation({ type: 'DICTATION_START', payload: { sessionId } }).then((response) => {
          if (!response?.ok && dictationSessionId === sessionId) {
            dispatchDictation({ type: 'failed', code: 'startFailed' });
          }
        });
        return;
      }
      if (dictationSessionId === null) return;
      if (effect === 'stopMic') {
        void sendDictation({ type: 'DICTATION_STOP', payload: { sessionId: dictationSessionId } });
      } else if (effect === 'abortMic') {
        void sendDictation({ type: 'DICTATION_ABORT', payload: { sessionId: dictationSessionId } });
        dictationSessionId = null;
      }
    };

    const dispatchDictation = (event: DictationEvent): void => {
      const previous = dictation;
      const { state, effect } = advanceDictation(previous, event, performance.now());
      dictation = state;
      runDictationEffect(effect);
      if (!isCapturing()) dictationSessionId = null;
      if (state === previous) return;

      if (state.stage !== previous.stage) {
        panelLocked = true;
        magnet = null;
      }
      if (state.stage === 'closed') {
        panel.hide();
        dictationField = null;
        return;
      }
      panel.render(state, speechMode, dictationPlacement);
    };

    const handlePanelAction = (action: PanelAction): void => {
      dispatchDictation({ type: action });
    };

    const placementFor = (field: HTMLElement): PanelPlacement => {
      const rect = field.getBoundingClientRect();
      return rect.top + rect.height / 2 < window.innerHeight / 2 ? 'lower' : 'upper';
    };

    const openDictation = (field: HTMLElement): void => {
      dictationField = field;
      dictationPlacement = placementFor(field);
      void chrome.runtime
        .sendMessage({ type: 'QUERY_STATUS' })
        .then((response: StatusResponse | undefined) => {
          speechMode = response?.speechMode ?? DEFAULT_SPEECH_MODE;
        })
        .catch(() => {})
        .finally(() => {
          if (dictationField === field) dispatchDictation({ type: 'open' });
        });
    };

    const closeDictationNow = (): void => {
      dictation = CLOSED_DICTATION;
      dictationSessionId = null;
      dictationField = null;
      panelLocked = false;
      panel.hide();
    };

    const afterPageClick = (target: ClickTarget): void => {
      const field = findTextField(target.clickable);
      if (field) openDictation(field);
      else if (dictation.stage !== 'closed') dispatchDictation({ type: 'close' });
    };

    const tick = (now: number): void => {
      frameId = requestAnimationFrame(tick);
      const elapsedMs = lastFrameMs === null ? 0 : now - lastFrameMs;
      lastFrameMs = now;
      if (dictation.stage !== 'closed') dispatchDictation({ type: 'tick' });
      if (!hasPosition || gesture !== null || faceLost) return;

      const panelOpen = dictation.stage !== 'closed';
      const panelOnly = voiceActive || isCapturing();
      if (!panelOnly && !panelOpen && runEdgeScroll(elapsedMs, now)) return;

      if (clickingPaused || (panelOnly && !panelOpen)) {
        magnet = null;
        panel.highlight(null);
        display = smoothPointer(display, raw, elapsedMs, false);
        render(display);
        return;
      }

      if (elapsedMs > FRAME_GAP_RESET_MS) dwell.reset();

      const aim = magnet?.isConnected ? attractToTarget(raw, magnet.getBoundingClientRect()) : null;
      if (!aim) magnet = null;

      display = smoothPointer(display, aim ?? raw, elapsedMs, aim !== null);
      render(display);

      const overPanel = panelOpen && panel.owns(document.elementFromPoint(display.x, display.y));
      let button = overPanel ? panel.buttonAt(display.x, display.y) : null;
      if (panelLocked) {
        if (button === null) panelLocked = false;
        else button = null;
      }
      const pageTarget = overPanel || panelOnly ? null : findClickTarget(display.x, display.y);
      const clickable = button ?? pageTarget?.clickable ?? null;
      if (clickable && clickable !== magnet && canMagnetize(clickable)) magnet = clickable;
      panel.highlight(button);

      const { progress, fired } = dwell.update(clickable, display.x, display.y, now);
      setProgress(fired ? 0 : progress);
      if (!fired) return;

      flash(CLICK_COLOR);
      if (button) {
        panel.activate(button);
      } else if (pageTarget) {
        performClick(pageTarget, display.x, display.y);
        afterPageClick(pageTarget);
      }
    };

    const setVisible = (visible: boolean): void => {
      cursor.style.display = visible ? 'block' : 'none';
      hasPosition = false;
      magnet = null;
      lastFrameMs = null;
      gesture = null;
      edgeScroll.reset();
      voiceActive = false;
      faceLost = false;
      closeDictationNow();
      setPaused(false);
      setOverlay(null);

      if (visible && frameId === null) {
        frameId = requestAnimationFrame(tick);
      } else if (!visible && frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const attach = (): void => {
      document.body.appendChild(cursor);
      panel.attach(document.body);
      render(display);
    };

    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });

    chrome.runtime.onMessage.addListener((message) => {
      const runtimeMessage = message as RuntimeMessage;

      if (runtimeMessage.type === 'DETECTION_STATE') {
        setVisible(runtimeMessage.payload.running);
      }

      if (runtimeMessage.type === 'CURSOR_MOVE') {
        raw = { x: runtimeMessage.payload.x * window.innerWidth, y: runtimeMessage.payload.y * window.innerHeight };
        if (!hasPosition) {
          display = raw;
          hasPosition = true;
          render(display);
        }
      }

      if (runtimeMessage.type === 'CLICKING_PAUSED') {
        setPaused(runtimeMessage.payload.paused);
      }

      if (runtimeMessage.type === 'VOICE_ACTIVE') {
        setVoiceActive(runtimeMessage.payload.active);
      }

      if (runtimeMessage.type === 'FACE_PRESENCE') {
        setFacePresent(runtimeMessage.payload.present);
      }

      if (runtimeMessage.type === 'SPEECH_STATUS' && runtimeMessage.payload.sessionId === dictationSessionId) {
        dispatchDictation(runtimeMessage.payload.phase === 'ended' ? { type: 'ended' } : { type: 'listening' });
      }

      if (runtimeMessage.type === 'SPEECH_RESULT' && runtimeMessage.payload.sessionId === dictationSessionId) {
        const { text, isFinal } = runtimeMessage.payload;
        dispatchDictation({ type: 'transcript', text, isFinal });
      }

      if (runtimeMessage.type === 'SPEECH_ERROR' && runtimeMessage.payload.sessionId === dictationSessionId) {
        dispatchDictation({ type: 'failed', code: runtimeMessage.payload.code });
      }

      if (runtimeMessage.type === 'GESTURE_HOLD') {
        const { kind, progress, fired } = runtimeMessage.payload;
        gesture = kind;
        if (kind !== null) {
          edgeScroll.reset();
          dwell.reset();
          if (overlay !== kind) setOverlay(kind);
          setProgress(progress);
        } else if (overlay !== null) {
          setOverlay(null);
        }
        if (fired && kind !== null) {
          flash(kind === 'pause' ? PAUSE_COLOR : NAVIGATION_COLOR);
          if (kind === 'back') window.history.back();
          if (kind === 'forward') window.history.forward();
        }
      }
    });

    chrome.runtime
      .sendMessage({ type: 'QUERY_STATUS' })
      .then((response: StatusResponse | undefined) => {
        setVisible(Boolean(response?.running));
        if (response?.running) {
          setPaused(Boolean(response.clickingPaused));
          setVoiceActive(Boolean(response.voiceActive));
          setFacePresent(response.facePresent !== false);
        }
      })
      .catch(() => {});
  },
});
