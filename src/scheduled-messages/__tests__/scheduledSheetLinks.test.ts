import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScheduledMessagesSheetTabUrl,
  getScheduledMessagesSheetTabId,
} from '../scheduledSheetLinks.js';

const config = {
  sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-id/edit',
  messagesSheetId: 101,
  logsSheetId: 102,
};

test('scheduled messages sheet link builder opens the Messages tab for editing', () => {
  assert.equal(
    buildScheduledMessagesSheetTabUrl(config, 'messages'),
    'https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=101',
  );
});

test('scheduled messages sheet link builder opens the Logs tab for records', () => {
  assert.equal(
    buildScheduledMessagesSheetTabUrl(config, 'logs'),
    'https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=102',
  );
});

test('scheduled messages sheet link builder strips stale query and gid fragments', () => {
  assert.equal(
    buildScheduledMessagesSheetTabUrl(
      {
        sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-id/edit?usp=sharing#gid=999',
        messagesSheetId: 101,
      },
      'messages',
    ),
    'https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=101',
  );
});

test('scheduled messages sheet link builder falls back to the spreadsheet when gid is unknown', () => {
  assert.equal(
    buildScheduledMessagesSheetTabUrl(
      {
        sheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-id/edit?usp=sharing#gid=999',
      },
      'logs',
    ),
    'https://docs.google.com/spreadsheets/d/sheet-id/edit',
  );
});

test('scheduled messages sheet tab id helper distinguishes Messages and Logs', () => {
  assert.equal(getScheduledMessagesSheetTabId(config, 'messages'), 101);
  assert.equal(getScheduledMessagesSheetTabId(config, 'logs'), 102);
});
