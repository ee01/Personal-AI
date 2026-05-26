#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ensureDir,
  findLatestSummaries,
  formatSchedule,
  getResultRoot,
  loadSuiteCases,
  loadRegistry,
  readJsonFileIfExists,
  resolveRepoPath,
} from './eval-lib.mjs';

const registry = await loadRegistry();
const resultRoot = getResultRoot(registry);
const summaries = await findLatestSummaries(resultRoot);
const latestBySuite = new Map();

for (const summary of summaries) {
  if (!latestBySuite.has(summary.suiteId)) latestBySuite.set(summary.suiteId, summary);
}

const schedulerState = await readJsonFileIfExists(registry.scheduler?.stateFile || path.join(resultRoot, 'scheduler-state.json'), {
  runs: {},
});
const scheduledKeys = new Set(buildScheduledKeys());
const reportPath = process.argv.includes('--stdout')
  ? null
  : registry.scheduler?.latestReport || path.join(resultRoot, 'latest-report.html');
const report = await buildLatestReport();

if (reportPath) {
  await ensureDir(path.dirname(resolveRepoPath(reportPath)));
  await fs.writeFile(resolveRepoPath(reportPath), report);
  console.log(reportPath);
} else {
  console.log(report);
}

async function buildLatestReport() {
  const suiteRows = [];
  for (const suite of registry.suites || []) {
    const latest = latestBySuite.get(suite.id);
    const caseCount = await countCases(suite.cases);
    suiteRows.push({ suite, latest, caseCount });
  }

  const caseSections = [];
  for (const suite of registry.suites || []) {
    const latest = latestBySuite.get(suite.id);
    const caseResults = await collectSuiteCaseResults(suite, latest);
    if (!caseResults.length) continue;
    const caseDefinitions = await loadSuiteCases(suite);
    caseSections.push({ suite, latest, caseResults, caseDefinitions });
  }

  const stateRows = Object.entries(schedulerState.runs || {})
    .filter(([key]) => scheduledKeys.size === 0 || scheduledKeys.has(key));
  const contextSection = caseSections.find((section) => section.suite.id === 'context-recall');
  const otherSections = caseSections.filter((section) => section.suite.id !== 'context-recall');
  const contextAverage = contextSection ? averageCaseScore(contextSection.caseResults) : null;

  return buildHtmlShell({
    title: 'Personal AI 体验评估报告',
    body: `
      <section class="hero">
        <div>
          <p class="eyebrow">Personal AI Evals</p>
          <h1>体验评估报告</h1>
          <p class="lead">${escapeHtml(buildPlatformConclusion(contextSection))}</p>
          <p class="muted">生成时间 ${escapeHtml(new Date().toISOString())}</p>
        </div>
        <div class="hero-metrics">
          ${metricCard('评估套件', suiteRows.length)}
          ${metricCard('定时样本', stateRows.length)}
          ${metricCard('Lens 平均分', contextAverage ?? '-')}
        </div>
      </section>

      <section>
        <h2>Memory Lens 真实群组评估</h2>
        ${contextSection ? renderContextRecallSection(contextSection) : '<p class="muted">还没有 context-recall 结果。</p>'}
      </section>

      <section>
        <h2>其他套件</h2>
        ${otherSections.length ? otherSections.map(renderCaseSection).join('\n') : '<p class="muted">其他 suite 暂无结果。</p>'}
      </section>

      <section>
        <h2>套件运行状态</h2>
        <table>
          <thead>
            <tr>
              <th>Suite</th>
              <th>样本</th>
              <th>运行方式</th>
              <th>频率</th>
              <th>最近结果</th>
              <th>修复</th>
              <th>报告</th>
            </tr>
          </thead>
          <tbody>
            ${suiteRows.map(renderSuiteRow).join('\n')}
          </tbody>
        </table>
      </section>

      <section>
        <h2>定时执行记录</h2>
        <table>
          <thead>
            <tr>
              <th>任务</th>
              <th>最近状态</th>
              <th>最近时间</th>
              <th>动作</th>
              <th>报告</th>
            </tr>
          </thead>
          <tbody>
            ${stateRows.length ? stateRows.sort(([left], [right]) => left.localeCompare(right)).map(renderSchedulerRow).join('\n') : '<tr><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>'}
          </tbody>
        </table>
      </section>
    `,
  });
}

