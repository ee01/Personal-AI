# Scheme D — Supermemory Local adapter

接 Stage 1 本地环境：`../personal-ai-supermemory` + 官方 **`supermemory-server` 0.0.9** @ `127.0.0.1:6767`。

## 结构

- `client.ts` — Local REST（Bearer api-key；文本 `POST/PATCH /ns/{namespace}/document`）
- `registry-db.ts` — sidecar SQLite（event 信封、scope ACL、document id 映射）
- `runtime.ts` — harness 合约 + 日级 **`main`** 整理层
- `portability-gates.ts` / `run-gates.ts` — 五道可移植性门
- `CAPABILITY_GAPS.md` / `clock-audit.md`

数据目录：`experiments/memory-benchmark/.local/supermemory-data/`（gitignore）。

## 前置

```bash
# 见 experiments/memory-benchmark/envs/README.md § Supermemory Local
cd ../personal-ai-supermemory
# 启动 supermemory-server（OpenRouter fast + local bge-m3）
```

`experiments/memory-benchmark/.env` 含 `OPENROUTER_API_KEY`；Local api-key 默认读 `../personal-ai-supermemory/local-state/data/api-key`。

## 可移植性门

```bash
cd experiments/memory-benchmark
npx tsx adapters/supermemory/run-gates.ts
```

写入 `adapters/supermemory/gate-results.json`。五门：来源导出、修改传播、删除/撤销传播、权限隔离、幂等、中文检索（见 `portability-gates.ts`）。

## 跑 synthetic-mini

```bash
npm run run -- --fixture synthetic-mini --scheme D --out ./out
```

## 测试

```bash
npm test
```

`scheme D passes delete/revoke gate` 在 **server 可达** 时运行；否则 skip。
