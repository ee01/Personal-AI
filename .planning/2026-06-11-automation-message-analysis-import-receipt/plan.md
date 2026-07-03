# Message Analysis import receipt plan

- Target: `记忆入口规则` under `docs/features/message_analysis.md`.
- Gap: XML import replaces manual rules without a persistent user-visible receipt for replacement scope, system-observation exclusion, dispatch side effects, or blocked runtime prerequisites.
- Plan: add an import receipt state/UI, derive counts from imported rules using existing rule summary helpers, extend E2E, update feature doc, and verify targeted scripts + dev build + E2E + diff check.
