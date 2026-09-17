import { describe, it, expect } from 'vitest';
import { WinkHoldDetector, detectWinkSide } from './wink';

const config = {
  holdMs: 1000,
  minClosed: 0.22,
  minDifference: 0.1,
  keepClosed: 0.14,
  keepDifference: 0.06,
  maxOpen: 0.55,
  flickerMs: 400,
};

describe('detectWinkSide', () => {
  it('returns null when both eyes are open', () => {
    expect(detectWinkSide(0.05, 0.08, config)).toBeNull();
  });

  it('returns null on a natural blink that closes both eyes', () => {
    expect(detectWinkSide(0.9, 0.88, config)).toBeNull();
  });

  it('detects the left eye closed', () => {
    expect(detectWinkSide(0.5, 0.25, config)).toBe('left');
  });

  it('detects the right eye closed with the lower scores seen through glasses', () => {
    expect(detectWinkSide(0.17, 0.35, config)).toBe('right');
  });

  it('ignores a closure that is too weak to start the gesture', () => {
    expect(detectWinkSide(0.18, 0.05, config)).toBeNull();
  });

  it('keeps a weak signal alive once the gesture is running', () => {
    expect(detectWinkSide(0.18, 0.05, config, 'left')).toBe('left');
  });

  it('does not keep the gesture alive for the other eye', () => {
    expect(detectWinkSide(0.18, 0.05, config, 'right')).toBeNull();
  });
});

describe('WinkHoldDetector', () => {
  it('reports progress while the eye stays closed', () => {
    const detector = new WinkHoldDetector(config);
    detector.update(0.5, 0.2, 0);
    const state = detector.update(0.5, 0.2, 500);
    expect(state.side).toBe('left');
    expect(state.progress).toBeCloseTo(0.5, 5);
    expect(state.fired).toBeNull();
  });

  it('fires once when the hold time is reached', () => {
    const detector = new WinkHoldDetector(config);
    detector.update(0.5, 0.2, 0);
    expect(detector.update(0.5, 0.2, 1000).fired).toBe('left');
    expect(detector.update(0.5, 0.2, 1500).fired).toBeNull();
  });

  it('survives a weak reading in the middle of the hold', () => {
    const detector = new WinkHoldDetector(config);
    detector.update(0.5, 0.2, 0);
    detector.update(0.16, 0.06, 400);
    expect(detector.update(0.5, 0.2, 1000).fired).toBe('left');
  });

  it('keeps counting through dropped samples inside the flicker window', () => {
    const detector = new WinkHoldDetector(config);
    detector.update(0.5, 0.2, 0);
    detector.update(0.5, 0.2, 400);
    detector.update(0.05, 0.05, 500);
    detector.update(0.05, 0.05, 600);
    expect(detector.update(0.5, 0.2, 700).progress).toBeCloseTo(0.7, 5);
    expect(detector.update(0.5, 0.2, 1000).fired).toBe('left');
  });

  it('restarts when the eye opens for longer than the flicker window', () => {
    const detector = new WinkHoldDetector(config);
    detector.update(0.5, 0.2, 0);
    detector.update(0.05, 0.05, 500);
    expect(detector.update(0.5, 0.2, 600).progress).toBeCloseTo(0, 5);
    expect(detector.update(0.5, 0.2, 1200).fired).toBeNull();
    expect(detector.update(0.5, 0.2, 1600).fired).toBe('left');
  });

  it('allows a second gesture after the eye opens again', () => {
    const detector = new WinkHoldDetector(config);
    detector.update(0.5, 0.2, 0);
    detector.update(0.5, 0.2, 1000);
    detector.update(0.05, 0.05, 1500);
    detector.update(0.5, 0.2, 1600);
    expect(detector.update(0.5, 0.2, 2600).fired).toBe('left');
  });

  it('restarts the hold when the other eye takes over', () => {
    const detector = new WinkHoldDetector(config);
    detector.update(0.5, 0.2, 0);
    detector.update(0.2, 0.5, 900);
    expect(detector.update(0.2, 0.5, 1400).fired).toBeNull();
    expect(detector.update(0.2, 0.5, 1900).fired).toBe('right');
  });
});
