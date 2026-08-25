import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BINARY_NAMES = ['cursor-agent', 'agent'];

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

export function resolveCursorAgentBinary(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  const fromArg = argValue('--cursor-command');
  if (fromArg?.trim()) return fromArg.trim();
  const fromEnv = process.env.CURSOR_AGENT_COMMAND || process.env.CURSOR_AGENT_BIN;
  if (fromEnv?.trim()) return fromEnv.trim();

  const home = os.homedir();
  const dirs = [
    path.join(home, '.local', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    ...(process.env.PATH || '').split(path.delimiter),
  ];
  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of BINARY_NAMES) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return 'cursor-agent';
}
