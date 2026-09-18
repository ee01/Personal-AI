#!/usr/bin/env node
/**
 * cleanup-reflection-backlog.mjs
 *
 * 把陈旧的反思线程软归档（status='active' -> 'closed' + closure_reason），
 * 不删除任何数据：markdown、reflection_runs、底层 entity/property 全部保留，
 * 可用 --rollback 按 closure_reason 整批恢复。
 *
 * 背景与规则依据：docs/progressing/memory-reflection-runtime-governance-plan.md
 *
 * 用法：
 *   node cleanup-reflection-backlog.mjs                     # dry-run（默认），全部账号
 *   node cleanup-reflection-backlog.mjs --user esone.qiu    # 只看一个账号
 *   node cleanup-reflection-backlog.mjs --apply             # 真正写入
 *   node cleanup-reflection-backlog.mjs --rollback          # 按 reason 恢复
 *   node cleanup-reflection-backlog.mjs --data-dir <path>   # 指定 users 目录
 *
 * 依赖：系统 `sqlite3` CLI（不引入 node 依赖，便于在部署机直接跑）
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REASON = 'stale_backlog_2026_08_cleanup';
const DAY = 86400;

// 非真人账号，永不处理
const SKIP_ACCOUNTS = new Set(['nonexistent-user', 'radar-poc']);

/**
 * 用户显式要求保留的线程，任何规则都不得归档。
 * 每条都应写明是谁、什么时候、为什么要求保留。
 */
const KEEP_THREAD_IDS = new Map([
  [
    '1750f005-58e9-4f54-911c-fc19e9535975',
    'esone.qiu 2026-09-11 指定保留：事实跟进 Sophia (Jinmei) Lin · status',
  ],
]);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const APPLY = flag('apply');
const ROLLBACK = flag('rollback');
const ONLY_USER = opt('user', null);
const DATA_DIR = opt(
  'data-dir',
  '/Users/rcadmin/personal-ai/memory-service/data/users',
);
const STATIC_PROFILE_DAYS = Number(opt('static-profile-days', 14));
const STALE_DAYS = Number(opt('stale-days', 60));
const RECEIPT_DIR = opt('receipt-dir', tmpdir());

/**
 * 归档规则。每条规则给出 SQL 谓词与人类可读说明。
 * 只有 archive=true 的规则会写库；archive=false 的只出报告交给人判断。
 */
const RULES = [
  {
    id: 'R1_static_profile',
    archive: true,
    label: '画像反思：静态身份字段（name/timezone/language）',
    why: '反思用户自己的姓名/时区/语言不可能产出价值；2026-08 事故期批量自动创建，单条最高 291 次 run',
    predicate: `source_type = 'profile_item'
      AND (title LIKE '%name%' OR title LIKE '%timezone%' OR title LIKE '%language%')
      AND COALESCE(last_reflected_at, updated_at, created_at) < :staticCutoff`,
  },
  {
    id: 'R2_never_ran_backlog',
    archive: true,
    label: '事实/决策跟进：建了但从未反思过',
    why: '入口无退出条件导致的纯积压；信息本体仍在 entities/confirm_requests 表中',
    predicate: `source_type IN ('entity_property', 'confirm_request')
      AND reflection_count = 0
      AND created_at < :staleCutoff`,
  },
  {
    id: 'R3_dormant_fact_tracking',
    archive: true,
    label: '事实跟进：长期无活动',
    why: '事实跟进属于监控而非反思，休眠超期即应关闭（方案 D：默认改归 evidence watch）',
    predicate: `source_type = 'entity_property'
      AND reflection_count > 0
      AND COALESCE(last_reflected_at, updated_at, created_at) < :staleCutoff`,
  },
  {
    id: 'R4_review_only',
    archive: false,
    label: '需人工判断：来自真实互动的线程（ask/message/dream）',
    why: '这些是真正的经验提炼来源，即使休眠也不自动关闭；仅列出供人决定',
    predicate: `source_type IN ('ask', 'message', 'dream')
      AND COALESCE(last_reflected_at, updated_at, created_at) < :staleCutoff`,
  },
];

