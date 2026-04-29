import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeASRTranscriptText } from '../transcriptFilter.ts';

test('sanitizeASRTranscriptText drops pure non-speech artifacts', () => {
  assert.equal(sanitizeASRTranscriptText('[BLANK_AUDIO]'), '');
  assert.equal(sanitizeASRTranscriptText('[Music]'), '');
  assert.equal(sanitizeASRTranscriptText('(keyboard clicking)'), '');
  assert.equal(sanitizeASRTranscriptText('(keyboard clacking)'), '');
  assert.equal(sanitizeASRTranscriptText('(crickets chirping)'), '');
  assert.equal(sanitizeASRTranscriptText('[laughter]'), '');
  assert.equal(sanitizeASRTranscriptText('(speaking in foreign language)'), '');
  assert.equal(sanitizeASRTranscriptText('BLANK_AUDIO'), '');
});

test('sanitizeASRTranscriptText preserves speech while removing artifacts', () => {
  assert.equal(
    sanitizeASRTranscriptText(
      '[BLANK_AUDIO] You know, you know? Hello, can you hear me? [Music]',
    ),
    'You know, you know? Hello, can you hear me?',
  );
  assert.equal(
    sanitizeASRTranscriptText('继续测试一下。[空白音频]（键盘声）'),
    '继续测试一下。',
  );
});

test('sanitizeASRTranscriptText trims common subtitle hallucination tails', () => {
  assert.equal(
    sanitizeASRTranscriptText(
      '喂 哈囉 我們今天討論一下 Puzzle AI (CC字幕製作:貝爾) 謝謝觀看! 謝謝大家收看 下次再見',
    ),
    '喂 哈囉 我們今天討論一下 Puzzle AI',
  );
  assert.equal(
    sanitizeASRTranscriptText(
      '謝謝觀看! MING PAO CANADA | MING PAO TORONTO 謝謝收看 小明星大跟班下次再見',
    ),
    '',
  );
  assert.equal(sanitizeASRTranscriptText('(CC字幕製作:貝爾)'), '');
  assert.equal(sanitizeASRTranscriptText('字幕:J Chong'), '');
  assert.equal(sanitizeASRTranscriptText('字幕by索兰娅'), '');
  assert.equal(
    sanitizeASRTranscriptText('(好開心) 謝謝大家收看 謝謝大家收看'),
    '',
  );
  assert.equal(
    sanitizeASRTranscriptText(
      '拜拜~ 嗯? 你好 好像好 還以為你是說未成年那個位置還是處罰那位置 主板都沒有了 但路政界好像還都沒有 記者:很會上字在這裡寫上書 請留意 謝謝大家收看',
    ),
    '',
  );
});
