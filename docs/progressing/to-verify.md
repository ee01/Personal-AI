# 待校验事项

## Usage Analytics：weekly dreaming 下次运行 & $200 限额假设 & 测试账号清理

- 记录时间：2026-08-24
- 背景：后端调度器 ~8/17 才上线，weekly dreaming（周日 03:00 cron）迄今只运行过一次（8/23，5 topics 全失败、0 token），恰逢 8/22–23 全平台大面积 0-token 失败窗口（8/23 全局 1,687 次调用仅 0.12M token），且 Anthropic 账单恰好停在 $200.04。已做的加固：`GenerativeReplay.dreamAboutTopic` 的 LLM 调用加 `timeoutMs: 120_000`（长文生成超 60s 默认超时的防御，非已证实根因）。
- 待验证 ①：下个周日（2026-08-30）后查 dashboard `weekly_dreaming` 是否成功产出非零 token；若仍失败，需查 `usage_events.error_kind`（timeout/json_parse/rate_limit）定位真实根因。
- 待验证 ②（2026-08-25 修订）：errorKind 取证后撞限假设弱化——8/24 起的失败集中为 webpage-analysis 的 `bad_request`（458 次且持续中），分布不均匀，不符合撞限全灭特征；但仍需 Console 确认 workspace 210 是否设过 spend limit。**新增待查：8/24 起 webpage-analysis 大量 400 的根因**——需先落地 B9（失败打点存 provider 错误文本）再定位，短期可 `docker logs memory-service | grep "API error 400"` 直接看原始报错。
- ✅ 已执行 ③（2026-08-25）：37 个测试账号目录已移入 `data/deleted-users/2026-08-25T06-59-32-826Z/`（rcadmin@10.32.56.212，脚本 dry-run 确认后 apply，真实用户/Esone/radar-poc 未动）。后续：观察数日 dashboard heartbeat 调用量下降且无异常后，手动清空 deleted-users；e2e 脚本下次运行会自动重建各自账号，属预期。
- ✅ 已定案 ④（2026-08-25）：zong.zheng（及全体历史心跳烧钱）根因 = **旧部署 REFLECTION_ENABLED 开启**，ReflectionResearcher 对 active 线程每拍跑研究（zong 595 条 research attempts，8/18–8/24 04:31，与 LLM 事件完全重合）；8/24–25 重新部署关闭反思后心跳 token 降 94%（1.7M+/天 → ~120k/天，残余为活跃用户的蒸馏 job）。**风险提示：env 若再开 REFLECTION_ENABLED，烧钱立即复燃**——重新启用前必须先落地主 plan §6.6 的频次决策与守卫。radar-poc 也已于 8/25 移入 deleted-users（连同 37 个测试账号共 38 个）。

## 豆包桥接：重新登录后的真实投递体验

- 记录时间：2026-08-15
- 本轮已证实本机 `Personal AI.app` 服务健康、Memory Service 与 User ID 已配置，`memory_sync` 和 `mobile_context` 均有既有目标；但豆包状态为 `needs_login`，两条绑定均未就绪，尚无同步尝试或投递记录。
- 已完成隔离证明：`desktop-app/src/__tests__/bridgeService.test.ts` 与 `doubaoSource.test.ts` 共 22 项通过，`doubao-source-toggle-gating-check.mjs` 与 Desktop build 通过；它们证明未登录 / 未绑定不会发送，不能代替真实页面可见性。
- 待用户在 `Personal AI.app` 完成豆包登录后继续：只读确认状态变为 `connected`、两条绑定重新就绪、日常浏览器不可用时的内置 Chromium 回退状态可见；如需验证真实推送，先展示按钮边界与待确认回执，再由用户明确批准一项无敏感测试内容的发送，最后读取同步审计与目标页可见性。不要在未获批准时点击推送、抓取、绑定、撤回或发送。
- 复查：2026-08-16。本机 `desktop-app` 健康（v4.0.0），但运行状态仍为 `needs_login`；`memory_sync` 与 `mobile_context` 的既有豆包 `/chat/` 绑定仍在，尚不能作为已重新就绪或已投递证明。本轮未执行任何写入，继续等待用户完成登录。
