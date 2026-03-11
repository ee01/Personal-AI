# Reflection & Dreaming System 发版规划与技术方案

> 基于用户的反馈，本期将重点落地五个高价值的、不侵入核心流程的主动性/辅助功能，而长期愿景已移入未来的演进文档。

## 前置依赖 (Prerequisites)

### 0. 后端 Bot Sender 工具类 (Backend Bot Sender Utility)
*   **目标**：Features 1、2、5 都需要后端主动向 RingCentral Bot 发送消息。当前 `src/bot.ts` 仅存在于 Chrome Extension 端（依赖 `chrome.storage.local`），后端无法复用。需要在 Memory Service 中实现一个独立的 Bot Sender。
*   **技术方案**：
    *   **新增文件**: `memory-service/src/utils/botSender.ts`
    *   **Config 扩展**: 在 `memory-service/src/config.ts` 的 `Config` interface 和 `getConfig()` 中新增：
        *   `botApiBaseUrl` (env: `BOT_API_BASE_URL`)
        *   `botToken` (env: `BOT_TOKEN`)
        *   `botId` (env: `BOT_ID`)
        *   `botType` (env: `BOT_TYPE`, 默认 `'user'`)
        *   `botTeamId` (env: `BOT_TEAM_ID`)
        *   `botTargetEmail` (env: `BOT_TARGET_EMAIL`) — 推送目标用户邮箱
    *   **BotSender class**:
        ```typescript
        class BotSender {
          async sendMarkdown(title: string, body: string, options?: { mention?: boolean }): Promise<void>
          isConfigured(): boolean  // 检查必要 env 是否齐全，不齐全则静默跳过
        }
        ```
    *   **容错**：如果 Bot 配置未填写，`sendMarkdown()` 静默 log warning 并 return，不阻断主流程。
    *   **复用 `.env`**：与前端共享同一个 `.env` 文件中的 `BOT_*` 变量（memory-service 的 `.env` 需要添加这些变量）。

---

## 整体发版范围 (Implementation Plan)

### 1. 梦境简报推送 (Dream Digest Notification)
*   **目标**：在周一早晨向用户推送周末系统"做梦"重组记忆产生的新洞察。
*   **展现**：
    *   Chrome Extension 的 Notification 提醒，点击后在 `memory-exploring` 页面展示。
    *   **Bot 推送**：通过 BotSender 发送一份简报版的 Markdown 消息到聊天框中。
*   **技术方案**：
    *   **后端**：
        *   修改 `HeartbeatLoop.ts`，新增 `checkDreamDigest()` 方法：
            *   判定条件：当前是周一 08:00-10:00 (使用 `new Date()` 检查 `getDay() === 1` 和 hour)
            *   查询 `dreams/` 目录下最近 48h 内生成的文件（通过 UserDataManager 列出文件）
            *   查询 `notification_records` 确认本周未推过 `type='dream_digest'`（幂等性）
            *   如果条件满足，生成 NotificationCandidate (`type: 'dream_digest'`)
        *   在 `deliverNotifications()` 中，对 `dream_digest` 类型额外调用 `BotSender.sendMarkdown()`，将 dream 内容的摘要版推送到 Bot
        *   梦境内容来源：直接读取 `dreams/*.md` 文件，提取 Narrative + Insights 部分
    *   **前端 / 插件端**：
        *   Extension 后台 SW 拉取到 `dream_digest` 类型的 notification，使用 `chrome.notifications.create` 弹出通知
        *   点击通知打开扩展 Dashboard (`memory-exploring.vue`) 并定位到一个新的 "Weekly Dream" 卡片区块
        *   新增路由 `/dreams` 或在 Overview 页面增加 Dream 板块，拉取对应的 `dreams/*.md` 内容进行渲染
    *   **注意**：
        *   Weekly dreaming 的 cron 当前是 `'0 3 * * 0'` (周日凌晨3点)，与周一推送的时间差是合理的
        *   梦境文件路径模式为 `dreams/{topic-slug}-{date}.md`（参考 GenerativeReplay.ts）

### 2. 待确认池与冲突决断中心 (Truth Maintenance Resolver)
*   **目标**：把 `confirm_requests` (低置信度事实、冲突事实) 以卡片形式透传给用户，让用户一键做决策，化解认知冲突。
*   **展现**：
    *   `memory-exploring.vue` 增加 "待决策 inbox" 模块。
    *   **Bot 推送**：当产生新的 Confirm Request 后，通过 BotSender 推送通知（含跳转链接）。
