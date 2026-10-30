# Phase 1 export report — `raw-only`

Generated: 2026-10-30T08:13:11.111Z

## Scale

- Total events: **14892**
- Time span (occurred_at): 2025-02-13T16:00:00.000Z → 2026-09-02T08:30:00.000Z

### By source

- `messages_raw`: 13484
- `markdown_file`: 673
- `source_memory_capsule`: 735

## Phase 0 reference

- Database sha256 (T0): 5664614e0e7c7bf4d7a3beb943bca2c1917077bbf5e6d904fb9401ddb6c17ddb
- T0 capturedAt: 2026-10-30T07:01:34.140Z

## Content hashes (this manifest)

- `events.jsonl`: `5f0a88f25aeba7c916bdeb00ed566a3442737a4104ace978c0cc2ec929b24c05`
- `storyline-index.json`: `4160c4fc6e08b13606f8092373331225eded5845ab6ff5ec3bb6e410092b6f29`

## Repair / discard rules

| Case | Action |
|------|--------|
| `source_type` empty | Infer glip from group_id / markup / metadata.sourceType; else **discard** |
| `source_type=g` | Normalize to **glip** |
| `timestamp=0` | metadata time fields → **created_at**; still missing → **discard** |
| occurred below 2020 floor | Replace with **created_at** when plausible |

- Discarded rows: **1234**
- Explicit repair audit rows: **0** (repairs also recorded in event provenance.repairs)

## Virtual clock replay

Events sorted by `(observed_at, event_id)`; field `replay_seq` is 1-based visibility order (late updates use `updated_at` as observed_at).

## Known issues

- Production DB migration **066** (see Phase 0): no `origin_class` / promotion columns on messages_raw.
- Empty `source_type` rows (868) share `timestamp=0`; recovered as glip when group/markup allows, remainder discarded.
- Markdown `projects/` empty on prod at export time; daily + reflection-threads exported via SSH.
