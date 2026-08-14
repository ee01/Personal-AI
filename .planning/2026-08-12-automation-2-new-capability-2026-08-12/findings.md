# Findings & Decisions · Automation 2 New Capability · 2026-08-12

## Requirements
- Check local `Personal AI` Reminders first; choose a random eligible all-new idea if several exist.
- If no eligible idea exists, combine product vision, current `esone.qiu` memory evidence, current AI product/research feasibility, and real-user UX needs.
- Do not repeat or near-rename active/shelved `docs/progressing` concepts.
- Produce only a complete plan and, for UI interaction, a Chinese contextual HTML demo under `docs/progressing/`.
- Plan must cover user journeys before detailed design, competitor comparison, implementation/data/safety/rollout detail, eval decision, and canonical docs handoff.
- Reminder-originated ideas must be marked done with note writeback only after the artifacts are complete.

## Research Findings
- `docs/progressing/to-verify.md` contains no carry-over task.
- Automation memory records the 2026-08-05 capability `Routine Delta Memory / 例行差分记忆`; this run must avoid recurring-series delta, carryover, or another summary/noise-suppression variant.
- The repository worktree is broadly dirty. No unrelated files may be reverted, staged, or folded into this run.
- Prior repository guidance favors autonomous silent mechanisms and surfaces user review only at high-responsibility boundaries.
- Reminder evidence (2026-08-12): AppleScript list enumeration did not expose `Personal AI`; EventKit did. EventKit returned one matching list, four total items, and zero incomplete items. The completed items are historical Doubao/Notification sync feedback and a test item, so there is no eligible all-new idea and no Reminder writeback should occur.
- Live memory-service stats (read-only, 2026-08-12): `/api/v1/stats` returned 12,103 messages, 10,713 chunks, 54,683 relationships, 482 messages in the service-defined current week, and 201 today. `/health` was degraded and reported its default database disconnected, but the per-user stats and remote per-user SQLite remained readable.
- Live recent 30-day source mix: Calendar 301, Glip 269, web captures 156, Jira 90, Doubao chat 19, meetings 6. The user's work memory is strongly cross-surface rather than single-chat.
- In the last 90 days, read-only SQLite found 1,490 user-authored Glip messages, 179 unique Jira keys in those messages, and 20 Jira keys shared across at least two distinct groups. `INIT-30072` appeared in five distinct group contexts.
- In the same 90-day user-authored Glip window, 418 normalized URLs appeared; 39 were shared across multiple groups. Query strings were removed before aggregation so tokenized URLs were not retained in findings or planned demo data.
- A concrete recent pattern showed the same backlog/Jira context moving from a 1:1 conversation into a three-person group within minutes. Personal AI can currently recall the content, but it has no first-class model for “this audience already received version A; this other audience has not received version B.”
- The current `memory_claims` table has 3,477 claim rows, but audience-level disclosure/acknowledgment state does not exist. This is a distinct projection rather than a replacement for claim ownership or truth status.

## Selected Concept Boundary

- **Name:** `Common Ground Memory / 共同上下文记忆`.
- **User value:** before messaging or meeting, show what the current audience has evidence of receiving, what changed since then, and what remains unknown; help the user send the smallest safe delta instead of repeating everything or assuming shared knowledge.
- **Not a read-receipt claim:** `shared_by_me` only proves the user sent it to that audience. `acknowledged` needs reply/quote/action evidence. The system never labels someone as knowing, understanding, or agreeing without proof.
- **Not a page or review queue:** the default UX is a compact host-surface cue in RingCentral Compose, Meeting Pilot prep, and optional context-package generation.
- **No external mutation:** it drafts/compiles context only; it does not send, mark read, create tasks, notify recipients, edit Jira, or write to calendars.
- **Why it is not Relationship Radar:** Relationship Radar organizes person-centric history, preferences, and open loops. This capability organizes `audience × claim version × communication evidence` and answers “what background does this exact room/thread still need?”
- **Why it is not AI Session Context Drift Radar:** that shelved direction requires observing unstable third-party AI handoffs. This proposal starts only with first-party human messages/meetings already captured by Personal AI and preserves `unknown` when delivery/understanding cannot be proven.
- **Why it is not Memory Change Ledger / Evidence Watch:** those track which fact version is current; Common Ground Memory tracks which version was shared with which audience and compiles the missing delta.
- **Why it is not Routine Delta Memory:** Routine Delta compares recurring occurrences. Common Ground Memory works across ad-hoc groups, people, Jira threads, and meetings.

