import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sanitizeWhisperTranscriptText } from '../whisper/transcriptFilter.js';

interface SpeechHelperEvent {
  type?: string;
  text?: string;
  isFinal?: boolean;
  code?: string;
  message?: string;
  reason?: string;
}

interface PendingWaiter {
  resolve: (event: SpeechHelperEvent) => void;
  reject: (error: Error) => void;
  predicate: (event: SpeechHelperEvent) => boolean;
  timer: ReturnType<typeof setTimeout>;
}

export interface AppleSpeechAvailability {
  supported: boolean;
  ready: boolean;
  helperPath?: string;
  reason?: string;
}

export class AppleSpeechPcmSession {
  private child: ChildProcessWithoutNullStreams;
  private buffer = '';
  private waiters: PendingWaiter[] = [];
  private latestText = '';
  private lastReturnedPartial = '';
  private closed = false;

  private constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.consumeBuffer();
    });
    child.stderr.on('data', () => undefined);
    child.on('exit', () => {
      this.closed = true;
      this.rejectWaiters(new Error('apple_speech_helper_exited'));
    });
    child.on('error', (error) => {
      this.closed = true;
      this.rejectWaiters(error);
    });
  }

  static async create(locale: string | undefined): Promise<AppleSpeechPcmSession> {
    const helperPath = getSpeechHelperPath();
    if (!helperPath) {
      throw new Error('apple_speech_helper_missing');
    }
    const child = spawn(helperPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const session = new AppleSpeechPcmSession(child);
    await session.waitFor((event) => event.type === 'ready', 1500);
    session.send({
      command: 'pcm_start',
      locale: locale || 'en-US',
      localOnly: true,
      sampleRate: 16000,
    });
    const event = await session.waitFor(
      (item) => item.type === 'started' || item.type === 'error',
      2500,
    );
    if (event.type === 'error') {
      session.close();
      throw new Error(event.code || event.message || 'apple_speech_start_failed');
    }
    return session;
  }

  async acceptPcm16(pcm16: Buffer): Promise<{ partial?: string }> {
    if (this.closed || !pcm16.length) return {};
    this.send({
      command: 'pcm_chunk',
      pcmBase64: pcm16.toString('base64'),
      sampleRate: 16000,
    });
    await wait(90);
    const text = sanitizeWhisperTranscriptText(this.latestText);
    if (!text || text === this.lastReturnedPartial) return {};
    this.lastReturnedPartial = text;
    return { partial: text };
  }

  async finish(): Promise<string> {
    if (this.closed) return sanitizeWhisperTranscriptText(this.latestText);
    this.send({ command: 'pcm_end' });
    await this.waitFor(
      (event) => event.type === 'stopped' || event.type === 'error',
      1600,
    ).catch(() => undefined);
    const text = sanitizeWhisperTranscriptText(this.latestText);
    this.close();
    return text;
  }

  close(): void {
    if (this.closed) return;
    this.send({ command: 'shutdown' });
    this.closed = true;
    setTimeout(() => {
      if (!this.child.killed) this.child.kill('SIGTERM');
    }, 200).unref?.();
  }

  private send(payload: Record<string, unknown>): void {
    if (this.closed || !this.child.stdin.writable) return;
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private consumeBuffer(): void {
    while (true) {
      const newlineIndex = this.buffer.indexOf('\n');
      if (newlineIndex < 0) return;
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;
      let event: SpeechHelperEvent;
      try {
        event = JSON.parse(line) as SpeechHelperEvent;
      } catch {
        continue;
      }
      if (event.text) {
        this.latestText = event.text;
      }
      this.resolveWaiters(event);
    }
  }

  private waitFor(
    predicate: (event: SpeechHelperEvent) => boolean,
    timeoutMs: number,
  ): Promise<SpeechHelperEvent> {
    return new Promise((resolveWaiter, reject) => {
      const waiter: PendingWaiter = {
        resolve: resolveWaiter,
        reject,
        predicate,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((item) => item !== waiter);
          reject(new Error('apple_speech_helper_timeout'));
        }, timeoutMs),
      };
      waiter.timer.unref?.();
      this.waiters.push(waiter);
    });
  }

  private resolveWaiters(event: SpeechHelperEvent): void {
    for (const waiter of [...this.waiters]) {
      if (!waiter.predicate(event)) continue;
      clearTimeout(waiter.timer);
      this.waiters = this.waiters.filter((item) => item !== waiter);
      waiter.resolve(event);
    }
  }

  private rejectWaiters(error: Error): void {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters = [];
  }
}

export function getAppleSpeechAvailability(): AppleSpeechAvailability {
  if (process.platform !== 'darwin') {
    return { supported: false, ready: false, reason: 'platform_unsupported' };
  }
  const helperPath = getSpeechHelperPath();
  if (!helperPath) {
    return { supported: true, ready: false, reason: 'helper_missing' };
  }
  return { supported: true, ready: true, helperPath };
}

function getSpeechHelperPath(): string | undefined {
  const currentFile = fileURLToPath(import.meta.url);
  const desktopAppRoot = resolve(dirname(currentFile), '..', '..');
  const candidates = [
    join(desktopAppRoot, 'app', 'native', 'bin', 'desktop-app-speech-helper'),
    join(process.cwd(), 'app', 'native', 'bin', 'desktop-app-speech-helper'),
  ];
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

function wait(ms: number): Promise<void> {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms);
  });
}
