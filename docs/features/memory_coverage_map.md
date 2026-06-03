# Memory Coverage Map / 记忆覆盖地图

*最后更新: 2026-05-29*

## 是什么

Memory Coverage Map 是 Personal AI 的记忆来源可见性页面，入口位于 `memory-exploring.html#/coverage`。它回答一个基础问题：

> Personal AI 当前到底看得见哪些来源、这些来源最近有没有继续产生记忆、哪里存在覆盖缺口，以及用户可以怎样主动修复。

它不是新的搜索页，也不是自动抓取所有外部平台的 connector。它的重点是把记忆系统从黑箱变成一张可检查、可修复、可扩展的覆盖地图。

## 大白话运行逻辑

Coverage Map 会从 Memory Service 的真实数据表里聚合消息、chunks、用户画像、技能、通知、动作队列、provider sync job 等信号，然后按平台展示：

1. 这个平台是否已经有记忆信号。
2. 最近 `staleAfterDays` 天内是否仍有新信号。
3. 平台对 Personal AI 的贡献是 ingest、push、sync 还是内部 derive。
4. 如果缺数据、同步失败、信号太少或积压过高，页面会给出可解释的修复项。
5. 用户手里有资料时，可以从同一页面右上角 `录入` 入口主动导入；需要备份时，`记忆备份` 直接下载 zip。
6. 每个平台返回 `qualityScore`，用于快速判断覆盖健康度；它来自平台状态、新鲜度和健康贡献项，不替代证据详情。

结果主要受这些因素影响：

- 数据源是否真的写入了 Memory Service，而不是只在前端页面或外部平台里存在。
- 每条来源的 `source_type`、时间戳、group/project metadata 是否完整。
- 近 7 天窗口内是否还有信号，旧数据会让平台进入 stale / sparse。
- Provider sync job、通知、动作队列等运行状态是否有失败或积压。
- 用户是否主动录入了外部 AI 历史、文档或 Personal AI 备份 zip。

## 当前能力

### 覆盖总览

页面顶部展示整体状态：

- 已接入平台数。
- 健康平台数。
- 需关注平台数。
- 积压压力。
- 未启用通道。
- 覆盖缺口：只统计需要用户主动处理的 warning / critical 修复项；未启用的 P1+ 可选通道作为 info 规划项展示，不把“尚未接入”误报成当前故障。
- 当前 Memory Service 消息、chunks、entities 总量。

这些数字来自 `GET /api/v1/coverage/map`，不是 demo 固定值。

### 平台地图

平台按四组展示：

| 分组 | 说明 |
|---|---|
| 已激活平台 | RingCentral、Jira、网页记忆等已经有输入/输出信号的平台 |
| Personal AI 派生能力 | 用户画像、反思、动作队列、技能等内部能力 |
| 未启用通道 | Reminders、本地 Notes、外部 AI 历史等当前不自动抓取的来源 |
| 系统入口 | 智能录入 / 记忆备份等用户主动触发的入口 |

每个平台卡片展示：

- `healthy` / `partial` / `stale` / `sparse` / `failing` / `blocked` / `pressure` / `not_configured` / `unknown` 状态。
- ingest / push / sync / derive 方向标签。
- 贡献项、数量、最近信号、证据 SQL / API source。
- 质量分 `qualityScore`，范围 0-100。
- 平台卡片直接显示质量分摘要、近 7 天信号占比和失败扣分；点开平台后再看完整 `qualityScoreBreakdown`。
- 质量分解释 `qualityScoreBreakdown`，把状态基准、健康贡献、新鲜度和失败惩罚拆开，避免只给一个黑箱数字。
- 低分平台会在质量分解释里标出 `优先处理` 的贡献项、状态、最近信号和证据 source，让用户不用从列表里猜先修哪里。
- 选中后的详情、贡献列表和修复队列。

### 修复队列

修复队列只展示可解释的下一步，不自动修改同步设置。

