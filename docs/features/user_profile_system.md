# 用户画像系统

更新日期: 2026-07-14

## 功能概述

用户画像系统把用户的长期事实、偏好、习惯、兴趣、约束和写作风格保存为可检查、可导出、可校准的 profile items。它用于增强 Web Intelligence、记忆召回、个性化提示词、Compose Assist 和主动推荐，但不会把前端展示层当作画像数据源。

## 大白话运行逻辑

用户画像系统把“系统以为了解你的内容”变成可检查的条目。自动推断会先进入待确认，用户确认后才真正参与核心画像、个性化注入和跨平台上下文。

结果主要受这些因素影响：

1. 用户确认状态：`user_confirmed = 1` 且 `status = active` 的条目才应进入核心画像和外部 provider context。
2. 证据质量：有明确 evidence refs、多次稳定命中和来源片段的画像更值得信任。
3. 重要性反馈：用户调高/调低影响力会改变 `confidence` 和 `salience_score`，进而影响排序和召回。
4. 状态生命周期：pending、active、retracted、archived、superseded 的边界决定条目是否展示、是否使用、是否可恢复。
5. 页面适配层：前端只是把 profile items 分组展示，不应把 mock 或展示派生数据当成画像真源。
6. 写作风格：`writing_style.*` 来自 Compose Assist 的重复改写证据，主要影响语气、长度、结构和禁用话术，不应被当成用户事实或项目知识。

## 当前实现

- 后端数据源: `memory-service/src/routes/profile.ts`
  - `GET /api/v1/profile/items`
  - `POST /api/v1/profile/items`
  - `POST /api/v1/profile/items/inferred`
  - `PUT /api/v1/profile/items/:id`
  - `DELETE /api/v1/profile/items/:id`
  - `POST /api/v1/profile/items/:id/restore`
  - `POST /api/v1/profile/items/:id/confirm`
  - `GET /api/v1/profile/core`
  - `POST /api/v1/profile/insight`（画像洞察查询，见下文「画像洞察查询」）
- 扩展客户端: `src/services/MemoryServiceClient.ts`
- 扩展消息入口: `src/services/UserProfileMessageHandler.ts`
- 前端页面: `src/modals/components/UserProfilePage.vue`
- 页面适配层: `src/services/userProfileViewModel.ts`

## 数据模型

后端以 `user_profile_items` 表保存画像条目。主要字段包括:

- `item_type`: `fact` / `preference` / `habit` / `interest` / `constraint`
- `item_key` 和 `item_value`: 画像条目的稳定键和值
- `confidence`: 当前可信度，也是前端重要性评分的主要来源
- `salience_score`: 召回和排序相关的重要度
- `user_confirmed`: 用户是否确认过该条目
- `status`: `active` / `pending_confirm` / `superseded` / `retracted` / `archived`
- `evidence_refs`: 支撑画像条目的证据引用

前端不再依赖旧版 `interests.projects/people/topics` 响应结构。`userProfileViewModel` 会把后端 profile items 规整成页面需要的项目、人员、主题、JIRA、技术和文档分组，并补齐统计、洞察、趋势图和空状态。后端时间戳以 Unix 秒保存，前端适配层会统一转成毫秒，避免活动趋势、最近更新时间和日均活动被错误计算。LLM、Web Intelligence 和 snooze 等自动抽取的新画像候选通过 `/profile/items/inferred` 写入，默认进入 `pending_confirm` 校准队列；只有用户确认后的 `active` 条目才会参与 `USER_CORE` 核心画像渲染、主动通知偏好匹配和外部 provider context package，人物关系也只渲染已确认的 social edge。重复推断会强化已有条目的命中次数和权重，证据引用会按来源和片段稳定去重，避免同一来源只因采集时间不同反复扩大证据覆盖率。画像证据里的来源链接只渲染可点击的 `http(s)` URL；其他协议或格式错误的链接会保留证据摘要并显示“来源链接已隐藏”原因。

### 写作风格条目

`writing_style.*` 是画像系统里专门给 Compose Assist 使用的偏好条目。它和普通用户事实不同：

