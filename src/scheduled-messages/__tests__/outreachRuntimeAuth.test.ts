import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('loadOutreachRuntime reads GET /config through MemoryServiceClient device-key auth', () => {
  const source = readFileSync(
    'src/scheduled-messages/ScheduledMessagesManager.tsx',
    'utf8',
  );
  const start = source.indexOf('const loadOutreachRuntime = async () => {');
  assert.ok(start >= 0, 'loadOutreachRuntime should exist');
  const end = source.indexOf(
    'useEffect(() => {\n    if (showAddDialog)',
    start,
  );
  assert.ok(end > start, 'loadOutreachRuntime should end before the add-dialog effect');
  const fn = source.slice(start, end);

  assert.match(
    fn,
    /getMemoryServiceClient\(\{[\s\S]*baseUrl: runtimeBaseUrl/,
    'must pass the Options Memory Service URL into the shared client',
  );
  assert.match(
    fn,
    /client\.getRuntimeConfig\(\)/,
    'must use getRuntimeConfig() so request() attaches the issued pak',
  );
  assert.match(
    fn,
    /userinfo\?\.userEmail/,
    'must read userEmail, not only username/email, when filling identity',
  );
  assert.match(
    fn,
    /client\.getUserId\(\) === 'default'/,
    'must not overwrite a storage-resolved userId (that misses the stored pak)',
  );
  assert.equal(
    /if \(runtimeUserId\) \{\s*client\.setUserId\(runtimeUserId\);\s*\}/.test(fn),
    false,
    'must not unconditionally setUserId before GET /config',
  );
});
