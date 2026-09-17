import { describe, it, expect } from 'vitest';
import { EdgeScrollDetector, edgeAt, edgeDepth, scrollSpeed } from './scroll';

const config = { bandPx: 50, armMs: 2000, minSpeedPxPerSec: 250, maxSpeedPxPerSec: 1300 };
const viewport = 800;

describe('edgeAt', () => {
  it('returns null in the middle of the viewport', () => {
    expect(edgeAt(400, viewport, config)).toBeNull();
  });

  it('detects the top band', () => {
    expect(edgeAt(10, viewport, config)).toBe('up');
  });

  it('detects the bottom band', () => {
    expect(edgeAt(790, viewport, config)).toBe('down');
  });
});

describe('edgeDepth', () => {
  it('is zero outside the bands', () => {
    expect(edgeDepth(400, viewport, config)).toBe(0);
  });

  it('grows closer to the top edge', () => {
    expect(edgeDepth(25, viewport, config)).toBeCloseTo(0.5, 5);
    expect(edgeDepth(0, viewport, config)).toBeCloseTo(1, 5);
  });

  it('grows closer to the bottom edge', () => {
    expect(edgeDepth(775, viewport, config)).toBeCloseTo(0.5, 5);
    expect(edgeDepth(800, viewport, config)).toBeCloseTo(1, 5);
  });
});

describe('scrollSpeed', () => {
  it('uses the slow speed at the inner edge of the band', () => {
    expect(scrollSpeed(0, config)).toBe(250);
  });

  it('uses the fast speed at the screen edge', () => {
    expect(scrollSpeed(1, config)).toBe(1300);
  });

  it('grows with depth', () => {
    expect(scrollSpeed(0.5, config)).toBeCloseTo(775, 5);
  });
});

describe('EdgeScrollDetector', () => {
  it('stays idle away from the edges', () => {
    const detector = new EdgeScrollDetector(config);
    expect(detector.update(null, 0)).toEqual({ edge: null, progress: 0, scrolling: false });
  });

  it('arms after the configured time and then keeps scrolling', () => {
    const detector = new EdgeScrollDetector(config);
    detector.update('down', 0);
    expect(detector.update('down', 1000).progress).toBeCloseTo(0.5, 5);
    expect(detector.update('down', 2000)).toEqual({ edge: 'down', progress: 1, scrolling: true });
    expect(detector.update('down', 2500).scrolling).toBe(true);
  });

  it('stops as soon as the cursor leaves the band', () => {
    const detector = new EdgeScrollDetector(config);
    detector.update('down', 0);
    detector.update('down', 2000);
    expect(detector.update(null, 2100).scrolling).toBe(false);
    expect(detector.update('down', 2200).scrolling).toBe(false);
  });

  it('restarts the countdown when switching edges', () => {
    const detector = new EdgeScrollDetector(config);
    detector.update('down', 0);
    detector.update('down', 2000);
    expect(detector.update('up', 2100).scrolling).toBe(false);
    expect(detector.update('up', 3000).scrolling).toBe(false);
    expect(detector.update('up', 4100).scrolling).toBe(true);
  });
});
