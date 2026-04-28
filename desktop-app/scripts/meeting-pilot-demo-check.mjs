import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const outputDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'meeting-pilot-demo-check-'),
);

function log(message) {
  console.log(`[meeting-pilot] ${message}`);
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(outputDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

function fileUrl(...segments) {
  return pathToFileURL(path.join(repoRoot, ...segments)).href;
}

function buildPageErrorCollector(page) {
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(
      error instanceof Error ? error.stack || error.message : String(error),
    );
  });
  return () => {
    assert.equal(
      pageErrors.length,
      0,
      `页面脚本报错:\n${pageErrors.join('\n\n')}`,
    );
  };
}

async function verifyDanmakuDemo(browser) {
  const page = await browser.newPage();
  const assertNoPageErrors = buildPageErrorCollector(page);

  try {
    log('Scene 8.1 打开 meeting-danmaku-alerts.html');
    await page.goto(fileUrl('docs', 'demo', 'meeting-danmaku-alerts.html'), {
      waitUntil: 'load',
    });
    await page.waitForSelector('.controls-overlay');
    await page.waitForSelector('#radarFab');
    await page.waitForSelector('#toggleCaptureBtn');

    const title = await page.title();
    assert.match(title, /Meeting Pilot/);
    await saveScreenshot(page, 'scene8-1-danmaku-initial.png');

    log('Scene 8.2 点击 Demo 按钮并等待弹幕、P0、记忆弹幕出现');
    await page.locator('button:has-text("播放完整 Demo")').click();
    await page.waitForSelector('.danmaku-item.p2', { timeout: 5000 });
    await page.waitForSelector('.danmaku-item.p1', { timeout: 5000 });
    await page.waitForSelector('.p0-alert', { timeout: 12000 });

    log('Scene 8.2b 直接触发 Memory 弹幕并验证链接渲染');
    await page.locator('button:has-text("Memory — 弹幕")').click();
    await page.locator('.danmaku-item.memory-danmaku a').waitFor({
      state: 'attached',
      timeout: 5000,
    });

    const demoState = await page.evaluate(() => ({
      p0Count: document.querySelectorAll('.p0-alert').length,
      danmakuCount: document.querySelectorAll('.danmaku-item').length,
      memoryCount: document.querySelectorAll('.memory-danmaku').length,
      alertFeedCount: document.querySelectorAll('#alertFeed .alert-card')
        .length,
      memoryLinkText:
        document.querySelector('.memory-danmaku a')?.textContent?.trim() || '',
      memoryHref:
        document.querySelector('.memory-danmaku a')?.getAttribute('href') || '',
    }));

    assert.ok(demoState.p0Count >= 1, '未出现 P0 居中提醒');
    assert.ok(demoState.danmakuCount >= 2, '未出现普通弹幕');
    assert.ok(demoState.memoryCount >= 1, '未出现记忆弹幕');
    assert.ok(demoState.alertFeedCount >= 3, 'Alert Feed 未写入记录');
    assert.match(demoState.memoryLinkText, /查看/);
    assert.match(demoState.memoryHref, /^https:\/\//);
    await saveScreenshot(page, 'scene8-2-danmaku-demo.png');

    log('Scene 8.3 修改弹幕速度并验证 duration 变化');
    await page.locator('#radarFab').click();
    await page.waitForFunction(() =>
      document.getElementById('sidePanel')?.classList.contains('open'),
    );
    await page.locator('.panel-tab[data-tab="settings"]').click();
    await page.waitForFunction(() =>
      document.getElementById('tab-settings')?.classList.contains('active'),
    );

    const createProbeDanmaku = async (speed) =>
      page.evaluate((nextSpeed) => {
        const speedSelect = document.getElementById('danmakuSpeedSelect');
        if (!(speedSelect instanceof HTMLSelectElement)) {
          throw new Error('danmaku speed select 不存在');
        }
        speedSelect.value = nextSpeed;
        speedSelect.dispatchEvent(new Event('change', { bubbles: true }));
        createDanmaku('p1', { icon: '🧪', text: `speed-check-${nextSpeed}` });
        const items = Array.from(document.querySelectorAll('.danmaku-item.p1'));
        const lastItem = items[items.length - 1];
        const storedEnvConfig = localStorage.getItem('envConfig');
        return {
          duration: lastItem
            ? Number.parseFloat(getComputedStyle(lastItem).animationDuration)
            : NaN,
          storedSpeed: storedEnvConfig
            ? JSON.parse(storedEnvConfig).MEETING_DANMAKU_SPEED
            : null,
        };
      }, speed);

    const fastProbe = await createProbeDanmaku('fast');
    const slowProbe = await createProbeDanmaku('slow');

    assert.ok(
      Number.isFinite(fastProbe.duration),
      'fast 弹幕 duration 读取失败',
    );
    assert.ok(
      Number.isFinite(slowProbe.duration),
      'slow 弹幕 duration 读取失败',
    );
    assert.ok(
      slowProbe.duration > fastProbe.duration * 2,
      `slow 弹幕未明显慢于 fast: fast=${fastProbe.duration}s slow=${slowProbe.duration}s`,
    );
    assert.equal(slowProbe.storedSpeed, 'slow', '速度设置未写入 localStorage');
    await saveScreenshot(page, 'scene8-3-danmaku-speed.png');

    assertNoPageErrors();
  } finally {
    await page.close();
  }
}

async function verifyPanoramaDemo(browser) {
  const page = await browser.newPage();
  const assertNoPageErrors = buildPageErrorCollector(page);

  try {
    log('Scene 8.4 打开 meeting-panorama-view.html');
    await page.goto(fileUrl('docs', 'demo', 'meeting-panorama-view.html'), {
      waitUntil: 'load',
    });
    await page.waitForSelector('.stats-strip .stat-card');
    await page.waitForSelector('.stance-section .stance-participant');
    await page.waitForFunction(
      () => document.querySelectorAll('.heatmap-cell').length === 32,
    );
    await saveScreenshot(page, 'scene8-4-panorama-initial.png');

    log('Scene 8.5 点击 PDF 按钮并验证滚动到 PDF 区块');
    const scrollBefore = await page.evaluate(
      () => document.querySelector('.sidebar')?.scrollTop || 0,
    );
    await page.locator('button:has-text("会议纪要 PDF")').click();
    await page.waitForTimeout(1200);

    const scrollState = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const target = document.getElementById('pdfPreviewSection');
      if (
        !(sidebar instanceof HTMLElement) ||
        !(target instanceof HTMLElement)
      ) {
        return { scrollTop: 0, visible: false };
      }
      const sidebarRect = sidebar.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const visible =
        targetRect.top < sidebarRect.bottom &&
        targetRect.bottom > sidebarRect.top;
      return {
        scrollTop: sidebar.scrollTop,
        visible,
      };
    });

    assert.ok(
      scrollState.scrollTop > scrollBefore,
      `点击 PDF 按钮后侧栏未滚动: before=${scrollBefore} after=${scrollState.scrollTop}`,
    );
    assert.ok(scrollState.visible, 'PDF 区块未滚动到可视区域');

    log('Scene 8.6 切换 PDF 状态 Ready ↔ Generating');
    const getPdfState = () =>
      page.evaluate(() => {
        const ready = document.getElementById('pdfStateReady');
        const readyPreview = document.getElementById('pdfPreviewReady');
        const generating = document.getElementById('pdfStateGenerating');
        if (
          !(ready instanceof HTMLElement) ||
          !(readyPreview instanceof HTMLElement) ||
          !(generating instanceof HTMLElement)
        ) {
          throw new Error('PDF 状态节点不存在');
        }
        return {
          readyVisible: getComputedStyle(ready).display !== 'none',
          readyPreviewVisible:
            getComputedStyle(readyPreview).display !== 'none',
          generatingVisible: getComputedStyle(generating).display !== 'none',
        };
      });

    const initialState = await getPdfState();
    assert.equal(initialState.readyVisible, true, '初始 Ready 状态应可见');
    assert.equal(initialState.readyPreviewVisible, true, '初始 PDF 预览应可见');
    assert.equal(
      initialState.generatingVisible,
      false,
      '初始 Generating 状态不应可见',
    );

    await page.evaluate(() => togglePdfState());
    await page.waitForFunction(() => {
      const ready = document.getElementById('pdfStateReady');
      const readyPreview = document.getElementById('pdfPreviewReady');
      const generating = document.getElementById('pdfStateGenerating');
      return (
        ready &&
        readyPreview &&
        generating &&
        getComputedStyle(ready).display === 'none' &&
        getComputedStyle(readyPreview).display === 'none' &&
        getComputedStyle(generating).display !== 'none'
      );
    });
    await saveScreenshot(page, 'scene8-5-panorama-generating.png');

    await page.evaluate(() => togglePdfState());
    await page.waitForFunction(() => {
      const ready = document.getElementById('pdfStateReady');
      const readyPreview = document.getElementById('pdfPreviewReady');
      const generating = document.getElementById('pdfStateGenerating');
      return (
        ready &&
        readyPreview &&
        generating &&
        getComputedStyle(ready).display !== 'none' &&
        getComputedStyle(readyPreview).display !== 'none' &&
        getComputedStyle(generating).display === 'none'
      );
    });
    await saveScreenshot(page, 'scene8-6-panorama-ready.png');

    assertNoPageErrors();
  } finally {
    await page.close();
  }
}

let browser;

try {
  browser = await chromium.launch({
    headless: true,
    args: ['--allow-file-access-from-files'],
  });

  await verifyDanmakuDemo(browser);
  await verifyPanoramaDemo(browser);

  log('Scene 8 验证通过');
  log(`截图输出目录: ${outputDir}`);
} catch (error) {
  console.error('[meeting-pilot] Scene 8 验证失败');
  console.error(error);
  console.error(`[meeting-pilot] 失败时截图目录: ${outputDir}`);
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
}
