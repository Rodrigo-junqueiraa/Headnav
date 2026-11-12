import { describe, it, expect } from 'vitest';
import { FacePresenceTracker } from './facePresence';

const config = { lostAfterMs: 300 };

describe('FacePresenceTracker', () => {
  it('starts out assuming the face is there', () => {
    const tracker = new FacePresenceTracker(config);
    expect(tracker.update(true, 0)).toBe(true);
  });

  it('ignores a face missing for a single frame', () => {
    const tracker = new FacePresenceTracker(config);
    tracker.update(true, 0);
    expect(tracker.update(false, 100)).toBe(true);
    expect(tracker.update(true, 200)).toBe(true);
  });

  it('reports the face as lost once it has been missing long enough', () => {
    const tracker = new FacePresenceTracker(config);
    tracker.update(true, 0);
    expect(tracker.update(false, 100)).toBe(true);
    expect(tracker.update(false, 300)).toBe(true);
    expect(tracker.update(false, 400)).toBe(false);
  });

  it('reports the face back as soon as it is detected again', () => {
    const tracker = new FacePresenceTracker(config);
    tracker.update(false, 0);
    tracker.update(false, 500);
    expect(tracker.update(true, 600)).toBe(true);
  });

  it('measures for how long the face has been missing', () => {
    const tracker = new FacePresenceTracker(config);
    expect(tracker.missingForMs(1000)).toBe(0);
    tracker.update(false, 1000);
    expect(tracker.missingForMs(2500)).toBe(1500);
    tracker.update(true, 2600);
    expect(tracker.missingForMs(2700)).toBe(0);
  });

  it('clears everything on reset', () => {
    const tracker = new FacePresenceTracker(config);
    tracker.update(false, 0);
    tracker.update(false, 500);
    tracker.reset();
    expect(tracker.missingForMs(600)).toBe(0);
    expect(tracker.update(false, 600)).toBe(true);
  });
});