*   **技术方案**：
    *   **后端**：
        *   **已有 API 可复用**：
            *   `GET /confirm-requests` — 已实现，支持 `?state=pending` 过滤、分页、优先级排序
            *   `POST /confirm-requests/:id/answer` — 已实现，接受 `{ answer, detail? }`，内部调用 `TruthMaintainer.resolveConfirmRequest()`
        *   **新增 Bot 推送逻辑**：在 `TruthMaintainer.createConfirmRequest()` 或 HeartbeatLoop 的 `checkPendingConflicts()` 中，当发现新的 pending 请求时，调用 BotSender 推送通知（含跳转链接 `memory-exploring.html#/decisions`）
        *   ~~OpenClaw export~~ (推迟到下期，当前复杂度较高且用户群窄)
    *   **前端 / 插件端**：
        *   在 `memory-exploring.vue` 的路由中增加 `/decisions` 路径
        *   新增 `DecisionCenter.vue` 组件：
            *   调用 `GET /confirm-requests?state=pending` 获取列表
            *   卡片式展示：question、context、options、priority badge
            *   操作区域：Yes/No 按钮 + 可选的文本编辑框 (detail)
            *   提交调用 `POST /confirm-requests/:id/answer`
            *   侧边栏增加导航入口 "Decisions" (带 pending count badge)

### 3. Ask 查询的环境意图注入 (Intent Anticipation in `/ask`)
*   **目标**：利用 `user_profile_items` 中的 Preference 条目，在 `/ask` 请求中隐式注入用户偏好，实现"无需描述，懂你所想"。
*   **现状分析**：
    *   `/ask` 路由（`ask.ts:364-368`）已经注入了 `USER_CORE.md` 到 system prompt
    *   但 `USER_CORE.md` 是 `ProfileManager.renderUserCore(10)` 生成的概览，不一定包含所有 active preferences
    *   需要额外直接查询 `user_profile_items` 表获取最新 preferences 进行更精确的注入
*   **技术方案**：
    *   **后端**：
        *   在 `ask.ts` 中新增 `loadUserPreferences(db)` 函数：
            *   查询 `SELECT item_key, item_value FROM user_profile_items WHERE item_type = 'preference' AND status = 'active' ORDER BY salience_score DESC LIMIT 10`
            *   格式化为：`"User Preferences (apply silently): [pref1], [pref2], ..."`
        *   在构建 `enhancedPrompt` 时，将 preferences 追加到 system prompt 中（在 userCore 之后）
        *   注入格式为独立的 section：`--- User Preferences ---\n<formatted preferences>`
    *   **无前端改动**：完全后端透明处理

### 4. 浏览上下文自动气泡提示 (Contextual Browsing Injector)
*   **目标**：当用户在浏览（特别是 Github Repo, 技术文档等）时，如果页面特征命中了近期的 `dreams` 或 `reflections` 中的强相关内容，弹出轻量侧畔提示气泡。
*   **展现**：页面边缘出现很小的悬浮提示，点击展开引用。
*   **技术方案**：
    *   **后端**：
        *   **新增路由**: `POST /context-match` in `memory-service/src/routes/contextMatch.ts`
        *   请求体: `{ title: string, keywords?: string[], snippet?: string }`
        *   逻辑：
            1. 将 title + keywords + snippet 拼接为查询文本
            2. 使用 `EmbeddingClient` 生成 embedding
            3. 在 `chunks_vec` 中搜索，限定 `file_path LIKE 'reflections/%' OR file_path LIKE 'dreams/%'`
            4. 计算余弦相似度，如果最高分 > 阈值（env: `CONTEXT_MATCH_THRESHOLD`，默认 0.78）则返回匹配的摘要
            5. 如果不匹配，返回 `{ match: null }`
        *   **Config 扩展**: 在 config.ts 新增 `contextMatchThreshold` (env: `CONTEXT_MATCH_THRESHOLD`, default `0.78`)
        *   **注意**: 阈值从 0.82 调整为 0.78，因为 384 维 MiniLM 模型的相似度分布偏低，0.82 会过于严格
    *   **前端 / 插件端**：
        *   修改 `contentScriptWebIntelligence.ts`（已有的通用内容脚本），增加：
            *   页面加载后提取 `document.title` + `meta[name="keywords"]` + 首段文本摘要
            *   调用后端 `POST /context-match`
            *   如果返回匹配结果，在页面右下角注入一个极简浮窗 (pure DOM，不依赖 Vue)
            *   浮窗初始为小图标，点击展开显示匹配的 insight 摘要
            *   防频繁：同一页面只请求一次（用 URL hash 缓存判断）
        *   **节流机制**：对同一域名下的请求做 debounce (5 分钟内同域名不重复请求)

