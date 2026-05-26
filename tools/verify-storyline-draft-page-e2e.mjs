import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '../desktop-app/node_modules/playwright/index.js';

const { chromium } = playwright;

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const memoryExploringHtml = path.join(repoRoot, 'dist', 'memory-exploring.html');

async function installMocks(page) {
  await page.addInitScript(() => {
    window.chrome = {
      runtime: {
        lastError: null,
        sendMessage: (_message, callback) => {
          if (typeof callback === 'function') {
            setTimeout(() => callback({ success: true }), 0);
          }
        },
      },
      storage: {
        local: {
          get: (keys, callback) => {
            const result = Array.isArray(keys)
              ? Object.fromEntries(keys.map((key) => [key, undefined]))
              : {};
            if (typeof callback === 'function') {
              callback(result);
              return;
            }
            return Promise.resolve(result);
          },
          set: () => Promise.resolve(),
        },
      },
    };
    window.fetch = async (url, init) => {
      const href = String(url);
      if (href.includes('/api/v1/storylines/draft')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({
            id: 'storyline-draft-e2e',
            sourceKind: 'today_meeting_prep',
            sourceId: body.prepId || 'prep-storyline',
            title: 'Workshop 复盘故事线',
            audience: '项目组',
            targetArtifact: 'slides_outline',
            segments: [
              {
                title: '背景',
                intent: '说明为什么需要复盘。',
                narrative: 'Workshop 沉淀了可复用的自动化经验。',
                evidenceIds: ['memory-1'],
              },
              {
                title: '做法',
                intent: '讲清楚实践路径。',
                narrative: '团队把会议记忆、Jira 和技能沉淀组合成素材。',
                evidenceIds: ['memory-2'],
              },
              {
                title: '下一步',
                intent: '收敛成行动。',
                narrative: '后续要确认哪些内容可以转成长期 Storyline。',
                evidenceIds: ['memory-3'],
              },
            ],
            gaps: ['确认哪些素材可以对外分享。'],
            riskNotes: ['复制前去掉内部链接。'],
            artifactText:
              '# Slides Outline\n\n1. 背景\n2. 做法\n3. 下一步',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
  });
}

async function main() {
  await fs.access(memoryExploringHtml);
  const userDataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'pai-storyline-draft-page-'),
  );
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      viewport: { width: 1360, height: 900 },
    });
    const page = await context.newPage();
    await installMocks(page);
    const url = `${pathToFileURL(memoryExploringHtml).href}#/storylines/draft?source=today_meeting_prep&prepId=prep-storyline&target=slides_outline`;
    await page.goto(url);
    await page.waitForSelector('.storyline-page');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('Workshop 复盘故事线'),
    );
    const bodyText = await page.textContent('body');
    assert(bodyText?.includes('故事线段落'), 'segments section missing');
    assert(bodyText?.includes('Slides 提纲'), 'artifact label missing');
    assert(bodyText?.includes('确认哪些素材可以对外分享'), 'gap text missing');
    assert(bodyText?.includes('复制前去掉内部链接'), 'risk note missing');
    const artifactValue = await page.$eval(
      '.artifact-panel textarea',
      (textarea) => textarea.value,
    );
    assert(
      artifactValue.includes('# Slides Outline'),
      'artifact textarea missing generated text',
    );
    console.log('Storyline draft page E2E verified.');
  } finally {
    await context?.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
