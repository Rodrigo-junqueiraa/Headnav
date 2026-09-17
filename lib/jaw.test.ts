import { describe, it, expect } from 'vitest';
import { JawHoldDetector } from './jaw';

const config = { holdMs: 1000, openThreshold: 0.35, keepThreshold: 0.2, flickerMs: 400 };

describe('JawHoldDetector', () => {
  it('stays idle while the mouth is closed', () => {
    const detector = new JawHoldDetector(config);
    expect(detector.update(0.05, 0)).toEqual({ active: false, progress: 0, fired: false });
    expect(detector.update(0.3, 100)).toEqual({ active: false, progress: 0, fired: false });
  });

  it('reports progress while the mouth stays open', () => {
    const detector = new JawHoldDetector(config);
    detector.update(0.6, 0);
    const state = detector.update(0.6, 500);
    expect(state.active).toBe(true);
    expect(state.progress).toBeCloseTo(0.5, 5);
    expect(state.fired).toBe(false);
  });

  it('fires once when the hold time is reached', () => {
    const detector = new JawHoldDetector(config);
    detector.update(0.6, 0);
    expect(detector.update(0.6, 1000).fired).toBe(true);
    expect(detector.update(0.6, 1500).fired).toBe(false);
  });

  it('keeps the hold alive on a weaker reading once it started', () => {
    const detector = new JawHoldDetector(config);
    detector.update(0.6, 0);
    detector.update(0.25, 400);
    expect(detector.update(0.6, 1000).fired).toBe(true);
  });

  it('keeps counting through dropped samples inside the flicker window', () => {
    const detector = new JawHoldDetector(config);
    detector.update(0.6, 0);
    detector.update(0.6, 400);
    detector.update(0.02, 500);
    expect(detector.update(0.6, 600).progress).toBeCloseTo(0.6, 5);
    expect(detector.update(0.6, 1000).fired).toBe(true);
  });

  it('restarts when the mouth closes for longer than the flicker window', () => {
    const detector = new JawHoldDetector(config);
    detector.update(0.6, 0);
    detector.update(0.02, 500);
    expect(detector.update(0.6, 600).progress).toBeCloseTo(0, 5);
    expect(detector.update(0.6, 1200).fired).toBe(false);
    expect(detector.update(0.6, 1600).fired).toBe(true);
  });

  it('allows a second toggle after the mouth closes again', () => {
    const detector = new JawHoldDetector(config);
    detector.update(0.6, 0);
    detector.update(0.6, 1000);
    detector.update(0.02, 1500);
    detector.update(0.6, 1600);
    expect(detector.update(0.6, 2600).fired).toBe(true);
  });
});
