import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceSource = readFileSync(resolve(__dirname, '../ScheduledMessageService.ts'), 'utf8');

test('ScheduledMessageService updateMessage refreshes live headers before full-row writes', () => {
  const updateMessageStart = serviceSource.indexOf('async updateMessage(');
  const updateMessageEnd = serviceSource.indexOf('  /**\n   * 删除消息', updateMessageStart);
  const updateMessageSource = serviceSource.slice(updateMessageStart, updateMessageEnd);

  const liveHeaderIndex = updateMessageSource.indexOf(
    'const liveHeaders = await this.getHeaders({ forceRefresh: true });',
  );
  const rowIndex = updateMessageSource.indexOf(
    'const row = await this.messageToRow(updatedMessage, liveHeaders);',
  );
  const updateRowIndex = updateMessageSource.indexOf(
    'await this.updateRow(index + 2, row, liveHeaders);',
  );

  assert.ok(updateMessageStart >= 0, 'updateMessage should exist');
  assert.ok(liveHeaderIndex >= 0, 'updateMessage should force-refresh live headers before writing');
  assert.ok(rowIndex > liveHeaderIndex, 'messageToRow should use the refreshed headers');
  assert.ok(updateRowIndex > rowIndex, 'updateRow should use the same refreshed headers');
  assert.doesNotMatch(
    updateMessageSource,
    /const row = await this\.messageToRow\(updatedMessage\);\s*await this\.updateRow\(index \+ 2, row\);/,
    'updateMessage must not fall back to stale cached headers for full-row writes',
  );
});

test('ScheduledMessageService createMessage also avoids stale header cache on append', () => {
  const createMessageStart = serviceSource.indexOf('async createMessage(');
  const createMessageEnd = serviceSource.indexOf('  /**\n   * 更新消息', createMessageStart);
  const createMessageSource = serviceSource.slice(createMessageStart, createMessageEnd);

  assert.ok(createMessageStart >= 0, 'createMessage should exist');
  assert.match(
    createMessageSource,
    /const liveHeaders = await this\.getHeaders\(\{ forceRefresh: true \}\);\s*const row = await this\.messageToRow\(message, liveHeaders\);/,
    'createMessage should append rows with live headers, not a stale header cache',
  );
});
