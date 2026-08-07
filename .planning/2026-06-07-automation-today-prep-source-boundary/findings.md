# Findings & Decisions

## Requirements
- Randomly select one feature from `docs/index.md`.
- Check current code and keep the feature doc current without excessive detail.
- Research similar industry product behavior and relevant papers, then extract constructive suggestions.
- If unfinished work can be implemented without much user decision, implement it and update docs.
- Inspect for bugs, bad UX paths, blockers, or unreasonable behavior.
- Check local Reminders `Personal AI` list and incorporate related items; mark completed items done only if they exist.
- Plan first, implement step by step, verify as deeply as practical.

## Research Findings
- Automation memory recent targets: Google Slides Analyzer, Prompt Config, Ask, Jira Design Links, User Profile export, Scheduled Messages, Storyline Draft.
- `docs/progressing/to-verify.md` currently says `暂无。`.
- Reminders list names are available, but `Personal AI` is absent.
- Random selection for this run: `会前准备` under Today Pilot, documented in `docs/features/today_pilot.md`.
- Code state: Video Home uses `TODAY_PILOT_MEETING_PREP_REQUEST` with `autoGenerate:false`; refresh backfills via `TODAY_PILOT_PREPARE_MEETINGS_REQUEST`; `renderPrepReceipt` currently shows mode plus `visible/total` high-confidence source count.
- Product signal: Microsoft Copilot meeting prep summarizes relevant context/tasks/documents/resources, but warns summaries can be generic or incomplete when no related content exists and are permission-scoped per user.
- Product signal: Microsoft Plan My Day emphasizes prep-required meetings, direct links, priority ranking, conflict/delegation suggestions, and privacy review for sensitive content.
- Product signal: Google Meet Gemini notes attach meeting notes to Calendar/Drive and explicitly recommends reviewing/editing AI notes for accuracy.
- Paper signal: Traceable Text and Attribute First, then Generate both support concise source/provenance surfaces that reduce verification burden.
- Paper signal: AIES factuality-expression work supports making factuality/source uncertainty visible instead of letting users blindly trust plausible generated text.
- UX gap: existing receipt can say `1/2 条高置信来源展示`, but does not name the hidden/background bucket or give the user a stable meeting-use boundary.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use Today Pilot meeting-prep harnesses first | `AGENT.md` lists Today Pilot / Meeting Pilot handoff as an extension-facing flow requiring targeted tests, first dev compile, and E2E where practical. |
| Add receipt chips for mode, high-confidence memory, and basic background | The data already exists; clearer labels reduce over-trust without introducing user review burden. |
| Add a fixed `会中核对 owner / 下一步 / 风险` receipt line | Meeting prep should be used as preparation context, not as complete fact audit or execution authorization. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `shuf` missing | Used an `awk` random picker. |

## Resources
- `AGENT.md`
- `docs/index.md`
- `docs/features/today_pilot.md`
- `.planning/2026-06-07-automation-today-prep-source-boundary/task_plan.md`
- https://support.microsoft.com/en-gb/topic/prepare-for-your-meeting-with-copilot-f23326fc-7721-45f1-875e-23e77aaf3d89
- https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agent-template-plan-my-day
- https://workspace.google.com/solutions/ai/ai-note-taking/
- https://arxiv.org/abs/2409.13099
- https://arxiv.org/abs/2403.17104
- https://ojs.aaai.org/index.php/AIES/article/view/36589

## Visual/Browser Findings
- No browser visual findings yet.
