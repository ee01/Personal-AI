import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'memory-entry-extension-'),
  );
  const extensionPath = path.join(repoRoot, 'dist');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', {
      timeout: 15000,
    });
  }
  const extensionId = new URL(serviceWorker.url()).host;
  return { context, extensionId };
}

function jsonResponse(body) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function main() {
  const { context, extensionId } = await launchExtensionContext();

  try {
    await context.route('**/outreach/templates/runtime-status**', async (route) => {
      await route.fulfill(
        jsonResponse({
          items: [
            {
              template: {
                id: 'template-before-dispatch',
                title: 'Release risk check',
                questionTemplate: 'release 风险现在已经有答案了吗？',
                contextTemplate: '如果已有结论就不要重复打扰。',
                targetType: 'group',
                targetRef: 'ops-room',
                enabled: true,
                syncState: 'synced',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              latestSession: null,
            },
            {
              template: {
                id: 'template-waiting-reply',
                title: 'Migration guide check',
                questionTemplate: 'migration guide 发布了吗？',
                targetType: 'group',
                targetRef: 'sdk-updates',
                enabled: true,
                syncState: 'synced',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              latestSession: {
                id: 'session-waiting-reply',
                targetType: 'group',
                targetRef: 'sdk-updates',
                targetResolvedLabel: 'SDK Updates',
                targetResolvedChatId: 'sdk-updates',
                renderedQuestion: 'migration guide 发布了吗？',
                renderedContext: '如果有的话请给链接。',
                status: 'waiting_reply',
                requiresApproval: false,
                followupCount: 0,
                maxFollowup: 2,
                sentChatId: 'sdk-updates',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            },
          ],
          total: 2,
        }),
      );
    });

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: 'load',
      timeout: 15000,
    });
    await popupPage.waitForFunction(
      () => document.body.innerText.includes('管理记忆入口'),
      { timeout: 15000 },
    );
    const popupText = await popupPage.locator('body').innerText();
    assert.match(popupText, /管理记忆入口/);
    const existingPages = new Set(context.pages());
    await popupPage.getByRole('button', { name: /管理记忆入口/ }).click();
    await popupPage.waitForTimeout(1000);
    const popupChild = context
      .pages()
      .find(
        (page) =>
          !existingPages.has(page) && page.url().includes('topic-modal.html'),
      );
    assert.ok(popupChild, 'popup entry should open topic modal window');
    await popupChild.waitForFunction(
      () => document.body.innerText.includes('记忆入口规则'),
      { timeout: 15000 },
    );
    await popupChild.close();
    await popupPage.close();

    const topicPage = await context.newPage();
    await topicPage.goto(`chrome-extension://${extensionId}/topic-modal.html`, {
      waitUntil: 'load',
      timeout: 15000,
    });
    await topicPage.waitForFunction(
      () => document.body.innerText.includes('记忆入口规则'),
      { timeout: 15000 },
    );
    await topicPage.evaluate(async () => {
      await chrome.storage.local.set({
        taskSchedulerStates: {
          message_analysis: { enabled: false },
        },
      });
    });
    await topicPage.reload({ waitUntil: 'load', timeout: 15000 });
    await topicPage.waitForFunction(
      () => document.body.innerText.includes('记忆入口规则'),
      { timeout: 15000 },
    );
    await topicPage.waitForFunction(
      () => document.body.innerText.includes('2 条内部观察正在运行'),
      { timeout: 15000 },
    );
    const topicText = await topicPage.locator('body').innerText();
    assert.match(topicText, /记忆入口规则/);
    assert.match(topicText, /只显示你定义的记忆入口规则/);
    assert.match(topicText, /2 条内部观察正在运行/);
    assert.match(topicText, /等待回复 1/);
    assert.match(topicText, /待发观察 1/);
    assert.match(topicText, /发送前观察/);
    assert.match(topicText, /migration guide 发布了吗？/);
    assert.match(topicText, /查看主动询问证据/);
    assert.match(topicText, /我的规则/);
    assert.match(topicText, /内部观察规则/);
    assert.match(
      topicText,
      /需要开启后台记忆采集后，才会自动捕获新消息并触发写入记忆/,
      'disabled message analysis warning should cover plain memory-entry rules',
    );
    const [outreachEvidencePage] = await Promise.all([
      topicPage.waitForEvent('popup'),
      topicPage.getByRole('button', { name: '查看主动询问证据' }).click(),
    ]);
    await outreachEvidencePage.waitForURL(/memory-exploring\.html#\/outreach/, {
      timeout: 5000,
    });
    await outreachEvidencePage.close();

    await topicPage.evaluate(async () => {
      await chrome.storage.local.set({
        concernedItems: [
          {
            id: 'manual-follow-1',
            text: 'Standup 中有人提到 blocker',
            expiredAt: Date.now() + 24 * 60 * 60 * 1000,
            notifyMethod: 'bot',
            followThread: true,
            followConfig: {
              originalMessage: {
                postId: 'post-1',
                teamId: 'team-1',
                teamName: 'Team Standup',
                sender: 'Alice',
                content: 'Build pipeline blocked',
                datetime: new Date().toISOString(),
                messageUrl: 'https://example.com/post-1',
              },
              createdAt: new Date().toISOString(),
              relatedMessages: [
                {
                  postId: 'reply-1',
                  sender: 'Bob',
                  datetime: new Date().toISOString(),
                  relationType: 'thread_reply',
                  summary: 'Bob 补充了 blocker 细节',
                },
              ],
            },
          },
          {
            id: 'manual-automation-1',
            text: 'Leave Chat 中出现与我相关的请假消息',
            expiredAt: 0,
            notifyMethod: 'bot',
            filterGroup: 'Leave Chat, SDK Updates',
            filterSender: 'Alice; Morgan Lee',
            digestConfig: {
              enabled: true,
              frequency: 'daily',
              preferredHour: 9,
            },
            automationPrompt:
              '提取请假开始和结束日期，并在开始前 3 小时更新我的 Glip 状态。',
          },
          {
            id: 'outreach:session-seeded',
            source: 'outreach',
            text: 'legacy internal rule that should not show up',
            expiredAt: 0,
          },
        ],
      });
    });

    await topicPage.reload({ waitUntil: 'load', timeout: 15000 });
    await topicPage.waitForFunction(
      () =>
        document.body.innerText.includes('联动操作') ||
        document.body.innerText.includes('RuntimeAction'),
      { timeout: 15000 },
    );
    const topicReloadedText = await topicPage.locator('body').innerText();
    assert.match(topicReloadedText, /待激活|OpenClaw/);
    assert.doesNotMatch(topicReloadedText, /legacy internal rule/);
    const automationRuleCard = topicPage.locator('.topic-item', {
      hasText: 'Leave Chat 中出现与我相关的请假消息',
    });
    const automationRuleText = await automationRuleCard.innerText();
    assert.match(
      automationRuleText,
      /每日 9:00 摘要（不即时推送）/,
      'digest-enabled rules should explain that digest replaces immediate push',
    );
    assert.match(
      automationRuleText,
      /Leave Chat 或 SDK Updates/,
      'multi-group scope should be presented as an OR condition',
    );
    assert.match(
      automationRuleText,
      /Alice 或 Morgan Lee/,
      'multi-sender scope should be presented as an OR condition',
    );
    assert.match(
      automationRuleText,
      /任一候选命中即可触发/,
      'multi-scope guidance should explain OR matching',
    );
    assert.doesNotMatch(
      automationRuleText,
      /Glip 推送|Chrome 通知/,
      'digest-enabled rule cards must not promise suppressed immediate notifications',
    );

    await topicPage.getByRole('button', { name: '＋ 添加规则' }).click();
    await topicPage.waitForFunction(
      () =>
        document.body.innerText.includes('新建记忆入口规则') &&
        document.body.innerText.includes('写入记忆'),
      { timeout: 15000 },
    );
    const newRuleInput = topicPage.getByPlaceholder(
      '例如：Standup 里有人提到 blocker；或 Leave Chat 里出现与我相关的请假消息',
    );
    await newRuleInput.fill('QA seeded rule for automation flow');
    assert.equal(
      await newRuleInput.inputValue(),
      'QA seeded rule for automation flow',
    );
    await topicPage.waitForFunction(
      () =>
        document.body.innerText.includes('所有群组 / 所有发送人'),
      { timeout: 15000 },
    );
    let enablePromptText = '';
    topicPage.once('dialog', async (dialog) => {
      enablePromptText = dialog.message();
      await dialog.accept();
    });
    await topicPage.getByRole('button', { name: '确认' }).click();
    await topicPage.waitForFunction(
      () =>
        document.body.innerText.includes('QA seeded rule for automation flow'),
      { timeout: 15000 },
    );
    assert.match(
      enablePromptText,
      /无法自动捕获新消息、写入记忆/,
      'saving a plain memory-entry rule should explain why background capture is required',
    );
    await topicPage.waitForFunction(
      () => document.body.innerText.includes('后台记忆采集运行中'),
      { timeout: 15000 },
    );

    const [download] = await Promise.all([
      topicPage.waitForEvent('download'),
      topicPage.getByRole('button', { name: '📤 导出规则' }).click(),
    ]);
    const exportPath = await download.path();
    assert.ok(exportPath, 'expected topic modal export download');
    const exportedXml = await fs.readFile(exportPath, 'utf8');
    assert.match(exportedXml, /<filterGroup>/);
    assert.match(exportedXml, /<followConfig>/);
    assert.match(exportedXml, /<digestConfig>/);
    assert.match(exportedXml, /<automationPrompt>/);

    const importXmlPath = path.join(
      os.tmpdir(),
      `memory-entry-import-${crypto.randomUUID()}.xml`,
    );
    await fs.writeFile(
      importXmlPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<topics>
  <topic>
    <id>manual-import-1</id>
    <text>Imported rule with follow thread</text>
    <expiredAt>0</expiredAt>
    <notifyMethod>bot</notifyMethod>
    <notifyFrequency>merged</notifyFrequency>
    <mentionMe>false</mentionMe>
    <filterSender>Alice</filterSender>
    <filterGroup>Imported Group</filterGroup>
    <automationPrompt>Import automation action</automationPrompt>
    <followThread>true</followThread>
    <followConfig>{&quot;originalMessage&quot;:{&quot;postId&quot;:&quot;post-import-1&quot;,&quot;teamId&quot;:&quot;team-import-1&quot;,&quot;teamName&quot;:&quot;Imported Group&quot;,&quot;sender&quot;:&quot;Alice&quot;,&quot;content&quot;:&quot;Imported origin&quot;,&quot;datetime&quot;:&quot;2026-04-15T00:00:00.000Z&quot;,&quot;messageUrl&quot;:&quot;https://example.com/imported&quot;},&quot;createdAt&quot;:&quot;2026-04-15T00:00:00.000Z&quot;,&quot;keywordFilter&quot;:[&quot;alpha&quot;],&quot;relatedMessages&quot;:[]}</followConfig>
    <digestConfig>{&quot;enabled&quot;:true,&quot;frequency&quot;:&quot;daily&quot;,&quot;preferredHour&quot;:9}</digestConfig>
    <autoReply>true</autoReply>
    <autoReplyConfig>{&quot;enabled&quot;:true,&quot;replyContent&quot;:&quot;Imported auto reply&quot;,&quot;useAIGenerate&quot;:false,&quot;reviewMode&quot;:&quot;manual&quot;}</autoReplyConfig>
  </topic>
</topics>`,
      'utf8',
    );
    await topicPage.locator('input[type="file"]').setInputFiles(importXmlPath);
    await topicPage.waitForFunction(
      () =>
        document.body.innerText.includes('Imported rule with follow thread'),
      { timeout: 15000 },
    );
    const importedTopicText = await topicPage.locator('body').innerText();
    assert.match(importedTopicText, /Imported rule with follow thread/);
    assert.match(importedTopicText, /Imported Group/);

    await topicPage.getByRole('button', { name: /编辑/ }).first().click();
    await topicPage.fill('input[id^="filter-group-"]', 'Edited Group');
    await topicPage.getByRole('button', { name: '保存' }).click();
    await topicPage.waitForFunction(
      () => document.body.innerText.includes('Edited Group'),
      { timeout: 15000 },
    );
    const storageAfterEdit = await topicPage.evaluate(async () => {
      const result = await chrome.storage.local.get('concernedItems');
      return result.concernedItems || [];
    });
    assert.ok(
      storageAfterEdit.some((item) => item.id === 'outreach:session-seeded'),
      'hidden system item should survive add/import/edit operations',
    );
    await topicPage.close();

    const followThreadsPage = await context.newPage();
    await followThreadsPage.goto(
      `chrome-extension://${extensionId}/memory-exploring.html#/follow-threads`,
      {
        waitUntil: 'load',
        timeout: 15000,
      },
    );
    await followThreadsPage.waitForFunction(
      () => document.body.innerText.includes('FollowThreads 只统计手动规则'),
      { timeout: 15000 },
    );
    const followThreadsText = await followThreadsPage
      .locator('body')
      .innerText();
    assert.match(followThreadsText, /手动规则 1/);
    assert.doesNotMatch(followThreadsText, /legacy internal rule/);
    await followThreadsPage.close();

    await context.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/runtime-config')) {
        await route.fulfill(
          jsonResponse({ outreachEnabled: true, openClawEnabled: false }),
        );
        return;
      }
      if (url.includes('/outreach/summary')) {
        await route.fulfill(
          jsonResponse({
            upcomingCount: 1,
            waitingReplyCount: 1,
            escalatedCount: 0,
            pendingApprovalCount: 1,
          }),
        );
        return;
      }
      if (url.includes('/outreach/templates/runtime-status')) {
        await route.fulfill(jsonResponse({ items: [], total: 0 }));
        return;
      }
      if (url.includes('/outreach/directory/status')) {
        await route.fulfill(jsonResponse({ items: [] }));
        return;
      }
      if (url.includes('/outreach/sessions/session-1')) {
        await route.fulfill(
          jsonResponse({
            id: 'session-1',
            targetType: 'group',
            targetRef: 'sdk-updates',
            renderedQuestion: 'migration guide 发布了吗？',
            renderedContext: '如果有的话请给链接。',
            status: 'waiting_reply',
            requiresApproval: false,
            followupCount: 0,
            maxFollowup: 2,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            replyRawText: 'migration guide draft is ready',
            replyPostId: 'reply-1',
            replySender: 'James Lee',
            outcome: {
              answerResolutionPhase: 'before_followup',
              hitSource: 'outreach:session-1',
              evidenceSummary: '在追问前已经命中答案线索',
              relatedMessage:
                'James 在 SDK-Updates 群提到 migration guide draft is ready',
              relatedMessageId: 'msg-42',
            },
            events: [
              {
                id: 'event-retry-1',
                sessionId: 'session-1',
                eventType: 'retried',
                createdAt: Math.floor(Date.now() / 1000),
                payload: {
                  previousStatus: 'no_reply',
                  nextStatus: 'waiting_reply',
                  nextCheckAt: Math.floor(Date.now() / 1000) + 60,
                },
              },
              {
                id: 'event-1',
                sessionId: 'session-1',
                eventType: 'reply_received',
                createdAt: Date.now(),
                payload: {
                  phase: 'before_followup',
                  hitSource: 'outreach:session-1',
                  relatedMessageId: 'msg-42',
                },
              },
            ],
            actions: [],
            evidence: [
              {
                sourceKind: 'outreach_reply',
                sourceId: 'reply-1',
                title: 'James Lee',
                content:
                  'James 在 SDK-Updates 群提到 migration guide draft is ready',
                metadata: {
                  answerResolutionPhase: 'before_followup',
                  hitSource: 'outreach:session-1',
                },
              },
            ],
          }),
        );
        return;
      }
      if (url.includes('/outreach/sessions')) {
        await route.fulfill(
          jsonResponse({
            items: [
              {
                id: 'session-before-dispatch',
                targetType: 'group',
                targetRef: 'ops-room',
                renderedQuestion: 'release 风险现在已经有答案了吗？',
                renderedContext: '如果有请直接给结论。',
                status: 'scheduled',
                requiresApproval: false,
                followupCount: 0,
                maxFollowup: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                outcome: {
                  answerResolutionPhase: 'before_dispatch',
                  hitSource: 'outreach:session-before-dispatch',
                  evidenceSummary: '发送前已命中现成答案',
                  relatedMessage: 'ops-room 已提前讨论 release 风险',
                  relatedMessageId: 'msg-before-dispatch',
                },
                evidence: [
                  {
                    sourceKind: 'external_evidence',
                    sourceId: 'evidence-before-dispatch',
                    title: 'ops-room',
                    content: 'ops-room 已提前讨论 release 风险',
                    metadata: {
                      answerResolutionPhase: 'before_dispatch',
                      hitSource: 'outreach:session-before-dispatch',
                    },
                  },
                ],
              },
              {
                id: 'session-1',
                targetType: 'group',
                targetRef: 'sdk-updates',
                renderedQuestion: 'migration guide 发布了吗？',
                renderedContext: '如果有的话请给链接。',
                status: 'waiting_reply',
                requiresApproval: false,
                followupCount: 0,
                maxFollowup: 2,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                outcome: {
                  answerResolutionPhase: 'before_followup',
                  hitSource: 'outreach:session-1',
                  evidenceSummary: '在追问前已经命中答案线索',
                  relatedMessage:
                    'James 在 SDK-Updates 群提到 migration guide draft is ready',
                  relatedMessageId: 'msg-42',
                },
                evidence: [
                  {
                    sourceKind: 'outreach_reply',
                    sourceId: 'reply-1',
                    title: 'James Lee',
                    content:
                      'James 在 SDK-Updates 群提到 migration guide draft is ready',
                    metadata: {
                      answerResolutionPhase: 'before_followup',
                      hitSource: 'outreach:session-1',
                    },
                  },
                ],
              },
              {
                id: 'session-direct-reply',
                targetType: 'group',
                targetRef: 'all-hands',
                renderedQuestion: '议题确认了吗？',
                renderedContext: '如果确认请给摘要。',
                status: 'resolved',
                requiresApproval: false,
                followupCount: 0,
                maxFollowup: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                replyRawText: '议题已确认：Q3 OKR review。',
                replyPostId: 'reply-direct',
                replySender: 'Sarah Wang',
                outcome: {
                  answerResolutionPhase: 'direct_reply',
                  hitSource: 'outreach:session-direct-reply',
                  evidenceSummary: '直接回复已给出答案',
                  relatedMessage: '议题已确认：Q3 OKR review。',
                  relatedMessageId: 'reply-direct',
                },
                evidence: [
                  {
                    sourceKind: 'outreach_reply',
                    sourceId: 'reply-direct',
                    title: 'Sarah Wang',
                    content: '议题已确认：Q3 OKR review。',
                    metadata: {
                      answerResolutionPhase: 'direct_reply',
                      hitSource: 'outreach:session-direct-reply',
                    },
                  },
                ],
              },
            ],
            total: 3,
            limit: 20,
            offset: 0,
          }),
        );
        return;
      }

      await route.fulfill(jsonResponse({ items: [], total: 0 }));
    });

    const outreachListPage = await context.newPage();
    await outreachListPage.goto(
      `chrome-extension://${extensionId}/memory-exploring.html#/outreach`,
      {
        waitUntil: 'load',
        timeout: 15000,
      },
    );
    await outreachListPage.waitForFunction(
      () => document.body.innerText.includes('证据状态'),
      { timeout: 15000 },
    );
    const outreachListText = await outreachListPage.locator('body').innerText();
    assert.match(outreachListText, /触发前命中答案/);
    assert.match(outreachListText, /追问前命中答案/);
    assert.match(outreachListText, /直接回复已解析/);
    await outreachListPage.close();

    const outreachDetailPage = await context.newPage();
    await outreachDetailPage.goto(
      `chrome-extension://${extensionId}/memory-exploring.html#/outreach/session-1`,
      {
        waitUntil: 'load',
        timeout: 15000,
      },
    );
    await outreachDetailPage.waitForFunction(
      () => document.body.innerText.includes('结构化证据明细'),
      { timeout: 15000 },
    );
    const outreachDetailText = await outreachDetailPage
      .locator('body')
      .innerText();
    assert.match(outreachDetailText, /命中阶段/);
    assert.match(outreachDetailText, /结构化证据明细/);
    assert.match(outreachDetailText, /msg-42/);
    assert.match(outreachDetailText, /已重试/);
    assert.match(outreachDetailText, /从「无回复」重置为「等待回复」/);
    await outreachDetailPage.close();
  } finally {
    await context.close();
  }
}

await main();
