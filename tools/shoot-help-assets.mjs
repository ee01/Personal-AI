#!/usr/bin/env node
/**
 * 帮助中心配图流水线:用 Playwright + 系统 Chrome 加载真实 dist/ 扩展,
 * 拦截 Memory Service 请求返回演示数据,渲染真实组件后截图。
 *
 * 产出全部为演示数据 —— 不连接真实服务、不含真实同事/工作内容。
 *
 * 运行:node tools/shoot-help-assets.mjs [--headed]
 * 依赖:复用 desktop-app/node_modules/playwright
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(path.join(ROOT, 'desktop-app', 'package.json'));
const { chromium } = require('playwright');

const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs/progressing/extension-help-center-assets');
const HEADED = process.argv.includes('--headed');
fs.mkdirSync(OUT, { recursive: true });

/* ---------------- 演示数据 fixtures ---------------- */

const NOW = Date.now();
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

// 关键端点的定制应答;其余走通用兜底
const FIXTURES = [
  {
    match: /\/stats(\?|$)/,
    body: {
      success: true,
      totalMemories: 1284,
      totalEntities: 96,
      totalMessages: 5210,
      user: { userId: 'demo.user', displayName: 'Demo User' },
      sources: { ringcentral: 3120, web: 860, meeting: 420, manual: 810 },
    },
  },
  {
    match: /\/coverage\/map/,
    body: {
      success: true,
      generatedAt: iso(0),
      qualityScore: 78,
      platforms: [
        { platform: 'RingCentral 消息', status: 'healthy', memoryCount: 3120, freshness: 'today', lastSignalAt: iso(30 * 60e3) },
        { platform: '网页资料', status: 'healthy', memoryCount: 860, freshness: 'today', lastSignalAt: iso(2 * 3600e3) },
        { platform: '会议', status: 'partial', memoryCount: 420, freshness: '3d', lastSignalAt: iso(3 * 86400e3) },
        { platform: 'Jira', status: 'healthy', memoryCount: 512, freshness: 'today', lastSignalAt: iso(3600e3) },
        { platform: '外部 AI 会话', status: 'empty', memoryCount: 0, freshness: 'never' },
      ],
      recentSignals: [
        { source: 'RingCentral', summary: '商家认证平台审核进展讨论', at: iso(30 * 60e3) },
        { source: 'web', summary: '定时消息 Apps Script 部署文档', at: iso(2 * 3600e3) },
      ],
    },
  },
  {
    match: /\/(recall|search)(\?|$)/,
    body: {
      success: true,
      results: [
        {
          id: 'm1', type: 'conversation', score: 0.92,
          summary: '商家认证账号:平台审核中,预计明天上午出结果;Rebecca 跟进',
          content: '还在等平台审核,预计明天上午出结果。',
          source: 'ringcentral', createdAt: iso(20 * 3600e3),
          entities: ['商家认证', 'Rebecca'],
        },
        {
          id: 'm2', type: 'source_memory', score: 0.87,
          summary: '认证材料清单(整页保存):营业执照、对公账户、类目资质',
          source: 'web', createdAt: iso(2 * 86400e3),
          entities: ['商家认证'],
        },
        {
          id: 'm3', type: 'meeting', score: 0.81,
          summary: '周会决议:认证材料截图周四评审前同步到群里',
          source: 'meeting', createdAt: iso(3 * 86400e3),
          entities: ['商家认证', '周会'],
        },
      ],
      channels: { vector: 3, fts: 2, graph: 1, time: 1 },
    },
  },
  {
    // 会中 side panel / 会后 Panorama 共用的会议详情
    match: /\/meetings\/[^/?]+(\?|$)/,
    body: {
      success: true,
      meeting: {
        id: 'demo-meeting-1',
        title: '敏捷教练周会 · Sprint 排期与依赖',
        startedAt: iso(70 * 60e3),
        endedAt: iso(10 * 60e3),
        durationMs: 60 * 60e3,
        participants: [
          { name: 'Demo User', role: 'host' },
          { name: 'Rebecca C.', role: 'participant' },
          { name: 'Stephen L.', role: 'participant' },
        ],
        status: 'completed',
      },
      chapters: [
        { title: '上轮遗留项回顾', startOffsetMs: 0, summary: '认证材料截图尚未同步到群里' },
        { title: 'Sprint 排期', startOffsetMs: 18 * 60e3, summary: '两个跨团队依赖需要下周确认' },
        { title: '风险与阻塞', startOffsetMs: 40 * 60e3, summary: '平台审核结果决定后续排期' },
      ],
      actionItems: [
        { id: 'a1', text: '下班前把认证材料截图同步到群里', owner: 'Demo User', due: '今天 18:00', confidence: 0.93, status: 'confirmed' },
        { id: 'a2', text: '跨团队依赖 owner 下周一前确认', owner: 'Rebecca C.', due: '下周一', confidence: 0.81, status: 'pending' },
        { id: 'a3', text: '评审材料 timeline 截图周四前准备', owner: 'Demo User', due: '周四', confidence: 0.76, status: 'pending' },
      ],
      decisions: [
        { id: 'd1', text: '排期以平台审核结果为准,不提前锁定发布日', evidence: 'chapter:风险与阻塞' },
      ],
      plannedOutcomes: [
        { id: 'o1', goal: '确认认证材料同步责任人', status: 'closed', evidence: 'a1' },
        { id: 'o2', goal: '锁定跨团队依赖时间', status: 'partial', evidence: 'a2' },
      ],
      alerts: [
        { at: iso(45 * 60e3), kind: 'action_signal', text: '检测到承诺:「下班前同步截图」' },
      ],
    },
  },
  {
    match: /\/profile\/items|\/profile(\?|$)/,
    body: {
      success: true,
      items: [
        { id: 'p1', key: 'communication.language', label: '沟通语言', value: '中文为主,重要结论先行', confidence: 0.95, evidenceCount: 42, category: 'preference', updatedAt: iso(86400e3) },
        { id: 'p2', key: 'work.role', label: '角色', value: '敏捷教练 / Scrum Master', confidence: 0.98, evidenceCount: 66, category: 'identity', updatedAt: iso(5 * 86400e3) },
        { id: 'p3', key: 'work.habit.ai_first', label: '工作习惯', value: '凡事先让 AI 跑一遍,再人工复核', confidence: 0.88, evidenceCount: 23, category: 'habit', updatedAt: iso(2 * 86400e3) },
        { id: 'p4', key: 'writing_style.glip.tone', label: '群消息风格', value: '简短、直接、带行动项', confidence: 0.82, evidenceCount: 18, category: 'writing_style', updatedAt: iso(86400e3) },
      ],
      total: 4,
    },
  },
];

