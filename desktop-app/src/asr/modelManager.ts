import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const SHERPA_STREAMING_MODEL_NAME =
  'sherpa-onnx-streaming-paraformer-bilingual-zh-en';
export const FUNASR_NANO_MODEL_NAME =
  'sherpa-onnx-funasr-nano-int8-2025-12-30';

const HF_RAW_BASE = 'https://huggingface.co/csukuangfj';

type AsrModelKind = 'sherpa_streaming' | 'funasr_nano';

interface ModelFileSpec {
  relativePath: string;
  bytes: number;
  url: string;
}

interface ModelSpec {
  kind: AsrModelKind;
  name: string;
  files: ModelFileSpec[];
}

const SHERPA_STREAMING_FILES: ModelFileSpec[] = [
  {
    relativePath: 'encoder.int8.onnx',
    bytes: 165462184,
    url: `${HF_RAW_BASE}/${SHERPA_STREAMING_MODEL_NAME}/resolve/main/encoder.int8.onnx`,
  },
  {
    relativePath: 'decoder.int8.onnx',
    bytes: 71664561,
    url: `${HF_RAW_BASE}/${SHERPA_STREAMING_MODEL_NAME}/resolve/main/decoder.int8.onnx`,
  },
  {
    relativePath: 'tokens.txt',
    bytes: 75756,
    url: `${HF_RAW_BASE}/${SHERPA_STREAMING_MODEL_NAME}/resolve/main/tokens.txt`,
  },
];

const FUNASR_NANO_FILES: ModelFileSpec[] = [
  {
    relativePath: 'embedding.int8.onnx',
    bytes: 155584380,
    url: `${HF_RAW_BASE}/${FUNASR_NANO_MODEL_NAME}/resolve/main/embedding.int8.onnx`,
  },
  {
    relativePath: 'encoder_adaptor.int8.onnx',
    bytes: 237792748,
    url: `${HF_RAW_BASE}/${FUNASR_NANO_MODEL_NAME}/resolve/main/encoder_adaptor.int8.onnx`,
  },
  {
    relativePath: 'llm.int8.onnx',
    bytes: 600356593,
    url: `${HF_RAW_BASE}/${FUNASR_NANO_MODEL_NAME}/resolve/main/llm.int8.onnx`,
  },
  {
    relativePath: 'Qwen3-0.6B/merges.txt',
    bytes: 1671853,
    url: `${HF_RAW_BASE}/${FUNASR_NANO_MODEL_NAME}/resolve/main/Qwen3-0.6B/merges.txt`,
  },
  {
    relativePath: 'Qwen3-0.6B/tokenizer.json',
    bytes: 11422654,
    url: `${HF_RAW_BASE}/${FUNASR_NANO_MODEL_NAME}/resolve/main/Qwen3-0.6B/tokenizer.json`,
  },
  {
    relativePath: 'Qwen3-0.6B/vocab.json',
    bytes: 2776833,
    url: `${HF_RAW_BASE}/${FUNASR_NANO_MODEL_NAME}/resolve/main/Qwen3-0.6B/vocab.json`,
  },
];

const MODEL_SPECS: Record<AsrModelKind, ModelSpec> = {
  sherpa_streaming: {
    kind: 'sherpa_streaming',
    name: SHERPA_STREAMING_MODEL_NAME,
    files: SHERPA_STREAMING_FILES,
  },
  funasr_nano: {
    kind: 'funasr_nano',
    name: FUNASR_NANO_MODEL_NAME,
    files: FUNASR_NANO_FILES,
  },
};

let downloadInProgress = false;
let downloadProgress = 0;
let downloadTarget: AsrModelKind | 'all' | undefined;
let lastDownloadError: string | undefined;

export interface AsrModelReadyResult {
  ready: boolean;
  reason?: 'missing' | 'corrupt' | 'size_mismatch';
  missingFiles?: string[];
}

export function getAsrModelRoot(): string {
  const overrideDir = process.env.PERSONAL_AI_ASR_MODEL_DIR?.trim();
  if (overrideDir) return overrideDir;
  return join(
    homedir(),
    'Library',
    'Application Support',
    'Personal AI',
    'asr-models',
  );
}

export function getSherpaStreamingModelDir(): string {
  return join(getAsrModelRoot(), SHERPA_STREAMING_MODEL_NAME);
}

export function getFunAsrNanoModelDir(): string {
  return join(getAsrModelRoot(), FUNASR_NANO_MODEL_NAME);
}

export function getAsrModelDownloadStatus(): {
  downloadInProgress: boolean;
  downloadProgress: number;
  downloadTarget?: AsrModelKind | 'all';
  lastDownloadError?: string;
} {
  return {
    downloadInProgress,
    downloadProgress,
    downloadTarget,
    lastDownloadError,
  };
}

export async function isSherpaStreamingModelReady(): Promise<AsrModelReadyResult> {
  return isModelReady('sherpa_streaming');
}

export async function isFunAsrNanoModelReady(): Promise<AsrModelReadyResult> {
  return isModelReady('funasr_nano');
}

