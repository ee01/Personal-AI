import { describe, expect, it } from 'vitest';

import {
  extractAgentResultJson,
  parseAgentResultEnvelope,
} from '../integrations/executors/agentResultEnvelope.js';
import {
  buildAgentResultSystemPrompt,
  buildAgentResultUserPrompt,
  detectTaskReceiptHints,
} from '../integrations/executors/agentResultPrompt.js';

const NOVA_MARKDOWN = `已按 Asia/Shanghai 当前季度 2026-Q3 检查并同步 Committed：

共更新 4 个：

- JIRA: NOVA-17023
- JIRA: NOVA-17011
- JIRA: NOVA-17002
- JIRA: NOVA-16986

全部已通过 Jira REST API 更新为 customfield_31650 = {"value":"Yes"}，更新后 JQL 复查结果为 0 个待更新。`;

describe('agentResultPrompt', () => {
  it('keeps user Task free of format instructions and infers Jira receipts', () => {
    const task = '帮我做: Nova Committed 的 INIT 同步 Epic Commit=Yes';
    const prompt = buildAgentResultSystemPrompt(
      { task, mode: 'write', targetSystem: 'agent_task' },
      { runtime: 'openclaw' },
    );
    const user = buildAgentResultUserPrompt({
      task,
      mode: 'write',
      threadId: 't1',
    });

    expect(prompt).toContain('用户的 Task 只描述要做什么');
    expect(prompt).toContain('Likely sourceSystem: jira');
    expect(prompt).not.toContain('Target system: agent_task');
    expect(user).toContain(task);
    expect(user).toContain('回报格式由系统规定');
    expect(detectTaskReceiptHints(task, 'agent_task').likelySourceSystem).toBe(
      'jira',
    );
  });
});

describe('parseAgentResultEnvelope', () => {
  it('does not treat incidental JSON like {"value":"Yes"} as the envelope', () => {
    expect(extractAgentResultJson(NOVA_MARKDOWN)).toBeNull();
    const parsed = parseAgentResultEnvelope(NOVA_MARKDOWN, {
      mode: 'write',
      targetSystem: 'agent_task',
      task: 'Nova Committed 同步 Epic Commit=Yes',
    });
    expect(parsed.status).toBe('succeeded');
    expect(parsed.payload?.recoveredFrom).toBe('markdown_receipt');
    expect(parsed.artifacts.map((item) => item.metadata?.entityKey)).toEqual([
      'NOVA-17023',
      'NOVA-17011',
      'NOVA-17002',
      'NOVA-16986',
    ]);
    expect(parsed.artifacts[0]?.metadata?.sourceSystem).toBe('jira');
    expect(parsed.artifacts[0]?.metadata?.verification).toMatch(/jql|rest_api/i);
  });

  it('still rejects a boast with no entity receipt', () => {
    const parsed = parseAgentResultEnvelope('任务已经做好了。', {
      mode: 'write',
      task: '随便做点事',
    });
    expect(parsed.status).toBe('error');
    expect(parsed.artifacts).toHaveLength(0);
  });

  it('accepts a JSON envelope inside markdown fences', () => {
    const parsed = parseAgentResultEnvelope(
      [
        '先看一眼。',
        '```json',
        JSON.stringify({
          status: 'success',
          summary: '已打开百度',
          artifacts: [
            {
              kind: 'browser_tab',
              content: 'https://www.baidu.com/',
              metadata: {
                sourceSystem: 'chrome',
                entityKey: 'https://www.baidu.com/',
                verification: 'page_url',
                observedFields: ['url'],
              },
            },
          ],
        }),
        '```',
      ].join('\n'),
    );
    expect(parsed.status).toBe('succeeded');
    expect(parsed.summary).toBe('已打开百度');
  });

  it('recovers a Jira read observation without a JSON envelope', () => {
    const parsed = parseAgentResultEnvelope(
      '**MTR-144628**：状态 **Cancelled**，负责人 **Esone Qiu**，更新时间 **2026-02-06 15:58**。工单已取消，无需处理。',
      { mode: 'read', targetSystem: 'jira' },
    );
    expect(parsed.status).toBe('succeeded');
    expect(parsed.artifacts[0]?.metadata?.entityKey).toBe('MTR-144628');
  });
});
