/**
 * WeeklyReporter — generates a weekly summary report from recent messages
 * and reflections, persists it as Markdown, and optionally pushes via Bot.
 */

import type Database from 'better-sqlite3';
import { getLLMClient } from '../llm/LLMClient.js';
import { now, formatDate } from '../utils/time.js';
import { MarkdownManager } from './MarkdownManager.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { randomUUID } from 'node:crypto';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { NotificationCenterService } from './NotificationCenterService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyReportResult {
  generated: boolean;
  reportPath?: string;
  messageCount: number;
  reflectionCount: number;
  botSent?: boolean;
  reason?: string;
}

interface CountRow { cnt: number; }
interface MessageSummaryRow {
  summary: string;
  sender: string | null;
  group_name: string | null;
  source_type: string;
  importance: number;
}

// ---------------------------------------------------------------------------
// WeeklyReporter
// ---------------------------------------------------------------------------

export class WeeklyReporter {
  private db: Database.Database;
  private userDataManager?: UserDataManager;
  private markdownManager?: MarkdownManager;
  private userId?: string;
  private notificationCenterService: NotificationCenterService;

  constructor(db: Database.Database, userDataManager?: UserDataManager, userId?: string) {
    this.db = db;
    this.userDataManager = userDataManager;
    this.markdownManager = userDataManager?.isInitialized
      ? new MarkdownManager(db, userDataManager.rootDir)
      : undefined;
    this.userId = userId;
    this.notificationCenterService = new NotificationCenterService(db);
  }

  async generateWeeklyReport(options?: {
    ignoreEnabled?: boolean;
    ignoreMinMessages?: boolean;
    manual?: boolean;
  }): Promise<WeeklyReportResult> {
    const config = getUserRuntimeConfig(this.userDataManager);
    if (!options?.ignoreEnabled && !config.weeklyReportEnabled) {
      return {
        generated: false,
        messageCount: 0,
        reflectionCount: 0,
        reason: 'Weekly report is disabled.',
      };
    }

    const currentTime = now();
    const sevenDaysAgo = currentTime - 7 * 86400;
    const dateStr = formatDate(currentTime);

    // 1. Count recent messages
    const msgCount = (this.db
      .prepare('SELECT COUNT(*) as cnt FROM messages_raw WHERE created_at > ?')
      .get(sevenDaysAgo) as CountRow).cnt;

    if (!options?.ignoreMinMessages && msgCount < config.weeklyReportMinMessages) {
      console.log(`[WeeklyReporter] Skipping — only ${msgCount} messages (min: ${config.weeklyReportMinMessages})`);
      return {
        generated: false,
        messageCount: msgCount,
        reflectionCount: 0,
        reason: `Only ${msgCount} messages found; minimum is ${config.weeklyReportMinMessages}.`,
      };
    }

    // 2. Read recent reflections
    const udm = this.userDataManager;
    if (!udm) {
      console.warn('[WeeklyReporter] UserDataManager not available');
      return {
        generated: false,
        messageCount: msgCount,
        reflectionCount: 0,
        reason: 'User data manager is not available.',
      };
    }

    const reflectionFiles = udm.listFiles('reflections');
    const reflections: string[] = [];
    for (const file of reflectionFiles || []) {
      if (!file.endsWith('.md')) continue;
      const content = udm.readFile(`reflections/${file}`);
      if (content) reflections.push(content);
    }

    // 3. Get message summaries
    const recentMessages = this.db
      .prepare(
        `SELECT summary, sender, group_name, source_type, importance
         FROM messages_raw
         WHERE created_at > ? AND summary IS NOT NULL
         ORDER BY importance DESC LIMIT 30`
      )
      .all(sevenDaysAgo) as MessageSummaryRow[];

    const messageSummaries = recentMessages
      .map(m => `- [${m.source_type}] ${m.sender || 'unknown'}: ${m.summary}`)
      .join('\n');

    // 4. Generate via LLM
    const prompt = `Generate a concise weekly report in Markdown based on the following data.

## Daily Reflections (past 7 days):
${reflections.length > 0 ? reflections.map(r => r.slice(0, 500)).join('\n---\n') : 'No reflections available.'}

## Key Message Summaries (${msgCount} total messages):
${messageSummaries || 'No summaries available.'}

Write a weekly report with these sections:
1. **Highlights** — Top 3-5 achievements or events
2. **Key Discussions** — Important conversations and decisions
3. **Insights** — Patterns or learnings observed
4. **Action Items** — Recommended next steps
5. **Statistics** — Message count: ${msgCount}, Reflections: ${reflections.length}

Keep it concise (under 500 words). Write in the same language as the source content.`;

    const llm = getLLMClient();
    const response = await llm.generate(prompt, { maxTokens: 1500, temperature: 0.4 });
    const reportText = response.content;

    const reportContent = `# Weekly Report — ${dateStr}\n\n${reportText}`;

    // 5. Write report file
    const reportPath = options?.manual
      ? `reports/weekly-manual-${dateStr}.md`
      : `reports/weekly-${dateStr}.md`;
    udm.writeFile(reportPath, reportContent);
    await this.markdownManager?.reindexFile(reportPath);

    // 6. Insert notification
    const notificationId = randomUUID();
    this.db.prepare(
      `INSERT INTO notification_records
        (id, channel, type, title, body, payload_json, topic_id, sent_at, created_at)
       VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?, ?, ?)`
    ).run(
      notificationId,
      'Weekly Report Ready',
      `Your weekly report for ${dateStr} is ready`,
      JSON.stringify({ reportPath, messageCount: msgCount }),
      `weekly_report_${dateStr}`,
      currentTime, currentTime,
    );

    let botSent = false;
    const botResult = await this.notificationCenterService.deliverNoticeToGlip({
      sourceRef: `notification:${notificationId}`,
      title: 'Weekly Report',
      body: reportText,
      mention: false,
      targetUserId: this.userId,
    });
    if (botResult.sent) {
      botSent = true;
    }

    if (!botResult.sent && botResult.error) {
      console.warn(`[WeeklyReporter] Weekly report bot delivery skipped: ${botResult.error}`);
    }

    console.log(`[WeeklyReporter] Report generated: ${reportPath}`);
    return {
      generated: true,
      reportPath,
      messageCount: msgCount,
      reflectionCount: reflections.length,
      botSent,
    };
  }
}
