import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDb } from './setup.js';
import { ReflectionThreadService } from '../core/ReflectionThreadService.js';
import { ReflectionThreadRepository } from '../repositories/ReflectionThreadRepository.js';
import { ActionResultRepository } from '../repositories/ActionResultRepository.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { ReflectionResearcher } from '../core/ReflectionResearcher.js';
import { RecallEngine } from '../core/RecallEngine.js';
import { ReflectionWorker } from '../core/ReflectionWorker.js';
import { now } from '../utils/time.js';

describe('ReflectionThreadService', () => {
  const db = getTestDb();
  const repo = new ReflectionThreadRepository(db);
  const actionResultRepo = new ActionResultRepository(db);
  const actionRepo = new ActionRepository(db);

  beforeEach(() => {
    db.prepare('DELETE FROM rehearsal_activations').run();
    db.prepare('DELETE FROM rehearsals').run();
    db.prepare('DELETE FROM action_results').run();
    db.prepare('DELETE FROM topic_memory_links').run();
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
    db.prepare('DELETE FROM reflection_research_attempts').run();
    db.prepare('DELETE FROM reflection_runs').run();
    db.prepare('DELETE FROM dream_runs').run();
    db.prepare('DELETE FROM reflection_threads').run();
    db.prepare('DELETE FROM entity_properties').run();
    db.prepare('DELETE FROM entities').run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns actionResults and hydrated action_result links in thread detail', () => {
    const thread = repo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
    });

    const action = actionRepo.create({
      id: 'action-1',
      actionType: 'delegate_openclaw',
      title: '查询 Orbit 外部进展',
      threadId: thread.id,
      runId: 'run-1',
      queueStatus: 'succeeded',
      executionMode: 'auto',
    });

    const actionResult = actionResultRepo.create({
      actionId: action.id,
      threadId: thread.id,
      runId: 'run-1',
      resultType: 'success',
      summary: '已获取到 Orbit 的外部进展摘要。',
      payload: { targetSystem: 'jira' },
    });

    const service = new ReflectionThreadService(db);
    service.recordActionResult(actionResult);

    const detail = service.getThreadDetail(thread.id);

    expect(detail).not.toBeNull();
    expect(detail?.actionResults).toHaveLength(1);
    expect(detail?.actionResults[0].summary).toContain('外部进展摘要');
    expect(
      detail?.links.some((link) => link.sourceKind === 'action_result'),
    ).toBe(true);
    const actionResultLink = detail?.links.find(
      (link) => link.sourceKind === 'action_result',
    );
    expect(actionResultLink?.previewTitle).toBe('外部委派结果');
    expect(actionResultLink?.preview).toContain('外部进展摘要');
  });

  it('persists and hydrates entity hits from local research', async () => {
    const currentTime = now();
    db.prepare(
      `INSERT INTO entities
        (id, type, name, description, importance, access_count, first_seen, last_seen, mention_count, status, created_at, updated_at)
       VALUES
        (?, 'Project', 'Orbit', 'Release coordination project', 0.8, 0, ?, ?, 3, 'active', ?, ?)`,
    ).run(
      'entity-orbit',
      currentTime - 3600,
      currentTime - 60,
      currentTime - 3600,
      currentTime,
    );
    db.prepare(
      `INSERT INTO entity_properties
        (entity_id, property_key, property_value, tx_start, confidence, status)
       VALUES
        ('entity-orbit', 'owner', 'Platform Team', ?, 0.91, 'active')`,
    ).run(currentTime - 120);

    const thread = repo.upsertThread({
      topicKey: 'project:orbit',
      title: '项目反思: Orbit',
      status: 'active',
      priority: 8,
      salience: 0.9,
      openQuestions: ['Orbit 的 owner 是谁？'],
      nextReflectionAt: currentTime,
    });

    vi.spyOn(ReflectionResearcher.prototype, 'plan').mockResolvedValue([
      {
        query: 'Orbit owner',
        topK: 2,
        purpose: '确认 Orbit 的本地事实',
        sourceTypes: ['manual'],
      },
    ]);
    vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'entity-orbit',
          type: 'entity',
          content: 'Orbit project owned by Platform Team',
          score: 0.86,
          timestamp: currentTime - 60,
          entity: {
            id: 'entity-orbit',
            type: 'Project',
            name: 'Orbit',
          },
        },
      ],
      totalFound: 1,
      queryTimeMs: 1,
      channels: ['graph'],
      channelDiagnostics: [
        { channel: 'graph', status: 'hit', candidateCount: 1 },
      ],
    });
    vi.spyOn(ReflectionWorker.prototype, 'generate').mockResolvedValue({
      summary: '本地研究确认 Orbit 的 owner。',
      hypothesisAfter: 'Orbit owner is Platform Team.',
      discoveries: ['Orbit owner = Platform Team'],
      openQuestions: [],
      actionProposals: [],
    });

    await new ReflectionThreadService(db).runReflection(thread.id, {
      runType: 'manual_revisit',
      triggerType: 'manual',
      force: true,
    });

    const detail = new ReflectionThreadService(db).getThreadDetail(thread.id);
    const entityLink = detail?.links.find(
      (link) => link.sourceKind === 'entity' && link.role === 'research',
    );

    expect(entityLink).toBeTruthy();
    expect(entityLink?.previewTitle).toBe('实体线索: Orbit');
    expect(entityLink?.preview).toContain('Project');
    expect(entityLink?.preview).toContain('owner=Platform Team');
    expect(detail?.researchAttempts).toHaveLength(1);
    expect(detail?.researchAttempts[0].status).toBe('hit');
    expect(detail?.researchAttempts[0].resultCount).toBe(1);
    expect(detail?.researchAttempts[0].evidenceRefs).toEqual([
      'entity:entity-orbit',
    ]);
  });

  it('records failed and empty local research attempts without aborting the reflection run', async () => {
    const currentTime = now();
    const thread = repo.upsertThread({
      topicKey: 'project:atlas',
      title: '项目反思: Atlas',
      status: 'active',
      priority: 7,
      salience: 0.8,
      openQuestions: ['Atlas 是否已有本地结论？'],
      nextReflectionAt: currentTime,
    });

    vi.spyOn(ReflectionResearcher.prototype, 'plan').mockResolvedValue([
      {
        query: 'broken local lookup',
        topK: 2,
        purpose: '验证失败查询会被记录',
        sourceTypes: ['manual'],
      },
      {
        query: 'Atlas local conclusion',
        topK: 2,
        purpose: '确认 Atlas 本地证据',
        sourceTypes: ['manual'],
      },
      {
        query: 'Atlas degraded local lookup',
        topK: 2,
        purpose: '确认通道失败不会伪装成空结果',
        sourceTypes: ['manual'],
      },
    ]);
    vi.spyOn(RecallEngine.prototype, 'recall').mockImplementation(
      async (input) => {
        if (input.query === 'broken local lookup') {
          throw new Error('recall index temporarily unavailable');
        }
        if (input.query === 'Atlas degraded local lookup') {
          return {
            items: [],
            totalFound: 0,
            queryTimeMs: 1,
            channels: [],
            channelDiagnostics: [
              {
                channel: 'vector',
                status: 'failed',
                candidateCount: 0,
                reason: 'embedding timeout',
              },
              { channel: 'fts', status: 'empty', candidateCount: 0 },
            ],
          };
        }
        return {
          items: [],
          totalFound: 0,
          queryTimeMs: 1,
          channels: ['fts'],
          channelDiagnostics: [
            { channel: 'fts', status: 'empty', candidateCount: 0 },
          ],
        };
      },
    );
    vi.spyOn(ReflectionWorker.prototype, 'generate').mockResolvedValue({
      summary: 'Atlas 本轮反思完成，但本地研究没有新证据。',
      hypothesisAfter: 'Atlas still needs more evidence.',
      discoveries: [],
      openQuestions: ['继续等待更多 Atlas 证据？'],
      actionProposals: [],
    });

    const result = await new ReflectionThreadService(db).runReflection(
      thread.id,
      {
        runType: 'manual_revisit',
        triggerType: 'manual',
        force: true,
      },
    );

    const detail = new ReflectionThreadService(db).getThreadDetail(thread.id);
    expect(result.run.summary).toContain('Atlas 本轮反思完成');
    expect(detail?.researchAttempts).toHaveLength(3);
    const attemptsByQuery = new Map(
      detail?.researchAttempts.map((attempt) => [attempt.query, attempt]) ?? [],
    );
    expect(attemptsByQuery.get('Atlas local conclusion')?.status).toBe(
      'empty',
    );
    expect(attemptsByQuery.get('broken local lookup')?.status).toBe('failed');
    expect(attemptsByQuery.get('Atlas degraded local lookup')?.status).toBe(
      'failed',
    );
    expect(attemptsByQuery.get('Atlas local conclusion')?.runId).toBe(
      result.run.id,
    );
    expect(attemptsByQuery.get('broken local lookup')?.errorMessage).toContain(
      'recall index temporarily unavailable',
    );
    expect(
      attemptsByQuery.get('Atlas degraded local lookup')?.errorMessage,
    ).toContain('vector(embedding timeout)');
  });

  it('persists worker-generated rehearsal candidates from reflection runs', async () => {
    const currentTime = now();
    const thread = repo.upsertThread({
      topicKey: 'entity:colin-liu',
      title: '实体反思: Colin Liu',
      status: 'active',
      priority: 8,
      salience: 0.88,
      openQuestions: ['下次和 Colin 聊天要提醒什么？'],
      nextReflectionAt: currentTime,
    });

    vi.spyOn(ReflectionResearcher.prototype, 'plan').mockResolvedValue([]);
    vi.spyOn(ReflectionWorker.prototype, 'generate').mockResolvedValue({
      summary: '需要在下次和 Colin 聊天时主动提合同节奏。',
      hypothesisAfter: 'Colin 相关沟通需要提前带入合同节奏。',
      discoveries: ['下次和 Colin 聊天需要提合同节奏'],
      openQuestions: [],
      actionProposals: [],
      rehearsalCandidates: [
        {
          title: '下次和 Colin 聊天提合同节奏',
          scenarioType: 'chat',
          summary: '和 Colin 刘聊天时提醒合同节奏。',
          content: '如果下次和 Colin Liu 聊天，先确认合同节奏和需要他补充的信息。',
          activationCues: {
            people: ['Colin Liu'],
            keywords: ['合同节奏'],
            surfaces: ['compose_assist', 'meeting_pilot'],
          },
          confidence: 0.86,
          priority: 8,
        },
      ],
      markdownBody: '',
    });

    const result = await new ReflectionThreadService(db).runReflection(
      thread.id,
      {
        runType: 'manual_revisit',
        triggerType: 'manual',
        force: true,
      },
    );

    expect(result.rehearsals).toHaveLength(1);
    const rehearsal = result.rehearsals[0];
    expect(rehearsal.status).toBe('active');
    expect(rehearsal.sourceKind).toBe('reflection');
    expect(rehearsal.sourceRefId).toContain(`thread:${thread.id}:`);
    expect(rehearsal.activationCues.people).toEqual(['Colin Liu']);
    expect(rehearsal.evidenceRefs).toContain(
      `reflection_thread:${thread.id}`,
    );
    expect(rehearsal.evidenceRefs).toContain(`reflection_run:${result.run.id}`);

    const detail = new ReflectionThreadService(db).getThreadDetail(thread.id);
    const rehearsalLink = detail?.links.find(
      (link) => link.sourceKind === 'rehearsal',
    );
    expect(rehearsalLink?.role).toBe('rehearsal_candidate');
    expect(rehearsalLink?.previewTitle).toContain('场景预演');
  });

  it('updates an existing reflection-sourced rehearsal candidate instead of duplicating it', async () => {
    const currentTime = now();
    const thread = repo.upsertThread({
      topicKey: 'entity:colin-liu',
      title: '实体反思: Colin Liu',
      status: 'active',
      priority: 8,
      salience: 0.88,
      nextReflectionAt: currentTime,
    });

    vi.spyOn(ReflectionResearcher.prototype, 'plan').mockResolvedValue([]);
    vi.spyOn(ReflectionWorker.prototype, 'generate')
      .mockResolvedValueOnce({
        summary: '第一次生成 Colin 预演。',
        hypothesisAfter: '需要提醒 Colin 合同节奏。',
        discoveries: [],
        openQuestions: [],
        actionProposals: [],
        rehearsalCandidates: [
          {
            title: '下次和 Colin 聊天提合同节奏',
            scenarioType: 'chat',
            content: '第一次脚本。',
            activationCues: {
              people: ['Colin Liu'],
              keywords: ['合同节奏'],
            },
            confidence: 0.84,
            priority: 7,
          },
        ],
        markdownBody: '',
      })
      .mockResolvedValueOnce({
        summary: '第二次更新 Colin 预演。',
        hypothesisAfter: '仍然需要提醒 Colin 合同节奏。',
        discoveries: [],
        openQuestions: [],
        actionProposals: [],
        rehearsalCandidates: [
          {
            title: '下次和 Colin 聊天提合同节奏',
            scenarioType: 'chat',
            content: '第二次更新后的脚本。',
            activationCues: {
              people: ['Colin Liu'],
              keywords: ['合同节奏'],
            },
            confidence: 0.9,
            priority: 9,
          },
        ],
        markdownBody: '',
      });

    await new ReflectionThreadService(db).runReflection(thread.id, {
      runType: 'manual_revisit',
      triggerType: 'manual',
      force: true,
    });
    const second = await new ReflectionThreadService(db).runReflection(
      thread.id,
      {
        runType: 'manual_revisit',
        triggerType: 'manual',
        force: true,
      },
    );

    const rows = db
      .prepare('SELECT id, content, priority FROM rehearsals')
      .all() as Array<{ id: string; content: string; priority: number }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(second.rehearsals[0].id);
    expect(rows[0].content).toBe('第二次更新后的脚本。');
    expect(rows[0].priority).toBe(9);
  });
});
