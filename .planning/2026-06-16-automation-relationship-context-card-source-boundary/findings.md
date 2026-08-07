# Relationship Radar Context Card Findings

## 2026-06-16 Initial Findings

- Randomly selected feature from `docs/index.md`: `人脉关系 Context Card`.
- Feature owner/capability: Relationship Radar.
- Source document: `docs/features/relationship_radar.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- The worktree has many unrelated dirty files from prior work. Treat all pre-existing changes as user/automation-owned and avoid reverting them.

## Code And UX Findings

- `docs/features/relationship_radar.md` is current for the backend Context Card contract: `POST /api/v1/relationships/context-card` supports person id/name, surface, token budget, default sensitive redaction, `privacySummary`, `contextReceipt`, action suggestions, and stored-card stale detection.
- Backend coverage already proves sensitive redaction, explicit sensitive inclusion, context receipt copy text, rebuilding after confirmed relationship facts, and stored-card stale receipts.
- UI coverage already proves the Context tab shows source/privacy receipts, action suggestions, default sensitive hiding, explicit sensitive inclusion, selected-person copy, and unsafe evidence-link blocking.
- UX gap: `loadContextCard()` clears `contextCard` on any API failure. As a user, a transient network/API failure leaves the Context tab empty/global-error-only, even when the previous card was still visible and useful as a stale snapshot for manual review.
- A sharper low-decision improvement is to preserve the last loaded card for the same selected person and show a scoped refresh-failure receipt. The receipt should say the visible content is the last loaded snapshot, current refresh is unconfirmed, and no profile write/send/external share happened.
- If the user clicked `临时包含敏感上下文` and that refresh fails, the UI should revert the toggle back to the previous privacy scope instead of leaving the control in a state that implies sensitive context was successfully included.

## External Reference Findings

- Salesforce Einstein Relationship Insights positions relationship intelligence as graph/research assistance embedded in account/contact workflows, with external data sources and relationship graphs. This supports keeping Context Card tied to explicit source/relationship evidence rather than treating it as generic CRM notes.
- Microsoft Dynamics 365 Sales Copilot record summaries expose inline insight banners, suggested actions, stakeholder/context sections, and record-summary extension schemas with citation-card fields. This supports keeping `现在建议`, evidence refs, and copyable context receipts together.
- Microsoft Sales Copilot email summaries distinguish CRM-enriched summaries from plain Copilot summaries and describe copy/share boundaries by surface. This supports visible copy/export boundaries in Relationship Radar.
- Mixed-Initiative Context research argues that context should be an explicit, manipulable object under negotiated human/AI control, not an invisible handoff. Preserving a failed-refresh snapshot with an explicit receipt fits that model better than silently emptying the card.
- User-centered XAI review work emphasizes transparency, actionability, and evaluation/refinement. A failure receipt is a small explainability improvement because it tells the user what is still known, what is not current, and what action to try next.
