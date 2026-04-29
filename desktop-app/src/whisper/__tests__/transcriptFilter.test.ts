import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeWhisperTranscriptText } from '../transcriptFilter.js';

test('sanitizeWhisperTranscriptText drops subtitle hallucination artifacts', () => {
  assert.equal(sanitizeWhisperTranscriptText('(CC字幕製作:貝爾)'), '');
  assert.equal(sanitizeWhisperTranscriptText('(字幕製作:貝爾)'), '');
  assert.equal(sanitizeWhisperTranscriptText('字幕:J Chong'), '');
  assert.equal(sanitizeWhisperTranscriptText('字幕by索兰娅'), '');
  assert.equal(
    sanitizeWhisperTranscriptText('(好開心) 謝謝大家收看 謝謝大家收看'),
    '',
  );
});

test('sanitizeWhisperTranscriptText keeps short real prefix before subtitle tail', () => {
  assert.equal(
    sanitizeWhisperTranscriptText(
      '喂 哈囉 我們今天討論一下 Puzzle AI (CC字幕製作:貝爾) 謝謝觀看',
    ),
    '喂 哈囉 我們今天討論一下 Puzzle AI',
  );
});

test('sanitizeWhisperTranscriptText drops long fake prefix before subtitle tail', () => {
  assert.equal(
    sanitizeWhisperTranscriptText(
      '拜拜~ 嗯? 你好 好像好 還以為你是說未成年那個位置還是處罰那位置 主板都沒有了 但路政界好像還都沒有 記者:很會上字在這裡寫上書 請留意 謝謝大家收看',
    ),
    '',
  );
});
