import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { OpenClawDelegationService } from '../integrations/OpenClawDelegationService.js';
import { UserDataManager } from '../storage/UserDataManager.js';

describe('OpenClawDelegationService', () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns capability_missing when user runtime config has no OpenClaw setup', async () => {
    const service = new OpenClawDelegationService();

    const outcome = await service.delegate({
      actionId: 'action-1',
      threadId: 'thread-1',
      sessionKey: 'thread-1',
      task: '查询外部系统状态',
      mode: 'read',
    });

    expect(outcome.status).toBe('capability_missing');
    expect(outcome.summary).toContain('未配置');
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

  it('treats a non-empty plain-text final answer as error when no verifiable artifact is present', async () => {
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

    expect(outcome.status).toBe('error');
    expect(outcome.summary).toContain('未返回结构化结果');
    expect(outcome.payload?.fallback).toBe('plain_text_summary_without_verifiable_artifact');
    expect(outcome.payload?.rawSummary).toContain('Cancelled');
 
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
});
