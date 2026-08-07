# 2026-07-05 Automation: Timeline External Source Confirmation

## Target

- Feature: `时间轴/搜索安全跳转`
- Canonical doc: `docs/memory_system.md`
- UI/code: `src/modals/components/TimelinePage.vue`, `src/modals/timelinePresentation.ts`

## Research Notes

- Slack AI search and recaps expose source citations and source previews instead of hiding evidence behind a generic answer.
- Notion Enterprise Search exposes source scope controls and cites workspace / connected-app sources.
- IBM CHI 2025 RAG transparency work reports that source attribution, highlighted source sections, and source control improve user trust more than confidence alone.
- OWASP unvalidated redirect guidance supports strict validation and avoiding untrusted URL-driven navigation.

## Plan

1. Keep existing URL sanitization, signed URL blocking, sensitive query blocking, and internal route allowlist unchanged.
2. Change only Timeline cards whose only safe navigation target is an external `sourceUrl`: card click should show a confirmation/boundary receipt instead of opening a new tab.
3. Keep explicit `打开来源` as the only external-open action, preserving `noopener,noreferrer`.
4. Update the focused verifier and E2E fixture with a source-only safe row to prove card click does not call `window.open`, while the explicit button still does.
5. Update `docs/memory_system.md` with the current user-visible behavior.

## Reminder Outcome

EventKit found the local `Personal AI` Reminder list with 4 completed historical Doubao / Notification items. None were open or related to Memory Timeline, search result safety, source-link opening, or Memory Exploring, so no Reminder item was incorporated or marked done.
