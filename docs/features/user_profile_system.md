# 用户画像系统

更新日期: 2026-05-22

## 功能概述

用户画像系统把用户的长期事实、偏好、习惯、兴趣和约束保存为可检查、可导出、可校准的 profile items。它用于增强 Web Intelligence、记忆召回、个性化提示词和主动推荐，但不会把前端展示层当作画像数据源。

## 大白话运行逻辑

用户画像系统把“系统以为了解你的内容”变成可检查的条目。自动推断会先进入待确认，用户确认后才真正参与核心画像、个性化注入和跨平台上下文。

结果主要受这些因素影响：

1. 用户确认状态：`user_confirmed = 1` 且 `status = active` 的条目才应进入核心画像和外部 provider context。
2. 证据质量：有明确 evidence refs、多次稳定命中和来源片段的画像更值得信任。
3. 重要性反馈：用户调高/调低影响力会改变 `confidence` 和 `salience_score`，进而影响排序和召回。
4. 状态生命周期：pending、active、retracted、archived、superseded 的边界决定条目是否展示、是否使用、是否可恢复。
5. 页面适配层：前端只是把 profile items 分组展示，不应把 mock 或展示派生数据当成画像真源。

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

前端不再依赖旧版 `interests.projects/people/topics` 响应结构。`userProfileViewModel` 会把后端 profile items 规整成页面需要的项目、人员、主题、JIRA、技术和文档分组，并补齐统计、洞察、趋势图和空状态。后端时间戳以 Unix 秒保存，前端适配层会统一转成毫秒，避免活动趋势、最近更新时间和日均活动被错误计算。LLM、Web Intelligence 和 snooze 等自动抽取的新画像候选通过 `/profile/items/inferred` 写入，默认进入 `pending_confirm` 校准队列；只有用户确认后的 `active` 条目才会参与 `USER_CORE` 核心画像渲染、主动通知偏好匹配和外部 provider context package，人物关系也只渲染已确认的 social edge。重复推断会强化已有条目的命中次数和权重，证据引用会按来源和片段稳定去重，避免同一来源只因采集时间不同反复扩大证据覆盖率。

## 用户可控路径

- 画像总览: 展示当前项目、人员、主题关注点。
- 首屏校准概览: 展示待确认推断、确认率、证据覆盖和最近信号，引导用户先处理最影响推荐质量的条目。
- 重要性校准: 用户可以通过星级评分调整条目的 `confidence` 和 `salienceScore`，并自动确认该条目。
- 影响力快速校准: 条目列表和待确认队列提供“设为重点 / 降低影响”路径，用低摩擦反馈调节 profile item 对个性化上下文的影响。
- 条目确认: 对推断条目执行确认，减少系统反复猜测；页面会显示处理中状态，避免重复提交。
- 条目排除: 将不准确或不希望继续影响推荐的条目标记为 retracted；页面会保留最近一次排除的撤销入口，确认条目恢复为 `active`，未确认条目恢复为 `pending_confirm`。
- 显式画像录入: 用户可以从常见画像键中选择，也可以填写自定义稳定 key，避免把项目、事实或约束误写到固定回复风格字段。
- 待确认推断队列: 页面把未确认条目按校准优先级完整展示，并支持按待确认、证据覆盖筛选后就地确认或排除。
- 画像条目检索: 条目列表支持按名称、键、来源、状态和证据内容搜索，按校准优先级、最近更新、置信度和证据数排序，并按状态筛出需校准、高影响、可用于个性化或缺证据的条目。
- 校准优先级: 前端会标记“优先复核 / 高影响 / 需校准 / 低风险”，并说明待确认、缺证据或多次命中等原因，帮助用户先处理最可能影响个性化质量的条目。
- 个性化边界提示: 条目列表会标出“可用于个性化”或“确认前不使用”，避免用户误以为未确认推断已经进入上下文。
- 可解释检查: 条目列表展示来源、证据数量和更新时间，推断内容带有类别和置信度；有证据的条目可以展开查看来源、URL 或片段摘要。
- 数据导出与大列表: 展示页默认限制拉取量以保持响应速度，列表会明确显示已加载条目数/总条目数，并允许用户主动加载全部后再搜索或筛选；导出路径会继续分页直到后端返回的画像条目全部写入 JSON，并在 `exportInfo.pagination` 中记录导出条目数、总条目数和是否截断，便于迁移、备份和审计。导出 JSON 还会写入 `profileAudit`，总结已确认、待确认、可用于个性化、确认前保留、缺证据以及状态/类型/来源分布；`/health` 或 `/stats` 这类诊断接口临时失败时不阻断导出，而是在 `exportInfo.warnings` 和 optional section 可用性里说明缺失。
- 高级设置: 目前保存权重衰变配置；后端实际衰变策略仍由 memory-service 统一管理。

## 设计原则

- 显式反馈优先于隐式推断，但两者都应保留证据。
- 用户必须能看见、确认、降低或排除影响推荐的画像条目。
- 个性化注入和跨产品投递必须同时满足 `status = active` 与 `user_confirmed = 1`，不能只看 active 状态。
- 页面应展示真实 profile items，不使用 mock 数据伪装画像成熟度。
- 空状态和服务失败状态必须可渲染，不能阻塞用户继续使用记忆系统。
- 英文分类匹配按 token 处理，避免 `personal`、`report` 等词误触发人员或项目分类。
- 软删除路径必须可恢复，尤其是单击“排除”这类高影响操作。
- 画像文案保持概括，不在文档中复制过细的 UI 或算法实现。

## 业内参照

- [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-in-chatgpt-remembering-what-you-chat-about)、[Claude memory import/export](https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude) 和 [Gemini Saved info](https://support.google.com/gemini/answer/15637730?hl=en-IN&ref_topic=13194540) 都强调用户能查看、编辑、删除或关闭记忆；Personal AI 的画像页应优先暴露确认、排除、证据和导出路径。
- Claude 和 Gemini 都引入了项目/企业边界或数据源边界；Personal AI 的 `pending_confirm` 条目不应在确认前进入核心画像投影。
- ChatGPT 的记忆管理正在强化搜索、排序、优先/降权和历史恢复；Personal AI 应继续把校准队列作为首屏任务，并让完整条目列表可检索、可排序、可增量浏览，而不是只展示少量高分推断。
- Claude 已支持记忆导入/导出和项目级记忆边界；Personal AI 的导出必须避免被后端单页上限截断，后续可补充导入和按项目/场景分区。
- [Claude Managed Agents memory](https://claude.com/blog/claude-managed-agents-memory) 的文件式记忆、权限和审计日志说明，生产级记忆系统需要可导出、可回滚、可追溯；Personal AI 的画像导出因此应包含分页完整性元数据，而不是只生成当前页面看到的列表。
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
