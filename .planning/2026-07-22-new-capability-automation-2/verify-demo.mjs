import { chromium } from '../../desktop-app/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const demo = path.join(root, 'docs/progressing/memory-claim-attribution-demo.html');
const output = path.join(root, '.planning/2026-07-22-new-capability-automation-2/screenshots');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

async function verify(name, viewport) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(`console: ${message.text()}`);
  });
  await page.goto(pathToFileURL(demo).href);
  await page.waitForSelector('[data-scene="mixed"].active');

  const scenes = ['mixed', 'meeting', 'ask'];
  for (const scene of scenes) {
    await page.click(`[data-scene="${scene}"]`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    if (overflow) failures.push(`${name}/${scene}: horizontal overflow`);
  }

  await page.click('[data-scene="mixed"]');
  await page.click('[data-claim-id="mixed-ai"]');
  if (viewport.width <= 720) await page.click('#closeRail');
  await page.click('#rememberButton');
  if (!(await page.locator('#memoryReceipt').isVisible())) {
    failures.push(`${name}: memory receipt did not become visible`);
  }

  await page.click('[data-scene="meeting"]');
  await page.click('[data-claim-id="meeting-assigned"]');
  const correction = page.locator('[data-correction="my-decision"]').last();
  await correction.click();
  const correctedText = await page.locator('.attribution-badge').textContent();
  if (!correctedText?.includes('我的决定')) {
    failures.push(`${name}: correction did not update attribution`);
  }
  if (viewport.width <= 720) await page.click('#closeRail');

  await page.click('[data-scene="ask"]');
  const answer = await page.locator('.ask-answer strong').textContent();
  if (!answer?.includes('保留 Vue')) failures.push(`${name}: Ask answer missing`);

  await page.screenshot({
    path: path.join(output, `${name}.png`),
    fullPage: true,
  });

  if (pageErrors.length) failures.push(`${name}: ${pageErrors.join(' | ')}`);
  await page.close();
}

await verify('desktop-1440x900', { width: 1440, height: 900 });
await verify('mobile-390x844', { width: 390, height: 844 });
await browser.close();

if (failures.length) {
  throw new Error(failures.join('\n'));
}
console.log('demo-e2e: desktop + mobile + three scenes + correction + receipt ok');
