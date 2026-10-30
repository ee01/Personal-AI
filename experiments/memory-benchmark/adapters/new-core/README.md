# 方案 B（Memory Core v4）benchmark adapter

独立包路径：`experiments/memory-benchmark/adapters/new-core/`。实现 `MemoryBenchmarkAdapter`（`schemeId='B'`），数据落在 `experiments/memory-benchmark/.local/new-core-data/`（已 gitignore）。

## 依赖

```bash
cd experiments/memory-benchmark
npm install
```

可选：仓库根目录 `.env` 中设置 `OPENROUTER_API_KEY` 以启用整理阶段的 OpenRouter 抽取；未设置时使用确定性启发式抽取（合成 smoke 可跑通）。

模型档位默认见 `config/models.json`（若 E-160 尚未合入则使用代码内默认值，与 E-141 决策一致）。

## 合成 smoke

```bash
npm run run -- --fixture synthetic-mini --scheme B --out ./out
npm test
npm run typecheck
```

## 导出

`export()` 返回 evidence / facts / artifacts / 四水位 / ingest·consolidate·recall 分阶段 trace / 内部 cost ledger 快照。正文仅在本地 SQLite，不提交 Git。

## 规格

设计来源：`docs/features/memory_core_v4_spec.md`。与规格的已知偏离见同目录 `DEVIATIONS.md`。
