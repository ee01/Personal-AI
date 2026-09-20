import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../server.js';
import { NotificationCenterService } from '../core/NotificationCenterService.js';
import { UserContextManager } from '../core/UserContextManager.js';
import { WeeklyReporter } from '../core/WeeklyReporter.js';
import { getLLMClient } from '../llm/LLMClient.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { resetConfigForTests } from '../config.js';
import { getTestDb } from './setup.js';

function lastWeeklyPrompt(): string {
  const generate = vi.mocked(getLLMClient().generate);
  const prompt = generate.mock.calls.at(-1)?.[0];
  expect(typeof prompt).toBe('string');
  return String(prompt);
}

function insertLanguagePreference(itemValue: string, id = 'weekly-lang'): void {
  const db = getTestDb();
  const timestamp = Math.floor(Date.now() / 1000);
  db.prepare("DELETE FROM user_profile_items WHERE item_key = 'language_preference'").run();
  db.prepare(
    `INSERT INTO user_profile_items
      (id, item_type, item_key, item_value, evidence_refs, source_kind,
       confidence, user_confirmed, status, salience_score, mention_count,
       last_seen, valid_from, valid_to, created_at, updated_at, fingerprint)
     VALUES
      (?, 'preference', 'language_preference',
       ?, '[]', 'explicit',
       1, 1, 'active', 1, 1, ?, NULL, NULL, ?, ?, ?)`,
  ).run(id, itemValue, timestamp, timestamp, timestamp, `${id}-fp`);
}

vi.mock('../llm/LLMClient.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../llm/LLMClient.js')>();
  const generate = vi.fn(async () => ({
    content:
      '## Highlights\n- Project launch is on track.\n\n## Action Items\n- Review rollout notes.',
  }));
  return {
    ...actual,
    getLLMClient: () => ({ generate }),
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
    db.prepare("DELETE FROM user_profile_items WHERE item_key = 'language_preference'").run();
    vi.mocked(getLLMClient().generate).mockClear();
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

  it('defaults to Chinese prompt, headings, and notice copy when language_preference is absent', async () => {
    const glipSpy = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true, messageId: 'weekly-zh-default' });

    const reporter = new WeeklyReporter(db, userDataManager, 'esone.qiu');
    const result = await reporter.generateWeeklyReport({
      ignoreEnabled: true,
      ignoreMinMessages: true,
      manual: true,
      pushTarget: 'me',
    });

    expect(result.generated).toBe(true);
    expect(lastWeeklyPrompt()).toContain('Write the entire report in Simplified Chinese');
    expect(lastWeeklyPrompt()).toContain('**要点**');
    expect(lastWeeklyPrompt()).not.toContain('same language as the source content');
    expect(userDataManager.readFile(result.reportPath || '')).toMatch(/^# 周报 — /);
    const notification = db
      .prepare(
        "SELECT title, body FROM notification_records WHERE type = 'weekly_report' LIMIT 1",
      )
      .get() as { title: string; body: string };
    expect(notification).toMatchObject({
      title: '周报已生成',
    });
    expect(notification.body).toContain('周报已经准备好');
    expect(glipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: '周报' }),
    );
  });

  it('writes English prompt, headings, and notice copy when language_preference is English', async () => {
    insertLanguagePreference(
      'Reply and generate user-facing content in English.',
    );
    const glipSpy = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true, messageId: 'weekly-en' });

    const reporter = new WeeklyReporter(db, userDataManager, 'esone.qiu');
    await reporter.generateWeeklyReport({
      ignoreEnabled: true,
      ignoreMinMessages: true,
      manual: true,
      pushTarget: 'me',
    });

    expect(lastWeeklyPrompt()).toContain('Write the entire report in English');
    expect(lastWeeklyPrompt()).toContain('**Highlights**');
    const notification = db
      .prepare(
        "SELECT title, body FROM notification_records WHERE type = 'weekly_report' LIMIT 1",
      )
      .get() as { title: string; body: string };
    expect(notification.title).toBe('Weekly Report Ready');
    expect(notification.body).toMatch(/Your weekly report for .+ is ready/);
    expect(glipSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Weekly Report' }),
    );
  });

  it('honors the canonical Chinese language_preference value', async () => {
    insertLanguagePreference('回复和生成面向用户的内容时使用中文');
    vi.spyOn(
      NotificationCenterService.prototype,
      'deliverNoticeToGlip',
    ).mockResolvedValue({ sent: true, messageId: 'weekly-zh-explicit' });

    const reporter = new WeeklyReporter(db, userDataManager, 'esone.qiu');
    const result = await reporter.generateWeeklyReport({
      ignoreEnabled: true,
      ignoreMinMessages: true,
      manual: true,
      pushTarget: 'none',
    });

    expect(lastWeeklyPrompt()).toContain('Write the entire report in Simplified Chinese');
    expect(userDataManager.readFile(result.reportPath || '')).toMatch(/^# 周报 — /);
  });
});

describe('weekly and dream digest push-now routes', () => {
  const userId = 'digest-route-user';
  let app: FastifyInstance;
  let userContextManager: UserContextManager;
  let tempDir = '';
  let prevApiKey: string | undefined;

  beforeEach(async () => {
    // These routes are hit with only `x-user-id`, no Authorization bearer —
    // that's the anonymous-identity path, which auth.ts intentionally
    // rejects (401) once a service key is configured. A real API_KEY in this
    // machine's memory-service/.env leaks in via config.ts's dotenv.config()
    // otherwise, so neutralize it the same way the other auth-sensitive
    // suites do (see api-agent-executors-probe.test.ts).
    prevApiKey = process.env.API_KEY;
    delete process.env.API_KEY;
    resetConfigForTests();
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
    if (prevApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = prevApiKey;
    resetConfigForTests();
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
