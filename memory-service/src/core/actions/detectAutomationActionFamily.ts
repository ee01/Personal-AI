export type AutomationActionFamily =
  | 'leave_glip_status'
  | 'forward_message'
  | 'jira_comment'
  | 'spreadsheet_write'
  | 'glip_status'
  | 'schedule_reminder'
  | 'unknown';

function hasAnyKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

export function detectAutomationActionFamily(
  automationPrompt: string,
): AutomationActionFamily {
  const normalizedPrompt = automationPrompt.toLowerCase().trim();

  if (!normalizedPrompt) {
    return 'unknown';
  }

  const mentionsGlip = hasAnyKeyword(normalizedPrompt, [
    'glip',
    'status',
    '状态',
  ]);
  const mentionsLeave = hasAnyKeyword(normalizedPrompt, [
    'pto',
    '请假',
    'leave',
    '休假',
  ]);
  if (mentionsGlip && mentionsLeave) {
    return 'leave_glip_status';
  }

  if (hasAnyKeyword(normalizedPrompt, ['转发', 'forward', '同步给', '发给'])) {
    return 'forward_message';
  }

  if (
    hasAnyKeyword(normalizedPrompt, [
      'jira',
      'ticket',
      '工单',
      'comment',
      '评论',
    ])
  ) {
    return 'jira_comment';
  }

  if (
    hasAnyKeyword(normalizedPrompt, [
      'sheet',
      'spreadsheet',
      'google sheets',
      '表格',
      '写入表',
    ])
  ) {
    return 'spreadsheet_write';
  }

  if (mentionsGlip) {
    return 'glip_status';
  }

  if (
    hasAnyKeyword(normalizedPrompt, [
      '提醒',
      'remind',
      'schedule',
      'calendar',
      '日程',
      '会议',
    ])
  ) {
    return 'schedule_reminder';
  }

  return 'unknown';
}
