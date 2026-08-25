# Task Plan: Cursor Executor ACP

## Goal
Add `acp-cursor` so Options can run Cursor via a thin ACP shim around `cursor-agent`, locally or through a Worker.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Read progressing plan and current executor/worker seams
- [x] Confirm cursor-agent flags
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Scheme A: monorepo `cursor-acp/` stdio ACP server
- **Status:** complete

### Phase 3: Implementation
- [x] cursor-acp shim + tests
- [x] Registry / AcpExecutor / probe / Options / Worker / Desktop
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Targeted tests + npm start first compile
- **Status:** complete

### Phase 5: Delivery
- [x] Feature docs + delete progressing plan
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Type id `acp-cursor` | Matches `acp-codex` / `acp-claude-code` |
| Default `node cursor-acp/dist` | Monorepo first, no npm publish |
| Write `.cursor/mcp.json` | CLI has no HTTP MCP inject flag |
| No `--force` | Read + in-workspace write only |
| Skip Cursor Cloud | P3 optional |