- 来源不是 LLM 凭空总结，而是 Compose Assist 的 redacted diff：用户插入建议后如何改、最后是否发送、是否出现“AI 味”反馈。
- 存储的是概括规则，不是最终发送文本。例如“中文 peer 聊天可以自然用哈哈开场”“关系轻松时可偶尔用 ~”“避免夸张热情和泛泛未来承诺”。
- key 带 scope，例如 `writing_style.ringcentral.peer.casual_reply.zh`，必要时再带关系后缀，避免把和某个同事的聊天风格误用到 Jira comment 或客户回复。
- 进入 `USER_CORE.md` 时放在独立 `## Writing Style` 区域，不混进 `## Preferences` 或 `## Current Focus`。
- Compose Assist 读取时优先匹配当前输入框的 surface、受众、任务、语言和关系，只把它当表达约束；事实和内容仍必须来自当前上下文与 evidence。

写作风格可以由稳定行为证据自动晋升为 active preference，因为用户最终发送行为本身就是强确认信号；但它仍保留 evidence、confidence、scope 和状态，后续可以被校准、降权或排除。

### 语言偏好条目

`language_preference` 是画像系统里的正式用户偏好键，用来告诉后台生成型能力应该使用哪种面向用户的输出语言。

- 来源：Options 页的界面语言下拉框会立即保存到 `chrome.storage.local.personalAiUiPreferences.language`，同时通过 `/profile/items` 写入或更新 active `preference` 条目。
- 中文值：`回复和生成面向用户的内容时使用中文`。
- 英文值：`Reply and generate user-facing content in English.`。
- 影响范围：Reflection 自动生成的 Rehearsal、后续需要后台自主生成用户可读内容的能力，都应优先读取这个画像项；它不是普通 UI 翻译开关，也不改变人名、项目名、URL、Jira key 等原文。
- 更新规则：用户修改 Options 语言选项时同步更新同一个 `language_preference` 条目，不创建多条并列偏好。

### 画像洞察查询（POST /profile/insight，QW-2）

普通画像接口返回的是“条目列表”。`/profile/insight` 提供另一种读法：输入一个自然语言问题（如“怎么给他汇报方案他更买账？”），返回**合成出来的洞察**——“这个用户会怎么想 / 更偏好什么”，而不是把原始画像行贴回去。设计参考 Plastic Labs 的 Honcho dialectic API，由 `core/ProfileInsightService.ts` 实现。

- **取数**：已确认 active 画像（`renderUserCore`）+ 近期重点滚动信号（`RecentFocusService`，作为近况背景）。
- **不泄露原文**：系统提示要求 LLM 合成、不得粘贴原始证据行；返回体只含 `insight / confidence / basisCount / aspectsUsed`，不回吐 evidence 原文。
- **置信度受 basis 约束**：`basisCount` = 已确认画像条目数 + 近期“消息/反思”信号数（近期画像信号与已确认条目重叠，不重复计数）。basis < 3 时 confidence 上限 0.5，basis = 0 时直接返回 `available:false, reason:'no_profile_signal'`，不做无依据的猜测。
- **失败语义**：空问题被 schema 拦截（400）；LLM 不可用 / 无洞察时返回 `available:false` 带 `reason`，不抛错。
- **消费方**：当前内部使用（Compose Assist 的受众判断、Relationship Radar 草稿），后续接入 MCP 的 `memory_profile_hint`（见 memory-mcp-server-plan）。
- **验证**：`api-profile-insight.test.ts` 覆盖 availability 门控、不泄露原文、置信度封顶、schema 校验；洞察质量本身属低风险内部提示，不另做 golden-answer LLM eval。

## 用户可控路径

