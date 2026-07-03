import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentScriptPath = path.join(repoRoot, 'src/contentScriptGlip.tsx');
const contentScript = await fs.readFile(contentScriptPath, 'utf8');

function assertSourceContract() {
  const requiredSnippets = [
    "const eyeIcon = document.createElement('button');",
    "eyeIcon.type = 'button';",
    "eyeIcon.setAttribute('aria-label', followAriaLabel);",
    "const badge = document.createElement('button');",
    "badge.type = 'button';",
    "badge.setAttribute('aria-label', relatedAriaLabel);",
    '.follow-thread-eye-icon:focus + .follow-thread-tooltip',
    '.follow-thread-related-badge:focus + .follow-thread-related-tooltip',
    '.glip-ai-marker-badge:focus + .glip-ai-marker-tooltip',
    'function getGlipAiMarkerDisplayLabel',
    'function getGlipAiMarkerTooltipText',
    'function getGlipAiMarkerStatusBoundarySummary',
    'function getGlipAiMarkerNextStepSummary',
    'function getGlipAiMarkerSourceSummary',
    'function normalizeGlipAiMarkerCacheUpdatedAt',
    'function formatGlipAiMarkerCacheUpdatedAt',
    'function getGlipAiMarkerCacheBoundaryNotice',
    'GLIP_AI_MARKER_CACHE_STALE_MS',
    'GLIP_AI_MARKER_CACHE_SECONDS_THRESHOLD',
    'glip-ai-marker-tooltip-receipt',
    'glip-ai-marker-tooltip-status-boundary',
    'glip-ai-marker-tooltip-next-step',
    'glip-ai-marker-tooltip-boundary',
    "Following up means Personal AI is waiting",
    "Remind means this item is still in the Snooze queue",
    "Use Scheduled Messages Remind to complete, reschedule, or delete this reminder.",
    "AI follow-up means an Outreach follow-up send event was recorded",
    "const statusLabel = english ? 'Status meaning' : '状态口径';",
    "const nextStepLabel = english ? 'Next step' : '下一步';",
    "const sourceLabel = english ? 'Marker source' : '标注来源';",
    "const cacheLabel = english ? 'Cache refreshed' : '缓存刷新';",
    'Status meaning: ${statusBoundarySummary}',
    'Next step: ${nextStepSummary}',
    'Marker source: ${sourceSummary}',
    'Cache refreshed: ${cacheSummary}',
    '状态边界：本地标注快照',
  ];

  for (const snippet of requiredSnippets) {
    assert.ok(
      contentScript.includes(snippet),
      `Missing Glip marker keyboard contract snippet: ${snippet}`,
    );
  }
}

async function assertFocusedTooltip(page, buttonName, tooltipText) {
  const button = page.getByRole('button', { name: buttonName });
  await button.focus();
  assert.equal(await button.evaluate((node) => document.activeElement === node), true);

  await page.waitForFunction(
    (text) => {
      const element = Array.from(document.querySelectorAll('div')).find(
        (node) => node.textContent?.includes(text),
      );
      if (!element) return false;
      const style = window.getComputedStyle(element);
      return style.opacity === '1' && style.pointerEvents === 'auto';
    },
    tooltipText,
  );
}

assertSourceContract();