function buildScheduledKeys() {
  const keys = [];
  for (const suite of registry.suites || []) {
    if (suite.enabled === false) continue;
    const schedule = suite.schedule || {};
    if (suite.runMode !== 'scheduled' && !schedule.enabled) continue;
    const caseSchedules = Array.isArray(suite.caseSchedules) ? suite.caseSchedules : [];
    if (caseSchedules.length) {
      for (const item of caseSchedules) {
        if (item.enabled === false) continue;
        keys.push(`${suite.id}:${item.caseId}`);
      }
    } else {
      keys.push(`${suite.id}:suite`);
    }
  }
  return keys;
}

async function collectSuiteCaseResults(suite, latest) {
  const scheduledCaseRows = Object.entries(schedulerState.runs || {})
    .filter(([key, value]) => key.startsWith(`${suite.id}:`) && value.caseId)
    .sort(([left], [right]) => left.localeCompare(right));
  if (scheduledCaseRows.length) {
    const results = [];
    for (const [, value] of scheduledCaseRows) {
      const runDir = value.reportPath ? path.dirname(value.reportPath) : null;
      if (!runDir) continue;
      const caseResults = await readJsonFileIfExists(path.join(runDir, 'case-results.json'), []);
      results.push(...caseResults);
    }
    return results;
  }
  if (!latest?.runDir) return [];
  return readJsonFileIfExists(path.join(latest.runDir, 'case-results.json'), []);
}

async function countCases(casesPath) {
  if (!casesPath) return 0;
  try {
    const text = await fs.readFile(resolveRepoPath(casesPath), 'utf8');
    return text.split(/\r?\n/).filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    }).length;
  } catch {
    return 0;
  }
}

