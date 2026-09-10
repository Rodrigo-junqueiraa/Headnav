import { cp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDest = resolve(root, 'public/wasm');
const modelDir = resolve(root, 'public/models');
const modelPath = resolve(modelDir, 'face_landmarker.task');

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

async function copyWasm() {
  if (!existsSync(wasmSrc)) {
    throw new Error('MediaPipe wasm not found. Run "npm install" first.');
  }
  await mkdir(wasmDest, { recursive: true });
  await cp(wasmSrc, wasmDest, { recursive: true });
  console.log('[assets] copied MediaPipe wasm -> public/wasm');
}

async function downloadModel() {
  await mkdir(modelDir, { recursive: true });
  if (existsSync(modelPath)) {
    console.log('[assets] face_landmarker.task already present, skipping download');
    return;
  }
  console.log('[assets] downloading face_landmarker.task ...');
  const res = await fetch(MODEL_URL);
  if (!res.ok) {
    throw new Error(`Failed to download model: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(modelPath, buf);
  console.log(
    `[assets] saved face_landmarker.task (${(buf.length / 1024 / 1024).toFixed(1)} MB) -> public/models`,
  );
}

await copyWasm();
await downloadModel();
