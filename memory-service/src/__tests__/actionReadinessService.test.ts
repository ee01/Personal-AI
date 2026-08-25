import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ActionReadinessService } from '../core/ActionReadinessService.js';
import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { getTestDb } from './setup.js';

describe('ActionReadinessService', () => {
  const db = getTestDb();
  const actionRepo = new ActionRepository(db);
  const fetchMock = vi.fn();
  let userDataManager: UserDataManager;
  let tempDir: string;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    db.prepare('DELETE FROM action_readiness_links').run();
    db.prepare('DELETE FROM action_readiness_contracts').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'action-readiness-'));
    userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    // Declare the responses protocol explicitly: probes now follow the
    // configured executor, and these cases stub the HTTP transport.
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-key',
        agentExecutors: [
          {
            id: 'openclaw',
            label: 'OpenClaw',
            type: 'openclaw-responses',
            baseUrl: 'https://openclaw.example.com',
            apiKey: 'test-key',
            enabled: true,
          },
        ],
        executorDefaults: {
          agent_task: 'openclaw',
          reflection_research: 'openclaw',
        },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks later actions before an attempt after a gateway auth failure', async () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const failed = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询 Jira 发布状态',
      params: {
        task: '查询 ORB-123。',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    service.recordDelegationOutcome(failed, {
      status: 'auth_error',
      summary: 'OpenClaw 返回鉴权失败或权限不足。',
      artifacts: [],
      payload: { httpStatus: 401 },
    });
    expect(service.checkAction(failed).receipt.dispatchState).toBe(
      'dispatched',
    );

    const queued = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询下一条 Jira 事实',
      params: {
        task: '查询 ORB-456。',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      queueStatus: 'queued',
    });

    const result = await new ActionExecutor(
      db,
      userDataManager,
      'test-user',
    ).executeAction(queued.id);

    expect(result.queueStatus).toBe('queued');
    expect(result.result?.status).toBe('blocked_by_readiness');
    expect(result.readinessReceipt).toMatchObject({
      scopeKey: 'openclaw:global',
      status: 'blocked_auth',
      dispatchState: 'not_dispatched',
    });
    expect(actionRepo.getById(queued.id)?.retryCount).toBe(0);
    expect(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM proposed_action_attempts WHERE action_id = ?',
        )
        .get(queued.id),
    ).toEqual({ count: 0 });
    expect(fetchMock).not.toHaveBeenCalled();

    const enriched = service.enrichActionList(
      actionRepo.list({ actionType: 'delegate_openclaw', limit: 20 }),
    );
    expect(enriched.readinessSummary).toMatchObject({
      status: 'blocked',
      blockedContractCount: 1,
    });
    expect(enriched.readinessSummary.affectedActionCount).toBeGreaterThanOrEqual(
      1,
    );
  });

  it('expires scoped capability_missing degraded blocks after proof-fail TTL', () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const failed = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: 'query jira',
      params: {
        task: 'query ORB-1',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    service.recordDelegationOutcome(failed, {
      status: 'capability_missing',
      summary: 'Jira connector unavailable',
      artifacts: [],
    });

    const blocked = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: 'query jira again',
      params: {
        task: 'query ORB-2',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      queueStatus: 'queued',
    });
    expect(service.checkAction(blocked).decision).toBe('probe_first');
    expect(service.checkAction(blocked).receipt.status).toBe('degraded');

    db.prepare(
      `UPDATE action_readiness_contracts
       SET expires_at = ?
       WHERE scope_key = ?`,
    ).run(Math.floor(Date.now() / 1000) - 10, 'openclaw:jira:read');

    const afterTtl = service.checkAction(blocked);
    expect(afterTtl.receipt.status).toBe('expired');
    expect(afterTtl.decision).toBe('probe_first');

    // Legacy rows may still be blocked_capability with an expires_at; those
    // must also stop hard-blocking once the TTL elapses.
    db.prepare(
      `UPDATE action_readiness_contracts
       SET status = 'blocked_capability', expires_at = ?
       WHERE scope_key = ?`,
    ).run(Math.floor(Date.now() / 1000) - 10, 'openclaw:jira:read');
    const legacy = service.checkAction(blocked);
    expect(legacy.receipt.status).toBe('expired');
    expect(legacy.decision).toBe('probe_first');
  });

  it('rechecks a blocked scope without executing the original task', async () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '上传发布文件',
      params: {
        task: '把 release.zip 上传到 Google Drive。',
        mode: 'write',
        targetSystem: 'google_drive',
      },
      executionMode: 'manual',
      requiresApproval: true,
      queueStatus: 'queued',
    });
    service.recordDelegationOutcome(action, {
      status: 'auth_error',
      summary: 'Google Drive connector authorization expired.',
      artifacts: [],
    });

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: 'Google Drive capability is reachable.',
            artifacts: [
              {
                kind: 'readiness_probe',
                title: 'Drive readiness',
                content: 'Connector authentication and capability metadata are available.',
                metadata: {
                  sourceSystem: 'google_drive',
                  entityKey: 'readiness-probe',
                  verification: 'connector_capability_check',
                  observedFields: [
                    'connection',
                    'authorization',
                    'capability',
                  ],
                },
              },
            ],
          }),
        }),
    });

    const result = await service.probeAction(action);

    expect(result.decision).toBe('allow');
    expect(result.receipt).toMatchObject({
      scopeKey: 'openclaw:google_drive:write',
      status: 'ready',
    });
    expect(result.probeReceipt).toMatchObject({
      probeOnly: true,
      originalActionExecuted: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as {
      input: Array<{ content: Array<{ text: string }> }>;
    };
    const probePrompt = requestBody.input[1].content[0].text;
    expect(probePrompt).toContain('Readiness probe only');
    expect(probePrompt).not.toContain('release.zip');
    expect(service.getByScopeKey('openclaw:global')?.status).toBe('ready');
    expect(
      service.getByScopeKey('openclaw:google_drive:write')?.status,
    ).toBe('ready');
    expect(actionRepo.getById(action.id)?.queueStatus).toBe('queued');
    expect(actionRepo.getById(action.id)?.approvedAt).toBeUndefined();
  });

  it('blocks missing required inputs locally and skips the network probe', async () => {
    const action = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '上传附件',
      params: {
        task: '上传附件到目标目录。',
        mode: 'write',
        targetSystem: 'google_drive',
        readinessRequiredInputs: ['folderId', 'attachment.downloadUrl'],
        attachment: { name: 'demo.mov' },
      },
      executionMode: 'manual',
      requiresApproval: true,
      queueStatus: 'queued',
    });
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );

    const check = service.checkAction(action);
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM action_readiness_contracts')
        .get(),
    ).toEqual({ count: 0 });
    const probe = await service.probeAction(action);

    expect(check).toMatchObject({
      decision: 'block',
      receipt: {
        status: 'blocked_input',
        requiredInputs: ['folderId', 'attachment.downloadUrl'],
      },
    });
    expect(probe.decision).toBe('block');
    expect(probe.probeReceipt.originalActionExecuted).toBe(false);
    expect(
      db
        .prepare('SELECT COUNT(*) AS count FROM action_readiness_contracts')
        .get(),
    ).toEqual({ count: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps linked blocked actions out of later due-action scans', async () => {
    const blocked = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询 Jira',
      params: {
        task: '查询 Jira。',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      requiresApproval: false,
      queueStatus: 'queued',
    });
    const readyInternal = actionRepo.create({
      actionType: 'notify_user',
      title: '保留可执行的本地通知',
      executionMode: 'auto',
      requiresApproval: false,
      queueStatus: 'queued',
    });
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    service.recordDelegationOutcome(blocked, {
      status: 'capability_missing',
      summary: 'Jira connector is unavailable.',
      artifacts: [],
      payload: { configured: false },
    });
    await service.prepareActionForDispatch(blocked);

    expect(actionRepo.listDueAutoActions(10).map((item) => item.id)).toEqual([
      readyInternal.id,
    ]);
    expect(actionRepo.getById(blocked.id)?.retryCount).toBe(0);
  });

  it('does not cascade a single missing-artifact failure across the whole scope', async () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const failed = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询 Jira',
      params: {
        task: '查询 ORB-1。',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    service.recordDelegationOutcome(failed, {
      status: 'error',
      summary: 'OpenClaw 返回了 success，但缺少可验证 artifact。',
      artifacts: [],
      payload: { artifactValidation: 'missing_verifiable_artifact' },
    });

    const contract = service.getByScopeKey('openclaw:jira:read');
    expect(contract?.status).toBe('degraded');
    expect(contract?.status).not.toBe('blocked_proof');

    const sibling = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: '查询另一条 Jira',
      params: {
        task: '查询 ORB-2。',
        mode: 'read',
        targetSystem: 'jira',
      },
      executionMode: 'auto',
      requiresApproval: false,
      queueStatus: 'queued',
    });

    const dueIds = actionRepo.listDueAutoActions(10).map((item) => item.id);
    expect(dueIds).toContain(sibling.id);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          output_text: JSON.stringify({
            status: 'success',
            summary: 'probe ok',
            artifacts: [
              {
                kind: 'readiness_probe',
                title: 'probe',
                content: 'ok',
                metadata: {
                  sourceSystem: 'jira',
                  entityKey: 'probe',
                  verification: 'connector_capability_check',
                  observedFields: ['connection'],
                },
              },
            ],
          }),
        }),
    });

    const prepare = await service.prepareActionForDispatch(sibling);
    expect(['allow', 'allow_manual_only']).toContain(prepare.decision);
  });

  it('keeps agent_task on the gateway gate so a missing tool does not block later tasks', () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const baidu = actionRepo.create({
      actionType: 'delegate_agent',
      title: 'test baidu',
      params: {
        task: '打开 baidu.com',
        mode: 'read',
        targetSystem: 'agent_task',
        metadata: { triggerSource: 'jira_rule' },
      },
      executionMode: 'auto',
      queueStatus: 'queued',
    });
    const roadmap = actionRepo.create({
      actionType: 'delegate_agent',
      title: 'Roadmap 创建 Jira',
      params: {
        task: 'create jira',
        mode: 'read',
        targetSystem: 'agent_task',
        metadata: { triggerSource: 'roadmap_create_jira' },
      },
      executionMode: 'auto',
      queueStatus: 'queued',
    });

    service.recordDelegationOutcome(baidu, {
      status: 'capability_missing',
      summary:
        '未能打开 baidu.com：Chrome 网页桥接未连接，备用浏览器控制组件缺少必需文件。',
      artifacts: [],
      payload: {},
    });

    const baiduCheck = service.checkAction(baidu);
    const roadmapCheck = service.checkAction(roadmap);

    expect(baiduCheck.receipt.scopeKey).toBe('openclaw:global');
    expect(roadmapCheck.receipt.scopeKey).toBe('openclaw:global');
    expect(service.getByScopeKey('openclaw:global')).toBeNull();
    expect(
      service.getByScopeKey('openclaw:agent_task:jira_rule:read'),
    ).toBeNull();
    expect(baiduCheck.decision).toBe('allow');
    expect(roadmapCheck.decision).toBe('allow');
  });

  it('refreshes openclaw:global when an OpenClaw executor probe succeeds', () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const failed = actionRepo.create({
      actionType: 'delegate_agent',
      title: 'Nova 新 缺少 Assignee 的 INIT',
      params: {
        task: '查询缺少 assignee 的 INIT。',
        mode: 'read',
        targetSystem: 'agent_task',
      },
      sourceKind: 'agent_task',
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    service.recordDelegationOutcome(failed, {
      status: 'auth_error',
      summary: 'OpenClaw 返回鉴权失败或权限不足。',
      artifacts: [],
      payload: { httpStatus: 401 },
    });
    expect(service.getByScopeKey('openclaw:global')?.status).toBe('blocked_auth');
    expect(service.checkAction(failed).decision).toBe('block');

    service.recordExecutorProbe(
      'openclaw',
      {
        ok: true,
        detail: 'Gateway WebSocket 握手与鉴权成功。',
      },
      { executorType: 'openclaw-gateway' },
    );

    expect(service.getByScopeKey('openclaw:global')?.status).toBe('ready');
    expect(service.checkAction(failed).decision).not.toBe('block');
  });

  it('lets a global auth block expire so agent_task can recover without a manual DB edit', () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const failed = actionRepo.create({
      actionType: 'delegate_agent',
      title: 'Nova 缺少 Team 的 Epics',
      params: {
        task: '查询缺少 Team 的 NOVA Epics。',
        mode: 'read',
        targetSystem: 'agent_task',
        metadata: { triggerSource: 'jira_rule' },
      },
      sourceKind: 'agent_task',
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    service.recordDelegationOutcome(failed, {
      status: 'auth_error',
      summary: 'OpenClaw 返回鉴权失败或权限不足。',
      artifacts: [],
      payload: { httpStatus: 401 },
    });

    const blocked = service.getByScopeKey('openclaw:global');
    expect(blocked?.status).toBe('blocked_auth');
    expect(blocked?.expiresAt).toBeTypeOf('number');

    db.prepare(
      'UPDATE action_readiness_contracts SET expires_at = ? WHERE scope_key = ?',
    ).run(1, 'openclaw:global');

    // Dispatch is refused before the executor is reached, so without a TTL the
    // contract could never be cleared by a successful run.
    expect(service.checkAction(failed).receipt.status).toBe('expired');
    expect(service.checkAction(failed).decision).not.toBe('block');
  });

  it('ages out a legacy auth block that was persisted without an expiry', () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const action = actionRepo.create({
      actionType: 'delegate_agent',
      title: 'Nova Committed 的 INIT 同步',
      params: {
        task: '同步 Epic Commit=Yes。',
        mode: 'read',
        targetSystem: 'agent_task',
      },
      sourceKind: 'agent_task',
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    service.recordDelegationOutcome(action, {
      status: 'auth_error',
      summary: 'OpenClaw 返回鉴权失败或权限不足。',
      artifacts: [],
      payload: { httpStatus: 401 },
    });

    // Reproduce a row written before auth blocks carried a TTL.
    db.prepare(
      `UPDATE action_readiness_contracts
       SET expires_at = NULL, blocked_since = ?, updated_at = ?
       WHERE scope_key = 'openclaw:global'`,
    ).run(1, 1);

    expect(service.getByScopeKey('openclaw:global')?.expiresAt).toBeUndefined();
    expect(service.checkAction(action).receipt.status).toBe('expired');
    expect(service.checkAction(action).decision).not.toBe('block');
  });

  it('still blocks later agent_task dispatch when the gateway itself is missing', () => {
    const service = new ActionReadinessService(
      db,
      userDataManager,
      'test-user',
    );
    const failed = actionRepo.create({
      actionType: 'delegate_agent',
      title: 'test baidu',
      params: {
        task: '打开 baidu.com',
        mode: 'read',
        targetSystem: 'agent_task',
        metadata: { triggerSource: 'jira_rule' },
      },
      executionMode: 'auto',
      queueStatus: 'failed',
    });
    service.recordDelegationOutcome(failed, {
      status: 'capability_missing',
      summary: 'OpenClaw 未配置，无法执行外部委派。',
      artifacts: [],
      payload: { configured: false },
    });

    const queued = actionRepo.create({
      actionType: 'delegate_agent',
      title: 'Roadmap 创建 Jira',
      params: {
        task: 'create jira',
        mode: 'read',
        targetSystem: 'agent_task',
        metadata: { triggerSource: 'roadmap_create_jira' },
      },
      executionMode: 'auto',
      queueStatus: 'queued',
    });

    const check = service.checkAction(queued);
    expect(check.decision).toBe('block');
    expect(check.receipt).toMatchObject({
      scopeKey: 'openclaw:global',
      status: 'blocked_capability',
    });
  });
});
