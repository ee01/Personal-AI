# Scheme C — Mem0 OSS adapter

接 Stage 1 本地环境：`../personal-ai-mem0`（`.venv` + Ollama `bge-m3` + Qdrant 本地目录）。

## 结构

- `mem0_worker.py` — JSON-lines RPC，进程内 `mem0.Memory`
- `python-bridge.ts` — 启动 worker，OpenRouter `fast` 映射到 Mem0 `openai` provider
- `registry-db.ts` — sidecar SQLite（event 信封、scope ACL、`mem0_id_map`）
- `runtime.ts` — harness 合约 + 日级 **`main`** 整理层
- `CAPABILITY_GAPS.md` / `clock-audit.md`

数据目录：`experiments/memory-benchmark/.local/mem0-data/`（gitignore）。

## 跑 synthetic-mini

前置：`ollama serve` + `bge-m3`；`personal-ai-mem0` 已 `uv pip install -e '.[llms]'`；`experiments/memory-benchmark/.env` 含 `OPENROUTER_API_KEY`。

```bash
cd experiments/memory-benchmark
npm run run -- --fixture synthetic-mini --scheme C --out ./out
```

## 测试

```bash
npm test
```

`scheme C passes delete/revoke gate` 在检测到 Mem0 checkout + venv 时运行；否则 skip。