右侧修复队列默认跟随当前选中的平台，便于先处理当前卡片的质量分短板；同时提供 `当前平台 / 全部` 切换。用户选到健康平台但顶部仍有全局覆盖缺口时，空态会提示“全局仍有覆盖缺口”并可一键切到全部修复项，避免全局 warning 被平台筛选藏起来。全部视图会标出每条修复项所属平台。

典型修复项包括：

- 某个 provider sync job 最近失败。
- 某个来源只有历史数据但最近没有新信号。
- 某个通道尚未配置。
- 扫描件 PDF 暂未启用 OCR。
- 如果某个 active / derived 平台质量分低于 80 分、但没有手写 warning/critical 修复项，后端会根据最严重的非 healthy contribution 自动补一条质量分短板修复建议；已有明确修复项时不重复制造建议。
- Codex、Claude Code、Cursor、ChatGPT GPTs、Claude Skills Web 等 P1+ skill 同步通道默认是 info 规划项；只有用户启用后探测失败，才作为 warning 修复项进入覆盖缺口。

### 智能录入抽屉

右上角 `录入` 打开抽屉，支持用户主动提供资料：

| 输入 | 当前处理 |
|---|---|
| 粘贴文本 | `inspect` dry-run 后，确认写入低权重 shadow memory |
| `.md` / `.markdown` / `.txt` / `.json` / `.csv` / `.log` | 读取文本，拆 chunk，确认写入 |
| 普通 `.zip` | 未命中备份或外部 AI schema 后，只读解压并枚举最多 80 个文件，支持上述文本类型和 PDF 文本流 |
| `.pdf` | best-effort 抽取常见 PDF 文本流；扫描件或无文本 PDF 会明确阻塞 |
| ChatGPT / Claude `conversations.json` zip | 会先在完整 zip 目录里查找 `conversations.json`，按会话转成低权重 shadow memory；抽屉显示外部 AI 对话数、纳入消息数、长会话截断数、来源预览和被忽略的非对话文件提醒 |
| Personal AI 备份 zip | 自动切到恢复模式，不按普通文档分析 |

普通资料的写入规则：

- 必须先 dry-run，不会一上传就写库。
- 空文本文件、空粘贴内容、扫描件 PDF 或不支持格式会显示阻塞原因，不允许写入空 shadow memory。
- dry-run warning 会在抽屉里直接展示；如果发现 password / token / api key / 密钥等高风险词，用户必须勾选确认后才能提交。
- 确认后写入 `messages_raw` 和 `chunks`。
- 使用 `source_type = manual`、`source = import:<batchId>`。
- metadata 标记 `shadowMemory: true`、`lowWeight: true`、`importBatchId`、`importEntryPath`、`parserVersion`。
- `memory_metadata` 以低 salience / temporary consolidation 写入，避免刚导入的资料直接压过长期高质量记忆。
- `memory_import_batches` 记录 batch id、hash、来源名、解析结果和 warning，用于去重和审计。
- batch summary 会记录 `profileCandidates`、`skillSignals`、`highRisk`、`unsupported`、`externalAiConversations` 和被跳过/忽略的 warning，方便后续把高价值条目升级成候选。
- 外部 AI 历史包不会受普通 zip 80 文件预检上限影响；命中 `conversations.json` 后只把对话内容作为导入候选，归档里的附件、账户文件或其他导出元数据会被忽略并在 dry-run 中提示。
- 外部 AI 历史最多预检前 40 个会话、每个会话纳入前 80 条消息；如果长会话被截断，dry-run 会显示纳入消息数、总消息数、截断会话数和 warning，避免用户误以为完整历史已经写入。

### 备份下载与恢复

右上角 `记忆备份` 直接调用 `POST /api/v1/export` 下载 Personal AI backup zip，不再进入 Options 设置页。

备份恢复共用 `录入` 抽屉：

