import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));

function request(
  child: ReturnType<typeof spawn>,
  method: string,
  params: Record<string, unknown>,
  id: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: child.stdout! });
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 8_000);
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
          method?: string;
        };
        if (msg.method) return;
        if (msg.id !== id) return;
        clearTimeout(timer);
        rl.close();
        if (msg.error) reject(new Error(msg.error.message || 'rpc error'));
        else resolve(msg.result);
      } catch {
        /* ignore non-json */
      }
    });
    child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

test('ACP shim maps prompt to fake cursor-agent and resumes with chat id', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'cursor-acp-shim-'));
  const fakeBin = path.join(tmp, 'fake-cursor-agent.mjs');
  await writeFile(
    fakeBin,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const resumeAt = args.indexOf('--resume');
const sessionId = resumeAt >= 0 ? args[resumeAt + 1] : 'chat-generated';
const prompt = args[args.indexOf('-p') + 1] || '';
writeFileSync(new URL('./invocations.log', import.meta.url), JSON.stringify({ args, prompt }) + '\\n', { flag: 'a' });
if (args[0] === 'status') process.exit(0);
console.log(JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId }));
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'pong:' + prompt.slice(0, 12) }] } }));
console.log(JSON.stringify({ type: 'result', result: '{"status":"success","summary":"ok","artifacts":[]}', session_id: sessionId, is_error: false }));
`,
    'utf8',
  );
  const cwd = path.join(tmp, 'project');
  await mkdir(cwd, { recursive: true });
  const child = spawn(
    process.execPath,
    [path.join(here, '../node_modules/tsx/dist/cli.mjs'), path.join(here, 'index.ts')],
    {
    cwd,
    env: {
      ...process.env,
      CURSOR_AGENT_COMMAND: fakeBin,
      INITIAL_AGENT_MODE: 'read-only',
      CURSOR_ACP_SKIP_STATUS: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  try {
    await request(child, 'initialize', { protocolVersion: 1 }, 1);
    const created = (await request(child, 'session/new', { cwd, mcpServers: [] }, 2)) as {
      sessionId: string;
    };
    const first = (await request(
      child,
      'session/prompt',
      { sessionId: created.sessionId, prompt: [{ type: 'text', text: 'hello' }] },
      3,
    )) as { text?: string };
    assert.match(String(first.text || ''), /success|pong/);
    const second = (await request(
      child,
      'session/prompt',
      { sessionId: created.sessionId, prompt: [{ type: 'text', text: 'again' }] },
      4,
    )) as { text?: string };
    assert.ok(second);
  } finally {
    child.kill('SIGTERM');
  }
});