// 通用兜底:各种列表/状态端点给空但合法的形状
const GENERIC = {
  success: true,
  data: [], items: [], results: [], records: [], sessions: [], threads: [],
  rules: [], skills: [], rehearsals: [], actions: [], decisions: [],
  notifications: [], meetings: [], storylines: [], total: 0, meta: {},
};

/* ---------------- 截图任务 ---------------- */

const SHOTS = [
  { name: 'popup', page: 'popup.html', viewport: { width: 360, height: 700 }, wait: 2500 },
  { name: 'explore-search', page: 'memory-exploring.html#/search?q=%E5%95%86%E5%AE%B6%E8%AE%A4%E8%AF%81', viewport: { width: 1280, height: 800 }, wait: 3500 },
  { name: 'explore-coverage', page: 'memory-exploring.html#/coverage', viewport: { width: 1280, height: 800 }, wait: 3500 },
  { name: 'explore-profile', page: 'memory-exploring.html#/user-profile', viewport: { width: 1280, height: 800 }, wait: 3500 },
  { name: 'explore-rules', page: 'memory-exploring.html#/memory-entry-rules', viewport: { width: 1280, height: 800 }, wait: 3500 },
  { name: 'scheduled-messages', page: 'scheduled-messages.html', viewport: { width: 1280, height: 760 }, wait: 3500 },
  { name: 'desktop-app', page: 'desktop-app.html', viewport: { width: 900, height: 820 }, wait: 3000 },
  // Panorama 内置 demo 态(src/meeting-shell/demo.ts),用 ?demo=1 比外部 fixture 更权威
  { name: 'meeting-panorama', page: 'meeting-panorama.html?demo=1', viewport: { width: 1280, height: 900 }, wait: 4000 },
  // 会中弹幕:不是扩展页面,而是 docs/demo 的原型,需播放动画后隐藏 demo 控件再截
  {
    name: 'meeting-danmaku',
    file: 'docs/demo/meeting-danmaku-alerts.html',
    viewport: { width: 1280, height: 720 },
    wait: 11000,
    before: async (page) => { await page.click('text=🎬 播放完整 Demo'); },
    after: async (page) => {
      await page.evaluate(() => {
        document.querySelectorAll('.controls-overlay, .legend, .demo-label')
          .forEach((el) => { el.style.display = 'none'; });
      });
      await page.waitForTimeout(400);
    },
  },
];

