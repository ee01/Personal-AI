# Doubao / ChatGPT Explorer Run Request Receipt Findings

## Repo Findings

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the freshest exact surfaces include Project Dashboard local search, whole-page Memory Capture, Relationship Radar Context Card, Topic empty batch, Slides skipped reselect, Digest Queue release window, Rehearsal list scope, Skill Foundry platform sync, Storyline fallback, Agent Thinking diagnostics, Message Analysis, Scheduled filters, Coverage slices, Memory ingest, Memory Lens, Message Reaction, Prompt Config, Jira Design Links, User Profile, Agent Workflow, and Dream Replay. The random selection avoided these exact rows.
- Randomly selected feature: `Doubao / ChatGPT explorer 输入链路` from `docs/index.md`.
- Reminders list scan returned visible lists `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`; no visible `Personal AI` list.
- The worktree is very dirty with many unrelated files. Keep edits scoped to Doubao Bridge desktop UI, its verifier, docs, and this planning folder.

## Code Findings

- `docs/features/doubao_bridge.md` is broadly current for the explorer input chain: it describes source auth, automatic/manual reads, raw cache, artifacts, cursor preview, reset cache, revoke, saved-vs-draft settings receipts, transport fallback, and successful/failed run summaries.
- `desktop-app/app/renderer.js` already has completion receipts via `formatExplorerRunCompletionMessage()` and `formatExplorerManualRunReceipt()`.
- The current manual run button handlers only change the button label to `抓取中...` while awaiting pending-setting save and `explorerApi.runNow()`. The richer range/non-effect receipt appears only after the run completes.
- The smallest useful UX gap: add a pre-run request receipt that states pending settings are not yet applied/confirmed, the planned scope/lookback/transport, and the no-delete/no-source-write/no-confirmed-artifact boundary.
- Existing verifier `desktop-app/scripts/doubao-source-toggle-gating-check.mjs` already simulates Doubao and ChatGPT manual runs and is the right place to assert the immediate pending receipt.

## External Reference Findings

- OpenAI Help Center documents ChatGPT memory controls as separate from past chats and describes export via Privacy Portal or ChatGPT settings. This supports clearly separating source chat data, local cache, and extracted Memory Service artifacts.
- Claude Help Center documents memory import/export as an explicit import flow that extracts key information into memory edits that can be reviewed. This supports request/completion receipts rather than silent import.
- Google Gemini privacy docs separate activity saving, temporary chats, deletion, and personalization controls. This supports visible boundaries for whether an Explorer run reads source activity, writes local cache/artifacts, or deletes source content.
- LongMemEval frames long-term memory quality around information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention. Explorer's run receipt should preserve counts and source/cursor provenance so later quality checks can understand what was extracted or skipped.
- Mem0 argues for dynamically extracting, consolidating, and retrieving salient information instead of loading raw conversation history wholesale. Personal AI's Explorer should keep the raw chat-to-artifact transformation visible.
- Recent conversational-memory and portable-agent-memory research emphasizes provenance, updateability, and deletion/erasure semantics. This reinforces the doc/code distinction between deleting Memory Service artifacts and not deleting remote source chats.

## Plan Rationale

The selected implementation does not need a user decision because it is a truthful presentation-layer improvement for an existing explicit action. It reduces the period where a user can confuse "button clicked" with "new memories already written" or "source chat modified/deleted".
