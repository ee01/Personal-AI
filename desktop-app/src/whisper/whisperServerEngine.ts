import { spawn, type ChildProcess } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getManagedWhisperServerBinaryPath } from './binaryManager.js';
import type { WhisperResult, WhisperSegment } from './whisperEngine.js';

interface WhisperServerJsonSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface WhisperServerJsonResponse {
  text?: string;
  segments?: WhisperServerJsonSegment[];
}

export interface WhisperServerState {
  available: boolean;
  running: boolean;
  binaryPath?: string;
  modelPath?: string;
  port?: number;
  url?: string;
  lastError?: string;
}

let serverProcess: ChildProcess | undefined;
let serverBinaryPath: string | undefined;
let serverModelPath: string | undefined;
let serverPort: number | undefined;
let startPromise: Promise<boolean> | undefined;
let lastError: string | undefined;

export function getWhisperServerBinaryPath(): string | undefined {
  return serverBinaryPath || findWhisperServerBinary();
}

export function getWhisperServerState(): WhisperServerState {
  const binaryPath = getWhisperServerBinaryPath();
  return {
    available: Boolean(binaryPath),
    running: Boolean(serverProcess && !serverProcess.killed && serverPort),
    binaryPath,
    modelPath: serverModelPath,
    port: serverPort,
    url: serverPort ? getServerBaseUrl(serverPort) : undefined,
    lastError,
  };
}

export async function ensureWhisperServer(
  modelPath: string,
): Promise<boolean> {
  const existing = getWhisperServerState();
  if (existing.running && serverModelPath === modelPath) return true;
  if (startPromise) return startPromise;

  startPromise = startWhisperServer(modelPath).finally(() => {
    startPromise = undefined;
  });
  return startPromise;
}

export async function stopWhisperServer(): Promise<void> {
  const proc = serverProcess;
  serverProcess = undefined;
  serverModelPath = undefined;
  serverPort = undefined;
  if (!proc || proc.killed) return;
  proc.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL');
      resolve();
    }, 1500);
    timer.unref?.();
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export async function transcribeWithWhisperServer(
  modelPath: string,
  pcm16: Buffer,
  opts?: { language?: string; translate?: boolean },
): Promise<WhisperResult> {
  const ready = await ensureWhisperServer(modelPath);
  if (!ready || !serverPort) {
    throw new Error(lastError || 'whisper server unavailable');
  }

  const tmpBase = join(
    tmpdir(),
    `whisper-server-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const tmpWav = `${tmpBase}.wav`;
  try {
    await writeFile(tmpWav, pcm16ToWav(pcm16, 16000, 1));
    const wavBuffer = await import('node:fs/promises').then(({ readFile }) =>
      readFile(tmpWav),
    );

    const form = new FormData();
    form.append(
      'file',
      new Blob([wavBuffer], { type: 'audio/wav' }),
      'chunk.wav',
    );
    form.append('temperature', '0.0');
    form.append('temperature_inc', '0.2');
    form.append('response_format', 'verbose_json');
    form.append('suppress_nst', 'true');
    if (opts?.language) form.append('language', opts.language);
    if (opts?.translate) form.append('translate', 'true');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`${getServerBaseUrl(serverPort)}/inference`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`whisper server HTTP ${response.status}`);
      }
      const parsed = (await response.json()) as WhisperServerJsonResponse;
      const segments = parseServerSegments(parsed);
      const text = String(
        parsed.text ||
          segments
            .map((segment) => segment.text)
            .join(' ')
            .trim(),
      ).trim();
      return { text, segments };
    } finally {
      clearTimeout(timer);
    }
  } finally {
    await unlink(tmpWav).catch(() => undefined);
  }
}

async function startWhisperServer(modelPath: string): Promise<boolean> {
  const binaryPath = findWhisperServerBinary();
  if (!binaryPath) {
    lastError = 'whisper_server_binary_missing';
    return false;
  }

  await stopWhisperServer();
  const port = await getFreePort();
  const args = [
    '--model',
    modelPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--inference-path',
    '/inference',
    '--language',
    'auto',
    '--suppress-nst',
  ];
  const proc = spawn(binaryPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess = proc;
  serverBinaryPath = binaryPath;
  serverModelPath = modelPath;
  serverPort = port;
  lastError = undefined;

  const logs: string[] = [];
  const captureLog = (chunk: Buffer) => {
    logs.push(chunk.toString('utf8').trim());
    if (logs.length > 20) logs.shift();
  };
  proc.stdout.on('data', captureLog);
  proc.stderr.on('data', captureLog);
  proc.once('exit', (code, signal) => {
    if (serverProcess === proc) {
      serverProcess = undefined;
      serverModelPath = undefined;
      serverPort = undefined;
      lastError = `whisper_server_exited:${code ?? signal ?? 'unknown'}`;
    }
  });

  const ready = await waitForServer(port, 30_000);
  if (ready) return true;

  lastError = logs.filter(Boolean).join('\n').slice(-2000) || 'server_timeout';
  await stopWhisperServer();
  return false;
}

function parseServerSegments(
  parsed: WhisperServerJsonResponse,
): WhisperSegment[] {
  if (!Array.isArray(parsed.segments)) return [];
  return parsed.segments.map((segment) => ({
    start: Number(segment.start || 0),
    end: Number(segment.end || 0),
    text: String(segment.text || '').trim(),
  }));
}

function findWhisperServerBinary(): string | undefined {
  const envPath =
    process.env.PERSONAL_AI_WHISPER_SERVER_BINARY?.trim() ||
    process.env.WHISPER_SERVER_BINARY?.trim();
  const candidates = [
    envPath,
    getManagedWhisperServerBinaryPath(),
    join(process.cwd(), 'node_modules', '.bin', 'whisper-server'),
    join(process.cwd(), 'node_modules', '.bin', 'whisper-cpp-server'),
    '/opt/homebrew/bin/whisper-server',
    '/opt/homebrew/bin/whisper-cpp-server',
    '/opt/homebrew/bin/whisper-whisper-server',
    '/usr/local/bin/whisper-server',
    '/usr/local/bin/whisper-cpp-server',
    '/usr/local/bin/whisper-whisper-server',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return undefined;
}

async function waitForServer(
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(getServerBaseUrl(port));
      if (response.ok) return true;
    } catch {
      // Keep polling until the server binds the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('failed_to_allocate_port')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

function getServerBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
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
