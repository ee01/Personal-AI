import { describe, expect, it } from 'vitest';

import { detectAutomationActionFamily } from '../core/actions/detectAutomationActionFamily.js';

describe('detectAutomationActionFamily', () => {
  it('detects leave + glip status prompts', () => {
    expect(
      detectAutomationActionFamily(
        '从消息提取请假日期，请假前 3 小时修改 Glip 状态为 PTO，结束后改回 Available。',
      ),
    ).toBe('leave_glip_status');
  });

  it('detects the linked-action sample guardrail families', () => {
    expect(
      detectAutomationActionFamily(
        '把当前消息整理后转发给对应同事，并附上原消息链接。',
      ),
    ).toBe('forward_message');
    expect(
      detectAutomationActionFamily(
        '识别 Jira ticket 编号并给对应工单追加 comment。',
      ),
    ).toBe('jira_comment');
    expect(
      detectAutomationActionFamily(
        '提取字段并写入 Google Sheets 表格的新一行。',
      ),
    ).toBe('spreadsheet_write');
    expect(
      detectAutomationActionFamily('根据消息内容更新我的 Glip status。'),
    ).toBe('glip_status');
    expect(
      detectAutomationActionFamily('根据消息里的时间创建一个提醒和日程。'),
    ).toBe('schedule_reminder');
  });

  it('falls back to unknown for unclassified prompts', () => {
    expect(detectAutomationActionFamily('命中后做一些复杂事情。')).toBe(
      'unknown',
    );
  });
});
