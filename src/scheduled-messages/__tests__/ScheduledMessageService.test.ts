import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGoogleSheetsInvalidCredentialError } from '../googleSheetsAuthErrors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceSource = readFileSync(resolve(__dirname, '../ScheduledMessageService.ts'), 'utf8');
const appScriptTemplateSource = readFileSync(
  resolve(__dirname, '../app-script-template.gs'),
  'utf8',
);

test('token refresh classification only accepts confirmed Google Sheets credential failures', () => {
  assert.equal(
    isGoogleSheetsInvalidCredentialError(
      new Error('读取 Sheet 失败 (401): Invalid Credentials'),
    ),
    true,
  );
  assert.equal(
    isGoogleSheetsInvalidCredentialError(
      new Error('Memory Service request failed (401): Unauthorized'),
    ),
    false,
    'An unrelated 401 must not evict the Google access token',
  );
  assert.equal(
    isGoogleSheetsInvalidCredentialError(
      new Error('Messages row contains reference 401 but the Sheet request timed out'),
    ),
    false,
    'A bare 401 substring is not credential proof',
  );
});

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
  assert.match(
    updateMessageSource,
    /const updatedMessage = mergeScheduledMessageUpdate\(previousMessage, updates\);/,
    'updateMessage must merge updates without letting undefined Automation_Link wipe the hosted rule URL',
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

test('recent push logs use the newest-first sheet contract and a bounded head range', () => {
  assert.match(
    appScriptTemplateSource,
    /logsSheet\.insertRowAfter\(1\);[\s\S]*logsSheet\.getRange\(2, 1, 1, logRow\.length\)/,
    'Apps Script should insert each new log immediately below the header',
  );
  assert.match(
    serviceSource,
    /const data = await sheet\.readRange\(`1:\$\{safeLimit \+ 1\}`\);/,
    'recent log refresh should request only the header and newest bounded rows',
  );
  assert.doesNotMatch(
    serviceSource.slice(
      serviceSource.indexOf('async getRecentPushLogs('),
      serviceSource.indexOf('/**\n   * 根据 ID 获取消息', serviceSource.indexOf('async getRecentPushLogs(')),
    ),
    /readSheet\(/,
    'recent log refresh must not download the complete Logs sheet',
  );
});
