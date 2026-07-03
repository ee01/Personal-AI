# Rehearsal Stale Weak Prompt Findings

## Repo Findings

- Random selection from `docs/features/index.md`: `场景预演边界`.
- Feature owner/capability: Rehearsal.
- Source document: `docs/features/rehearsal.md`.
- `docs/progressing/to-verify.md` currently says `暂无。`, so no carry-over verification item was pending.
- Local Reminders list names are `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, and `Tasks`. There is no visible `Personal AI` list.
- The worktree has many unrelated dirty files from prior work. Treat pre-existing changes as user/automation-owned and avoid reverting or broad formatting.

## Code And UX Findings

- `RehearsalService.create()` already keeps topic/keyword/surface-only weak cues as `candidate` even at high confidence because `hasStableCue()` excludes those fields.
- `RehearsalActivationService.getMatches()` already refuses to activate candidate Rehearsals unless score, confidence, and stable cues all pass.
- Gap found: `scoreRehearsal()` subtracts stale penalties but can still return `displayPriority='p1'` for old stale Rehearsals with multiple exact cues. This conflicts with the documented boundary that stale Rehearsals are preserved as weak prompts when exact scene cues still match.
- Low-decision implementation slice: after scoring, cap stale Rehearsal display priority to `p2` and add a match reason such as `已降权，仅弱提示` so consumers can explain why it is not a strong cue.

## External Reference Findings

- Apple Reminders supports alerts based on time, location, and messaging someone, which reinforces multi-cue reminders but still treats the cue as the reason to notify.
- The 2026 context-aware smart-home reminder paper frames natural-language reminders as structured trigger logic, including time, activity, sensor, and state-machine conditions.
- Prospective-memory / implementation-intention literature emphasizes binding a future cue to a planned action, not surfacing every weak association as an interrupt.
- Product implication: Rehearsal should keep exact stale cue matches recoverable, but should avoid p1-style interruption unless the rehearsal is current and trusted.
