import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  applyNotifyTemplateLocally,
  extractNotificationEvidence,
  formatSuccessNotificationWithTemplate,
  templateRequestsLinks,
} from '../core/agentTaskNotification.js';

describe('formatSuccessNotificationWithTemplate', () => {
  const generateMock = vi.fn();

  beforeEach(() => {
    generateMock.mockReset();
  });

  const template = `-- Nova 缺少 Team 的 Epics --
----

* [Nova-xxx](http://xxx) summary @INIT.assginee
* ...

以上 Epic 麻烦各位 leads 来看看添加上对应的 Team`;

  const result = {
    status: 'success',
    summary:
      '数据已全部齐备并回读验证：11 张 Epic 均缺少 Team。\n\n{"status":"success","summary":"JQL 命中 11 张","artifacts":[{"kind":"note","content":"* NOVA-7248 Debug @Tony Lin"}]}',
    artifacts: [
      {
        kind: 'jira_issue',
        title: 'NOVA-7248',
        content:
          '{"status":"success","summary":"JQL 命中 11 张 Nova 缺少 Team 的 Epic","artifacts":[{"kind":"note","title":"list","content":"* NOVA-7248 NOVA Debug/Analysis Enhancement @Tony Lin\\n* NOVA-11419 HA - Graceful ShutDown @Kingle Zhuang"}]}',
      },
    ],
  };

  const baseInput = {
    template,
    title: 'Nova 缺少 Team 的 Epics',
    task: '查找缺少 Team 的 Epic',
    defaultBody: 'Nova 缺少 Team 的 Epics\n数据已全部齐备',
    result,
    userDataManager: {},
    userId: 'esone.qiu',
    taskId: 'agent_task_1',
    actionId: 'action-1',
    generate: generateMock,
  };

  it('asks the LLM to emit markdown links when the template has a link pattern', async () => {
    generateMock.mockResolvedValue({
      content:
        '-- Nova 缺少 Team 的 Epics --\n----\n\n* [NOVA-7248](https://jira.example.com/browse/NOVA-7248) Debug @Tony Lin\n\n以上 Epic 麻烦各位 leads 来看看添加上对应的 Team',
    });
    const log = { warn: vi.fn() };

    await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    const prompt = String(generateMock.mock.calls[0][0]);
    expect(prompt).toMatch(/带可点击链接/);
    expect(prompt).toMatch(/不要把标识写成纯文本/);
  });

  it('keeps markdown links when the LLM follows the template', async () => {
    generateMock.mockResolvedValue({
      content:
        '-- Nova 缺少 Team 的 Epics --\n----\n\n* [NOVA-7248](https://jira.example.com/browse/NOVA-7248) Debug @Tony Lin\n\n以上 Epic 麻烦各位 leads 来看看添加上对应的 Team',
    });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toContain(
      '* [NOVA-7248](https://jira.example.com/browse/NOVA-7248) Debug @Tony Lin',
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('does not invent browse URLs when the LLM omits markdown links', async () => {
    generateMock.mockResolvedValue({
      content:
        '-- Nova 缺少 Team 的 Epics --\n----\n\n* NOVA-7248 Debug @Tony Lin\n\n以上 Epic 麻烦各位 leads 来看看添加上对应的 Team',
    });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toContain('* NOVA-7248 Debug @Tony Lin');
    expect(body).not.toContain('jira.ringcentral.com');
  });

  it('extracts summary when the LLM still returns a JSON envelope', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        status: 'success',
        summary:
          '-- Nova 缺少 Team 的 Epics --\n----\n\n* [NOVA-7248](https://jira.example.com/browse/NOVA-7248) Debug @Tony Lin\n\n以上 Epic 麻烦各位 leads',
      }),
    });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toContain(
      '* [NOVA-7248](https://jira.example.com/browse/NOVA-7248) Debug @Tony Lin',
    );
    expect(body).not.toContain('"status"');
  });

  it('falls back to a local template fill when the LLM throws', async () => {
    generateMock.mockRejectedValue(new Error('llm timeout'));
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toContain('-- Nova 缺少 Team 的 Epics --');
    expect(body).toContain('* NOVA-7248 NOVA Debug/Analysis Enhancement @Tony Lin');
    expect(body).toContain('* NOVA-11419 HA - Graceful ShutDown @Kingle Zhuang');
    expect(body).toContain('以上 Epic 麻烦各位 leads');
    expect(body).not.toContain('Nova-xxx');
    expect(body).not.toContain('jira.ringcentral.com');
    expect(log.warn.mock.calls[0][1]).toMatch(/threw/);
  });

  it('falls back to a local template fill when the LLM dumps raw JSON', async () => {
    generateMock.mockResolvedValue({
      content: JSON.stringify(result),
    });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toContain('* NOVA-7248 NOVA Debug/Analysis Enhancement @Tony Lin');
    expect(log.warn.mock.calls[0][1]).toMatch(/did not return a usable body/);
  });

  it('skips the LLM call entirely for a blank template', async () => {
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({
      ...baseInput,
      template: '   ',
      log,
    });

    expect(body).toBe(baseInput.defaultBody);
    expect(generateMock).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe('extractNotificationEvidence / applyNotifyTemplateLocally', () => {
  it('pulls the note list out of a JSON dump stuffed into jira_issue content', () => {
    const evidence = extractNotificationEvidence({
      summary:
        '数据已全部齐备并回读验证：11 张 Epic 均缺少 Team。\n\n{"status":"success","summary":"JQL 命中 11 张","artifacts":[]}',
      artifacts: [
        {
          kind: 'jira_issue',
          title: 'NOVA-7248',
          url: 'https://jira.example.com/browse/NOVA-7248',
          content:
            '{"status":"success","summary":"JQL 命中 11 张 Nova 缺少 Team 的 Epic","artifacts":[{"kind":"note","content":"* NOVA-7248 Debug @Tony Lin\\n* NOVA-11419 HA @Kingle Zhuang"}]}',
        },
      ],
    });

    expect(evidence.summary).toBe('JQL 命中 11 张 Nova 缺少 Team 的 Epic');
    expect(evidence.lines).toEqual([
      '* NOVA-7248 Debug @Tony Lin',
      '* NOVA-11419 HA @Kingle Zhuang',
    ]);
    expect(evidence.urls).toEqual(['https://jira.example.com/browse/NOVA-7248']);
  });

  it('collects url/assignee from structured jira_issue artifacts', () => {
    const evidence = extractNotificationEvidence({
      summary: 'JQL 命中 1 张',
      artifacts: [
        {
          kind: 'jira_issue',
          title: 'NOVA Debug/Analysis Enhancement',
          metadata: {
            sourceSystem: 'jira',
            entityKey: 'NOVA-7248',
            url: 'https://jira.example.com/browse/NOVA-7248',
            assignee: 'Tony Lin',
          },
        },
      ],
    });

    expect(evidence.lines).toEqual([
      '* NOVA-7248 NOVA Debug/Analysis Enhancement @Tony Lin',
    ]);
    expect(evidence.urls).toEqual(['https://jira.example.com/browse/NOVA-7248']);
  });

  it('replaces template placeholder bullets with evidence lines', () => {
    const body = applyNotifyTemplateLocally(
      `-- Nova 缺少 Team 的 Epics --
----

* [Nova-xxx](http://xxx) summary @INIT.assginee
* ...

以上 Epic 麻烦各位 leads 来看看添加上对应的 Team`,
      {
        summary: '11 张',
        lines: [
          '* NOVA-7248 Debug @Tony Lin',
          '* NOVA-11419 HA @Kingle Zhuang',
        ],
        urls: [],
      },
    );

    expect(body).toBe(`-- Nova 缺少 Team 的 Epics --
----

* NOVA-7248 Debug @Tony Lin
* NOVA-11419 HA @Kingle Zhuang

以上 Epic 麻烦各位 leads 来看看添加上对应的 Team`);
  });

  it('detects link intent from markdown or explicit wording', () => {
    expect(templateRequestsLinks('* [Nova-xxx](http://xxx) summary')).toBe(true);
    expect(templateRequestsLinks('请把每条结果做成可点击链接')).toBe(true);
    expect(templateRequestsLinks('Please include links for each item')).toBe(true);
    expect(templateRequestsLinks('* NOVA-xxx summary @owner')).toBe(false);
  });
});
