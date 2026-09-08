# P0c Old-Stack Baseline Report

- Generated: 2026-09-08, against production `esone.qiu` memory.db (post backfill + P0a/P0b fixes)
- Channels measured: legacy porter FTS (`chunks_fts`) vs trigram shadow (`chunks_fts_tri`) vs dense (`chunks_vec`, MiniLM-L6-v2, cosine < 0.7, cap 30)
- Tool: `memory-service/scripts/p0c-baseline-report.mjs`

## Key findings

| Fixture | porter | trigram | dense | note |
|---|---:|---:|---:|---|
| cross-lang-cursor-policy | 323 | 353 | 30 | both noisy (OR tokenization over-match) |
| cross-lang-meeting-room | **0** | **1** | 30 | trigram recovers the CJK-substring gap porter cannot match |
| cross-lang-nova-mention | 8268 | 8531 | 30 | heavy over-match on generic terms |
| en-cursor-billing | 4245 | 2719 | 30 | |
| en-codex-trial | 5506 | 2320 | 30 | |
| zh-ai-review | 4581 | 1474 | 30 | |
| zh-estimate | 4527 | 4731 | 30 | |
| mixed-openrouter | 142 | 155 | 30 | |

Aggregates: no-result porter = 1/8, trigram = 0/8; trigram-only wins = 1; dense-only wins = 1.
Vector coverage: 15,771/15,771 message chunks embedded (100% — gap closed by the backfill + runtime embedding re-enable).

## Interpretation (feeds P0.5)

1. The raw candidate counts show the lexical channels over-match generic multi-term
   queries (thousands of candidates) — ranking, not just recall, drives precision; the
   P0.5 ablation must measure useful@1 after gating, not candidate volume.
2. Trigram strictly dominates porter on CJK substring queries with zero porter hits —
   supports adding it as a P2 channel candidate after calibration.
3. Dense coverage is now complete for message chunks; MiniLM cross-lingual weakness
   remains the open question for multilingual-e5 (P0.5 variant D).
