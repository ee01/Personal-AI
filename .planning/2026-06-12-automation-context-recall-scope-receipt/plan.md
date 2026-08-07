# Context Recall Scope Receipt Plan

## Selected feature

- Random pick: `工作/个人/全部范围语义`
- Source of truth: `docs/memory_system.md`

## Context

- `docs/progressing/to-verify.md` says `暂无。`
- Local Reminders are readable, but the `Personal AI` list is absent, so no Reminder items are incorporated or marked done.
- Search results already show work / personal / all boundaries. The remaining gap is passive `context-recall`: it defaults to `all`, but callers do not receive a stable receipt explaining which scope was searched and whether personal memories entered the candidate set.
- External review: ChatGPT memory sources, Microsoft 365 Copilot semantic index, Notion Enterprise Search, and Opal/PIM retrieval research all point toward source/scope/permission visibility at query time.

## Improvement Plan

1. Add a `scopeReceipt` contract to `ContextRecallResponse` with requested/effective scope, shown/candidate scope counts, and a user-facing boundary note.
2. Preserve current retrieval behavior: `context-recall` still defaults to `all`, `all` remains server-equivalent to `both`, and specific `work` / `personal` requests still narrow results.
3. Carry stored `scope` onto each `ContextRecallMatch` so Memory Lens cards can show the domain of the actual evidence.
4. Show the scope label in Memory Lens compact/expanded metadata without making the card busier than the existing source/date chips.
5. Update `docs/memory_system.md` to record the passive recall scope receipt.
6. Verify with the focused API test, web-intelligence helper check, dev compile, context recall E2E where practical, and diff checks.

