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
  await page.locator('.agent-run-diagnostic-copy', {
    hasText: '复制诊断包',
  }).click();
  await page.locator('.agent-run-diagnostic-copy-status', {
    hasText: '复制失败，请手动选择诊断包',
  }).waitFor({ timeout: 3000 });
  const diagnosticManualCopy = page.locator('.agent-run-diagnostic-manual-copy');
  await diagnosticManualCopy.waitFor({ timeout: 3000 });
  const diagnosticPacketText = await diagnosticManualCopy.inputValue();
  assert.match(diagnosticPacketText, /"type": "agent_thinking_run_diagnostics"/);
  assert.doesNotMatch(diagnosticPacketText, /approval-tail-token-visible-in-ui/);
  await page.locator('.agent-run-review-item.warning', {
    hasText: '需要人工确认',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-queue', {
    hasText: '待确认动作',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-item', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 12000 });
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
  await page.locator('.agent-approval-retry-config', {
    hasText: 'approvedToolActionKeys',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-review-hint', {
    hasText: '确认通知内容、接收渠道和触发原因后再批准。',
  }).waitFor({ timeout: 12000 });
  await page.locator('.agent-approval-policy-note', {
    hasText: '只允许发送给项目告警渠道',
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
  await page.locator('.agent-approval-copy', {
    hasText: '复制 key',
  }).click();
  await page.locator('.agent-approval-copy-status', {
    hasText: /已复制批准 key|复制失败，请手动选择 key/,
  }).waitFor({ timeout: 3000 });
  await page.locator('.agent-approval-copy', {
    hasText: '复制审核包',
  }).click();
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
  await page.locator('.agent-approval-copy', {
    hasText: '复制重跑配置',
  }).click();
  await page.locator('.agent-approval-copy-status', {
    hasText: /已复制重跑配置|复制失败，请手动选择重跑配置/,
  }).waitFor({ timeout: 3000 });
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
  await page.locator('.flow-node.tool.approval', {
    hasText: 'messageNotification',
  }).click();
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

  await page.locator('.agent-result-summary', { hasText: '处理结果' }).waitFor({
    timeout: 12000,
  });
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
  await page.locator('.result-pending-approval', {
    hasText: '待确认动作未执行',
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval', {
    hasText: 'messageNotification',
  }).waitFor({ timeout: 12000 });
  await page.locator('.result-pending-approval', {
    hasText: '最终结果没有把这些动作当作已完成',
  }).waitFor({ timeout: 12000 });
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
