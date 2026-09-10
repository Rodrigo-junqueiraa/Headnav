import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { matrixToEuler } from '@/lib/pose';
import type { DetectionStatus, RuntimeMessage } from '@/lib/messages';

function broadcast(message: RuntimeMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function buildStatus(result: FaceLandmarkerResult, fps: number): DetectionStatus {
  const faceDetected = result.faceLandmarks.length > 0;
  let yaw = 0;
  let pitch = 0;
  let roll = 0;
  let blinkLeft = 0;
  let blinkRight = 0;
  let jawOpen = 0;

  const matrix = result.facialTransformationMatrixes?.[0];
  if (matrix) {
    const euler = matrixToEuler(matrix.data);
    yaw = euler.yaw;
    pitch = euler.pitch;
    roll = euler.roll;
  }

  const blendshapes = result.faceBlendshapes?.[0];
  if (blendshapes) {
    for (const category of blendshapes.categories) {
      if (category.categoryName === 'eyeBlinkLeft') blinkLeft = category.score;
      else if (category.categoryName === 'eyeBlinkRight') blinkRight = category.score;
      else if (category.categoryName === 'jawOpen') jawOpen = category.score;
    }
  }

  return {
    running: true,
    faceDetected,
    fps,
    yaw,
    pitch,
    roll,
    blinkLeft,
    blinkRight,
    jawOpen,
    timestamp: Date.now(),
  };
}

async function createLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(chrome.runtime.getURL('wasm'));
  const modelAssetPath = chrome.runtime.getURL('models/face_landmarker.task');
  const shared = {
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  };

  try {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'GPU' },
      ...shared,
    });
  } catch {
    return await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath, delegate: 'CPU' },
      ...shared,
    });
  }
}

async function main(): Promise<void> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240 },
      audio: false,
    });
  } catch (error: unknown) {
    broadcast({ type: 'DETECTION_ERROR', payload: { message: `Camera access failed: ${String(error)}` } });
    return;
  }

  video.srcObject = stream;
  await video.play();

  let landmarker: FaceLandmarker;
  try {
    landmarker = await createLandmarker();
  } catch (error: unknown) {
    broadcast({ type: 'DETECTION_ERROR', payload: { message: `Failed to load model: ${String(error)}` } });
    return;
  }

  let frames = 0;
  let fps = 0;
  let windowStart = performance.now();
  let lastBroadcast = 0;

  const process = (now: number): void => {
    let result: FaceLandmarkerResult;
    try {
      result = landmarker.detectForVideo(video, now);
    } catch {
      return;
    }

    frames += 1;
    const elapsed = now - windowStart;
    if (elapsed >= 500) {
      fps = Math.round((frames * 1000) / elapsed);
      frames = 0;
      windowStart = now;
    }

    if (now - lastBroadcast >= 100) {
      lastBroadcast = now;
      broadcast({ type: 'DETECTION_STATUS', payload: buildStatus(result, fps) });
    }
  };

  if ('requestVideoFrameCallback' in video) {
    const onFrame = (now: number): void => {
      process(now);
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    const loop = (): void => {
      process(performance.now());
      setTimeout(loop, 33);
    };
    loop();
  }
}

void main();
