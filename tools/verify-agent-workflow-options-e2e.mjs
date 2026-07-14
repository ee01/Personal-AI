import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const extensionPath = path.join(repoRoot, 'dist');

function jsonResponse(body) {
  return {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function buildOllamaResponse(prompt) {
  if (prompt.includes('<message_group')) {
    const lowConfidenceReview = prompt.includes(
      'not sure whether it requires action yet',
    );
    return {
      data: [
        {
          shouldNotify: true,
          shouldStore: true,
          matched_rule: '[RULE_REF:manual:manual-1]',
          matched_rule_refs: ['manual:manual-1'],
          matched_rule_ids: [],
          summary: lowConfidenceReview
            ? 'manual blocker watch rule matched with low confidence'
            : 'manual blocker watch rule matched',
          confidence: lowConfidenceReview ? 0.42 : 0.88,
        },
      ],
    };
  }

  if (prompt.includes('实体') || prompt.includes('提取')) {
    return {
      entities: {
        people: [{ name: 'Morgan Chen' }, { name: 'Avery Wong' }],
        projects: [{ name: 'API split' }],
        topics: ['blocker'],
        resources: [],
        webpages: [],
        jiraTickets: [],
        conversations: [],
      },
      metadata: {
        sentiment: 'neutral',
        priority: 'medium',
        category: [],
        tags: ['agent-workflow-e2e'],
      },
      actions: [],
    };
  }

  if (prompt.includes('分析以下人物之间可能的关系')) {
    return {
      relationships: [
        {
          source: 'Morgan Chen',
          target: 'Avery Wong',
          relationship: 'Escalation collaborators',
          confidence: 0.8,
        },
      ],
    };
  }

  if (prompt.includes('分析以下消息的重要性')) {
    return {
      isImportant: true,
      shouldStore: true,
      priority: 'high',
      reason: 'blocker message should be stored',
      tags: ['blocker'],
    };
  }

  if (prompt.includes('分析以下消息并提供回复建议')) {
    return {
      needsReply: false,
      replyText: '',
      priority: 'low',
      reason: 'no reply needed',
    };
  }

  return {};
}

async function installNetworkMocks(context) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    if (url.includes('/api/v1/recall')) {
      await route.fulfill(
        jsonResponse({
          items: [],
          totalFound: 0,
          queryTimeMs: 1,
          channels: [],
        }),
      );
      return;
    }

    if (url.includes('/api/v1/entities')) {
      await route.fulfill(
        jsonResponse({ items: [], total: 0, limit: 20, offset: 0 }),
      );
      return;
    }

    if (url.includes('/api/v1/outreach/templates/runtime-status')) {
      await route.fulfill(jsonResponse({ items: [], total: 0 }));
      return;
    }

    if (url.endsWith('/api/generate')) {
      const body = JSON.parse(request.postData() || '{}');
      const prompt = String(body.prompt || '');
      if (
        prompt.includes('force relevance failure') &&
        prompt.includes('分析以下消息的重要性')
      ) {
        await route.fulfill(
          {
            status: 500,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              error: 'forced relevance tool failure',
            }),
          },
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill(
        jsonResponse({
          response: JSON.stringify(
            buildOllamaResponse(prompt),
          ),
        }),
      );
      return;
    }

    await route.continue();
  });
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(errors, [], `Options page errors: ${errors.join('; ')}`);
  };
}

