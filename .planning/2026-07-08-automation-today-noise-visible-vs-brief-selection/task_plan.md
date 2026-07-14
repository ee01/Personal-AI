# Today Pilot Noise / Visible Selection Receipt Plan

## Goal

Improve `今天排序与噪声控制` so Today Pilot's homepage source distribution distinguishes current visible selected evidence from evidence that was selected by the brief but hidden after this page's feedback action.

## Plan

1. [completed] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, Today Pilot docs, source, and verifiers.
2. [completed] Check local Reminders and external product/research references.
3. [completed] Implement a presentation-only source distribution receipt for visible vs just-hidden selected evidence.
4. [completed] Update Today Pilot docs and feature index wording.
5. [completed] Run targeted verifier, `npm start` first successful compile, Today Pilot E2E, and scoped `git diff --check`.

## Constraints

- Do not change DayPilotService ranking, feedback payloads, source scanning, or Memory Service write behavior.
- Keep changes scoped to Today Pilot homepage/source-stats presentation, verifier/E2E, docs, and this planning directory.
- Preserve unrelated dirty worktree changes.
