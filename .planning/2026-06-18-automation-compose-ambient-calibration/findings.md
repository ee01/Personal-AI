# Findings

## Repo

- `docs/progressing/to-verify.md` has no pending carry-over items.
- Automation memory file did not exist at `${CODEX_HOME:-$HOME/.codex}/automations/automation/memory.md` at run start.
- Local Reminders lists do not include `Personal AI`.
- Compose Assist docs say ambient calibration should not add a heavy UI, should upload only hashes/lengths/tags/evidence refs, and should avoid double-counting explicit rejection as `sent_without_insert`.

## Code

- `src/composer-guard/ComposerGuardController.ts` emits `AMBIENT_CALIBRATION_TRACE` via `chrome.runtime.sendMessage`.
- The backend route returns `calibrationReceipt` and can reject unsafe payloads, but the content-script submitter currently ignores the response and errors.
- Existing E2E `tools/verify-compose-assist-ambient-calibration-e2e.mjs` covers edited-before-send, hover no-insert, and thumb-down double-count prevention.

## External Scan

- Gmail Smart Compose emphasizes real-time, low-interruption suggestions rather than a separate review workflow.
- Microsoft Copilot in Outlook requires review/keep/edit before send, reinforcing final user ownership.
- GhostWriter emphasizes implicit style learning while keeping explicit control moments.
- Recent AI writing agency research warns that too much automation can reduce agency and ownership; interface controls and final say matter.
