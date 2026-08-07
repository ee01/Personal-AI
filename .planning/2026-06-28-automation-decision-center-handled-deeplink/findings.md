# Decision Center Handled Deep-Link Findings

## Repo Findings

- `docs/progressing/to-verify.md` is empty.
- Recent automation memory already covered Doubao/ChatGPT explorer, Project Dashboard local search, Memory Capture whole-page prereview, Relationship Radar Context Card, Topic empty-batch recovery, Slides skipped rows, Digest Queue, Rehearsal, Skill Foundry sync, auto reply, ASR, Today Pilot, Message Analysis manual rules, Scheduled Messages filters, Coverage slices, Relationship Meeting Brief, ingest scoring, Memory Lens rest tooltip, and Glip AI marker timestamps.
- Random candidate selected for this run: `决策中心 | Memory Service | docs/memory_system.md`.
- Worktree is broadly dirty from prior/user work; keep this run scoped to Decision Center, docs, and the new `.planning` directory.
- Local Reminders lists are readable, but there is no `Personal AI` list.

## Code And UX Findings

- `DecisionCenter.vue` already loads four queues independently: pending decision, snoozed decision, pending watch, and snoozed watch.
- The page correctly avoids treating partial queue failures as a global outage, and deep-link missing notices already distinguish "not found in successful queues" from "some queues failed".
- UX gap: after a user opens a notification deep link and answers the target confirmation item, `submitAnswer()` removes the card and sets `targetStatus` to `missing`. That makes a fresh successful action look like a stale/missing notification target, even while the action receipt says the decision was submitted.
- Similar confusion can happen when a deep-linked item is ended with `expired`; a handled-by-this-operation state is more accurate than the generic queue-miss text.

## External Reference Findings

- Zapier Human in the Loop Request Approval pauses an automation so reviewers can approve, decline, or change submitted data before the run continues: https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop
- Microsoft Copilot Studio Request for information exposes human review as an explicit node with title, message, assignee, and input fields: https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-request-for-information
- GitHub Copilot cloud agent emphasizes reviewing plans/diffs and creating a pull request only when ready, supporting a visible separation between agent work and user acceptance: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
- Microsoft Research's overreliance review highlights automation bias and recommends helping users calibrate trust rather than treating explanations as enough: https://www.microsoft.com/en-us/research/wp-content/uploads/2022/06/Aether-Overreliance-on-AI-Review-Final-6.21.22.pdf
- Harvard Data Science Review's "Bias in the Loop" frames AI suggestion review as vulnerable to cognitive bias, which supports making post-action state unambiguous: https://hdsr.mitpress.mit.edu/pub/nrcn4h7d