function escapeTable(value) {
  return String(value || '-').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function buildPlatformConclusion(contextSection) {
  if (!contextSection?.caseResults?.length) {
    return '当前还没有可读的真实体验结果。汇总页会保留统一平台外壳；具体 suite 可以输出自己的专属报告结构。';
  }
  const counts = countStatuses(contextSection.caseResults);
  const average = averageCaseScore(contextSection.caseResults);
  if ((counts.fail || 0) > 0) {
    return `context-recall 就是前面那组真实 Glip/RingCentral 群组的 Memory Lens 合理性评估。本次 ${counts.fail || 0} 条失败、${counts.warn || 0} 条需关注，平均分 ${average ?? '-'}，说明仍有结果会让用户觉得“不知道为什么相关”。`;
  }
  if ((counts.warn || 0) > 0) {
    return `context-recall 正在评估真实 Glip/RingCentral 群组的 Memory Lens 结果。本次没有硬失败，但有 ${counts.warn || 0} 条需关注，平均分 ${average ?? '-'}。`;
  }
  return `context-recall 正在评估真实 Glip/RingCentral 群组的 Memory Lens 结果。本次整体通过，平均分 ${average ?? '-'}。`;
}

function renderContextRecallSection({ caseResults, caseDefinitions }) {
  const casesById = new Map((caseDefinitions || []).map((item) => [item.id, item]));
  const sortedResults = [...caseResults].sort((left, right) => {
    const leftIndex = (caseDefinitions || []).findIndex((item) => item.id === left.caseId);
    const rightIndex = (caseDefinitions || []).findIndex((item) => item.id === right.caseId);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
  const counts = countStatuses(sortedResults);
  const average = averageCaseScore(sortedResults);
  return `<div class="context-summary">
      ${metricCard('群组样本', sortedResults.length)}
      ${metricCard('通过', counts.pass || 0)}
      ${metricCard('需关注', counts.warn || 0)}
      ${metricCard('失败', counts.fail || 0)}
      ${metricCard('平均分', average ?? '-')}
    </div>
    <p class="muted section-note">这里的每张卡片都对应一个真实 RingCentral 群组样本：先拿近期聊天上下文调用统一的 <code>/context-recall</code>，再判断 Memory Lens 如果展示这条记忆，用户是否能一眼看懂关联性。</p>
    ${sortedResults.map((result) => renderContextRecallCard(result, casesById.get(result.caseId))).join('\n')}`;
}

function renderContextRecallCard(result, caseItem = {}) {
  const score = result.overallScore ?? computeOverallScore(result.scores, result.status);
  const topMatch = result.topMatch;
  const sampleText = result.sampleSummary || summarizeSampleText(caseItem.sampleContext?.primaryText || '');
  const expectedTopics = result.expectedTopics || caseItem.expectedTopics || [];
  const bannedTopics = result.mustNotReturnTopics || caseItem.mustNotReturnTopics || [];
  const targetUrl = result.targetUrl || caseItem.canonicalUrl || caseItem.url;
  const suggestions = result.improvementSuggestions?.length
    ? result.improvementSuggestions
    : buildFallbackSuggestions(result, caseItem);
  return `<article class="lens-case">
    <div class="lens-case-head">
      <div>
        <p class="eyebrow">${escapeHtml(result.caseId)}</p>
        <h3>${escapeHtml(result.caseTitle || caseItem.title || result.caseId)}</h3>
        <p class="muted">${targetUrl ? `<a href="${escapeAttr(targetUrl)}">${escapeHtml(targetUrl)}</a>` : '-'}</p>
      </div>
      <div class="score-box">
        ${statusBadge(result.status)}
        <strong>${escapeHtml(score ?? '-')}</strong>
        <span>体验分 / 100</span>
      </div>
    </div>

    <div class="lens-grid">
      <div>
        <h4>跑了哪些目标/数据</h4>
        <p>${escapeHtml(sampleText || '-')}</p>
        ${renderChipGroup('期望命中', expectedTopics, 'chip-good')}
        ${renderChipGroup('不应命中', bannedTopics, 'chip-bad')}
      </div>
      <div>
        <h4>Memory Lens 实际会展示什么</h4>
        ${topMatch ? `
          <p class="result-title">${escapeHtml(topMatch.title || topMatch.sourceTitle || topMatch.id || '-')}</p>
          <p class="muted">${escapeHtml(topMatch.sourceLabel || '-')} · ${escapeHtml(topMatch.displayPriority || '-')}</p>
          ${renderChipGroup('为什么相关', topMatch.whyRelevant || [], 'chip-neutral')}
        ` : '<p class="muted">没有展示可见关联记忆。</p>'}
      </div>
    </div>

    <div class="lens-grid">
      <div>
        <h4>用户视角结论</h4>
        <p>${escapeHtml(result.userConclusion || buildFallbackConclusion(result))}</p>
        <p class="muted">${escapeHtml(result.why || result.reason || result.error || '')}</p>
      </div>
      <div>
        <h4>改进意见</h4>
        <ul>${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="score-grid">${renderScoreBars(result.scores || {})}</div>
  </article>`;
}

function renderSuiteRow({ suite, latest, caseCount }) {
  const report = latest?.reportPath
    ? `<a href="${escapeAttr(relativeReportHref(latest.reportPath))}">${escapeHtml(latest.reportPath)}</a>`
    : '-';
  return `<tr>
    <td><code>${escapeHtml(suite.id)}</code><div class="muted">${escapeHtml(suite.title || '')}</div></td>
    <td>${escapeHtml(caseCount)}</td>
    <td>${escapeHtml(suite.runMode || 'manual')}</td>
    <td>${escapeHtml(formatSchedule(suite.schedule))}</td>
    <td>${latest ? `${statusBadge(latest.status)} <span class="muted">${escapeHtml(latest.startedAt)}</span>` : '-'}</td>
    <td>${escapeHtml(localizeRepair(latest?.repairStatus || suite.repair?.mode || '-'))}</td>
    <td>${report}</td>
  </tr>`;
}

function renderCaseSection({ suite, caseResults }) {
  return `<div class="case-section">
    <h3>${escapeHtml(suite.title || suite.id)}</h3>
    <table>
      <thead>
        <tr>
          <th>样本</th>
          <th>状态</th>
          <th>结论</th>
          <th>Top Match</th>
        </tr>
      </thead>
      <tbody>
        ${caseResults.map((item) => `<tr>
          <td><code>${escapeHtml(item.caseId)}</code></td>
          <td>${statusBadge(item.status)}</td>
          <td>${escapeHtml(item.why || item.reason || item.error || '')}</td>
          <td>${escapeHtml(item.topMatch?.title || item.topMatch?.id || '-')}</td>
        </tr>`).join('\n')}
      </tbody>
    </table>
  </div>`;
}

function renderSchedulerRow([key, value]) {
  const report = value.reportPath
    ? `<a href="${escapeAttr(relativeReportHref(value.reportPath))}">${escapeHtml(value.reportPath)}</a>`
    : '-';
  return `<tr>
    <td><code>${escapeHtml(key)}</code></td>
    <td>${statusBadge(value.lastStatus || '-')}</td>
    <td>${escapeHtml(value.lastCompletedAt || value.lastStartedAt || '-')}</td>
    <td>${escapeHtml(value.action || '-')}</td>
    <td>${report}</td>
  </tr>`;
}

function countStatuses(caseResults) {
  return caseResults.reduce((acc, item) => {
    const status = item.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

function averageCaseScore(caseResults) {
  const scores = caseResults
    .map((item) => item.overallScore ?? computeOverallScore(item.scores, item.status))
    .filter((value) => Number.isFinite(value));
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function computeOverallScore(scores = {}, status = '') {
  const weights = {
    context_relevance: 30,
    user_value: 25,
    specificity: 15,
    title_quality: 10,
    explanation_quality: 10,
    suppression_correctness: 10,
  };
  const keys = Object.keys(weights).filter((key) => Number.isFinite(Number(scores[key])));
  if (!keys.length) return null;
  const weighted = keys.reduce((sum, key) => sum + (Number(scores[key]) / 3) * weights[key], 0);
  const totalWeight = keys.reduce((sum, key) => sum + weights[key], 0);
  let score = Math.round((weighted / totalWeight) * 100);
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus === 'fail') score = Math.min(score, 49);
  if (normalizedStatus === 'warn') score = Math.min(score, 69);
  if (normalizedStatus === 'error') score = 0;
  if (normalizedStatus === 'skipped') return null;
  return score;
}

function summarizeSampleText(text) {
  return truncateText(String(text || '').replace(/\s+/g, ' ').trim(), 260);
}

function truncateText(text, maxLength = 180) {
  if (!text || text.length <= maxLength) return text || '';
  return `${text.slice(0, maxLength - 1)}…`;
}

function buildFallbackConclusion(result) {
  if (result.status === 'pass') return '可以展示：结果命中了具体锚点。';
  if (result.status === 'warn') return '谨慎展示：有少量锚点，但用户可能仍然看不懂为什么相关。';
  if (result.status === 'fail') return '不建议展示：这条 Memory Lens 结果与当前群组上下文不够匹配。';
  if (result.status === 'hide_expected') return '保持安静：没有足够强相关结果。';
  if (result.status === 'skipped') return '这个样本没有执行。';
  return '需要人工复核。';
}

function buildFallbackSuggestions(result, caseItem = {}) {
  if (result.status === 'skipped') return ['为这个 suite 实现 runner 或补充可执行样本。'];
  if (!result.topMatch) return ['无强相关时不要展示 Lens；如果用户主动点击，再进入搜索模式。'];
  const suggestions = [];
  const expected = caseItem.expectedTopics || result.expectedTopics || [];
  const scores = result.scores || {};
  if (result.status === 'fail' || scores.context_relevance < 2) {
    suggestions.push(`强相关展示前至少命中 2 个当前场景锚点，例如：${expected.slice(0, 5).join('、') || caseItem.title || result.caseId}。`);
  }
  if (scores.title_quality < 2) {
    suggestions.push('加粗标题需要是核心事实摘要，不要使用“RingCentral 消息”“时间”等低信息标题。');
  }
  if (scores.explanation_quality < 2) {
    suggestions.push('补充为什么相关，明确命中的人、项目、主题和当前聊天之间的关系。');
  }
  if (result.topMatch?.displayPriority === 'p1' && result.status !== 'pass') {
    suggestions.push('未通过的结果不应作为强相关 p1 展示，应降级或隐藏。');
  }
  return suggestions.length ? suggestions : ['维持当前策略，并继续通过真实样本回归。'];
}

function renderChipGroup(label, values, className = 'chip-neutral') {
  const chips = (values || []).filter(Boolean);
  if (!chips.length) return '';
  return `<div class="chip-row"><span>${escapeHtml(label)}</span>${chips.map((value) => `<em class="chip ${escapeAttr(className)}">${escapeHtml(value)}</em>`).join('')}</div>`;
}

function renderScoreBars(scores) {
  const entries = Object.entries(scores || {});
  if (!entries.length) return '';
  return entries.map(([key, value]) => {
    const width = Math.max(0, Math.min(100, Math.round((Number(value) / 3) * 100)));
    return `<div class="score-line">
      <span>${escapeHtml(localizeScoreKey(key))}</span>
      <div><i style="width:${escapeAttr(width)}%"></i></div>
      <strong>${escapeHtml(value)}/3</strong>
    </div>`;
  }).join('');
}

function localizeStatus(status) {
  const labels = {
    pass: '通过',
    warn: '需关注',
    fail: '失败',
    error: '错误',
    skipped: '跳过',
    hide_expected: '已静默',
    unknown: '未知',
  };
  return labels[String(status || 'unknown').toLowerCase()] || String(status || '-');
}

function localizeRepair(status) {
  const labels = {
    not_requested: '未触发',
    suggest: '只提建议',
    auto: '自动修复',
    repair_blocked: '修复已阻止',
    repaired_pending_review: '已修复待 review',
    repair_validation_failed: '修复后验证失败',
    agent_failed: 'Agent 失败',
  };
  return labels[String(status || '')] || status || '-';
}

function localizeScoreKey(key) {
  const labels = {
    context_relevance: '语义相关',
    user_value: '用户价值',
    specificity: '具体性',
    title_quality: '标题质量',
    explanation_quality: '解释质量',
    suppression_correctness: '静默正确性',
  };
  return labels[key] || key;
}

function relativeReportHref(reportPath) {
  const fromDir = path.dirname(registry.scheduler?.latestReport || path.join(resultRoot, 'latest-report.html'));
  return path.relative(fromDir, reportPath) || path.basename(reportPath);
}

function metricCard(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? '-')}</strong></div>`;
}

function statusBadge(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  return `<span class="badge badge-${escapeAttr(normalized)}">${escapeHtml(localizeStatus(normalized))}</span>`;
}

function buildHtmlShell({ title, body }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f5f0;
      --panel: #fffdf8;
      --ink: #20232a;
      --muted: #667085;
      --line: #e6dfd2;
      --accent: #0f766e;
      --accent-soft: #e6f4ef;
      --danger: #b42318;
      --warn: #b54708;
      --ok: #027a48;
      --skip: #475467;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main { width: min(1240px, calc(100vw - 48px)); margin: 32px auto 56px; }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 20px;
      margin-top: 16px;
      box-shadow: 0 10px 30px rgba(32, 35, 42, 0.05);
    }
    .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
    .hero-metrics { display: grid; grid-template-columns: repeat(3, minmax(110px, 1fr)); gap: 12px; min-width: 420px; }
    .eyebrow { margin: 0 0 6px; color: var(--accent); font-weight: 700; font-size: 13px; text-transform: uppercase; }
    h1 { margin: 0; font-size: 30px; letter-spacing: 0; }
    h2 { margin: 0 0 14px; font-size: 18px; letter-spacing: 0; }
    h3 { margin: 18px 0 10px; font-size: 15px; }
    h4 { margin: 0 0 8px; color: #7a5b2e; font-size: 13px; letter-spacing: 0; }
    .case-section:first-child h3 { margin-top: 0; }
    .lead { max-width: 780px; color: #475467; font-size: 15px; }
    .muted { color: var(--muted); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .metric { background: #ffffff; border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-width: 0; }
    .metric span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 6px; }
    .metric strong { display: block; font-size: 20px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); padding: 10px 8px; }
    th { color: #344054; font-size: 12px; text-transform: uppercase; }
    td { overflow-wrap: anywhere; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .badge-pass { color: var(--ok); background: #ecfdf3; }
    .badge-warn { color: var(--warn); background: #fffaeb; }
    .badge-fail, .badge-error { color: var(--danger); background: #fef3f2; }
    .badge-skipped, .badge-hide_expected, .badge-unknown, .badge-- { color: var(--skip); background: #f2f4f7; }
    .context-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    .section-note { margin: 0 0 14px; }
    .lens-case {
      border: 1px solid #dfcfb8;
      border-radius: 8px;
      padding: 18px;
      margin-top: 14px;
      background: #fffaf1;
    }
    .lens-case-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .lens-case-head .eyebrow { margin-bottom: 4px; color: #936b33; }
    .lens-case-head h3 { margin: 0; font-size: 18px; }
    .score-box { display: grid; justify-items: end; gap: 4px; min-width: 110px; }
    .score-box strong { font-size: 30px; line-height: 1; }
    .score-box span { color: var(--muted); font-size: 12px; }
    .lens-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 18px; margin-top: 16px; }
    .lens-grid p { margin: 0 0 10px; }
    .result-title { font-weight: 700; color: #243047; }
    .chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .chip-row > span { color: var(--muted); font-size: 12px; margin-right: 2px; }
    .chip { display: inline-flex; border-radius: 999px; padding: 3px 9px; font-style: normal; font-size: 12px; border: 1px solid transparent; }
    .chip-good { background: var(--accent-soft); color: #0f766e; border-color: #b6ded4; }
    .chip-bad { background: #fef3f2; color: #b42318; border-color: #fecdca; }
    .chip-neutral { background: #f2f4f7; color: #344054; border-color: #d0d5dd; }
    .score-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 18px; margin-top: 16px; }
    .score-line { display: grid; grid-template-columns: 86px minmax(0, 1fr) 36px; gap: 8px; align-items: center; font-size: 12px; color: #475467; }
    .score-line div { height: 8px; border-radius: 999px; background: #ece5da; overflow: hidden; }
    .score-line i { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
    .score-line strong { text-align: right; font-weight: 700; color: #344054; }
    @media (max-width: 860px) {
      main { width: min(100vw - 24px, 1240px); margin-top: 16px; }
      .hero { display: block; }
      .hero-metrics { grid-template-columns: 1fr; min-width: 0; margin-top: 16px; }
      .context-summary { grid-template-columns: 1fr 1fr; }
      .lens-case-head, .lens-grid { display: block; }
      .score-box { justify-items: start; margin-top: 12px; }
      .lens-grid > div { margin-top: 14px; }
      .score-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    ${body}
  </main>
</body>
</html>
`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
