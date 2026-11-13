# HeadNav — Hands-free Navigation

**English** · [Português](README.pt-BR.md)

A Chrome extension that lets you **browse the web using only your head and eyes** — no
hands required. Built as an **accessibility** tool for people with limited or no hand
mobility (motor disabilities, tetraplegia).

> **Privacy first:** all camera processing happens **locally, in your browser**. No video
> frame ever leaves your machine, and no telemetry is collected.
>
> **Voice dictation is optional.** In **local** mode the audio stays on your computer. In
> **online** mode Chrome sends the audio to Google to turn it into text, and HeadNav asks
> for your authorization every time before the microphone opens.

## Why

Someone who can't use a mouse or keyboard should still be able to read, scroll, and
navigate the web comfortably. HeadNav turns head movement into cursor motion, and simple
face gestures into clicks, navigation and voice typing.

## How to use

### Gestures

| Gesture | What it does | What the cursor shows |
|---|---|---|
| Move your head | Moves the cursor | Blue circle |
| Hold the cursor on a link, button or field for 1.5 s | Clicks. A magnet pulls the cursor onto small targets; to click the same target again, move away and come back | Orange ring filling up |
| Close your **left** eye for 2 s, keeping the other one open | Goes back to the previous page | Blue ring with ←; the cursor holds still during the gesture |
| Close your **right** eye for 2 s, keeping the other one open | Goes forward to the next page | Blue ring with → |
| Open your mouth for 1.4 s | Pauses clicking; repeat the gesture to click again. The cursor, eye gestures and scrolling keep working | Purple ring; while paused, a grey cursor with ⏸ |
| Hold the cursor in the top or bottom strip of the screen for 2 s | Scrolls the page; the closer to the edge, the faster | Green ring with ↑ or ↓ |

### Voice typing (optional)

1. Hold the cursor on a text field, such as the YouTube search box: the voice typing panel opens.
2. Hold it on **Allow and speak** (online mode) or **Speak** (local mode).
3. Speak. The text appears as you talk, and the microphone turns off by itself when you stop
   (15 s at most).
4. Check the text and hold the cursor on **Search** (search fields) or **Insert** (other fields).
   **Speak again** starts over and **Cancel** discards it.

While the microphone listens, gestures are paused and the cursor turns red with 🎤, so speaking
never clicks or navigates by accident. Password fields never open the panel.

### Signals

- **Grey cursor with ?** — your face is not being seen: the cursor stops and nothing is clicked.
- **CAM** on the HeadNav icon — the camera is on. A red **MIC** — the microphone is on.

### Setup (once, with help)

On the setup page, a helper allows the camera, allows the microphone (optional), chooses online
or local voice and installs the local voice if needed. After that, the only step is **Start** on
the HeadNav icon. The same guide is available inside the extension, under **How to use** in the
HeadNav menu.

## How it works

The webcam feed is analyzed with [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
entirely on-device. Head pose drives the cursor (mirrored and smoothed with a One Euro filter),
and face blendshapes (eye blinks, jaw) drive the gestures through small state machines with
hysteresis: a natural blink doesn't fire a command, and gestures pause while you dictate.

Because of Manifest V3 constraints, the camera and the speech recognizer run in an
**offscreen document**, the service worker routes gestures and dictation sessions, and a
content script draws the cursor and the dictation panel on the page. A one-time **setup page**
grants camera and microphone access to the extension's own origin, so no website ever asks for
them.

## Tech

- [WXT](https://wxt.dev/) + TypeScript
- [`@mediapipe/tasks-vision`](https://www.npmjs.com/package/@mediapipe/tasks-vision) (WASM + model bundled locally)
- Web Speech API, online or on-device
- Chrome Manifest V3 (offscreen document, service worker, content script)
- Interface in English and Portuguese (Chrome i18n)
- [Vitest](https://vitest.dev/) for the gesture, cursor and dictation logic

## Status

Work in progress. Roadmap:

| # | Stage | State |
|---|-------|-------|
| 0 | Foundation (scaffold, build, repo) | ✅ |
| 1 | Camera + face landmarks | ✅ |
| 2 | Head-controlled cursor (smoothed) | ✅ |
| 3 | Hands-free click (dwell with a magnet on targets) | ✅ |
| 4 | Gesture navigation (eye hold for back/forward, mouth hold to pause, edge scroll) | ✅ |
| 5 | Voice dictation into text fields (optional, online or local) | ✅ |
| 6 | Calibration + configuration | ⬜ |
| 7 | Polish (demo GIF, diagram, tests) | ⬜ |

## Development

```bash
npm install      # install dependencies
npm run dev      # launch a dev browser with the extension loaded
npm run build    # production build into .output/
npm run compile  # type check
npm test         # unit tests
npm run zip      # zip a distributable
```

To load a build manually: open `chrome://extensions`, enable **Developer mode**, click
**Load unpacked**, and select `.output/chrome-mv3/`.

## License

MIT — see [LICENSE](LICENSE).
