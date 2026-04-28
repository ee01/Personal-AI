import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

function findWhisperBinary(): string | undefined {
  const candidates = [
    join(process.cwd(), 'node_modules', '.bin', 'whisper'),
    '/usr/local/bin/whisper',
    '/opt/homebrew/bin/whisper',
  ];
  for (const c of candidates) {
    try {
      require('node:fs').accessSync(c, require('node:fs').constants.X_OK);
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
}

export function isWhisperLoaded(): boolean {
  return loadedModelPath !== undefined;
}

export async function transcribeWithWhisper(
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

  const tmpWav = join(tmpdir(), `whisper-${Date.now()}.wav`);
  try {
    const wavBuffer = pcm16ToWav(pcm16, 16000, 1);
    await writeFile(tmpWav, wavBuffer);

    if (whisperBinary) {
      const args = [
        '--model',
        loadedModelPath,
        '--output-json',
        '--no-prints',
        tmpWav,
      ];
      if (opts?.language) args.push('--language', opts.language);
      if (opts?.translate) args.push('--translate');

      const { stdout } = await execFileAsync(whisperBinary, args, {
        timeout: 60000,
      });

      try {
        const parsed = JSON.parse(stdout) as ParsedWhisperJson;
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
        return { text, segments };
      } catch {
        const text = stdout.trim();
        return { text, segments: [{ start: 0, end: 0, text }] };
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
    await unlink(tmpWav).catch(() => undefined);
  }
}

export async function unloadWhisperModel(): Promise<void> {
  loadedModelPath = undefined;
  whisperBinary = undefined;
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
