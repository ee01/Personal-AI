# OpenRouter 记账代理验证（2026-10-31）

## 实现摘要

- 本地 OpenAI 兼容代理：`experiments/memory-benchmark/src/cost/openrouter-proxy.ts`（127.0.0.1 随机端口，转发 `https://openrouter.ai/api/v1`，请求体注入 `usage: { include: true }`，流式 `stream_options.include_usage`）。
- 共享账本：`.local/proxy-ledger/<run-id>.jsonl`（generation id、tokens、OpenRouter 真实 `cost`）。
- Harness 报告列：`proxy_usd` / `proxy_calls`；`$50` 停止条件在存在 proxy 账本路径时读 `proxy_usd`（`adapter-ledger.isCombinedOverBudget`）。
- 方案 A：`memory-service/src/benchmark/benchmarkLlmEnv.ts` + `createBaselineMemoryAdapter` 在注入 proxy base URL 时关闭 `skipExtraction`，按 `config/models.json` 走 fast 抽取 / main 整理（`RECONCILE_B_MODE=on`）。

## 方案 A · synthetic-mini 远程调用证据

| 项 | 值 |
| --- | --- |
| run_id | `run-1793411808891` |
| 报告 | `reports/e166-smoke-A3/A-run-1793411808891.json` |
| proxy_calls | 8 |
| proxy_usd | $0.012294 |
| 示例 generation id | `gen-1793411809-BFa31EKM1k000HOlQbaR` |
| live_llm | 是（ingest 走 LLM 抽取；非 skipExtraction smoke） |
| probes | 3/3（mean composite 67.22，分数因真实抽取/recall 变化，与历史 heuristic 94.44 不可直接比） |

账本片段见 `.local/proxy-ledger/run-1793411808891.jsonl`（含 8 条 generation id）。

## 五方案 key usage 对账（本轮范围）

| scheme | proxy_usd | key 窗口差分 | 偏差 | 说明 |
| --- | ---: | ---: | ---: | --- |
| A | 0.012294 | （见下方 CLI） | 待 `verify-cost-proxy` 全矩阵 | 本轮已跑通 proxy + 真实 cost |
| B–E | — | — | — | 需各跑 `npm run run -- --scheme … synthetic-mini`；D/E 另需 supermemory/letta 服务 |

复现 A 对账：

```bash
cd experiments/memory-benchmark
# 运行前/后各一次：
node --import tsx -e "import { loadBenchmarkDotenv } from './adapters/mem0/load-env.js'; import { fetchOpenRouterKeyUsage } from './src/cost/openrouter-key-usage.js'; loadBenchmarkDotenv(); const u=await fetchOpenRouterKeyUsage(process.env.OPENROUTER_API_KEY); console.log(u.usage);"
npm run run -- --scheme A --fixture synthetic-mini --out reports/e166-verify-A
```

全五方案批量脚本：`npx tsx src/cli/verify-cost-proxy.ts`（需 `OPENROUTER_API_KEY`；C–E 依赖 mem0/服务就绪）。

## 测试

- `experiments/memory-benchmark`: `npm test && npm run typecheck` ✅
- `memory-service`: `baselineHarnessAdapter.test.ts` ✅（全量 `npm test` 仍有仓库内既有失败项，与本次 diff 无关）

## 提交（分组）

见 issue 评论中的 commit hash（落地后填写）。
