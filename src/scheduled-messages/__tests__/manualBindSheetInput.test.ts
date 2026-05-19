import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSheetUrl,
  extractSheetId,
  getManualBindSheetInputFeedback,
} from '../manualBindSheetInput.js';

const SHEET_ID = '1AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPp';

test('extractSheetId accepts common Google Sheet and Drive URL shapes', () => {
  assert.equal(
    extractSheetId(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=123`),
    SHEET_ID,
  );
  assert.equal(
    extractSheetId(`https://docs.google.com/spreadsheets/u/0/d/${SHEET_ID}/edit?usp=sharing`),
    SHEET_ID,
  );
  assert.equal(
    extractSheetId(`https://drive.google.com/open?id=${SHEET_ID}`),
    SHEET_ID,
  );
  assert.equal(
    extractSheetId(`https://drive.google.com/file/d/${SHEET_ID}/view`),
    SHEET_ID,
  );
  assert.equal(
    extractSheetId(`/spreadsheets/u/0/d/${SHEET_ID}/edit?usp=sharing`),
    SHEET_ID,
  );
  assert.equal(extractSheetId(` ${SHEET_ID} `), SHEET_ID);
});

test('extractSheetId rejects non-Google URLs that only look like Sheet links', () => {
  assert.equal(
    extractSheetId(`https://example.com/open?id=${SHEET_ID}`),
    null,
  );
  assert.equal(
    extractSheetId(`https://example.com/spreadsheets/d/${SHEET_ID}/edit`),
    null,
  );
  assert.equal(
    extractSheetId(`https://docs.google.com/document/d/${SHEET_ID}/edit`),
    null,
  );
});

test('manual bind feedback returns canonical Sheet URL or actionable error', () => {
  const validFeedback = getManualBindSheetInputFeedback(
    `https://docs.google.com/spreadsheets/u/0/d/${SHEET_ID}/edit`,
  );

  assert.equal(validFeedback.sheetId, SHEET_ID);
  assert.equal(validFeedback.canonicalSheetUrl, buildSheetUrl(SHEET_ID));
  assert.equal(validFeedback.error, '');

  const invalidFeedback = getManualBindSheetInputFeedback('https://example.com/not-a-sheet');
  assert.equal(invalidFeedback.sheetId, null);
  assert.equal(invalidFeedback.canonicalSheetUrl, null);
  assert.match(invalidFeedback.error, /Google Sheets 分享链接/);

  const emptyFeedback = getManualBindSheetInputFeedback('   ');
  assert.deepEqual(emptyFeedback, {
    sheetId: null,
    canonicalSheetUrl: null,
    error: '',
  });
});
