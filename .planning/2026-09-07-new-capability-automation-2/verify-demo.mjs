import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/Esone/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = '/Users/Esone/git/personal-ai';
const demo = path.join(root, 'docs/progressing/memory-scene-boundary-demo.html');
const output = path.join(root, '.planning/2026-09-07-new-capability-automation-2');
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
});

const failures = [];

async function checkViewport(name, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(pathToFileURL(demo).href);
  await page.waitForLoadState('load');

  const initial = await page.locator('#ribbonTitle').textContent();
  if (!initial?.includes('这次估算')) failures.push(`${name}: initial state missing`);

  await page.locator('#openLedger').click();
  if (!(await page.locator('#sceneLedger').isVisible())) failures.push(`${name}: ledger did not open`);

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (dimensions.innerWidth !== viewport.width) {
    failures.push(`${name}: viewport not applied ${dimensions.innerWidth}/${viewport.width}`);
  }
  if (dimensions.scrollWidth > dimensions.innerWidth) {
    failures.push(`${name}: horizontal overflow ${dimensions.scrollWidth}/${dimensions.innerWidth}`);
  }

  if (name === 'desktop') {
    await page.screenshot({ path: path.join(output, 'memory-scene-boundary-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: '暂不切' }).click();
    if ((await page.locator('#statusTag').textContent()) !== '暂不切') failures.push('desktop: hold state missing');
    await page.getByRole('button', { name: '切错可恢复' }).click();
    await page.locator('#openRepair').click();
    await page.locator('[data-action="merge"]').click();
    if (!(await page.locator('#repairReceipt').isVisible())) failures.push('desktop: repair receipt missing');
    if (!(await page.locator('#ribbonSubtitle').textContent())?.includes('可撤销')) failures.push('desktop: repaired state missing');
    if (!(await page.locator('.message').first().textContent())?.includes('估算口径')) failures.push('desktop: raw message changed');
    await page.locator('#undoRepair').click();
    if ((await page.locator('#statusTag').textContent()) !== '需复核') failures.push('desktop: undo did not restore recover state');
  } else {
    const targets = ['#openLedger', '#closeLedger', '#openRepair'];
    for (const selector of targets) {
      const box = await page.locator(selector).boundingBox();
      if (!box || box.width < 44 || box.height < 44) failures.push(`${name}: target too small ${selector}`);
    }
    await page.screenshot({ path: path.join(output, 'memory-scene-boundary-mobile.png'), fullPage: true });
  }

  if (errors.length) failures.push(`${name}: ${errors.join(' | ')}`);
  await page.close();
}

await checkViewport('desktop', { width: 1440, height: 960 });
await checkViewport('mobile', { width: 390, height: 844 });
await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('demo_playwright_ok desktop=1440x960 mobile=390x844 interactions=mode,ledger,repair,undo');
