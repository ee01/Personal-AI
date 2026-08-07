# Meeting Local ASR Stream Receipt

Goal: Improve the `Desktop Local ASR / Whisper fallback` user path for Meeting Pilot by making local chunk-stream degradation understandable in the Speech panel, without changing ASR routing or provider behavior.

## Plan

1. [completed] Read `AGENT.md`, `docs/progressing/to-verify.md`, automation memory, feature index, target docs/code, Reminder state, and external references.
2. [completed] Implement a narrow Speech panel presentation improvement for Local ASR stream warnings.
3. [completed] Add focused verifier/E2E assertions for the new receipt wording.
4. [completed] Update `docs/features/meeting_pilot.md` and `docs/index.md` concisely.
5. [completed] Run targeted verification, dev build, E2E, diff checks, and process cleanup.
6. [completed] Update automation memory with the run summary.

## Scope

- Owned files should stay limited to this planning directory, `src/meeting-shell/SpeechTab.tsx`, the relevant Meeting Pilot verifier, and concise docs/index notes.
- Do not change ASR provider selection, desktop app ASR endpoints, cloud fallback rules, capture consent, or Reminder state.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| Skill path `/Users/Esone/.codex/skills/planning-with-files/SKILL.md` missing | Initial skill read | Read `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`, the installed path from the skill list. |
| Broad `rg` output was truncated | Initial ASR search | Re-read targeted files and line ranges instead of relying on the broad result. |
| Direct Node import of `SpeechTab.tsx` failed with `ERR_UNKNOWN_FILE_EXTENSION` | Attempted lightweight TSX import | Used repo-standard `npm start -- --progress` webpack compile to validate TSX instead. |
