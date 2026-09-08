#!/usr/bin/env node
/**
 * P0.5 retrieval ablation runner (memory-foundation plan §11.5).
 *
 * Self-contained, deterministic channel implementation so every variant is
 * measured symmetrically (the production RecallEngine differs per feature
 * flags and would skew comparisons):
 *
 *   A       lexical (porter FTS) + dense (MiniLM) RRF — old-stack baseline
 *   A_TRI   A + trigram channel in the RRF
 *   D       lexical + dense (multilingual-e5, query/passage prefixed) RRF
 *   E       D with int8-quantized e5 vectors
 *
 * Judge: deterministic hit-by-gold-message-id (probes are seeded with
 * provenance; no LLM judge). Metrics: hit@1, hit@5, MRR@10, plus correct
 * abstention for no-result probes (no candidate scoring ≥ ABSTAIN_THRESHOLD).
 * Bootstrap 95% CI over probe resampling for paired variant diffs.
 *
 * Usage (inside container):
 *   node scripts/p05-ablation.mjs --db-path ... --gold seed.jsonl \
 *     --variants A,A_TRI --out /tmp/p05-report.json
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const TOP_N = 50; // per-channel candidate depth
const RRF_K = 60;
const ABSTAIN_THRESHOLD = 0.5;

function parseArgs(argv) {
  const opts = { dbPath: '', gold: '', variants: 'A,A_TRI', out: '/tmp/p05-report.json', e5Table: 'chunks_vec_e5' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--db-path' && argv[i + 1]) opts.dbPath = argv[++i];
    else if (argv[i] === '--gold' && argv[i + 1]) opts.gold = argv[++i];
    else if (argv[i] === '--variants' && argv[i + 1]) opts.variants = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) opts.out = argv[++i];
    else if (argv[i] === '--e5-table' && argv[i + 1]) opts.e5Table = argv[++i];
  }
  if (!opts.dbPath || !opts.gold) throw new Error('--db-path and --gold are required');
  return opts;
}

function sanitizeFtsQuery(query) {
  const cleaned = query.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map((t) => `"${t}"`).join(' OR ');
}

function buildTriQuery(queryText) {
  const cleaned = queryText.replace(/["'^\-:()\[\]{}*+]/g, ' ').trim();
  if (!cleaned.length) return '';
  const fragments = [];
  for (const token of cleaned.match(/[\u3400-\u9fff]{3,}|[a-zA-Z0-9][a-zA-Z0-9._:-]{2,}/gu) ?? []) {
    if (!/[\u3400-\u9fff]/.test(token) || token.length <= 6) {
      fragments.push(token);
      continue;
    }
    for (let i = 0; i + 4 <= token.length && fragments.length < 10; i += 1) {
      fragments.push(token.slice(i, i + 4));
    }
  }
  if (fragments.length === 0) return '';
  return fragments.slice(0, 10).map((f) => JSON.stringify(f)).join(' OR ');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const db = new Database(opts.dbPath, { readonly: true });
  let sqliteVecLoaded = true;
  try {
    const sqliteVec = require('sqlite-vec');
    db.loadExtension(sqliteVec.getLoadablePath());
  } catch {
    sqliteVecLoaded = false;
  }

  const probes = fs
    .readFileSync(opts.gold, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const { EmbeddingClient } = await import('/app/dist/llm/EmbeddingClient.js');
  let minilm = null;
  try { minilm = await EmbeddingClient.getInstance(); } catch { /* report later */ }

  let e5 = null;
  const wantsE5 = opts.variants.split(',').some((v) => ['D', 'E'].includes(v.trim()));
  if (wantsE5) {
    try {
      const { pipeline } = await import('@xenova/transformers');
      const extract = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', { quantized: true });
      e5 = {
        embed: async (text, prefix) => {
          const out = await extract(`${prefix}${text}`, { pooling: 'mean', normalize: true });
          return out.tolist()[0];
        },
      };
      console.log('[ablation] multilingual-e5-small loaded');
    } catch (err) {
      console.log(`[ablation] multilingual-e5-small INELIGIBLE: ${err.message}`);
    }
  }

  // e5 passage coverage check (variant D/E need the e5-embedded corpus table)
  let e5Coverage = null;
  if (e5) {
    try {
      const total = db.prepare(`SELECT COUNT(*) c FROM chunks WHERE file_path LIKE 'messages/%'`).get().c;
      const covered = db.prepare(`SELECT COUNT(*) c FROM ${opts.e5Table}`).get().c;
      e5Coverage = { total, covered };
    } catch {
      e5Coverage = { total: null, covered: null, error: 'e5 table missing (build with p05-e5-backfill.mjs)' };
    }
  }

  const porterSearch = (query) => {
    const ftsQuery = sanitizeFtsQuery(query);
    if (!ftsQuery) return [];
    try {
      return db
        .prepare(`SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?`)
        .all(ftsQuery, TOP_N)
        .map((r) => ({ chunkId: r.rowid, channel: 'porter' }));
    } catch { return []; }
  };

  const triSearch = (query) => {
    const q = buildTriQuery(query);
    if (!q) return [];
    try {
      return db
        .prepare(`SELECT rowid FROM chunks_fts_tri WHERE chunks_fts_tri MATCH ? ORDER BY rank LIMIT ?`)
        .all(q, TOP_N)
        .map((r) => ({ chunkId: r.rowid, channel: 'tri' }));
    } catch { return []; }
  };

  const denseSearch = (query, variant) => {
    if (variant === 'D' || variant === 'E') {
      if (!e5) return [];
      return e5.embed(query, 'query: ').then((embedding) => {
        try {
          const rows = db
            .prepare(
              `SELECT chunk_id FROM ${opts.e5Table} ORDER BY vec_distance_cosine(embedding, ?) LIMIT ?`,
            )
            .all(JSON.stringify(embedding), TOP_N);
          return rows.map((r) => ({ chunkId: r.chunk_id, channel: 'dense_e5' }));
        } catch { return []; }
      });
    }
    if (!minilm) return Promise.resolve([]);
    return minilm.embed(query).then((embedding) => {
      try {
        const rows = db
          .prepare(
            `SELECT chunk_id FROM chunks_vec ORDER BY vec_distance_cosine(embedding, ?) LIMIT ?`,
          )
          .all(JSON.stringify(embedding), TOP_N);
        return rows.map((r) => ({ chunkId: r.chunk_id, channel: 'dense_minilm' }));
      } catch { return []; }
    });
  };

  const rrfFuse = (channelResults) => {
    // channelResults: Array<{channel: string, candidates: Array<{chunkId}>}>
    const scores = new Map();
    for (const { candidates } of channelResults) {
      candidates.forEach((cand, idx) => {
        const s = 1 / (RRF_K + idx + 1);
        scores.set(cand.chunkId, (scores.get(cand.chunkId) ?? 0) + s);
      });
    }
    return [...scores.entries()]
      .map(([chunkId, score]) => ({ chunkId, score }))
      .sort((a, b) => b.score - a.score);
  };

  const chunkMeta = db.prepare(
    `SELECT chunk_id, file_path, related_entity_id, substr(content,1,80) preview FROM chunks WHERE chunk_id = ?`,
  );
  const rankedMessage = (chunkId) => {
    const row = chunkMeta.get(chunkId);
    if (!row) return null;
    if (!row.file_path || !row.file_path.startsWith('messages/')) return { kind: 'derived' };
    return { kind: 'message', messageId: row.related_entity_id, preview: row.preview };
  };

  const runVariant = async (variant, probe) => {
    const channels = [];
    channels.push({ candidates: porterSearch(probe.query) });
    if (variant === 'A_TRI') channels.push({ candidates: triSearch(probe.query) });
    channels.push({ candidates: await denseSearch(probe.query, variant) });
    const fused = rrfFuse(channels);
    const top = fused.slice(0, 10).map((f) => {
      const meta = rankedMessage(f.chunkId);
      return {
        chunkId: f.chunkId,
        score: Number(f.score.toFixed(5)),
        kind: meta?.kind ?? 'missing',
        messageId: meta?.messageId ?? null,
      };
    });
    return top;
  };

  const variants = opts.variants.split(',').map((v) => v.trim()).filter(Boolean);
  const results = {};
  for (const variant of variants) {
    const perProbe = [];
    for (const probe of probes) {
      const top = await runVariant(variant, probe);
      let hitRank = null;
      if (probe.gold.kind === 'message') {
        const rank = top.findIndex((t) => t.messageId === probe.gold.messageId);
        hitRank = rank === -1 ? null : rank + 1;
      }
      perProbe.push({
        id: probe.id,
        scene: probe.scene,
        language: probe.language,
        goldKind: probe.gold.kind,
        hitRank,
        hit1: hitRank !== null && hitRank <= 1,
        hit5: hitRank !== null && hitRank <= 5,
        mrr: hitRank !== null ? 1 / hitRank : 0,
        abstainCorrect: probe.gold.kind === 'no_result' ? top.every((t) => t.score < ABSTAIN_THRESHOLD) : null,
        topScore: top[0]?.score ?? 0,
      });
    }
    const n = perProbe.length || 1;
    results[variant] = {
      probes: n,
      hit1: perProbe.filter((p) => p.hit1).length / n,
      hit5: perProbe.filter((p) => p.hit5).length / n,
      mrr10: perProbe.reduce((a, p) => a + p.mrr, 0) / n,
      abstentionCorrect:
        perProbe.filter((p) => p.goldKind === 'no_result').length > 0
          ? perProbe.filter((p) => p.abstainCorrect === true).length /
            perProbe.filter((p) => p.goldKind === 'no_result').length
          : null,
      perProbe,
    };
    console.log(
      `[ablation] ${variant}: hit@1=${results[variant].hit1.toFixed(3)} hit@5=${results[variant].hit5.toFixed(3)} mrr@10=${results[variant].mrr10.toFixed(3)} abstention=${results[variant].abstentionCorrect}`,
    );
  }

  // ---- paired bootstrap CI (each later variant vs the first baseline) ----
  const baselineVariant = variants[0];
  const bootstrap = [];
  for (const variant of variants.slice(1)) {
    const base = results[baselineVariant].perProbe;
    const comp = results[variant].perProbe;
    const diffs = base.map((_, i) => (comp[i].hit5 ? 1 : 0) - (base[i].hit5 ? 1 : 0));
    const B = 1000;
    const means = [];
    for (let b = 0; b < B; b += 1) {
      let sum = 0;
      for (let i = 0; i < diffs.length; i += 1) sum += diffs[Math.floor(Math.random() * diffs.length)];
      means.push(sum / diffs.length);
    }
    means.sort((a, b) => a - b);
    bootstrap.push({
      comparison: `${variant} - ${baselineVariant}`,
      metric: 'hit@5',
      meanDiff: Number((diffs.reduce((a, d) => a + d, 0) / diffs.length).toFixed(4)),
      ci95: [Number(means[Math.floor(B * 0.025)].toFixed(4)), Number(means[Math.floor(B * 0.975)].toFixed(4))],
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    goldFile: opts.gold,
    probeCount: probes.length,
    seedProvenance: 'machine-seeded, human-annotation pass pending (plan §11.5)',
    judge: 'deterministic gold-message-id hit; abstention = all top-10 RRF scores < 0.5',
    models: {
      control: 'Xenova/all-MiniLM-L6-v2 (exact local revision pinned by config)',
      multilingualE5: e5 ? 'Xenova/multilingual-e5-small (quantized ONNX)' : 'ineligible (load failed)',
      e5Coverage,
      sqliteVecLoaded,
    },
    rrf: { topN: TOP_N, k: RRF_K, abstainThreshold: ABSTAIN_THRESHOLD },
    variants: Object.fromEntries(
      Object.entries(results).map(([v, r]) => [v, { probes: r.probes, hit1: r.hit1, hit5: r.hit5, mrr10: r.mrr10, abstentionCorrect: r.abstentionCorrect }]),
    ),
    bootstrap,
    perProbe: Object.fromEntries(
      Object.entries(results).map(([v, r]) => [v, r.perProbe.map((p) => ({ id: p.id, hitRank: p.hitRank, abstainCorrect: p.abstainCorrect, language: p.language, scene: p.scene, goldKind: p.goldKind }))]),
    ),
  };
  fs.writeFileSync(opts.out, JSON.stringify(report, null, 2));
  console.log(`[ablation] report: ${opts.out}`);
  db.close();
}

main().catch((err) => {
  console.error('[ablation] failed:', err);
  process.exit(1);
});
