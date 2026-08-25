import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export type CursorRunMode = 'read' | 'write';

export type CursorStreamHandlers = {
  onSessionId?: (sessionId: string) => void;
  onAssistantText?: (text: string) => void;
  onEvent?: (event: Record<string, unknown>) => void;
};

export type CursorRunResult = {
  text: string;
  sessionId?: string;
  isError: boolean;
  stderr: string;
  exitCode: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  if (!record) return '';
  if (typeof record.text === 'string') return record.text;
  if (typeof record.result === 'string') return record.result;
  if (Array.isArray(record.content)) {
    return record.content.map((part) => extractText(part)).join('');
  }
  if (record.message) return extractText(record.message);
  return '';
}

export function parseCursorStreamEvent(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

export function applyCursorStreamEvent(
  event: Record<string, unknown>,
  acc: { text: string; sessionId?: string },
  handlers: CursorStreamHandlers = {},
): { text: string; sessionId?: string; isError: boolean } {
  handlers.onEvent?.(event);
  const type = String(event.type || '');
  const sessionId =
    (typeof event.session_id === 'string' && event.session_id) ||
    (typeof event.sessionId === 'string' && event.sessionId) ||
    acc.sessionId;
  if (sessionId && sessionId !== acc.sessionId) {
    acc.sessionId = sessionId;
    (handlers.onSessionId || handlers.onSessionId)?.(sessionId);
  }
  if (type === 'assistant' || type === 'agent_message') {
    const chunk = extractText(event.message) || extractText(event);
    if (chunk) {
      acc.text += chunk;
      (handlers.onAssistantText || handlers.onAssistantText)?.(chunk);
    }
  }
  if (type === 'result') {
    const resultText = extractText(event.result) || extractText(event);
    if (resultText && !acc.text.includes(resultText)) {
      acc.text = resultText;
      (handlers.onAssistantText || handlers.onAssistantText)?.(resultText);
    }
  }
  return {
    text: acc.text,
    sessionId: acc.sessionId,
    isError:
      event.is_error === true ||
      event.is_error === true ||
      event.subtype === 'error',
  };
}

export function buildCursorAgentArgs(input: {
  prompt: string;
  resumeId?: string;
  mode: CursorRunMode;
}): string[] {
  const args = [
    '-p',
    input.prompt,
    '--output-format',
    'stream-json',
    '--trust',
    '--approve-mcps',
  ];
  if (input.resumeId) args.push('--resume', input.resumeId);
  if (input.mode === 'read') args.push('--mode', 'ask');
  return args;
}

export function runCursorAgent(input: {
  binary: string;
  cwd: string;
  prompt: string;
  resumeId?: string;
  mode: CursorRunMode;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  handlers?: CursorStreamHandlers;
}): Promise<CursorRunResult> {
  const args = buildCursorAgentArgs(input);
  const useNode = /\.(mjs|js|cjs|ts)$/.test(input.binary);
  const child = spawn(
    useNode ? process.execPath : input.binary,
    useNode ? [input.binary, ...args] : args,
    {
    cwd: input.cwd,
    env: { ...process.env, ...(input.env || {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const acc = { text: '', sessionId: input.resumeId };
  let isError = false;
  let stderr = '';
  const timeoutMs = input.timeoutMs ?? 600_000;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`cursor-agent timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const rl = createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const event = parseCursorStreamEvent(line);
      if (!event) return;
      const applied = applyCursorStreamEvent(event, acc, input.handlers);
      isError = isError || applied.isError;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const authFailed = /auth|login|unauthorized|401|403/i.test(stderr);
      const failed = isError || code !== 0 || authFailed;
      resolve({
        text: acc.text,
        sessionId: acc.sessionId,
        isError: failed,
        stderr,
        exitCode: code,
      });
    });
  });
}

export async function probeCursorAgent(
  binary: string,
  cwd: string,
  env?: NodeJS.ProcessEnv,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const useNode = /\.(mjs|js|cjs|ts)$/.test(binary);
    const child = spawn(
      useNode ? process.execPath : binary,
      useNode ? [binary, 'status'] : ['status'],
      {
      cwd,
      env: { ...process.env, ...(env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        reject(new Error(`cursor-agent not found (${binary})`));
        return;
      }
      reject(error);
    });
    child.on('close', (code) => {
      const text = `${stdout}\n${stderr}`;
      if (/not logged in|login required|unauthorized|401|403/i.test(text)) {
        reject(new Error(`cursor-agent login required: ${text.trim().slice(0, 300)}`));
        return;
      }
      if (code !== 0 && /ENOENT|not found/i.test(text)) {
        reject(new Error(`cursor-agent not found (${binary})`));
        return;
      }
      if (code !== 0 && /auth|login/i.test(text)) {
        reject(new Error(`cursor-agent login required: ${text.trim().slice(0, 300)}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`cursor-agent status failed: ${text.trim().slice(0, 300) || `exit ${code}`}`));
        return;
      }
      resolve();
    });
  });
}
