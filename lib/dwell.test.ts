import { describe, it, expect } from 'vitest';
import { DwellDetector } from './dwell';

const config = { dwellMs: 1000, graceMs: 200, rearmDistancePx: 20 };
const idle = { progress: 0, fired: false };

function dwellingOn(target: string, startMs: number): DwellDetector<string> {
  const detector = new DwellDetector<string>(config);
  detector.update(null, 0, 0, startMs - 1);
  detector.update(target, 100, 0, startMs);
  detector.update(target, 100, 0, startMs + config.graceMs);
  return detector;
}

describe('DwellDetector', () => {
  it('ignores the target under the cursor when tracking starts', () => {
    const detector = new DwellDetector<string>(config);
    detector.update('a', 0, 0, 0);
    expect(detector.update('a', 0, 0, 5000)).toEqual(idle);
  });

  it('builds progress while staying on the same target', () => {
    const detector = dwellingOn('a', 0);
    expect(detector.update('a', 100, 0, 500).progress).toBeCloseTo(0.5, 5);
  });

  it('fires once when the dwell time is reached', () => {
    const detector = dwellingOn('a', 0);
    expect(detector.update('a', 100, 0, 1000)).toEqual({ progress: 1, fired: true });
    expect(detector.update('a', 100, 0, 1500)).toEqual(idle);
    expect(detector.update('a', 100, 0, 5000).fired).toBe(false);
  });

  it('tolerates brief exits within the grace period', () => {
    const detector = dwellingOn('a', 0);
    detector.update(null, 100, 12, 400);
    detector.update('b', 100, 14, 500);
    expect(detector.update('a', 100, 0, 1000)).toEqual({ progress: 1, fired: true });
  });

  it('moves the dwell to a new target after the grace period', () => {
    const detector = dwellingOn('a', 0);
    detector.update('b', 160, 0, 300);
    expect(detector.update('b', 160, 0, 500).progress).toBeCloseTo(0.2, 5);
    expect(detector.update('b', 160, 0, 1300)).toEqual({ progress: 1, fired: true });
  });

  it('re-arms after moving away from the clicked spot', () => {
    const detector = dwellingOn('a', 0);
    detector.update('a', 100, 0, 1000);
    detector.update(null, 140, 0, 1100);
    detector.update(null, 140, 0, 1300);
    detector.update('a', 100, 0, 1400);
    detector.update('a', 100, 0, 1600);
    expect(detector.update('a', 100, 0, 2400)).toEqual({ progress: 1, fired: true });
  });

  it('stays disarmed when the target is replaced without moving', () => {
    const detector = dwellingOn('a', 0);
    detector.update('a', 100, 0, 1000);
    detector.update('a2', 102, 0, 1100);
    detector.update('a2', 102, 0, 1300);
    expect(detector.update('a2', 102, 0, 5000).fired).toBe(false);
  });

  it('requires moving again after a reset', () => {
    const detector = dwellingOn('a', 0);
    detector.reset();
    detector.update('a', 100, 0, 100);
    expect(detector.update('a', 100, 0, 5000).fired).toBe(false);
    detector.update('b', 200, 0, 5100);
    detector.update('b', 200, 0, 5300);
    expect(detector.update('b', 200, 0, 6100)).toEqual({ progress: 1, fired: true });
  });

  it('never dwells over empty space', () => {
    const detector = new DwellDetector<string>(config);
    detector.update('a', 0, 0, 0);
    detector.update(null, 50, 0, 100);
    detector.update(null, 50, 0, 300);
    expect(detector.update(null, 50, 0, 5000)).toEqual(idle);
  });
});
