import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(appRoot, '..');
const nodeBinDir = path.dirname(process.execPath);
const npmBin = path.join(nodeBinDir, 'npm');
const targetFile = path.join(repoRoot, 'src', 'meeting-shell', 'demo.ts');
const originalMarker = "title: 'Meeting Pilot demo'";
const probeTag = `Meeting Pilot reload probe ${new Date().toISOString()}`;
const updatedMarker = `title: '${probeTag}'`;
const screenshotDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'meeting-pilot-build-check-'),
);

function log(message) {
  console.log(`[meeting-pilot-build] ${message}`);
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        PATH: `${nodeBinDir}:${process.env.PATH || ''}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed with code ${String(code)}`,
        ),
      );
    });
  });
}

async function runBuild() {
  await runCommand(npmBin, ['run', 'build'], repoRoot);
}

async function assertProductionSidePanelBundlePruned() {
  const sidePanelBundle = await fs.readFile(
    path.join(repoRoot, 'dist', 'meeting-sidepanel.js'),
    'utf8',
  );
  assert.equal(
    sidePanelBundle.includes('Capture Log'),
    false,
    '生产 sidepanel bundle 仍包含 Capture Log 文案',
  );
  assert.equal(
    sidePanelBundle.includes('debug-panel'),
    false,
    '生产 sidepanel bundle 仍包含 debug-panel 代码',
  );
}

async function launchExtensionContext() {
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'meeting-pilot-extension-'),
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

async function openSidePanelPage(context, extensionId, query = '') {
  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/meeting-sidepanel.html${query}`,
    {
      waitUntil: 'load',
      timeout: 15000,
    },
  );
  await page.waitForFunction(
    () => {
      const shell = document.querySelector('.meeting-shell');
      return Boolean(shell && shell.getAttribute('data-session-title'));
    },
    { timeout: 15000 },
  );
  return page;
}

async function saveScreenshot(page, filename) {
  const fullPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: fullPath, fullPage: true });
  return fullPath;
}

async function assertSidePanelScenario(page, expectedTitle, screenshotName) {
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  const title =
    (await page.locator('.meeting-shell').getAttribute('data-session-title')) ||
    '';
  assert.equal(title, expectedTitle, `side panel 标题不匹配: ${title}`);

  await page.locator('.panel-tab').nth(1).click();
  await page.waitForFunction(() => {
    const tabs = Array.from(document.querySelectorAll('.panel-tab'));
    return tabs[1]?.classList.contains('active') ?? false;
  });
  await page.waitForSelector('.timeline-card,.timeline-item,.mini-tl-item', {
    timeout: 10000,
  });

  const timelineText =
    (await page.locator('.panel-content').textContent())?.replace(
      /\s+/g,
      ' ',
    ) || '';
  assert.match(
    timelineText,
    /会议开场|Q2 预算讨论|Meeting Pilot/,
    '时间线内容未渲染',
  );

  await saveScreenshot(page, screenshotName);
  assert.deepEqual(pageErrors, [], `页面脚本异常: ${pageErrors.join('; ')}`);
}

const originalSource = await fs.readFile(targetFile, 'utf8');
assert.ok(
  originalSource.includes(originalMarker),
  `未在 ${targetFile} 中找到原始 demo 标题`,
);

let baselineContext;
let updatedContext;

try {
  log('基线检查: 打开当前 dist 扩展的 side panel');
  const baselineLaunch = await launchExtensionContext();
  baselineContext = baselineLaunch.context;
  const baselineExtensionId = baselineLaunch.extensionId;
  const baselinePage = await openSidePanelPage(
    baselineContext,
    baselineExtensionId,
    '?demo=1&baseline=1',
  );
  await assertSidePanelScenario(
    baselinePage,
    'Meeting Pilot demo',
    'baseline-sidepanel.png',
  );
  await baselinePage.close();
  await baselineContext.close();
  baselineContext = undefined;

  log('临时修改 demo 标题并执行 npm run build');
  await fs.writeFile(
    targetFile,
    originalSource.replace(originalMarker, updatedMarker),
    'utf8',
  );
  await runBuild();
  await assertProductionSidePanelBundlePruned();

  log('重启扩展实例并验证新 build 已生效');
  const updatedLaunch = await launchExtensionContext();
  updatedContext = updatedLaunch.context;
  const updatedExtensionId = updatedLaunch.extensionId;
  const updatedPage = await openSidePanelPage(
    updatedContext,
    updatedExtensionId,
    '?demo=1&updated=1',
  );
  await assertSidePanelScenario(updatedPage, probeTag, 'updated-sidepanel.png');
  await updatedPage.close();

  log(`验证通过，截图目录: ${screenshotDir}`);
  log(
    '说明: Playwright 持久化上下文中直接调用 chrome.runtime.reload()/chrome://extensions reload 会让该 unpacked extension 卸载，因此这里使用重新拉起扩展实例作为稳定的 reload 验证方式。',
  );
} finally {
  await fs.writeFile(targetFile, originalSource, 'utf8');
  log('已恢复临时文本改动');
  try {
    await runBuild();
    await assertProductionSidePanelBundlePruned();
    log('已恢复原始 build 产物');
  } catch (error) {
    console.error('[meeting-pilot-build] 恢复 build 失败');
    console.error(error);
    process.exitCode = 1;
  }
  if (updatedContext) {
    await updatedContext.close();
  }
  if (baselineContext) {
    await baselineContext.close();
  }
}
