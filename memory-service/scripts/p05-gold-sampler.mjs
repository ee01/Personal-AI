#!/usr/bin/env node
/**
 * P0.5 gold probe sampler (memory-foundation plan §11.5).
 *
 * Stratifies real episodes by language / source / time and emits a seed
 * scene-query gold file for the retrieval ablation. Each probe is
 * machine-seeded WITH PROVENANCE: query derived from one known message,
 * gold = that message (so the ablation judge is deterministic — hit@k by
 * gold message id — and fully reproducible). Provenance is recorded so a
 * later human-annotation pass can promote/demote seeds to real gold
 * ("manual annotation" quality gate stays human-owned).
 *
 * Stratification (plan §11.5):
 *   - zh / en / mixed messages
 *   - source types: glip / jira / web / calendar
 *   - recent (90d) vs older
 *   - scene: jira_issue / ringcentral_chat / web_reading
 *
 * Usage (inside memory-service container):
 *   node scripts/p0c-gold-sampler.mjs --db-path /app/data/users/esone.qiu/memory.db \
 *     --out /tmp/p05-gold-seed.jsonl --per-stratum 12
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const opts = { dbPath: '', out: '/tmp/p05-gold-seed.jsonl', perStratum: 12 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-path' && argv[i + 1]) opts.dbPath = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) opts.out = argv[++i];
    else if (argv[i] === '--per-stratum' && argv[i + 1]) opts.perStratum = Number(argv[++i]);
  }
  if (!opts.dbPath || !fs.existsSync(opts.dbPath)) {
    throw new Error('--db-path must point to an existing SQLite database');
  }
  return opts;
}

const langOf = (content) => {
  if (!content) return 'unknown';
  const cjk = (content.match(/[\u3400-\u9fff]/g) || []).length;
  const latin = (content.match(/[a-zA-Z]/g) || []).length;
  if (cjk > 0 && latin > cjk) return 'mixed';
  if (cjk > 0) return 'zh';
  return 'en';
};

/** Extract distinctive query keywords from a message body. */
function buildQuery(content) {
  const cleaned = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[|>_*`#]+/g, ' ')
    .trim();
  const cjkRuns = cleaned.match(/[\u3400-\u9fff]{4,}/gu) ?? [];
  const latinWords = (cleaned.match(/[a-zA-Z][a-zA-Z0-9._-]{3,}/g) ?? [])
    .filter((w) => !/^(http|https|www|com|ringcentral|message|attachment)$/i.test(w));
  const zh = cjkRuns.slice(0, 2).join(' ');
  const en = latinWords.slice(0, 4).join(' ');
  return [zh, en].filter(Boolean).join(' ');
}

const SOURCE_TYPES = ['glip', 'jira', 'web', 'calendar'];
const nowSec = () => Math.floor(Date.now() / 1000);

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const db = new Database(opts.dbPath, { readonly: true });
  const now = nowSec();
  const cutoffRecent = now - 90 * 86400;

  const probes = [];
  let idSeq = 0;
  const emit = (row, scene, recency) => {
    const query = buildQuery(row.content);
    if (!query || query.length < 6) return;
    probes.push({
      id: `p05-${String(++idSeq).padStart(4, '0')}`,
      seed: true, // machine-seeded; human annotation pass may promote/demote
      surface: scene === 'jira_issue_reading' ? 'ask' : scene === 'ringcentral_group_chat' ? 'passive_ask' : 'passive',
      scene,
      recency,
      language: langOf(row.content),
      query,
      gold: {
        kind: 'message',
        messageId: row.id,
        sourceType: row.source_type,
        timestamp: row.timestamp,
        spanPreview: row.content.slice(0, 160),
      },
    });
  };

  for (const sourceType of SOURCE_TYPES) {
    for (const recency of ['recent', 'older']) {
      const tsFrom = recency === 'recent' ? cutoffRecent : 0;
      const tsTo = recency === 'recent' ? now : cutoffRecent;
      // Oversample then balance by language: the corpus is English-heavy and
      // the cross-lingual ablation needs zh/mixed representation.
      const pool = db
        .prepare(
          `SELECT id, source_type, timestamp, content FROM messages_raw
           WHERE source_type = ? AND timestamp BETWEEN ? AND ?
             AND length(content) BETWEEN 60 AND 1200
           ORDER BY RANDOM()
           LIMIT ?`,
        )
        .all(sourceType, tsFrom, tsTo, opts.perStratum * 15);
      const zh = pool.filter((r) => ['zh', 'mixed'].includes(langOf(r.content)));
      const en = pool.filter((r) => langOf(r.content) === 'en');
      const half = Math.max(1, Math.floor(opts.perStratum / 2));
      const rows = [...zh.slice(0, half), ...en.slice(0, Math.max(1, opts.perStratum - Math.min(half, zh.length)))].slice(0, opts.perStratum);
      for (const row of rows) {
        const scene =
          sourceType === 'jira'
            ? 'jira_issue_reading'
            : sourceType === 'glip'
              ? 'ringcentral_group_chat'
              : sourceType === 'calendar'
                ? 'meeting_prep'
                : 'web_reading';
        emit(row, scene, recency);
      }
    }
  }

  // Correct no-result probes: distinctive synthetic terms that must NOT match.
  probes.push(
    {
      id: 'p05-nr-0001',
      seed: true,
      surface: 'ask',
      scene: 'web_reading',
      recency: 'any',
      language: 'zh',
      query: '量子纠缠冷冻电子显微镜采购清单',
      gold: { kind: 'no_result' },
    },
    {
      id: 'p05-nr-0002',
      seed: true,
      surface: 'ask',
      scene: 'web_reading',
      recency: 'any',
      language: 'en',
      query: 'kubernetes barnacle inspection rotunda',
      gold: { kind: 'no_result' },
    },
    {
      id: 'p05-nr-0003',
      seed: true,
      surface: 'passive',
      scene: 'ringcentral_group_chat',
      recency: 'any',
      language: 'mixed',
      query: 'guqin fingering tutorial pentatonic 古琴',
      gold: { kind: 'no_result' },
    },
  );

  fs.writeFileSync(opts.out, probes.map((p) => JSON.stringify(p)).join('\n') + '\n');
  const byLang = {};
  for (const p of probes) byLang[p.language] = (byLang[p.language] ?? 0) + 1;
  console.log(
    `[gold-sampler] ${probes.length} probes -> ${opts.out}; byLang=${JSON.stringify(byLang)}; noResult=${probes.filter((p) => p.gold.kind === 'no_result').length}`,
  );
  db.close();
}

main();
