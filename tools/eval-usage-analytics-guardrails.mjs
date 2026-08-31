#!/usr/bin/env node
/**
 * Usage-analytics production guardrails — standalone, live-endpoint checks
 * for the cost-control fixes in
 * docs/features/usage_analytics.md (成本治理与 2026-08 事故复盘).
 *
 * Why this exists (and why it is NOT a vitest test): every fix in that plan
 * is provably *correct in code* via `__tests__/*.test.ts` (pricing merge
 * logic, idle-sleep gating, retry/timeout telemetry, ...) — those already
 * pass. What those tests cannot prove is whether the fix actually *worked in
 * production*, because the evidence only exists in three shapes unit tests
 * can't fabricate honestly:
 *   1. Data that needs real time to accumulate (weekly_dreaming only runs
 *      once a week; a background-burn alert only means something after a
 *      real day of traffic).
 *   2. A live comparison against a pre-fix baseline (webpage-analysis's
 *      backend token *share* dropping after the frontend migration ships —
 *      there's no "correct" absolute number, only "lower than before").
 *   3. Behavior of a genuinely idle/misconfigured real user, which a
 *      synthetic fixture can assert about but can't prove happened.
 *
 * This follows the same pattern as tools/eval-memory-abilities.ts: a
 * standalone script hitting a **live** memory-service endpoint, not wired
 * into `eval:run`'s case/judge machinery (registry.yaml), because these are
 * numeric threshold checks against real aggregates, not qualitative
 * case-scoring. See evals/README.md's "Memory Abilities benchmark" section
 * for the precedent this mirrors.
 *
 * Every check returns one of three verdicts — this three-way split is the
 * actual answer to "how do I test something that needs time to pass":
 *   pass    — matured, and the guardrail holds
 *   fail    — matured, and the guardrail is violated (non-zero exit)
 *   pending — hasn't matured yet (not enough time/data); NOT a failure
 *
 * Usage:
 *   node tools/eval-usage-analytics-guardrails.mjs \
 *     --endpoint http://10.32.56.212:3210/api/v1 --token $ANALYTICS_ADMIN_TOKEN
 *   node tools/eval-usage-analytics-guardrails.mjs --json   # machine-readable, for the scheduler
 *   node tools/eval-usage-analytics-guardrails.mjs --capture-webpage-analysis-baseline
 *
 * Exit code: non-zero iff any check is `fail`. `pending` never fails the run
 * — re-run later; state persists in .eval-runs/usage-analytics-guardrails/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const STATE_DIR = path.join(repoRoot, '.eval-runs', 'usage-analytics-guardrails');
const BASELINE_PATH = path.join(STATE_DIR, 'webpage-analysis-baseline.json');

const BACKGROUND_LLM_ALERT_DOC =
  'docs/features/usage_analytics.md 成本治理与 2026-08 事故复盘';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) continue;
    const [key, inline] = tok.slice(2).split(/=(.*)/s, 2);
    if (inline !== undefined) {
      args[key] = inline;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[key] = argv[++i];
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: token ? { 'X-Analytics-Token': token } : {},
  });
  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

/**
 * Each check: { id, description, run(ctx) => { verdict, detail } }.
 * `run` may itself decide "pending" — that's the maturity gate, kept inline
 * per-check rather than as a separate abstraction, since maturity criteria
 * differ per check (a day, a week, "has anyone opted in", "has a baseline
 * been captured").
 */
