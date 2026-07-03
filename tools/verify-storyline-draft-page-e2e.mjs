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
        if (body.prepId === 'prep-llm-fallback') {
          return new Response(
            JSON.stringify({
              id: 'storyline-draft-fallback-e2e',
              sourceKind: 'today_meeting_prep',
              sourceId: body.prepId,
              title: 'Fallback cue-card story',
              audience: '项目组',
              targetArtifact,
              segments: [
                {
                  title: '背景',
                  intent: '保留可讲述的背景。',
                  narrative: '模型失败后仍用会前准备证据生成内部草稿。',
                  evidenceIds: ['memory-1'],
                },
                {
                  title: '风险',
                  intent: '提醒复制前复核。',
                  narrative: '这份 fallback 输出只能作为人工复核草稿。',
                  evidenceIds: ['memory-2'],
                },
                {
                  title: '下一步',
                  intent: '收敛到可行动事项。',
                  narrative: '按 Evidence key 复核后再复制给目标位置。',
                  evidenceIds: ['memory-3'],
                },
              ],
              evidence: [
                {
                  id: 'memory-1',
                  type: 'message',
                  sourceLabel: 'RingCentral',
                  sourceTitle: 'Fallback source',
                  snippet: '模型失败后仍用会前准备证据生成内部草稿。',
                },
                {
                  id: 'memory-2',
                  type: 'chunk',
                  sourceLabel: 'Jira',
                  sourceTitle: 'Fallback risk',
                  snippet: '这份 fallback 输出只能作为人工复核草稿。',
                },
                {
                  id: 'memory-3',
                  type: 'source_memory',
                  sourceLabel: 'Source Memory',
                  sourceTitle: 'Fallback next step',
                  snippet: '按 Evidence key 复核后再复制给目标位置。',
                },
              ],
              gaps: [],
              riskNotes: [
                '模型生成失败，已用会前准备证据生成 fallback 草稿；请按 Evidence key 复核后再外发。',
              ],
              generationReceipt: {
                generationMode: 'fallback_cue_cards',
                fallbackReason: 'llm_generation_failed',
                sourceKind: 'today_meeting_prep',
                sourceId: body.prepId,
                targetArtifact,
                audience: '项目组',
                sourceEvidenceRefCount: 3,
                citedEvidenceRefCount: 3,
                returnedEvidenceDetailCount: 3,
                missingEvidenceDetailCount: 0,
                boundary: 'draft_only_manual_copy_no_external_write',
              },
              artifactText: [
                '# Docs Brief',
                '',
                'Fallback cue-card story',
                '',
                '## Evidence key',
                '- memory-1: RingCentral - Fallback source',
              ].join('\n'),
            }),
            {
              status: 200,
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
              {
                id: 'memory-4',
                type: 'message',
                sourceLabel: 'Unused CRM',
                sourceTitle: 'Returned but not cited',
                snippet: '这条证据返回给页面，但当前草稿没有引用。',
              },
            ],
            gaps: ['确认哪些素材可以对外分享。'],
            riskNotes: ['复制前去掉内部链接。'],
            generationReceipt: {
              generationMode: 'llm_grounded',
              sourceKind: 'today_meeting_prep',
              sourceId: body.prepId || 'prep-storyline',
              targetArtifact,
              audience: '项目组',
              sourceEvidenceRefCount: 4,
              citedEvidenceRefCount: 3,
              returnedEvidenceDetailCount: 4,
              missingEvidenceDetailCount: 0,
              boundary: 'draft_only_manual_copy_no_external_write',
            },
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
    assert(
      bodyText?.includes('生成范围回执'),
      'generation receipt section missing',
    );
    assert(
      bodyText?.includes('LLM 草稿，服务端已核对证据'),
      'generation receipt mode missing',
    );
    assert(
      bodyText?.includes('来源 4 refs') &&
        bodyText.includes('草稿引用 3 refs') &&
        bodyText.includes('返回详情 4 条'),
      'generation receipt evidence counts missing',
    );
    assert(
      bodyText?.includes('不写回 Slides / Docs / RingCentral'),
      'generation receipt boundary missing',
    );
    assert(
      bodyText?.includes('已引用 3 refs · 返回 4 详情'),
      'cited-vs-returned evidence receipt missing',
    );
    assert(bodyText?.includes('Workshop planning thread'), 'evidence detail missing');
    assert(
      !bodyText?.includes('Unused CRM'),
      'uncited returned evidence should not be counted in the cited-source strip',
    );
    assert(bodyText?.includes('打开记忆'), 'safe memory route link missing');
    assert(bodyText?.includes('打开来源 · example.com'), 'safe source link missing');
    assert(
      bodyText?.includes('不安全链接已隐藏'),
      'unsafe evidence link warning missing',
    );
    const sourceLink = page.locator('.evidence-actions a', {
      hasText: '打开来源 · example.com',
    });
    assert.equal(
      await sourceLink.first().getAttribute('rel'),
      'noopener noreferrer',
      'external source links should use noopener/noreferrer',
    );
    await sourceLink
      .first()
      .evaluate((element) =>
        element.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true }),
        ),
      );
    const sourceOpenReceipt = page.locator('.source-open-receipt');
    await sourceOpenReceipt.waitFor({ state: 'visible', timeout: 5000 });
    const sourceOpenReceiptText = await sourceOpenReceipt.textContent();
    assert(
      sourceOpenReceiptText?.includes('来源打开回执'),
      'source-open receipt title missing',
    );
    assert(
      sourceOpenReceiptText?.includes('example.com · Workshop planning thread'),
      'source-open receipt source summary missing',
    );
    assert(
      sourceOpenReceiptText?.includes('本页没有重新读取会前准备') &&
        sourceOpenReceiptText.includes('同步 Memory Service') &&
        sourceOpenReceiptText.includes('写回 Slides / Docs / RingCentral') &&
        sourceOpenReceiptText.includes('没有满足复制前复核'),
      'source-open receipt boundary missing',
    );
    assert(bodyText?.includes('Slides 提纲'), 'artifact label missing');
    assert(bodyText?.includes('确认哪些素材可以对外分享'), 'gap text missing');
    assert(bodyText?.includes('复制前去掉内部链接'), 'risk note missing');
    assert(bodyText?.includes('单条证据'), 'segment grounding state missing');
    assert(bodyText?.includes('1 个详情'), 'segment grounding detail count missing');
    assert(
      bodyText?.includes('Draft grounding review'),
      'draft grounding review section missing',
    );
    assert(
      bodyText?.includes('3 段需要复核证据边界'),
      'segment grounding review summary missing',
    );
    assert(
      bodyText?.includes('SEG 01 只有 1 条 ref'),
      'segment grounding detail missing',
    );
    assert(
      bodyText?.includes('已复核 1 个待确认、1 条边界提醒和 3 段证据边界'),
      'pre-copy review gate missing',
    );
    assert(
      bodyText?.includes('复制前复核清单') &&
        bodyText.includes('待确认 1') &&
        bodyText.includes('边界提醒 1') &&
        bodyText.includes('SEG 03 · 单条证据'),
      'pre-copy review checklist missing actionable items',
    );
    await page.locator('.review-checklist-item', { hasText: 'SEG 03' }).click();
    await page.waitForFunction(() =>
      document.querySelector('.segment.active h3')?.textContent?.includes('下一步'),
    );
    const selectedSegmentText = await page.$eval(
      '.draft-area',
      (textarea) => textarea.value,
    );
    assert(
      selectedSegmentText?.includes('后续要确认哪些内容可以转成长期 Storyline'),
      'review checklist segment click should focus the matching inspector segment',
    );
    assert(
      bodyText?.includes('先复核 1 个待确认、1 条边界提醒和 3 段证据边界'),
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
      '先复核 1 个待确认、1 条边界提醒和 3 段证据边界',
      'header copy button should explain why it is disabled',
    );
    assert.equal(
      await copyButton.isDisabled(),
      true,
      'copy should be disabled until review is acknowledged',
    );
    await page.locator('.review-gate input[type="checkbox"]').check();
    await page.waitForFunction(() =>
      !document.body.textContent?.includes(
        '先复核 1 个待确认、1 条边界提醒和 3 段证据边界',
      ),
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
    const copyReceipt = page.locator('.copy-receipt');
    await copyReceipt.waitFor({ state: 'visible', timeout: 5000 });
    const copyReceiptText = await copyReceipt.textContent();
    assert(copyReceiptText?.includes('复制回执'), 'copy receipt title missing');
    assert(
      copyReceiptText?.includes('Slides 提纲 · Workshop 复盘故事线'),
      'copy receipt snapshot target missing',
    );
    assert(
      copyReceiptText?.includes('引用 3 refs') &&
        copyReceiptText.includes('返回详情 4 条'),
      'copy receipt evidence snapshot missing',
    );
    assert(
      copyReceiptText?.includes('已复核 1 个待确认、1 条边界提醒和 3 段证据边界'),
      'copy receipt review snapshot missing',
    );
    assert(
      copyReceiptText?.includes('只复制到本机剪贴板') &&
        copyReceiptText.includes('没有写回 Slides / Docs / RingCentral') &&
        copyReceiptText.includes('没有保存长期 Storyline 历史') &&
        copyReceiptText.includes('没有更新 Memory Service 证据状态'),
      'copy receipt no-write boundary missing',
    );
    await page.locator('.target-segmented button', { hasText: '分享帖' }).click();
    await page.waitForFunction(() =>
      document.body.textContent?.includes('旧复制回执'),
    );
    const staleCopyReceiptText = await copyReceipt.textContent();
    assert(
      staleCopyReceiptText?.includes('旧复制回执'),
      'stale copy receipt title missing after target change',
    );
    assert(
      staleCopyReceiptText?.includes('剪贴板仍是上一份 Storyline 输出') &&
        staleCopyReceiptText.includes('当前页面已经切到 RingCentral 分享帖') &&
        staleCopyReceiptText.includes('交付前请重新复制'),
      'stale copy receipt boundary missing after target change',
    );
    const requestsAfterCopyTargetChange = await page.evaluate(
      () => window.__storylineDraftRequests,
    );
    assert.deepEqual(
      requestsAfterCopyTargetChange,
      ['speaker_notes', 'slides_outline', 'ringcentral_post'],
      'storyline draft should request the copied artifact and then the new target',
    );
    await page.waitForFunction(() =>
      document.body.textContent?.includes(
        '先复核 1 个待确认、1 条边界提醒和 3 段证据边界',
      ),
    );
    assert.equal(
      await page.locator('.header-actions .btn.primary').isDisabled(),
      true,
      'target changes should invalidate the previous review acknowledgement before copy',
    );
    await page.evaluate(() => {
      window.location.hash =
        '#/storylines/draft?source=compose_assist&prepId=prep-storyline&target=slides_outline';
    });
    await page.waitForFunction(() =>
      document.body.textContent?.includes(
        '当前 Storyline Draft 只支持 Today Pilot 会前准备来源',
      ),
    );
    const unsupportedHashText = await page.textContent('body');
    assert(
      unsupportedHashText?.includes('生成失败'),
      'unsupported hash source should render a failure state',
    );
    assert(
      !unsupportedHashText?.includes('Storyline canvas'),
      'unsupported hash source should clear the previous draft canvas',
    );
    const requestsAfterHashUnsupportedSource = await page.evaluate(
      () => window.__storylineDraftRequests,
    );
    assert.deepEqual(
      requestsAfterHashUnsupportedSource,
      requestsAfterCopyTargetChange,
      'unsupported hash source should not call the draft API',
    );
    await page.goto(
      `${pathToFileURL(memoryExploringHtml).href}#/storylines/draft?source=compose_assist&prepId=prep-storyline&target=speaker_notes`,
    );
    await page.waitForFunction(() =>
      document.body.textContent?.includes(
        '当前 Storyline Draft 只支持 Today Pilot 会前准备来源',
      ),
    );
    const unsupportedSourceText = await page.textContent('body');
    assert(
      unsupportedSourceText?.includes('生成失败'),
      'unsupported storyline source should render a failure state',
    );
    assert(
      unsupportedSourceText?.includes('compose_assist'),
      'unsupported source label should remain visible for diagnosis',
    );
    const requestsAfterUnsupportedSource = await page.evaluate(
      () => window.__storylineDraftRequests,
    );
    assert.deepEqual(
      requestsAfterUnsupportedSource,
      requestsAfterCopyTargetChange,
      'unsupported storyline source should not call the draft API',
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
    assert(
      emptyPrepText?.includes('生成失败，未复制旧草稿'),
      'failed draft loads should expose that the previous draft was not copied',
    );
    assert.equal(
      await page.locator('.header-actions .btn.primary').isDisabled(),
      true,
      'failed draft loads should not leave the hidden previous draft copyable',
    );
    await page.goto(
      `${pathToFileURL(memoryExploringHtml).href}#/storylines/draft?source=today_meeting_prep&prepId=prep-llm-fallback&target=docs_brief`,
    );
    await page.waitForFunction(() =>
      document.body.textContent?.includes('服务端未拿到模型草稿'),
    );
    const fallbackText = await page.textContent('body');
    assert(
      fallbackText?.includes('Fallback 草稿，已重新绑定证据'),
      'llm failure fallback mode should be visible',
    );
    assert(
      fallbackText?.includes('这份输出仍绑定 Evidence key') &&
        fallbackText.includes('复制前重点复核事实和外发边界'),
      'llm failure fallback warning should be specific',
    );

    await page.evaluate(() => {
      window.__storylineDraftRequests = [];
    });
    await page.goto(
      `${pathToFileURL(memoryExploringHtml).href}#/storylines/draft?source=today_meeting_prep&prepId=prep-cache&target=slides_outline`,
    );
    await page.waitForFunction(() =>
      document.body.textContent?.includes('Workshop 复盘故事线'),
    );
    const requestsBeforeCacheReload = await page.evaluate(
      () => window.__storylineDraftRequests,
    );
    assert.deepEqual(
      requestsBeforeCacheReload,
      ['slides_outline'],
      'cache setup should make one draft API request before reload',
    );
    await page.reload();
    await page.waitForFunction(() =>
      document.body.textContent?.includes('会话缓存回执'),
    );
    const cachedReloadText = await page.textContent('body');
    assert(
      cachedReloadText?.includes('复用本页会话缓存'),
      'session cache receipt headline missing after reload',
    );
    assert(
      cachedReloadText?.includes('没有重新调用 Draft API') &&
        cachedReloadText.includes('没有重新读取会前准备') &&
        cachedReloadText.includes('刷新证据详情') &&
        cachedReloadText.includes('同步 Memory Service') &&
        cachedReloadText.includes('请点重新生成后再复制'),
      'session cache receipt boundary missing after reload',
    );
    assert(
      cachedReloadText?.includes('Workshop 复盘故事线'),
      'cached reload should still render the cached draft',
    );
    const requestsAfterCacheReload = await page.evaluate(
      () => window.__storylineDraftRequests,
    );
    assert.deepEqual(
      requestsAfterCacheReload,
      [],
      'cached reload should not call the draft API again',
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
