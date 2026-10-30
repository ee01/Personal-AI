# Scheme C synthetic-mini 跑通记录（2026-10-31）

命令：

```bash
cd experiments/memory-benchmark
npm run run -- --fixture synthetic-mini --scheme C --out ./out
```

结果（本机一次跑通，`run-1793380827477`）：

- `events_ingested`: 4
- `consolidations`: 3（虚拟日 2026-01-15 / 16 / 17）
- `probes_run`: 3，`probes_passed`: 3
- `mean_composite`: 94.44
- `cost.total_usd`: 0（harness ledger 未接 OpenRouter usage 回写；Mem0 原生 LLM 调用见 OpenRouter 账单）
- 隔离：`user_id` = `benchmark-c-{runKey}-work`；sidecar + Qdrant 在 `.local/mem0-data/`（gitignore）
- Worker：`personal-ai-mem0/.venv` + `mem0_worker.py` RPC；Ollama `bge-m3` @ `127.0.0.1:11434`

单元测试：

```bash
cd experiments/memory-benchmark
npm test
```

- `runDeleteRevokeGate` stub + scheme B + **scheme C**（需 checkout + `.env` OPENROUTER_API_KEY + Ollama）
- scheme C gate 超时阈值 120s（Mem0 `add` 冷启动 + 抽取）

报告产物：`out/C-run-1793380827477.json` / `.md`
