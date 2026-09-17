import { findClickTarget, performClick } from '@/lib/click';
import { DwellDetector } from '@/lib/dwell';
import type { GestureKind, RuntimeMessage, StatusResponse } from '@/lib/messages';
import { attractToTarget, smoothPointer, type Point } from '@/lib/pointer';

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
    const CLICK_COLOR = 'rgba(34, 197, 94, 0.85)';
    const DWELL_COLOR = '#f59e0b';
    const NAVIGATION_COLOR = '#38bdf8';
    const PAUSE_COLOR = '#a78bfa';
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
    let raw: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let display: Point = raw;
    let hasPosition = false;
    let magnet: Element | null = null;
    let gesture: GestureKind | null = null;
    let clickingPaused = false;
    let lastFrameMs: number | null = null;
    let frameId: number | null = null;

    const render = (point: Point): void => {
      cursor.style.transform = `translate(${point.x - RING_SIZE / 2}px, ${point.y - RING_SIZE / 2}px)`;
    };

    const setProgress = (progress: number): void => {
      const offset = String(RING_CIRCUMFERENCE * (1 - progress));
      shadowArc.setAttribute('stroke-dashoffset', offset);
      progressArc.setAttribute('stroke-dashoffset', offset);
    };

    const gestureSymbol = (kind: GestureKind): string => {
      if (kind === 'back') return '←';
      if (kind === 'forward') return '→';
      return clickingPaused ? '▶' : '⏸';
    };

    const setPaused = (paused: boolean): void => {
      clickingPaused = paused;
      dot.style.background = paused ? PAUSED_DOT_COLOR : DOT_COLOR;
      dot.style.opacity = paused ? '0.6' : '1';
      magnet = null;
      dwell.reset();
      setProgress(0);
      if (gesture === null) {
        badge.textContent = '⏸';
        badge.style.display = paused ? 'flex' : 'none';
      }
    };

    const setGesture = (kind: GestureKind | null): void => {
      gesture = kind;
      if (kind === null) {
        progressArc.setAttribute('stroke', DWELL_COLOR);
        badge.textContent = '⏸';
        badge.style.display = clickingPaused ? 'flex' : 'none';
        setProgress(0);
        return;
      }
      progressArc.setAttribute('stroke', kind === 'pause' ? PAUSE_COLOR : NAVIGATION_COLOR);
      badge.textContent = gestureSymbol(kind);
      badge.style.display = 'flex';
      dwell.reset();
      setProgress(0);
    };

    const flash = (color: string): void => {
      dot.animate(
        [
          { transform: 'scale(1)', backgroundColor: color },
          { transform: 'scale(1.5)', backgroundColor: color },
          { transform: 'scale(1)', backgroundColor: clickingPaused ? PAUSED_DOT_COLOR : DOT_COLOR },
        ],
        { duration: 280, easing: 'ease-out' },
      );
    };

    const canMagnetize = (element: Element): boolean => {
      const { width, height } = element.getBoundingClientRect();
      return width * height <= window.innerWidth * window.innerHeight * MAGNET_MAX_AREA_RATIO;
    };

    const tick = (now: number): void => {
      frameId = requestAnimationFrame(tick);
      const elapsedMs = lastFrameMs === null ? 0 : now - lastFrameMs;
      lastFrameMs = now;
      if (!hasPosition || gesture !== null) return;

      if (clickingPaused) {
        magnet = null;
        display = smoothPointer(display, raw, elapsedMs, false);
        render(display);
        return;
      }

      if (elapsedMs > FRAME_GAP_RESET_MS) dwell.reset();

      const aim = magnet?.isConnected ? attractToTarget(raw, magnet.getBoundingClientRect()) : null;
      if (!aim) magnet = null;

      display = smoothPointer(display, aim ?? raw, elapsedMs, aim !== null);
      render(display);

      const target = findClickTarget(display.x, display.y);
      if (target && target.clickable !== magnet && canMagnetize(target.clickable)) {
        magnet = target.clickable;
      }

      const { progress, fired } = dwell.update(target?.clickable ?? null, display.x, display.y, now);
      setProgress(fired ? 0 : progress);

      if (fired && target) {
        performClick(target, display.x, display.y);
        flash(CLICK_COLOR);
      }
    };

    const setVisible = (visible: boolean): void => {
      cursor.style.display = visible ? 'block' : 'none';
      hasPosition = false;
      magnet = null;
      lastFrameMs = null;
      setGesture(null);
      setPaused(false);

      if (visible && frameId === null) {
        frameId = requestAnimationFrame(tick);
      } else if (!visible && frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const attach = (): void => {
      document.body.appendChild(cursor);
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

      if (runtimeMessage.type === 'GESTURE_HOLD') {
        const { kind, progress, fired } = runtimeMessage.payload;
        if (kind !== gesture) setGesture(kind);
        if (kind !== null) setProgress(progress);
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
        if (response?.running) setPaused(Boolean(response.clickingPaused));
      })
      .catch(() => {});
  },
});
