# Findings

## Repo

- `docs/progressing/to-verify.md` is empty.
- Automation memory shows very recent coverage of Message Reaction, Relationship Radar, Memory Coverage, Scheduled Messages, Google Slides Analyzer, Notification Center, Memory Service, Prompt Config, Meeting Pilot, Skill Foundry, Today Pilot, Project Dashboard, and related flows.
- Random selection chose Jira Design Links, specifically the design updated-date display.
- Current Jira Design Links worktree already includes newer behavior for query-key recovery, non-handoff Figma/Zeplin filtering, missing updated-date receipt, and date-only precision copy.
- Local Reminders list names do not include `Personal AI`; no Reminder item can be incorporated or completed.

## Product / Research

- Figma for Jira / Figma Dev Mode make design status and update visibility central to developer handoff.
- Atlassian design smart values expose design information for automation, which supports keeping status/date evidence explicit.
- Zeplin Jira integration attaches design resources such as screens, sections, projects, and flows to issues.
- Traceability literature emphasizes understandable cross-artifact links and the cost of analyzing or cleaning candidate links.

## UX Gap

- The UI currently tells users the date and precision, but not whether the newest date came from `object.updatedDate`, `object.status.updatedAt`, or remote-link level metadata.
- When multiple metadata fields disagree, this makes the selected latest date hard to audit even though the code correctly chooses the newest parseable timestamp.
