# Findings & Decisions

## Requirements
- Produce a complete docs-first new capability plan in `docs/progressing`.
- Include one or two real user scenarios before detailed design.
- Add a Chinese demo HTML if there is UI or integrated interaction.
- Avoid duplicate or near-duplicate ideas already in `docs/progressing`.
- Decide whether future implementation needs `evals/` and document the documentation handoff.

## Research Findings
- `AGENT.md` requires this docs-first loop and prohibits runtime implementation unless explicitly approved.
- `docs/progressing/to-verify.md` currently says `暂无。`
- Automation memory already contains recent plans for Action Readiness Contracts, Evidence Watch, Evidence Cohesion Gate, Research Trail Synthesizer, Change Memory Ledger, AI Memory Portability Ledger, Open Question Exit Contract, Prompt Context Compiler, Source Memory Distiller, Keystone Memory Briefs, Active Recall Coach, and related trust-boundary plans.
- EventKit found the local Reminders list `Personal AI`; it has `PERSONAL_AI_INCOMPLETE_COUNT 0`, so no Reminder idea was selected or needs completion/annotation.
- Live `10.32.56.212` checks for `esone.qiu` showed a rich memory base but no Reminder-sourced idea: about 11,350 messages, about 14,186 entities, about 10,158 chunks, about 613 source-memory capsules, about 885 active reflection threads, and many proposed actions around notification / OpenClaw / confirmation workflows.
- The selected idea is `Desktop Selection Memory Capsule / 桌面选区记忆胶囊`: a user-triggered macOS selection hotkey that recalls Personal AI memory from arbitrary desktop App selected text, then offers copy-only context patch, Ask, and reviewed source-memory save.
- The idea is intentionally not an implicit cross-App observer. It avoids the shelved Working Memory Return Stack failure mode by using explicit selected text and hotkey authorization.
- Existing browser selection Memory Capture and Memory Lens cover web page selection. Quick Ask covers user-entered questions. Prompt Context Compiler covers web AI composer patches. AI Context Passport covers larger handoff packages. This idea fills the desktop/App-agnostic selected-context gap.
- Product references reviewed: OpenAI macOS Work with Apps, the new ChatGPT desktop App notes, Raycast AI Commands, Microsoft Recall / Click to Do privacy controls, and Apple macOS Services.
- Research references reviewed: just-in-time information access from everyday applications, Memento proactive everyday memory visualization, recent mixed-initiative HAI framework work, and preference-aligned proactive assistant work.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Continue without Reminder source | The list exists but has no incomplete items |
| Create a demo HTML | The proposed capability is a new overlay interaction that benefits from a visual preview in Chinese |
| Require future evals | The core risk is not rendering; it is recall precision, secret blocking, copy boundary, and reviewed save behavior |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `.codex/skills/planning-with-files/SKILL.md` missing | Used the available `.agents/skills/planning-with-files/SKILL.md` path |

## Resources
- `docs/progressing/desktop-selection-memory-capsule-plan.md`
- `docs/progressing/desktop-selection-memory-capsule-demo.html`
