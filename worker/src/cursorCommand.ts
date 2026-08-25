import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function defaultCursorAcpCommand(): { command: string; args: string[] } {
  if (process.env.ACP_CURSOR_COMMAND) {
    return {
      command: process.env.ACP_CURSOR_COMMAND,
      args: process.env.ACP_CURSOR_ARGS
        ? process.env.ACP_CURSOR_ARGS.split(/\s+/).filter(Boolean)
        : [],
    };
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, 'vendor/cursor-acp/index.js'),
    path.resolve(here, '../vendor/cursor-acp/index.js'),
    path.resolve(here, '../../cursor-acp/dist/index.js'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate)) || candidates[0]!;
  return { command: process.execPath, args: [file] };
}

export function detectCursorAgentBinary(): string | undefined {
  const explicit = process.env.CURSOR_AGENT_COMMAND || process.env.CURSOR_AGENT_BIN;
  if (explicit?.trim() && existsSync(explicit.trim())) return explicit.trim();
  const names = ['cursor-agent', 'agent'];
  const dirs = [
    path.join(os.homedir(), '.local', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    ...(process.env.PATH || '').split(path.delimiter),
  ];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}
