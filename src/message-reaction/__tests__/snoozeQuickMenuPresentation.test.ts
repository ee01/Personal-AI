import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SNOOZE_CUSTOM_OPTION_LABEL,
  SNOOZE_MANAGE_OPTION_LABEL,
  buildSnoozeCustomOptionControlLabel,
  buildSnoozeManageOptionControlLabel,
  buildSnoozeQuickMenuReceipt,
  buildSnoozeQuickMenuOptionControlLabel,
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

test('builds the Snooze quick menu timing receipt for a new reminder pick', () => {
  assert.deepEqual(
    buildSnoozeQuickMenuReceipt(undefined, '：', {
      targetTimeLabel: '15 分钟后 (09:15)',
    }),
    {
      title: '提醒时间口径',
      lines: [
        {
          label: '本次点击',
          value: '会创建提醒到 15 分钟后 (09:15)',
          key: 'create-target',
        },
        {
          label: '写入边界',
          value:
            '点击具体时间后才写入 Scheduled Messages；不会发送消息、标记已读或完成原消息',
        },
        {
          label: '页面标注',
          value: '成功后原消息标注仍等后台同步；当前页面可能短暂仍显示旧快照',
        },
      ],
      ariaLabel:
        '提醒时间口径；本次点击：会创建提醒到 15 分钟后 (09:15)；写入边界：点击具体时间后才写入 Scheduled Messages；不会发送消息、标记已读或完成原消息；页面标注：成功后原消息标注仍等后台同步；当前页面可能短暂仍显示旧快照',
    },
  );
});

test('localizes the Snooze quick menu timing receipt for a new reminder pick', () => {
  const receipt = buildSnoozeQuickMenuReceipt(
    (value) => translateStaticText(value, 'en-US'),
    ': ',
    {
      targetTimeLabel: 'In 15 minutes (9:15 AM)',
    },
  );

  assert.deepEqual(receipt, {
    title: 'Reminder timing basis',
    lines: [
      {
        label: 'This pick',
        value: 'Will create a reminder for In 15 minutes (9:15 AM)',
        key: 'create-target',
      },
      {
        label: 'Write boundary',
        value:
          'Writes to Scheduled Messages only after you pick a time; does not send a message, mark read, or complete the original message',
      },
      {
        label: 'Message marker',
        value:
          'After success, the original message marker still waits for background sync; this page may briefly show the old snapshot',
      },
    ],
    ariaLabel:
      'Reminder timing basis；This pick: Will create a reminder for In 15 minutes (9:15 AM)；Write boundary: Writes to Scheduled Messages only after you pick a time; does not send a message, mark read, or complete the original message；Message marker: After success, the original message marker still waits for background sync; this page may briefly show the old snapshot',
  });
});

test('builds a Snooze quick menu receipt for rescheduling an existing marker', () => {
  assert.deepEqual(
    buildSnoozeQuickMenuReceipt(undefined, '：', {
      existingSnooze: { label: '稍后 5/18 09:00' },
      targetTimeLabel: '15 分钟后 (09:15)',
    }),
    {
      title: '改期预览',
      lines: [
        {
          label: '当前',
          value: '已在本地标注为 稍后 5/18 09:00',
        },
        {
          label: '本次点击',
          value: '会改到 15 分钟后 (09:15)；仍是同源 Snooze，不新增第二条',
          key: 'reschedule-target',
        },
        {
          label: '缓存口径',
          value:
            '来自本地 marker 快照，不是实时远端查询；以 Scheduled Messages 管理页和后台同步为准',
        },
      ],
      ariaLabel:
        '改期预览；当前：已在本地标注为 稍后 5/18 09:00；本次点击：会改到 15 分钟后 (09:15)；仍是同源 Snooze，不新增第二条；缓存口径：来自本地 marker 快照，不是实时远端查询；以 Scheduled Messages 管理页和后台同步为准',
    },
  );
});