const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage();
try {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          .follow-thread-tooltip,
          .follow-thread-related-tooltip,
          .glip-ai-marker-tooltip {
            opacity: 0;
            pointer-events: none;
          }

          .follow-thread-eye-icon:focus + .follow-thread-tooltip,
          .follow-thread-related-badge:focus + .follow-thread-related-tooltip,
          .glip-ai-marker-badge:focus + .glip-ai-marker-tooltip {
            opacity: 1;
            pointer-events: auto;
          }
        </style>
      </head>
      <body>
        <section>
          <button type="button" class="follow-thread-eye-icon" aria-label="正在关注后续：Release owner"></button>
          <div class="follow-thread-tooltip">原消息摘要 Release owner</div>
        </section>
        <section>
          <button type="button" class="follow-thread-related-badge" aria-label="关注后续的关联消息：blocked by ETA"></button>
          <div class="follow-thread-related-tooltip">关联摘要 blocked by ETA</div>
        </section>
        <section>
          <button type="button" class="glip-ai-marker-badge" aria-label="AI 标注：稍后 6/6 09:00；状态口径：稍后表示仍在 Snooze 队列，未到点前不会由 Bot 提醒；下一步：到 Scheduled Messages 的 Snooze 列表完成、改期或删除这条提醒。；标注来源：Sheet 排期/执行日志 / Memory Service 跟进；缓存刷新：6/8 09:30；状态边界：本地标注快照，不代表实时远端查询。"></button>
          <div class="glip-ai-marker-tooltip">
            <div>稍后 6/6 09:00</div>
            <div class="glip-ai-marker-tooltip-receipt">
              <div class="glip-ai-marker-tooltip-status-boundary">状态口径：稍后表示仍在 Snooze 队列，未到点前不会由 Bot 提醒</div>
              <div class="glip-ai-marker-tooltip-next-step">下一步：到 Scheduled Messages 的 Snooze 列表完成、改期或删除这条提醒。</div>
              <div>标注来源：Sheet 排期/执行日志 / Memory Service 跟进</div>
              <div>缓存刷新：6/8 09:30</div>
              <div class="glip-ai-marker-tooltip-boundary">状态边界：本地标注快照，不代表实时远端查询。</div>
            </div>
          </div>
        </section>
        <section>
          <button type="button" class="glip-ai-marker-badge" aria-label="AI marker: Remind 6/6 09:00; Status meaning: Remind means this item is still in the Snooze queue; Next step: Use Scheduled Messages Remind to complete, reschedule, or delete this reminder.; Marker source: Sheet schedule/log / Memory Service follow-up; Cache refreshed: 6/8, 09:30; Status boundary: local marker snapshot, not a live remote status check."></button>
          <div class="glip-ai-marker-tooltip">
            <div>Remind 6/6 09:00</div>
            <div class="glip-ai-marker-tooltip-receipt">
              <div class="glip-ai-marker-tooltip-status-boundary">Status meaning: Remind means this item is still in the Snooze queue</div>
              <div class="glip-ai-marker-tooltip-next-step">Next step: Use Scheduled Messages Remind to complete, reschedule, or delete this reminder.</div>
              <div>Marker source: Sheet schedule/log / Memory Service follow-up</div>
              <div>Cache refreshed: 6/8, 09:30</div>
              <div class="glip-ai-marker-tooltip-boundary">Status boundary: local marker snapshot, not a live remote status check.</div>
            </div>
          </div>
        </section>
      </body>
    </html>
  `);

  await assertFocusedTooltip(page, /正在关注后续/, '原消息摘要 Release owner');
  await assertFocusedTooltip(page, /关注后续的关联消息/, '关联摘要 blocked by ETA');
  await assertFocusedTooltip(page, /AI 标注/, '稍后 6/6 09:00');
  await assertFocusedTooltip(page, /状态口径/, '仍在 Snooze 队列');
  await assertFocusedTooltip(page, /下一步/, 'Scheduled Messages 的 Snooze 列表');
  await assertFocusedTooltip(page, /标注来源/, 'Sheet 排期/执行日志 / Memory Service 跟进');
  await assertFocusedTooltip(page, /缓存刷新/, '缓存刷新：6/8 09:30');
  await assertFocusedTooltip(page, /状态边界/, '本地标注快照');
  await assertFocusedTooltip(page, /AI marker/, 'Remind 6/6 09:00');
  await assertFocusedTooltip(page, /Status meaning/, 'still in the Snooze queue');
  await assertFocusedTooltip(page, /Next step/, 'complete, reschedule, or delete');
  await assertFocusedTooltip(page, /Marker source/, 'Sheet schedule/log / Memory Service follow-up');
  await assertFocusedTooltip(page, /Cache refreshed/, 'Cache refreshed: 6/8, 09:30');
  await assertFocusedTooltip(page, /Status boundary/, 'local marker snapshot');
} finally {
  await browser.close();
}

console.log('verify-glip-ai-markers-e2e passed');
