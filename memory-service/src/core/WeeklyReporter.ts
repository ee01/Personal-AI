/**
 * WeeklyReporter — generates a weekly summary report from recent messages
 * and reflections, persists it as Markdown, and optionally pushes via Bot.
 */

import type Database from 'better-sqlite3';
import { getLLMClient } from '../llm/LLMClient.js';
import type { UiLanguage } from '../i18n.js';
import {
  outputLanguageLabel,
  resolveOutputLanguage,
} from '../utils/outputLanguage.js';
import { now, formatDate } from '../utils/time.js';
import { MarkdownManager } from './MarkdownManager.js';
import type { UserDataManager } from '../storage/UserDataManager.js';
import { randomUUID } from 'node:crypto';
import {
  getUserRuntimeConfig,
  type RuntimePushTarget,
} from '../runtimeConfig.js';
import { NotificationCenterService } from './NotificationCenterService.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyReportResult {
  generated: boolean;
  reportPath?: string;
  messageCount: number;
  reflectionCount: number;
  notificationCreated?: boolean;
  botSent?: boolean;
  botError?: string;
  pushTarget?: RuntimePushTarget;
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

function normalizePushTarget(
  value: unknown,
  fallback: RuntimePushTarget,
): RuntimePushTarget {
  if (value === 'group' || value === 'team') return 'group';
  if (value === 'me' || value === 'user') return 'me';
  if (value === 'none') return 'none';
  return fallback;
}

function weeklyReportCopy(
  language: UiLanguage,
  dateStr: string,
  msgCount: number,
  reflectionCount: number,
) {
  const english = language === 'en-US';
  const languageName = outputLanguageLabel(language);
  return {
    documentTitle: english ? `# Weekly Report — ${dateStr}` : `# 周报 — ${dateStr}`,
    notificationTitle: english ? 'Weekly Report Ready' : '周报已生成',
    notificationBody: english
      ? `Your weekly report for ${dateStr} is ready`
      : `你的 ${dateStr} 周报已经准备好`,
    glipTitle: english ? 'Weekly Report' : '周报',
    languageName,
    sectionInstructions: english
      ? `1. **Highlights** — Top 3-5 achievements or events
2. **Key Discussions** — Important conversations and decisions
3. **Insights** — Patterns or learnings observed
4. **Action Items** — Recommended next steps
5. **Statistics** — Message count: ${msgCount}, Reflections: ${reflectionCount}`
      : `1. **要点** — 本周 3-5 件最重要的成果或事件
2. **关键讨论** — 重要对话与决定
3. **洞察** — 观察到的模式或学习
4. **待办** — 建议的下一步
5. **统计** — 消息数：${msgCount}，反思数：${reflectionCount}`,
  };
}

function compactReportText(raw: string, maxLength: number): string {
  const compacted = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^[-*]\s+/gm, '- ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
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
    pushTarget?: RuntimePushTarget;
    pushGroupId?: string;
  }): Promise<WeeklyReportResult> {
    const config = getUserRuntimeConfig(this.userDataManager);
    const pushTarget = normalizePushTarget(
      options?.pushTarget,
      config.weeklyReportPushTarget,
    );
    const pushGroupId = (
      options?.pushGroupId ?? config.weeklyReportPushGroupId
    ).trim();
    if (!options?.ignoreEnabled && !config.weeklyReportEnabled) {
      return {
        generated: false,
        messageCount: 0,
        reflectionCount: 0,
        notificationCreated: false,
        botSent: false,
        pushTarget,
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
        notificationCreated: false,
        botSent: false,
        pushTarget,
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
        notificationCreated: false,
        botSent: false,
        pushTarget,
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

    // 4. Generate via LLM in the user's profile language
    const outputLanguage = resolveOutputLanguage(this.db);
    const copy = weeklyReportCopy(
      outputLanguage,
      dateStr,
      msgCount,
      reflections.length,
    );
    const prompt = `Generate a concise weekly report in Markdown based on the following data.

## Daily Reflections (past 7 days):
${reflections.length > 0 ? reflections.map(r => r.slice(0, 500)).join('\n---\n') : 'No reflections available.'}

## Key Message Summaries (${msgCount} total messages):
${messageSummaries || 'No summaries available.'}

Write a weekly report with these sections:
${copy.sectionInstructions}

Keep it concise (under 500 words). Write the entire report in ${copy.languageName}. Use the section titles above exactly. Keep person names, product names, group names, URLs, IDs, Jira keys, numbers, and quoted source terms in their original language. Do not switch to the language of the source content.`;

    const llm = getLLMClient();
    const response = await llm.generate(prompt, { maxTokens: 1500, temperature: 0.4 });
    const reportText = response.content;
    const reportSummary = compactReportText(reportText, 240);
    const reportExcerpt = compactReportText(reportText, 900);

    const reportContent = `${copy.documentTitle}\n\n${reportText}`;

    // 5. Write report file
    const reportPath = options?.manual
      ? `reports/weekly-manual-${dateStr}.md`
      : `reports/weekly-${dateStr}.md`;
    udm.writeFile(reportPath, reportContent);
    await this.markdownManager?.reindexFile(reportPath);

    let notificationCreated = false;
    let botSent = false;
    let botError: string | undefined;
    if (pushTarget !== 'none') {
      // 6. Insert notification
      const notificationId = randomUUID();
      this.db.prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, payload_json, topic_id, sent_at, created_at)
         VALUES (?, 'chrome_notification', 'weekly_report', ?, ?, ?, ?, ?, ?)`
      ).run(
        notificationId,
        copy.notificationTitle,
        copy.notificationBody,
        JSON.stringify({
          reportPath,
          messageCount: msgCount,
          reflectionCount: reflections.length,
          reportSummary,
          reportExcerpt,
        }),
        `weekly_report_${dateStr}`,
        currentTime, currentTime,
      );
      notificationCreated = true;

      const botResult = await this.notificationCenterService.deliverNoticeToGlip({
        sourceRef: `notification:${notificationId}`,
        title: copy.glipTitle,
        body: reportText,
        mention: false,
        targetUserId: pushTarget === 'me' ? this.userId : undefined,
        targetGroupId: pushTarget === 'group' ? pushGroupId : undefined,
      });
      if (botResult.sent) {
        botSent = true;
      }

      if (!botResult.sent && botResult.error) {
        console.warn(`[WeeklyReporter] Weekly report bot delivery skipped: ${botResult.error}`);
      }
      botError = !botResult.sent && botResult.error ? botResult.error : undefined;
    }

    console.log(`[WeeklyReporter] Report generated: ${reportPath}`);
    return {
      generated: true,
      reportPath,
      messageCount: msgCount,
      reflectionCount: reflections.length,
      notificationCreated,
      botSent,
      botError,
      pushTarget,
    };
  }
}
