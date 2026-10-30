# Scheme E — Letta App Server adapter

接 Stage 1 本地 Letta Code App Server（当前代际 WebSocket 协议 + MemFS）。

## 前置

1. 构建 sibling checkout（见 `envs/README.md`）
2. 启动 App Server（foreground，`ws://127.0.0.1:4500`）
3. `experiments/memory-benchmark/.env` 含 `OPENROUTER_API_KEY`

## 跑 synthetic-mini

```bash
cd experiments/memory-benchmark
npm run run -- --fixture synthetic-mini --scheme E --out ./out
```

Sidecar SQLite：` .local/letta-data/E-{runId}.sqlite`（gitignore）

## 可移植性门

```bash
npm run gates:e
```

写入 `adapters/letta/gate-results.json`。

## 导出字段

`export()` 含完整 sidecar `evidence_events`、`clock_audit`、`dream_audit`、`cost_ledger_harness_main`（与 Letta native dream 区分）。
