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
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        openClawEnabled: true,
        openClawBaseUrl: 'https://openclaw.example.com',
        openClawApiKey: 'test-key',
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
    });
    await service.prepareActionForDispatch(blocked);

    expect(actionRepo.listDueAutoActions(10).map((item) => item.id)).toEqual([
      readyInternal.id,
    ]);
    expect(actionRepo.getById(blocked.id)?.retryCount).toBe(0);
  });
});
