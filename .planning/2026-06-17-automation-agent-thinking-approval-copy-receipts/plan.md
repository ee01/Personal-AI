# Agent Thinking Approval Copy Receipts Plan

## Context

- `docs/progressing/to-verify.md` is clear, so this run selected a fresh feature.
- Random feature selected: `docs/features/agent_thinking.md`.
- Real-user persona: a cautious reviewer handling a pending notification action from the Options Agent Thinking demo.
- Primary surface: Chrome extension `options.html` via the existing Playwright unpacked-extension harness. Direct webpage-mcp control is not available in this session.
- Reminders list check found no `Personal AI` list, so no Reminder item can be used or completed.

## UX Gap

The pending-approval card already explains review, retry, and recovery boundaries before the user clicks anything. After a successful copy action, however, the status only says `已复制批准 key`, `已复制审核包`, or `已复制重跑配置`.

For a high-risk pending tool action, that short status is weaker than the surrounding boundary copy. A real reviewer can still wonder whether copying the retry config executed the notification, whether the review packet contains enough context, or whether the key alone is a durable approval record.

## Plan

1. Keep the existing pending-approval card layout and data model.
2. Expand the three successful copy receipts:
   - key copy: only a precise same-tool/same-params key was copied; no action executed.
   - review packet copy: review context and boundaries were copied; no notification/write action executed.
   - retry config copy: only `approvedToolActionKeys` was copied; the caller must rerun with the same tool and params.
3. Extend the Options E2E to click all three successful copy paths and assert the new receipts.
4. Preserve the existing forced clipboard-failure fallback for the review packet manual-copy path.
5. Update `docs/features/agent_thinking.md` with the new approval-copy receipt behavior and validation evidence.
6. Verify with targeted Agent Thinking script, first successful `npm start` compile, Agent Thinking Options E2E, and path-scoped whitespace checks.