### 5. 零成本自动化周报推送 (Auto-Reporter & Bot push)
*   **目标**：基于每天积攒的 `reflections/*.md` 和消息记录，自动在每周五下午推发工作/学习周报。
*   **选项**：允许在系统的 Option 配置里开启或关闭。
*   **技术方案**：
    *   **Config 扩展**: 在 config.ts 新增：
        *   `weeklyReportCron` (env: `WEEKLY_REPORT_CRON`, default `'0 18 * * 5'` — 每周五 18:00)
        *   `weeklyReportEnabled` (env: `WEEKLY_REPORT_ENABLED`, default `'true'`)
        *   `weeklyReportMinMessages` (env: `WEEKLY_REPORT_MIN_MESSAGES`, default `20`)
    *   **新增核心类**: `memory-service/src/core/WeeklyReporter.ts`
        *   `async generateWeeklyReport(): Promise<WeeklyReportResult | null>`
        *   逻辑：
            1. 检查 `weeklyReportEnabled` 开关
            2. 统计近 7 天 `messages_raw` 数量，低于阈值则 skip
            3. 读取近 7 天的 `reflections/*.md` 文件
            4. 构建 LLM prompt（周报模板），生成 Markdown 周报
            5. 写入 `reports/weekly-{date}.md`
            6. 写入 `notification_records` (type: 'weekly_report')
            7. 调用 BotSender 推送
    *   **调度器集成**: 在 `ProactiveScheduler.ts` 新增第四个 cron：
        ```typescript
        this.weeklyReportTask = cron.schedule(config.weeklyReportCron, () => {
          this.safeRun('weeklyReport', () => this.runWeeklyReport());
        });
        ```
    *   **新增 API 路由 (可选)**: `GET /reports/latest` — 获取最近一期周报内容，供前端展示
    *   **前端**：在 Options 页面增加 "Weekly Report" section，含启用开关和 cron 配置

---

## 实施依赖图 (Dependency Graph)

```
Feature 0 (Bot Sender)  ──┬──> Feature 1 (Dream Digest)
                           ├──> Feature 2 (Decision Center - Bot 部分)
                           └──> Feature 5 (Weekly Report)

Feature 3 (Ask Intent)     独立，无依赖
Feature 4 (Context Match)  独立，无依赖
Feature 2 (Decision Center - 前端 UI 部分) 独立，无依赖
```

## 并行化策略 (Parallelization)

基于依赖图，推荐以下执行策略：

**第一波 (并行)**：
- Agent A: Feature 0 (Bot Sender) — 其他功能的前置
- Agent B: Feature 3 (Ask Intent Injection) — 独立，最简单
- Agent C: Feature 2 前端 UI 部分 (Decision Center Vue 组件 + 路由) — 不依赖 Bot

**第二波 (Bot Sender 完成后)**：
- Agent D: Feature 1 (Dream Digest) — 依赖 Bot Sender
- Agent E: Feature 5 (Weekly Report) — 依赖 Bot Sender
- Agent F: Feature 4 (Context Match) — 独立但较复杂

**第三波 (集成)**：
- Feature 2 Bot 推送部分整合
- 全局集成测试

---

## Q&A: 关于 Docker 与 npm 模式的调度

**Q**: "触发：由 ProactiveScheduler 调度，默认每天 23:00。在 docker 模式下和 npm run dev 模式下，是否会正常调度？还是需要特别初始化调度程序？"
**A**:
在 Memory Service 中，`ProactiveScheduler` 的代码设计是利用 `node-cron` 在 Node.js 进程内部直接跑心跳和定时任务的。
这意味着：
1. **无论在 Docker 还是 `npm run dev` 模式下，只要主 Node 进程 (server.ts) 是一直存活的，内部的 `setInterval` 和 `cron.schedule` 就能正常被触发。**
2. 不需要额外部署系统的 crontab 守护进程。
3. **潜在雷区**：如果您未来部署为多实例 (例如 Docker Swarm 起 3 个副本做负载均衡)，由于所有进程内都有一份 cron，会导致每天 23:00 发生 **3 次**重复的 Consolidation 生成。这时就需要引入分布式锁 (比如 Redis Lock) 或者选主机制。但只要是目前单体容器运行，它就是正常且自闭环的。

## 验证计划 (Verification Plan)

### 后端 API 与 Core 逻辑验证
- **Bot Sender**: 配置 BOT_* 环境变量后，调用 `botSender.sendMarkdown('test', 'hello')` 确认 Bot 消息到达。未配置时确认静默跳过。
- **Dream Digest**: Mock 当前时间为周一 09:00，mock dreams/ 目录下有最近文件，验证 HeartbeatLoop 生成 dream_digest notification。
- **Decision Center**: 向数据库 mock 插入 pending 的 confirm_requests，验证 GET 接口列表返回正确，POST answer 后状态流转正常。
- **Auto-Reporter**: 撰写测试脚本 `tests/run-weekly-report.ts`，强行触发 WeeklyReporter.generateWeeklyReport()，mock 7 天内容验证周报生成。
- **意图注入**: 在 `user_profile_items` 插入假的偏好（比如"必须使用日文回答"），调用 `/ask`，察看返回文字语种，验证隐式偏好生效。
- **Context Match**: 调用 `POST /context-match` 传入已知 dream 主题的 title，验证高相似度时返回摘要、低相似度时返回 null。

### Chrome 插件与前端联调
- 手动用 Postman 调用接口喂入假数据，验证 `memory-exploring.vue` 中的决断卡片渲染正确。
- 本地起一个带测试数据的前端网页，验证上下文气泡在高匹配时浮现，且 UI 美观不遮挡。
- 验证 dream_digest notification 在 Chrome Extension 中弹出并可点击跳转。
