# Task Plan: automation-2 new capability

Goal: create one non-duplicate Personal AI new-capability plan and Chinese demo under `docs/progressing`, grounded in Reminders, real `esone.qiu` memory data, repo de-dup, and current AI memory research.

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| Read workflow constraints | Complete | Read `AGENT.md`, automation memory, capability-planning memory, and relevant skills. |
| Check carry-over and de-dup | Complete | `docs/progressing/to-verify.md` is empty; adjacent plans/features scanned. |
| Check Reminders | Complete | EventKit found `Personal AI`; all fetched items were completed, so no new Reminder idea was selected or marked done. |
| Query live memory | Complete | HTTP timed out; read-only SSH/SQLite succeeded for `esone.qiu`. |
| Research current product/paper context | Complete | Checked OpenAI Memory/Atlas/Pulse, Mem0, Zep/Graphiti, LongMemEval, STALE, and Linear issue-history references. |
| Produce artifacts | Complete | Added `change-memory-ledger-plan.md` and `change-memory-ledger-demo.html`. |
| Validate artifacts | Complete | Whitespace, required sections, inline JS parse, and Playwright desktop/mobile checks passed. |

## Decision

Selected concept: **Change Memory Ledger / 变更记忆账本**.

It extracts captured Jira/source old-new field snippets into event chains and current/historical projections. It is distinct from Source Memory Distiller, Memory Freshness Radar, Evidence Watch Contracts, Evidence Cohesion Gate, and chunk-level Merge/Evolution.