/* ---------------- 主流程 ---------------- */

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'help-shots-profile-'));
const context = await chromium.launchPersistentContext(profileDir, {
  // channel:'chromium' = 完整 Chromium 的新 headless(默认的 headless_shell 不支持扩展);
  // 不用 channel:'chrome' —— 正式版 Chrome 137+ 移除了 --load-extension
  channel: 'chromium',
  headless: !HEADED,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--hide-scrollbars',
  ],
});

// 拦截一切 Memory Service 流量(远程默认域名 + 本地默认端口),绝不放行
const serviceGlobs = ['**/memory.xmnup.com/**', '**/localhost:3210/**', '**/127.0.0.1:3210/**'];
const unmatched = new Set();
for (const glob of serviceGlobs) {
  await context.route(glob, async (route) => {
    const url = route.request().url();
    const hit = FIXTURES.find((f) => f.match.test(url));
    if (!hit) unmatched.add(url.replace(/^https?:\/\/[^/]+/, ''));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(hit ? hit.body : GENERIC),
    });
  });
}

// unpacked 扩展 ID = sha256(绝对路径) 前 16 字节映射 a-p,确定性可算
const crypto = await import('node:crypto');
const extId = [...crypto.createHash('sha256').update(DIST).digest('hex').slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
  .join('');
console.log('extension id:', extId);

/* Meeting Pilot 的两个页面读 chrome.storage 里的 session 快照,不走 API,
   所以要单独种一份已结束会议的演示 session(结构见 src/meeting-shell/protocol.ts)。 */
const MEETING_ID = 'demo-meeting-1';
const t0 = NOW - 70 * 60e3;
const clock = (msFromStart) => new Date(t0 + msFromStart).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
const okDep = (message) => ({ status: 'ready', message, checkedAt: NOW });

const MEETING_SESSION = {
  meetingId: MEETING_ID,
  tabId: 1,
  url: `https://v.ringcentral.com/conf/on/${MEETING_ID}`,
  title: '敏捷教练周会 · Sprint 排期与依赖',
  status: 'ended',
  inMeeting: false,
  shareState: 'none',
  selfSharing: false,
  micMuted: false,
  speakerLabel: 'Rebecca C.',
  participantCount: 3,
  selfName: 'Demo User',
  capture: { kind: 'completed', startedAt: t0, stoppedAt: NOW - 10 * 60e3, chunkCount: 120, blobSize: 8_400_000 },
  digest: { status: 'completed', message: '会议纪要已生成', updatedAt: NOW - 9 * 60e3 },
  readiness: {
    status: 'ready', summary: '依赖齐备,可以开始捕获', canStartCapture: true, checkedAt: NOW,
    blockers: [], degradations: [],
    dependencies: {
      minutesApi: okDep('会议纪要接口可用'),
      transcription: okDep('RingCentral Transcript 可用'),
      analysisModel: okDep('分析模型就绪'),
      memoryService: okDep('Memory Service 已连接'),
    },
  },
  tier: { activeTier: 'ringcentral_transcript', badge: 'RC Transcript', mode: 'auto', lastStatusDetail: '优先使用平台转写' },
  alerts: [
    { id: 'al1', level: 'P0', title: '检测到你的承诺', body: '「下班前把认证材料截图同步到群里」——已加入行动项待复核。', source: 'action', createdAt: t0 + 45 * 60e3 },
    { id: 'al2', level: 'P1', title: '相关记忆', body: '上周同一话题:平台审核预计今天上午出结果(Rebecca)。', source: 'memory', createdAt: t0 + 12 * 60e3 },
  ],
  chapters: [
    { id: 'c1', title: '上轮遗留项回顾', summary: '认证材料截图尚未同步到群里', viewMode: 'outline', startLabel: clock(0), actionCount: 1, decisionCount: 0 },
    { id: 'c2', title: 'Sprint 排期', summary: '两个跨团队依赖需要下周确认', viewMode: 'table', startLabel: clock(18 * 60e3), actionCount: 2, decisionCount: 0 },
    { id: 'c3', title: '风险与阻塞', summary: '平台审核结果决定后续排期', viewMode: 'flow', startLabel: clock(40 * 60e3), actionCount: 0, decisionCount: 1 },
  ],
  currentTopic: '风险与阻塞',
  actionItems: [
    { id: 'a1', title: '下班前把认证材料截图同步到群里', owner: 'Demo User', deadline: '今天 18:00', status: 'pending', reviewState: 'confirmed', reviewedAt: NOW - 20 * 60e3, chapterId: 'c1', evidence: '我下班前发到群里', timestamp: clock(6 * 60e3), source: 'llm' },
    { id: 'a2', title: '跨团队依赖 owner 下周一前确认', owner: 'Rebecca C.', deadline: '下周一', status: 'pending', reviewState: 'suggested', chapterId: 'c2', evidence: '这个我去找对应的 owner 问', timestamp: clock(26 * 60e3), source: 'llm' },
    { id: 'a3', title: '评审材料 timeline 截图周四前准备', owner: 'Demo User', deadline: '周四', status: 'done', reviewState: 'confirmed', chapterId: 'c2', timestamp: clock(33 * 60e3), source: 'llm' },
  ],
  decisions: [
    { id: 'd1', text: '排期以平台审核结果为准,不提前锁定发布日', timestamp: clock(44 * 60e3), chapterId: 'c3' },
  ],
  timelineEvents: [
    { id: 't1', type: 'topic', title: '上轮遗留项回顾', description: '从认证材料同步情况开始', timestamp: clock(0), chapterId: 'c1' },
    { id: 't2', type: 'action', title: '承诺:同步认证材料截图', description: 'Demo User 认领,今天 18:00 前', timestamp: clock(6 * 60e3), speaker: 'Demo User', chapterId: 'c1', actionItemId: 'a1' },
    { id: 't3', type: 'topic', title: 'Sprint 排期', description: '梳理两个跨团队依赖', timestamp: clock(18 * 60e3), chapterId: 'c2' },
    { id: 't4', type: 'mention', title: '提到你', description: 'Rebecca 请你确认评审材料时间点', timestamp: clock(31 * 60e3), speaker: 'Rebecca C.', chapterId: 'c2' },
    { id: 't5', type: 'decision', title: '排期以审核结果为准', description: '不提前锁定发布日', timestamp: clock(44 * 60e3), chapterId: 'c3' },
  ],
  participants: [
    { id: 'p1', name: 'Demo User', role: '主持人', speakingPct: 42, isSelf: true, isHost: true, resolutionState: 'resolved' },
    { id: 'p2', name: 'Rebecca C.', role: '参会者', speakingPct: 38, resolutionState: 'resolved' },
    { id: 'p3', name: 'Stephen L.', role: '参会者', speakingPct: 20, resolutionState: 'resolved' },
  ],
  transcript: [
    { id: 'x1', speaker: 'Demo User', participantId: 'p1', text: '先看上次遗留的认证材料,截图还没同步到群里吧?', ts: t0 + 2 * 60e3, source: 'ringcentral_transcript' },
    { id: 'x2', speaker: 'Rebecca C.', participantId: 'p2', text: '还在等平台审核,预计今天上午出结果。', ts: t0 + 4 * 60e3, source: 'ringcentral_transcript' },
    { id: 'x3', speaker: 'Demo User', participantId: 'p1', text: '好,我下班前发到群里,明早评审要用。', ts: t0 + 6 * 60e3, source: 'ringcentral_transcript' },
  ],
  transcriptTurns: [],
  memoryRefs: [
    { id: 'r1', title: '商家认证进展', summary: '平台审核中,Rebecca 跟进', source: 'ringcentral' },
  ],
  outcomeBinder: {
    meetingId: MEETING_ID,
    generatedAt: iso(9 * 60e3),
    outcomes: [
      { id: 'o1', goal: '确认认证材料同步责任人', status: 'closed', confidence: 0.91, evidence: ['a1'] },
      { id: 'o2', goal: '锁定跨团队依赖时间', status: 'partial', confidence: 0.64, evidence: ['a2'] },
    ],
  },
  summary: '回顾上轮遗留的认证材料同步,梳理 Sprint 两个跨团队依赖,并确认排期以平台审核结果为准。共产出 3 个行动项、1 项决议。',
  speakerSummary: 'Demo User 42% · Rebecca C. 38% · Stephen L. 20%',
  timelineProgress: 1,
  detectedAt: t0,
  updatedAt: NOW - 9 * 60e3,
  endedAt: NOW - 10 * 60e3,
};

// 预置 chrome.storage(在任一扩展页面上下文执行,不依赖 service worker 唤醒)
{
  const seed = await context.newPage();
  await seed.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'load', timeout: 20000 });
  await seed.evaluate(async ([session, meetingId]) => {
    await chrome.storage.local.set({
      personalAiUiPreferences: { language: 'zh-CN' },
      messageAnalysisEnabled: true,
      'meetingPilot.sessions': { [meetingId]: session },
    });
  }, [MEETING_SESSION, MEETING_ID]);
  await seed.close();
}

for (const shot of SHOTS) {
  const page = await context.newPage();
  await page.setViewportSize(shot.viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  try {
    // shot.file = 仓库内 HTML 原型(如 docs/demo 弹幕);shot.page = 扩展自有页面
    const url = shot.file
      ? `file://${path.join(ROOT, shot.file)}`
      : `chrome-extension://${extId}/${shot.page}`;
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    if (shot.before) await shot.before(page);
    await page.waitForTimeout(shot.wait);
    if (shot.after) await shot.after(page);
    await page.screenshot({ path: path.join(OUT, `${shot.name}.png`), scale: 'device' });
    console.log(`✓ ${shot.name}.png${errors.length ? `  (pageerror: ${errors[0]})` : ''}`);
  } catch (e) {
    console.log(`✗ ${shot.name}: ${String(e).slice(0, 200)}`);
  }
  await page.close();
}

if (unmatched.size) {
  console.log('\n未命中 fixture 的端点(可按需补):');
  for (const u of [...unmatched].slice(0, 30)) console.log('  ', u);
}

await context.close();
fs.rmSync(profileDir, { recursive: true, force: true });
console.log('\ndone →', OUT);
