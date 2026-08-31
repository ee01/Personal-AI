# 待校验事项

## Usage Analytics：weekly dreaming 下次运行 & $200 限额假设 & 测试账号清理

- 记录时间：2026-08-24
- 背景：后端调度器 ~8/17 才上线，weekly dreaming（周日 03:00 cron）迄今只运行过一次（8/23，5 topics 全失败、0 token），恰逢 8/22–23 全平台大面积 0-token 失败窗口（8/23 全局 1,687 次调用仅 0.12M token），且 Anthropic 账单恰好停在 $200.04。已做的加固：`GenerativeReplay.dreamAboutTopic` 的 LLM 调用加 `timeoutMs: 120_000`（长文生成超 60s 默认超时的防御，非已证实根因）。
- 待验证 ①：下个周日（2026-08-30）后查 dashboard `weekly_dreaming` 是否成功产出非零 token；若仍失败，需查 `usage_events.error_kind`（timeout/json_parse/rate_limit）定位真实根因。
- ✅ 已确认 ②（2026-08-25 Esone）：**Console 上 workspace 确实设有 $200/月 spend limit**——8/22–23 的大面积 0-token 失败 + 账单冻结在 $200.04 与撞限行为吻合，此假设从"弱化"回升为最可能解释（已沉淀进 usage_analytics.md 成本治理节）。**遗留待查：8/24 起 webpage-analysis 的 `bad_request`（458 次）根因**——撞限报错通常是全灭而非集中单一功能，仍有疑点；B9（`meta.errorText`）已实现待部署，部署后从失败事件直接读平台报错原文即可定案，短期可 `docker logs memory-service | grep "API error 400"`。注意：新扩展发布后 webpage-analysis 整体不再走后端，这条 route 的 400 会随流量归零自然消失，届时若无复现可直接关闭此项。
- ✅ 已执行 ③（2026-08-25）：37 个测试账号目录已移入 `data/deleted-users/2026-08-25T06-59-32-826Z/`（rcadmin@10.32.56.212，脚本 dry-run 确认后 apply，真实用户/Esone/radar-poc 未动）。后续：观察数日 dashboard heartbeat 调用量下降且无异常后，手动清空 deleted-users；e2e 脚本下次运行会自动重建各自账号，属预期。
- ✅ 已定案 ④（2026-08-25）：zong.zheng（及全体历史心跳烧钱）根因 = **旧部署 REFLECTION_ENABLED 开启**，ReflectionResearcher 对 active 线程每拍跑研究（zong 595 条 research attempts，8/18–8/24 04:31，与 LLM 事件完全重合）；8/24–25 重新部署关闭反思后心跳 token 降 94%（1.7M+/天 → ~120k/天，残余为活跃用户的蒸馏 job）。**风险提示：env 若再开反思默认值，烧钱立即复燃**——治理机制（默认关 + idle 安全网 + 后台告警）已实现并沉淀在 usage_analytics.md「成本治理与 2026-08 事故复盘」。radar-poc 也已于 8/25 移入 deleted-users（连同 37 个测试账号共 38 个）。
- ✅ 代码实现完成（2026-08-25）：本轮全部改动（pricing DB 表、B1/B4-B9 telemetry 修复、webpage-analysis 全量迁前端（无兜底、无开关）、反思 idle-sleep、env 改名等）已实现（口径沉淀于 usage_analytics.md 与 memory_capture.md，两份 plan 文档已删除、git 历史可查），`npm --prefix memory-service run build` + `npm --prefix memory-service test` 全绿（新增用例见 `analyticsStorePricing.test.ts`、`llmClient.test.ts`、`reflectionPlanner.test.ts`、`passiveWebpageAnalysisService.test.ts`），扩展 `npx webpack --config webpack.dev.cjs` 构建通过。**待执行**：部署到线上。部署后用 `node tools/eval-usage-analytics-guardrails.mjs --endpoint <地址> --token $ANALYTICS_ADMIN_TOKEN` 复核——本次实现过程中已对线上旧代码跑过一次，`pricing_fully_covers_recent_usage` 和 `weekly_dreaming_healthy_or_pending` 按预期报 fail（旧代码没有这两个修复），部署新代码后应转绿/转 pending。
- ⚠️ 顺带发现（与本次改动无关，不是我引入的）：本机 `memory-service/.env` 设了真实 `API_KEY`，会让约 21 个 `__tests__/*.test.ts` 路由集成测试收到意外 401（这些测试假设本地测试环境未设 `API_KEY`）。已用 `git stash`/`git stash pop` 验证过 `weeklyReporter.test.ts`、`confirmRequestsApi.test.ts` 在改动前的干净 HEAD 上同样报同样的 401——**纯属本机环境问题，与本次实现的任何改动无关**，未去修，仅记录以免误判。

## 豆包桥接：重新登录后的真实投递体验

- 记录时间：2026-08-15
- 本轮已证实本机 `Personal AI.app` 服务健康、Memory Service 与 User ID 已配置，`memory_sync` 和 `mobile_context` 均有既有目标；但豆包状态为 `needs_login`，两条绑定均未就绪，尚无同步尝试或投递记录。
- 已完成隔离证明：`desktop-app/src/__tests__/bridgeService.test.ts` 与 `doubaoSource.test.ts` 共 22 项通过，`doubao-source-toggle-gating-check.mjs` 与 Desktop build 通过；它们证明未登录 / 未绑定不会发送，不能代替真实页面可见性。
- 待用户在 `Personal AI.app` 完成豆包登录后继续：只读确认状态变为 `connected`、两条绑定重新就绪、日常浏览器不可用时的内置 Chromium 回退状态可见；如需验证真实推送，先展示按钮边界与待确认回执，再由用户明确批准一项无敏感测试内容的发送，最后读取同步审计与目标页可见性。不要在未获批准时点击推送、抓取、绑定、撤回或发送。
- 复查：2026-08-16。本机 `desktop-app` 健康（v4.0.0），但运行状态仍为 `needs_login`；`memory_sync` 与 `mobile_context` 的既有豆包 `/chat/` 绑定仍在，尚不能作为已重新就绪或已投递证明。本轮未执行任何写入，继续等待用户完成登录。
