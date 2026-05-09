import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SNOOZE_CUSTOM_OPTION_LABEL,
  SNOOZE_MANAGE_OPTION_LABEL,
  buildSnoozeQuickMenuOptions,
  escapeSnoozeMenuText,
} from '../snoozeQuickMenuPresentation.js';
import {
  formatWorkdayQuickLabel,
  getDefaultCustomSnoozeTime,
  getNextWorkdayTime,
  getQuickOptions,
} from '../snoozeQuickOptions.js';

test('builds accessible Snooze quick menu labels with concrete times', () => {
  const options = buildSnoozeQuickMenuOptions(
    [
      {
        label: '1 小时后',
        icon: '⏰',
        getTime: () => new Date('2026-05-07T10:30:00+08:00'),
      },
    ],
    () => '今天 10:30',
  );

  assert.deepEqual(options, [
    {
      index: 0,
      label: '1 小时后',
      icon: '⏰',
      timeLabel: '今天 10:30',
      ariaLabel: '1 小时后，今天 10:30',
    },
  ]);
});

test('defines custom and management Snooze menu entries', () => {
  assert.equal(SNOOZE_CUSTOM_OPTION_LABEL, '自定义时间');
  assert.equal(SNOOZE_MANAGE_OPTION_LABEL, '管理稍后处理');
});

test('escapes Snooze menu text before injecting menu HTML', () => {
  assert.equal(
    escapeSnoozeMenuText('A&B <tag> "quote" \'single\''),
    'A&amp;B &lt;tag&gt; &quot;quote&quot; &#39;single&#39;',
  );
});

test('workday Snooze options skip weekends and past workday end', () => {
  const fridayAfterWork = new Date('2026-05-08T19:00:00+08:00');
  const options = getQuickOptions(() => new Date(fridayAfterWork));

  assert.deepEqual(
    options.map((option) => option.label),
    [
      '30 分钟后',
      '1 小时后',
      '2 小时后',
      '3 小时后',
      '周一 下班前',
      '周一 9 点',
    ],
  );
  assert.equal(
    options[0].getTime().toISOString(),
    new Date('2026-05-08T19:30:00+08:00').toISOString(),
  );
  assert.equal(
    options[4].getTime().toISOString(),
    new Date('2026-05-11T18:00:00+08:00').toISOString(),
  );
  assert.equal(
    options[5].getTime().toISOString(),
    new Date('2026-05-11T09:00:00+08:00').toISOString(),
  );
});

test('workday Snooze options include next Monday only when it is not a duplicate', () => {
  const thursday = new Date('2026-05-07T10:00:00+08:00');
  const options = getQuickOptions(() => new Date(thursday));

  assert.deepEqual(
    options.map((option) => option.label),
    [
      '30 分钟后',
      '1 小时后',
      '2 小时后',
      '3 小时后',
      '今天下班前',
      '明天 9 点',
      '下周一 9 点',
    ],
  );
});

test('workday Snooze options hide duplicate minute-equivalent choices', () => {
  const mondayAfternoon = new Date('2026-05-04T15:00:30+08:00');
  const options = getQuickOptions(() => new Date(mondayAfternoon));

  assert.deepEqual(
    options.map((option) => option.label),
    [
      '30 分钟后',
      '1 小时后',
      '2 小时后',
      '3 小时后',
      '明天 9 点',
      '下周一 9 点',
    ],
  );
});

test('workday Snooze labels use today and tomorrow when they are accurate', () => {
  const mondayMorning = new Date('2026-05-04T10:00:00+08:00');
  const endOfDay = getNextWorkdayTime(mondayMorning, 18, 0, true);
  const nextMorning = getNextWorkdayTime(mondayMorning, 9, 0, false);

  assert.equal(
    formatWorkdayQuickLabel(endOfDay, mondayMorning, '下班前'),
    '今天下班前',
  );
  assert.equal(
    formatWorkdayQuickLabel(nextMorning, mondayMorning, ' 9 点'),
    '明天 9 点',
  );
});

test('custom Snooze picker defaults to the nearest future workday morning', () => {
  assert.equal(
    getDefaultCustomSnoozeTime(
      new Date('2026-05-08T08:30:00+08:00'),
    ).toISOString(),
    new Date('2026-05-08T09:00:00+08:00').toISOString(),
  );
  assert.equal(
    getDefaultCustomSnoozeTime(
      new Date('2026-05-08T19:00:00+08:00'),
    ).toISOString(),
    new Date('2026-05-11T09:00:00+08:00').toISOString(),
  );
});
