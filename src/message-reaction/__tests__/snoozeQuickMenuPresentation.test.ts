import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SNOOZE_CUSTOM_OPTION_LABEL,
  SNOOZE_MANAGE_OPTION_LABEL,
  buildSnoozeQuickMenuReceipt,
  buildSnoozeQuickMenuOptionView,
  buildSnoozeQuickMenuOptions,
  escapeSnoozeMenuText,
  formatSnoozeQuickMenuExistingSnoozeLabel,
} from '../snoozeQuickMenuPresentation.js';
import { translateStaticText } from '../../i18n/staticTranslations.js';
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

test('builds English Snooze quick menu labels with English punctuation', () => {
  const options = buildSnoozeQuickMenuOptions(
    [
      {
        label: 'In 1 hour',
        icon: '⏰',
        getTime: () => new Date('2026-05-07T10:30:00+08:00'),
      },
    ],
    () => 'Today 10:30 AM',
    'en-US',
  );

  assert.deepEqual(options, [
    {
      index: 0,
      label: 'In 1 hour',
      icon: '⏰',
      timeLabel: 'Today 10:30 AM',
      ariaLabel: 'In 1 hour, Today 10:30 AM',
    },
  ]);
});

test('defines custom and management Snooze menu entries', () => {
  assert.equal(SNOOZE_CUSTOM_OPTION_LABEL, '自定义时间');
  assert.equal(SNOOZE_MANAGE_OPTION_LABEL, '管理稍后处理');
});

test('builds a Snooze quick menu receipt with writeback and recovery scope', () => {
  assert.deepEqual(buildSnoozeQuickMenuReceipt(), {
    title: '提醒路径',
    lines: [
      {
        label: '去向',
        value: '写入 Scheduled Messages 的 Snooze 队列',
      },
      {
        label: '回到消息',
        value: '到点由 Bot 推送，并在原消息显示稍后标注',
      },
      {
        label: '恢复',
        value: '选错可撤销，或从管理稍后处理改期',
      },
      {
        label: '时间口径',
        value: '预计时间会在悬停、聚焦和点击前刷新',
      },
    ],
    ariaLabel:
      '提醒路径；去向：写入 Scheduled Messages 的 Snooze 队列；回到消息：到点由 Bot 推送，并在原消息显示稍后标注；恢复：选错可撤销，或从管理稍后处理改期；时间口径：预计时间会在悬停、聚焦和点击前刷新',
  });
});

test('localizes the Snooze quick menu receipt for English UI', () => {
  const receipt = buildSnoozeQuickMenuReceipt(
    (value) => translateStaticText(value, 'en-US'),
    ': ',
  );

  assert.deepEqual(receipt, {
    title: 'Reminder path',
    lines: [
      {
        label: 'Queue',
        value: 'Creates or updates the Scheduled Messages Remind queue',
      },
      {
        label: 'Writeback',
        value:
          'Bot sends it when due, and the original message shows a Remind marker',
      },
      {
        label: 'Recovery',
        value: 'Undo a wrong pick, or reschedule from Manage Remind',
      },
      {
        label: 'Timing',
        value: 'Preview refreshes on hover, focus, and click',
      },
    ],
    ariaLabel:
      'Reminder path；Queue: Creates or updates the Scheduled Messages Remind queue；Writeback: Bot sends it when due, and the original message shows a Remind marker；Recovery: Undo a wrong pick, or reschedule from Manage Remind；Timing: Preview refreshes on hover, focus, and click',
  });
});

test('builds a Snooze quick menu receipt for rescheduling an existing marker', () => {
  assert.deepEqual(
    buildSnoozeQuickMenuReceipt(undefined, '：', {
      existingSnooze: { label: '稍后 5/18 09:00' },
    }),
    {
      title: '提醒路径',
      lines: [
        {
          label: '当前',
          value: '已在本地标注为 稍后 5/18 09:00',
        },
        {
          label: '本次点击',
          value: '会改期这条同源 Snooze，不新增第二条',
        },
        {
          label: '恢复',
          value: '选错可从成功 Toast 或管理稍后处理确认',
        },
        {
          label: '缓存口径',
          value:
            '来自本地 marker 快照；以 Scheduled Messages 管理页和后台同步为准',
        },
      ],
      ariaLabel:
        '提醒路径；当前：已在本地标注为 稍后 5/18 09:00；本次点击：会改期这条同源 Snooze，不新增第二条；恢复：选错可从成功 Toast 或管理稍后处理确认；缓存口径：来自本地 marker 快照；以 Scheduled Messages 管理页和后台同步为准',
    },
  );
});

