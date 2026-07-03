# 多用户隔离身份路由回执

## 目标

随机目标：`多用户隔离`（Memory Service / `memory_system.md`）。

本轮不改 per-user SQLite 分库和写入拦截算法，只把当前用户空间的身份来源和读写边界在 Memory Exploring 侧栏前置展示，避免用户把未解析身份的 `default` fallback 当成自己的真实记忆空间。

## 计划

1. 补齐 `/stats.user.identitySource`，区分显式 `X-User-Id` 与缺失身份导致的 `default_fallback`。
2. Memory Exploring 侧栏展示身份来源、storage key、显式空间读写范围，以及 fallback 时的只读兼容/写入拦截边界。
3. 更新 `docs/features/memory_system.md` 和 `docs/features/index.md` 中 `多用户隔离` 描述。
4. 跑 multi-user targeted verify、webpack 首次编译、Memory Exploring identity E2E 和 scoped whitespace check。

## 外部参考

- OpenAI ChatGPT Memory FAQ：记忆需要可查看、可管理和可删除。
- Anthropic Claude Memory：项目级 memory 分隔、可查看/编辑、Incognito 不写入 memory。
- Notion Enterprise Search：查询尊重用户权限，workspace 数据隔离。
- `Memory in the Age of AI Agents`：agent memory 需要把 persistent memory、RAG 和 context engineering 边界说清楚。
