import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDanmakuCuePresentation,
  buildDanmakuTravelMetrics,
  formatDanmakuTimestamp,
  resolveDanmakuContextLabel,
  resolveDanmakuCueLine,
  resolveDanmakuDetail,
  resolveDanmakuTime,
  toDanmakuSentence,
} from '../danmakuPresentation.ts';
import { MeetingPilotMemoryRef } from '../protocol.ts';

function memoryRef(
  partial: Partial<MeetingPilotMemoryRef>,
): MeetingPilotMemoryRef {
  return {
    id: partial.id || 'memory-1',
    title: partial.title || 'Memory title',
    snippet: partial.snippet || 'Snippet text',
    score: partial.score ?? 0.72,
    sourceLabel: partial.sourceLabel || 'glip',
    ...partial,
  };
}

test('cue line prefers the stored one-sentence gist and keeps a single sentence', () => {
  const ref = memoryRef({
    cueLine: '先确认 token 额度来源，再决定是否走正式申请。第二条补充说明不应出现。',
    cueBody: '第二条补充说明不应出现。',
    snippet: 'snippet should not win',
    title: 'title should not win',
  });

  assert.equal(
    resolveDanmakuCueLine(ref),
    '先确认 token 额度来源，再决定是否走正式申请。',
  );
});

test('cue line falls back to cueBody then snippet and clips long text', () => {
  assert.equal(
    resolveDanmakuCueLine(memoryRef({ cueBody: '回退到 cueBody 的一句话。' })),
    '回退到 cueBody 的一句话。',
  );

  const long = `${'长'.repeat(200)}`;
  const clipped = resolveDanmakuCueLine(memoryRef({ cueBody: long }));
  assert.equal(clipped.length, 121);
  assert.ok(clipped.endsWith('…'));
});

test('toDanmakuSentence only keeps the first sentence', () => {
  assert.equal(toDanmakuSentence('第一句。第二句。'), '第一句。');
  assert.equal(toDanmakuSentence('没有标点的一句话'), '没有标点的一句话');
});

test('context label prefers relation label, then evidence role, then score', () => {
  assert.equal(
    resolveDanmakuContextLabel(memoryRef({ relationLabel: '同一项目' })),
    '同一项目',
  );
  assert.equal(
    resolveDanmakuContextLabel(memoryRef({ evidenceRoleLabel: '历史决策' })),
    '历史决策',
  );
  assert.equal(
    resolveDanmakuContextLabel(memoryRef({ score: 0.81 })),
    '关联 81%',
  );
});

test('expanded detail prefers the original memory text', () => {
  const ref = memoryRef({
    cueBody: 'summary text',
    fullSnippet: 'original full memory text',
    snippet: 'preview',
  });
  assert.equal(resolveDanmakuDetail(ref), 'original full memory text');
});

test('time prefers the real source time and labels it by memory type', () => {
  const ts = new Date(2026, 4, 12, 14, 3).getTime();
  const message = resolveDanmakuTime(
    memoryRef({ type: 'message', timestamp: ts, matchedAt: Date.now() }),
  );
  assert.equal(message?.label, '消息时间');
  assert.equal(message?.value, '2026-05-12 14:03');

  const chunk = resolveDanmakuTime(
    memoryRef({ type: 'chunk', timestamp: ts / 1000 }),
  );
  assert.equal(chunk?.label, '记录时间');
  assert.equal(chunk?.value, '2026-05-12 14:03');

  const sourceMemory = resolveDanmakuTime(
    memoryRef({ type: 'source_memory', timestamp: ts }),
  );
  assert.equal(sourceMemory?.label, '资料时间');
});

test('time falls back to recall time with an explicit label when the source time is missing', () => {
  const matchedAt = new Date(2026, 4, 12, 14, 10).getTime();
  const time = resolveDanmakuTime(memoryRef({ matchedAt }));
  assert.equal(time?.label, '记忆匹配于');
  assert.equal(time?.value, '2026-05-12 14:10');
  assert.equal(resolveDanmakuTime(memoryRef({})), undefined);
});

test('buildDanmakuCuePresentation composes the one line, detail, context label and time', () => {
  const ts = new Date(2026, 4, 12, 14, 3).getTime();
  const presentation = buildDanmakuCuePresentation(
    memoryRef({
      type: 'message',
      relationLabel: '同一项目',
      cueLine: '一句话摘要。',
      fullSnippet: '关联记忆原文。',
      title: '记忆标题',
      timestamp: ts,
    }),
  );

  assert.deepEqual(presentation, {
    oneLine: '一句话摘要。',
    detailTitle: '记忆标题',
    detail: '关联记忆原文。',
    contextLabel: '同一项目',
    timeLabel: '消息时间',
    timeValue: '2026-05-12 14:03',
  });
});

test('travel metrics use absolute pixels so hover cannot shift the paused pill', () => {
  assert.deepEqual(
    buildDanmakuTravelMetrics({ itemWidth: 300, viewportWidth: 1200 }),
    { startX: 348, endX: -1440 },
  );
  assert.deepEqual(
    buildDanmakuTravelMetrics({ itemWidth: Number.NaN, viewportWidth: 800 }),
    { startX: 48, endX: -1040 },
  );
});

test('formatDanmakuTimestamp pads month, day, hour and minute', () => {
  const ts = new Date(2026, 0, 2, 3, 4).getTime();
  assert.equal(formatDanmakuTimestamp(ts), '2026-01-02 03:04');
});
