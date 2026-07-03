# Mobile Context Query Inject Receipt Plan

## Target

- Random feature: `Mobile Context Thread`
- Feature family: `Doubao Bridge`
- Canonical doc: `docs/features/doubao_bridge.md`
- Focus: Quick Ask sending an evidence-backed answer into the bound `mobile_context_thread`.

## Current State

- `docs/progressing/to-verify.md` has no carry-over item.
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be included or completed.
- The Desktop App already explains the mobile context channel and manual recent-focus / reminder pushes.
- The Quick Ask answer card exposes `发到豆包手机对话`, but its visible receipt only says `带证据发送，不写长期记忆`, then short pending / success / failure messages. As a user, that leaves several side-effect boundaries implicit: whether it sends the full answer or evidence only, whether it confirms the answer, whether it modifies the thread binding, whether it writes long-term memory, and whether it changes reminders or tasks.

## External Signals

- ChatGPT Memory Sources makes personalization provenance visible and lets users mark sources relevant or not relevant.
- Claude memory shows citations to past chats and keeps memory controls user-visible.
- Gemini Enterprise personalization emphasizes connected-source controls, saved-memory management, and explicit removal paths.
- Prospective-memory research on digital reminder systems argues that reminders need the right cue, timing, and material form, especially when the remembered material is intended for future conversations.

## Plan

1. Add a small Quick Ask helper that formats the mobile-context action receipt from answer/evidence counts.
2. Replace the initial, pending, success, and failure status copy with `query_answer_card -> mobile_context_thread` scope and non-effect boundaries.
3. Keep the same button and backend API behavior; this is a presentation-level UX clarification.
4. Add responsive CSS so the longer receipt wraps cleanly inside the answer card.
5. Update `desktop-app/scripts/quick-ask-status-card-check.mjs` to prove the initial and success receipts plus payload contract.
6. Update `docs/features/doubao_bridge.md` with the current Quick Ask injection receipt behavior.
7. Validate with `npm --prefix desktop-app run test:quick-ask-status-card`, `npm start` first successful compile, scoped `git diff --check`, and a watcher check.