async function assertControlBoundary(locator, patterns) {
  const title = await locator.getAttribute('title');
  const ariaLabel = await locator.getAttribute('aria-label');
  for (const pattern of patterns) {
    assert.match(title || '', pattern);
    assert.match(ariaLabel || '', pattern);
  }
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'agent-workflow-options-browser-'),
  );
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    acceptDownloads: true,
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

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
  };
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;
  await installNetworkMocks(context);

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async writeText(text) {
          const delayMs = Number(window.__agentWorkflowClipboardDelayMs || 0);
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
          window.__agentWorkflowClipboardText = String(text || '');
        },
        async readText() {
          return window.__agentWorkflowClipboardText || '';
        },
      },
    });
  });
  const assertNoPageErrors = collectPageErrors(page);
  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        ANALYSIS_TYPE: 'agentWorkflow',
        LLM_TYPE: 'local',
        OLLAMA_BASE_URL: 'http://mock-ollama',
        OLLAMA_MODEL: 'mock-model',
        OLLAMA_QUERY_MODEL: 'mock-model',
        MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
      },
      userinfo: {
        fullName: 'Current User',
        username: 'current.user',
      },
      concernedItems: [
        {
          id: 'manual-1',
          text: 'Only notify me when blocker is mentioned',
          expiredAt: 0,
          notifyMethod: 'bot',
        },
      ],
      customAgents: [
        {
          id: 'legacyInvalidToolAgent',
          name: 'Legacy Invalid Tool Agent',
          description: 'Old custom agent with a removed tool',
          priority: 55,
          tools: ['removedWorkflowTool'],
        },
      ],
    });
  });

  await page.reload({ waitUntil: 'load' });
  await page.locator('#ANALYSIS_TYPE').waitFor({ timeout: 15000 });
  await page.locator('h2', { hasText: '标准Agent系统设置' }).waitFor({
    timeout: 15000,
  });
  await page.locator('h3', { hasText: '关注项测试' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.agent-workflow-source-receipt', { hasText: '内置样例范围' })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '运行前范围',
    })
    .waitFor({ timeout: 5000 });
  const runScopeReceiptText = await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '运行前范围',
    })
    .innerText();
  assert.match(runScopeReceiptText, /当前表单可直接测试/);
  assert.match(runScopeReceiptText, /本地门禁未建立/);
  assert.match(runScopeReceiptText, /还没有保存样例基线/);
  assert.match(runScopeReceiptText, /运行测试只重跑当前表单/);
  assert.match(runScopeReceiptText, /运行样例、回放测试、运行保存样例/);
  assert.match(runScopeReceiptText, /批量回归逐条重跑本地保存样例/);
  assert.match(runScopeReceiptText, /作为发布前证据/);
  assert.match(runScopeReceiptText, /不会写入 Memory Service/);
  assert.match(runScopeReceiptText, /不会发送通知/);
  assert.match(runScopeReceiptText, /不会执行规则自动化/);
  assert.match(runScopeReceiptText, /不会.*覆盖基线/);
  assert.match(runScopeReceiptText, /门禁未建立/);
  assert.match(runScopeReceiptText, /本地测试无外发/);
  const initialSourceReceiptText = (
    await page.locator('.agent-workflow-source-receipt').allInnerTexts()
  ).join('\n');
  assert.match(initialSourceReceiptText, /运行前范围/);
  assert.match(initialSourceReceiptText, /内置样例范围/);
  assert.match(initialSourceReceiptText, /预期观察：通知\/存储/);
  assert.match(initialSourceReceiptText, /不会写入 Memory Service/);
  assert.match(initialSourceReceiptText, /最近消息范围/);
  assert.match(initialSourceReceiptText, /本次刷新没有可回放的最近消息样本/);
  assert.match(initialSourceReceiptText, /Memory Service time 召回快照/);
  assert.match(initialSourceReceiptText, /不证明没有相关线上消息/);
  assert.match(initialSourceReceiptText, /不代表当前聊天页、所有群组或时间窗口已覆盖/);
  assert.match(initialSourceReceiptText, /不会标记原消息已读/);
  assert.match(initialSourceReceiptText, /不会覆盖保存基线/);
  assert.match(initialSourceReceiptText, /只读快照/);
  assert.match(initialSourceReceiptText, /保存样例范围/);
  assert.match(initialSourceReceiptText, /保存当前用例后/);
  assert.match(initialSourceReceiptText, /保存样例容量/);
  assert.match(initialSourceReceiptText, /保存样例 0\/12/);
  assert.match(initialSourceReceiptText, /还可新增 12 个新输入/);
  assert.match(initialSourceReceiptText, /回归样本构成/);
  assert.match(initialSourceReceiptText, /还没有保存样例/);
  assert.match(initialSourceReceiptText, /不读取 Memory Service/);
  assert.match(initialSourceReceiptText, /批量回归范围/);
  assert.match(initialSourceReceiptText, /暂无保存样例/);
  assert.match(initialSourceReceiptText, /不会读取 Memory Service/);
  await assertControlBoundary(
    page.locator('.agent-workflow-test-header button', {
      hasText: '运行测试',
    }),
    [/运行测试/, /只重跑当前表单/, /不会写入 Memory Service/],
  );
  await assertControlBoundary(
    page.locator('.agent-workflow-scenario-actions button', {
      hasText: '填入样例',
    }),
    [/填入样例/, /只把所选内置样例/, /不会运行 Agent Workflow/],
  );
  await assertControlBoundary(
    page.locator('.agent-workflow-replay-actions button', {
      hasText: /刷新|刷新中/,
    }),
    [/刷新.*消息|刷新中/, /Memory Service time/, /不会标记原消息已读/],
  );

  await page.locator('#workflowScenario').selectOption('low-confidence-review');
  await page
    .locator('.agent-workflow-scenario-actions button', {
      hasText: '运行样例',
    })
    .click();
  await page
    .locator('.agent-test-review-banner', {
      hasText: '通知复核候选',
    })
    .waitFor({ timeout: 15000 });
  const lowConfidenceReviewText = await page
    .locator('.agent-test-review-banner')
    .innerText();
  assert.match(lowConfidenceReviewText, /低置信度关注项命中待复核：42% < 70%/);
  assert.match(lowConfidenceReviewText, /规则：manual:manual-1/);
  assert.match(lowConfidenceReviewText, /置信度 42%/);
  assert.match(lowConfidenceReviewText, /真实复核入口尚未创建/);
  assert.match(lowConfidenceReviewText, /不会创建真实复核队列项/);
  assert.match(lowConfidenceReviewText, /不会写入 Memory Service/);
  assert.match(lowConfidenceReviewText, /不会发送通知/);
  assert.match(lowConfidenceReviewText, /不会执行规则自动化/);
  const lowConfidenceNextActionText = await page
    .locator('.agent-workflow-next-actions')
    .innerText();
  assert.match(lowConfidenceNextActionText, /确认本地复核候选/);
  assert.match(lowConfidenceNextActionText, /不会创建真实复核队列项/);
  const lowConfidenceOrchestrationText = await page
    .locator('.agent-workflow-orchestration')
    .innerText();
  assert.match(lowConfidenceOrchestrationText, /通知待复核（本地候选）/);
  assert.match(lowConfidenceOrchestrationText, /本地复核候选/);

  await page
    .locator('#workflowTestContent')
    .fill(
      'API split has a blocker; force relevance failure so diagnostics point to the failed tool.',
    );
  await page
    .locator('.agent-workflow-test-header button', { hasText: '运行测试' })
    .click();
  await page
    .locator('.agent-workflow-orchestration.blocked', {
      hasText: '编排未达门禁',
    })
    .waitFor({ timeout: 15000 });
  const toolFailureOrchestrationText = await page
    .locator('.agent-workflow-orchestration.blocked')
    .innerText();
  assert.match(toolFailureOrchestrationText, /失败 Agent 重要性判断Agent/);
  assert.match(
    toolFailureOrchestrationText,
    /工具错误 重要性判断Agent \/ 重要性判断工具/,
  );
  const toolFailureReadinessText = await page
    .locator('.agent-workflow-readiness')
    .innerText();
  assert.match(toolFailureReadinessText, /执行 Trace/);
  assert.match(toolFailureReadinessText, /重要性判断Agent/);

  await page.locator('#workflowScenario').selectOption('manual-watch-hit');
  await page
    .locator('.agent-workflow-scenario-actions button', {
      hasText: '填入样例',
    })
    .click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('#workflowTestContent')
        ?.value.includes('API split has a blocker'),
    null,
    { timeout: 15000 },
  );
  await page
    .locator('.agent-workflow-test-header button', { hasText: '运行测试' })
    .click();
  await page
    .locator('.agent-workflow-test-header button', { hasText: '测试中...' })
    .waitFor({ timeout: 5000 });
  const runningLocks = await page.evaluate(() => {
    const disabled = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && element.disabled);
    };
    const allDisabled = (selector) =>
      Array.from(document.querySelectorAll(selector)).every(
        (element) => element.disabled,
      );

    return {
      panelBusy:
        document
          .querySelector('.agent-workflow-test-panel')
          ?.getAttribute('aria-busy') === 'true',
      scenarioSelect: disabled('#workflowScenario'),
      scenarioButtons: allDisabled('.agent-workflow-scenario-actions button'),
      replaySelect: disabled('#workflowReplaySample'),
      replayButtons: allDisabled('.agent-workflow-replay-actions button'),
      savedSelect: disabled('#workflowSavedScenario'),
      savedButtons: allDisabled('.agent-workflow-saved-actions button'),
      sender: disabled('#workflowTestSender'),
      teamName: disabled('#workflowTestTeamName'),
      teamId: disabled('#workflowTestTeamId'),
      datetime: disabled('#workflowTestDatetime'),
      content: disabled('#workflowTestContent'),
    };
  });
  assert.deepEqual(runningLocks, {
    panelBusy: true,
    scenarioSelect: true,
    scenarioButtons: true,
    replaySelect: true,
    replayButtons: true,
    savedSelect: true,
    savedButtons: true,
    sender: true,
    teamName: true,
    teamId: true,
    datetime: true,
    content: true,
  });
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^关注项匹配$/ })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^存储决策$/ })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^通知决策$/ })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.agent-workflow-path-item strong', { hasText: /^执行链路$/ })
    .waitFor({ timeout: 15000 });

  const decisionPathText = await page
    .locator('.agent-workflow-path')
    .innerText();
  assert.match(decisionPathText, /manual:manual-1/);
  assert.match(decisionPathText, /置信度 88%/);
  assert.match(decisionPathText, /7 个 Agent \/ 9 个工具/);
  assert.match(decisionPathText, /跳过工具 1/);
  assert.match(decisionPathText, /占位工具 1/);
  await page
    .locator('.agent-workflow-orchestration.review', {
      hasText: '编排需复核',
    })
    .waitFor({ timeout: 15000 });
  const orchestrationReceiptText = await page
    .locator('.agent-workflow-orchestration')
    .innerText();
  assert.match(orchestrationReceiptText, /Agent 6\/7/);
  assert.match(orchestrationReceiptText, /工具 9\/9/);
  assert.match(orchestrationReceiptText, /跳过工具 1/);
  assert.match(orchestrationReceiptText, /占位工具 1/);
  assert.match(orchestrationReceiptText, /通知会在真实入口发送/);
  assert.match(orchestrationReceiptText, /不会写入 Memory Service/);
  assert.match(orchestrationReceiptText, /本地测试/);
  await page.locator('.agent-workflow-verdict').waitFor({ timeout: 15000 });
  const verdictText = await page.locator('.agent-workflow-verdict').innerText();
  assert.match(verdictText, /需要复核后再执行/);
  assert.match(verdictText, /执行 Trace/);
  assert.match(verdictText, /补齐被跳过工具/);
  await page
    .locator('.agent-workflow-structure', { hasText: '结构覆盖回执' })
    .waitFor({ timeout: 15000 });
  const structuralCoverageText = await page
    .locator('.agent-workflow-structure')
    .innerText();
  assert.match(structuralCoverageText, /结构覆盖 Agent 6\/7、工具 9\/9/);
  assert.match(structuralCoverageText, /跳过工具 1/);
  assert.match(structuralCoverageText, /占位工具 1/);
  await page
    .locator('.agent-workflow-readiness', { hasText: '运行就绪检查' })
    .waitFor({ timeout: 15000 });
  const readinessText = await page
    .locator('.agent-workflow-readiness')
    .innerText();
  assert.match(readinessText, /执行 Trace/);
  assert.match(readinessText, /有 1 个工具被跳过/);
  assert.match(readinessText, /有 1 个工具仍是占位结果/);
  assert.match(readinessText, /通知\/自动化/);
  assert.match(readinessText, /manual:manual-1/);
  assert.match(readinessText, /外部信息/);
  assert.match(readinessText, /Jira\/Wiki adapter/);
  await page
    .locator('.agent-workflow-next-actions', { hasText: '下一步' })
    .waitFor({ timeout: 15000 });
  const nextActionText = await page
    .locator('.agent-workflow-next-actions')
    .innerText();
  assert.match(nextActionText, /下一步动作边界/);
  assert.match(nextActionText, /本地排障指引/);
  assert.match(nextActionText, /不会自动重跑测试/);
  assert.match(nextActionText, /不会写入 Memory Service/);
  assert.match(nextActionText, /不会发送通知/);
  assert.match(nextActionText, /不会执行规则自动化/);
  assert.match(nextActionText, /不会覆盖基线/);
  assert.match(nextActionText, /补齐被跳过工具/);
  assert.match(nextActionText, /接入外部查询适配器/);
  assert.match(nextActionText, /确认记忆审计/);
  assert.match(nextActionText, /确认通知发送/);
  assert.match(nextActionText, /manual:manual-1/);
  const skippedToolAction = page.locator('.agent-workflow-next-action', {
    hasText: '补齐被跳过工具',
  });
  const skippedToolActionTitle = await skippedToolAction.getAttribute('title');
  const skippedToolActionLabel =
    await skippedToolAction.getAttribute('aria-label');
  assert.match(skippedToolActionTitle || '', /下一步动作 修复：补齐被跳过工具/);
  assert.match(skippedToolActionTitle || '', /检查自定义 Agent 配置/);
  assert.match(skippedToolActionTitle || '', /本地排障指引/);
  assert.match(skippedToolActionTitle || '', /不会自动重跑测试/);
  assert.match(skippedToolActionLabel || '', /下一步动作 修复：补齐被跳过工具/);
  assert.match(skippedToolActionLabel || '', /不会写入 Memory Service/);
  assert.match(skippedToolActionLabel || '', /不会执行规则自动化/);
  const runDiagnosticText = await page
    .locator('.agent-workflow-diagnostic-block.compact')
    .innerText();
  assert.match(runDiagnosticText, /外部查询仍是占位/);
  assert.match(runDiagnosticText, /外部信息获取Agent \/ 外部服务查询工具/);
  const storageReviewText = await page
    .locator('.agent-test-review-grid')
    .innerText();
  assert.match(storageReviewText, /Trace 状态\s*部分异常/);
  assert.match(storageReviewText, /异常\s*跳过工具 1/);
  assert.match(storageReviewText, /占位工具 1/);

  await page
    .locator('.agent-workflow-evidence-packet.review', {
      hasText: '单次运行证据包',
    })
    .waitFor({ timeout: 5000 });
  const evidencePacketText = await page
    .locator('.agent-workflow-evidence-packet.review')
    .innerText();
  assert.match(evidencePacketText, /当前结果/);
  assert.match(evidencePacketText, /单次调试证据/);
  assert.match(evidencePacketText, /未绑定保存样例基线/);
  assert.match(evidencePacketText, /结构覆盖 Agent 6\/7、工具 9\/9/);
  assert.match(evidencePacketText, /复制证据包/);
  assert.match(evidencePacketText, /不会写入 Memory Service/);
  assert.match(evidencePacketText, /不会发送通知/);
  assert.match(evidencePacketText, /不会执行规则自动化/);
  assert.match(evidencePacketText, /不会包含原始消息正文或工具参数/);
  const copyEvidenceButton = page.locator(
    '.agent-workflow-evidence-packet.review button',
    {
      hasText: '复制证据包',
    },
  );
  await assertControlBoundary(copyEvidenceButton, [
    /复制证据包/,
    /本机剪贴板/,
    /单次调试证据/,
    /不会写入 Memory Service/,
  ]);
  await page.evaluate(() => {
    window.__agentWorkflowClipboardDelayMs = 250;
  });
  await copyEvidenceButton.click();
  await page
    .locator('.agent-workflow-evidence-copy-receipt.pending', {
      hasText: '证据包复制中',
    })
    .waitFor({ timeout: 5000 });
  assert.equal(
    await page.locator('.agent-workflow-test-panel').getAttribute('aria-busy'),
    'true',
  );
  assert.equal(await page.locator('#workflowTestContent').isDisabled(), true);
  assert.equal(await page.locator('#workflowScenario').isDisabled(), true);
  assert.equal(
    await page.locator('.agent-workflow-test-header button').isDisabled(),
    true,
  );
  const pendingCopyReceiptText = await page
    .locator('.agent-workflow-evidence-copy-receipt.pending')
    .innerText();
  assert.match(pendingCopyReceiptText, /测试输入暂时锁定/);
  assert.match(pendingCopyReceiptText, /暂时锁定测试输入、来源选择和基线动作/);
  assert.match(pendingCopyReceiptText, /还没有确认复制成功/);
  assert.match(pendingCopyReceiptText, /不会写入 Memory Service/);
  assert.match(pendingCopyReceiptText, /不会发送通知/);
  assert.match(pendingCopyReceiptText, /不会执行规则自动化/);
  await page
    .locator('.agent-workflow-evidence-packet.review button', {
      hasText: '复制中',
    })
    .waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(
    await page
      .locator('.agent-workflow-evidence-packet.review button', {
        hasText: '复制中',
      })
      .isDisabled(),
    true,
  );
  await page
    .locator('.agent-workflow-evidence-copy-receipt', {
      hasText: '已复制到本机剪贴板',
    })
    .waitFor({ timeout: 5000 });
  await page.evaluate(() => {
    window.__agentWorkflowClipboardDelayMs = 0;
  });
  const copiedEvidencePacket = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  assert.match(copiedEvidencePacket, /Agent Workflow 单次运行证据包/);
  assert.match(copiedEvidencePacket, /快照状态: 当前结果/);
  assert.match(copiedEvidencePacket, /证据资格: 单次调试证据/);
  assert.match(copiedEvidencePacket, /结构覆盖 Agent 6\/7、工具 9\/9/);
  assert.match(copiedEvidencePacket, /匹配规则: manual:manual-1/);
  assert.match(copiedEvidencePacket, /下一步:/);
  assert.match(copiedEvidencePacket, /补齐被跳过工具/);
  assert.match(copiedEvidencePacket, /不会写入 Memory Service/);
  assert.doesNotMatch(
    copiedEvidencePacket,
    /API split has a blocker in the auth adapter\. Please keep this on the radar today\./,
  );
  await page.evaluate(() => {
    const previousClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText:
          previousClipboard && previousClipboard.readText
            ? previousClipboard.readText.bind(previousClipboard)
            : async () => '',
        writeText: async () => {
          throw new Error('mock clipboard denied');
        },
      },
    });
  });
  await page
    .locator('.agent-workflow-evidence-packet.review button', {
      hasText: '复制证据包',
    })
    .click();
  await page
    .locator('.agent-workflow-evidence-copy-receipt.error', {
      hasText: '复制证据包失败',
    })
    .waitFor({ timeout: 5000 });
  const failedCopyReceiptText = await page
    .locator('.agent-workflow-evidence-copy-receipt.error')
    .innerText();
  assert.match(failedCopyReceiptText, /剪贴板写入未完成/);
  assert.match(failedCopyReceiptText, /证据包仍停留在本页/);
  assert.match(failedCopyReceiptText, /不会写入剪贴板/);
  assert.match(failedCopyReceiptText, /不会导出报告/);
  assert.match(failedCopyReceiptText, /不会覆盖基线/);
  assert.match(failedCopyReceiptText, /不会写入 Memory Service/);
  assert.match(failedCopyReceiptText, /不会发送通知/);
  assert.match(failedCopyReceiptText, /不会执行规则自动化/);
  assert.match(failedCopyReceiptText, /mock clipboard denied/);

  const saveCurrentScenarioButton = page.locator(
    '.agent-workflow-saved-actions button',
    {
      hasText: '保存当前用例',
    },
  );
  await assertControlBoundary(saveCurrentScenarioButton, [
    /保存当前用例/,
    /chrome\.storage\.local/,
    /不会写入 Memory Service/,
  ]);
  await saveCurrentScenarioButton.click();
  await page
    .locator('.agent-workflow-saved-status', {
      hasText: '已保存当前用例和结果基线',
    })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '保存样例基线范围',
    })
    .waitFor({ timeout: 5000 });
  const savedSourceReceiptText = await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '保存样例基线范围',
    })
    .innerText();
  assert.match(savedSourceReceiptText, /已有结果基线/);
  assert.match(savedSourceReceiptText, /当前结果属于这条保存样例/);
  assert.match(savedSourceReceiptText, /不会投递真实通知或执行规则自动化/);
  const savedCapacityReceiptText = await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '保存样例容量',
    })
    .innerText();
  assert.match(savedCapacityReceiptText, /保存样例 1\/12/);
  assert.match(savedCapacityReceiptText, /更新同一条本地样例/);
  assert.match(savedCapacityReceiptText, /不会挤掉其他保存样例/);
  await page
    .locator('.agent-workflow-source-receipt.review', {
      hasText: '回归样本构成',
    })
    .waitFor({ timeout: 5000 });
  const regressionCoverageReceiptText = await page
    .locator('.agent-workflow-source-receipt.review', {
      hasText: '回归样本构成',
    })
    .innerText();
  assert.match(regressionCoverageReceiptText, /保存样例 1 个/);
  assert.match(regressionCoverageReceiptText, /有基线 1/);
  assert.match(regressionCoverageReceiptText, /通知 1 \/ 复核 0 \/ 存储-only 0/);
  assert.match(regressionCoverageReceiptText, /补充 低置信复核、存储-only 样例/);
  assert.match(regressionCoverageReceiptText, /chrome\.storage\.local 保存样例的结构覆盖/);
  assert.match(regressionCoverageReceiptText, /不代表所有线上关注项/);
  const runScopeReceiptAfterSaveText = await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '运行前范围',
    })
    .innerText();
  assert.match(runScopeReceiptAfterSaveText, /本地门禁可用/);
  assert.match(runScopeReceiptAfterSaveText, /保存基线和 Agent 配置可作为回归证据/);
  assert.match(runScopeReceiptAfterSaveText, /门禁可用/);
  await page
    .locator('.agent-workflow-evidence-packet.ready', {
      hasText: '可作本地回归证据',
    })
    .waitFor({ timeout: 5000 });
  const readyEvidencePacketText = await page
    .locator('.agent-workflow-evidence-packet.ready')
    .innerText();
  assert.match(readyEvidencePacketText, /当前结果/);
  assert.match(readyEvidencePacketText, /匹配保存样例、已有基线且 Agent 配置一致/);
  const readyRegressionScopeText = await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '批量回归范围',
    })
    .innerText();
  assert.match(readyRegressionScopeText, /可批量回归 1 个本地保存样例/);
  assert.match(readyRegressionScopeText, /不会覆盖基线/);
  assert.match(readyRegressionScopeText, /不会发送通知/);
  assert.match(readyRegressionScopeText, /不会执行规则自动化/);
  await page
    .locator('.agent-workflow-baseline', { hasText: '保存基线对比' })
    .waitFor({ timeout: 5000 });
  const baselineText = await page
    .locator('.agent-workflow-baseline')
    .innerText();
  assert.match(baselineText, /存储/);
  assert.match(baselineText, /通知/);
  assert.match(baselineText, /Trace/);
  assert.match(baselineText, /配置/);
  assert.match(baselineText, /Agent 7\/7 \/ 工具 9/);
  assert.match(baselineText, /一致/);
  assert.match(baselineText, /基线诊断：结论 需要复核后再执行/);
  assert.match(baselineText, /复核 执行 Trace、记忆写入、外部信息/);
  const savedScenarioState = await page.evaluate(async () => {
    const result = await chrome.storage.local.get(
      'agentWorkflowSavedScenarios',
    );
    return result.agentWorkflowSavedScenarios;
  });
  assert.equal(savedScenarioState.length, 1);
  assert.equal(savedScenarioState[0].expectedResult.shouldStore, true);
  assert.equal(savedScenarioState[0].expectedResult.shouldNotify, true);
  assert.equal(savedScenarioState[0].expectedResult.traceStatus, 'partial');
  assert.equal(
    savedScenarioState[0].expectedResult.agentConfigSnapshot.enabledAgentCount,
    7,
  );
  assert.equal(
    savedScenarioState[0].expectedResult.agentConfigSnapshot.enabledToolCount,
    9,
  );
  assert.deepEqual(savedScenarioState[0].expectedResult.matchedRuleRefs, [
    'manual:manual-1',
  ]);
  assert.match(
    savedScenarioState[0].expectedResult.diagnosticSnapshot.summary,
    /结论 需要复核后再执行/,
  );
  assert.equal(
    savedScenarioState[0].expectedResult.diagnosticSnapshot.verdict.status,
    'review',
  );
  assert.equal(
    savedScenarioState[0].expectedResult.diagnosticSnapshot.structuralCoverage
      .status,
    'partial',
  );
  assert.match(
    savedScenarioState[0].expectedResult.diagnosticSnapshot.structuralCoverage
      .summary,
    /Agent 6\/7、工具 9\/9/,
  );

  await page
    .locator('.agent-workflow-saved-actions button', { hasText: '删除' })
    .click();
  await page
    .locator('[aria-label="保存样例删除回执"]')
    .waitFor({ timeout: 5000 });
  const deleteReceiptText = await page
    .locator('[aria-label="保存样例删除回执"]')
    .innerText();
  assert.match(deleteReceiptText, /保存样例删除回执/);
  assert.match(deleteReceiptText, /已删除本地保存样例/);
  assert.match(deleteReceiptText, /剩余 0 个/);
  assert.match(deleteReceiptText, /本地结果基线也已移出/);
  assert.match(deleteReceiptText, /批量回归和基线对比会等待新样例/);
  assert.match(deleteReceiptText, /chrome.storage.local/);
  assert.match(deleteReceiptText, /不会删除 Memory Service 记忆/);
  assert.match(deleteReceiptText, /不会移除真实消息/);
  assert.match(deleteReceiptText, /不会发送通知/);
  assert.match(deleteReceiptText, /不会执行规则自动化/);
  assert.match(deleteReceiptText, /不会撤销已导出的报告/);
  const deletedScenarioState = await page.evaluate(async () => {
    const result = await chrome.storage.local.get(
      'agentWorkflowSavedScenarios',
    );
    return result.agentWorkflowSavedScenarios;
  });
  assert.deepEqual(deletedScenarioState, []);

  const capacityScenarios = Array.from({ length: 12 }, (_, index) => ({
    ...savedScenarioState[0],
    id: `capacity-${index}`,
    label: index === 11 ? 'Oldest capacity sample' : `Capacity sample ${index + 1}`,
    createdAt: `2026-05-03T17:${String(index).padStart(2, '0')}:00.000Z`,
    updatedAt: `2026-05-03T17:${String(index).padStart(2, '0')}:00.000Z`,
    input: {
      ...savedScenarioState[0].input,
      sender: `Capacity Sender ${index + 1}`,
      content: `Capacity seed sample ${index + 1} should stay in local regression coverage.`,
    },
  }));
  await page.evaluate(async (scenarios) => {
    await chrome.storage.local.set({ agentWorkflowSavedScenarios: scenarios });
  }, capacityScenarios);
  await page.reload({ waitUntil: 'load' });
  await page.locator('#ANALYSIS_TYPE').waitFor({ timeout: 15000 });
  await page.locator('h3', { hasText: '关注项测试' }).waitFor({
    timeout: 15000,
  });
  const fullCapacityReceiptText = await page
    .locator('[aria-label="保存样例容量"].agent-workflow-source-receipt.review')
    .innerText();
  assert.match(fullCapacityReceiptText, /已达到本地上限 12/);
  assert.match(fullCapacityReceiptText, /Oldest capacity sample/);
  assert.match(fullCapacityReceiptText, /将移出最旧/);
  assert.match(fullCapacityReceiptText, /不再参与批量回归/);
  assert.match(fullCapacityReceiptText, /不会删除 Memory Service 记忆/);
  await page.locator('#workflowTestSender').fill('Capacity Tester');
  await page
    .locator('#workflowTestContent')
    .fill('A brand new saved sample should evict the oldest local capacity case.');
  await page
    .locator('.agent-workflow-saved-actions button', {
      hasText: '保存当前用例',
    })
    .click();
  await page
    .locator('.agent-workflow-saved-status', {
      hasText: 'Oldest capacity sample',
    })
    .waitFor({ timeout: 5000 });
  const capacitySaveStatusText = await page
    .locator('.agent-workflow-saved-status')
    .innerText();
  assert.match(capacitySaveStatusText, /本地上限 12/);
  assert.match(capacitySaveStatusText, /已移出旧样例：Oldest capacity sample/);
  const capacityAfterSaveState = await page.evaluate(async () => {
    const result = await chrome.storage.local.get(
      'agentWorkflowSavedScenarios',
    );
    return result.agentWorkflowSavedScenarios;
  });
  assert.equal(capacityAfterSaveState.length, 12);
  assert.doesNotMatch(
    capacityAfterSaveState.map((scenario) => scenario.label).join('\n'),
    /Oldest capacity sample/,
  );
  assert.match(
    capacityAfterSaveState[0].input.content,
    /brand new saved sample/,
  );
  await page.evaluate(async (scenarios) => {
    await chrome.storage.local.set({ agentWorkflowSavedScenarios: scenarios });
  }, savedScenarioState);

  await page.evaluate(async () => {
    const result = await chrome.storage.local.get(
      'agentWorkflowSavedScenarios',
    );
    const scenarios = result.agentWorkflowSavedScenarios || [];
    scenarios[0] = {
      ...scenarios[0],
      expectedResult: {
        ...scenarios[0].expectedResult,
        shouldNotify: false,
        confidence: 0.2,
        traceStatus: 'complete',
      },
    };
    await chrome.storage.local.set({ agentWorkflowSavedScenarios: scenarios });
  });

  await page.reload({ waitUntil: 'load' });
  await page.locator('#ANALYSIS_TYPE').waitFor({ timeout: 15000 });
  await page.locator('h3', { hasText: '关注项测试' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.agent-workflow-saved-actions button', {
      hasText: '运行保存样例',
    })
    .click();
  await page
    .locator('.agent-workflow-baseline.changed', {
      hasText: '保存基线对比',
    })
    .waitFor({ timeout: 15000 });
  const changedBaselineText = await page
    .locator('.agent-workflow-baseline')
    .innerText();
  assert.match(changedBaselineText, /通知/);
  assert.match(changedBaselineText, /基线 否 \/ 当前 是/);
  assert.match(changedBaselineText, /Trace/);
  assert.match(changedBaselineText, /基线 complete \/ 当前 partial/);
  assert.match(changedBaselineText, /置信度/);
  assert.match(changedBaselineText, /基线 20% \/ 当前 88%/);
  assert.match(changedBaselineText, /基线诊断：结论 需要复核后再执行/);
  const acceptCurrentBaselineButton = page.locator(
    '.agent-workflow-baseline-header button',
    {
      hasText: '接受当前结果为基线',
    },
  );
  await assertControlBoundary(acceptCurrentBaselineButton, [
    /接受当前结果为基线/,
    /chrome\.storage\.local/,
    /不会写入 Memory Service/,
    /导出报告/,
  ]);
  await acceptCurrentBaselineButton.click();
  await page
    .locator('.agent-workflow-saved-status', {
      hasText: '已接受当前结果为新基线',
    })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.agent-workflow-baseline-writeback', {
      hasText: '单条基线写回回执',
    })
    .waitFor({ timeout: 5000 });
  const singleWritebackReceiptText = await page
    .locator('.agent-workflow-baseline-writeback', {
      hasText: '单条基线写回回执',
    })
    .innerText();
  assert.match(singleWritebackReceiptText, /已更新 1 个保存样例/);
  assert.match(singleWritebackReceiptText, /覆盖原基线/);
  assert.match(singleWritebackReceiptText, /chrome\.storage\.local/);
  assert.match(singleWritebackReceiptText, /不会写入 Memory Service/);
  assert.match(singleWritebackReceiptText, /发送通知/);
  assert.match(singleWritebackReceiptText, /执行规则自动化/);
  assert.match(singleWritebackReceiptText, /导出报告/);
  assert.match(singleWritebackReceiptText, /原始消息正文/);
  await page
    .locator('.agent-workflow-baseline.same', {
      hasText: '保存基线对比',
    })
    .waitFor({ timeout: 5000 });
  const refreshedSavedScenarioState = await page.evaluate(async () => {
    const result = await chrome.storage.local.get(
      'agentWorkflowSavedScenarios',
    );
    return result.agentWorkflowSavedScenarios;
  });
  assert.equal(refreshedSavedScenarioState.length, 1);
  assert.equal(refreshedSavedScenarioState[0].id, savedScenarioState[0].id);
  assert.equal(
    refreshedSavedScenarioState[0].expectedResult.shouldNotify,
    true,
  );
  assert.equal(refreshedSavedScenarioState[0].expectedResult.confidence, 0.88);
  assert.equal(
    refreshedSavedScenarioState[0].expectedResult.traceStatus,
    'partial',
  );
  assert.match(
    refreshedSavedScenarioState[0].expectedResult.diagnosticSnapshot.summary,
    /下一步 补齐被跳过工具/,
  );

  const runSavedRegressionButton = page.locator(
    '.agent-workflow-saved-actions button',
    {
      hasText: '批量回归',
    },
  );
  await assertControlBoundary(runSavedRegressionButton, [
    /批量回归/,
    /逐条重跑/,
    /不会覆盖基线/,
  ]);
  await runSavedRegressionButton.click();
  await page
    .locator('.agent-workflow-saved-status', {
      hasText: /批量回归完成：通过 1 \/ 变化 0 \/ 无基线 0 \/ 失败 0/,
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.agent-workflow-regression', {
      hasText: '保存样例批量回归',
    })
    .waitFor({ timeout: 5000 });
  const regressionText = await page
    .locator('.agent-workflow-regression')
    .innerText();
  const completedRegressionScopeText = await page
    .locator('.agent-workflow-source-receipt.ready', {
      hasText: '批量回归范围',
    })
    .innerText();
  assert.match(completedRegressionScopeText, /已完成本地批量回归/);
  assert.match(completedRegressionScopeText, /通过 1 \/ 变化 0 \/ 无基线 0 \/ 失败 0/);
  assert.match(completedRegressionScopeText, /导出报告需要用户单独点击/);
  assert.match(completedRegressionScopeText, /不会标记原消息已读/);
  assert.match(regressionText, /总数 1/);
  assert.match(regressionText, /通过 1/);
  assert.match(regressionText, /基线一致/);
  assert.match(regressionText, /存储、通知、复核、Trace、规则和置信度都未漂移/);
  assert.match(regressionText, /结论 需要复核后再执行/);
  assert.match(regressionText, /复核 执行 Trace、记忆写入、外部信息/);
  assert.match(regressionText, /下一步 补齐被跳过工具/);

  await page.evaluate(async (scenario) => {
    const changedScenario = {
      ...scenario,
      expectedResult: {
        ...scenario.expectedResult,
        shouldNotify: false,
        confidence: 0.2,
        traceStatus: 'complete',
      },
    };
    const noBaselineScenario = {
      ...scenario,
      id: 'workflow-saved-no-baseline',
      label: 'No baseline saved case',
      createdAt: '2026-05-03T16:00:00.000Z',
      updatedAt: '2026-05-03T16:00:00.000Z',
      input: {
        ...scenario.input,
        content: `${scenario.input.content} Please also mention the auth blocker.`,
      },
    };
    delete noBaselineScenario.expectedResult;
    await chrome.storage.local.set({
      agentWorkflowSavedScenarios: [changedScenario, noBaselineScenario],
    });
  }, savedScenarioState[0]);

  await page.reload({ waitUntil: 'load' });
  await page.locator('#ANALYSIS_TYPE').waitFor({ timeout: 15000 });
  await page.locator('h3', { hasText: '关注项测试' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.agent-workflow-saved-actions button', {
      hasText: '批量回归',
    })
    .click();
  await page
    .locator('.agent-workflow-saved-status', {
      hasText: /批量回归完成：通过 0 \/ 变化 1 \/ 无基线 1 \/ 失败 0/,
    })
    .waitFor({ timeout: 15000 });
  const regressionWithAcceptText = await page
    .locator('.agent-workflow-regression')
    .innerText();
  const changedRegressionScopeText = await page
    .locator('.agent-workflow-source-receipt.review', {
      hasText: '批量回归范围',
    })
    .innerText();
  assert.match(changedRegressionScopeText, /已完成本地批量回归/);
  assert.match(changedRegressionScopeText, /通过 0 \/ 变化 1 \/ 无基线 1 \/ 失败 0/);
  assert.match(changedRegressionScopeText, /接受为基线也需要单独点击/);
  assert.match(changedRegressionScopeText, /失败项不会被覆盖/);
  assert.match(changedRegressionScopeText, /不会复制原始消息正文/);
  assert.match(regressionWithAcceptText, /接受 2 个结果为基线/);
  assert.match(regressionWithAcceptText, /变化或无基线样例/);
  assert.match(regressionWithAcceptText, /失败项不会被覆盖/);
  assert.match(regressionWithAcceptText, /不会写入 Memory Service/);
  assert.match(regressionWithAcceptText, /执行规则自动化/);
  assert.match(regressionWithAcceptText, /原始消息正文/);
  assert.match(regressionWithAcceptText, /变化 1/);
  assert.match(regressionWithAcceptText, /无基线 1/);
  const exportRegressionReportButton = page.locator(
    '.agent-workflow-regression-actions button',
    {
      hasText: '导出报告',
    },
  );
  await assertControlBoundary(exportRegressionReportButton, [
    /导出报告/,
    /本机 JSON/,
    /不会接受基线/,
  ]);
  const [regressionDownload] = await Promise.all([
    page.waitForEvent('download'),
    exportRegressionReportButton.click(),
  ]);
  assert.match(
    regressionDownload.suggestedFilename(),
    /^agent-workflow-regression-.*\.json$/,
  );
  const regressionReportPath = await regressionDownload.path();
  assert.ok(regressionReportPath);
  const regressionReport = JSON.parse(
    await fs.readFile(regressionReportPath, 'utf8'),
  );
  assert.equal(
    regressionReport.type,
    'agent-workflow.saved-regression-report',
  );
  assert.deepEqual(regressionReport.summary, {
    total: 2,
    same: 0,
    changed: 1,
    noBaseline: 1,
    failed: 0,
  });
  assert.equal(regressionReport.results.length, 2);
  assert.equal(
    regressionReport.results.filter((item) => item.status === 'changed')
      .length,
    1,
  );
  assert.equal(
    regressionReport.results.filter((item) => item.status === 'no-baseline')
      .length,
    1,
  );
  assert.ok(regressionReport.results.every((item) => item.diagnostics));
  assert.equal(
    regressionReport.results[0].diagnostics.verdict.status,
    'review',
  );
  assert.equal(
    regressionReport.results[0].diagnostics.verdict.actionLabel,
    '补齐被跳过工具',
  );
  assert.equal(
    regressionReport.results[0].diagnostics.structuralCoverage.status,
    'partial',
  );
  assert.match(
    regressionReport.results[0].diagnostics.structuralCoverage.summary,
    /Agent 6\/7、工具 9\/9/,
  );
  assert.ok(
    regressionReport.results[0].diagnostics.readiness.some(
      (item) => item.id === 'external-info' && item.status === 'review',
    ),
  );
  assert.ok(
    regressionReport.results[0].diagnostics.recommendedActions.some(
      (item) => item.id === 'connect-external-query-adapter',
    ),
  );
  assert.equal(
    regressionReport.results[0].actual.diagnosticSnapshot.verdict.status,
    'review',
  );
  assert.equal(
    regressionReport.results[0].actual.agentConfigSnapshot.enabledToolCount,
    9,
  );
  assert.equal(regressionReport.results[0].agentConfigChanged, false);
  assert.equal(
    regressionReport.results[0].baselineAgentConfig.enabledAgentCount,
    7,
  );
  assert.equal(
    regressionReport.results[0].actualAgentConfig.enabledAgentCount,
    7,
  );
  await page
    .locator('.agent-workflow-saved-status', {
      hasText: /已导出批量回归报告：agent-workflow-regression-.*\.json/,
    })
    .waitFor({ timeout: 5000 });
  const acceptRegressionBaselinesButton = page.locator(
    '.agent-workflow-regression-header button',
    {
      hasText: '接受 2 个结果为基线',
    },
  );
  await assertControlBoundary(acceptRegressionBaselinesButton, [
    /接受 2 个结果为基线/,
    /chrome\.storage\.local/,
    /失败 0 个不会被覆盖/,
    /不会写入 Memory Service/,
  ]);
  await acceptRegressionBaselinesButton.click();
  await page
    .locator('.agent-workflow-saved-status', {
      hasText: '已接受 2 个批量回归结果为新基线',
    })
    .waitFor({ timeout: 5000 });
  await page
    .locator('.agent-workflow-baseline-writeback', {
      hasText: '批量基线写回回执',
    })
    .waitFor({ timeout: 5000 });
  const writebackReceiptText = await page
    .locator('.agent-workflow-baseline-writeback')
    .innerText();
  assert.match(writebackReceiptText, /已更新 2 个保存样例/);
  assert.match(writebackReceiptText, /变化 1 \/ 无基线 1/);
  assert.match(writebackReceiptText, /失败 0 个未覆盖/);
  assert.match(writebackReceiptText, /样例总数 2/);
  assert.match(writebackReceiptText, /只改写 chrome\.storage\.local/);
  assert.match(writebackReceiptText, /不会写入 Memory Service/);
  assert.match(writebackReceiptText, /发送通知/);
  assert.match(writebackReceiptText, /执行规则自动化/);
  await page
    .locator('.agent-workflow-regression.same', {
      hasText: '保存样例批量回归',
    })
    .waitFor({ timeout: 5000 });
  const acceptedRegressionText = await page
    .locator('.agent-workflow-regression')
    .innerText();
  assert.match(acceptedRegressionText, /通过 2/);
  assert.match(acceptedRegressionText, /变化 0/);
  assert.doesNotMatch(acceptedRegressionText, /接受 2 个结果为基线/);
  const acceptedScenarioState = await page.evaluate(async () => {
    const result = await chrome.storage.local.get(
      'agentWorkflowSavedScenarios',
    );
    return result.agentWorkflowSavedScenarios;
  });
  assert.equal(acceptedScenarioState.length, 2);
  assert.equal(
    acceptedScenarioState.every((scenario) => scenario.expectedResult),
    true,
  );
  assert.equal(acceptedScenarioState[0].expectedResult.shouldNotify, true);
  assert.equal(acceptedScenarioState[0].expectedResult.confidence, 0.88);
  assert.equal(acceptedScenarioState[1].expectedResult.shouldNotify, true);
  assert.equal(acceptedScenarioState[1].expectedResult.traceStatus, 'partial');
  assert.ok(
    acceptedScenarioState.every(
      (scenario) => scenario.expectedResult.diagnosticSnapshot?.summary,
    ),
  );
  assert.ok(
    acceptedScenarioState.every(
      (scenario) => scenario.expectedResult.agentConfigSnapshot?.key,
    ),
  );

  await page.locator('#agentId').fill('auditSnapshotAgent');
  await page.locator('#agentName').fill('Audit Snapshot Agent');
  await page
    .locator('#agentDescription')
    .fill('Verifies stale config detection.');
  await page.locator('#agentPriority').fill('58');
  await page.locator('.tools-list input[name="replyAdviser"]').check();
  await page.locator('button', { hasText: '添加 Agent' }).click();
  await page
    .locator('.agent-test-stale-banner', { hasText: 'Agent 配置已修改' })
    .waitFor({ timeout: 5000 });
  await page
    .locator('[aria-label="保存样例基线范围"].agent-workflow-source-receipt.review', {
      hasText: '上一次结果已过期',
    })
    .waitFor({ timeout: 5000 });
  const staleSavedReceiptText = await page
    .locator('[aria-label="保存样例基线范围"].agent-workflow-source-receipt.review', {
      hasText: '上一次结果已过期',
    })
    .innerText();
  assert.match(staleSavedReceiptText, /结果已过期/);
  assert.match(staleSavedReceiptText, /配置已变更/);
  assert.match(staleSavedReceiptText, /重新运行保存样例/);
  const staleRunScopeReceiptText = await page
    .locator('.agent-workflow-source-receipt.review', {
      hasText: '运行前范围',
    })
    .innerText();
  assert.match(staleRunScopeReceiptText, /本地门禁需重跑/);
  assert.match(staleRunScopeReceiptText, /门禁需重跑/);
  await page
    .locator('.agent-workflow-test-header button', {
      hasText: '重新运行测试',
    })
    .waitFor({ timeout: 5000 });

  await page
    .locator('#workflowTestContent')
    .fill(
      'API split has a blocker in the auth adapter. Please keep this on the radar today. Added stale-result check.',
    );
  await page.locator('.agent-test-stale-banner').waitFor({ timeout: 5000 });
  const staleBannerText = await page
    .locator('.agent-test-stale-banner')
    .innerText();
  assert.match(staleBannerText, /当前输入和 Agent 配置已修改/);
  await page
    .locator('.agent-workflow-source-receipt.review', {
      hasText: '当前输入不是所选保存样例',
    })
    .waitFor({ timeout: 5000 });
  const changedInputSavedReceiptText = await page
    .locator('.agent-workflow-source-receipt.review', {
      hasText: '当前输入不是所选保存样例',
    })
    .innerText();
  assert.match(changedInputSavedReceiptText, /输入已变更/);
  assert.match(changedInputSavedReceiptText, /另存为新样例/);
  const changedInputRunScopeReceiptText = await page
    .locator('.agent-workflow-source-receipt.review', {
      hasText: '运行前范围',
    })
    .innerText();
  assert.match(changedInputRunScopeReceiptText, /本地门禁需重跑/);
  assert.match(changedInputRunScopeReceiptText, /门禁需重跑/);
  await page
    .locator('.agent-workflow-evidence-packet.stale', {
      hasText: '单次运行证据包（旧快照）',
    })
    .waitFor({ timeout: 5000 });
  const staleCopyEvidenceButton = page.locator(
    '.agent-workflow-evidence-packet.stale button',
    {
      hasText: '复制证据包',
    },
  );
  await assertControlBoundary(staleCopyEvidenceButton, [
    /复制证据包/,
    /证据需重跑/,
    /不会写入 Memory Service/,
  ]);
  await staleCopyEvidenceButton.click();
  await page
    .locator('.agent-workflow-evidence-copy-receipt', {
      hasText: '旧快照',
    })
    .waitFor({ timeout: 5000 });
  const staleEvidencePacket = await page.evaluate(() =>
    navigator.clipboard.readText(),
  );
  assert.match(staleEvidencePacket, /快照状态: 旧快照/);
  assert.match(staleEvidencePacket, /证据资格: 证据需重跑/);
  assert.match(staleEvidencePacket, /当前输入和 Agent 配置已修改/);
  assert.match(staleEvidencePacket, /来源: Options 关注项测试 · 保存样例/);
  assert.match(staleEvidencePacket, /不会写入 Memory Service/);
  assert.doesNotMatch(
    staleEvidencePacket,
    /API split has a blocker in the auth adapter\. Please keep this on the radar today\./,
  );
  assert.doesNotMatch(
    staleEvidencePacket,
    /Added stale-result check\./,
  );
  await page
    .locator('.agent-workflow-test-header button', {
      hasText: '重新运行测试',
    })
    .waitFor({ timeout: 5000 });

  assertNoPageErrors();

  console.log('verify-agent-workflow-options-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
