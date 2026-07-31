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

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'agent-thinking-options-browser-'),
  );
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

  return {
    context,
    extensionId: new URL(serviceWorker.url()).host,
  };
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

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId } = launched;
  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);

  await page.goto(`chrome-extension://${extensionId}/options.html`, {
    waitUntil: 'load',
    timeout: 15000,
  });

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      envConfig: {
        ANALYSIS_TYPE: 'agentThinking',
        LLM_TYPE: 'local',
        OLLAMA_BASE_URL: 'http://mock-ollama',
        OLLAMA_MODEL: 'mock-model',
        OLLAMA_QUERY_MODEL: 'mock-model',
        MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
      },
    });
  });

  await page.reload({ waitUntil: 'load' });
  await page.locator('#ANALYSIS_TYPE').waitFor({ timeout: 15000 });
  await page.locator('h2', { hasText: '智能Agent系统设置' }).waitFor({
    timeout: 15000,
  });

  await page.locator('.tools-table td', { hasText: /^historySearch$/ }).waitFor({
    timeout: 15000,
  });
  await page.locator('.tools-table td', { hasText: /^jiraQuery$/ }).waitFor({
    timeout: 15000,
  });
  await page.locator('.tools-table', { hasText: '安全边界' }).waitFor({
    timeout: 15000,
  });
  await page.locator('.tool-safety-badge.effect', { hasText: '只读' }).first().waitFor({
    timeout: 15000,
  });
  await page.locator('.tool-safety-badge.approval.clear', {
    hasText: '无需确认',
  }).first().waitFor({ timeout: 15000 });

  await page.locator('button', { hasText: '启动演示' }).click();
  await page.evaluate(() => {
    window.__agentThinkingSawFinalizing = false;
    window.__agentThinkingFinalizingReceiptText = '';
    window.__agentThinkingFinalizingObserver?.disconnect?.();

    const captureFinalizingState = () => {
      const indicator = document.querySelector('.processing-indicator.finalizing');
      const receipt = document.querySelector('.agent-result-handoff-receipt');
      if (!indicator && !receipt) return;
      window.__agentThinkingSawFinalizing = true;
      window.__agentThinkingFinalizingReceiptText = [
        indicator?.textContent || '',
        receipt?.textContent || '',
      ].join('\n');
    };

    const observer = new MutationObserver(captureFinalizingState);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.__agentThinkingFinalizingObserver = observer;
    captureFinalizingState();
  });

  await page.locator('.node-result.skipped', { hasText: '跳过' }).waitFor({
    timeout: 12000,
  });
  await page.locator('.flow-node.tool.blocked .node-result.blocked', {
    hasText: '已阻断',
  }).waitFor({ timeout: 12000 });
  await page.locator('.flow-node.tool.approval .node-result.approval', {
    hasText: '待确认',
  }).waitFor({ timeout: 12000 });
  await page.locator('.flow-node.tool.approval .node-step-index', {
    hasText: '#6',
  }).waitFor({ timeout: 12000 });
  assert.equal(
    await page.locator('.processing-indicator', { hasText: '处理中' }).count(),
    1,
    '终止步骤出现前应显示普通处理中状态',
  );
  assert.equal(
    await page.locator('.flow-node.decision', { hasText: '最终决策' }).count(),
    0,
    '流程运行中不应提前显示最终决策节点',
  );
  await page.locator('.flow-node.tool .node-detail', {
    hasText: /准备调用.+判断这条项目消息是否属于近期关注上下文/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-review.warning', {
    hasText: '工具被阻断',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-diagnostic-preflight', {
    hasText: '诊断包复制预检',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-diagnostic-preflight', {
    hasText: '准备复制当前页面 trace',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-diagnostic-preflight', {
    hasText: '复制只产生文本，不会批准、恢复或执行工具',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-diagnostic-preflight', {
    hasText: /复制对象[\s\S]*trace span/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-diagnostic-preflight', {
    hasText: '不含原始工具结果、工具参数或批准 key',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-diagnostic-preflight', {
    hasText: '不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-diagnostic-preflight', {
    hasText: '不能直接导入 OpenTelemetry / LangSmith / Langfuse',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-receipt', {
    hasText: '当前 trace 导航',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-receipt', {
    hasText: /当前 trace pai-agent-trace-[0-9a-f]{8}/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-receipt', {
    hasText: '本页共',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-receipt', {
    hasText: '首屏可直接跳到步骤',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-receipt', {
    hasText: '点击步骤定位只展开当前页面时间线',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-receipt', {
    hasText: '不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-route', {
    hasText: /步骤 #6[\s\S]*审批上下文：messageNotification 尚未执行/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-navigation-route', {
    hasText: /步骤 #7[\s\S]*运行状态：预算已用完/,
  }).waitFor({ timeout: 12000 });
  const traceNavigationStepButton = page
    .locator('.agent-trace-navigation-route', {
      hasText: /步骤 #6[\s\S]*审批上下文：messageNotification 尚未执行/,
    })
    .locator('button', { hasText: '步骤 #6' });
  const traceNavigationStepTitle =
    (await traceNavigationStepButton.getAttribute('title')) || '';
  const traceNavigationStepAria =
    (await traceNavigationStepButton.getAttribute('aria-label')) || '';
  assert.match(traceNavigationStepTitle, /从当前 trace 导航跳到步骤 6/);
  assert.match(
    traceNavigationStepTitle,
    /复核理由：审批上下文：messageNotification 尚未执行/,
  );
  assert.match(traceNavigationStepTitle, /点击步骤定位只展开当前页面时间线/);
  assert.match(traceNavigationStepAria, /从当前 trace 导航跳到步骤 6/);
  assert.match(
    traceNavigationStepAria,
    /复核理由：审批上下文：messageNotification 尚未执行/,
  );
  assert.match(
    traceNavigationStepAria,
    /不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作/,
  );
  await page.locator('.agent-trace-span-composition', {
    hasText: 'Trace span 构成',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-span-composition', {
    hasText: 'Root run',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-span-composition', {
    hasText: 'Tool calls',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-span-composition', {
    hasText: '问题 span',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-span-composition-item.warning', {
    hasText: /对应步骤 #/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-span-composition-steps button', {
    hasText: '步骤 #6',
  }).waitFor({ timeout: 12000 });
  const traceSpanIssueStepButton = page.locator(
    '.agent-trace-span-composition-steps button',
    {
      hasText: '步骤 #6',
    },
  );
  const traceSpanIssueStepTitle =
    (await traceSpanIssueStepButton.getAttribute('title')) || '';
  const traceSpanIssueStepAria =
    (await traceSpanIssueStepButton.getAttribute('aria-label')) || '';
  assert.match(traceSpanIssueStepTitle, /从问题 span跳到步骤 6/);
  assert.match(
    traceSpanIssueStepTitle,
    /复核理由：只统计失败、待确认、阻断和缺证 span/,
  );
  assert.match(traceSpanIssueStepTitle, /只展开并聚焦当前页面时间线/);
  assert.match(traceSpanIssueStepAria, /从问题 span跳到步骤 6/);
  assert.match(
    traceSpanIssueStepAria,
    /不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作/,
  );
  await page.locator('.agent-trace-span-composition', {
    hasText: '不是标准 OpenTelemetry / LangSmith / Langfuse 拓扑',
  }).waitFor({ timeout: 12000 });
  await traceSpanIssueStepButton.click();
  await page.locator('.thought-step.expanded', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 3000 });
  await page
    .locator('.agent-trace-navigation-receipt button', {
      hasText: '步骤 #6',
    })
    .click();
  await page.locator('.thought-step.expanded', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 3000 });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__agentThinkingCopiedDiagnosticPacket = text;
        },
      },
    });
  });
  await page.locator('.agent-run-diagnostic-copy').click();
  await page.locator('.agent-run-diagnostic-copy-status.copied', {
    hasText: '已复制诊断包：',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy-status.copied', {
    hasText: '这是当前页面快照',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy-status.copied', {
    hasText: '未复制原始工具结果、工具参数或批准 key',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy-status.copied', {
    hasText: /本地 trace [0-9a-f]{8}/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy-status.copied', {
    hasText: '本地 trace id 只用于匹配这份 JSON',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy-freshness.current', {
    hasText: '当前诊断包回执',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy-freshness.current', {
    hasText: '它仍只是本地快照，不会批准、恢复、重跑、发送通知、写入、删除或执行外部动作',
  }).waitFor({ timeout: 3000 });
  const copiedDiagnosticPacket = await page.evaluate(
    () => window.__agentThinkingCopiedDiagnosticPacket,
  );
  assert.match(copiedDiagnosticPacket, /"type": "agent_thinking_run_diagnostics"/);
  assert.match(copiedDiagnosticPacket, /"traceIdentity": \{/);
  assert.match(copiedDiagnosticPacket, /"navigationReceipt": \{/);
  assert.match(copiedDiagnosticPacket, /"title": "当前 trace 导航"/);
  assert.match(copiedDiagnosticPacket, /"stepRoutes": \[/);
  assert.match(copiedDiagnosticPacket, /"reason": "审批上下文：messageNotification 尚未执行/);
  assert.match(copiedDiagnosticPacket, /"reason": "运行状态：预算已用完/);
  assert.match(copiedDiagnosticPacket, /"noEffectBoundary": "点击步骤定位只展开当前页面时间线/);
  assert.match(copiedDiagnosticPacket, /"traceSpanComposition": \{/);
  assert.match(copiedDiagnosticPacket, /"title": "Trace span 构成"/);
  assert.match(copiedDiagnosticPacket, /"label": "Tool calls"/);
  assert.match(copiedDiagnosticPacket, /"label": "问题 span"/);
  assert.match(copiedDiagnosticPacket, /"stepNumbers": \[/);
  assert.match(copiedDiagnosticPacket, /"approvalQueueReceipt": \{/);
  assert.match(copiedDiagnosticPacket, /"title": "待确认队列口径"/);
  assert.match(copiedDiagnosticPacket, /"persistenceBoundary": "这不是持久审批队列/);
  assert.match(copiedDiagnosticPacket, /"checksumAlgorithm": "fnv1a32-local"/);
  assert.match(copiedDiagnosticPacket, /"source": "sanitized_diagnostic_snapshot"/);
  assert.doesNotMatch(copiedDiagnosticPacket, /approval-tail-token-visible-in-ui/);
  await page.locator('.agent-run-diagnostic-copy-freshness.stale', {
    hasText: '旧诊断包回执',
  }).waitFor({ timeout: 6000 });
  await page.locator('.agent-run-diagnostic-copy-freshness.stale', {
    hasText: '当前页面已经变为',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy-freshness.stale', {
    hasText: '请重新复制后再用于排障或 eval',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-copy', {
    hasText: '重新复制',
  }).waitFor({ timeout: 3000 });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('forced clipboard failure');
        },
      },
    });
    document.execCommand = () => false;
  });
  await page.locator('.agent-run-diagnostic-copy').click();
  await page.locator('.agent-run-diagnostic-copy-status', {
    hasText: '复制失败，请手动选择诊断包',
  }).waitFor({ timeout: 3000 });
  const diagnosticManualCopy = page.locator('.agent-run-diagnostic-manual-copy');
  await diagnosticManualCopy.waitFor({ timeout: 3000 });
  const diagnosticPacketText = await diagnosticManualCopy.inputValue();
  assert.match(diagnosticPacketText, /"type": "agent_thinking_run_diagnostics"/);
  assert.match(diagnosticPacketText, /"traceSpans": \[/);
  assert.match(diagnosticPacketText, /"operationName": "execute_tool"/);
  assert.match(diagnosticPacketText, /"gen_ai.tool.name": "messageNotification"/);
  assert.match(diagnosticPacketText, /"schemaBoundary": \{/);
  assert.match(diagnosticPacketText, /"snapshotBoundary": \{/);
  assert.match(diagnosticPacketText, /"navigationReceipt": \{/);
  assert.match(diagnosticPacketText, /"stepRoutes": \[/);
  assert.match(diagnosticPacketText, /审批上下文：messageNotification 尚未执行/);
  assert.match(diagnosticPacketText, /"traceSpanComposition": \{/);
  assert.match(diagnosticPacketText, /"approvalQueueReceipt": \{/);
  assert.match(diagnosticPacketText, /"stepNumbers": \[/);
  assert.match(diagnosticPacketText, /"traceIdentity": \{/);
  assert.match(diagnosticPacketText, /"traceId": "pai-agent-trace-[0-9a-f]{8}"/);
  assert.match(diagnosticPacketText, /"exporterStatus": "local_only_not_standard_export"/);
  assert.match(diagnosticPacketText, /"source": "current_page_trace_snapshot"/);
  assert.match(diagnosticPacketText, /"source": "sanitized_diagnostic_snapshot"/);
  assert.match(diagnosticPacketText, /"direct OpenTelemetry ingestion"/);
  assert.doesNotMatch(diagnosticPacketText, /approval-tail-token-visible-in-ui/);
  await page.locator('.agent-run-summary-chip', {
    hasText: /Trace spans\s*\d+/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '诊断包范围',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: /结构化 trace span/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: /本地 trace id pai-agent-trace-[0-9a-f]{8}/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '只用于匹配这份复制 JSON 和当前页面快照',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '复制的是当前页面快照',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '不会随审批、重跑或后续工具结果自动更新',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '不会复制原始工具结果、工具参数或批准 key。',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '不是 OpenTelemetry / LangSmith / Langfuse 标准导出。',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: 'personal_ai_agent_thinking_diagnostics v1',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '不能直接导入这些平台',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '本地 trace id 不能用于标准追踪关联、恢复 run 或审批动作',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-diagnostic-scope', {
    hasText: '仍使用单个待确认动作的审核包或重跑配置。',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-summary-chip', {
    hasText: /本地 trace\s*[0-9a-f]{8}/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-review-item.warning', {
    hasText: '需要人工确认',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue', {
    hasText: '待确认动作',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue-receipt', {
    hasText: '待确认队列口径',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue-receipt', {
    hasText: /当前页面 trace pai-agent-trace-[0-9a-f]{8} 汇总 1 个待确认动作/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue-receipt', {
    hasText: '队列只汇总本轮已被执行前阻断的人审工具动作；messageNotification 还没有执行。',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue-receipt', {
    hasText: '这不是持久审批队列，也不会让本轮 Agent run 在后台继续暂停等待',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue-receipt', {
    hasText: '复制 key、审核包或重跑配置只复制文本',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue-receipt', {
    hasText: '批准时复制对应重跑配置并用同一工具和同一参数重新运行',
  }).waitFor({ timeout: 12000 });
  const approvalQueueStepButton = page.locator(
    '.agent-approval-queue-steps button',
    {
      hasText: '步骤 #6',
    },
  );
  const approvalQueueStepTitle =
    (await approvalQueueStepButton.getAttribute('title')) || '';
  const approvalQueueStepAria =
    (await approvalQueueStepButton.getAttribute('aria-label')) || '';
  assert.match(approvalQueueStepTitle, /从待确认队列跳到步骤 6/);
  assert.match(
    approvalQueueStepTitle,
    /复核理由：逐条复核参数、接收方和安全说明/,
  );
  assert.match(
    approvalQueueStepTitle,
    /批准时复制对应重跑配置并用同一工具和同一参数重新运行/,
  );
  assert.match(approvalQueueStepTitle, /只展开并聚焦当前页面时间线/);
  assert.match(approvalQueueStepAria, /从待确认队列跳到步骤 6/);
  assert.match(
    approvalQueueStepAria,
    /不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作/,
  );
  await approvalQueueStepButton.click();
  await page.locator('#agent-step-5.thought-step.expanded', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 3000 });
  await page.waitForFunction(
    () => document.activeElement?.id === 'agent-step-header-5',
    { timeout: 3000 },
  );
  await page.locator('.agent-approval-item', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 12000 });
  const approvalItem = page.locator('.agent-approval-item', {
    hasText: 'messageNotification',
  });
  await page.locator('.agent-approval-item', {
    hasText: 'approval-tail-token-visible-in-ui',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-copy', {
    hasText: '复制 key',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-copy', {
    hasText: '复制审核包',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-copy', {
    hasText: '复制重跑配置',
  }).waitFor({ timeout: 12000 });
  const approvalKeyCopyButton = approvalItem.locator(
    'button.agent-approval-copy',
    {
      hasText: '复制 key',
    },
  );
  const approvalReviewCopyButton = approvalItem.locator(
    'button.agent-approval-copy',
    {
      hasText: '复制审核包',
    },
  );
  const approvalRetryCopyButton = approvalItem.locator(
    'button.agent-approval-copy',
    {
      hasText: '复制重跑配置',
    },
  );
  assert.match(
    (await approvalKeyCopyButton.getAttribute('title')) || '',
    /只复制当前本地 trace 里的临时批准 key/,
  );
  assert.match(
    (await approvalKeyCopyButton.getAttribute('aria-label')) || '',
    /不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作/,
  );
  assert.match(
    (await approvalReviewCopyButton.getAttribute('title')) || '',
    /只复制当前待确认动作的工具、参数、审批边界和重跑提示/,
  );
  assert.match(
    (await approvalReviewCopyButton.getAttribute('aria-label')) || '',
    /参数、上下文、工具策略或 trace 变化后需要重新生成/,
  );
  assert.match(
    (await approvalRetryCopyButton.getAttribute('title')) || '',
    /只复制 approvedToolActionKeys patch，不复制工具参数、原始结果、通知正文或外部执行凭据/,
  );
  assert.match(
    (await approvalRetryCopyButton.getAttribute('aria-label')) || '',
    /复制只产生本地文本/,
  );
  await page.locator('.agent-approval-retry-config', {
    hasText: 'approvedToolActionKeys',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-retry-receipt', {
    hasText: '重跑配置回执',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-retry-receipt', {
    hasText: '只复制 approvedToolActionKeys',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-retry-receipt', {
    hasText: '不复制工具参数、原始工具结果、通知正文或外部执行凭据。',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-retry-receipt', {
    hasText: '上下文变化或工具策略变化时，应重新生成批准 key',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-preflight', {
    hasText: '审批前确认',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-preflight', {
    hasText: /messageNotification \/ 通知 \/ 中风险，停在步骤 6/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-preflight', {
    hasText: '通知还没有发送。',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-preflight', {
    hasText: '复制 key、审核包或重跑配置只复制文本',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-preflight', {
    hasText: '不会批准、恢复 run、发送通知、写入、删除或执行外部动作。',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-preflight', {
    hasText: '拒绝或修改参数时不要复用旧 key',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-review-hint', {
    hasText: '确认通知内容、接收渠道和触发原因后再批准。',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-policy-note', {
    hasText: '只允许发送给项目告警渠道',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-guide', {
    hasText: '审批决策导览',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-guide-item.approve', {
    hasText: /批准后重跑[\s\S]*messageNotification \/ 通知 \/ 中风险 仍停在步骤 6/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-guide-item.approve', {
    hasText: '确认参数无误后复制重跑配置',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-guide-item.reject', {
    hasText: /拒绝本次动作[\s\S]*当前批准 key 不应继续使用/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-guide-item.reject', {
    hasText: '拒绝不会自动恢复本轮 run',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-guide-item.edit', {
    hasText: /修改参数后再审[\s\S]*旧 key 就不能代表新动作/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-guide-item.edit', {
    hasText: '新参数必须重新经过执行前校验和人工确认',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-options', {
    hasText: '处理方式',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-options li', {
    hasText: /批准[\s\S]*approvalKey/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-options li', {
    hasText: /拒绝[\s\S]*反馈给 Agent/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-decision-options li', {
    hasText: /修改[\s\S]*不复用旧 key/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-resume-note', {
    hasText: '拒绝或修改参数时不要复用旧 key',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-boundary', {
    hasText: '恢复边界',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-boundary', {
    hasText: '临时重跑凭据',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-boundary', {
    hasText: '不会持久暂停或自动恢复 Agent run',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-boundary', {
    hasText: '完全相同参数',
  }).waitFor({ timeout: 12000 });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__agentThinkingApprovalCopiedText = text;
        },
      },
    });
  });
  await approvalKeyCopyButton.click();
  await page.locator('.agent-approval-copy-status', {
    hasText: '已复制批准 key：',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-status', {
    hasText: '工具动作还没有执行',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-receipt', {
    hasText: /审批复制回执/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-receipt', {
    hasText: /剪贴板里是 messageNotification 的批准 key/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-receipt', {
    hasText: /来自本地 trace pai-agent-trace-[0-9a-f]{8}/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-receipt', {
    hasText: '复制只产生本地文本',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-receipt', {
    hasText: '不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作',
  }).waitFor({ timeout: 3000 });
  assert.match(
    await page.evaluate(() => window.__agentThinkingApprovalCopiedText),
    /approval-tail-token-visible-in-ui/,
  );
  await approvalReviewCopyButton.click();
  await page.locator('.agent-approval-copy-status', {
    hasText: '已复制审核包：',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-status', {
    hasText: '不会执行通知、写入或外部动作',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-receipt', {
    hasText: /剪贴板里是 messageNotification 的审核包/,
  }).waitFor({ timeout: 3000 });
  const copiedApprovalReviewPacket = await page.evaluate(
    () => window.__agentThinkingApprovalCopiedText,
  );
  assert.match(copiedApprovalReviewPacket, /"type": "agent_tool_approval_review"/);
  assert.match(copiedApprovalReviewPacket, /"preflightReceipt": \{/);
  assert.match(copiedApprovalReviewPacket, /"decisionGuide": \[/);
  assert.match(copiedApprovalReviewPacket, /"label": "批准后重跑"/);
  assert.match(copiedApprovalReviewPacket, /"label": "拒绝本次动作"/);
  assert.match(copiedApprovalReviewPacket, /"label": "修改参数后再审"/);
  assert.match(copiedApprovalReviewPacket, /"reviewBoundary": \{/);
  assert.match(copiedApprovalReviewPacket, /"retryReceipt": \{/);
  await approvalRetryCopyButton.click();
  await page.locator('.agent-approval-copy-status', {
    hasText: '已复制重跑配置：',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-status', {
    hasText: '只包含 approvedToolActionKeys',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy-receipt', {
    hasText: /剪贴板里是 messageNotification 的重跑配置/,
  }).waitFor({ timeout: 3000 });
  const copiedApprovalRetryConfig = await page.evaluate(
    () => window.__agentThinkingApprovalCopiedText,
  );
  assert.match(copiedApprovalRetryConfig, /"approvedToolActionKeys": \[/);
  assert.doesNotMatch(copiedApprovalRetryConfig, /"params":/);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('forced approval clipboard failure');
        },
      },
    });
    document.execCommand = () => false;
  });
  await approvalReviewCopyButton.click();
  await page.locator('.agent-approval-copy-status', {
    hasText: '复制失败，请手动选择审核包',
  }).waitFor({ timeout: 3000 });
  const approvalManualCopy = page
    .locator('.agent-approval-item', { hasText: 'messageNotification' })
    .locator('.agent-approval-manual-copy');
  await approvalManualCopy.waitFor({ timeout: 3000 });
  assert.match(
    await approvalManualCopy.inputValue(),
    /"type": "agent_tool_approval_review"/,
  );
  assert.match(
    await approvalManualCopy.inputValue(),
    /"reviewBoundary": \{/,
  );
  assert.match(
    await approvalManualCopy.inputValue(),
    /"retryReceipt": \{/,
  );
  assert.match(
    await approvalManualCopy.inputValue(),
    /"notCopied": "不复制工具参数、原始工具结果、通知正文或外部执行凭据。"/,
  );
  assert.match(
    await approvalManualCopy.inputValue(),
    /"mode": "single_run_retry"/,
  );
  await page.locator('.agent-run-review-item.info', {
    hasText: '重复调用已跳过',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-review-item.warning', {
    hasText: '工具证据不足',
  }).waitFor({ timeout: 12000 });
  const emptyEvidenceStepLink = page
    .locator('.agent-run-review-item.warning', { hasText: '工具证据不足' })
    .locator('.agent-run-review-step-links button')
    .first();
  await emptyEvidenceStepLink.waitFor({ timeout: 12000 });
  const emptyEvidenceStepTitle =
    (await emptyEvidenceStepLink.getAttribute('title')) || '';
  const emptyEvidenceStepAria =
    (await emptyEvidenceStepLink.getAttribute('aria-label')) || '';
  assert.match(emptyEvidenceStepTitle, /从工具证据不足跳到步骤/);
  assert.match(emptyEvidenceStepTitle, /复核理由：调整查询参数/);
  assert.match(emptyEvidenceStepTitle, /只展开并聚焦当前页面时间线/);
  assert.match(emptyEvidenceStepAria, /从工具证据不足跳到步骤/);
  assert.match(
    emptyEvidenceStepAria,
    /不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作/,
  );
  await emptyEvidenceStepLink.click();
  await page.locator('.thought-step.expanded', {
    hasText: 'historySearch 已执行，但没有返回可用证据。',
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-run-review-action', {
    hasText: '补齐必填参数',
  }).waitFor({ timeout: 12000 });
  await page.locator('.flow-node.tool.empty .node-result.empty', {
    hasText: '证据不足',
  }).waitFor({ timeout: 12000 });
  await page.locator('.thought-step .step-summary', {
    hasText: 'historySearch 已执行，但没有返回可用证据。',
  }).waitFor({ timeout: 12000 });
  const approvalFlowNode = page.locator('.flow-node.tool.approval', {
    hasText: 'messageNotification',
  });
  const approvalFlowNodeTitle =
    (await approvalFlowNode.getAttribute('title')) || '';
  const approvalFlowNodeAria =
    (await approvalFlowNode.getAttribute('aria-label')) || '';
  assert.match(approvalFlowNodeTitle, /从处理流程图跳到步骤 6/);
  assert.match(
    approvalFlowNodeTitle,
    /复核理由：通知动作需要人工确认/,
  );
  assert.match(approvalFlowNodeTitle, /只展开并聚焦当前页面时间线/);
  assert.match(approvalFlowNodeAria, /从处理流程图跳到步骤 6/);
  assert.match(
    approvalFlowNodeAria,
    /不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作/,
  );
  await approvalFlowNode.click();
  await page.locator('.thought-step.expanded', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 3000 });

  const blockedHeader = page
    .locator('.thought-step', { hasText: 'orgStructure' })
    .locator('.step-header')
    .first();
  await blockedHeader.waitFor({ timeout: 12000 });
  await page.locator('.thought-step .step-summary', {
    hasText: 'orgStructure 未通过工具校验，已阻断执行。',
  }).waitFor({ timeout: 3000 });
  await blockedHeader.focus();
  await page.keyboard.press('Enter');
  await assert
    .doesNotReject(async () =>
      page.locator('.thought-step.expanded', { hasText: 'orgStructure' }).waitFor({
        timeout: 3000,
      }),
    );
  assert.equal(await blockedHeader.getAttribute('aria-expanded'), 'true');
  const blockedStep = page.locator('.thought-step.expanded', {
    hasText: 'orgStructure',
  });
  await blockedStep.locator('.tool-result', {
    hasText: '工具结果',
  }).waitFor({ timeout: 3000 });
  await blockedStep.locator('.thought-content', {
    hasText: '决策摘要',
  }).waitFor({ timeout: 3000 });
  await blockedStep.locator('.intent-content', {
    hasText: '调用意图',
  }).waitFor({ timeout: 3000 });
  await blockedStep.locator('.diagnostic-content', {
    hasText: '执行前校验',
  }).waitFor({ timeout: 3000 });
  assert.equal(
    await blockedStep.locator('.thought-content', {
      hasText: '思考过程',
    }).count(),
    0,
  );

  const approvalHeader = page
    .locator('.thought-step', { hasText: 'messageNotification' })
    .locator('.step-header')
    .first();
  await approvalHeader.waitFor({ timeout: 12000 });
  await page.locator('.thought-step .step-summary', {
    hasText: 'messageNotification 需要人工确认，当前未执行。',
  }).waitFor({ timeout: 3000 });
  const approvalStep = page.locator('.thought-step.expanded', {
    hasText: 'messageNotification',
  });
  if ((await approvalStep.count()) === 0) {
    await approvalHeader.click();
  }
  await approvalStep.locator('.diagnostic-content', {
    hasText: 'approval-tail-token-visible-in-ui',
  }).waitFor({ timeout: 3000 });
  await approvalStep.locator('.diagnostic-content', {
    hasText: '批准 key: messageNotification',
  }).waitFor({ timeout: 3000 });

  await page.locator('.flow-node.decision', {
    hasText: '预算耗尽',
  }).waitFor({ timeout: 12000 });
  await page.locator('.flow-node.decision .node-step-index', {
    hasText: '#7',
  }).waitFor({ timeout: 12000 });
  await page.waitForFunction(
    () => window.__agentThinkingSawFinalizing === true,
    { timeout: 12000 },
  );
  const finalizingReceiptText = await page.evaluate(
    () => window.__agentThinkingFinalizingReceiptText || '',
  );
  assert.match(finalizingReceiptText, /结果整理中/);
  assert.match(
    finalizingReceiptText,
    /Trace 已到达 步骤 #7（预算耗尽）/,
  );
  assert.match(finalizingReceiptText, /结果摘要卡片仍在生成/);
  assert.match(
    finalizingReceiptText,
    /整理前仍有 1 个待确认动作、1 个已阻断工具步骤、1 个证据不足步骤/,
  );
  assert.match(finalizingReceiptText, /可先定位终止步骤 #7/);
  assert.match(
    finalizingReceiptText,
    /不会批准、恢复 run、重跑、发送通知、写入、删除或执行外部动作/,
  );
  assert.equal(
    await page.locator('.processing-indicator', { hasText: '处理中' }).count(),
    0,
    '终止步骤出现后不应继续显示普通处理中状态',
  );
  await page
    .locator('.agent-trace-navigation-route', {
      hasText: /步骤 #7[\s\S]*运行状态：预算已用完/,
    })
    .locator('button', { hasText: '步骤 #7' })
    .click();
  await page.locator('#agent-step-6.thought-step.expanded', {
    hasText: '最大行动次数',
  }).waitFor({ timeout: 3000 });
  await page.waitForFunction(
    () => document.activeElement?.id === 'agent-step-header-6',
    { timeout: 3000 },
  );
  await page.locator('.agent-result-summary', { hasText: '处理结果' }).waitFor({
    timeout: 12000,
  });
  assert.equal(
    await page.locator('.agent-result-handoff-receipt').count(),
    0,
    '结果卡片出现后不应继续显示结果整理回执',
  );
  await page.locator('.agent-run-review-item.warning', {
    hasText: '行动次数用完',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-review-detail', {
    hasText: /待确认 1 个步骤、被阻断 1 个步骤、证据不足 1 个步骤/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.flow-node.decision', {
    hasText: '预算耗尽',
  }).waitFor({ timeout: 12000 });
  await page.locator('.flow-node.decision .node-step-index', {
    hasText: '#7',
  }).waitFor({ timeout: 12000 });
  await page.locator('.flow-node.decision .node-detail', {
    hasText: /预算用完时仍有待确认 1 个步骤、被阻断 1 个步骤、证据不足 1 个步骤/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-summary-detail', {
    hasText: '终止于步骤 #7（预算耗尽）。 涉及',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane', {
    hasText: 'Trace 复核路线',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane', {
    hasText: '复制诊断包不等于批准、恢复或外部写入',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-item.warning', {
    hasText: /运行状态[\s\S]*预算耗尽/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-item.warning', {
    hasText: /运行状态[\s\S]*预算耗尽[\s\S]*步骤 #7/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-step-route', {
    hasText: /步骤 #7[\s\S]*运行状态：预算已用完/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-item.warning', {
    hasText: /审批上下文[\s\S]*1 个待确认/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-item.warning', {
    hasText: /审批上下文[\s\S]*1 个待确认[\s\S]*步骤 #6/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-step-route', {
    hasText: /步骤 #6[\s\S]*审批上下文：messageNotification 尚未执行/,
  }).waitFor({ timeout: 12000 });
  const traceReviewApprovalStepButton = page
    .locator('.agent-trace-review-lane-step-route', {
      hasText: /步骤 #6[\s\S]*审批上下文：messageNotification 尚未执行/,
    })
    .locator('button', { hasText: '步骤 #6' });
  const traceReviewApprovalTitle =
    (await traceReviewApprovalStepButton.getAttribute('title')) || '';
  const traceReviewApprovalAria =
    (await traceReviewApprovalStepButton.getAttribute('aria-label')) || '';
  assert.match(traceReviewApprovalTitle, /从审批上下文跳到步骤 6/);
  assert.match(
    traceReviewApprovalTitle,
    /复核理由：审批上下文：messageNotification 尚未执行/,
  );
  assert.match(traceReviewApprovalTitle, /只展开并聚焦当前页面时间线/);
  assert.match(traceReviewApprovalAria, /从审批上下文跳到步骤 6/);
  assert.match(
    traceReviewApprovalAria,
    /复核理由：审批上下文：messageNotification 尚未执行/,
  );
  assert.match(
    traceReviewApprovalAria,
    /不会批准、复制诊断包、重跑、发送通知、写入、删除或执行外部动作/,
  );
  await page.locator('.agent-trace-review-lane-item.warning', {
    hasText: /工具证据[\s\S]*阻断 1 \/ 缺证 1/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-item.warning', {
    hasText: /工具证据[\s\S]*阻断 1 \/ 缺证 1[\s\S]*步骤 #3[\s\S]*步骤 #5/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-step-route', {
    hasText: /步骤 #3[\s\S]*工具证据不足：调整查询参数/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-item', {
    hasText: /诊断包[\s\S]*spans/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-trace-review-lane-item', {
    hasText: '优先步骤的复核理由',
  }).waitFor({ timeout: 12000 });
  await page
    .locator('.agent-trace-review-lane-item', {
      hasText: /审批上下文[\s\S]*1 个待确认/,
    })
    .locator('button', { hasText: '步骤 #6' })
    .click();
  await page.locator('#agent-step-5.thought-step.expanded', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 3000 });
  await page.waitForFunction(
    () => document.activeElement?.id === 'agent-step-header-5',
    { timeout: 3000 },
  );
  await page
    .locator('.agent-trace-review-lane-item', {
      hasText: /工具证据[\s\S]*阻断 1 \/ 缺证 1/,
    })
    .locator('button', { hasText: '步骤 #3' })
    .click();
  await page.locator('#agent-step-2.thought-step.expanded', {
    hasText: 'historySearch 已执行，但没有返回可用证据。',
  }).waitFor({ timeout: 3000 });
  await page.waitForFunction(
    () => document.activeElement?.id === 'agent-step-header-2',
    { timeout: 3000 },
  );
  await page.locator('.agent-run-summary-action', {
    hasText: '优先处理：先让用户确认具体工具和参数，再带对应批准 key 重新运行。',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-summary-chip.warning', {
    hasText: /状态\s*预算耗尽/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-summary-chip', {
    hasText: /步骤\s*7/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-summary-chip.warning', {
    hasText: /待确认动作\s*1/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-summary-chip.warning', {
    hasText: /阻断\s*1/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-summary-chip.warning', {
    hasText: /缺证\s*1/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-run-summary-chip.info', {
    hasText: /跳过\s*1/,
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval', {
    hasText: '待确认动作未执行',
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval', {
    hasText: '最终结果没有把这些动作当作已完成',
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval-handoff', {
    hasText: '审批定位',
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval-handoff', {
    hasText: '点击定位只展开本轮 trace 的对应步骤',
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval-handoff', {
    hasText: '不会批准、复制、重跑、发送通知、写入、删除或执行外部动作',
  }).waitFor({ timeout: 12000 });
  const resultPendingApprovalStepButton = page.locator(
    '.result-pending-approval-step',
    {
      hasText: '定位步骤 #6',
    },
  );
  const resultPendingApprovalStepTitle =
    (await resultPendingApprovalStepButton.getAttribute('title')) || '';
  const resultPendingApprovalStepAria =
    (await resultPendingApprovalStepButton.getAttribute('aria-label')) || '';
  assert.match(
    resultPendingApprovalStepTitle,
    /从结果区审批定位跳到步骤 6/,
  );
  assert.match(
    resultPendingApprovalStepTitle,
    /messageNotification 尚未执行/,
  );
  assert.match(
    resultPendingApprovalStepTitle,
    /不会批准、复制、重跑、发送通知、写入、删除或执行外部动作/,
  );
  assert.match(
    resultPendingApprovalStepAria,
    /从结果区审批定位跳到步骤 6/,
  );
  assert.match(resultPendingApprovalStepAria, /不会批准、复制、重跑/);
  await resultPendingApprovalStepButton.click();
  await page.locator('#agent-step-5.thought-step.expanded', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 3000 });
  await page.waitForFunction(
    () => document.activeElement?.id === 'agent-step-header-5',
    { timeout: 3000 },
  );
  await page.locator('.decision-badge.pending-notify', {
    hasText: '待确认通知',
  }).waitFor({ timeout: 12000 });
  assert.equal(
    await page
      .locator('.decision-badge.no-notify', { hasText: '未通知' })
      .count(),
    0,
    '存在待确认通知动作时，结果区不应只显示未通知',
  );
  assert.equal(
    await page.locator('.flow-node.decision', { hasText: '预算耗尽' }).count(),
    1,
    '预算耗尽后应显示预算终止节点',
  );
  assert.equal(
    await page.locator('.flow-node.decision', { hasText: '最终决策' }).count(),
    0,
    '预算耗尽的演示不应误显示最终决策节点',
  );
  assert.equal(
    await page.locator('.agent-run-review-item', { hasText: '正在运行' }).count(),
    0,
    '流程完成后不应继续显示正在运行',
  );
  await assertNoPageErrors();

  console.log('verify-agent-thinking-options-e2e: ok');
} finally {
  if (launched?.context) {
    await launched.context.close();
  }
}
