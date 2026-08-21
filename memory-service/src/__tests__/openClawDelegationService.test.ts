import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { OpenClawDelegationService } from '../integrations/OpenClawDelegationService.js';
import { UserDataManager } from '../storage/UserDataManager.js';

describe('OpenClawDelegationService', () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns capability_missing when user runtime config has no OpenClaw setup', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        // Master switch off must not be the only gate; empty baseUrl means unconfigured.
        openClawEnabled: false,
        openClawBaseUrl: '',
        openClawApiKey: '',
      }),
    );

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');

    try {
      const outcome = await service.delegate({
        actionId: 'action-1',
        threadId: 'thread-1',
        sessionKey: 'thread-1',
        task: '查询外部系统状态',
        mode: 'read',
      });

      expect(outcome.status).toBe('capability_missing');
      expect(outcome.summary).toContain('未配置');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('posts to the responses endpoint, parses the JSON envelope, and writes a transcript', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com/v1',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: 'Jira 查询成功，BE 已进入联调阶段。',
            artifacts: [
              {
                kind: 'external_evidence',
                title: 'Jira',
                content: 'ORB-123 in integration',
                metadata: {
                  sourceSystem: 'jira',
                  entityKey: 'ORB-123',
                  verification: 'jira_api',
                  observedFields: ['status'],
                  observedAt: '2026-03-18T10:00:00Z',
                },
              },
            ],
            payload: { jiraKey: 'ORB-123' },
          }),
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      runId: 'run-1',
      sessionKey: 'thread-1',
      task: '请查询 Orbit 的 Jira 状态',
      mode: 'read',
      targetSystem: 'jira',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openclaw.example.com/v1/responses');
    expect(requestInit.method).toBe('POST');
    expect((requestInit.headers as Record<string, string>)['x-openclaw-session-key']).toBe('thread-1');
    expect((requestInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-openclaw-key',
    );

    expect(outcome.status).toBe('success');
    expect(outcome.summary).toContain('联调阶段');
    expect(outcome.payload?.jiraKey).toBe('ORB-123');
    expect(outcome.transcriptPath).toMatch(/^delegations\/thread-1-action-1-\d+\.json$/);
    const transcriptAbsolutePath = path.join(tempDir, outcome.transcriptPath!);
    expect(fs.existsSync(transcriptAbsolutePath)).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('maps 401 responses to auth_error', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: { message: 'Unauthorized' } }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '请查询 Orbit 的 Jira 状态',
      mode: 'read',
      targetSystem: 'jira',
    });

    expect(outcome.status).toBe('auth_error');
    expect(outcome.summary).toContain('鉴权失败');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses a fenced JSON envelope even when OpenClaw adds extra prose first', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: [
                    '让我先检查当前环境。',
                    '```json',
                    JSON.stringify(
                      {
                        status: 'capability_missing',
                        summary: '当前环境中未配置 Jira 访问能力。',
                        artifacts: [],
                        payload: {},
                      },
                      null,
                      2,
                    ),
                    '```',
                  ].join('\n'),
                },
              ],
            },
          ],
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '请查询 Orbit 的 Jira 状态',
      mode: 'read',
      targetSystem: 'jira',
    });

    expect(outcome.status).toBe('capability_missing');
    expect(outcome.summary).toContain('未配置 Jira');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('recovers a Jira observation markdown as a verifiable artifact', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: '**MTR-144628**：状态 **Cancelled**，负责人 **Esone Qiu**，更新时间 **2026-02-06 15:58**。工单已取消，无需处理。',
                },
              ],
            },
          ],
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '请查询 MTR-144628 状态',
      mode: 'read',
      targetSystem: 'jira',
    });

    expect(outcome.status).toBe('success');
    expect(outcome.summary).toContain('Cancelled');
    expect(outcome.artifacts[0]?.metadata?.entityKey).toBe('MTR-144628');
    expect(outcome.payload?.recoveredFrom).toBe('markdown_receipt');
 
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('downgrades success to error when the artifact is not verifiable', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: '我已经检查过 Jira，标题已经正确。',
            artifacts: [
              {
                kind: 'note',
                title: '检查结果',
                content: '标题已经正确。',
                metadata: {
                  issueKey: 'MTR-144628',
                },
              },
            ],
            payload: { jiraKey: 'MTR-144628' },
          }),
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '请检查 MTR-144628 的标题',
      mode: 'read',
      targetSystem: 'jira',
    });

    expect(outcome.status).toBe('error');
    expect(outcome.summary).toContain('缺少可验证 artifact');
    expect(outcome.payload?.artifactValidation).toBe('missing_verifiable_artifact');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('accepts object-shaped observedFields as a verifiable artifact', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: '已打开目标页面。',
            artifacts: [
              {
                kind: 'browser_tab',
                title: '百度',
                content: 'https://www.baidu.com/',
                metadata: {
                  sourceSystem: 'chrome',
                  entityKey: 'tab-42',
                  verification: 'browser_navigation',
                  observedFields: { url: 'https://www.baidu.com/', tabId: 42 },
                },
              },
            ],
          }),
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-object-fields',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '打开百度',
      mode: 'read',
      targetSystem: 'chrome',
    });

    expect(outcome.status).toBe('success');
    expect(outcome.payload?.artifactValidation).not.toBe('missing_verifiable_artifact');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('synthesizes a verifiable artifact from structured delegation results when OpenClaw omits one', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 600000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: '已从外部日历中找到与 video 相关的行程。',
            artifacts: [],
            payload: {
              videoRelatedEvents: [
                {
                  date: '2026-04-09',
                  time: '09:30-10:30',
                  title: 'RCV project review',
                  relevant: true,
                },
                {
                  date: '2026-04-09',
                  time: '18:00-20:00',
                  title: 'Dinner with Video team',
                  relevant: true,
                },
              ],
            },
          }),
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '请确认 Gary 行程表中哪些日程与 video 项目相关。',
      mode: 'read',
      targetSystem: 'calendar',
      metadata: {
        candidateArtifacts: [
          {
            kind: 'link',
            title: "Gary's calendar",
            url: 'https://calendar.example.com/gary',
          },
        ],
      },
    });

    expect(outcome.status).toBe('success');
    expect(outcome.summary).toContain('video');
    expect(outcome.artifacts).toHaveLength(1);
    expect(outcome.artifacts[0].metadata?.sourceSystem).toBe('calendar');
    expect(outcome.artifacts[0].metadata?.entityKey).toBe('https://calendar.example.com/gary');
    expect(outcome.artifacts[0].metadata?.verification).toBe('delegated_structured_result');
    expect(outcome.artifacts[0].metadata?.observedFields).toEqual(
      expect.arrayContaining(['date', 'time', 'title', 'relevant']),
    );
    expect(outcome.artifacts[0].content).toContain('RCV project review');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('synthesizes a verifiable artifact from a single scalar AR result', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 600000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: '0',
            artifacts: [],
            payload: { total: 0 },
          }),
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '查找 JQL 数据并输出 issue 总数。',
      mode: 'read',
      targetSystem: 'personal_ai_ar',
      metadata: {
        candidateArtifacts: [
          {
            kind: 'ar_binding',
            title: 'AR 数据：0',
            entityKey: 'ar_123',
          },
        ],
      },
    });

    expect(outcome.status).toBe('success');
    expect(outcome.summary).toBe('0');
    expect(outcome.artifacts).toHaveLength(1);
    expect(outcome.artifacts[0].metadata?.sourceSystem).toBe('personal_ai_ar');
    expect(outcome.artifacts[0].metadata?.entityKey).toBe('ar_123');
    expect(outcome.artifacts[0].metadata?.observedFields).toEqual(
      expect.arrayContaining(['total']),
    );
    expect(outcome.artifacts[0].content).toContain('total=0');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('recovers an AR scalar payload when OpenClaw reports missing artifacts as error', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 600000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'error',
            summary: 'Cannot return success with an empty artifacts array.',
            artifacts: [],
            payload: {
              requested: {
                status: 'success',
                summary: '0',
                artifacts: [],
                payload: { total: 0 },
              },
            },
          }),
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '查找 JQL 数据并输出 issue 总数。',
      mode: 'read',
      targetSystem: 'personal_ai_ar',
      metadata: {
        candidateArtifacts: [
          {
            kind: 'ar_binding',
            title: 'AR 数据：0',
            entityKey: 'ar_123',
          },
        ],
      },
    });

    expect(outcome.status).toBe('success');
    expect(outcome.summary).toBe('0');
    expect(outcome.payload?.recoveredFrom).toBe('personal_ai_ar_scalar_payload');
    expect(outcome.artifacts[0].metadata?.observedFields).toEqual(
      expect.arrayContaining(['total']),
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('recovers Jira JQL count scalar payloads for AR bindings without changing the target system', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 600000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'error',
            summary: 'Cannot return success with an empty artifacts array.',
            artifacts: [],
            payload: { issueTotal: 0 },
          }),
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '使用 exact JQL 查询 Jira，并把 issue 总数填入 AR 数据。',
      mode: 'read',
      targetSystem: 'jira',
      metadata: {
        taskKind: 'jira_jql_count',
        executionHints: {
          exactJql: 'project = RCV AND issuetype = Epic',
          expectedOutput: 'single_number',
        },
        candidateArtifacts: [
          {
            kind: 'ar_binding',
            title: 'AR 数据：0',
            entityKey: 'ar_123',
            sourceSystem: 'jira',
          },
        ],
      },
    });

    expect(outcome.status).toBe('success');
    expect(outcome.summary).toBe('0');
    expect(outcome.payload?.recoveredFrom).toBe('personal_ai_ar_scalar_payload');
    expect(outcome.artifacts[0].metadata?.sourceSystem).toBe('jira');
    expect(outcome.artifacts[0].metadata?.entityKey).toBe('ar_123');
    expect(outcome.artifacts[0].metadata?.observedFields).toEqual(
      expect.arrayContaining(['issueTotal']),
    );
    expect(outcome.artifacts[0].content).toContain('issueTotal=0');

    const lastFetchCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const requestBody = JSON.parse(String((lastFetchCall?.[1] as RequestInit).body));
    expect(requestBody.input[0].content[0].text).toContain('Target system: jira');
    expect(requestBody.input[1].content[0].text).toContain('"taskKind":"jira_jql_count"');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('honors a shorter per-request timeout for synchronous delegation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 600000,
      }),
    );

    fetchMock.mockImplementation((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcomePromise = service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '请检查 MTR-144628 的标题',
      mode: 'read',
      targetSystem: 'jira',
      timeoutMs: 1200,
    });
    await vi.advanceTimersByTimeAsync(1200);

    const outcome = await outcomePromise;
    expect(outcome.status).toBe('timeout');
    expect(outcome.summary).toBe('OpenClaw 委派超时。');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('repairs a truncated JSON envelope when the returned content is otherwise verifiable', async () => {
    vi.stubGlobal('fetch', fetchMock);

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-delegation-'));
    const userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-openclaw-key',
        openClawTimeoutMs: 5000,
      }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: [
                    '```json',
                    '{',
                    '  "status": "success",',
                    '  "summary": "已核实 Gary 在 4/9 有一场明确的 video 项目会议。",',
                    '  "artifacts": [',
                    '    {',
                    '      "kind": "event",',
                    '      "title": "RCV project review",',
                    '      "content": "时间：2026-04-09 09:30-10:30",',
                    '      "metadata": {',
                    '        "sourceSystem": "Google Calendar",',
                    '        "entityId": "evt-1",',
                    '        "verification": "calendar_api_verified",',
                    '        "observedFields": ["summary", "start", "end"]',
                    '      }',
                    '    }',
                    '  ],',
                    '  "payload": {',
                    '    "video_project_events": [',
                    '      {',
                    '        "date": "2026-04-09",',
                    '        "title": "RCV project review"',
                    '      }',
                    '    ]',
                    '  ',
                  ].join('\n'),
                },
              ],
            },
          ],
        }),
    });

    const service = new OpenClawDelegationService(userDataManager, 'delegation-user');
    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '请核实 Gary 和 video 相关的具体日程',
      mode: 'read',
      targetSystem: 'calendar',
    });

    expect(outcome.status).toBe('success');
    expect(outcome.summary).toContain('4/9');
    expect(outcome.artifacts[0]?.metadata?.sourceSystem).toBe('Google Calendar');
    expect(Array.isArray(outcome.payload?.video_project_events)).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
