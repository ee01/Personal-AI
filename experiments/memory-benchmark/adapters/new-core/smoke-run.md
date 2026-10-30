# 方案 B smoke（E-161 preflight）

## 前置

- `cd experiments/memory-benchmark && npm install`
- Ollama @ `127.0.0.1:11434`，模型 `bge-m3`
- `experiments/memory-benchmark/.env` 或仓库根 `.env`：`OPENROUTER_API_KEY`（走 `config/models.json` 的 fast + main）

## 命令

```bash
npm test
npm run run -- --fixture synthetic-mini --scheme B --out ./out
```

## 验收记录（本地填写）

| 项 | 值 |
|---|---|
| probes | |
| mean composite | |
| cost_usd（共享账本累计） | |
| embedding.backend | `ollama-bge-m3` 期望 |
| vec_index_build_ms | export 字段 |
| git commit | |

共享账本路径：`experiments/memory-benchmark/.local/new-core-data/scheme-B-shared-ledger.json`（gitignore）。
