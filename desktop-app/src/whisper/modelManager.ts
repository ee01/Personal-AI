import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, unlink, stat, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

const MODEL_NAME = 'ggml-base.en';
const MODEL_URL =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
const MODEL_EXPECTED_BYTES = 147964211;

export function getModelDir(): string {
  return join(
    homedir(),
    'Library',
    'Application Support',
    'Personal AI',
    'whisper-models',
  );
}

export function getModelPath(): string {
  return join(getModelDir(), `${MODEL_NAME}.bin`);
}

export interface ModelReadyResult {
  ready: boolean;
  reason?: 'missing' | 'corrupt' | 'size_mismatch';
}

export async function isModelReady(): Promise<ModelReadyResult> {
  const modelPath = getModelPath();
  if (!existsSync(modelPath)) {
    return { ready: false, reason: 'missing' };
  }
  try {
    const info = await stat(modelPath);
    if (info.size !== MODEL_EXPECTED_BYTES) {
      return { ready: false, reason: 'size_mismatch' };
    }
    return { ready: true };
  } catch {
    return { ready: false, reason: 'corrupt' };
  }
}

export async function downloadModel(
  onProgress: (pct: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const modelDir = getModelDir();
  const modelPath = getModelPath();
  const tmpPath = `${modelPath}.tmp`;

  try {
    await mkdir(modelDir, { recursive: true });

    const response = await fetch(MODEL_URL);
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    let downloaded = 0;
    let lastReportedPct = -1;

    const fileStream = createWriteStream(tmpPath);

    const body = response.body;
    if (!body) {
      return { ok: false, error: 'No response body' };
    }

    const reader = body.getReader();
    await new Promise<void>((resolve, reject) => {
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fileStream.write(value);
            downloaded += value.length;
            if (contentLength > 0) {
              const pct = Math.floor((downloaded / contentLength) * 100);
              if (pct !== lastReportedPct && (pct % 5 === 0 || pct === 100)) {
                lastReportedPct = pct;
                onProgress(pct);
              }
            }
          }
          fileStream.end();
          fileStream.once('finish', resolve);
          fileStream.once('error', reject);
        } catch (e) {
          reject(e);
        }
      };
      void pump();
    });

    const info = await stat(tmpPath);
    if (info.size !== MODEL_EXPECTED_BYTES) {
      await unlink(tmpPath).catch(() => undefined);
      return {
        ok: false,
        error: `Downloaded file size mismatch: expected ${MODEL_EXPECTED_BYTES}, got ${info.size}`,
      };
    }

    await rename(tmpPath, modelPath);
    onProgress(100);
    return { ok: true };
  } catch (e) {
    await unlink(tmpPath).catch(() => undefined);
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}

export async function deleteModel(): Promise<void> {
  const modelPath = getModelPath();
  await unlink(modelPath).catch(() => undefined);
}
