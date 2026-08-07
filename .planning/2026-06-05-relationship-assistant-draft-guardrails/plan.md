# Relationship Radar Assistant Draft Guardrails

## Target

Feature selected from `docs/index.md`: `人脉关系 Assistant Draft` / Relationship Radar.

## Findings

- The feature doc says `/relationships/assistant/draft` should generate communication draft context, but it currently describes only a thin behavior boundary.
- The backend draft is a fixed follow-up template and only returns `doNotAssume` warnings. It does not expose whether context was thin, sensitive items were excluded, review items are pending, or evidence exists.
- The route has no request body schema, unlike `context-card`, so unexpected payloads are not rejected at the API edge.
- `tools/verify-relationship-radar-e2e.mjs` covers context card, review queue, meeting brief, and graph, but not the selected Assistant Draft user action.
- Reminder check: local Reminders is accessible, but no visible `Personal AI` list exists, so no related Reminder item can be incorporated or marked done.

## External Reference Takeaways

- Outlook Copilot, Gmail Gemini, and Salesforce Einstein Sales Emails all keep drafting user-initiated and context-driven; the user remains responsible for final send.
- Smart Reply and newer AI-mediated communication research show reply suggestions improve speed but can shift language and relationship perception, so drafts need visible control and review cues.
- Mixed-initiative and AI writing-assistant research favors understandable system boundaries, not hidden automation.

## Plan

1. Add an Assistant Draft API body schema and keep the route constrained to `personId` or `personName`, optional `scenario`, and optional `userGoal`.
2. Enrich `RelationshipAssistantDraft` with a safety/evidence review summary:
   - evidence count, open-loop count, action-suggestion count, pending review count, hidden sensitive count.
   - status: `ready`, `review_first`, or `thin_context`.
   - reasons and next user-check questions.
3. Improve draft text generation so it uses the top action suggestion / open loop / relationship fact when available, while staying conservative when context is thin.
4. Render the safety review and context basis in the Assistant tab before the copy path.
5. Extend API tests and Relationship Radar E2E to cover `/relationships/assistant/draft` directly.
6. Update `docs/features/relationship_radar.md` so Assistant Draft behavior is current but not over-detailed.
7. Validate with `npm run verify:relationship-radar`, first successful `npm start` compile, `npm run verify:relationship-radar:e2e`, and `git diff --check`.
