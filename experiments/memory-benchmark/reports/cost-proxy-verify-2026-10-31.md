# OpenRouter proxy verification (2026-10-31)

## 启动顺序

1. `cd experiments/memory-benchmark && npm run proxy`（默认 `127.0.0.1:4555`，可设 `MEMORY_BENCHMARK_PROXY_PORT`）
2. 导出 `MEMORY_BENCHMARK_PROXY_URL=http://127.0.0.1:4555/v1`
3. 按 `envs/README.md` 启动 Supermemory / Letta（`OPENAI_BASE_URL` 指向代理）
4. `npm run verify-cost-proxy` 或逐方案 `npm run run -- --scheme …`
5. 结束后停止 D/E 与 proxy

## run 归属

共享代理：harness 请求带 `X-Benchmark-Run`；D/E 服务走「当前活动 run 窗口」

## 五方案对账（synthetic-mini）

| scheme | proxy_usd | key_delta_usd | deviation_pct | pass (≤10%) | note |
| --- | ---: | ---: | ---: | --- | --- |
| A | 0.013447 | 0.002746 | 389.76% | ❌ | synthetic-mini |
| B | 0.003657 | 0.014701 | 75.12% | ❌ | synthetic-mini |
| C | 0.002746 | 0.002781 | 1.27% | ✅ | synthetic-mini |
| D | 0.004753 | 0.002835 | 67.65% | ❌ | synthetic-mini; Supermemory 可能含非 LLM 路径或 generation 回填延迟 |
| E | 0.003941 | 0.006173 | 36.16% | ❌ | synthetic-mini |

Per-scheme artifacts: `reports/cost-proxy-verify-2026-10-31/`.