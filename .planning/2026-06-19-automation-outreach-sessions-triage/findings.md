# Outreach Sessions Triage Findings

## Repo Findings

- Current docs already describe Outreach as the proactive layer for asking external people/groups, with target confirmation, approval, waiting, escalation, failure, retry, and load-error behavior.
- `OutreachSessions.vue` already has per-card handoff receipts for templates and sessions, plus retry actions for `failed`, `no_reply`, and `escalated` terminal states.
- UX gap: the page header shows count pills, but there is no first-row "what should I handle now" receipt. A user must scan each section to know whether the next action is setup repair, approval, waiting, retry, or no action.
- Existing E2E already covers load failure preservation, template receipts, waiting receipts, terminal retry, message-reaction source links, and detail navigation.

## Reminder Findings

- AppleScript list scan returned no `Personal AI` Reminders list. No item was related to this target and no Reminder can be marked done.

## External Reference Findings

- Microsoft Copilot Studio's request-information action pauses automation, asks assigned humans for input, then resumes with that submitted input. This supports making Outreach's "waiting for human / waiting for approval" state explicit instead of treating it as a silent background queue.
- Temporal's HITL agent pattern emphasizes durable waiting, signal-based human decisions, timeouts, and audit trails. Outreach already has terminal retry and events; the UI should surface the top-priority waiting or retry state before the card list.
- Proactive conversational-agent research says a proactive system must decide when to speak and what to contribute, and human-centered PCA work stresses boundary respect, timing sensitivity, patience, and self-awareness. This supports prioritizing non-intrusive waiting and showing that refresh/filtering does not create extra external nudges.
- Slack and Google Meet AI assistant docs show common market expectations around follow-ups, action items, generated notes, recipients, and sharing boundaries. Outreach should similarly distinguish "state shown here" from "message was actually sent or shared."
