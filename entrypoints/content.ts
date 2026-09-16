import { findClickTarget, performClick } from '@/lib/click';
import { DwellDetector } from '@/lib/dwell';
import type { RuntimeMessage, StatusResponse } from '@/lib/messages';
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
    const CLICK_COLOR = 'rgba(34, 197, 94, 0.85)';
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

    const arcs = [createArc('rgba(0, 0, 0, 0.55)', RING_SHADOW_STROKE), createArc('#f59e0b', RING_STROKE)];
    cursor.append(dot, ring);

    const dwell = new DwellDetector<Element>();
    let raw: Point = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let display: Point = raw;
    let hasPosition = false;
    let magnet: Element | null = null;
    let lastFrameMs: number | null = null;
    let frameId: number | null = null;

    const render = (point: Point): void => {
      cursor.style.transform = `translate(${point.x - RING_SIZE / 2}px, ${point.y - RING_SIZE / 2}px)`;
    };

    const setProgress = (progress: number): void => {
      const offset = String(RING_CIRCUMFERENCE * (1 - progress));
      for (const arc of arcs) arc.setAttribute('stroke-dashoffset', offset);
    };

    const flashClick = (): void => {
      dot.animate(
        [
          { transform: 'scale(1)', backgroundColor: CLICK_COLOR },
          { transform: 'scale(1.5)', backgroundColor: CLICK_COLOR },
          { transform: 'scale(1)', backgroundColor: DOT_COLOR },
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
      if (!hasPosition) return;
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
        flashClick();
      }
    };

    const setVisible = (visible: boolean): void => {
      cursor.style.display = visible ? 'block' : 'none';
      hasPosition = false;
      magnet = null;
      lastFrameMs = null;
      dwell.reset();
      setProgress(0);

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
    });

    chrome.runtime
      .sendMessage({ type: 'QUERY_STATUS' })
      .then((response: StatusResponse | undefined) => setVisible(Boolean(response?.running)))
      .catch(() => {});
  },
});
