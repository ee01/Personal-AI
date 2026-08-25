import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  injectHttpMcpServers,
  mergeHttpMcpServers,
  restoreMcpFile,
} from './mcpMerge.js';
import {
  applyCursorStreamEvent,
  buildCursorAgentArgs,
  parseCursorStreamEvent,
} from './cursorAgent.js';

test('mergeHttpMcpServers namespaces HTTP servers and skips stdio', () => {
  const { next, warnings, addedKeys } = mergeHttpMcpServers(
    {
      mcpServers: {
        'personal-ai-memory': { url: 'http://existing' },
      },
    },
    [
      {
        name: 'memory',
        type: 'streamable-http',
        url: 'http://127.0.0.1:3210/mcp',
        headers: { Authorization: 'Bearer awk.test' },
      },
      { name: 'local-fs', command: 'npx', args: ['mcp-server-fs'] },
    ],
  );
  assert.deepEqual(addedKeys, []);
  assert.equal(warnings.length, 1);
  assert.equal(
    (next.mcpServers?.['personal-ai-memory'] as { url?: string }).url,
    'http://existing',
  );
  assert.equal(next.mcpServers?.['local-fs'], undefined);
});

test('injectHttpMcpServers restores original mcp.json after the task', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'cursor-acp-mcp-'));
  await mkdir(path.join(cwd, '.cursor'), { recursive: true });
  const original = { mcpServers: { other: { command: 'echo' } } };
  await writeFile(
    path.join(cwd, '.cursor', 'mcp.json'),
    JSON.stringify(original, null, 2),
    'utf8',
  );
  await injectHttpMcpServers(cwd, [
    { name: 'memory', type: 'http', url: 'http://127.0.0.1:3210/mcp' },
  ]);
  const injected = JSON.parse(
    await readFile(path.join(cwd, '.cursor', 'mcp.json'), 'utf8'),
  ) as { mcpServers: Record<string, unknown> };
  assert.ok(injected.mcpServers['personal-ai-memory']);
  await restoreMcpFile(cwd);
  const restored = JSON.parse(
    await readFile(path.join(cwd, '.cursor', 'mcp.json'), 'utf8'),
  );
  assert.deepEqual(restored, original);
});

test('stream-json result and assistant events accumulate text and session id', () => {
  const acc = { text: '', sessionId: undefined as string | undefined };
  applyCursorStreamEvent(
    parseCursorStreamEvent(
      '{"type":"system","subtype":"init","session_id":"chat-1"}',
    )!,
    acc,
  );
  applyCursorStreamEvent(
    parseCursorStreamEvent(
      '{"type":"assistant","message":{"content":[{"type":"text","text":"hello "}]}}',
    )!,
    acc,
  );
  const done = applyCursorStreamEvent(
    parseCursorStreamEvent(
      '{"type":"result","result":"hello world","session_id":"chat-1","is_error":false}',
    )!,
    acc,
  );
  assert.equal(done.sessionId, 'chat-1');
  assert.equal(done.text, 'hello world');
});

test('headless args stay non-interactive without --force', () => {
  const first = buildCursorAgentArgs({ prompt: 'look around', mode: 'write' });
  assert.ok(first.includes('-p'));
  assert.ok(first.includes('stream-json'));
  assert.ok(first.includes('--trust'));
  assert.ok(first.includes('--approve-mcps'));
  assert.ok(!first.includes('--force'));
  assert.ok(!first.includes('--resume'));
  const resume = buildCursorAgentArgs({
    prompt: 'continue',
    resumeId: 'chat-1',
    mode: 'read',
  });
  assert.deepEqual(
    [resume[resume.indexOf('--resume') + 1], resume[resume.indexOf('--mode') + 1]],
    ['chat-1', 'ask'],
  );
});
