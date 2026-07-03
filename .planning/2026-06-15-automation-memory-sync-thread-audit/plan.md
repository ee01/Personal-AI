# 长期记忆线程审计摘要改进计划

## 目标

本轮随机抽中 `Doubao Bridge / Memory Sync Thread`。目标是让 Desktop App 的“绑定长期记忆线程”步骤卡直接说明最近一次 persona / voice 长期记忆同步的审计细节，避免用户只看到“已送达”或“失败”而不知道包类型、内容条目、来源引用、传输验证和状态回写是否完整。

## 当前发现

- `docs/progressing/to-verify.md` 当前为“暂无。”
- 自动化记忆文件 `$CODEX_HOME/automations/automation/memory.md` 不存在，本轮不沿用具体上次待办。
- 本机 Reminders 不存在 `Personal AI` 列表，因此没有可纳入或可完成的 Reminder item。
- 当前工作树已有大量非本轮变更，本轮只改 Doubao Bridge 相关文件和本计划目录。
- `renderMemoryThreadDetail()` 只把最近长期记忆同步显示成状态、触发方式、时间和错误文案；`formatAttemptDetails()` 已经能生成包类型、条目数、来源引用、线程、验证、传输和 `telemetryError`，但只用于完整同步流水。
- `getAttemptRecoveryActions()` 只有失败 attempt 才提供恢复动作。若内容已送达但 Memory Service 回写失败，完整流水会显示 `状态回写异常`，但步骤卡不会显示，也不会给“测试 Memory Service / 查看日志”的恢复动作。

## 外部参考

- ChatGPT Memory Sources 把“哪些来源影响了个性化回答”和可编辑/删除控制前置到回答旁，说明长期记忆不能只给成功态，还要显示来源与控制边界。
- Claude memory 把过去对话搜索、memory summary、项目隔离和引用入口作为用户可见能力，说明跨会话记忆需要清楚区分范围、来源和是否可管理。
- LongMem 把长期上下文缓存和检索解耦，支持持续更新但也提示要防止 memory staleness；产品侧应暴露新鲜度和同步结果。
- Generative Agents 的记忆架构强调 observation / reflection / planning 的组合，说明长期记忆需要可解释的沉淀与动态取用，而不是单次发送成功的黑盒状态。

## 实现步骤

1. 在长期记忆线程卡片里复用 `formatAttemptDetails(stableAttempt)`，追加一行“最近同步审计”，显示 package kind、内容条目、来源引用、线程、验证/正文可见性、传输、回退原因和状态回写异常。
2. 调整恢复动作生成逻辑：失败 attempt 仍保留打开豆包、修复线程、重试等动作；仅有 `telemetryError` 的已送达 attempt 只提供 Memory Service / 日志类恢复动作，避免建议用户重发已送达 persona。
3. 更新 `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`，覆盖长期记忆线程卡片里的包、内容、来源、验证、状态回写异常和 telemetry-only 恢复动作。
4. 更新 `docs/features/doubao_bridge.md`，把长期记忆线程步骤卡的审计摘要和 telemetry-only 边界写入当前行为说明。

## 验证计划

1. `npm --prefix desktop-app run test:source-toggle-gating`
2. `npm start` 等第一次成功编译后停止
3. 复跑 `npm --prefix desktop-app run test:source-toggle-gating` 作为本地页面 E2E 证明
4. `git diff --check -- desktop-app/app/renderer.js desktop-app/scripts/doubao-source-toggle-gating-check.mjs docs/features/doubao_bridge.md .planning/2026-06-15-automation-memory-sync-thread-audit/plan.md`

## 结果

- 已完成代码、E2E 校验脚本和 `docs/features/doubao_bridge.md` 更新。
- `绑定长期记忆线程` 卡片现在显示 `最近同步审计`，包括包类型、内容条目、来源引用、线程、验证/正文可见性、传输和状态回写异常。
- 已送达但只有 `telemetryError` 的 attempt 只显示 `测试 Memory Service` / `查看日志`，不再提示重发长期记忆。
- 验证已通过：
  - `npm --prefix desktop-app run test:source-toggle-gating`
  - `npm start` 首次成功编译后停止
  - 复跑 `npm --prefix desktop-app run test:source-toggle-gating`
  - in-app Browser 打开本地 Desktop App 页面并确认工作区和 persona 入口渲染
  - scoped `git diff --check`
- 本机 Reminders 不存在 `Personal AI` 列表，没有可完成 item。
- 当前 Codex session 已通过 `codex archive 019ec782-3e51-7592-9e57-ab0a57337dd6` 归档。
