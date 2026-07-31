# Keystone Brief Auto Composer Implementation

Goal: make Keystone Memory Briefs appear automatically inside the existing Memory Lens, with no user generation step, and define the passive first-screen priority as Keystone Brief > Change Ledger > other Lens presentations.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Inspect current storage, recall, scheduler, LLM/fallback, dirty worktree, docs, tests, and eval contracts |
| 2 | completed | Design automatic discovery/composition/backfill with read-only context-recall and deterministic safety gates |
| 3 | completed | Implement backend composer, scheduler/backfill, observability, and targeted service tests |
| 4 | completed | Lock extension priority and combined Brief/Change Ledger behavior with E2E coverage |
| 5 | completed | Restructure Memory Lens docs and move UI-level detail out of memory_system.md |
| 6 | completed | Add/update real-scene evals and run targeted build, tests, and extension E2E |
| 7 | completed | Deploy memory-service, run memory ability regression, verify real esone.qiu brief generation and live Lens behavior, then summarize experience steps |

## Decisions

- User-facing generation is automatic; there is no Generate Brief button or required manual API call.
- `/context-recall` remains a read-only fast path and does not synchronously invoke an LLM or persist a brief because a page was opened.
- Automatic discovery/composition runs in the memory-service maintenance lifecycle and includes existing-memory backfill.
- Passive first-screen priority is: ready/partial Keystone Brief, then Change Ledger, then other passive Lens presentations.
- Selection Memory Search and Rehearsal remain exclusive variants and are not taken over by Keystone Briefs.
- `memory_lens.md` owns UI presentation detail. `memory_system.md` keeps system responsibilities, lifecycle, storage, and links to the feature doc.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Existing root planning files and `.planning/.active_plan` belong to other work | Planning initialization | Use this isolated directory and do not overwrite the active-plan pointer |
| Composer discarded messages with short summaries even when their bodies were substantial | First targeted test | Use the summary only when it meets the evidence threshold; otherwise use the original message body |
| Production disables the full proactive scheduler | First deployment | Run the bounded brief composer from its own maintenance timer so automatic generation does not depend on proactive recommendations |
| Production disables ordinary passive recall search | Live RingCentral verification | Add a brief-only read path that matches existing ready/partial briefs without enabling the broader passive search workload |
