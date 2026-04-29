import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { accessSync, constants } from 'node:fs';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getManagedWhisperBinaryPath } from './binaryManager.js';
import {
  ensureWhisperServer,
  getWhisperServerBinaryPath,
  getWhisperServerState,
  stopWhisperServer,
  transcribeWithWhisperServer,
  type WhisperServerState,
} from './whisperServerEngine.js';
import { sanitizeWhisperTranscriptText } from './transcriptFilter.js';

const execFileAsync = promisify(execFile);

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

export interface WhisperResult {
  text: string;
  segments: WhisperSegment[];
}

export interface WhisperError {
  code: 'model_missing' | 'load_failed' | 'transcribe_failed';
  message: string;
}

interface ParsedWhisperSegment {
  offsets?: { from?: number; to?: number };
  text?: string;
}

interface ParsedWhisperJson {
  transcription?: ParsedWhisperSegment[];
}

let loadedModelPath: string | undefined;
let whisperBinary: string | undefined;
let activeSessionRefs = 0;
let lastUsedAt: number | undefined;
let idleUnloadAt: number | undefined;
let idleUnloadTimer: ReturnType<typeof setTimeout> | undefined;
let transcribeQueue: Promise<void> = Promise.resolve();
let activeOrQueuedTranscribes = 0;

const DEFAULT_IDLE_UNLOAD_MS = 90_000;

export interface WhisperEngineState {
  loaded: boolean;
  mode: 'server' | 'cli_warm';
  modelPath?: string;
  binaryPath?: string;
  server: WhisperServerState;
  activeSessionRefs: number;
  lastUsedAt?: number;
  idleUnloadMs: number;
  idleUnloadAt?: number;
  queued: boolean;
}

export interface Pcm16SpeechPresence {
  durationSec: number;
  overallRms: number;
  peakAbs: number;
  activeFrames: number;
  totalFrames: number;
  activeFrameRatio: number;
  likelyHasSpeech: boolean;
}

