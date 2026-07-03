# Doubao / ChatGPT Explorer actual transport receipt

## Target feature

- Feature: `Doubao / ChatGPT explorer 输入链路`
- Canonical doc: `docs/features/doubao_bridge.md`
- Main surfaces: `desktop-app/app/renderer.js`, `desktop-app/src/explorer/index.ts`, `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`

## Current finding

Manual Explorer grabs already say which saved transport setting will be used. That is not enough when the user selected daily Chrome / `webpage-mcp` but the run falls back to the desktop Chromium profile. The source card banner shows the fallback after refresh, but the immediate completion receipt can still read as if the just-finished run used daily Chrome.

## External direction

- ChatGPT, Claude, and Gemini all expose memory/source/export/delete controls as separate user-facing boundaries rather than treating memory import as a silent background state.
- Mem0 and LongMemEval support extracting structured, auditable memories instead of replaying full transcripts.
- MemX and MemReader reinforce local-first, explainable retrieval/extraction and conservative write decisions.

## Plan

1. Extend the Explorer manual-run result with the adapter's actual transport status after the run.
2. Update the manual grab receipt to distinguish saved transport preference from actual run transport.
3. If the run fell back from daily Chrome to desktop Chromium, show the fallback reason and retry window in the same completion message.
4. Cover Doubao and ChatGPT manual runs in the existing local Playwright desktop harness.
5. Update `docs/features/doubao_bridge.md` with a short behavior note.
6. Validate with the desktop source-card E2E, first successful extension dev compile, scoped diff checks, and no lingering watch process.