1. 用户上传 zip。
2. `POST /api/v1/import/inspect` 识别是否为 Personal AI backup schema。
3. 只有后端预检明确返回 `backup_zip` 后才显示恢复区域；如果用户从 `备份 zip` 入口选了普通 zip，页面会退回普通资料 dry-run，不会误报成备份。
4. 命中备份 zip 后默认 merge；勾选 `覆盖替换现有记忆` 后使用 replace。
5. restore dry-run 会先展示备份用户、导出时间、DB 行数、文件写入/覆盖/保留/删除影响、关键影响路径和 warning，避免用户在不知道影响范围时确认。
6. 如果存在跨用户 warning、replace、覆盖或删除影响，确认恢复前必须勾选已复核影响预览；replace 仍需要二次确认。
7. 最终恢复复用现有 `POST /api/v1/import`；恢复完成后抽屉显示写入回执并禁用重复确认按钮，需要再次恢复时重新选择备份文件。

备份 zip 的 schema 识别会先扫描完整 zip 文件列表确认 `manifest.json`、`user/memory.db`、`user/config.json` 和 `personal-ai-memory-backup` manifest，再把普通资料解析限制在前 80 个文件内。这样大型 Personal AI 备份不会因为条目数较多而被误判为普通文档包，但普通资料导入仍保持预检上限。

## API

| API | 用途 |
|---|---|
| `GET /api/v1/coverage/map` | Coverage Map 主聚合接口；平台项包含 `qualityScore` 和 `qualityScoreBreakdown` |
| `GET /api/v1/coverage/messages-by-source` | 消息来源切片 |
| `GET /api/v1/coverage/pressure` | 通知、确认项、动作队列等压力切片 |
| `GET /api/v1/coverage/provider-jobs/recent` | provider sync job 最近状态 |
| `GET /api/v1/coverage/skills-sync` | 技能平台同步状态 |
| `POST /api/v1/import/inspect` | 智能录入 dry-run，识别普通资料或备份 zip |
| `POST /api/v1/import/commit` | 普通资料确认写入 shadow memory |
| `POST /api/v1/export` | 下载 Personal AI 备份 zip |
| `POST /api/v1/import` | merge / replace 恢复 Personal AI 备份 zip |

## 数据模型

| 表 | 用途 |
|---|---|
| `messages_raw` | 平台来源消息、手动导入资料、会议等覆盖信号 |
| `chunks` | 可检索文本块，也是 Coverage Map 的记忆总量指标之一 |
| `memory_metadata` | 导入资料的低权重显著性和巩固状态 |
| `memory_import_batches` | 智能录入 batch receipt、source hash、状态、candidate summary 和 warning |
| `provider_sync_jobs` | 外部 AI / provider 同步状态 |
| `personal_skills` / `skill_platform_sync_settings` | 技能沉淀和平台同步状态 |
| `notification_records` / `confirm_requests` / `proposed_actions` / `reflection_threads` | 压力和内部派生能力指标 |

## 代码入口

- UI: `src/modals/components/MemoryCoveragePage.vue`
- Vue route: `src/modals/memory-exploring-entry.ts`
- Sidebar entry: `src/modals/memory-exploring.vue`
- Client: `src/services/MemoryServiceClient.ts`
- Coverage API route: `memory-service/src/routes/coverage.ts`
- Coverage aggregation: `memory-service/src/core/MemoryCoverageService.ts`
- Smart import route: `memory-service/src/routes/import.ts`
- Smart import service: `memory-service/src/core/SmartMemoryImportService.ts`
- Import batch migration: `memory-service/src/storage/migrations/025_memory_import_batches.sql`

## 边界

- 不自动扫描用户本机文件夹。
- 不自动抓取 ChatGPT / Claude / Gemini / Reminders / Notes 历史；外部 AI 历史只能由用户主动上传。
- 不把普通导入资料直接升级为 confirmed 用户画像或外发上下文。
- 不把 PDF 假装解析成功；best-effort 抽不到文本时必须明确显示 blocked reason。
- 不在 Coverage Map 主视图执行写操作；写入只发生在用户显式点击录入 commit 或备份恢复时。
- 不把备份 zip 当普通资料分析；命中 Personal AI backup schema 时只走恢复逻辑。