test('localizes the existing Snooze receipt boundary for English UI', () => {
  const receipt = buildSnoozeQuickMenuReceipt(
    (value) => translateStaticText(value, 'en-US'),
    ': ',
    {
      existingSnooze: {
        label: formatSnoozeQuickMenuExistingSnoozeLabel(
          '稍后 5/18 09:00',
          'en-US',
        ),
      },
    },
  );

  assert.deepEqual(receipt, {
    title: 'Reminder path',
    lines: [
      {
        label: 'Current',
        value: 'Already marked locally as Remind 5/18 09:00',
      },
      {
        label: 'This pick',
        value:
          'Reschedules this same-source Remind item instead of adding another one',
      },
      {
        label: 'Recovery',
        value: 'Use the success toast or Manage Remind to confirm a wrong pick',
      },
      {
        label: 'Cache basis',
        value:
          'Based on the local marker snapshot; Scheduled Messages and background sync remain authoritative',
      },
    ],
    ariaLabel:
      'Reminder path；Current: Already marked locally as Remind 5/18 09:00；This pick: Reschedules this same-source Remind item instead of adding another one；Recovery: Use the success toast or Manage Remind to confirm a wrong pick；Cache basis: Based on the local marker snapshot; Scheduled Messages and background sync remain authoritative',
  });
});

test('formats stored Snooze marker labels for the active quick-menu language', () => {
  assert.equal(
    formatSnoozeQuickMenuExistingSnoozeLabel('稍后 5/18 09:00', 'en-US'),
    'Remind 5/18 09:00',
  );
  assert.equal(
    formatSnoozeQuickMenuExistingSnoozeLabel('稍后处理', 'en-US'),
    'Remind',
  );
  assert.equal(
    formatSnoozeQuickMenuExistingSnoozeLabel('稍后 5/18 09:00', 'zh-CN'),
    '稍后 5/18 09:00',
  );
  assert.equal(
    formatSnoozeQuickMenuExistingSnoozeLabel('Remind 5/18 9:00 AM', 'en-US'),
    'Remind 5/18 9:00 AM',
  );
});

test('builds a Snooze option view from the current computed reminder time', () => {
  const view = buildSnoozeQuickMenuOptionView(
    {
      label: 'In 15 minutes',
      icon: '⏱️',
      getTime: () => new Date('2026-05-07T10:15:00+08:00'),
    },
    2,
    () => 'Today 10:20 AM',
    'en-US',
    new Date('2026-05-07T10:20:00+08:00'),
  );

  assert.deepEqual(view, {
    index: 2,
    label: 'In 15 minutes',
    icon: '⏱️',
    timeLabel: 'Today 10:20 AM',
    ariaLabel: 'In 15 minutes, Today 10:20 AM',
  });
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
      '15 分钟后',
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
    new Date('2026-05-08T19:15:00+08:00').toISOString(),
  );
  assert.equal(
    options[1].getTime().toISOString(),
    new Date('2026-05-08T19:30:00+08:00').toISOString(),
  );
  assert.equal(
    options[5].getTime().toISOString(),
    new Date('2026-05-11T18:00:00+08:00').toISOString(),
  );
  assert.equal(
    options[6].getTime().toISOString(),
    new Date('2026-05-11T09:00:00+08:00').toISOString(),
  );
});

test('English workday Snooze options use localized relative labels', () => {
  const thursday = new Date('2026-05-07T10:00:00+08:00');
  const options = getQuickOptions(() => new Date(thursday), 'en-US');

  assert.deepEqual(
    options.map((option) => option.label),
    [
      'In 15 minutes',
      'In 30 minutes',
      'In 1 hour',
      'In 2 hours',
      'In 3 hours',
      'Today by EOD',
      'Tomorrow 9 AM',
      'Next Mon 9 AM',
    ],
  );
});

test('Snooze options include next full hour when it differs from duration shortcuts', () => {
  const midHour = new Date('2026-05-07T10:10:00+08:00');
  const zhOptions = getQuickOptions(() => new Date(midHour));
  const enOptions = getQuickOptions(() => new Date(midHour), 'en-US');

  const zhNextFullHour = zhOptions.find(
    (option) => option.label === '下个整点',
  );
  const enNextFullHour = enOptions.find(
    (option) => option.label === 'Next full hour',
  );

  assert.ok(zhNextFullHour);
  assert.ok(enNextFullHour);
  assert.equal(
    zhNextFullHour.getTime().toISOString(),
    new Date('2026-05-07T11:00:00+08:00').toISOString(),
  );
  assert.equal(
    enNextFullHour.getTime().toISOString(),
    new Date('2026-05-07T11:00:00+08:00').toISOString(),
  );
});

test('workday Snooze options include next Monday only when it is not a duplicate', () => {
  const thursday = new Date('2026-05-07T10:00:00+08:00');
  const options = getQuickOptions(() => new Date(thursday));

  assert.deepEqual(
    options.map((option) => option.label),
    [
      '15 分钟后',
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
      '15 分钟后',
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
