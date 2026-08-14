import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '/Users/Esone/git/personal-ai/desktop-app/node_modules/playwright/index.mjs';

const root = '/Users/Esone/git/personal-ai';
const planningDir = path.join(root, '.planning/2026-08-12-automation-2-new-capability-2026-08-12');
const demoPath = path.join(root, 'docs/progressing/common-ground-memory-demo.html');
const canaryPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
const launchOptions = fs.existsSync(canaryPath)
  ? { headless: true, executablePath: canaryPath }
  : { headless: true };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  assert(dimensions.html <= dimensions.viewport + 1, `${label}: html overflow ${JSON.stringify(dimensions)}`);
  assert(dimensions.body <= dimensions.viewport + 1, `${label}: body overflow ${JSON.stringify(dimensions)}`);
}

const browser = await chromium.launch(launchOptions);
const results = [];

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const desktopErrors = [];
  desktop.on('pageerror', (error) => desktopErrors.push(`pageerror: ${error.message}`));
  desktop.on('console', (message) => {
    if (message.type() === 'error') desktopErrors.push(`console: ${message.text()}`);
  });
  await desktop.goto(pathToFileURL(demoPath).href, { waitUntil: 'load' });
  await desktop.waitForTimeout(150);
  assert(await desktop.locator('.pa-mark').evaluate((img) => img.complete && img.naturalWidth > 0), 'desktop: Personal AI image did not load');
  assert((await desktop.locator('#ribbonText').textContent()).includes('旧版'), 'desktop: expected delta ribbon');
  await desktop.locator('#expandGround').click();
  assert(await desktop.locator('#groundPanel').isVisible(), 'desktop: evidence panel did not expand');
  await desktop.locator('#deltaAction').click();
  assert((await desktop.locator('#composerText').inputValue()).includes('Feature Freeze / CF'), 'desktop: delta draft not inserted');
  assert((await desktop.locator('#toast').textContent()).includes('未发送'), 'desktop: no-send receipt missing');
  await desktop.locator('#evidenceAction').click();
  assert(await desktop.locator('#evidenceDialog').evaluate((dialog) => dialog.open), 'desktop: evidence dialog did not open');
  await desktop.locator('#dialogClose').click();
  await desktop.locator('[data-scenario="background"]').click();
  await desktop.locator('#deltaAction').click();
  assert((await desktop.locator('#composerText').inputValue()).includes('刚加入的同事'), 'desktop: background-first draft not inserted');
  await desktop.locator('[data-scenario="unknown"]').click();
  assert(await desktop.locator('#deltaAction').isDisabled(), 'desktop: unknown state must disable generation');
  assert((await desktop.locator('#ribbonText').textContent()).includes('证据不足'), 'desktop: unknown-state explanation missing');
  await desktop.locator('[data-view="meeting"]').click();
  assert(await desktop.locator('#meetingView').isVisible(), 'desktop: meeting view did not open');
  await desktop.locator('#meetingOpen').click();
  assert((await desktop.locator('#meetingDraft').textContent()).includes('先补一句背景'), 'desktop: meeting opener not generated');
  await assertNoOverflow(desktop, 'desktop');
  await desktop.screenshot({ path: path.join(planningDir, 'common-ground-memory-desktop.png'), fullPage: true });
  assert(desktopErrors.length === 0, `desktop errors: ${desktopErrors.join(' | ')}`);
  results.push('desktop: render/interactions/no-send/unknown/meeting/overflow = ok');
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobileErrors = [];
  mobile.on('pageerror', (error) => mobileErrors.push(`pageerror: ${error.message}`));
  mobile.on('console', (message) => {
    if (message.type() === 'error') mobileErrors.push(`console: ${message.text()}`);
  });
  await mobile.goto(pathToFileURL(demoPath).href, { waitUntil: 'load' });
  await mobile.waitForTimeout(150);
  await mobile.locator('#expandGround').click();
  assert(await mobile.locator('#groundPanel').isVisible(), 'mobile: bottom sheet did not open');
  const hitTarget = await mobile.locator('#deltaAction').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  assert(hitTarget.height >= 44, `mobile: action hit target below 44px ${JSON.stringify(hitTarget)}`);
  await mobile.locator('#deltaAction').click();
  assert((await mobile.locator('#toast').textContent()).includes('未发送'), 'mobile: no-send receipt missing');
  await assertNoOverflow(mobile, 'mobile');
  await mobile.screenshot({ path: path.join(planningDir, 'common-ground-memory-mobile.png'), fullPage: false });
  assert(mobileErrors.length === 0, `mobile errors: ${mobileErrors.join(' | ')}`);
  results.push('mobile: render/bottom-sheet/hit-target/no-send/overflow = ok');
  await mobile.close();
} finally {
  await browser.close();
}

console.log(results.join('\n'));
