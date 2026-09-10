# HeadNav — Hands-free Navigation

A Chrome extension that lets you **browse the web using only your head and eyes** — no
hands required. Built as an **accessibility** tool for people with limited or no hand
mobility (motor disabilities, tetraplegia).

> **Privacy first:** all camera processing happens **locally, in your browser**. No video
> frame ever leaves your machine, and no telemetry is collected.

## Why

Someone who can't use a mouse or keyboard should still be able to read, scroll, and
navigate the web comfortably. HeadNav turns head movement into cursor motion and
navigation, and eye/face gestures into clicks and commands.

## How it works

The webcam feed is analyzed with [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
entirely on-device:

- **Head pose** moves an on-screen cursor (smoothed).
- **Dwell** (holding the cursor still over a target) triggers a click. A single-eye
  blink is available as an optional click gesture.
- **Head gestures** drive navigation: look up/down to scroll, turn to go back/forward,
  a sharp movement to minimize/restore.

Because of Manifest V3 constraints, the camera runs in an **offscreen document**, and a
one-time **permission page** grants camera access to the extension's own origin.

## Tech

- [WXT](https://wxt.dev/) + TypeScript
- [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision) (WASM + model bundled locally)
- Chrome Manifest V3 (offscreen document, service worker, content script)

## Status

Work in progress. Roadmap:

| # | Stage | State |
|---|-------|-------|
| 0 | Foundation (scaffold, build, repo) | ✅ |
| 1 | Camera + face landmarks | 🔵 |
| 2 | Head-controlled cursor (smoothed) | ⬜ |
| 3 | Hands-free click (dwell + optional wink) | ⬜ |
| 4 | Gesture navigation + state machine | ⬜ |
| 5 | Calibration + configuration | ⬜ |
| 6 | Polish (demo GIF, diagram, tests) | ⬜ |

## Development

```bash
npm install      # install dependencies
npm run dev      # launch a dev browser with the extension loaded
npm run build    # production build into .output/
npm run zip      # zip a distributable
```

To load a build manually: open `chrome://extensions`, enable **Developer mode**, click
**Load unpacked**, and select `.output/chrome-mv3/`.

## License

MIT — see [LICENSE](LICENSE).
