# Skill Foundry Decision Snapshot Findings

## Selection And Reminder State

- `docs/progressing/to-verify.md` is empty, so no carry-over verification item took priority.
- Random sample included Skill Foundry `技能使用/丢弃/稍后审`; it is not the freshest exact automation target compared with Auto Reply, Agent Thinking, Notification, User Profile, Storyline, Meeting Pilot, Quick Ask, Watch, Reflection, and Scheduled Messages.
- AppleScript listed local Reminders but not `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items. All items are completed historical Doubao/Notification/test feedback, not Skill Foundry decision feedback.

## Code And UX Findings

- `PersonalSkillsPage.vue` already has suggestion groups, decision overview, card-level receipts, pending write locks, result receipts, failure receipts, snooze/unsnooze queues, and local-agent scan receipts.
- `SkillLibraryService` keeps the backend status machine simple: `suggestion -> active`, `suggestion -> dismissed`, and `snoozed_until` clear/set for later review.
- The current UI gap is in the global action receipt after a decision request. Pending/result/failure receipts say what happened but do not carry a stable click-time snapshot of the target suggestion. After `loadData()` refreshes selection, a user can read the receipt while a different detail card is selected and over-trust the current detail state.
- Low-decision improvement: thread a compact target snapshot into receipt builders. It should name title, original state, source/origin, version, review gate, and whether the action was an external change. It should not change POST payloads, status transitions, sync behavior, review gate logic, or platform writes.

## External References

- Anthropic Agent Skills and public skills repo describe skills as reusable instruction/code/resource folders that are loaded when relevant, supporting visible package/source boundaries.
- OpenAI GPT Actions docs describe custom GPT actions as API integrations with attached instructions/knowledge, supporting clear action authority and external-operation boundaries.
- AutoSkill argues for deriving, maintaining, and reusing personalized skills from dialogue/interaction traces, supporting Foundry's suggestion-to-active lifecycle.
- MUSE-Autoskill frames skill creation, memory, management, evaluation, and refinement as a unified lifecycle, supporting explicit lifecycle receipts.
- Voyager's skill library and self-verification loop reinforces that reusable executable skills should keep feedback, verification, and reuse state explicit.
