export type ScrollEdge = 'up' | 'down';

export type EdgeScrollConfig = {
  bandPx: number;
  armMs: number;
  minSpeedPxPerSec: number;
  maxSpeedPxPerSec: number;
};

export const DEFAULT_EDGE_SCROLL: EdgeScrollConfig = {
  bandPx: 120,
  armMs: 2000,
  minSpeedPxPerSec: 90,
  maxSpeedPxPerSec: 400,
};

export function edgeAt(
  y: number,
  viewportHeight: number,
  config: EdgeScrollConfig = DEFAULT_EDGE_SCROLL,
): ScrollEdge | null {
  if (y <= config.bandPx) return 'up';
  if (y >= viewportHeight - config.bandPx) return 'down';
  return null;
}

export function edgeDepth(
  y: number,
  viewportHeight: number,
  config: EdgeScrollConfig = DEFAULT_EDGE_SCROLL,
): number {
  const edge = edgeAt(y, viewportHeight, config);
  if (edge === null) return 0;
  const distance = edge === 'up' ? config.bandPx - y : y - (viewportHeight - config.bandPx);
  return Math.min(1, Math.max(0, distance / config.bandPx));
}

export function scrollSpeed(depth: number, config: EdgeScrollConfig = DEFAULT_EDGE_SCROLL): number {
  const clamped = Math.min(1, Math.max(0, depth));
  return config.minSpeedPxPerSec + (config.maxSpeedPxPerSec - config.minSpeedPxPerSec) * clamped;
}

export type EdgeScrollState = {
  edge: ScrollEdge | null;
  progress: number;
  scrolling: boolean;
};

export class EdgeScrollDetector {
  private readonly config: EdgeScrollConfig;
  private edge: ScrollEdge | null = null;
  private startedAtMs = 0;
  private scrolling = false;

  constructor(config: Partial<EdgeScrollConfig> = {}) {
    this.config = { ...DEFAULT_EDGE_SCROLL, ...config };
  }

  reset(): void {
    this.edge = null;
    this.scrolling = false;
  }

  update(edge: ScrollEdge | null, timestampMs: number): EdgeScrollState {
    if (edge === null) {
      this.reset();
      return { edge: null, progress: 0, scrolling: false };
    }

    if (edge !== this.edge) {
      this.edge = edge;
      this.startedAtMs = timestampMs;
      this.scrolling = false;
    }

    if (this.scrolling) return { edge, progress: 1, scrolling: true };

    const progress = Math.min(1, (timestampMs - this.startedAtMs) / this.config.armMs);
    if (progress < 1) return { edge, progress, scrolling: false };

    this.scrolling = true;
    return { edge, progress: 1, scrolling: true };
  }
}

function canScroll(element: Element, edge: ScrollEdge): boolean {
  const { scrollTop, scrollHeight, clientHeight } = element;
  if (scrollHeight - clientHeight <= 1) return false;
  return edge === 'up' ? scrollTop > 1 : scrollTop + clientHeight < scrollHeight - 1;
}

export function findScrollable(start: Element | null, edge: ScrollEdge): Element | null {
  let element: Element | null = start;

  while (element) {
    const overflowY = getComputedStyle(element).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      if (canScroll(element, edge)) return element;
    }
    element = element.parentElement;
  }

  const root = document.scrollingElement;
  return root !== null && canScroll(root, edge) ? root : null;
}
