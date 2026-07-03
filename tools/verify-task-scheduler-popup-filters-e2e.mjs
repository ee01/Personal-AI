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
    path.join(os.tmpdir(), 'task-scheduler-popup-e2e-browser-'),
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
    serviceWorker,
    userDataDir,
  };
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(error instanceof Error ? error.message : String(error));
  });
  return () => {
    assert.deepEqual(
      errors,
      [],
      `Task scheduler popup page errors: ${errors.join('; ')}`,
    );
  };
}

async function visibleTaskNames(page) {
  return page
    .locator('.task-row .task-name')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.trim() || '').filter(Boolean),
    );
}

async function waitForTaskRefreshReady(page) {
  await page.waitForFunction(
    () => {
      const button = document.querySelector('.task-refresh-btn');
      return button && !button.disabled;
    },
    null,
    { timeout: 15000 },
  );
}

let launched;

try {
  launched = await launchExtensionContext();
  const { context, extensionId, serviceWorker } = launched;
  const now = Date.now();

  await serviceWorker.evaluate(
    async ({ now }) => {
      const currentDigestHour = new Date(now).getHours();
      const nextDigestHour = (new Date(now).getHours() + 1) % 24;
      const dueCreatedAt = new Date(now - 26 * 60 * 60 * 1000).toISOString();
      await chrome.storage.local.clear();
      await chrome.storage.local.set({
        envConfig: {
          MEMORY_SERVICE_BASE_URL: 'https://memory.local/api/v1',
          MESSAGE_ANALYSIS_INTERVAL: 30,
        },
        userinfo: {
          username: 'popup.verify',
          fullName: 'Popup Verify',
        },
        taskSchedulerStates: {
          message_analysis: { enabled: false },
          memory_sync: {
            enabled: true,
            lastSuccess: true,
            lastCompletedAt: now - 20_000,
            lastSkippedAt: now - 1_000,
            lastSkipReason: '任务 记忆系统同步 正在执行，跳过重复触发',
            runHistory: [
              {
                startedAt: now - 1_000,
                completedAt: now - 1_000,
                durationMs: 0,
                success: false,
                skipped: true,
                trigger: 'manual',
                error: '任务 记忆系统同步 正在执行，跳过重复触发',
              },
            ],
          },
          system_monitoring: {
            enabled: true,
            lastSuccess: false,
            lastCompletedAt: now - 30_000,
            lastError: 'memory service unavailable',
            lastResultSummary: '检查 memory-service 连接后重试',
            runHistory: [
              {
                startedAt: now - 30_500,
                completedAt: now - 30_000,
                durationMs: 500,
                success: false,
                trigger: 'manual',
                error: 'memory service unavailable',
                summary: '检查 memory-service 连接后重试',
              },
              {
                startedAt: now - 60_500,
                completedAt: now - 60_000,
                durationMs: 500,
                success: false,
                trigger: 'scheduled',
                error: 'memory service unavailable',
              },
              {
                startedAt: now - 90_500,
                completedAt: now - 90_000,
                durationMs: 500,
                success: false,
                trigger: 'scheduled',
                error: 'memory service unavailable',
              },
            ],
          },
          user_profile_decay: {
            enabled: true,
            lastSuccess: true,
            lastCompletedAt: now - 40_000,
          },
          vectorized_data_maintenance: { enabled: true },
          user_summary_generation: { enabled: true },
          vector_quality_check: { enabled: true },
          digest_queue_process: {
            enabled: true,
            lastSuccess: true,
            lastCompletedAt: now - 50_000,
            lastResultSummary: '无到期摘要',
            runHistory: [
              {
                startedAt: now - 50_100,
                completedAt: now - 50_000,
                durationMs: 100,
                success: true,
                trigger: 'scheduled',
                summary: '无到期摘要',
              },
            ],
          },
        },
        digestQueues: {
          concerned_items_daily: {
            taskId: 'concerned_items_daily',
            items: [
              {
                id: 'verify-due-digest-1',
                createdAt: dueCreatedAt,
                sourceId: 'rule-future',
                data: {
                  ruleId: 'rule-future',
                  matchedRule: 'Release risks',
                  sender: 'Alice',
                  teamName: 'Release',
                  summary: 'Watch the risk later',
                  messageContent: 'Watch the risk later',
                  datetime: new Date(now).toISOString(),
                  digestConfig: {
                    enabled: true,
                    frequency: 'daily',
                    preferredHour: currentDigestHour,
                  },
                },
              },
              {
                id: 'verify-future-digest-2',
                createdAt: new Date(now).toISOString(),
                sourceId: 'rule-future',
                data: {
                  ruleId: 'rule-future',
                  matchedRule: 'Release risks',
                  sender: 'Bob',
                  teamName: 'Release',
                  summary: 'Second item waits for summary',
                  messageContent: 'Second item waits for summary',
                  datetime: new Date(now).toISOString(),
                  digestConfig: {
                    enabled: true,
                    frequency: 'daily',
                    preferredHour: nextDigestHour,
                  },
                },
              },
            ],
          },
        },
      });
    },
    { now },
  );

  const page = await context.newPage();
  const assertNoPageErrors = collectPageErrors(page);
  await page.route('https://memory.local/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: { cards: [] } }),
    });
  });

  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });

  await page.locator('.task-status-panel summary').click();
  const refreshMeta = page.locator('.task-refresh-meta');
  await refreshMeta.waitFor({ timeout: 15000 });
  assert.match(
    (await refreshMeta.textContent()) || '',
    /上次确认 .* · .+/,
    'task scheduler panel should show last confirmed snapshot time and local timezone',
  );
  await page
    .locator('.task-refresh-receipt', {
      hasText: '刷新回执：已核对 8 个任务',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-refresh-receipt', {
      hasText: '没有立即执行任务、启用或停用任务，也没有清空运行历史',
    })
    .waitFor({ timeout: 15000 });
  await waitForTaskRefreshReady(page);
  await page.evaluate(() => {
    const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    let delayNextTaskStatusRequest = true;
    window.__releaseTaskSchedulerRefresh = null;
    chrome.runtime.sendMessage = (message, ...args) => {
      if (
        delayNextTaskStatusRequest &&
        message?.type === 'GET_TASK_SCHEDULER_STATUS'
      ) {
        delayNextTaskStatusRequest = false;
        return new Promise((resolve, reject) => {
          window.__releaseTaskSchedulerRefresh = async () => {
            try {
              resolve(await originalSendMessage(message, ...args));
            } catch (error) {
              reject(error);
            }
          };
        });
      }
      return originalSendMessage(message, ...args);
    };
  });
  await page.locator('.task-refresh-btn').click();
  await page
    .locator('.task-refresh-receipt.pending', {
      hasText: '正在核对',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-refresh-receipt.pending', {
      hasText: '下方仍是',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-refresh-receipt.pending', {
      hasText: '上次确认快照',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-refresh-receipt.pending', {
      hasText: '尚未立即执行、启用、停用、修复任务或清空历史',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('.task-refresh-receipt.neutral').count(),
    0,
    'pending refresh should replace the last successful refresh receipt',
  );
  assert.match(
    (await refreshMeta.textContent()) || '',
    /上次确认 .* · .+/,
    'pending refresh should keep showing the last confirmed snapshot time',
  );
  await page.evaluate(() => window.__releaseTaskSchedulerRefresh());
  await page
    .locator('.task-refresh-receipt', {
      hasText: '刷新回执：已核对 8 个任务',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('.task-refresh-receipt.pending').count(),
    0,
    'pending refresh receipt should clear after the refresh resolves',
  );
  assert.equal(
    await page.locator('.task-health-chip').count(),
    0,
    'expanded task panel should not render filter chips',
  );
  const allTaskNames = await visibleTaskNames(page);
  assert.equal(allTaskNames.length, 8);
  assert.deepEqual(
    allTaskNames.slice(0, 2),
    ['系统健康监控', '记忆系统同步'],
    'attention tasks should remain sorted to the top without filters',
  );
  await page
    .locator('.task-next-step.failed', {
      hasText: '系统健康监控 连续失败 3 次',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-attention-summary', {
      hasText: '需处理总览',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-attention-summary-title', { hasText: '2 项' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-attention-item.failed', {
      hasText: '系统健康监控',
    })
    .locator('.task-attention-detail', {
      hasText: 'memory service unavailable',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-attention-item.failed', {
      hasText: '系统健康监控',
    })
    .locator('.task-attention-action', {
      hasText: '先暂停排程并检查服务配置，再手动重试',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-attention-item.skipped', {
      hasText: '记忆系统同步',
    })
    .locator('.task-attention-action', {
      hasText: '等待当前执行完成或条件恢复后再重试',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: 'memory service unavailable' })
    .waitFor({
      timeout: 15000,
    });
  await page
    .locator('.task-row', { hasText: '系统健康监控' })
    .locator('.task-latest-run', {
      hasText:
        '最近一次 · 手动失败 · 500ms · memory service unavailable · 检查 memory-service 连接后重试',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', {
      hasText:
        'memory service unavailable · 检查 memory-service 连接后重试',
    })
    .waitFor({ timeout: 15000 });
  const digestQueueRow = page.locator('.task-row', {
    hasText: '汇总推送队列处理',
  });
  await digestQueueRow
    .locator('.task-queue-summary', {
      hasText: '1 条已到释放窗口',
    })
    .waitFor({ timeout: 15000 });
  await digestQueueRow
    .locator('.task-queue-summary-boundary', {
      hasText: '释放窗口回执',
    })
    .waitFor({ timeout: 15000 });
  await digestQueueRow
    .locator('.task-queue-summary-boundary', {
      hasText: '等待后台任务推送',
    })
    .waitFor({ timeout: 15000 });
  await digestQueueRow
    .locator('.task-queue-summary-boundary', {
      hasText: '刷新状态不会立即发送',
    })
    .waitFor({ timeout: 15000 });
  await page.locator('.task-row', { hasText: '连续失败 3 次' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.task-row', { hasText: '系统健康监控' })
    .locator('.task-status-receipt.failed', {
      hasText: '先暂停排程并检查服务配置，再手动重试',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '系统健康监控' })
    .locator('.task-action-boundary.failed', {
      hasText: '暂停只停止自动排程并保留历史；立即执行只重试一次',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-pause-btn', { hasText: '暂停' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '静默消息分析' })
    .locator('.task-action-boundary.disabled', {
      hasText: '手动执行只跑一次，完成后任务仍保持停用',
    })
    .waitFor({ timeout: 15000 });

  await page.evaluate(() => {
    const previousSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    const baseResponsePromise = previousSendMessage({
      type: 'GET_TASK_SCHEDULER_STATUS',
    });
    const toggleTaskId = 'system_monitoring';
    let phase = 'enabled';

    const buildRefreshReceipt = (tasks) => ({
      checkedAt: Date.now(),
      checkedTaskCount: tasks.length,
      enabledTaskCount: tasks.filter((task) => task.enabled).length,
      scheduleAttentionCount: tasks.filter(
        (task) =>
          task.enabled &&
          task.scheduleHealth !== 'scheduled' &&
          task.scheduleHealth !== 'disabled',
      ).length,
      autoRepairAttempted: false,
      createdAlarms: 0,
      updatedAlarms: 0,
      clearedAlarms: 0,
      orphanedAlarmsCleared: 0,
      disabledAlarmsCleared: 0,
      failedRepairs: 0,
      refreshOnly: true,
    });

    const buildTasks = async () => {
      const baseResponse = await baseResponsePromise;
      return baseResponse.tasks.map((task) => {
        if (task.id !== toggleTaskId || phase !== 'disabled') return task;
        return {
          ...task,
          enabled: false,
          status: 'stopped',
          isExecuting: false,
          nextRun: undefined,
          scheduleHealth: 'disabled',
          scheduleWarning: undefined,
          statusReceipt: {
            state: 'disabled',
            tone: 'disabled',
            label: '停用',
            detail: '不会自动创建 Chrome alarm',
            nextAction: '需要时可手动执行一次，不会重新启用排程',
          },
        };
      });
    };

    window.__releaseTaskSchedulerToggle = null;
    window.__restoreTaskSchedulerToggleSendMessage = () => {
      chrome.runtime.sendMessage = previousSendMessage;
    };

    chrome.runtime.sendMessage = (message, ...args) => {
      if (message?.type === 'GET_TASK_SCHEDULER_STATUS') {
        return buildTasks().then((tasks) => ({
          success: true,
          tasks,
          refreshReceipt: buildRefreshReceipt(tasks),
        }));
      }
      if (
        message?.type === 'CONTROL_TASK' &&
        message.action === 'toggle' &&
        message.taskId === toggleTaskId
      ) {
        return new Promise((resolve) => {
          window.__releaseTaskSchedulerToggle = () => {
            phase = 'disabled';
            resolve({ success: true, message: '任务状态已更新' });
          };
        });
      }
      return previousSendMessage(message, ...args);
    };
  });
  await page.locator('.task-refresh-btn').click();
  const systemMonitoringRow = page.locator('.task-row', {
    hasText: '系统健康监控',
  });
  await systemMonitoringRow
    .locator('.task-pause-btn', { hasText: '暂停' })
    .click();
  await systemMonitoringRow
    .locator('.task-status-receipt.pending', {
      hasText: '停用确认中',
    })
    .waitFor({ timeout: 15000 });
  await systemMonitoringRow
    .locator('.task-status-receipt.pending', {
      hasText: '仍显示上次确认的排程状态',
    })
    .waitFor({ timeout: 15000 });
  await systemMonitoringRow
    .locator('.task-state-badge.failed', { hasText: '失败' })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page
      .locator('.task-action-receipt-panel.success', { hasText: '排程已停用' })
      .count(),
    0,
    'toggle should not show paused success before the background response returns',
  );
  await page.evaluate(() => window.__releaseTaskSchedulerToggle());
  await page
    .locator('.task-action-receipt-panel.success', {
      hasText: '排程已停用',
    })
    .waitFor({ timeout: 15000 });
  await systemMonitoringRow
    .locator('.task-status-receipt.disabled', { hasText: '停用' })
    .waitFor({ timeout: 15000 });
  await page.evaluate(() => window.__restoreTaskSchedulerToggleSendMessage());
  await page.locator('.task-refresh-btn').click();
  await systemMonitoringRow
    .locator('.task-state-badge.failed', { hasText: '失败' })
    .waitFor({ timeout: 15000 });

  await page.evaluate(() => {
    const previousSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    window.__restoreTaskSchedulerToggleFailureSendMessage = () => {
      chrome.runtime.sendMessage = previousSendMessage;
    };

    chrome.runtime.sendMessage = (message, ...args) => {
      if (
        message?.type === 'CONTROL_TASK' &&
        message.action === 'toggle' &&
        message.taskId === 'memory_sync'
      ) {
        return Promise.resolve({
          success: false,
          error: 'mock toggle bridge rejected',
        });
      }
      return previousSendMessage(message, ...args);
    };
  });
  const memorySyncRow = page.locator('.task-row', {
    hasText: '记忆系统同步',
  });
  await memorySyncRow
    .locator('.task-mini-switch input')
    .evaluate((input) => input.click());
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: '停用失败',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: 'mock toggle bridge rejected',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: '这次没有确认停用排程',
    })
    .waitFor({ timeout: 15000 });
  await memorySyncRow
    .locator('.task-state-badge.skipped', { hasText: '跳过' })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('.task-status-error').count(),
    0,
    'toggle control failures should use the action receipt instead of a global control error',
  );
  await page.evaluate(() =>
    window.__restoreTaskSchedulerToggleFailureSendMessage(),
  );

  await page.evaluate(() => {
    const previousSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    const baseResponsePromise = previousSendMessage({
      type: 'GET_TASK_SCHEDULER_STATUS',
    });
    const runTaskId = 'user_profile_decay';
    let phase = 'idle';

    const buildRefreshReceipt = (tasks) => ({
      checkedAt: Date.now(),
      checkedTaskCount: tasks.length,
      enabledTaskCount: tasks.filter((task) => task.enabled).length,
      scheduleAttentionCount: tasks.filter(
        (task) =>
          task.enabled &&
          task.scheduleHealth !== 'scheduled' &&
          task.scheduleHealth !== 'disabled',
      ).length,
      autoRepairAttempted: false,
      createdAlarms: 0,
      updatedAlarms: 0,
      clearedAlarms: 0,
      orphanedAlarmsCleared: 0,
      disabledAlarmsCleared: 0,
      failedRepairs: 0,
      refreshOnly: true,
    });

    const buildTasks = async () => {
      const baseResponse = await baseResponsePromise;
      return baseResponse.tasks.map((task) => {
        if (task.id !== runTaskId || phase !== 'completed') return task;
        return {
          ...task,
          enabled: true,
          status: 'running',
          isExecuting: false,
          lastRun: Date.now() - 250,
          lastCompletedAt: Date.now(),
          lastSuccess: true,
          lastError: undefined,
          lastResultSummary: '后端自动处理，扩展侧记录 no-op',
          scheduleHealth: 'scheduled',
          statusReceipt: {
            state: 'healthy',
            tone: 'running',
            label: '最近成功',
            detail: '后端自动处理，扩展侧记录 no-op',
            nextAction: '保持排程，异常时再处理',
          },
          runHistory: [
            {
              startedAt: Date.now() - 250,
              completedAt: Date.now(),
              durationMs: 250,
              success: true,
              trigger: 'manual',
              summary: '后端自动处理，扩展侧记录 no-op',
            },
          ],
        };
      });
    };

    window.__releaseTaskSchedulerRun = null;
    window.__restoreTaskSchedulerRunSendMessage = () => {
      chrome.runtime.sendMessage = previousSendMessage;
    };

    chrome.runtime.sendMessage = (message, ...args) => {
      if (message?.type === 'GET_TASK_SCHEDULER_STATUS') {
        return buildTasks().then((tasks) => ({
          success: true,
          tasks,
          refreshReceipt: buildRefreshReceipt(tasks),
        }));
      }
      if (
        message?.type === 'CONTROL_TASK' &&
        message.action === 'run' &&
        message.taskId === runTaskId
      ) {
        return new Promise((resolve) => {
          window.__releaseTaskSchedulerRun = () => {
            phase = 'completed';
            resolve({ success: true, message: '后端自动处理，扩展侧记录 no-op' });
          };
        });
      }
      return previousSendMessage(message, ...args);
    };
  });
  await page.locator('.task-refresh-btn').click();
  const userProfileDecayRow = page.locator('.task-row', {
    hasText: '用户画像权重衰变',
  });
  await userProfileDecayRow.locator('.task-run-btn').click();
  await userProfileDecayRow
    .locator('.task-status-receipt.pending', {
      hasText: '执行确认中',
    })
    .waitFor({ timeout: 15000 });
  await userProfileDecayRow
    .locator('.task-status-receipt.pending', {
      hasText: '仍显示上次确认的运行快照',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page
      .locator('.task-action-receipt-panel.success', { hasText: '已手动执行' })
      .count(),
    0,
    'manual run should not show success before the background response returns',
  );
  await page.evaluate(() => window.__releaseTaskSchedulerRun());
  await page
    .locator('.task-action-receipt-panel.success', {
      hasText: '已手动执行',
    })
    .waitFor({ timeout: 15000 });
  await userProfileDecayRow
    .locator('.task-status-receipt.running', {
      hasText: '最近成功',
    })
    .waitFor({ timeout: 15000 });
  await page.evaluate(() => window.__restoreTaskSchedulerRunSendMessage());
  await page.locator('.task-refresh-btn').click();

  await page.evaluate(async () => {
    const previousSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    const baseResponse = await previousSendMessage({
      type: 'GET_TASK_SCHEDULER_STATUS',
    });
    const repairTaskId = 'vector_quality_check';
    let phase = 'warning';

    const buildRefreshReceipt = (tasks) => ({
      checkedAt: Date.now(),
      checkedTaskCount: tasks.length,
      enabledTaskCount: tasks.filter((task) => task.enabled).length,
      scheduleAttentionCount:
        phase === 'warning'
          ? tasks.filter((task) => task.id === repairTaskId).length
          : 0,
      autoRepairAttempted: false,
      createdAlarms: 0,
      updatedAlarms: 0,
      clearedAlarms: 0,
      orphanedAlarmsCleared: 0,
      disabledAlarmsCleared: 0,
      failedRepairs: 0,
      refreshOnly: true,
    });

    const buildTasks = () =>
      baseResponse.tasks.map((task) => {
        if (task.id !== repairTaskId) return task;
        if (phase === 'warning') {
          const warning =
            'Chrome alarm 已超过预期触发时间 12 分钟，建议手动执行或重新启用排程';
          return {
            ...task,
            enabled: true,
            status: 'running',
            isExecuting: false,
            scheduleHealth: 'overdue',
            scheduleWarning: warning,
            statusReceipt: {
              state: 'schedule_attention',
              tone: 'warning',
              label: '逾期',
              detail: warning,
              nextAction: '先手动执行一次或重排 Chrome alarm',
            },
          };
        }
        return {
          ...task,
          enabled: true,
          status: 'running',
          isExecuting: false,
          scheduleHealth: 'scheduled',
          scheduleWarning: undefined,
          nextRun: Date.now() + task.intervalMinutes * 60_000,
          statusReceipt: {
            state: 'idle',
            tone: 'running',
            label: '等待首次执行',
            detail: '等待 Chrome 排程',
            nextAction: '保持排程，必要时手动执行一次',
          },
        };
      });

    window.__releaseTaskSchedulerRepair = null;
    window.__restoreTaskSchedulerSendMessage = () => {
      chrome.runtime.sendMessage = previousSendMessage;
    };

    chrome.runtime.sendMessage = (message, ...args) => {
      if (message?.type === 'GET_TASK_SCHEDULER_STATUS') {
        const tasks = buildTasks();
        return Promise.resolve({
          success: true,
          tasks,
          refreshReceipt: buildRefreshReceipt(tasks),
        });
      }
      if (
        message?.type === 'CONTROL_TASK' &&
        message.action === 'repair' &&
        message.taskId === repairTaskId
      ) {
        return new Promise((resolve) => {
          window.__releaseTaskSchedulerRepair = () => {
            phase = 'repaired';
            resolve({ success: true, message: '排程已修复' });
          };
        });
      }
      return previousSendMessage(message, ...args);
    };
  });
  await page.locator('.task-refresh-btn').click();
  const vectorQualityRow = page.locator('.task-row', {
    hasText: '向量质量检查',
  });
  await vectorQualityRow
    .locator('.task-state-badge.warning', { hasText: '逾期' })
    .waitFor({ timeout: 15000 });
  await vectorQualityRow
    .locator('.task-meta.warning', {
      hasText: 'Chrome alarm 已超过预期触发时间 12 分钟',
    })
    .waitFor({ timeout: 15000 });
  await vectorQualityRow.locator('.task-repair-btn').click();
  await vectorQualityRow
    .locator('.task-status-receipt.pending', {
      hasText: '重排确认中',
    })
    .waitFor({ timeout: 15000 });
  await vectorQualityRow
    .locator('.task-status-receipt.pending', {
      hasText: '仍显示上次确认的排程快照',
    })
    .waitFor({ timeout: 15000 });
  await vectorQualityRow
    .locator('.task-state-badge.warning', { hasText: '逾期' })
    .waitFor({ timeout: 15000 });
  await vectorQualityRow
    .locator('.task-meta.warning', {
      hasText: 'Chrome alarm 已超过预期触发时间 12 分钟',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page
      .locator('.task-action-receipt-panel.success', { hasText: '排程已重排' })
      .count(),
    0,
    'repair should not show success before the background response returns',
  );
  await page.evaluate(() => window.__releaseTaskSchedulerRepair());
  await page
    .locator('.task-action-receipt-panel.success', {
      hasText: '排程已重排',
    })
    .waitFor({ timeout: 15000 });
  await vectorQualityRow
    .locator('.task-state-badge.running', { hasText: '启用' })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await vectorQualityRow.locator('.task-status-receipt.pending').count(),
    0,
    'repair pending receipt should clear after confirmed status reload',
  );
  await page.evaluate(() => window.__restoreTaskSchedulerSendMessage());

  await page.evaluate(async () => {
    const previousSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    const baseResponse = await previousSendMessage({
      type: 'GET_TASK_SCHEDULER_STATUS',
    });
    const repairTaskId = 'vector_quality_check';
    const warning =
      'Chrome alarm 已超过预期触发时间 12 分钟，建议手动执行或重新启用排程';

    const buildTasks = () =>
      baseResponse.tasks.map((task) =>
        task.id === repairTaskId
          ? {
              ...task,
              enabled: true,
              status: 'running',
              isExecuting: false,
              scheduleHealth: 'overdue',
              scheduleWarning: warning,
              statusReceipt: {
                state: 'schedule_attention',
                tone: 'warning',
                label: '逾期',
                detail: warning,
                nextAction: '先手动执行一次或重排 Chrome alarm',
              },
            }
          : task,
      );

    window.__restoreTaskSchedulerRepairFailureSendMessage = () => {
      chrome.runtime.sendMessage = previousSendMessage;
    };

    chrome.runtime.sendMessage = (message, ...args) => {
      if (message?.type === 'GET_TASK_SCHEDULER_STATUS') {
        const tasks = buildTasks();
        return Promise.resolve({
          success: true,
          tasks,
          refreshReceipt: {
            checkedAt: Date.now(),
            checkedTaskCount: tasks.length,
            enabledTaskCount: tasks.filter((task) => task.enabled).length,
            scheduleAttentionCount: 1,
            autoRepairAttempted: false,
            createdAlarms: 0,
            updatedAlarms: 0,
            clearedAlarms: 0,
            orphanedAlarmsCleared: 0,
            disabledAlarmsCleared: 0,
            failedRepairs: 0,
            refreshOnly: true,
          },
        });
      }
      if (
        message?.type === 'CONTROL_TASK' &&
        message.action === 'repair' &&
        message.taskId === repairTaskId
      ) {
        return Promise.resolve({
          success: false,
          error: 'mock alarm repair rejected',
        });
      }
      return previousSendMessage(message, ...args);
    };
  });
  await page.locator('.task-refresh-btn').click();
  const vectorQualityFailureRow = page.locator('.task-row', {
    hasText: '向量质量检查',
  });
  await vectorQualityFailureRow
    .locator('.task-state-badge.warning', { hasText: '逾期' })
    .waitFor({ timeout: 15000 });
  await vectorQualityFailureRow.locator('.task-repair-btn').click();
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: '重排失败',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: 'mock alarm repair rejected',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: '没有确认 Chrome alarm 已修复',
    })
    .waitFor({ timeout: 15000 });
  await vectorQualityFailureRow
    .locator('.task-state-badge.warning', { hasText: '逾期' })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('.task-status-error').count(),
    0,
    'repair control failures should use the action receipt instead of a global control error',
  );
  await page.evaluate(() =>
    window.__restoreTaskSchedulerRepairFailureSendMessage(),
  );

  await page.evaluate(() => {
    const originalSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    let failNextTaskStatusRequest = true;
    chrome.runtime.sendMessage = (message, ...args) => {
      if (
        failNextTaskStatusRequest &&
        message?.type === 'GET_TASK_SCHEDULER_STATUS'
      ) {
        failNextTaskStatusRequest = false;
        const response = {
          success: false,
          error: 'mock scheduler bridge offline',
        };
        const maybeCallback = args.find((arg) => typeof arg === 'function');
        if (maybeCallback) {
          maybeCallback(response);
          return undefined;
        }
        return Promise.resolve(response);
      }
      return originalSendMessage(message, ...args);
    };
  });
  await page.locator('.task-refresh-btn').click();
  await page
    .locator('.task-status-error', {
      hasText: '下方仍是',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-status-error', {
      hasText: '当前 Chrome alarm 和执行状态未确认',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-refresh-receipt.failed', {
      hasText: '刷新未确认',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-refresh-receipt.failed', {
      hasText: '本次读取失败：mock scheduler bridge offline',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-refresh-receipt.failed', {
      hasText: '没有确认当前 Chrome alarm 或执行状态',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('.task-refresh-receipt.neutral').count(),
    0,
    'failed refresh should clear the previous successful refresh receipt',
  );
  assert.equal(
    (await visibleTaskNames(page)).length,
    8,
    'status refresh failures should keep the last task snapshot visible',
  );

  await serviceWorker.evaluate(() => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: 'memory service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
  });
  await page
    .locator('.task-row', { hasText: '系统健康监控' })
    .locator('.task-run-btn')
    .click();
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: '手动执行失败',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-action-receipt-panel.failed', {
      hasText: '这是一次性执行，自动排程仍保持启用。',
    })
    .waitFor({ timeout: 15000 });
  assert.equal(
    await page.locator('.task-status-error').count(),
    0,
    'manual task failures should use the action receipt instead of a global control error',
  );

  await page
    .locator('.task-row', { hasText: '用户画像权重衰变' })
    .locator('.task-run-btn')
    .click();
  await page
    .locator('.task-action-receipt-panel.success', {
      hasText: '已手动执行',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-action-receipt-panel.success', {
      hasText: '这是一次性执行，自动排程仍保持启用。',
    })
    .waitFor({ timeout: 15000 });

  await page
    .locator('.task-row', { hasText: '系统健康监控' })
    .locator('.task-pause-btn', { hasText: '暂停' })
    .click();
  await page
    .locator('.task-action-receipt-panel.success', {
      hasText: '排程已停用',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-action-receipt-panel.success', {
      hasText: '仍可手动执行一次；停用不会删除运行历史。',
    })
    .waitFor({ timeout: 15000 });

  await page
    .locator('.task-row', { hasText: '记忆系统同步' })
    .locator('.task-latest-run', {
      hasText:
        '最近一次 · 手动跳过 · 0ms · 任务 记忆系统同步 正在执行，跳过重复触发',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '记忆系统同步' })
    .locator('.task-status-receipt.skipped', {
      hasText: '等待当前执行完成或条件恢复后再重试',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '记忆系统同步' })
    .locator('.task-action-boundary.skipped', {
      hasText: '跳过不会覆盖最近成功结果',
    })
    .waitFor({ timeout: 15000 });

  assert.equal((await visibleTaskNames(page)).length, 8);
  await page.locator('.task-row', { hasText: '静默消息分析' }).waitFor({
    timeout: 15000,
  });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-result', { hasText: '上次成功 · 无到期摘要' })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-latest-run', {
      hasText: '最近一次 · 排程成功 · 100ms · 无到期摘要',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary', {
      hasText: '本地摘要队列',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-grid', {
      hasText: '2 条本地待释放',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-grid', {
      hasText: '1 条已到释放窗口',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-grid', {
      hasText: '最早后续释放',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-details', {
      hasText: 'Release risks 2 条',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-details', {
      hasText: /每日 \d{2}:00.*每日 \d{2}:00/,
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-boundary', {
      hasText: '释放窗口回执',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-boundary', {
      hasText: '等待后台任务推送',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-boundary', {
      hasText: '本地延迟摘要：到达释放窗口后由后台任务推送',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-boundary', {
      hasText: '通常 15 分钟内检查',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-boundary', {
      hasText: '查看或刷新不立即发送、不写入 Memory Service、不确认通知',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-status-receipt.running', {
      hasText: '最近成功',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-action-boundary.running', {
      hasText: '开关只改变排程；立即执行只跑一次，并保留运行历史',
    })
    .waitFor({ timeout: 15000 });

  await page.evaluate(() => {
    const previousSendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
    window.__restoreTaskSchedulerQueueUnavailableSendMessage = () => {
      chrome.runtime.sendMessage = previousSendMessage;
    };

    chrome.runtime.sendMessage = async (message, ...args) => {
      if (message?.type !== 'GET_TASK_SCHEDULER_STATUS') {
        return previousSendMessage(message, ...args);
      }

      const baseResponse = await previousSendMessage(message, ...args);
      if (!baseResponse?.success || !Array.isArray(baseResponse.tasks)) {
        return baseResponse;
      }

      const tasks = baseResponse.tasks.map((task) =>
        task.id === 'digest_queue_process'
          ? {
              ...task,
              currentQueueStatus: undefined,
              currentQueueStatusError: 'digest queue index unavailable',
              currentQueueSummary:
                '本地摘要队列状态未确认：本次刷新未能读取队列明细；刷新没有立即发送摘要、不写入 Memory Service、不确认通知，可稍后重试或检查本地摘要配置；失败原因：digest queue index unavailable',
            }
          : task,
      );

      return {
        ...baseResponse,
        tasks,
        refreshReceipt: {
          ...baseResponse.refreshReceipt,
          queueStatusUnavailableCount: 1,
        },
      };
    };
  });
  await page.locator('.task-refresh-btn').click();
  await page
    .locator('.task-refresh-receipt.warning', {
      hasText: '1 个队列明细未确认，详见任务行',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-grid', {
      hasText: '状态未确认',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-grid', {
      hasText: '本次未读取到队列明细',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-details', {
      hasText: '失败原因：digest queue index unavailable',
    })
    .waitFor({ timeout: 15000 });
  await page
    .locator('.task-row', { hasText: '汇总推送队列处理' })
    .locator('.task-queue-summary-boundary', {
      hasText: '本次刷新没有立即发送摘要、不写入 Memory Service、不确认通知',
    })
    .waitFor({ timeout: 15000 });
  await page.evaluate(() =>
    window.__restoreTaskSchedulerQueueUnavailableSendMessage(),
  );
  await page.locator('.task-refresh-btn').click();

  await serviceWorker.evaluate(async ({ now }) => {
    await chrome.storage.local.set({
      personalAiUiPreferences: {
        language: 'en-US',
        updatedAt: now,
      },
    });
  }, { now: Date.now() });

  const englishPage = await context.newPage();
  const assertNoEnglishPageErrors = collectPageErrors(englishPage);
  await englishPage.route('https://memory.local/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: { cards: [] } }),
    });
  });
  await englishPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await englishPage
    .locator('.toggle-label', {
      hasText: 'Analyze msg in background · every',
    })
    .waitFor({ timeout: 15000 });
  const englishToggleLabel =
    (await englishPage.locator('.toggle-label').textContent()) || '';
  assert.doesNotMatch(englishToggleLabel, /静默消息分析|每/);
  const headerButtonTitles = await englishPage
    .locator('.header-icons .header-icon-btn')
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('title')),
    );
  assert.deepEqual(headerButtonTitles, [
    'Desktop App',
    'Share with colleagues',
    'View help docs',
  ]);
  await englishPage.locator('.task-status-panel summary').click();
  await englishPage
    .locator('.task-status-panel summary', { hasText: 'Background Tasks' })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-refresh-receipt', {
      hasText: 'Refresh receipt: checked 8 tasks',
    })
    .waitFor({ timeout: 15000 });
  assert.match(
    (await englishPage.locator('.task-refresh-meta').textContent()) || '',
    /Last confirmed .* · .+/,
    'English task panel should show last confirmed snapshot time',
  );
  await englishPage
    .locator('.task-refresh-receipt', {
      hasText: 'it did not run tasks, enable or pause tasks, or clear run history',
    })
    .waitFor({ timeout: 15000 });
  const englishTaskSummary =
    (await englishPage.locator('.task-summary').textContent()) || '';
  assert.match(englishTaskSummary, /enabled/);
  assert.doesNotMatch(englishTaskSummary, /启用/);
  assert.equal(await englishPage.locator('.task-health-chip').count(), 0);
  await englishPage
    .locator('.task-row', { hasText: 'Analyze msg in background' })
    .locator('.task-state-badge', { hasText: 'Disabled' })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary', {
      hasText: 'Local digest queue',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-grid', {
      hasText: '2 items pending locally',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-grid', {
      hasText: '1 item in the release window',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-grid', {
      hasText: 'Earliest future release',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-details', {
      hasText: 'Release risks x2',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-details', {
      hasText: /daily \d{2}:00.*daily \d{2}:00/,
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-boundary', {
      hasText: 'Release-window receipt',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-boundary', {
      hasText: 'ready for the next background task',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-boundary', {
      hasText:
        'Local delayed digest: after the release window, the background task checks within about 15 minutes',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-queue-summary-boundary', {
      hasText:
        'viewing or refreshing does not send now, write to Memory Service, or confirm notifications',
    })
    .waitFor({ timeout: 15000 });
  await englishPage
    .locator('.task-row', { hasText: 'Digest queue' })
    .locator('.task-action-boundary.running', {
      hasText:
        'Action scope: the switch only changes the schedule; Run now is one-time and keeps history.',
    })
    .waitFor({ timeout: 15000 });
  const englishQueueSummary =
    (await englishPage
      .locator('.task-row', { hasText: 'Digest queue' })
      .locator('.task-queue-summary')
      .textContent()) || '';
  assert.doesNotMatch(englishQueueSummary, /本地摘要队列|暂无到期|每日/);
  assertNoEnglishPageErrors();
  await englishPage.close();

  assertNoPageErrors();
  await context.close();
  await fs.rm(launched.userDataDir, { recursive: true, force: true });
  console.log('verify-task-scheduler-popup-filters-e2e: ok');
} catch (error) {
  if (launched?.context) await launched.context.close().catch(() => undefined);
  if (launched?.userDataDir) {
    await fs
      .rm(launched.userDataDir, { recursive: true, force: true })
      .catch(() => undefined);
  }
  throw error;
}
