# Relationship Meeting Brief Pending Receipt Plan

## Target

- Feature: `人脉关系 Meeting Brief` in `docs/features/relationship_radar.md`.
- Surface: `memory-exploring.html#/entity/Person`, `会议简报` tab.
- Reminder status: local Reminders has no `Personal AI` list, so no related item can be linked or completed.

## Research Takeaways

- Microsoft Copilot for Sales meeting prep cards expose meeting essentials, highlights, data availability and fallback states before deeper preparation.
- Salesforce Einstein Relationship Insights keeps relationship evidence inside the work surface, but CRM/update actions are explicit.
- AI-mediated communication research warns that AI help in interpersonal contexts changes trust and perception, so relationship suggestions need visible source and non-effect boundaries.
- Meeting recap research argues that one generic summary is not enough; users need task-specific structure and the ability to understand what is and is not covered.

## Improvement

1. Keep the existing source receipt, identity-check, coverage cap, readiness and focus logic unchanged.
2. Add an immediate pending receipt after clicking `生成会议人物简报`.
3. The receipt should show the request title, attendee count, first-16 analysis cap, that the old brief is still the previous snapshot, and that no message/profile/task/writeback occurs while waiting.
4. On success, clear the pending receipt and render the real brief.
5. On failure, leave the old brief visible but make the pending boundary clear through the error path.

## Validation

- Run `npm run verify:relationship-radar`.
- Run `npm start`, wait for first successful compile, then stop it.
- Run `npm run verify:relationship-radar:e2e`.
- Run scoped `git diff --check`.
