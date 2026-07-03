# Jira issue key readonly recovery plan

## Target

- Random feature: `Jira issue key 解析`
- Source doc: `docs/features/jira_design_links.md`
- Runtime surface: Jira ticket content script design-link panel

## Current gap

The panel already recovers UX issue keys from Jira query params, `data-issue-key`, ARIA labels, and raw text. It shows `Key from ...`, but the row still looks close to a normal linked issue. As a developer scanning the Jira summary, it is not explicit enough that this is only a read-only recovered candidate and that Personal AI did not create or edit Jira issue links or design fields.

## External scan signal

- Atlassian issue-link docs treat inward/outward linked issues as explicit Jira relationships, so recovered text keys should not be presented like written links.
- Figma/Jira handoff docs emphasize synced design readiness/status inside linked Jira issues, which makes weak recovered candidates useful but not authoritative.
- Traceability-link recovery research treats recovered links as candidate evidence that benefits from confidence/boundary visualization.

## Implementation steps

1. Add a helper for non-standard UX key recovery boundary copy.
2. Render a compact `只读恢复` tag beside `Key from ...` for query / data attribute / ARIA / raw-text recovered UX rows.
3. Extend tooltip copy to say Personal AI only shows the recovered candidate and does not create/edit Jira issue links or design fields.
4. Update unit and E2E verification to assert the new helper, visible tag count, and boundary tooltip.
5. Update the feature doc and index date with the current behavior.
6. Run targeted verifier, dev compile, E2E, and path-scoped diff checks.
