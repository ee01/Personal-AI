import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { issueUserApiKey } from '../core/auth/userApiKeys.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { writeGuardMiddleware } from '../middleware/writeGuard.js';
import { getTestDb } from './setup.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { outreachRoutes } from '../routes/outreach.js';
import { agentTaskRoutes } from '../routes/agentTasks.js';
import { ActionExecutor } from '../core/actions/ActionExecutor.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { AgentTaskNotifyConfigRepository } from '../repositories/AgentTaskNotifyConfigRepository.js';
import { OutreachRepository } from '../repositories/OutreachRepository.js';
import { readLedgerNotifyConfig, planAgentTaskNotifications } from '../core/agentTaskNotification.js';
import { buildAgentResultSystemPrompt, buildAgentResultUserPrompt } from '../integrations/executors/agentResultPrompt.js';
import { parseAgentResultEnvelope } from '../integrations/executors/agentResultEnvelope.js';

describe('Schedule → Memory HTTP contract (isolated identities, no external delivery)', () => {
  const db = getTestDb();
  const otherDb = new Database(db.serialize());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schedule-memory-contract-'));
  const udm = new UserDataManager();
  const app = Fastify();
  const repo = new ActionRepository(db);
  let base: string;
  const keys: Record<string, string> = {};
  const request = async (url: string, body?: unknown, token = 'one') => {
    const res = await fetch(base + '/api/v1' + url, { method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${keys[token]}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json() as any };
  };
  const template = { question: 'Please report risk', recipients: [{ targetType: 'group', chatId: 'fixture-chat' }], approvalPolicy: 'always_review' };
  beforeAll(async () => {
    udm.initialize(dir);
    udm.writeFile('config.json', JSON.stringify({ outreachEnabled: true, outreachRequireApprovalForManual: false,
      openClawEnabled: true, openClawBaseUrl: 'http://unused-executor.invalid' }));
    keys.one = issueUserApiKey(db, 'one', { scopes: ['memory.read', 'memory.write'] }).token;
    keys.two = issueUserApiKey(otherDb, 'two', { scopes: ['memory.read', 'memory.write'] }).token;
    keys.readonly = issueUserApiKey(db, 'one', { scopes: ['memory.read'] }).token;
    // Actual personal-key auth/write gates; only storage/context is isolated.
    app.addHook('onRequest', createAuthMiddleware({ getContext: (id: string) => ({
      db: id === 'one' ? db : otherDb, userDataManager: udm,
    }) } as any));
    app.addHook('onRequest', writeGuardMiddleware);
    await app.register(outreachRoutes, { prefix: '/api/v1' });
    await app.register(agentTaskRoutes, { prefix: '/api/v1' });
    base = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterEach(async () => { await new Promise<void>(resolve => setImmediate(resolve)); vi.restoreAllMocks(); });
  afterAll(async () => { await app.close(); otherDb.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  it('atomically deduplicates parallel external occurrences, isolates users and keeps approval pending', async () => {
    const body = { sourceSystem: 'schedule_service', occurrenceKey: 'slot-one', scheduledFor: 1800000000, template };
    const responses = await Promise.all([request('/outreach/templates/ext/trigger-occurrence', body), request('/outreach/templates/ext/trigger-occurrence', body)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(responses.filter(r => r.body.created)).toHaveLength(1);
    expect(responses[0].body.session.id).toBe(responses[1].body.session.id);
    expect(responses[0].body).toMatchObject({ notificationOwner: 'memory', publishOwner: 'memory', session: { status: 'pending_approval' } });
    expect(responses[0].body.session.nextCheckAt ?? null).toBeNull();
    const other = await request('/outreach/templates/ext/trigger-occurrence', body, 'two');
    expect(other.body.created).toBe(true);
    expect(other.body.session.id).not.toBe(responses[0].body.session.id);
    const changedRetry = await request('/outreach/templates/ext/trigger-occurrence', { ...body, template: { ...template, question: 'Changed' } });
    expect(changedRetry.body.session.renderedQuestion).toBe(template.question);
    expect(new OutreachRepository(db).getTemplateById('ext')?.questionTemplate).toBe(template.question);
  });

  it('rejects invalid occurrence, fanout and non-Schedule template takeover without writes', async () => {
    const body = { sourceSystem: 'schedule_service', occurrenceKey: 'slot', scheduledFor: 1800000000, template };
    for (const patch of [{ occurrenceKey: {} }, { scheduledFor: 1.5 }, { sourceSystem: 'unknown' },
      { template: { ...template, recipients: ['a', 'b'] } }, { template: { ...template, approvalPolicy: 'unsafe' } }]) {
      expect((await request('/outreach/templates/bad/trigger-occurrence', { ...body, ...patch })).status).toBe(400);
    }
    const outreach = new OutreachRepository(db);
    expect(outreach.getTemplateById('bad')).toBeNull();
    outreach.upsertTemplate({ id: 'private-existing', sourceKind: 'reflection', title: 'Private', questionTemplate: 'Keep', targetType: 'group', targetRef: 'private', enabled: true, scheduleSpec: {} });
    expect((await request('/outreach/templates/private-existing/trigger-occurrence', body)).status).toBe(400);
    expect(outreach.getTemplateById('private-existing')?.questionTemplate).toBe('Keep');
  });

  it('uses authenticated personal-key write scopes rather than a caller-supplied identity', async () => {
    const body = { sourceSystem: 'schedule_service', occurrenceKey: 'denied', scheduledFor: 1800000000, template };
    expect((await request('/outreach/templates/no-write/trigger-occurrence', body, 'readonly')).status).toBe(403);
    expect(new OutreachRepository(db).getTemplateById('no-write')).toBeNull();
    const res = await fetch(base + '/api/v1/outreach/templates/no-spoof/trigger-occurrence', { method: 'POST',
      headers: { Authorization: `Bearer ${keys.one}`, 'X-User-Id': 'two', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect(res.status).toBe(403);
  });

  it('does not allow a future occurrence to be dispatched early', async () => {
    const scheduledFor = Math.floor(Date.now() / 1000) + 3600;
    const result = await request('/outreach/templates/future/trigger-occurrence', { sourceSystem: 'schedule_service', occurrenceKey: 'future', scheduledFor,
      template: { ...template, approvalPolicy: 'manual_direct' } });
    expect(result.body.session.nextCheckAt).toBe(scheduledFor);
  });

  it('returns explicit output for one action, passes template only to system prompt and never fans out to a Schedule group', async () => {
    vi.spyOn(ActionExecutor.prototype, 'executeAction').mockResolvedValue({ actionId: 'fixture', actionType: 'delegate_agent', queueStatus: 'queued' });
    new AgentTaskNotifyConfigRepository(db).upsert({ sheetMessageId: 'shared-task', notifyTarget: { type: 'group', targetGroupId: 'old-group' }, successReceipt: 'N', notifyTemplate: 'private old template' });
    const publishTemplate = [{ name: 'title', note: 'One sentence title', required: true }];
    const input = { taskId: 'shared-task', task: 'Inspect only', triggerSource: 'schedule_service', executor: 'openclaw',
      idempotencyKey: 'exact-occurrence', publishTemplate, notifyTarget: { type: 'group', targetGroupId: 'must-not-send' }, notifyTemplate: 'must-not-forward' };
    const first = await request('/agent-tasks/execute', input);
    expect(first.status).toBe(202);
    expect(first.body).toMatchObject({ notificationOwner: 'memory', publishOwner: 'schedule_service' });
    expect(first.body.resultUrl).toBe(`/api/v1/agent-tasks/runs/${first.body.actionId}/result`);
    const action = repo.getById(first.body.actionId)!;
    const metadata = action.params.metadata as Record<string, unknown>;
    expect(metadata).toMatchObject({ publishTemplate, notificationOwner: 'memory', publishOwner: 'schedule_service' });
    expect(metadata.notifyTarget).toBeUndefined();
    const cfg = readLedgerNotifyConfig(action);
    expect(cfg.notifyTarget).toBeUndefined();
    expect(cfg.successReceipt).toBe(true);
    const plan = planAgentTaskNotifications({ succeeded: true, notify: true, successReceipt: true, ownerUserId: 'one' });
    expect(plan).toEqual([{ kind: 'success_receipt', targetUserId: 'one', useTemplate: false }]);
    const prompt = buildAgentResultSystemPrompt({ task: input.task, mode: 'read', metadata });
    expect(prompt).toContain('publish_fields'); expect(prompt).toContain('One sentence title');
    expect(prompt).not.toContain('must-not-send');
    expect(buildAgentResultUserPrompt({ task: input.task, mode: 'read', metadata })).not.toContain('One sentence title');
    const envelope = parseAgentResultEnvelope(JSON.stringify({ status: 'success', summary_for_owner: 'PRIVATE', final_output: 'PUBLIC', publish_fields: { title: 'Report' }, attachments: [{ url: 'https://example.test/report' }], artifacts: [] }));
    repo.markSucceeded(action.id, repo.markRunning(action.id), envelope as any);
    const receipt = await request(`/agent-tasks/runs/${action.id}/result`);
    expect(receipt.body).toMatchObject({ schemaVersion: 1, runId: action.id, notificationOwner: 'memory', publishOwner: 'schedule_service',
      summaryForOwner: 'PRIVATE', finalOutput: 'PUBLIC', publishFields: { title: 'Report' }, attachments: [{ url: 'https://example.test/report' }] });
    expect((await request(`/agent-tasks/runs/${action.id}/result`, undefined, 'two')).status).toBe(404);
    const duplicate = await request('/agent-tasks/execute', { ...input, notificationOwner: 'schedule_service' });
    expect(duplicate.body.actionId).toBe(action.id);
    expect(duplicate.body.notificationOwner).toBe('memory');
  });

  it('supports Schedule-owned private notifications without any Memory delivery and rejects malformed templates', async () => {
    vi.spyOn(ActionExecutor.prototype, 'executeAction').mockResolvedValue({ actionId: 'fixture', actionType: 'delegate_agent', queueStatus: 'queued' });
    const input = { taskId: 'schedule-notices', task: 'Inspect', triggerSource: 'schedule_service', executor: 'openclaw', notificationOwner: 'schedule_service' };
    const result = await request('/agent-tasks/execute', input);
    expect(result.status).toBe(202);
    expect(readLedgerNotifyConfig(repo.getById(result.body.actionId)!).notify).toBe(false);
    expect((await request('/agent-tasks/execute', { ...input, userId: 'two' })).status).toBe(403);
    expect((await request('/agent-tasks/execute', { ...input, publishTemplate: [{ name: 'x' }, { name: 'x' }] })).status).toBe(400);
    expect((await request('/agent-tasks/execute', { ...input, publishTemplate: [{ name: '__proto__' }] })).status).toBe(400);
  });

  it.runIf(Boolean(process.env.SCHEDULE_PROVIDERS_PATH))('uses the actual Schedule HTTP provider against Memory, including duplicate acceptance', async () => {
    const { providers } = await import(/* @vite-ignore */ pathToFileURL(process.env.SCHEDULE_PROVIDERS_PATH!).href);
    const args = { task: { id: 'actual-provider', config: { template } }, occurrence: { occ_key: 'actual-provider:slot', scheduled_for: 1800000000 },
      connections: { memory: { baseUrl: base, userKey: keys.one } } };
    const first = await providers.outreach.run(args);
    const duplicate = await providers.outreach.run(args);
    expect(first.evidence.created).toBe(true);
    expect(duplicate.evidence.created).toBe(false);
    expect(first.evidence.sessionId).toBe(duplicate.evidence.sessionId);
    expect(new OutreachRepository(db).getSessionById(first.evidence.sessionId)?.status).toBe('pending_approval');
  });
});
