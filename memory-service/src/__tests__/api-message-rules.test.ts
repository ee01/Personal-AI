import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type BetterSqlite3 from 'better-sqlite3';

import { buildApp } from '../server.js';
import { ActionRepository } from '../repositories/ActionRepository.js';
import { getTestDb } from './setup.js';

describe('Message Rule Automation API', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeAll(async () => {
    db = getTestDb();
    const result = await buildApp({ db });
    app = result.app;
    await app.ready();
  });

  beforeEach(() => {
    db.prepare('DELETE FROM proposed_action_attempts').run();
    db.prepare('DELETE FROM proposed_actions').run();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates queued runtime actions for a leave/PT0 automation rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload: {
        ruleRef: 'manual:leave-rule',
        ruleText: 'Leave Chat 群有人发起请假消息，并且包含我的名字',
        automationPrompt:
          '从消息提取请假日期，请假前 3 小时修改 Glip 状态为 PTO，结束后改回 Available。',
        message: {
          postId: 'post-leave-1',
          sender: 'Alice',
          groupId: 'leave-chat',
          groupName: 'Leave Chat',
          content: 'Current User will be on leave 2099-04-18~2099-04-20.',
          timestamp: new Date('2099-04-16T09:00:00.000Z').getTime(),
        },
        match: {
          matchedRule: '[RULE_REF:manual:leave-rule]',
          summary: '匹配到请假消息',
          confidence: 0.94,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deduped).toBe(false);
    expect(body.skippedReason).toBeUndefined();
    expect(body.actions).toHaveLength(3);
    expect(body.detectedWindow?.label).toBe('4/18~4/20');
    expect(body.detectedWindow?.restoreActionAt).toBeGreaterThan(
      body.detectedWindow?.startActionAt ?? 0,
    );

    const repo = new ActionRepository(db);
    const queued = repo.list({
      sourceKind: 'message_rule',
      sourceRefId: 'manual:leave-rule',
      limit: 10,
    }).items;
    expect(queued).toHaveLength(3);
    const delegated = queued.filter(
      (item) => item.actionType === 'delegate_openclaw',
    );
    expect(delegated).toHaveLength(2);
    expect(delegated[0].executionMode).toBe('auto');
    expect(delegated[0].requiresApproval).toBe(false);
    expect(delegated[1].params.leaveLabel).toBe('4/18~4/20');
  });

  it('keeps write delegate actions manual when requiresApproval is explicitly enabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload: {
        ruleRef: 'manual:leave-rule-approval',
        automationPrompt:
          '从消息提取请假日期，请假前 3 小时修改 Glip 状态为 PTO，结束后改回 Available。',
        requiresApproval: true,
        message: {
          postId: 'post-leave-approval-1',
          content: 'Current User will be on leave 2099-04-18~2099-04-20.',
        },
      },
    });

    expect(res.statusCode).toBe(200);

    const repo = new ActionRepository(db);
    const delegated = repo
      .list({
        sourceKind: 'message_rule',
        sourceRefId: 'manual:leave-rule-approval',
        limit: 10,
      })
      .items.filter((item) => item.actionType === 'delegate_openclaw');

    expect(delegated).toHaveLength(2);
    expect(delegated[0].executionMode).toBe('manual');
    expect(delegated[0].requiresApproval).toBe(true);
  });

  it('dedupes the same rule hit by hitRef', async () => {
    const payload = {
      ruleRef: 'manual:leave-rule',
      automationPrompt:
        '从消息提取请假日期，请假前 3 小时修改 Glip 状态为 PTO，结束后改回 Available。',
      message: {
        postId: 'post-leave-1',
        sender: 'Alice',
        content: 'Current User will be on leave 2099-04-18~2099-04-20.',
      },
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload,
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload,
    });
    expect(second.statusCode).toBe(200);
    const body = second.json();
    expect(body.deduped).toBe(true);
    expect(body.actions).toHaveLength(3);

    const repo = new ActionRepository(db);
    const queued = repo.list({
      sourceKind: 'message_rule',
      sourceRefId: 'manual:leave-rule',
      limit: 10,
    }).items;
    expect(queued).toHaveLength(3);
  });

  it('creates a generic delegate action for known linked-action families', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload: {
        ruleRef: 'manual:jira-rule',
        ruleText: '消息命中后同步 Jira 工单',
        automationPrompt:
          '从消息中识别 Jira / ticket 编号，把关键信息整理成 comment 追加到对应工单。',
        message: {
          postId: 'post-jira-1',
          sender: 'Alice',
          groupId: 'proj-chat',
          groupName: 'Project Chat',
          content: '请帮我给 RCV-1234 补一条 comment，说明本周修复已经完成。',
        },
        match: {
          matchedRule: '[RULE_REF:manual:jira-rule]',
          summary: '匹配到 Jira 更新消息',
          confidence: 0.91,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deduped).toBe(false);
    expect(body.skippedReason).toBeUndefined();
    expect(body.actions).toHaveLength(2);

    const repo = new ActionRepository(db);
    const queued = repo.list({
      sourceKind: 'message_rule',
      sourceRefId: 'manual:jira-rule',
      limit: 10,
    }).items;
    expect(queued).toHaveLength(2);
    expect(queued.some((item) => item.actionType === 'notify_user')).toBe(true);

    const delegated = queued.find(
      (item) => item.actionType === 'delegate_openclaw',
    );
    expect(delegated).toBeTruthy();
    expect(delegated?.params.targetSystem).toBe('jira');
    const metadata =
      delegated &&
      delegated.params &&
      typeof delegated.params === 'object' &&
      'metadata' in delegated.params &&
      delegated.params.metadata &&
      typeof delegated.params.metadata === 'object' &&
      'actionFamily' in delegated.params.metadata
        ? delegated.params.metadata.actionFamily
        : undefined;
    expect(metadata).toBe('jira_comment');
  });

  it('returns skippedReason when the automation prompt is unsupported or cannot parse dates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload: {
        ruleRef: 'manual:generic-rule',
        automationPrompt: '命中后做一些复杂事情。',
        message: {
          content: 'please handle this someday',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.actions).toEqual([]);
    expect(body.skippedReason).toBe(
      'unsupported_or_unparseable_automation_prompt',
    );
  });
});
