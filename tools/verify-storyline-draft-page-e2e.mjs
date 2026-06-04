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
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('clipboard denied in e2e');
        },
      },
    });
    document.execCommand = (command) => {
      window.__storylineCopyCommand = command;
      window.__storylineCopyValue = document.activeElement?.value || '';
      return command === 'copy';
    };
    window.__storylineDraftRequests = [];
    window.fetch = async (url, init) => {
      const href = String(url);
      if (href.includes('/api/v1/storylines/draft')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const targetArtifact = body.targetArtifact || 'speaker_notes';
        window.__storylineDraftRequests.push(targetArtifact);
        if (body.prepId === 'prep-empty') {
          return new Response(
            JSON.stringify({
              error: 'storyline_source_has_no_usable_evidence',
              detail:
                'Storyline draft requires at least one usable evidence ref from the source meeting prep.',
            }),
            {
              status: 422,
              headers: { 'content-type': 'application/json' },
            },
          );
        }
        if (targetArtifact === 'speaker_notes') {
          await new Promise((resolve) => setTimeout(resolve, 180));
        }
        const isSlides = targetArtifact === 'slides_outline';
        return new Response(
          JSON.stringify({
            id: 'storyline-draft-e2e',
            sourceKind: 'today_meeting_prep',
            sourceId: body.prepId || 'prep-storyline',
            title: isSlides ? 'Workshop 复盘故事线' : '旧请求口播稿',
            audience: '项目组',
            targetArtifact,
            segments: [
              {
                title: '背景',
                intent: '说明为什么需要复盘。',
                narrative: isSlides
                  ? 'Workshop 沉淀了可复用的自动化经验。'
                  : '旧口播稿请求已经不是当前选择。',
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
            evidence: [
              {
                id: 'memory-1',
                type: 'message',
                sourceLabel: 'RingCentral',
                sourceTitle: 'Workshop planning thread',
                sourceUrl: 'https://example.com/workshop-planning',
                exploreLink: '#/source-memory/memory-1',
                snippet: 'Workshop 沉淀了可复用的自动化经验。',
                links: [
                  {
                    label: '辅助材料',
                    url: 'https://example.com/workshop-support',
                  },
                  {
                    label: '不安全链接',
                    url: 'javascript:alert(1)',
                  },
                ],
              },
              {
                id: 'memory-2',
                type: 'chunk',
                sourceLabel: 'Jira',
                sourceTitle: 'Automation rollout note',
                snippet: '会议记忆、Jira 和技能沉淀被组合成素材。',
              },
              {
                id: 'memory-3',
                type: 'source_memory',
                sourceLabel: 'Source Memory',
                sourceTitle: 'Storyline follow-up',
                snippet: '确认哪些内容可以转成长期 Storyline。',
              },
            ],
            gaps: ['确认哪些素材可以对外分享。'],
            riskNotes: ['复制前去掉内部链接。'],
            artifactText: isSlides
              ? [
                  '# Slides Outline',
                  '',
                  '1. 背景',
                  '2. 做法',
                  '3. 下一步',
                  '',
                  '## Evidence key',
                  '- memory-1: RingCentral - Workshop planning thread',
                ].join('\n')
              : '# Speaker Notes\n\n旧请求不应覆盖当前 Slides 选择。',
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
    const url = `${pathToFileURL(memoryExploringHtml).href}#/storylines/draft?source=today_meeting_prep&prepId=prep-storyline&target=speaker_notes`;
    await page.goto(url);
    await page.waitForSelector('.storyline-page');
    await page.locator('.target-segmented button', { hasText: 'Slides' }).click();
    await page.waitForFunction(() =>
      document.body.textContent?.includes('Workshop 复盘故事线'),
    );
    await page.waitForTimeout(260);
    const bodyText = await page.textContent('body');
    assert(
      !bodyText?.includes('旧请求口播稿'),
      'stale speaker-notes response overwrote the selected Slides draft',
    );
    assert(bodyText?.includes('Storyline canvas'), 'canvas section missing');
    assert(bodyText?.includes('Inspector'), 'inspector panel missing');
    assert(bodyText?.includes('Workshop planning thread'), 'evidence detail missing');
    assert(bodyText?.includes('打开记忆'), 'safe memory route link missing');
    assert(bodyText?.includes('打开来源 · example.com'), 'safe source link missing');
    assert(
      bodyText?.includes('不安全链接已隐藏'),
      'unsafe evidence link warning missing',
    );
    assert(bodyText?.includes('Slides 提纲'), 'artifact label missing');
    assert(bodyText?.includes('确认哪些素材可以对外分享'), 'gap text missing');
    assert(bodyText?.includes('复制前去掉内部链接'), 'risk note missing');
    assert(bodyText?.includes('单条证据'), 'segment grounding state missing');
    assert(bodyText?.includes('1 个详情'), 'segment grounding detail count missing');
    assert(
      bodyText?.includes('已复核 1 个待确认和 1 条边界提醒'),
      'pre-copy review gate missing',
    );
    assert(
      bodyText?.includes('先复核 1 个待确认和 1 条边界提醒'),
      'header copy gate reason missing',
    );
    const artifactValue = await page.$eval(
      '.artifact-output textarea',
      (textarea) => textarea.value,
    );
    assert(
      artifactValue.includes('# Slides Outline'),
      'artifact textarea missing generated text',
    );
    assert(
      artifactValue.includes('## Evidence key'),
      'artifact textarea missing evidence key',
    );
    assert(
      !artifactValue.includes('# Speaker Notes'),
      'artifact textarea was overwritten by the stale speaker-notes result',
    );
    const requests = await page.evaluate(() => window.__storylineDraftRequests);
    assert.deepEqual(
      requests,
      ['speaker_notes', 'slides_outline'],
      'storyline draft should request the initial and selected artifact targets',
    );
    const copyButton = page.locator('.artifact-output button', {
      hasText: /^复制$/,
    });
    const headerCopyTitle = await page
      .locator('.header-actions .btn.primary')
      .getAttribute('title');
    assert.equal(
      headerCopyTitle,
      '先复核 1 个待确认和 1 条边界提醒',
      'header copy button should explain why it is disabled',
    );
    assert.equal(
      await copyButton.isDisabled(),
      true,
      'copy should be disabled until review is acknowledged',
    );
    await page.locator('.review-gate input[type="checkbox"]').check();
    await page.waitForFunction(() =>
      !document.body.textContent?.includes('先复核 1 个待确认和 1 条边界提醒'),
    );
    assert.equal(
      await copyButton.isEnabled(),
      true,
      'copy should be enabled after review acknowledgement',
    );
    await copyButton.click();
    await page.waitForFunction(() =>
      document.body.textContent?.includes('已复制'),
    );
    const copiedValue = await page.evaluate(() => window.__storylineCopyValue);
    assert(
      copiedValue.includes('# Slides Outline'),
      'copy fallback did not select generated artifact text',
    );
    await page.goto(
      `${pathToFileURL(memoryExploringHtml).href}#/storylines/draft?source=today_meeting_prep&prepId=prep-empty&target=speaker_notes`,
    );
    await page.waitForFunction(() =>
      document.body.textContent?.includes(
        '这份会前准备没有可追溯的 evidence refs',
      ),
    );
    const emptyPrepText = await page.textContent('body');
    assert(
      emptyPrepText?.includes('生成失败'),
      'empty-evidence prep should render a failure state',
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
