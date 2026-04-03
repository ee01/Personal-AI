import { chromium } from 'playwright';

const profileDir = process.env.DOUBAO_PROFILE_DIR;
const threadUrl = process.env.DOUBAO_THREAD_URL;

const ctx = await chromium.launchPersistentContext(profileDir, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();

const dump = (label, data) => {
  console.log(`===${label}===`);
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log(`===/${label}===`);
};

page.on('request', async (req) => {
  if (!req.url().includes('/chat/completion')) return;
  dump('URL', req.url());
  dump('METHOD', req.method());
  dump('HEADERS', await req.allHeaders());
  dump('POSTDATA', req.postData() || '');
});

page.on('response', async (res) => {
  const req = res.request();
  if (!req.url().includes('/chat/completion')) return;
  let text = '';
  try { text = await res.text(); } catch {}
  dump('RESPONSE_STATUS', String(res.status()));
  dump('RESPONSE_BODY', text.slice(0, 4000));
});

await page.goto(threadUrl, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1500);

const selectors = [
  'textarea:not([disabled]):not([readonly])',
  '[role="textbox"][contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[contenteditable="true"]',
  'div[data-lexical-editor="true"]',
  'input[type="text"]:not([disabled]):not([readonly])',
];
let composer = null;
for (const selector of selectors) {
  const loc = page.locator(selector).first();
  if (await loc.count().catch(() => 0) && await loc.isVisible().catch(() => false)) {
    composer = loc;
    break;
  }
}
if (!composer) throw new Error('no composer');

await composer.click().catch(() => {});
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
await page.keyboard.press('Backspace').catch(() => {});
await page.waitForTimeout(200);
await page.evaluate(async (text) => { await navigator.clipboard.writeText(text); }, '[模板抓取] 请忽略这条测试。');
await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
await page.waitForTimeout(1800);

const sendSelectors = [
  'button[aria-label*="发送"]',
  'button[aria-label*="Send"]',
  'button[title*="发送"]',
  'button[title*="Send"]',
  'button[data-testid*="send"]',
];
let send = null;
for (const selector of sendSelectors) {
  const loc = page.locator(selector).first();
  if (await loc.count().catch(() => 0) && await loc.isVisible().catch(() => false)) {
    send = loc;
    break;
  }
}
if (send) {
  await send.click().catch(async () => { await page.keyboard.press('Enter'); });
} else {
  await page.keyboard.press('Enter');
}

await page.waitForTimeout(8000);
await ctx.close();
