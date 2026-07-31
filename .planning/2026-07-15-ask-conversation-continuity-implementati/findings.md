# Ask Conversation Continuity Findings

## Requirements
- Opening Quick Ask should naturally offer to continue the previous Ask with no review page or backup drawer.
- The last Ask session should be short-lived local desktop state, separate from memory-service durable memory.
- `继续` must carry explicit context hints and re-retrieve fresh evidence; `新问题` must not inherit the old topic; `丢弃` only removes the local snapshot.
- Identify adjacent surfaces that can later reuse the same local continuation primitive, but keep P0 scoped to Quick Ask.
- Complete implementation with canonical docs, eval suite, one generated report, and iterative fixes until passing.

## Research Findings
- Repository `AGENT.md` requires desktop-app build/E2E for user-visible desktop changes.
- Changes to `/ask` prompt assembly or recall behavior require experience evals and the memory-abilities regression gate when applicable.
- Existing memory notes identify `desktop-app/app/quick-ask.js` and `desktop-app/scripts/quick-ask-status-card-check.mjs` as the stable renderer/harness pair.
- The approved design artifact is `docs/progressing/ask-conversation-continuity-plan.md`; its demo is an embedded Quick Ask window, not a standalone page.
- Quick Ask already keeps `currentSessionMessages`, `currentTurns`, and 30-minute in-renderer session history while the Electron renderer remains alive; the new feature should cover renderer/app reconstruction and explicit inheritance, not replace that history model.
- Quick Ask already uses `window.localStorage` for `desktop-app.quick-ask.draft`, so a versioned local resume snapshot can use the same synchronous first-frame persistence boundary.
- The renderer has existing lifecycle events for `onWindowShown`, `onPrepareHide`, and `onResetSession`; these are the natural save/load/clear integration points.
- `quickAsk.askStream` sends the renderer payload unchanged to `/assistant/ask/stream`, so the resume hint can remain an explicit optional request field without adding IPC storage plumbing.
- The existing desktop package includes Playwright and exposes `npm run verify:quick-ask:e2e` through `desktop-app/scripts/quick-ask-status-card-check.mjs`.
- Desktop server currently forwards only `query`, `context`, `includeEvidence`, and `scope`; the optional hint must be added to `BridgeAssistantAskRequest`, both server routes, and `BridgeMemoryServiceClient` sync/stream methods.
- Memory Service `/ask` has `additionalProperties: false`, so `contextHints` requires an explicit bounded schema. Its existing context-expansion path already understands `Selected topic:` / conversation-title anchors, making a formatted local hint a natural disambiguation input.
- `/ask` already observes answer memory from the final query/evidence, but it does not persist raw request context. The new contract must keep the snapshot text out of durable memory and describe it as a non-authoritative retrieval hint.
- The response needs a structured continuity receipt so Quick Ask and evals can prove that a hint was used while current evidence was re-retrieved.
- Existing `ask-context-gap` eval cases already use real `esone.qiu` anchors around `MTR-141852 / AI Custom VBG`; these can ground the continuity suite without inventing private examples.
- Canonical Doubao Bridge docs explicitly say Quick Ask survives only in renderer memory and does not restore after app restart; that section must be updated after implementation.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use an explicit versioned local snapshot | Supports migration, TTL, redaction, and deterministic recovery behavior |
| Store one recent Quick Ask snapshot with a 24-hour TTL | Meets interruption recovery without creating a hidden local transcript archive |
| Treat resume content as hints, not authority | Prevents stale answers from bypassing current memory retrieval |
| Deterministic UI/E2E plus scenario eval | Persistence and click state are deterministic; relevance/leakage behavior is experiential |
| Preserve existing in-memory session behavior | The local snapshot is a recovery aid after reconstruction, not a second archive or a replacement for current visible chat history |
| Add a structured `continuityReceipt` to Ask responses | The UI and eval report need machine-checkable proof that local hints were non-authoritative and fresh evidence was requested |
| Add a dedicated `ask-conversation-continuity` suite | UI tests prove click/persistence behavior; real Ask cases must separately prove topic continuation, re-retrieval, and no-hint isolation |
| Treat selected topic as a first-class eval output | Candidate lists can contain the right topic while the actual locked topic is wrong |
| Keep timeout fallback topic-aware | Recalled evidence remains useful even when the final generation call times out |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Ambient `Nova` frame shared `MTR-141852` and beat `AI VBG` | Added semantic/direct-title preferred-topic compatibility and deterministic priority |
| Generic follow-up words removed all fallback evidence | Use locked topic label/aliases/anchors for fallback evidence filtering |
| Remote service restarted during long evals | Waited for concurrent Docker deployment; for the six-ability gate only, held and then removed the watchdog lock |

## Resources
- `AGENT.md`
- `docs/demo/ask-conversation-continuity.html`
- `.eval-runs/20260715T043621Z-ask-conversation-continuity-4f56vp/report.html`
- `desktop-app/app/quick-ask.js`
- `desktop-app/scripts/quick-ask-status-card-check.mjs`
