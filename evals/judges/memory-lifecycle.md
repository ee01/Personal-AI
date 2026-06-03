# Memory Lifecycle Judge Rubric

Use this rubric only if a future run enables LLM judging. The default
`memory-lifecycle` suite is deterministic and should pass/fail from returned
ids, lifecycle tiers, and forgetting writeback.

## Pass

- Default active recall suppresses `archive_only` and `forgotten` memories.
- Passive and composer surfaces only expose `core` or `active` memories.
- Negative recall feedback suppresses passive/composer matches.
- Explicit search or historical mode can return `historical` or `archive_only`
  evidence, with lifecycle metadata visible in the report.
- Forgetting writeback updates `retrieval_tier`, `effective_salience`, and
  consolidation state consistently.

## Fail

- Archived or forgotten memories appear in default/passive/composer recall.
- Historical or explicit search cannot recover expected archived evidence.
- Negative-feedback memories appear in Compose Assist style recall.
- The report hides returned ids, tiers, or forgetting writeback state.
