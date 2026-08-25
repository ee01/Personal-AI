# Findings

- Types: `memory-service/src/integrations/executors/executorRegistry.ts` (`acp-codex`, `acp-claude-code`)
- Local spawn: `AcpExecutor.ts` / `executorProbe.ts`
- Worker spawn: `worker/src/runner.ts`
- Desktop copies `worker/dist` → `desktop-app/dist/worker`; GUI PATH misses `~/.local/bin`
- Local CLI: `cursor-agent` / `agent`; headless `-p --output-format stream-json --trust --approve-mcps --workspace`; resume `--resume`; auth `login` or `CURSOR_API_KEY`; MCP files `.cursor/mcp.json`
