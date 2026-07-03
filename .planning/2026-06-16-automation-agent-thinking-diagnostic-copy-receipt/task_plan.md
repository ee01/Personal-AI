# Agent Thinking Diagnostic Copy Receipt Plan

## Goal

Improve the Agent Thinking trace visualization UX by making diagnostic-package copy success produce a clear, bounded receipt: what was copied, what was intentionally omitted, and which approval artifact to use next.

## Scope

- Feature: Agent Thinking trace visualization
- Canonical doc: `docs/features/agent_thinking.md`
- Primary files: `src/agentVisualizerPresentation.ts`, `src/agent-visualizer.tsx`, `tools/verify-memory-entry-agent-thinking.ts`, `tools/verify-agent-thinking-options-e2e.mjs`
- Reminder state: local Reminders is readable, but no visible `Personal AI` list exists, so no Reminder item will be completed or annotated.

## Plan

1. Document current feature state and external research signals.
2. Add a reusable diagnostic copy success receipt derived from the existing privacy-preserving diagnostic packet.
3. Show that receipt immediately after a successful `复制诊断包`, while preserving the existing manual-copy failure fallback.
4. Update targeted verification to assert the receipt and preserve existing redaction/schema/snapshot boundaries.
5. Update `docs/features/agent_thinking.md` with concise current behavior.
6. Run targeted Agent Thinking verification, `npm start` first successful compile, Options E2E, and scoped whitespace checks.

## Risks

- The worktree has broad unrelated dirty changes. Keep edits scoped to Agent Thinking files and this plan directory.
- The existing E2E intentionally forces clipboard API failure for manual-copy coverage. Add a success-copy assertion before that forced failure.
- Do not claim OpenTelemetry/LangSmith/Langfuse exporter support; the diagnostic packet remains local-only.

## Status

- Step 1: complete
- Step 2: complete
- Step 3: complete
- Step 4: complete
- Step 5: complete
- Step 6: complete