export function getSherpaStreamingModelPaths(): {
  encoder: string;
  decoder: string;
  tokens: string;
} {
  const dir = getSherpaStreamingModelDir();
  return {
    encoder: join(dir, 'encoder.int8.onnx'),
    decoder: join(dir, 'decoder.int8.onnx'),
    tokens: join(dir, 'tokens.txt'),
  };
}

export function getFunAsrNanoModelPaths(): {
  encoderAdaptor: string;
  llm: string;
  embedding: string;
  tokenizer: string;
} {
  const dir = getFunAsrNanoModelDir();
  return {
    encoderAdaptor: join(dir, 'encoder_adaptor.int8.onnx'),
    llm: join(dir, 'llm.int8.onnx'),
    embedding: join(dir, 'embedding.int8.onnx'),
    tokenizer: join(dir, 'Qwen3-0.6B'),
  };
}

export async function ensureAsrModels(
  target: AsrModelKind | 'all' = 'all',
): Promise<{ ok: boolean; downloading?: boolean; error?: string }> {
  if (downloadInProgress) {
    return { ok: true, downloading: true };
  }

  const targets: readonly AsrModelKind[] =
    target === 'all'
      ? (['sherpa_streaming', 'funasr_nano'] as const)
      : [target];
  const readiness = await Promise.all(targets.map((item) => isModelReady(item)));
  if (readiness.every((item) => item.ready)) {
    return { ok: true };
  }

  downloadInProgress = true;
  downloadProgress = 0;
  downloadTarget = target;
  lastDownloadError = undefined;

  void downloadModels(targets)
    .catch((error) => {
      lastDownloadError = String((error as Error)?.message || error);
    })
    .finally(() => {
      downloadInProgress = false;
      downloadTarget = undefined;
    });

  return { ok: true, downloading: true };
}

async function isModelReady(kind: AsrModelKind): Promise<AsrModelReadyResult> {
  const spec = MODEL_SPECS[kind];
  const dir = getModelDir(kind);
  const missingFiles: string[] = [];
  for (const file of spec.files) {
    const filePath = join(dir, file.relativePath);
    if (!existsSync(filePath)) {
      missingFiles.push(file.relativePath);
      continue;
    }
    try {
      const info = await stat(filePath);
      if (info.size !== file.bytes) {
        return {
          ready: false,
          reason: 'size_mismatch',
          missingFiles: [file.relativePath],
        };
      }
    } catch {
      return {
        ready: false,
        reason: 'corrupt',
        missingFiles: [file.relativePath],
      };
    }
  }
  if (missingFiles.length) {
    return { ready: false, reason: 'missing', missingFiles };
  }
  return { ready: true };
}

function getModelDir(kind: AsrModelKind): string {
  if (kind === 'sherpa_streaming') return getSherpaStreamingModelDir();
  return getFunAsrNanoModelDir();
}

async function downloadModels(
  targets: readonly AsrModelKind[],
): Promise<void> {
  const files = targets.flatMap((kind) =>
    MODEL_SPECS[kind].files.map((file) => ({ kind, file })),
  );
  const totalBytes = files.reduce((sum, item) => sum + item.file.bytes, 0);
  let completedBytes = 0;

  for (const item of files) {
    const dir = getModelDir(item.kind);
    const targetPath = join(dir, item.file.relativePath);
    const ready = await isFileReady(targetPath, item.file.bytes);
    if (ready) {
      completedBytes += item.file.bytes;
      reportOverallProgress(completedBytes, totalBytes);
      continue;
    }

    await downloadFile(item.file.url, targetPath, item.file.bytes, (bytes) => {
      reportOverallProgress(completedBytes + bytes, totalBytes);
    });
    completedBytes += item.file.bytes;
    reportOverallProgress(completedBytes, totalBytes);
  }
}

async function isFileReady(path: string, expectedBytes: number): Promise<boolean> {
  try {
    const info = await stat(path);
    return info.size === expectedBytes;
  } catch {
    return false;
  }
}

async function downloadFile(
  url: string,
  targetPath: string,
  expectedBytes: number,
  onProgress: (downloadedBytes: number) => void,
): Promise<void> {
  const tmpPath = `${targetPath}.tmp`;
  await mkdir(dirname(targetPath), { recursive: true });
  await unlink(tmpPath).catch(() => undefined);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  const fileStream = createWriteStream(tmpPath);
  const reader = response.body.getReader();
  let downloaded = 0;
  await new Promise<void>((resolve, reject) => {
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fileStream.write(value);
          downloaded += value.length;
          onProgress(downloaded);
        }
        fileStream.end();
        fileStream.once('finish', resolve);
        fileStream.once('error', reject);
      } catch (error) {
        reject(error);
      }
    };
    void pump();
  });

  const info = await stat(tmpPath);
  if (info.size !== expectedBytes) {
    await unlink(tmpPath).catch(() => undefined);
    throw new Error(
      `Downloaded file size mismatch for ${targetPath}: expected ${expectedBytes}, got ${info.size}`,
    );
  }
  await rename(tmpPath, targetPath);
}

function reportOverallProgress(downloadedBytes: number, totalBytes: number): void {
  if (totalBytes <= 0) {
    downloadProgress = 0;
    return;
  }
  downloadProgress = Math.max(
    0,
    Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100)),
  );
}
