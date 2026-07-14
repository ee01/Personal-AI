# Relationship Assistant Draft Findings

## Repository Findings

- `docs/progressing/to-verify.md` is empty, so this run does not need to continue carry-over verification.
- The worktree is broadly dirty from prior sweeps. Treat all pre-existing changes as user/automation-owned and keep this run scoped to Relationship Radar Assistant Draft plus planning/docs/verification files.
- Current Assistant Draft behavior is already documented and implemented around `/relationships/assistant/draft`: it uses redacted relationship context, returns `safetyReview`, `contextBasis`, `suggestedChecks`, a generation receipt, stale-goal copy lock, and a copy receipt.
- UX gap: the request and copy receipts appear after the action path starts. The generate/copy buttons themselves do not expose the privacy/writeback/clipboard boundary to hover, keyboard, or screen-reader users before the click.

## Reminder Findings

- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items.
- Completed items relate to Doubao mobile briefing, local app logs, and Weekly Dream Digest details. None are related to Relationship Radar, Assistant Draft, relationship context, relationship-sensitive drafting, or copy boundaries.
- No Reminder item should be marked done in this run.

## External Reference Findings

- Microsoft Copilot in Outlook keeps draft generation as a review/edit/keep/send flow and lets users regenerate or adjust tone/length before sending: https://support.microsoft.com/en-us/outlook/copilot-pages/draft-an-email-message-with-copilot-in-outlook
- Gemini in Gmail emphasizes draft creation from prompts, contextual replies, summarization, and tone changes while leaving the user to make the message their own: https://workspace.google.com/products/gmail/ai/
- Salesforce Einstein Relationship Insights positions relationship context as researched connections and effective-communication support, not blind message sending: https://trailhead.salesforce.com/content/learn/modules/einstein-relationship-insights-basics/get-started-with-einstein-relationship-insights
- Google Smart Reply shows response suggestions can be high-impact and high-throughput; one-tap replies need strong user authority and diversity controls: https://research.google/pubs/smart-reply-automated-response-suggestion-for-email/
- Formal-email LLM research finds users still need detailed prompts; question/answer or structured prompt support can reduce workload while keeping quality and interpersonal dynamics in view: https://arxiv.org/html/2502.03804v2
- Mixed-Initiative Context argues active context should be explicit, structured, and user-manipulable, with users retaining authority to accept, reject, modify, or override context judgments: https://arxiv.org/html/2604.07121v1
- AI-mediated communication research warns smart replies influence authored content, agency, attribution, trust, and interpersonal perception; relationship-aware drafting should keep control and authorship boundaries visible before copying or sending: https://www.sciencedirect.com/science/article/pii/S2772503023000221

## Implementation Finding

- Constructing preflight labels entirely in the Vue surface is sufficient: no API payload, Memory Service write path, safety review, context-card filtering, generation logic, or clipboard behavior needs to change.
