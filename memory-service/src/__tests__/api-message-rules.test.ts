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

  it('prefers structured event payload for timezone-aware PTO scheduling', async () => {
    const eventStartAt = Date.parse('2099-04-30T02:00:19.000Z');
    const eventEndAt = Date.parse('2099-04-30T02:05:19.000Z');
    const startActionAt = Date.parse('2099-04-29T23:00:19.000Z');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload: {
        ruleRef: 'manual:event-leave-rule',
        ruleText: "发送了内容与以下语义相似：Esone's PTO",
        automationPrompt:
          '从消息提取请假日期，请假前 3 小时修改 Glip 状态为 PTO，结束后恢复原本状态。',
        message: {
          postId: 'post-event-leave-1',
          sender: 'AI Service',
          groupId: 'sync-service',
          groupName: 'esone.qiu+sync.service',
          content:
            "[Event] Esone's PTO Date and time: 2099-04-30 10:00:19 - 2099-04-30 10:05:19",
          timestamp: Date.parse('2099-04-29T00:00:00.000Z'),
          timezone: 'Asia/Shanghai',
          event: {
            title: "Esone's PTO",
            start: '2099-04-30 10:00:19',
            end: '2099-04-30 10:05:19',
            startAtMs: eventStartAt,
            endAtMs: eventEndAt,
            timeRange: '2099-04-30 10:00:19 - 2099-04-30 10:05:19',
          },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deduped).toBe(false);
    expect(body.detectedWindow?.label).toBe('4/30');
    expect(body.detectedWindow?.startAt).toBe(eventStartAt);
    expect(body.detectedWindow?.endAt).toBe(eventEndAt);
    expect(body.detectedWindow?.startActionAt).toBe(startActionAt);
    expect(body.detectedWindow?.restoreActionAt).toBe(eventEndAt);

    const repo = new ActionRepository(db);
    const delegated = repo
      .list({
        sourceKind: 'message_rule',
        sourceRefId: 'manual:event-leave-rule',
        limit: 10,
      })
      .items.filter((item) => item.actionType === 'delegate_openclaw');

    expect(delegated).toHaveLength(2);
    expect(delegated[0].scheduledAt).toBe(Math.floor(startActionAt / 1000));
    expect(delegated[1].scheduledAt).toBe(Math.floor(eventEndAt / 1000));
  });

  it('uses the provided message timezone when only naive text timestamps are available', async () => {
    const eventStartAt = Date.parse('2099-04-30T02:00:19.000Z');
    const eventEndAt = Date.parse('2099-04-30T02:05:19.000Z');
    const startActionAt = Date.parse('2099-04-29T23:00:19.000Z');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload: {
        ruleRef: 'manual:timezone-fallback-leave-rule',
        automationPrompt:
          '从消息提取请假日期，请假前 3 小时修改 Glip 状态为 PTO，结束后恢复原本状态。',
        message: {
          postId: 'post-timezone-leave-1',
          sender: 'AI Service',
          groupId: 'sync-service',
          groupName: 'esone.qiu+sync.service',
          content:
            "[Event] Esone's PTO Date and time: 2099-04-30 10:00:19 - 2099-04-30 10:05:19",
          timestamp: Date.parse('2099-04-29T00:00:00.000Z'),
          timezone: 'Asia/Shanghai',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.skippedReason).toBeUndefined();
    expect(body.detectedWindow?.label).toBe('4/30');
    expect(body.detectedWindow?.startAt).toBe(eventStartAt);
    expect(body.detectedWindow?.endAt).toBe(eventEndAt);
    expect(body.detectedWindow?.startActionAt).toBe(startActionAt);
    expect(body.detectedWindow?.restoreActionAt).toBe(eventEndAt);
  });

  it('previews automation actions and prompt improvement without writing actions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/preview',
      payload: {
        ruleRef: 'manual:preview-leave-rule',
        ruleText: "发送了内容与以下语义相似：Esone's PTO",
        automationPrompt:
          '检测到请假消息后，开始前 3 小时修改 Glip 状态为 PTO，结束后改回 Available。',
        message: {
          postId: 'post-preview-leave-1',
          sender: 'AI Service',
          groupName: 'Leave Chat',
          content:
            "[Event] Esone's PTO Date and time: 2099-04-30 10:00:19 - 2099-04-30 10:05:19",
          timestamp: Date.parse('2099-04-29T00:00:00.000Z'),
          timezone: 'Asia/Shanghai',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.canPlan).toBe(true);
    expect(body.actions).toHaveLength(3);
    expect(body.detectedWindow?.label).toBe('4/30');
    expect(
      body.warnings.some(
        (warning: { code: string }) =>
          warning.code === 'missing_presence_snapshot',
      ),
    ).toBe(true);
    expect(body.suggestedPrompt).toContain('RingCentral token/API');
    expect(body.suggestedPrompt).toContain('不要猜测 Available');

    const repo = new ActionRepository(db);
    const queued = repo.list({
      sourceKind: 'message_rule',
      sourceRefId: 'manual:preview-leave-rule',
      limit: 10,
    }).items;
    expect(queued).toHaveLength(0);
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

  it('delegates unclassified linked-action prompts to OpenClaw with attachment context', async () => {
    const automationPrompt =
      '把这个视频下载下来并上传到 https://drive.google.com/drive/u/1/folders/1PLSseleeEXedYDvbNT8ph48wVONupLhd Drive 目录中，且文件名加上后缀 " - YYYYMMDD"时间后缀，最后把 drive 视频 link 用单独发送消息给我。';
    const messageUrl =
      'https://app.ringcentral.com/messages/160443817990/80220230991876';
    const message = {
      postId: '80220230991876',
      groupId: '160443817990',
      groupName: '🍸 Nova CA - Brandy',
      sender: 'Rondo Yang',
      content:
        '这个是LLM只返回意图，然后在NECA这边转成WhatsApp格式发出去，不在skill那边添加模板\n[Attachment 1] Video: az_recorder_20260527_092549.mp4 (type=mp4, 13.4 MB, link=https://app.ringcentral.com/messages/160443817990/80220230991876)',
      messageUrl,
      attachments: [
        {
          id: 4103941627914,
          name: 'az_recorder_20260527_092549.mp4',
          type: 'mp4',
          category: 'video',
          size: 14033215,
          sourceUrl: messageUrl,
          messageUrl,
        },
      ],
    };
    const preview = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/preview',
      payload: {
        ruleRef: 'manual:video-rule',
        automationPrompt,
        message,
      },
    });

    expect(preview.statusCode).toBe(200);
    const previewBody = preview.json();
    expect(previewBody.canPlan).toBe(true);
    expect(previewBody.actionFamily).toBe('openclaw_delegation');
    expect(
      previewBody.warnings.some(
        (warning: { code: string }) =>
          warning.code === 'delegated_to_openclaw_black_box',
      ),
    ).toBe(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/message-rules/plan',
      payload: {
        ruleRef: 'manual:video-rule',
        automationPrompt,
        message,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.deduped).toBe(false);
    expect(body.skippedReason).toBeUndefined();
    expect(body.actions).toHaveLength(2);

    const repo = new ActionRepository(db);
    const delegated = repo
      .list({
        sourceKind: 'message_rule',
        sourceRefId: 'manual:video-rule',
        limit: 10,
      })
      .items.find((item) => item.actionType === 'delegate_openclaw');

    expect(delegated).toBeTruthy();
    expect(delegated?.params.targetSystem).toBe('google_drive');
    const task = String(delegated?.params.task ?? '');
    expect(task).toContain(
      'https://drive.google.com/drive/u/1/folders/1PLSseleeEXedYDvbNT8ph48wVONupLhd',
    );
    expect(task).toContain('az_recorder_20260527_092549.mp4');
    expect(task).toContain(messageUrl);
    const metadata =
      delegated &&
      delegated.params &&
      typeof delegated.params === 'object' &&
      'metadata' in delegated.params &&
      delegated.params.metadata &&
      typeof delegated.params.metadata === 'object'
        ? (delegated.params.metadata as Record<string, unknown>)
        : {};
    expect(metadata.actionFamily).toBe('openclaw_delegation');
    expect(
      Array.isArray(metadata.messageAttachments)
        ? metadata.messageAttachments
        : [],
    ).toHaveLength(1);
  });
});
