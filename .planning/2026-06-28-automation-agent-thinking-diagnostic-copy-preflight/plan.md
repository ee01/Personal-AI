# Agent Thinking diagnostic-copy preflight plan

## Target

- Random feature: `Agent Thinking 分析编排` from `docs/index.md`.
- Canonical doc: `docs/features/agent_thinking.md`.
- Reminder branch: local Reminders is readable, but there is no `Personal AI` list, so no Reminder item is linked or completed.

## Current evidence

- `AGENT.md` requires targeted verification plus `npm start` first successful compile for runtime UI changes.
- Recent automation memory covered Memory Search, Meeting ASR, Today Pilot, Message Analysis, Scheduled Messages, Coverage, Relationship Radar, Memory Lens, Message Reaction, Prompt Config, Jira Design Links, User Profile, Agent Workflow, and Dream Replay, so this run avoids those.
- Current Agent Thinking already has diagnostic packets, trace identity, copy freshness receipts, review lanes, and approval preflight receipts.

## External scan

- LangSmith models a trace as a collection of runs/spans under a trace id.
- Langfuse groups traces and observations through sessions.
- OpenTelemetry GenAI conventions keep agent and tool execution semantics explicit.
- AgentTrace and AgentOps research emphasize structured telemetry for accountability, not raw opaque logs.
- AGDebugger highlights that long agent histories need visible navigation and checkpoint/recovery semantics.

## UX gap

The page explains diagnostic package boundaries after copy and in the scope block, but the copy button itself can still read like a generic export action. A user can click before noticing whether the packet is current, local-only, non-live, and not an approval or recovery artifact.

## Implementation plan

1. Add a small `diagnostic copy preflight` view-model derived from `AgentRunDiagnosticPacket`.
2. Render it next to the copy button before copy, with compact rows for copy object, allowed use, blocked use, freshness, and current run status.
3. Keep the existing diagnostic packet JSON unchanged.
4. Add focused assertions in `tools/verify-memory-entry-agent-thinking.ts` and Options E2E.
5. Update `docs/features/agent_thinking.md` with the user-visible behavior and validation notes.

## Validation plan

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-memory-entry-agent-thinking.ts`
- `npm start` until first successful compile, then stop.
- `node tools/verify-agent-thinking-options-e2e.mjs`
- `npm run verify:i18n`
- Scoped `git diff --check`
