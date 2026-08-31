/**
 * Single-page HTML dashboard for usage analytics (使用视角).
 *
 * Fully self-contained. Layout mirrors
 * docs/demo/用量分析-使用视角.html:
 *   Q1/Q2 capability overview, Q3 activity, Q4 user×capability matrix,
 *   plus secondary frontend/backend / model / route panels.
 */

import { CAPABILITY_LABELS_ZH } from './capabilityMap.js';

function escapeForScript(value: string): string {
  return JSON.stringify(value ?? '');
}

export function renderDashboardHtml(
  token: string,
  viewer: { scope: 'self' | 'all'; userId: string | null } = {
    scope: 'all',
    userId: null,
  },
): string {
  const tokenLiteral = escapeForScript(token);
  const labelsLiteral = JSON.stringify(CAPABILITY_LABELS_ZH);
  const viewerLiteral = JSON.stringify({
    scope: viewer.scope,
    userId: viewer.userId,
  });
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Usage Analytics Dashboard</title>
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --panel-2: #273449;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8;
    --frontend: #34d399; --backend: #f472b6; --border: #334155;
    --gold: #fbbf24;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg); color: var(--text); padding: 24px; max-width: 1280px; margin: 0 auto;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: var(--muted); font-size: 13px; margin-bottom: 16px; }
  .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 20px; }
  .controls label { font-size: 13px; color: var(--muted); margin-right: 4px; }
  select, button {
    background: var(--panel-2); color: var(--text); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; font-size: 13px; cursor: pointer;
  }
  button.active { border-color: var(--accent); color: var(--accent); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .card .k { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .card .v { font-size: 22px; font-weight: 600; margin-top: 6px; }
  .card .v small { font-size: 12px; color: var(--muted); font-weight: 400; }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .panel h2 { font-size: 14px; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .panel .hint { font-size: 12px; color: var(--muted); margin: 0 0 12px; }
  .panel h2 .q { font-size: 11px; color: var(--bg); background: var(--accent); border-radius: 5px; padding: 1px 6px; font-weight: 600; }
  .sortbar { display: inline-flex; gap: 6px; margin-left: auto; }
  .sortbar button { padding: 4px 10px; font-size: 12px; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  th { color: var(--muted); font-weight: 500; font-size: 12px; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar { height: 8px; border-radius: 4px; background: var(--accent); min-width: 2px; }
  .barcell { width: 22%; }
  .cap-en { color: var(--muted); font-size: 11px; margin-left: 6px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
  .split { display: flex; height: 22px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); }
  .split .fe { background: var(--frontend); }
  .split .be { background: var(--backend); }
  .legend { display: flex; gap: 16px; margin-top: 10px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .dau { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding-top: 8px; }
  .dau .col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; cursor: default; }
  .dau .colbar { background: linear-gradient(180deg, var(--accent), #0ea5e9); border-radius: 3px 3px 0 0; min-height: 2px; }
  .dau .col:hover .colbar { background: var(--gold); }
  .dau-x { display: flex; gap: 3px; margin-top: 4px; }
  .dau-x span { flex: 1; font-size: 10px; color: var(--muted); text-align: center; overflow: hidden; }
  .matrix-wrap { overflow-x: auto; }
  .matrix td, .matrix th { text-align: center; padding: 5px 6px; }
  .matrix th.rowh, .matrix td.rowh { text-align: left; position: sticky; left: 0; background: var(--panel); }
  .matrix td.cell { min-width: 56px; border-radius: 4px; font-variant-numeric: tabular-nums; }
  .matrix th.colh { font-size: 11px; max-width: 76px; white-space: normal; vertical-align: bottom; }
  .userlink { color: var(--accent); cursor: pointer; text-decoration: none; }
  .userlink:hover { text-decoration: underline; }
  .fav { color: var(--muted); font-size: 12px; }
  .fav b { color: var(--text); font-weight: 500; }
  .muted { color: var(--muted); }
  .section-note { font-size: 12px; color: var(--muted); margin: 24px 0 8px; text-transform: uppercase; letter-spacing: .06em; }
  .err { color: #f87171; font-size: 13px; margin-bottom: 12px; }
  .flag { color: var(--gold); font-size: 12px; margin-left: 6px; }
  .stackbar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--panel-2); min-width: 40px; }
  .stackbar .fe { background: var(--frontend); }
  .stackbar .be { background: var(--backend); }
  tr.unknown-cap td:first-child { color: var(--gold); }
  tr.cap-row { cursor: pointer; }
  tr.cap-row:hover { background: rgba(56, 189, 248, 0.06); }
  tr.feature-row td { color: var(--muted); font-size: 12px; background: rgba(15, 23, 42, 0.35); }
  .side-pair { display: inline-flex; gap: 8px; align-items: baseline; }
  .side-pair .fe { color: var(--frontend); }
  .side-pair .be { color: var(--backend); }
  .fail { color: #f87171; }
  .scope-note {
    background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 8px; padding: 8px 12px; font-size: 12px; color: var(--accent); margin-bottom: 12px;
  }
  .bg-alert {
    background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.4);
    border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #fca5a5; margin-bottom: 12px;
  }
  .bg-alert b { color: #fecaca; }
  .model-flag { color: var(--gold); margin-left: 4px; cursor: help; }
</style>
</head>
<body>
  <h1>用量与 Token 分析 <span style="font-weight:400;color:var(--muted)">· 使用视角</span></h1>
  <div class="sub">Usage Analytics · <span id="status" class="muted">加载中…</span></div>
  <div id="scopeNote" class="scope-note" style="display:none"></div>
  <div id="bgAlert" class="bg-alert" style="display:none"></div>
  <div id="error" class="err" style="display:none"></div>

  <div class="controls">
    <span><label>范围</label>
      <select id="range">
        <option value="24h">最近 24 小时</option>
        <option value="7d" selected>最近 7 天</option>
        <option value="30d">最近 30 天</option>
      </select>
    </span>
    <span id="userControl"><label>用户</label>
      <select id="user"><option value="all">全体</option></select>
    </span>
    <span><label>端</label>
      <select id="side">
        <option value="all" selected>全部</option>
        <option value="frontend">仅前端</option>
        <option value="backend">仅后端</option>
      </select>
    </span>
    <button id="refresh">刷新</button>
  </div>

  <div class="cards" id="cards"></div>

  <div class="panel">
    <h2><span class="q">Q1 · Q2</span>功能总览
      <span class="sortbar" id="capSortBar">
        <button data-sort="usage" class="active">按使用频度</button>
        <button data-sort="tokens">按 Token</button>
        <button data-sort="cost">按成本</button>
      </span>
    </h2>
    <p class="hint">一个功能一行；行内拆前端/后端 Token 与 LLM 调用。点击行可下钻 feature/route。unknown 高亮表示打点覆盖缺口。</p>
    <div id="capTable"></div>
  </div>

  <div class="panel" id="activityPanel">
    <h2><span class="q">Q3</span>用户活跃度</h2>
    <p class="hint">按日活跃用户数（UTC 日，LLM 或接口任一有活动即计入）。下方为窗口内用户排行，点击用户名可下钻到单用户视图。</p>
    <div id="dauChart"></div>
    <div style="height:14px"></div>
    <div id="userTable"></div>
  </div>

  <div class="panel" id="matrixPanel">
    <h2><span class="q">Q4</span>用户 × 功能 偏好矩阵</h2>
    <p class="hint">格子 = 该用户对该功能的使用频度，颜色越深越常用（log 刻度）；hover 可看 token 数。列为窗口内 Top 10 功能。</p>
    <div class="matrix-wrap" id="matrix"></div>
  </div>

  <div class="section-note">次要面板（保留现有能力，降位）</div>
  <div class="grid2">
    <div class="panel" style="margin-bottom:0">
      <h2>前端 vs 后端 Token 分布</h2>
      <div id="split"></div>
    </div>
    <div class="panel" style="margin-bottom:0">
      <h2>按模型 Token 与成本</h2>
      <div id="byModel"></div>
    </div>
    <div class="panel" style="margin-bottom:0">
      <h2>接口调用明细（Top 路由）</h2>
      <div id="apiRoutes"></div>
    </div>
  </div>

<script>
var TOKEN = ${tokenLiteral};
var CAP_LABELS = ${labelsLiteral};
var VIEWER = ${viewerLiteral};
var capSort = 'usage';
var lastReport = null;
var expandedCaps = {};
var sideFilter = 'all';
var isSelfScope = VIEWER && VIEWER.scope === 'self';
if (isSelfScope) {
  var userCtrl = document.getElementById('userControl');
  if (userCtrl) userCtrl.style.display = 'none';
  document.querySelector('h1').innerHTML =
    '用量与 Token 分析 <span style="font-weight:400;color:var(--muted)">· 我的用量</span>';
  var scopeNoteEl = document.getElementById('scopeNote');
  if (scopeNoteEl) {
    // Mixing up self vs. all scope here previously caused a ~$137 cost "gap"
    // to be misdiagnosed as a telemetry bug — it was really one user's own
    // 36% share being mistaken for the whole service's usage.
    scopeNoteEl.textContent =
      '此链接只显示你个人（' + (VIEWER.userId || '未知用户') + '）的用量，不代表全体用户 / 全局服务消耗。要看全局口径需要 Admin 全体用量报表。';
    scopeNoteEl.style.display = '';
  }
}

function fmtInt(n) { return (n || 0).toLocaleString('en-US'); }
function fmtTok(n) {
  n = n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return fmtInt(n);
}
function fmtCost(n) { return '$' + (n || 0).toFixed(4); }
function labelOf(key, fallback) { return (fallback || CAP_LABELS[key] || key); }
function el(tag, attrs, children) {
  var node = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    if (k === 'text') node.textContent = attrs[k];
    else if (k === 'html') node.innerHTML = attrs[k];
    else node.setAttribute(k, attrs[k]);
  });
  (children || []).forEach(function (c) { if (c) node.appendChild(c); });
  return node;
}
function dayLabel(day) {
  if (!day) return '';
  var parts = String(day).split('-');
  if (parts.length < 3) return day;
  return Number(parts[1]) + '/' + Number(parts[2]);
}
function relativeLast(ts) {
  if (!ts) return '—';
  var diff = Date.now() - ts;
  var days = Math.floor(diff / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  return days + ' 天前';
}
function sideBucket(r, side) {
  return (r.bySide && r.bySide[side]) || {};
}
function failTooltip(rep, r) {
  if (!r.callCount) return '';
  var rate = '失败率 ' + ((r.failCount || 0) / Math.max(r.callCount, 1) * 100).toFixed(1) + '%';
  var breakdown = (rep.errorBreakdown || []).filter(function (e) { return e.capability === r.capability; });
  if (!breakdown.length) return rate;
  var byKind = breakdown
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 5)
    .map(function (e) { return e.errorKind + '×' + e.count; })
    .join('，');
  return rate + '\\n' + byKind;
}

async function apiGet(path) {
  var res = await fetch(path, { headers: { 'X-Analytics-Token': TOKEN } });
  if (!res.ok) throw new Error(path + ' → ' + res.status);
  return res.json();
}

function renderCards(rep, userFilter) {
  var host = document.getElementById('cards');
  host.innerHTML = '';
  var activeUsers = userFilter === 'all' ? (rep.byUser || []).length : 1;
  var failTotal = (rep.byCapability || []).reduce(function (s, r) { return s + (r.failCount || 0); }, 0);
  var items = [
    { k: '活跃用户', v: fmtInt(activeUsers) },
    { k: 'LLM 调用', v: fmtInt(rep.totals.callCount) },
    { k: '失败调用', v: '<span class="fail">' + fmtInt(failTotal) + '</span>' },
    { k: sideFilter === 'frontend' ? '接口调用' : '接口调用', v: sideFilter === 'frontend' ? '—' : fmtInt(rep.totals.apiCallCount || (rep.apiCalls && rep.apiCalls.total) || 0) },
    { k: '总 Token', v: fmtTok(rep.totals.totalTokens) + ' <small>输入 ' + fmtTok(rep.totals.promptTokens) + ' / 输出 ' + fmtTok(rep.totals.completionTokens) + '</small>' },
    { k: '预估成本', v: fmtCost(rep.totals.estCostUsd) + (rep.totals.flaggedCost ? '<span class="flag">⚠ 含未计价模型</span>' : '') }
  ];
  items.forEach(function (it) {
    host.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'k', text: it.k }),
      el('div', { class: 'v', html: it.v })
    ]));
  });
}

