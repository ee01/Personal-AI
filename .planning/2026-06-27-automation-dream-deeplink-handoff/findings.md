# Dream Replay Findings

## Repo Findings

- `docs/progressing/to-verify.md` says there are no pending verification items.
- Automation memory file was missing at `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md`; it needs to be created at closeout.
- The local Reminders app returned `NO_PERSONAL_AI_LIST`; no reminder items can be linked or completed this run.
- Dream Replay already shows page-scope, evidence, triage, and reflection handoff receipts.
- Current deep-link behavior expands the requested dream and styles it with `.targeted`, but the card itself does not say "this is the notification target" in text, and list order follows file order after fetch. If the requested file is within the recent window but not first, a digest click can land on a page where the referenced dream is not the first visible card.

## External Scan

- OpenAI's memory/dreaming announcement and Memory FAQ frame background memory synthesis as useful only with user-facing memory/source controls.
- Microsoft Copilot grounding docs emphasize that answer quality and authorization depend on source boundaries, and UI should keep those source boundaries visible.
- Generative Agents supports observation, reflection, and retrieval as separate architecture pieces; reflections improve planning but do not remove the need for source context.
- Reflective Memory Management uses prospective and retrospective reflection, including evidence-cited retrieval refinement, which supports keeping evidence state close to the generated summary.
- Replay literature supports offline replay for consolidation and planning, but does not imply autonomous execution. For this product, Dream Replay should remain review-first and evidence-first.

## UX Decision

Implement a card-level `通知命中回执` that appears only on the requested dream. It should say which digest file opened this card, whether the evidence is ready or missing, and that the action only carries a reflection filter. The target dream should also be sorted to the top after fetch.
