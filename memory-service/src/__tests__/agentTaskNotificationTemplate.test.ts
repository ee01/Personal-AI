import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  applyNotifyTemplateLocally,
  enforceTemplateScaffolding,
  extractNotificationEvidence,
  formatSuccessNotificationWithTemplate,
  isEmptyResultOutcome,
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

  it('restores the separator and closing line when the LLM drops them', async () => {
    generateMock.mockResolvedValue({
      content:
        '-- Nova 缺少 Team 的 Epics --\n\n* [NOVA-7248](https://jira.example.com/browse/NOVA-7248) Debug @Tony Lin\n\n以上 Epic 麻烦各位 leads',
    });
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({ ...baseInput, log });

    expect(body).toBe(`-- Nova 缺少 Team 的 Epics --
----

* [NOVA-7248](https://jira.example.com/browse/NOVA-7248) Debug @Tony Lin

以上 Epic 麻烦各位 leads 来看看添加上对应的 Team`);
  });

  it('keeps the template shape without calling the LLM when nothing matched', async () => {
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({
      ...baseInput,
      template: `-- Nova 缺少 Team 的 Epics --
----

* [Nova-xxx](https://jira.ringcentral.com/browse/{key}) summary
* ...

以上 Epic 自动填入 INIT 的 Team cc @sophia.lin`,
      task: '读取 Epic 的 parent link INIT，只有一个 Team 时回填',
      defaultBody: 'Nova 缺少 Team 的 Epics（自动填入 INIT）\n未更新任何 Epic',
      result: {
        status: 'success',
        summary:
          'JQL 命中 10 个 Team 为空的 Epic，所有 INIT 均为多团队（2-12 个），故未更新任何 Epic 的 Team 值。',
        artifacts: [
          {
            kind: 'query_result',
            title: 'Team 回填扫描结果：0 个 Epic 需更新',
            content: '扫描 10 个 Epic（NOVA-17664/17657/7248），所有 INIT Team 均>1，未做写入。',
            metadata: { sourceSystem: 'jira', matchCount: 0 },
          },
        ],
      },
      log,
    });

    expect(generateMock).not.toHaveBeenCalled();
    expect(body).toBe(`-- Nova 缺少 Team 的 Epics --
----

本次没有符合条件的条目：JQL 命中 10 个 Team 为空的 Epic，所有 INIT 均为多团队（2-12 个），故未更新任何 Epic 的 Team 值。

以上 Epic 自动填入 INIT 的 Team cc @sophia.lin`);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('treats a 0-match run as empty even when its diagnostic note carries INIT keys', async () => {
    const log = { warn: vi.fn() };

    const body = await formatSuccessNotificationWithTemplate({
      ...baseInput,
      template: `-- Nova 缺少 Team 的 Epics --
----

* [Nova-xxx](https://jira.ringcentral.com/browse/{key}) summary
* ...

以上 Epic 自动填入 INIT 的 Team cc @sophia.lin`,
      result: {
        status: 'success',
        summary: 'JQL 扫描到 8 个 Team 为空的 NOVA Epic；所有 INIT 的 Team 数量均不为 1，因此 0 个 Epic 被更新。',
        artifacts: [
          {
            kind: 'query_result',
            title: 'NOVA Epic Team 回填扫描',
            content: 'JQL 命中 8 个 Epic，0 个满足回填条件，未执行写入。',
            metadata: { sourceSystem: 'jira', matchCount: 0 },
          },
          {
            kind: 'note',
            title: '初始检查：INIT Team 均非唯一',
            content: 'INIT-28290(2): Nova Vox-Moutai；INIT-28986(3)；INIT-26177(2)。均不满足唯一条件。',
            metadata: {
              sourceSystem: 'jira',
              entityKey: 'INIT-28290,INIT-28986,INIT-26177',
            },
          },
        ],
        payload: { scannedEpics: ['NOVA-17657', 'NOVA-17391'], updatedEpics: [] },
      },
      log,
    });

    expect(generateMock).not.toHaveBeenCalled();
    expect(body).toContain('本次没有符合条件的条目：');
    expect(body).not.toContain('INIT-28290');
    expect(body).toContain('以上 Epic 自动填入 INIT 的 Team cc @sophia.lin');
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

  it('keeps the header, separator and closing line when there is no evidence line', () => {
    const body = applyNotifyTemplateLocally(
      `-- Nova 缺少 Team 的 Epics --
----

* [Nova-xxx](https://jira.ringcentral.com/browse/{key}) summary
* ...

以上 Epic 自动填入 INIT 的 Team cc @sophia.lin`,
      { summary: '10 个 Epic 的 INIT 都是多团队，未回填', lines: [], urls: [] },
    );

    expect(body).toBe(`-- Nova 缺少 Team 的 Epics --
----

本次没有符合条件的条目：10 个 Epic 的 INIT 都是多团队，未回填

以上 Epic 自动填入 INIT 的 Team cc @sophia.lin`);
  });

  it('does not duplicate the closing line when the model only echoed part of it', () => {
    const body = enforceTemplateScaffolding(
      `-- Nova 缺少 Team 的 Epics --
----

* [Nova-xxx](http://xxx) summary
* ...

以上 Epic 自动填入 INIT 的 Team cc @sophia.lin`,
      '-- Nova 缺少 Team 的 Epics --\n\n* NOVA-7248 Debug\n\ncc @sophia.lin',
    );

    expect(body).toBe(`-- Nova 缺少 Team 的 Epics --
----

* NOVA-7248 Debug

以上 Epic 自动填入 INIT 的 Team cc @sophia.lin`);
  });

  it('detects link intent from markdown or explicit wording', () => {
    expect(templateRequestsLinks('* [Nova-xxx](http://xxx) summary')).toBe(true);
    expect(templateRequestsLinks('请把每条结果做成可点击链接')).toBe(true);
    expect(templateRequestsLinks('Please include links for each item')).toBe(true);
    expect(templateRequestsLinks('* NOVA-xxx summary @owner')).toBe(false);
  });
});

describe('isEmptyResultOutcome', () => {
  it('lets an outcome counter override a wide scan count', () => {
    expect(
      isEmptyResultOutcome({
        artifacts: [{ kind: 'query_result', metadata: { matchCount: 10 } }],
        payload: { scannedEpics: ['NOVA-1'], epicsUpdated: 0 },
      }),
    ).toBe(true);
    expect(
      isEmptyResultOutcome({
        artifacts: [{ kind: 'query_result', metadata: { matchCount: 0 } }],
        payload: { updatedKeys: ['NOVA-1'] },
      }),
    ).toBe(false);
  });

  it('keeps a write run that produced per-item receipts', () => {
    expect(
      isEmptyResultOutcome({
        artifacts: [
          {
            kind: 'note',
            title: 'NOVA-17800',
            metadata: { entityKey: 'NOVA-17800', operation: 'update', changedFields: ['Committed'] },
          },
        ],
      }),
    ).toBe(false);
  });

  it('keeps a read scan that only reports how many rows it found', () => {
    expect(
      isEmptyResultOutcome({
        artifacts: [{ kind: 'query_result', metadata: { matchCount: 8 } }],
      }),
    ).toBe(false);
    expect(
      isEmptyResultOutcome({
        artifacts: [{ kind: 'query_result', metadata: { matchCount: 0 } }],
      }),
    ).toBe(true);
  });

  it('falls back to listable evidence when the run declares no counters', () => {
    expect(
      isEmptyResultOutcome({
        artifacts: [{ kind: 'jira_issue', title: 'NOVA-7248', metadata: { entityKey: 'NOVA-7248' } }],
      }),
    ).toBe(false);
    expect(isEmptyResultOutcome({ status: 'success', summary: '没有命中' })).toBe(true);
    expect(isEmptyResultOutcome(undefined)).toBe(true);
  });
});