test('builds stale and unrefreshed cache basis receipts for existing Snooze markers', () => {
  const staleReceipt = buildSnoozeQuickMenuReceipt(undefined, '：', {
    existingSnooze: { label: '稍后 5/18 09:00', cacheState: 'stale' },
    targetTimeLabel: '15 分钟后 (09:15)',
  });
  assert.ok(staleReceipt);

  assert.equal(
    staleReceipt.lines.find((line) => line.label === '缓存口径')?.value,
    '来自本地 marker 快照，可能过旧；刷新会话或等待后台同步后再确认',
  );
  assert.match(staleReceipt.ariaLabel, /可能过旧/);

  const unrefreshedReceipt = buildSnoozeQuickMenuReceipt(undefined, '：', {
    existingSnooze: { label: '稍后 5/18 09:00', cacheState: 'unrefreshed' },
    targetTimeLabel: '15 分钟后 (09:15)',
  });
  assert.ok(unrefreshedReceipt);

  assert.equal(
    unrefreshedReceipt.lines.find((line) => line.label === '缓存口径')?.value,
    '来自本地 marker 快照，尚未刷新远端状态；以 Scheduled Messages 管理页和后台同步为准',
  );
  assert.match(unrefreshedReceipt.ariaLabel, /尚未刷新远端状态/);
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
      targetTimeLabel: 'In 15 minutes (9:15 AM)',
    },
  );

  assert.deepEqual(receipt, {
    title: 'Reschedule preview',
    lines: [
      {
        label: 'Current',
        value: 'Already marked locally as Remind 5/18 09:00',
      },
      {
        label: 'This pick',
        value:
          'Will reschedule to In 15 minutes (9:15 AM); same-source Remind; no second reminder is added',
        key: 'reschedule-target',
      },
      {
        label: 'Cache basis',
        value:
          'Based on the local marker snapshot, not a live remote status check; Scheduled Messages and background sync remain authoritative',
      },
    ],
    ariaLabel:
      'Reschedule preview；Current: Already marked locally as Remind 5/18 09:00；This pick: Will reschedule to In 15 minutes (9:15 AM); same-source Remind; no second reminder is added；Cache basis: Based on the local marker snapshot, not a live remote status check; Scheduled Messages and background sync remain authoritative',
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

test('builds control-level Snooze quick option boundary labels', () => {
  const option = buildSnoozeQuickMenuOptionView(
    {
      label: '2 小时后',
      icon: '⏳',
      getTime: () => new Date('2026-05-07T11:00:00+08:00'),
    },
    3,
    () => '今天 11:00',
  );
  const receipt = buildSnoozeQuickMenuReceipt(undefined, '：', {
    targetTimeLabel: option.timeLabel,
  });

  assert.equal(
    buildSnoozeQuickMenuOptionControlLabel(option, receipt),
    '2 小时后，今天 11:00；提醒时间口径；本次点击：会创建提醒到 今天 11:00；写入边界：点击具体时间后才写入 Scheduled Messages；不会发送消息、标记已读或完成原消息；页面标注：成功后原消息标注仍等后台同步；当前页面可能短暂仍显示旧快照',
  );
});

test('builds localized control-level labels for custom and manage Snooze entries', () => {
  assert.equal(
    buildSnoozeCustomOptionControlLabel(),
    '自定义时间：打开自定义时间选择器；不会写入 Scheduled Messages，只有确认未来时间后才创建或改期 Snooze；不会发送消息、标记已读或完成原消息',
  );
  assert.equal(
    buildSnoozeManageOptionControlLabel(),
    '管理稍后处理：只打开 Scheduled Messages 的 Snooze 视图；不会创建、改期、完成或删除提醒，不会发送消息或写记忆',
  );

  const translate = (value: string) => translateStaticText(value, 'en-US');
  assert.equal(
    buildSnoozeCustomOptionControlLabel(translate, ': '),
    'Custom time: Opens the custom reminder time picker; only confirming a future time creates or reschedules Remind in Scheduled Messages, and this does not send a message, mark read, or complete the original message',
  );
  assert.equal(
    buildSnoozeManageOptionControlLabel(translate, ': '),
    'Manage Remind: Only opens the Scheduled Messages Remind view; it does not create, reschedule, complete, or delete reminders, send a message, or write memory',
  );
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