function renderCapTable(rep) {
  var host = document.getElementById('capTable');
  host.innerHTML = '';
  var rows = (rep.byCapability || []).slice();
  var metric = capSort === 'usage' ? function (r) { return r.usageCount || 0; }
    : capSort === 'tokens' ? function (r) { return r.totalTokens || 0; }
    : function (r) { return r.estCostUsd || 0; };
  rows.sort(function (a, b) { return metric(b) - metric(a); });
  var max = Math.max.apply(null, rows.map(metric).concat([1]));
  var showApi = sideFilter !== 'frontend';

  var table = el('table');
  var headCells = [
    el('th', { text: '功能' }),
    el('th', { class: 'num', text: '使用频度' }),
    el('th', { class: 'num', text: 'LLM 前端 / 后端' }),
    el('th', { class: 'num', text: '失败' }),
  ];
  if (showApi) headCells.push(el('th', { class: 'num', text: '接口调用(后端)' }));
  headCells.push(
    el('th', { class: 'num', text: 'Token 前端' }),
    el('th', { class: 'num', text: 'Token 后端' }),
    el('th', { class: 'num', text: '成本' }),
    el('th', { class: 'num', text: '人数' }),
    el('th', { class: 'barcell', text: '' })
  );
  table.appendChild(el('thead', {}, [el('tr', {}, headCells)]));
  var tbody = el('tbody');
  rows.forEach(function (r) {
    var fe = sideBucket(r, 'frontend');
    var be = sideBucket(r, 'backend');
    var feTok = fe.totalTokens || 0;
    var beTok = be.totalTokens || 0;
    var totalTok = Math.max(feTok + beTok, 1);
    var isUnknown = r.capability === 'unknown';
    var tr = el('tr', {
      class: 'cap-row' + (isUnknown ? ' unknown-cap' : ''),
      'data-cap': r.capability
    });
    var cells = [
      el('td', { html: (expandedCaps[r.capability] ? '▾ ' : '▸ ') + labelOf(r.capability, r.label) + '<span class="cap-en">' + r.capability + '</span>' }),
      el('td', { class: 'num', html: '<b>' + fmtInt(r.usageCount) + '</b>' }),
      el('td', { class: 'num', html: '<span class="side-pair"><span class="fe">' + fmtInt(fe.callCount) + '</span><span class="be">' + fmtInt(be.callCount) + '</span></span>' }),
      el('td', { class: 'num fail', text: fmtInt(r.failCount), title: failTooltip(rep, r) }),
    ];
    if (showApi) cells.push(el('td', { class: 'num', text: fmtInt(r.apiCallCount) }));
    cells.push(
      el('td', { class: 'num', html: '<span class="fe">' + fmtTok(feTok) + '</span>' }),
      el('td', { class: 'num', html: '<span class="be">' + fmtTok(beTok) + '</span>' }),
      el('td', { class: 'num', text: fmtCost(r.estCostUsd) }),
      el('td', { class: 'num', text: fmtInt(r.userCount) }),
      el('td', { class: 'barcell' }, [
        el('div', { class: 'stackbar', title: '前端 ' + fmtTok(feTok) + ' / 后端 ' + fmtTok(beTok) }, [
          el('div', { class: 'fe', style: 'width:' + (feTok / totalTok * 100) + '%' }),
          el('div', { class: 'be', style: 'width:' + (beTok / totalTok * 100) + '%' })
        ])
      ])
    );
    cells.forEach(function (c) { tr.appendChild(c); });
    tr.addEventListener('click', function () {
      expandedCaps[r.capability] = !expandedCaps[r.capability];
      renderCapTable(lastReport || rep);
    });
    tbody.appendChild(tr);

    if (expandedCaps[r.capability]) {
      var feats = (r.features || []).slice(0, 20);
      if (!feats.length) {
        var empty = el('tr', { class: 'feature-row' });
        empty.appendChild(el('td', {
          colspan: String(cells.length),
          text: '暂无 feature/route 明细（可能在 rollup 窗口外）'
        }));
        tbody.appendChild(empty);
      } else {
        feats.forEach(function (f) {
          var fr = el('tr', { class: 'feature-row' });
          fr.appendChild(el('td', {
            html: '&nbsp;&nbsp;' + (f.detailKind === 'route' ? 'route' : 'feature') + ': <code>' + f.detail + '</code> <span class="cap-en">' + f.side + '</span>'
          }));
          fr.appendChild(el('td', { class: 'num', text: fmtInt(f.callCount) }));
          fr.appendChild(el('td', { class: 'num', text: f.side === 'frontend' ? fmtInt(f.callCount) + ' / —' : '— / ' + fmtInt(f.callCount) }));
          fr.appendChild(el('td', { class: 'num fail', text: fmtInt(f.failCount) }));
          if (showApi) fr.appendChild(el('td', { class: 'num', text: '—' }));
          fr.appendChild(el('td', { class: 'num', text: f.side === 'frontend' ? fmtTok(f.totalTokens) : '—' }));
          fr.appendChild(el('td', { class: 'num', text: f.side === 'backend' ? fmtTok(f.totalTokens) : '—' }));
          fr.appendChild(el('td', { class: 'num', text: fmtCost(f.estCostUsd) }));
          fr.appendChild(el('td', { class: 'num', text: '—' }));
          fr.appendChild(el('td', { class: 'barcell', text: '' }));
          tbody.appendChild(fr);
        });
      }
    }
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

function renderDau(rep) {
  var host = document.getElementById('dauChart');
  host.innerHTML = '';
  var days = rep.dailyActivity || [];
  if (!days.length) {
    host.appendChild(el('div', { class: 'muted', text: '暂无日活数据' }));
    return;
  }
  var max = Math.max.apply(null, days.map(function (d) { return d.activeUsers; }).concat([1]));
  var chart = el('div', { class: 'dau' });
  days.forEach(function (d) {
    var h = d.activeUsers / max * 100;
    var label = dayLabel(d.day);
    chart.appendChild(el('div', {
      class: 'col',
      title: label + ' · ' + d.activeUsers + ' 活跃用户 · LLM ' + fmtInt(d.llmCalls) + ' · 接口 ' + fmtInt(d.apiCalls) + ' · ' + fmtTok(d.totalTokens) + ' tok'
    }, [el('div', { class: 'colbar', style: 'height:' + h + '%' })]));
  });
  host.appendChild(chart);
  var xaxis = el('div', { class: 'dau-x' });
  var step = days.length > 10 ? Math.ceil(days.length / 10) : 1;
  days.forEach(function (d, i) {
    xaxis.appendChild(el('span', { text: (i % step === 0 || i === days.length - 1) ? dayLabel(d.day) : '' }));
  });
  host.appendChild(xaxis);
}

function renderUserTable(rep) {
  var host = document.getElementById('userTable');
  host.innerHTML = '';
  var users = rep.byUser || [];
  if (!users.length) {
    host.appendChild(el('div', { class: 'muted', text: '暂无用户活动' }));
    return;
  }
  var table = el('table');
  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', { text: '用户' }),
    el('th', { class: 'num', text: '使用频度' }),
    el('th', { class: 'num', text: 'Token' }),
    el('th', { class: 'num', text: '成本' }),
    el('th', { text: '最常用功能（前 3）' }),
    el('th', { text: '最近活跃' })
  ])]));
  var tbody = el('tbody');
  users.forEach(function (u) {
    var link = el('a', { class: 'userlink', text: u.userId });
    link.addEventListener('click', function () {
      document.getElementById('user').value = u.userId;
      load();
    });
    var favHtml = (u.topCapabilities || []).map(function (t) {
      return '<b>' + labelOf(t.capability, t.label) + '</b>×' + fmtInt(t.usageCount);
    }).join('，') || '—';
    tbody.appendChild(el('tr', {}, [
      el('td', {}, [link]),
      el('td', { class: 'num', text: fmtInt(u.usageCount) }),
      el('td', { class: 'num', text: fmtTok(u.totalTokens) }),
      el('td', { class: 'num', text: fmtCost(u.estCostUsd) }),
      el('td', {}, [el('span', { class: 'fav', html: favHtml })]),
      el('td', { class: 'muted', text: relativeLast(u.lastTs) })
    ]));
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

function renderMatrix(rep) {
  var host = document.getElementById('matrix');
  host.innerHTML = '';
  var matrix = rep.userCapabilityMatrix;
  if (!matrix || !matrix.users || !matrix.users.length) {
    host.appendChild(el('div', { class: 'muted', text: '暂无矩阵数据' }));
    return;
  }
  var maxCell = 1;
  (matrix.cells || []).forEach(function (row) {
    row.forEach(function (v) { if (v > maxCell) maxCell = v; });
  });
  var table = el('table', { class: 'matrix' });
  var headRow = el('tr', {}, [el('th', { class: 'rowh', text: '用户 \\\\ 功能' })]);
  (matrix.capabilities || []).forEach(function (c) {
    headRow.appendChild(el('th', { class: 'colh', text: labelOf(c.capability, c.label) }));
  });
  table.appendChild(el('thead', {}, [headRow]));
  var tbody = el('tbody');
  matrix.users.forEach(function (userId, ui) {
    var tr = el('tr', {}, [el('td', { class: 'rowh', text: userId })]);
    (matrix.capabilities || []).forEach(function (c, ci) {
      var v = (matrix.cells[ui] && matrix.cells[ui][ci]) || 0;
      var tokens = (matrix.tokenCells && matrix.tokenCells[ui] && matrix.tokenCells[ui][ci]) || 0;
      var alpha = v > 0 ? (Math.log(1 + v) / Math.log(1 + maxCell)) * 0.85 : 0;
      tr.appendChild(el('td', {
        class: 'cell',
        style: 'background: rgba(56,189,248,' + alpha.toFixed(3) + ');' + (alpha > 0.55 ? 'color:#04263a;font-weight:600;' : ''),
        text: v > 0 ? fmtInt(v) : '',
        title: v > 0 ? (userId + ' · ' + labelOf(c.capability, c.label) + ' · 频度 ' + fmtInt(v) + ' · ' + fmtTok(tokens) + ' tok') : ''
      }));
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  host.appendChild(table);
  var hidden = (rep.byUser || []).length - matrix.users.length;
  if (hidden > 0) {
    host.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:8px', text: '另有 ' + hidden + ' 位用户未显示' }));
  }
}

function renderSplit(rep) {
  var host = document.getElementById('split');
  host.innerHTML = '';
  var fe = (rep.bySide && rep.bySide.frontend) || {};
  var be = (rep.bySide && rep.bySide.backend) || {};
  var feTok = fe.totalTokens || 0, beTok = be.totalTokens || 0;
  var total = feTok + beTok || 1;
  var fePct = feTok / total * 100, bePct = beTok / total * 100;
  host.appendChild(el('div', { class: 'split' }, [
    el('div', { class: 'fe', style: 'width:' + fePct + '%' }),
    el('div', { class: 'be', style: 'width:' + bePct + '%' })
  ]));
  host.appendChild(el('div', { class: 'legend' }, [
    el('span', {}, [el('span', { class: 'dot', style: 'background:var(--frontend)' }), el('span', { text: '前端 ' + fmtTok(feTok) + ' (' + fePct.toFixed(1) + '%) · ' + fmtCost(fe.estCostUsd) })]),
    el('span', {}, [el('span', { class: 'dot', style: 'background:var(--backend)' }), el('span', { text: '后端 ' + fmtTok(beTok) + ' (' + bePct.toFixed(1) + '%) · ' + fmtCost(be.estCostUsd) })])
  ]));
}

function renderByModel(rep) {
  var host = document.getElementById('byModel');
  host.innerHTML = '';
  var rows = rep.byModel || [];
  if (!rows.length) {
    host.appendChild(el('div', { class: 'muted', text: '暂无模型数据' }));
    return;
  }
  var max = Math.max.apply(null, rows.map(function (m) { return m.totalTokens; }).concat([1]));
  var table = el('table');
  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', { text: '模型' }), el('th', { class: 'num', text: 'Token' }), el('th', { class: 'num', text: '成本' }), el('th', { text: '' })
  ])]));
  var tbody = el('tbody');
  var unpricedNote = rows.some(function (m) { return m.flagged; })
    ? el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:8px', text: '⚠ 标记为未计价的模型，成本一直是 $0 直到管理员通过 PUT /usage/pricing 或 update-model-pricing skill 补价' })
    : null;
  if (unpricedNote) host.appendChild(unpricedNote);
  rows.forEach(function (m) {
    tbody.appendChild(el('tr', {}, [
      el('td', { html: m.model + (m.flagged ? '<span class="model-flag" title="未计价，成本固定为 $0">⚠</span>' : '') }),
      el('td', { class: 'num', text: fmtTok(m.totalTokens) }),
      el('td', { class: 'num', text: fmtCost(m.estCostUsd) }),
      el('td', { class: 'barcell' }, [el('div', { class: 'bar', style: 'width:' + (m.totalTokens / max * 100) + '%' })])
    ]));
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

function renderApiRoutes(rep) {
  var host = document.getElementById('apiRoutes');
  host.innerHTML = '';
  var rows = ((rep.apiCalls && rep.apiCalls.byRoute) || []).slice(0, 20);
  if (!rows.length) {
    host.appendChild(el('div', { class: 'muted', text: '暂无接口明细' }));
    return;
  }
  var max = Math.max.apply(null, rows.map(function (r) { return r.count; }).concat([1]));
  var table = el('table');
  table.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', { text: '路由' }), el('th', { class: 'num', text: '次数' }), el('th', { text: '' })
  ])]));
  var tbody = el('tbody');
  rows.forEach(function (r) {
    tbody.appendChild(el('tr', {}, [
      el('td', {}, [el('code', { text: r.route })]),
      el('td', { class: 'num', text: fmtInt(r.count) }),
      el('td', { class: 'barcell' }, [el('div', { class: 'bar', style: 'width:' + (r.count / max * 100) + '%' })])
    ]));
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

function renderBgAlert(rep) {
  var host = document.getElementById('bgAlert');
  var alerts = rep.backgroundLlmAlerts || [];
  if (!alerts.length) {
    host.style.display = 'none';
    return;
  }
  host.innerHTML = '⚠ 后台任务今日 Token 异常：' + alerts.map(function (a) {
    return '<b>' + labelOf(a.capability) + ' / ' + a.feature + '</b> 已用 ' + fmtTok(a.totalTokens) + '（阈值 ' + fmtTok(a.thresholdTokens) + '）';
  }).join('；') + '。参考 docs/features/usage_analytics.md「成本治理与 2026-08 事故复盘」排查是否有用户误开了高频后台功能（如自我反思）。';
  host.style.display = '';
}

function renderAll(rep, userFilter) {
  lastReport = rep;
  renderBgAlert(rep);
  renderCards(rep, userFilter);
  renderCapTable(rep);
  var single = userFilter !== 'all' || isSelfScope;
  document.getElementById('activityPanel').style.display = single ? 'none' : '';
  document.getElementById('matrixPanel').style.display = single ? 'none' : '';
  if (!single) {
    renderDau(rep);
    renderUserTable(rep);
    renderMatrix(rep);
  }
  renderSplit(rep);
  renderByModel(rep);
  renderApiRoutes(rep);
}

async function load() {
  var range = document.getElementById('range').value || '7d';
  var userFilter = isSelfScope
    ? (VIEWER.userId || 'unknown')
    : (document.getElementById('user').value || 'all');
  sideFilter = document.getElementById('side').value || 'all';
  var err = document.getElementById('error');
  err.style.display = 'none';
  document.getElementById('status').textContent = '加载中…';
  try {
    if (!isSelfScope) {
      var usersPayload = await apiGet('/api/v1/usage/users?range=' + encodeURIComponent(range));
      var sel = document.getElementById('user');
      var previous = sel.value || 'all';
      sel.innerHTML = '';
      sel.appendChild(el('option', { value: 'all', text: '全体' }));
      (usersPayload.users || []).forEach(function (u) {
        sel.appendChild(el('option', {
          value: u.userId,
          text: u.userId + ' (' + fmtInt(u.eventCount) + ')'
        }));
      });
      if ([].some.call(sel.options, function (o) { return o.value === previous; })) {
        sel.value = previous;
        userFilter = previous;
      } else {
        sel.value = 'all';
        userFilter = 'all';
      }
    }

    var report = await apiGet(
      '/api/v1/usage/report?range=' + encodeURIComponent(range) +
      '&user=' + encodeURIComponent(userFilter) +
      '&side=' + encodeURIComponent(sideFilter)
    );
    // Self-scope: server forces user; never honor a client override.
    if (isSelfScope) userFilter = report.user || VIEWER.userId || userFilter;
    renderAll(report, userFilter);
    var sideLabel = sideFilter === 'all' ? '全部端' : (sideFilter === 'frontend' ? '仅前端' : '仅后端');
    document.getElementById('status').textContent =
      (isSelfScope ? '我的用量 (' + userFilter + ')' : (userFilter === 'all' ? '全体' : '用户 ' + userFilter)) +
      ' · ' + sideLabel +
      ' · ' + range +
      ' · 更新于 ' + new Date(report.generatedAt || Date.now()).toLocaleString();
  } catch (e) {
    err.style.display = '';
    err.textContent = '加载失败: ' + (e && e.message ? e.message : String(e));
    document.getElementById('status').textContent = '加载失败';
  }
}

document.getElementById('user').addEventListener('change', load);
document.getElementById('range').addEventListener('change', load);
document.getElementById('side').addEventListener('change', load);
document.getElementById('refresh').addEventListener('click', load);
document.querySelectorAll('#capSortBar button').forEach(function (btn) {
  btn.addEventListener('click', function () {
    capSort = btn.getAttribute('data-sort');
    document.querySelectorAll('#capSortBar button').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    if (lastReport) renderCapTable(lastReport);
  });
});
load();
</script>
</body>
</html>`;
}
