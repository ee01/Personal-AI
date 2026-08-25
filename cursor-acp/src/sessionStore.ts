import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type CursorSessionRecord = {
  acpSessionId: string;
  cwd: string;
  cursorChatId?: string;
};

function storeDir(cwd: string): string {
  const digest = createHash('sha1').update(path.resolve(cwd)).digest('hex').slice(0, 16);
  return path.join(os.tmpdir(), 'personal-ai-cursor-acp', digest);
}

function storePath(cwd: string): string {
  return path.join(storeDir(cwd), 'sessions.json');
}

export async function loadSessionMap(cwd: string): Promise<Map<string, CursorSessionRecord>> {
  const map = new Map<string, CursorSessionRecord>();
  try {
    const raw = await readFile(storePath(cwd), 'utf8');
    const parsed = JSON.parse(raw) as { sessions?: CursorSessionRecord[] };
    for (const record of parsed.sessions || []) {
      if (record?.acpSessionId) map.set(record.acpSessionId, record);
    }
  } catch {
    /* first run */
  }
  return map;
}

export async function saveSessionMap(
  cwd: string,
  records: Iterable<CursorSessionRecord>,
): Promise<void> {
  await mkdir(storeDir(cwd), { recursive: true });
  await writeFile(
    storePath(cwd),
    JSON.stringify({ sessions: [...records] }, null, 2),
    'utf8',
  );
}
