# E-155 slice verification — scheme A

**Run:** `2026-10-31` (post idle-eviction + parseLlmJson fixes)  
**Events:** `slice-events.jsonl` (304 events, phase-2 slice)  
**Output:** `A-slice-verify/`  
**Harness exit:** 0 (~61 min wall)

## Hard gates

| Check | Result |
| --- | --- |
| `database connection is not open` | **0** |
| Harness crash / non-zero exit | **0** |

## LLM JSON parse (ingestion extraction)

| Metric | Value |
| --- | --- |
| `[LLMClient] Failed to parse JSON` / `LLM extraction failed` lines | **77** |
| Notes | Remaining failures are mostly empty model bodies and mid-stream truncation; fence stripping is fixed; `maxTokens` raised to 4096 for entity extraction. Further truncation repair landed after this run (string-close + bracket suffix). |

## Probes (informational)

26/56 passed, mean composite 45.18, proxy ~$5.03 (shared launchd ledger).