const CHECKS = [
  {
    id: 'pricing_fully_covers_recent_usage',
    description: '7 天窗口内没有模型仍被标记未计价（$0 成本 bug 的回归哨兵）',
    async run({ report }) {
      if (!report.totals.flaggedCost) {
        return { verdict: 'pass', detail: '所有出现过用量的模型都已计价' };
      }
      const flagged = (report.byModel || []).filter((m) => m.flagged).map((m) => m.model);
      return {
        verdict: 'fail',
        detail: `未计价模型: ${flagged.join(', ') || '(byModel 未标记，检查 report 版本)'}. 运行 update-model-pricing skill 或 PUT /usage/pricing 补价。`,
      };
    },
  },
  {
    id: 'background_llm_daily_alert_clear',
    description: '今日没有后台 feature（heartbeat/weekly_dreaming/...) token 超阈值告警',
    async run({ report }) {
      const alerts = report.backgroundLlmAlerts || [];
      if (alerts.length === 0) {
        return { verdict: 'pass', detail: '无后台燃烧告警' };
      }
      const lines = alerts.map(
        (a) => `${a.capability}/${a.feature}: ${a.totalTokens} tok (阈值 ${a.thresholdTokens})`,
      );
      return {
        verdict: 'fail',
        detail: `${lines.join('; ')}。参考 ${BACKGROUND_LLM_ALERT_DOC} 排查是否有用户误开了高频后台功能。`,
      };
    },
  },
  {
    id: 'weekly_dreaming_healthy_or_pending',
    description: 'weekly_dreaming 本周若已运行，应产出非零 token 且不 100% 失败；若本周尚未到点，标记 pending 而非 fail',
    async run({ report }) {
      const row = (report.byCapability || [])
        .flatMap((c) => c.features || [])
        .find((f) => f.detail === 'weekly_dreaming' || f.detail?.includes('weekly_dreaming'));
      if (!row || row.callCount === 0) {
        return {
          verdict: 'pending',
          detail: 'weekly_dreaming 本周（7d 窗口）尚未运行过（WEEKLY_CRON 通常每周日一次）。这不是失败——数据还没到时间，稍后重新运行本脚本。',
        };
      }
      if (row.totalTokens === 0) {
        return {
          verdict: 'fail',
          detail: `weekly_dreaming 运行了 ${row.callCount} 次但 token 全为 0——很可能全部失败（failCount=${row.failCount}）。查 usage_events.error_kind 或服务日志。`,
        };
      }
      if (row.failCount >= row.callCount) {
        return {
          verdict: 'fail',
          detail: `weekly_dreaming ${row.callCount} 次运行全部失败（failCount=${row.failCount}）。`,
        };
      }
      return {
        verdict: 'pass',
        detail: `本周运行 ${row.callCount} 次，产出 ${row.totalTokens} tok，失败 ${row.failCount} 次`,
      };
    },
  },
  {
    id: 'no_single_user_backend_cost_runaway',
    description: '没有单个用户占当日后端预估成本超过 40%（通用哨兵：闲置反思线程/失控脚本/测试账号都会撞到这条）',
    async run({ report }) {
      const byUser = report.byUser || [];
      if (byUser.length === 0) {
        return { verdict: 'pending', detail: '此 token 只能看到全体口径为空的窗口（可能是 self token 或全新部署），无法判断 per-user 集中度' };
      }
      const totalCost = report.totals.estCostUsd || 0;
      if (totalCost <= 0) {
        return { verdict: 'pending', detail: '窗口内预估成本为 0（未计价或无用量），暂无法判断集中度' };
      }
      const top = byUser.reduce((a, b) => (b.estCostUsd > a.estCostUsd ? b : a), byUser[0]);
      const share = top.estCostUsd / totalCost;
      if (share > 0.4) {
        return {
          verdict: 'fail',
          detail: `用户 ${top.userId} 占窗口内后端成本的 ${(share * 100).toFixed(0)}%（$${top.estCostUsd.toFixed(2)} / $${totalCost.toFixed(2)}）。检查该用户是否有闲置反思线程、测试脚本或失控循环。`,
        };
      }
      return { verdict: 'pass', detail: `最高单用户占比 ${(share * 100).toFixed(0)}%（${top.userId}）` };
    },
  },
  {
    id: 'webpage_analysis_backend_share_declining',
    description:
      '网页分析已全量迁到前端用户 LLM（无后端兜底），后端 /source-memory/webpage-analysis 占后端总 token 的比例应趋近 0（对照迁移前基线）',
    async run({ report }) {
      const backendTotal = report.bySide?.backend?.totalTokens || 0;
      const webpageRow = (report.byCapability || [])
        .flatMap((c) => c.features || [])
        .find((f) => f.detail === '/source-memory/webpage-analysis');
      const webpageTokens = webpageRow?.totalTokens || 0;
      const currentShare = backendTotal > 0 ? webpageTokens / backendTotal : 0;

      if (!fs.existsSync(BASELINE_PATH)) {
        return {
          verdict: 'pending',
          detail:
            `未捕获迁移前基线。运行 --capture-webpage-analysis-baseline 记录当前占比（${(currentShare * 100).toFixed(1)}%）作为参照，` +
            '等携带前端直连逻辑的新版扩展发布并跑几天流量后再运行本检查。',
        };
      }
      const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'));
      // Judge on ABSOLUTE tokens, not share: share is confounded by every
      // other backend workload (the very first live run false-alarmed because
      // the test-account cleanup collapsed heartbeat traffic, inflating this
      // route's share while its absolute volume was unchanged). The shipped
      // extension no longer calls this route at all (no toggle, no fallback —
      // see docs/features/memory_capture.md「网页分析的 LLM 路径」), so absolute
      // volume should approach zero once the new build reaches users; volume
      // meaningfully ABOVE baseline means old builds resurging or a runaway
      // direct-API caller slipping past WEBPAGE_ANALYSIS_DAILY_LIMIT.
      if (typeof baseline.tokens !== 'number') {
        return {
          verdict: 'pending',
          detail: '基线文件是旧格式（只有 share 没有 tokens）——重新运行 --capture-webpage-analysis-baseline 升级基线后再判定。',
        };
      }
      const REGRESSION_TOLERANCE = 1.1; // >10% above baseline volume = regression
      if (webpageTokens > baseline.tokens * REGRESSION_TOLERANCE) {
        return {
          verdict: 'fail',
          detail: `当前后端 webpage-analysis token 量 ${webpageTokens} 明显高于基线 ${baseline.tokens}（捕获于 ${baseline.capturedAt}）——扩展已不该调用这条路由，增长说明有旧版扩展回流或直连 API 的调用方失控。查 byUser 定位来源，并确认 WEBPAGE_ANALYSIS_DAILY_LIMIT 配额仍在生效。`,
        };
      }
      if (webpageTokens >= baseline.tokens * 0.5) {
        return {
          verdict: 'pending',
          detail: `当前 token 量 ${webpageTokens}（占后端 ${(currentShare * 100).toFixed(1)}%）与基线 ${baseline.tokens}（${baseline.capturedAt}）同量级——携带前端直连逻辑的新版扩展可能还没发布/触达用户。不算失败，发版后过几天再看。`,
        };
      }
      return {
        verdict: 'pass',
        detail: `当前 token 量 ${webpageTokens}，已降至基线 ${baseline.tokens}（${baseline.capturedAt}）的一半以下`,
      };
    },
  },
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = (args.endpoint || process.env.MEMORY_SERVICE_URL || 'http://localhost:3210/api/v1').replace(/\/+$/, '');
  const token = args.token || process.env.ANALYTICS_ADMIN_TOKEN || '';
  const range = args.range || '7d';

  if (!token) {
    console.error('Missing --token / ANALYTICS_ADMIN_TOKEN (self-scope tokens cannot see byUser/pricing).');
    process.exitCode = 2;
    return;
  }

  fs.mkdirSync(STATE_DIR, { recursive: true });

  const report = await getJson(`${endpoint}/usage/report?range=${range}&user=all&side=all`, token);

  if (args.captureWebpageAnalysisBaseline) {
    const backendTotal = report.bySide?.backend?.totalTokens || 0;
    const webpageTokens =
      (report.byCapability || [])
        .flatMap((c) => c.features || [])
        .find((f) => f.detail === '/source-memory/webpage-analysis')?.totalTokens || 0;
    const share = backendTotal > 0 ? webpageTokens / backendTotal : 0;
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        { tokens: webpageTokens, share, capturedAt: new Date(report.generatedAt).toISOString(), range },
        null,
        2,
      ),
    );
    console.log(`Captured webpage-analysis baseline: ${webpageTokens} tokens (${(share * 100).toFixed(1)}% of backend, range=${range}).`);
    return;
  }

  const results = [];
  for (const check of CHECKS) {
    let outcome;
    try {
      outcome = await check.run({ report });
    } catch (err) {
      outcome = { verdict: 'fail', detail: `check threw: ${err instanceof Error ? err.message : String(err)}` };
    }
    results.push({ id: check.id, description: check.description, ...outcome });
  }

  const runRecord = { ranAt: new Date().toISOString(), endpoint, range, results };
  fs.writeFileSync(
    path.join(STATE_DIR, `run-${Date.now()}.json`),
    JSON.stringify(runRecord, null, 2),
  );

  if (args.json) {
    console.log(JSON.stringify(runRecord, null, 2));
  } else {
    console.log(`Usage-analytics guardrails — ${endpoint} (range=${range})\n`);
    for (const r of results) {
      const icon = r.verdict === 'pass' ? '✅' : r.verdict === 'pending' ? '⏳' : '❌';
      console.log(`${icon} [${r.verdict.toUpperCase()}] ${r.id}`);
      console.log(`   ${r.detail}\n`);
    }
    const failed = results.filter((r) => r.verdict === 'fail').length;
    const pending = results.filter((r) => r.verdict === 'pending').length;
    console.log(`${results.length - failed - pending} pass, ${pending} pending, ${failed} fail.`);
  }

  process.exitCode = results.some((r) => r.verdict === 'fail') ? 1 : 0;
}

main().catch((err) => {
  console.error('[eval-usage-analytics-guardrails] fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 2;
});
