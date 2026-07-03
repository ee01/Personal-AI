# Findings & Decisions

## Requirements
- Pick a random feature from `docs/features/index.md`, inspect docs/code, research comparable products/papers, produce a plan, implement a bounded improvement, update docs, verify thoroughly, and handle related `Personal AI` Reminders if present.
- Selected feature: `记忆提示预演提醒`, capability surface `Memory Lens`, source docs `docs/features/rehearsal.md` and `docs/features/memory_lens.md`.

## Research Findings
- OpenAI Memory emphasizes source visibility, relevant/not-relevant feedback, and user controls; this supports making Rehearsal Lens explain source/cue/status rather than showing a generic memory card.
- ChatGPT Scheduled Tasks now has a dedicated management surface and task confirmation/edit/pause flows; this supports a visible path back to the Rehearsal management page instead of treating the cue as a one-off toast.
- Apple Intelligence suggested reminders are generated from context in other apps but require the user to add suggestions; this reinforces the boundary that Lens is a cue and does not automatically create/send/execute.
- Gemini Enterprise personalization connects work sources and saved memories while exposing data-source and saved-memory controls; this supports explicit source/control receipts.
- Human-centered proactive agent research highlights adaptivity and civility: proactive interventions should be timed, bounded, and respectful. A Rehearsal Lens cue should explain why now and how to dismiss/feedback.
- Memento's proactive memory visualization research argues for resurfacing prior interests when contexts recur, but the user needs referent/context anchors; Rehearsal Lens should expose matched people/project/topic cues.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add a small `预演回执` block inside the Expanded Card | The current footer only says `只读预演`; a dedicated row can show trigger/status/review/no-send boundaries without changing the backend contract. |
| Make negative feedback drawer copy conditional on Rehearsal matches | The current drawer says `这条记忆不是这个意思` and `误触发的记忆`, which mislabels a future-scene script as a fact memory. |
| Assert E2E visible text and feedback routing | The existing fixture already proves positive Rehearsal feedback uses `/rehearsals/:id/feedback`; extending it is cheaper and stronger than adding a new harness. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| No `Personal AI` Reminders list | Record absence and do not attempt item-level Reminder completion. |
| Existing worktree is very dirty | Scope edits to Rehearsal/Memory Lens files plus the current planning directory and automation memory. |

## Resources
- https://help.openai.com/en/articles/8590148-memory-faq
- https://help.openai.com/en/articles/10291617-tasks-in-chatgpt
- https://support.apple.com/guide/iphone/use-apple-intelligence-in-reminders-iphcb580b580/ios
- https://docs.cloud.google.com/gemini/enterprise/docs/configure-personalization
- https://arxiv.org/html/2404.12670v1
- https://arxiv.org/html/2601.17622v1