- 画像总览: 展示当前项目、人员、主题关注点。
- 首屏校准概览: 展示待确认推断、确认率、证据覆盖和最近信号，引导用户先处理最影响推荐质量的条目；点击处理、查看或核对时会显示“校准入口回执”，说明只是本地导航/筛选当前加载画像切片，不确认、降权、排除、写入 `USER_CORE`、刷新证据、导出或调用外部 provider。
- 重要性校准: 用户可以通过星级评分调整条目的 `confidence` 和 `salienceScore`，并自动确认该条目；首屏星级入口会先说明当前影响力、是否会同时确认、证据是否保留、只影响后续画像选择，以及仍然只有 `active + confirmed` 才进入个性化。星级回执会按前后权重写成“提高 / 降低 / 调整影响”，避免把 4 星这类中间值误读成降权。
- 影响力快速校准: 条目列表和待确认队列提供“设为重点 / 降低影响”路径，用低摩擦反馈调节 profile item 对个性化上下文的影响；按钮旁会先显示校准影响回执，按钮 hover / 读屏也会说明当前影响力、目标影响力、会更新 `confidence/salience`、是否同时确认条目、证据是否保留、服务确认前不能证明已写入或进入个性化，以及只有 `active + confirmed` 才进入个性化。“设为重点”和星级校准会确认条目；“降低影响”只降权，不会把未确认推断自动推进个性化上下文。确认、排除和恢复按钮也会在 hover / 读屏先说明本次会写入 `active + confirmed`、`retracted`，或按原确认状态恢复，避免把待确认项、已确认项和已排除审计混成同一种后果。点击后页面会立刻显示进行中回执，点明正在校准哪条画像、目标影响力、是否会尝试确认，以及请求完成前还不能证明已写入或进入个性化；待确认条目在服务返回前仍显示为待确认 / 确认前不使用，不能提前翻成可个性化。如果权重写入失败，会用“校准未完成”回执替换进行中状态。如果权重写入成功但确认步骤失败，页面会保留“确认未完成”回执，并提示用户可点确认重试，避免把部分成功误读成已经进入个性化。成功校准后可在回执里撤销上一次影响力调整；撤销按钮 hover / 读屏说明只把 `confidence/salience` 恢复到前值，不撤销确认状态、证据、旧回答、排除、恢复、外部同步、导出或发送内容。
- 校准操作回执: 用户确认、设为重点、降低影响、排除、恢复或手动新增画像时，页面会先显示等待服务确认的“画像校准回执”；完成后回执说明该条现在是否进入个性化上下文、证据数量/缺证状态，以及后续可恢复或继续复核的路径。失败时不会把点击误写成已确认、已排除、已恢复或已新增；服务确认前的按钮文案也不会把未确认画像说成已经进入个性化。
- 条目确认: 对推断条目执行确认，减少系统反复猜测；页面会显示处理中状态，避免重复提交。
- 条目排除: 将不准确或不希望继续影响推荐的条目标记为 retracted；页面会保留最近一次排除的撤销入口，确认条目恢复为 `active`，未确认条目恢复为 `pending_confirm`。
- 已排除条目审计: 画像条目列表可以按需加载 `status = retracted` 的已排除画像，显示来源、证据和更新时间，并允许恢复；读取中、读取成功、空快照和读取失败都会显示已排除审计回执，失败不会被误报成“暂无已排除画像”。已排除条目不会进入个性化上下文，刷新页面后仍可找回。
- 显式画像录入: 用户可以从常见画像键中选择，也可以填写自定义稳定 key，避免把项目、事实或约束误写到固定回复风格字段。提交前页面会显示“录入范围”回执，提交按钮 hover / 读屏也会说明本次会写入 active + confirmed 手动画像，服务确认前还不能证明已进入 USER_CORE、召回、Compose Assist 或 provider context；它不会外发、恢复旧画像或跨平台同步。
- 待确认推断队列: 页面把未确认条目按校准优先级完整展示，并支持按待确认、证据覆盖筛选后就地确认或排除。
- 画像条目检索: 条目列表支持按名称、键、来源、状态和证据内容搜索，按校准优先级、最近更新、置信度和证据数排序，并按状态筛出需校准、高影响、可用于个性化或缺证据的条目。页面初始只加载大列表切片时，会显示“检索范围”回执，搜索框、状态筛选、排序、清除和显示更多按钮的 hover / 读屏也会说明当前搜索/筛选只匹配已加载条目；未命中不能证明全库不存在该画像，需先“加载全部”再做完整判断。“加载全部”按钮和回执会说明它只是只读重新分页扩大本页审计范围，不会确认、排除、恢复、写入 `USER_CORE`、刷新证据、导出或调用外部 provider；失败时保留旧切片口径，不能证明全库已覆盖。该回执只说明列表显示范围，不会确认、排除或写入画像，也不限制导出重新分页拉取全部状态。
- 校准优先级: 前端会标记“优先复核 / 高影响 / 需校准 / 低风险”，并说明待确认、缺证据或多次命中等原因，帮助用户先处理最可能影响个性化质量的条目。
- 个性化边界提示: 条目列表会标出“可用于个性化”或“确认前不使用”，避免用户误以为未确认推断已经进入上下文。
- 可解释检查: 条目列表展示来源、证据数量和更新时间，推断内容带有类别和置信度；有证据的条目可以展开查看来源、URL 或片段摘要。展开证据前后都会明确这是只读审计，不会确认画像、写入 `USER_CORE`、刷新来源、同步外部平台或发送内容；不安全来源链接不会变成可点击跳转，只保留隐藏原因。
- 数据导出与大列表: 展示页默认限制拉取量以保持响应速度，列表会明确显示已加载条目数/总条目数，并允许用户主动加载全部后再搜索或筛选；导出按钮前会显示“导出前检查”，按钮 hover / 读屏也会说明当前搜索、筛选或页面加载切片不会限制导出、文件是 JSON + manifest 指纹、本次只下载本地副本、不恢复/删除/同步/发送画像，诊断失败也只写入 warning。点击导出后页面会先显示“正在准备画像导出”回执，说明正在重新分页请求 `status=all`、下载尚未开始、manifest ID 尚未生成，且本轮导出单飞中，重复点击不会启动第二次分页、生成第二个 manifest 或请求第二次下载。导出路径会以 `status=all` 继续分页，确保 active、pending、retracted、archived、superseded 等画像状态都写入 JSON，并在 `exportInfo.pagination` 中记录导出条目数、总条目数、状态范围和是否截断，便于迁移、备份和审计。导出 JSON 还会写入 `profileAudit`，总结已确认、待确认、可用于个性化、确认前保留、已排除/归档审计项、缺证据以及状态/类型/来源分布；`/health` 或 `/stats` 这类诊断接口临时失败时不阻断导出，而是在 `exportInfo.warnings` 和 optional section 可用性里说明缺失。下载文件自带 `exportInfo.manifest`，记录导出 scope、分页、诊断 warning、迁移/恢复边界，以及 profile items、USER_CORE 和审计摘要的 SHA-256 指纹；页面回执显示短指纹和 `manifestId`，方便用户把下载文件和当次导出对上。文件生成并交给浏览器下载后，页面保留“画像导出回执”，说明文件名、完整性、可个性化/确认前保留/非活跃审计数量、诊断 warning、浏览器下载已请求但磁盘保存未校验，以及本地 JSON 不会自动恢复、删除、同步或发送画像；如果诊断接口缺失，回执会明确画像条目只是写入本地导出 JSON，不代表 Memory Service 被改写。导出失败时页面会保留“画像导出未完成”回执，说明本次没有生成新 JSON、manifest ID 或下载请求，旧成功文件不能证明本次成功，且失败不会恢复、删除、同步、发送画像或改写 Memory Service。下一次导出开始会清空上一轮成功/失败回执，避免旧结果和本次状态混在一起。
- 高级设置: 目前保存权重衰变配置；后端实际衰变策略仍由 memory-service 统一管理。

