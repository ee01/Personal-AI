# Jira Design Links filtered-reference receipt plan

## Target

Random feature pick from `docs/index.md`: Jira Design Links, especially conservative Figma/Zeplin classification.

## Current finding

- `docs/progressing/to-verify.md` has no pending carry-over task.
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be merged or completed.
- Current docs and code already handle Figma/Jira status, update-date receipts, source ordering, nested remote-link fallback, and basic Figma Community / Zeplin marketing filtering.
- The remaining UX gap is that filtered Figma/Zeplin-looking URLs disappear silently. That is correct for precision, but hard for a user to audit when a Jira description contains docs, community, marketing, profile, or settings URLs near real handoff links.

## Industry / research constraint

- Figma for Jira and Figma Dev Mode treat explicit linked files/prototypes and handoff statuses as the useful Jira signal.
- Zeplin for Jira exposes attached screens, sections, projects, and flows as the Jira-facing design resources.
- Traceability research emphasizes precision and understandable artifact links; noisy false positives can reduce trust.

## Implementation steps

1. Add shared helper support for scanning design URLs with both accepted design links and ignored design-like references.
2. Tighten Zeplin classification so `app.zeplin.io/project/<id>/settings`-style non-resource paths do not render as handoff rows.
3. Surface ignored Figma/Zeplin-looking references as a compact footer/a11y receipt, without exposing them as design links.
4. Update focused verifier and extension E2E fixture/assertions.
5. Update `docs/features/jira_design_links.md`.
6. Validate with `verify:jira-design-links`, first successful `npm start`, `verify:jira-design-links:e2e`, and `git diff --check` scoped to the owned files.