## 业内参考

- Slack Enterprise Search 的 custom connector 把外部知识库接入搜索和 AI answers，但前提是保留 source system 的权限模型。
- Notion Enterprise Search 强调 connector 权限同步、查询时权限过滤、删除/断开后的数据保留边界；Coverage Map 应继续把来源、范围和删除/恢复路径展示清楚。
- Microsoft 365 Copilot / Graph connectors 会暴露连接、索引、队列和 ACL 类错误；Coverage Map 的质量分也应把失败、积压和权限/配置问题转成可操作的修复项。
- Microsoft 365 Copilot connector 的 index browser / error report 会区分 indexed、partially indexed、权限/ACL、queue throttling 和 connector agent 失败；Coverage Map 也应区分“已启用但失败”和“可选但尚未启用”，避免把规划项变成故障告警。
- OpenAI ChatGPT data export 与 Claude data export 说明外部 AI 历史迁移正在变成用户预期，但导出通常是 zip / conversations 数据，不能假设所有内容都安全、完整或高质量；长对话必须把纳入范围展示清楚。
- Google Takeout、ChatGPT data export 和 Claude memory import/export 都把“先生成/下载归档，再由用户选择导入或保存”的路径变成常见心智；Coverage Map 因此保持一键下载、上传后自动识别、恢复前 dry-run 的轻量路径。
- PIM 研究反复指出，个人信息会碎片化在多个设备和应用之间；Coverage Map 的价值是让用户先看见 Personal AI 实际覆盖了哪里，而不是假设所有来源都已统一。
- 数据质量研究通常把完整性、时效性/新鲜度、准确性、一致性和相关性视为核心维度；当前 `qualityScore` 先落在覆盖状态、新鲜度和失败/积压可解释性上，暂不假装评估内容准确性。
- 数据可携带性用户研究显示，用户查看导出数据本身会增强控制感，但“迁移到替代服务”的可用性经常有限；恢复入口要把归档识别、影响预览和失败原因直接展示出来，而不是只给一个成功/失败提示。
- 数据可携带性风险讨论也提醒，过度顺滑的转移会带来隐私和安全风险；replace 恢复继续保留 dry-run 与二次确认，不做无预览的破坏性恢复。
- Opal 等 personal AI memory 研究强调长期个人记忆的隐私和访问模式风险；智能录入默认低权重、显式来源和高风险确认是必要边界。
- LongMemEval 等长期记忆评测把 indexing、retrieval、reading 拆开看；外部 AI 历史导入因此先保留会话粒度、来源和 warning，再让后续召回/晋升流程决定哪些内容真正有用。

## 后续增强

- 接入扫描件 PDF OCR。
- 增加 Gemini / Takeout 等更多外部 AI 历史包格式。
- 把高价值导入资料转为 profile / skill / project promotion candidate，但仍需用户确认。
- 增加用户自定义 coverage target。
- 增加 noisy score，但要等数据模型有足够证据后再落地。

## 验证建议

改动 Coverage Map 或智能录入时，优先运行：

```bash
npm --prefix memory-service test -- --run src/__tests__/api-coverage.test.ts src/__tests__/api-smart-import.test.ts
npm --prefix memory-service run build
npm start
```

`npm start` 是 webpack watch，需要等首次 successful compile 后停止。

涉及真实服务部署时：

```bash
npm run deploy:memory
curl -fsS -H 'X-User-Id: esone.qiu' http://10.32.56.212:3210/api/v1/coverage/map
curl -fsS -H 'X-User-Id: esone.qiu' -H 'Content-Type: application/json' \
  --data-binary '{"text":"inspect only","scope":"work"}' \
  http://10.32.56.212:3210/api/v1/import/inspect
```
