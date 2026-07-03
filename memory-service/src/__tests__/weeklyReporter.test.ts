import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../server.js';
import { NotificationCenterService } from '../core/NotificationCenterService.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { WeeklyReporter } from '../core/WeeklyReporter.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { getTestDb } from './setup.js';

vi.mock('../llm/LLMClient.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../llm/LLMClient.js')>();
  return {
    ...actual,
    getLLMClient: () => ({
      generate: vi.fn(async () => ({
        content:
          '## Highlights\n- Project launch is on track.\n\n## Action Items\n- Review rollout notes.',
      })),
    }),
  };
});

describe('WeeklyReporter push targets', () => {
  const db = getTestDb();
  let tempDir = '';
  let userDataManager: UserDataManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-reporter-'));
    userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        weeklyReportEnabled: true,
        weeklyReportPushTarget: 'me',
        weeklyReportMinMessages: 1,
      }),
    );
    db.prepare('DELETE FROM messages_raw').run();
    db.prepare('DELETE FROM notification_records').run();
    db.prepare('DELETE FROM channel_delivery_records').run();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      `INSERT INTO messages_raw
        (id, content, summary, source_type, sender, group_name, timestamp, importance, created_at)
       VALUES (?, ?, ?, 'glip', ?, ?, ?, ?, ?)`,
    ).run(
      'weekly-message-1',
      'Project launch status is on track.',
      'Project launch is on track.',
      'Eve',
      'Launch Room',
      now,
      0.9,
      now,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates a manual report without notification or Bot delivery when push target is none', async () => {
    const glipSpy = vi.spyOn(
      NotificationCenterService.prototype,
      'deliverNoticeToGlip',
    );

    const reporter = new WeeklyReporter(db, userDataManager, 'esone.qiu');
    const result = await reporter.generateWeeklyReport({
      ignoreEnabled: true,
      ignoreMinMessages: true,
      manual: true,
      pushTarget: 'none',
    });

    expect(result).toMatchObject({
      generated: true,
      notificationCreated: false,
      botSent: false,
      pushTarget: 'none',
    });
    expect(result.reportPath).toMatch(/^reports\/weekly-manual-/);
    expect(glipSpy).not.toHaveBeenCalled();
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_records WHERE type = 'weekly_report'")
      .get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('routes manual weekly report Bot delivery to the selected group', async () => {
    const glipSpy = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true, messageId: 'weekly-group-message-1' });

    const reporter = new WeeklyReporter(db, userDataManager, 'esone.qiu');
    const result = await reporter.generateWeeklyReport({
      ignoreEnabled: true,
      ignoreMinMessages: true,
      manual: true,
      pushTarget: 'group',
      pushGroupId: 'team-456',
    });

    expect(result).toMatchObject({
      generated: true,
      notificationCreated: true,
      botSent: true,
      pushTarget: 'group',
    });
    expect(glipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: undefined,
        targetGroupId: 'team-456',
      }),
    );
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_records WHERE type = 'weekly_report'")
      .get() as { cnt: number };
    expect(row.cnt).toBe(1);
    const notification = db
      .prepare(
        "SELECT payload_json FROM notification_records WHERE type = 'weekly_report' LIMIT 1",
      )
      .get() as { payload_json: string };
    const payload = JSON.parse(notification.payload_json) as {
      reportSummary?: string;
      reportExcerpt?: string;
      messageCount?: number;
      reflectionCount?: number;
    };
    expect(payload.messageCount).toBe(1);
    expect(payload.reflectionCount).toBe(0);
    expect(payload.reportSummary).toContain('Project launch is on track');
    expect(payload.reportExcerpt).toContain('Review rollout notes');
  });

  it('returns Bot delivery failure reason while preserving the weekly notice', async () => {
    vi.spyOn(
      NotificationCenterService.prototype,
      'deliverNoticeToGlip',
    ).mockResolvedValue({ sent: false, error: 'bot_not_configured' });

    const reporter = new WeeklyReporter(db, userDataManager, 'esone.qiu');
    const result = await reporter.generateWeeklyReport({
      ignoreEnabled: true,
      ignoreMinMessages: true,
      manual: true,
      pushTarget: 'me',
    });

    expect(result).toMatchObject({
      generated: true,
      notificationCreated: true,
      botSent: false,
      botError: 'bot_not_configured',
      pushTarget: 'me',
    });
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_records WHERE type = 'weekly_report'")
      .get() as { cnt: number };
    expect(row.cnt).toBe(1);
  });
});

describe('weekly and dream digest push-now routes', () => {
  const userId = 'digest-route-user';
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir = '';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-routes-'));
    userContextManager = new UserContextManager(tempDir);
    const result = await buildApp({ userContextManager });
    app = result.app;
    await app.ready();

    const context = userContextManager.getContext(userId);
    context.db.prepare('DELETE FROM messages_raw').run();
    context.db.prepare('DELETE FROM notification_records').run();
    context.db.prepare('DELETE FROM channel_delivery_records').run();
    const now = Math.floor(Date.now() / 1000);
    context.db
      .prepare(
        `INSERT INTO messages_raw
          (id, content, summary, source_type, sender, group_name, timestamp, importance, created_at)
         VALUES (?, ?, ?, 'glip', ?, ?, ?, ?, ?)`,
      )
      .run(
        'route-weekly-message-1',
        'Route-level weekly report input.',
        'Route-level weekly report input.',
        'Eve',
        'Digest Room',
        now,
        0.9,
        now,
      );
    context.userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        dreamDigestEnabled: true,
        dreamDigestScheduleType: 'weekly',
        dreamDigestPushTarget: 'me',
        weeklyReportEnabled: true,
        weeklyReportPushTarget: 'me',
        weeklyReportMinMessages: 1,
      }),
    );
    const today = new Date().toISOString().slice(0, 10);
    context.userDataManager.writeFile(
      `dreams/current-launch-${today}.md`,
      `# Dream: Route Current Launch

_Generated: ${today}_

## Narrative
Route Current Launch narrative.

## Insights
- Route Current Launch insight.
`,
    );
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (userContextManager) {
      userContextManager.closeAll();
    }
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('passes push target none from weekly-report push-now into the reporter', async () => {
    const glipSpy = vi.spyOn(
      NotificationCenterService.prototype,
      'deliverNoticeToGlip',
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/weekly-report/push-now',
      headers: { 'x-user-id': userId },
      payload: {
        force: true,
        weeklyReportPushTarget: 'none',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      generated: true,
      notificationCreated: false,
      botSent: false,
      pushTarget: 'none',
    });
    expect(glipSpy).not.toHaveBeenCalled();
    const context = userContextManager.getContext(userId);
    const row = context.db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_records WHERE type = 'weekly_report'")
      .get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('passes group target from dream-digest push-now into Bot delivery', async () => {
    const glipSpy = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true, messageId: 'dream-route-group-message' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/dream-digest/push-now',
      headers: { 'x-user-id': userId },
      payload: {
        force: true,
        dreamDigestPushTarget: 'group',
        dreamDigestPushGroupId: 'team-route-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      generated: true,
      delivered: true,
      botSent: true,
      notificationCreated: true,
      dreamCount: 1,
      latestDreamPath: expect.stringMatching(/^dreams\/current-launch-/),
      pushTarget: 'group',
    });
    expect(glipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: undefined,
        targetGroupId: 'team-route-1',
      }),
    );
  });
});