## 设计原则

- 显式反馈优先于隐式推断，但两者都应保留证据。
- 用户必须能看见、确认、降低或排除影响推荐的画像条目。
- 个性化注入和跨产品投递必须同时满足 `status = active` 与 `user_confirmed = 1`，不能只看 active 状态。
- `writing_style.*` 只能影响表达方式，不能把关系、项目、事实或敏感信息带入回复。
- 页面应展示真实 profile items，不使用 mock 数据伪装画像成熟度。
- 空状态和服务失败状态必须可渲染，不能阻塞用户继续使用记忆系统。
- 证据链接是审计入口，不是执行入口；页面只允许 `http(s)` 跳转，并要把被隐藏的链接原因展示出来。
- 英文分类匹配按 token 处理，避免 `personal`、`report` 等词误触发人员或项目分类。
- 软删除路径必须可恢复，尤其是单击“排除”这类高影响操作。
- 临时撤销之外还要保留可回访的排除审计入口，避免用户刷新页面后无法纠正误排除。
- 画像文案保持概括，不在文档中复制过细的 UI 或算法实现。

## 业内参照

- [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-in-chatgpt-remembering-what-you-chat-about)、[ChatGPT 数据导出](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)、[Claude 数据导出](https://support.anthropic.com/en/articles/9450526-how-can-i-export-my-claude-ai-data)、[Claude 记忆导入/导出](https://support.anthropic.com/en/articles/11817273-using-claude-s-chat-search-and-memory-to-build-on-previous-context)、[Google Takeout](https://support.google.com/accounts/answer/3024190?hl=en) 和 [Gemini Saved info](https://support.google.com/gemini/answer/15637730?hl=en-IN&ref_topic=13194540) 都强调用户能查看、编辑、删除、导出或迁移自己的数据；Personal AI 的画像页应优先暴露确认、排除、证据和导出路径。
- Claude 和 Gemini 都引入了项目/企业边界或数据源边界；Personal AI 的 `pending_confirm` 条目不应在确认前进入核心画像投影。
- ChatGPT 的记忆管理正在强化搜索、排序、优先/降权和历史恢复；Personal AI 应继续把校准队列作为首屏任务，并让完整条目列表可检索、可排序、可增量浏览，而不是只展示少量高分推断。
- ChatGPT Memory Sources 和 Claude 的 “View and edit your memory” 都把来源检查、修正/删除和恢复/导出放在用户可见路径里；Personal AI 现在把 retracted 画像也纳入页面内审计与恢复，而不是只依赖操作后的瞬时 toast。
- Claude 已支持记忆导入/导出和项目级记忆边界；Personal AI 的导出必须避免被后端单页上限截断，也不能把已排除或归档画像从审计包里静默丢掉，后续可补充导入和按项目/场景分区。
- [Claude Managed Agents memory](https://claude.com/blog/claude-managed-agents-memory) 的文件式记忆、权限和审计日志说明，生产级记忆系统需要可导出、可回滚、可追溯；Personal AI 的画像导出因此应包含分页完整性元数据，而不是只生成当前页面看到的列表。
- OpenAI 数据导出、Claude memory 导入/导出和 Google Takeout 都把下载副本、迁移/导入、删除和账户边界分开处理；Personal AI 的导出 manifest 因此只证明“这次导出了什么”，不默认授权导入、恢复、删除或外部同步。
- GDPR Article 20 与数据可迁移研究都强调结构化、常用、机器可读格式；AI memory portability 讨论进一步提醒记忆迁移需要 provenance、完整性和权限边界，所以导出前检查单应先把格式、指纹和副作用边界讲清楚。
- 数据可迁移和审计型记忆产品不应让辅助诊断阻塞用户拿回自己的画像数据；Personal AI 当前把画像条目导出作为核心路径，把系统健康和实体统计降级为可缺失的诊断段，并在导出文件和页面提示中保留 warning。
- 近期用户画像与记忆选择研究显示，画像进入上下文不能只靠相似度；应结合证据强度、用户确认、响应收益和场景边界选择要注入的 profile items。
- 2026 年的 [Response-Aware User Memory Selection](https://www.microsoft.com/en-us/research/publication/response-aware-user-memory-selection-for-llm-personalization/) 研究进一步说明，记忆候选应按对响应质量的实际效用筛选，而不是把所有相似画像都塞进 prompt；Personal AI 当前先以“确认前不使用”作为安全边界，后续可继续加入响应收益评分。
- [MemFlow](https://arxiv.org/abs/2605.03312) 把 profile lookup、targeted retrieval 和 deep reasoning 分层路由，提示 Personal AI 后续可以按使用场景选择画像证据预算，而不是在所有入口使用同一组画像条目。
- [Mem0](https://arxiv.org/abs/2504.19413) 和 [MemoryBank](https://arxiv.org/abs/2305.10250) 都强调选择性提炼、强化和遗忘；Personal AI 的 UI 因此不能把“当前只加载的切片”伪装成完整画像，否则用户会误校准一个不完整视图。

## 验证

相关变更至少运行:

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts
npm --prefix memory-service test -- --run src/__tests__/api-profile.test.ts src/__tests__/api-ingest-profile.test.ts
node tools/verify-user-profile-export-e2e.mjs
npm start
```

`npm start` 使用开发环境编译，首次成功输出后即可停止 watch 进程。

`tools/verify-user-profile-export-e2e.mjs` 覆盖画像导出、显式录入、快速影响力校准按钮边界、进行中回执、失败回执、部分确认失败、撤销影响力、排除/恢复路径，以及搜索/筛选/排序/加载/导出/录入控制点的 hover 与读屏边界。