function sql(db, query) {
  try {
    return execFileSync('sqlite3', ['-separator', '\t', db, query], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch (err) {
    throw new Error(`sqlite3 failed on ${db}: ${err.message}`);
  }
}

function rows(db, query) {
  const out = sql(db, query);
  return out ? out.split('\n').map((line) => line.split('\t')) : [];
}

function keepClause() {
  if (!KEEP_THREAD_IDS.size) return '';
  const list = [...KEEP_THREAD_IDS.keys()].map((id) => `'${id}'`).join(', ');
  return ` AND id NOT IN (${list})`;
}

function resolvePredicate(predicate, now) {
  return (
    predicate
      .replaceAll(':staticCutoff', String(now - STATIC_PROFILE_DAYS * DAY))
      .replaceAll(':staleCutoff', String(now - STALE_DAYS * DAY)) + keepClause()
  );
}

function listAccounts() {
  if (!existsSync(DATA_DIR)) {
    console.error(`data dir not found: ${DATA_DIR}`);
    process.exit(2);
  }
  return readdirSync(DATA_DIR)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => !SKIP_ACCOUNTS.has(name))
    .filter((name) => (ONLY_USER ? name === ONLY_USER : true))
    .filter((name) => {
      const dir = join(DATA_DIR, name);
      return statSync(dir).isDirectory() && existsSync(join(dir, 'memory.db'));
    })
    .sort();
}

function doRollback(accounts) {
  // 默认只回滚本工具写入的行（reason 带 ":<ruleId>" 后缀），
  // 不误伤 2026-09-11 手工执行的那批（reason 为不带后缀的裸值）。
  // --include-manual 才一并恢复。
  const match = flag('include-manual') ? `${REASON}%` : `${REASON}:%`;
  console.log(`回滚匹配: closure_reason LIKE '${match}'\n`);

  let total = 0;
  for (const account of accounts) {
    const db = join(DATA_DIR, account, 'memory.db');
    const n = Number(
      sql(
        db,
        `SELECT count(*) FROM reflection_threads WHERE status='closed' AND closure_reason LIKE '${match}'`,
      ),
    );
    if (!n) continue;
    if (APPLY) {
      sql(
        db,
        `UPDATE reflection_threads
           SET status='active', closure_reason=NULL, next_reflection_at=strftime('%s','now')
         WHERE status='closed' AND closure_reason LIKE '${match}'`,
      );
    }
    console.log(`${APPLY ? 'restored' : 'would restore'}  ${account}  ${n}`);
    total += n;
  }
  console.log(
    `\n${APPLY ? '已恢复' : 'dry-run 将恢复'} ${total} 条（加 --apply 生效）`,
  );
}

function main() {
  const accounts = listAccounts();
  const now = Math.floor(Date.now() / 1000);

  if (ROLLBACK) return doRollback(accounts);

  console.log(
    `模式: ${APPLY ? 'APPLY（写库）' : 'DRY-RUN（只读，加 --apply 生效）'}`,
  );
  console.log(`目录: ${DATA_DIR}`);
  console.log(
    `阈值: 静态画像 ${STATIC_PROFILE_DAYS} 天无活动 / 陈旧 ${STALE_DAYS} 天\n`,
  );

  let grandArchive = 0;
  let grandReview = 0;
  const receipt = [];

  for (const account of accounts) {
    const db = join(DATA_DIR, account, 'memory.db');
    const active = Number(
      sql(
        db,
        `SELECT count(*) FROM reflection_threads WHERE status='active'`,
      ),
    );
    if (!active) continue;

    const hits = [];
    for (const rule of RULES) {
      const where = resolvePredicate(rule.predicate, now);
      const matched = rows(
        db,
        `SELECT id, source_type, reflection_count, substr(replace(title, char(9), ' '), 1, 46)
           FROM reflection_threads
          WHERE status='active' AND (${where})
          ORDER BY reflection_count DESC`,
      );
      if (matched.length) hits.push({ rule, matched });
    }
    if (!hits.length) continue;

    console.log(`── ${account}  (active: ${active})`);
    for (const { rule, matched } of hits) {
      const tag = rule.archive ? '归档' : '待人工判断';
      console.log(`   [${tag}] ${rule.id}  ${rule.label}  × ${matched.length}`);
      for (const [, sourceType, runCount, title] of matched.slice(0, 6)) {
        console.log(`        ${sourceType}/${runCount}次  ${title}`);
      }
      if (matched.length > 6) {
        console.log(`        … 其余 ${matched.length - 6} 条`);
      }

      if (rule.archive) {
        grandArchive += matched.length;
        receipt.push({
          account,
          rule: rule.id,
          threadIds: matched.map(([id]) => id),
        });
        if (APPLY) {
          const where = resolvePredicate(rule.predicate, now);
          sql(
            db,
            `UPDATE reflection_threads
               SET status='closed',
                   closure_reason='${REASON}:${rule.id}',
                   updated_at=strftime('%s','now')
             WHERE status='active' AND (${where})`,
          );
        }
      } else {
        grandReview += matched.length;
      }
    }
    console.log('');
  }

  console.log('═══ 汇总 ═══');
  console.log(`${APPLY ? '已归档' : '将归档'}: ${grandArchive} 条`);
  console.log(`待人工判断（未动）: ${grandReview} 条`);
  if (KEEP_THREAD_IDS.size) {
    console.log(`用户指定保留（豁免所有规则）: ${KEEP_THREAD_IDS.size} 条`);
    for (const [id, note] of KEEP_THREAD_IDS) {
      console.log(`   ${id.slice(0, 8)}…  ${note}`);
    }
  }
  if (APPLY && receipt.length) {
    const path = join(
      RECEIPT_DIR,
      `reflection-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(
      path,
      JSON.stringify(
        { reason: REASON, appliedAt: now, thresholds: { STATIC_PROFILE_DAYS, STALE_DAYS }, entries: receipt },
        null,
        2,
      ),
    );
    console.log(`\n执行凭证已写入: ${path}`);
  }
  if (!APPLY && grandArchive) {
    console.log(`\n加 --apply 执行；事后可用 --rollback --apply 整批恢复。`);
  }
}

main();