## Current Product and Research Findings

### Product scan

- [Slack AI](https://slack.com/help/articles/25076892548883-Guide-to-AI-features-in-Slack) summarizes a channel/DM/thread, provides source links, and creates daily recaps of unread channels. It helps one user catch up on what they missed; the official surface does not document a proposition-by-audience ledger or a “this room has version A but not version B” pre-send delta.
- [Slack AI huddle notes](https://slack.com/help/articles/31377193680019-Use-AI-to-take-huddle-notes-in-Slack) capture takeaways/action items into a Canvas shared in the huddle thread. This creates a shared artifact but still does not prove each participant read or accepted it.
- [Microsoft Copilot meeting prep](https://support.microsoft.com/en-US/Outlook/prepare-for-your-meeting-with-copilot) summarizes relevant context, tasks, documents, and resources. Microsoft explicitly says the summary is unique to the viewer's access and other participants may see a different summary. That limitation is direct evidence that “what I can retrieve” is not the same as “what this audience shares.”
- [Microsoft Teams Recap](https://support.microsoft.com/en-US/teams/meetings/recap-in-microsoft-teams) offers recordings, transcripts, shared files, notes, agenda, and follow-up tasks; [Google Meet `take notes for me`](https://support.google.com/meet/answer/14754931) produces summaries, decisions, and next steps. Both organize meeting outcomes rather than maintaining cross-channel audience version coverage.
- [Granola Chat](https://docs.granola.ai/help-center/getting-more-from-your-notes/chatting-with-your-meetings) can query across meetings and generate follow-ups; [Spaces & Folders](https://docs.granola.ai/help-center/sharing/folders/spaces-and-folders) adds access-controlled shared collections. This is strong recall/sharing infrastructure, not evidence that each recipient received or acknowledged each claim version.
- [Copilot in Outlook](https://support.microsoft.com/en-US/Outlook/copilot-pages/draft-an-email-message-with-copilot-in-outlook) drafts from prompts/thread context with explicit user review before send; current controls focus on tone/length/editing rather than audience knowledge gaps. Common Ground Memory should preserve the same review-before-send boundary while adding evidence-aware context coverage.

### Papers and expert/research guidance

- [Common Ground Tracking in Multimodal Dialogue](https://aclanthology.org/2024.lrec-main.318/) (LREC-COLING 2024) formalizes common-ground tracking as proposition-level shared-belief and question-under-discussion state updated from evidence. The implementation implication is to store propositions and evidence transitions, not a free-text “what they know” summary.
- [TRACE](https://aclanthology.org/2025.naacl-demo.5/) (NAACL 2025) demonstrates real-time common-ground tracking across multiparty speech, actions, gestures, and attention. Personal AI can start with the lower-risk subset already captured locally: outbound message, quote/reply, meeting attendance/transcript, and linked artifact actions.
- [Building Common Ground in Dialogue: A Survey](https://aclanthology.org/2025.luhme-1.2/) emphasizes that common ground is dynamic and can be domain-specific, personal, multimodal, static, or evolving. The plan therefore needs scene-scoped state with TTL/versioning instead of one permanent audience profile.
- [Reflect, Not Reflex](https://aclanthology.org/2022.emnlp-main.714/) found that explicit common-ground inference improves response specificity/quality relative to reflexive generation. This supports placing a small evidence-grounded compiler before Compose suggestions.
- Microsoft Research's [SURE framework](https://www.microsoft.com/en-us/research/publication/the-sure-framework-social-intelligence-for-human-agent-collaboration/) (CHI workshop 2026) argues that social intelligence, not raw reasoning alone, is the bottleneck for collaborative agents and decomposes it into Sense, Understand, Remember, Engage. Common Ground Memory is specifically the remember/engage bridge, but must preserve uncertainty.
- Microsoft's [Collaboration Readiness](https://www.microsoft.com/en-us/research/project/from-task-solvers-to-teammates-a-theory-grounded-architecture-for-advancing-collaboration-readiness-in-llm-agents/) research externalizes common ground and workspace awareness into a transparent, controllable layer. This supports an explicit typed contract and visible receipt rather than burying audience inference inside one prompt.
- [ProMediate](https://www.microsoft.com/en-us/research/articles/evaluating-proactive-ai-mediators-in-multi-party-conversation-with-promediate/) argues that intervention timing and socio-cognitive strategy matter as much as model capability. The UX implication is to intervene only when a draft assumes shared knowledge, a high-impact version changed, or a meeting agenda depends on missing context.
- [CONCORD](https://www.microsoft.com/en-us/research/publication/listening-alone-understanding-together-collaborative-context-recovery-for-privacy-aware-ai/) (Microsoft Research, 2026) treats missing context as privacy-aware gap detection plus minimal exchange rather than hallucination-prone inference. This strongly supports generating the smallest missing delta and retaining `unknown` instead of pretending to know recipient mental state.
- [Dittos](https://www.microsoft.com/en-us/research/publication/dittos-mimetic-reciprocal-agents-in-ai-mediated-communication/) (CHI workshop 2026) identifies trust, responsibility, and keeping the represented human informed as central when AI speaks for a person. Therefore P0 must never auto-send or silently rewrite a user-representing promise/claim.

### Competitive conclusion

- Current products are strong at `summarize what I missed`, `prepare me`, `write notes`, `draft a message`, and `query shared meeting artifacts`.
- The differentiated opportunity is `tell me what evidence this exact audience has already received, what version changed, and compile only the missing background/delta`.
- This conclusion is an inference from the documented official product surfaces above; it is not a claim that competitors have no internal or unreleased audience models.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use the `planning-with-files` and `huashu-design` skills | The task needs many research/verification actions and asks for a high-fidelity HTML demo. |
| Use existing Personal AI UI/assets for the demo | An in-product capability should look native rather than like a generic AI dashboard. |
| Integrate demo into a RingCentral-like chat plus Meeting Pilot prep | The capability's value appears at the moment of communication, not in a standalone management page. |
| Use a coral-red Personal AI identity on neutral host surfaces | The existing Compose reference and real `icon128.png` show a red assistant entry on a white host UI; this is stronger evidence than inventing a new concept palette. |
| Explore three interaction strategies in one demo | `只补变化`, `先补背景`, and `证据不足` expose the core behavior gradient without creating artificial visual variants. |

## Deliverables Created

- `docs/progressing/common-ground-memory-plan.md`
- `docs/progressing/common-ground-memory-demo.html`
- `docs/progressing/common-ground-memory-brand-spec.md`

The plan keeps real aggregate counts and safe project-key context, but the demo uses a sanitized composite rather than copied conversations. The design reuses the verified Personal AI logo and host-surface placement, with no new imagery or fabricated product metrics.

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Root planning files are stale shared artifacts | Created `.planning/2026-08-12-automation-2-new-capability-2026-08-12/`. |
| AppleScript and EventKit disagree on list visibility | Treat EventKit as the authoritative local read because it returned the actual list and every item. |

## Resources
- `/Users/Esone/git/personal-ai/AGENT.md`
- `/Users/Esone/.codex/automations/automation-2/memory.md`
- `/Users/Esone/.codex/memories/MEMORY.md` capability-planning guidance
- `http://10.32.56.212:3210/api/v1/stats` read-only per-user stats
- Remote per-user SQLite opened read-only over SSH: `/Users/rcadmin/personal-ai/memory-service/data/users/esone.qiu/memory.db`