function findWhisperBinary(): string | undefined {
  const candidates = [
    getManagedWhisperBinaryPath(),
    join(process.cwd(), 'node_modules', '.bin', 'whisper'),
    join(process.cwd(), 'node_modules', '.bin', 'whisper-cpp'),
    '/usr/local/bin/whisper',
    '/usr/local/bin/whisper-cpp',
    '/opt/homebrew/bin/whisper',
    '/opt/homebrew/bin/whisper-cpp',
  ];
  for (const c of candidates) {
    try {
      accessSync(c, constants.X_OK);
      return c;
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function loadWhisperModel(modelPath: string): Promise<void> {
  const { access } = await import('node:fs/promises');
  try {
    await access(modelPath);
  } catch {
    const err: WhisperError = {
      code: 'model_missing',
      message: `Model file not found: ${modelPath}`,
    };
    throw err;
  }
  loadedModelPath = modelPath;
  whisperBinary = findWhisperBinary();
  touchWhisperEngine();
}

export function isWhisperLoaded(): boolean {
  return loadedModelPath !== undefined;
}

export function getWhisperBinaryPath(): string | undefined {
  return whisperBinary || findWhisperBinary();
}

export function getWhisperServerPath(): string | undefined {
  return getWhisperServerBinaryPath();
}

export async function warmWhisperEngine(): Promise<void> {
  if (!loadedModelPath) return;
  await ensureWhisperServer(loadedModelPath).catch(() => false);
}

export async function transcribeWithWhisper(
  pcm16: Buffer,
  opts?: { language?: string; translate?: boolean },
): Promise<WhisperResult> {
  activeOrQueuedTranscribes += 1;
  const run = transcribeQueue
    .catch(() => undefined)
    .then(() => transcribeWithWhisperNow(pcm16, opts))
    .finally(() => {
      activeOrQueuedTranscribes = Math.max(0, activeOrQueuedTranscribes - 1);
    });
  transcribeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function transcribeWithWhisperNow(
  pcm16: Buffer,
  opts?: { language?: string; translate?: boolean },
): Promise<WhisperResult> {
  if (!loadedModelPath) {
    const err: WhisperError = {
      code: 'load_failed',
      message: 'Whisper model not loaded. Call loadWhisperModel() first.',
    };
    throw err;
  }

  const signal = analyzePcm16SpeechPresence(pcm16);
  if (!signal.likelyHasSpeech) {
    touchWhisperEngine();
    return { text: '', segments: [] };
  }

  try {
    return sanitizeWhisperResult(
      await transcribeWithWhisperServer(loadedModelPath, pcm16, opts),
    );
  } catch {
    // Fall back to the one-shot CLI when the persistent server is missing or fails.
  }

  const tmpBase = join(
    tmpdir(),
    `whisper-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const tmpWav = `${tmpBase}.wav`;
  const tmpJson = `${tmpBase}.json`;
  try {
    const wavBuffer = pcm16ToWav(pcm16, 16000, 1);
    await writeFile(tmpWav, wavBuffer);

    const binaryPath = whisperBinary || findWhisperBinary();
    if (binaryPath) {
      whisperBinary = binaryPath;
      const args = [
        '--model',
        loadedModelPath,
        '--output-json',
        '--output-file',
        tmpBase,
        '--no-prints',
        tmpWav,
      ];
      if (opts?.language) args.push('--language', opts.language);
      if (opts?.translate) args.push('--translate');

      const { stdout } = await execFileAsync(binaryPath, args, {
        timeout: 60000,
      });

      try {
        const jsonText = await readFile(tmpJson, 'utf8').catch(() => stdout);
        const parsed = JSON.parse(jsonText) as ParsedWhisperJson;
        const segments: WhisperSegment[] = (parsed.transcription || []).map(
          (s) => ({
            start: s.offsets?.from ?? 0,
            end: s.offsets?.to ?? 0,
            text: String(s.text || '').trim(),
          }),
        );
        const text = segments
          .map((s) => s.text)
          .join(' ')
          .trim();
        return sanitizeWhisperResult({ text, segments });
      } catch {
        const text = stdout.trim();
        return sanitizeWhisperResult({
          text,
          segments: [{ start: 0, end: 0, text }],
        });
      }
    }

    const err: WhisperError = {
      code: 'transcribe_failed',
      message:
        'No whisper binary found. Install whisper.cpp or nodejs-whisper.',
    };
    throw err;
  } catch (e) {
    if ((e as WhisperError).code) throw e;
    const err: WhisperError = {
      code: 'transcribe_failed',
      message: String((e as Error)?.message || e),
    };
    throw err;
  } finally {
    touchWhisperEngine();
    await unlink(tmpWav).catch(() => undefined);
    await unlink(tmpJson).catch(() => undefined);
  }
}

function sanitizeWhisperResult(result: WhisperResult): WhisperResult {
  const text = sanitizeWhisperTranscriptText(result.text);
  if (!text) {
    return { text: '', segments: [] };
  }
  const segments = result.segments
    .map((segment) => ({
      ...segment,
      text: sanitizeWhisperTranscriptText(segment.text),
    }))
    .filter((segment) => segment.text);
  return { text, segments };
}

export async function unloadWhisperModel(): Promise<void> {
  clearIdleUnloadTimer();
  activeSessionRefs = 0;
  await stopWhisperServer();
  loadedModelPath = undefined;
  whisperBinary = undefined;
  lastUsedAt = undefined;
  idleUnloadAt = undefined;
}

export function retainWhisperEngine(): void {
  activeSessionRefs += 1;
  clearIdleUnloadTimer();
  touchWhisperEngine({ scheduleIdleUnload: false });
}

export function releaseWhisperEngine(): void {
  activeSessionRefs = Math.max(0, activeSessionRefs - 1);
  touchWhisperEngine({ scheduleIdleUnload: activeSessionRefs === 0 });
}

export function getWhisperEngineState(): WhisperEngineState {
  const server = getWhisperServerState();
  return {
    loaded: isWhisperLoaded(),
    mode: server.running ? 'server' : 'cli_warm',
    modelPath: loadedModelPath,
    binaryPath: getWhisperBinaryPath(),
    server,
    activeSessionRefs,
    lastUsedAt,
    idleUnloadMs: getIdleUnloadMs(),
    idleUnloadAt,
    queued: activeOrQueuedTranscribes > 0,
  };
}

function touchWhisperEngine(
  opts: { scheduleIdleUnload?: boolean } = {},
): void {
  lastUsedAt = Date.now();
  if (opts.scheduleIdleUnload ?? activeSessionRefs === 0) {
    scheduleIdleUnload();
  }
}

function scheduleIdleUnload(): void {
  if (!loadedModelPath || activeSessionRefs > 0) return;
  clearIdleUnloadTimer();
  const idleMs = getIdleUnloadMs();
  idleUnloadAt = Date.now() + idleMs;
  idleUnloadTimer = setTimeout(() => {
    if (!loadedModelPath || activeSessionRefs > 0) return;
    const idleFor = Date.now() - (lastUsedAt ?? 0);
    if (idleFor >= idleMs) {
      void unloadWhisperModel();
      return;
    }
    scheduleIdleUnload();
  }, idleMs);
  idleUnloadTimer.unref?.();
}

function clearIdleUnloadTimer(): void {
  if (idleUnloadTimer) {
    clearTimeout(idleUnloadTimer);
    idleUnloadTimer = undefined;
  }
  idleUnloadAt = undefined;
}

function getIdleUnloadMs(): number {
  const raw = Number(process.env.WHISPER_ENGINE_IDLE_UNLOAD_MS);
  if (Number.isFinite(raw) && raw >= 5_000) return Math.floor(raw);
  return DEFAULT_IDLE_UNLOAD_MS;
}

export function analyzePcm16SpeechPresence(
  pcm: Buffer,
  sampleRate = 16000,
): Pcm16SpeechPresence {
  const sampleCount = Math.floor(pcm.length / 2);
  const frameSize = Math.max(1, Math.round(sampleRate * 0.02));
  let sumSquares = 0;
  let peakAbs = 0;
  let activeFrames = 0;
  let totalFrames = 0;

  for (let start = 0; start < sampleCount; start += frameSize) {
    const end = Math.min(sampleCount, start + frameSize);
    let frameSumSquares = 0;
    let framePeak = 0;
    for (let i = start; i < end; i += 1) {
      const sample = Math.abs(pcm.readInt16LE(i * 2)) / 32768;
      frameSumSquares += sample * sample;
      sumSquares += sample * sample;
      if (sample > framePeak) framePeak = sample;
      if (sample > peakAbs) peakAbs = sample;
    }
    const frameRms = Math.sqrt(frameSumSquares / Math.max(1, end - start));
    if (frameRms >= 0.006 || framePeak >= 0.025) {
      activeFrames += 1;
    }
    totalFrames += 1;
  }

  const overallRms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
  const activeFrameRatio =
    totalFrames > 0 ? activeFrames / totalFrames : 0;
  const durationSec = sampleCount / Math.max(1, sampleRate);
  const likelyHasSpeech =
    durationSec >= 0.25 &&
    (overallRms >= 0.008 ||
      (overallRms >= 0.003 &&
        peakAbs >= 0.025 &&
        activeFrameRatio >= 0.08) ||
      (overallRms >= 0.005 &&
        peakAbs >= 0.018 &&
        activeFrameRatio >= 0.18));

  return {
    durationSec,
    overallRms,
    peakAbs,
    activeFrames,
    totalFrames,
    activeFrameRatio,
    likelyHasSpeech,
  };
}

function pcm16ToWav(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const dataLen = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);
  return Buffer.concat([header, pcm]);
}
