# 用户画像系统

更新日期: 2026-05-08

## 功能概述

用户画像系统把用户的长期事实、偏好、习惯、兴趣和约束保存为可检查、可导出、可校准的 profile items。它用于增强 Web Intelligence、记忆召回、个性化提示词和主动推荐，但不会把前端展示层当作画像数据源。

## 当前实现

- 后端数据源: `memory-service/src/routes/profile.ts`
  - `GET /api/v1/profile/items`
  - `POST /api/v1/profile/items`
  - `POST /api/v1/profile/items/inferred`
  - `PUT /api/v1/profile/items/:id`
  - `DELETE /api/v1/profile/items/:id`
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

前端不再依赖旧版 `interests.projects/people/topics` 响应结构。`userProfileViewModel` 会把后端 profile items 规整成页面需要的项目、人员、主题、JIRA、技术和文档分组，并补齐统计、洞察、趋势图和空状态。后端时间戳以 Unix 秒保存，前端适配层会统一转成毫秒，避免活动趋势、最近更新时间和日均活动被错误计算。LLM、Web Intelligence 和 snooze 等自动抽取的新画像候选通过 `/profile/items/inferred` 写入，默认进入 `pending_confirm` 校准队列；只有用户确认后的 `active` 条目才会参与 `USER_CORE` 核心画像渲染。重复推断会强化已有条目的证据、命中次数和权重，而不是制造重复项。

## 用户可控路径

- 画像总览: 展示当前项目、人员、主题关注点。
- 首屏校准概览: 展示待确认推断、确认率、证据覆盖和最近信号，引导用户先处理最影响推荐质量的条目。
- 重要性校准: 用户可以通过星级评分调整条目的 `confidence` 和 `salienceScore`，并自动确认该条目。
- 条目确认: 对推断条目执行确认，减少系统反复猜测；页面会显示处理中状态，避免重复提交。
- 条目排除: 将不准确或不希望继续影响推荐的条目标记为 retracted。
- 待确认推断队列: 页面把 `pending_confirm` 条目优先展示在前段，并支持就地确认或排除。
- 个性化边界提示: 条目列表会标出“可用于个性化”或“确认前不使用”，避免用户误以为未确认推断已经进入上下文。
- 可解释检查: 条目列表展示来源、证据数量和更新时间，推断内容带有类别和置信度。
- 数据导出: 导出完整画像、系统状态和摘要，便于检查和备份。
- 高级设置: 目前保存权重衰变配置；后端实际衰变策略仍由 memory-service 统一管理。

## 设计原则

- 显式反馈优先于隐式推断，但两者都应保留证据。
- 用户必须能看见、确认、降低或排除影响推荐的画像条目。
- 页面应展示真实 profile items，不使用 mock 数据伪装画像成熟度。
- 空状态和服务失败状态必须可渲染，不能阻塞用户继续使用记忆系统。
- 英文分类匹配按 token 处理，避免 `personal`、`report` 等词误触发人员或项目分类。
- 画像文案保持概括，不在文档中复制过细的 UI 或算法实现。

## 业内参照

- ChatGPT、Claude 和 Gemini 的记忆/画像能力都强调用户能查看、编辑、删除或关闭记忆；Personal AI 的画像页应优先暴露确认、排除、证据和导出路径。
- Claude 和 Gemini 都引入了项目/企业边界或数据源边界；Personal AI 的 `pending_confirm` 条目不应在确认前进入核心画像投影。
- 近期用户画像与记忆选择研究显示，画像进入上下文不能只靠相似度；应结合证据强度、用户确认、响应收益和场景边界选择要注入的 profile items。
- 2026 年的 response-aware memory selection 研究进一步说明，记忆候选应按对响应质量的实际效用筛选，而不是把所有相似画像都塞进 prompt；Personal AI 当前先以“确认前不使用”作为安全边界，后续可继续加入响应收益评分。

## 验证

相关变更至少运行:

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-user-profile-system.ts
npm --prefix memory-service test -- --run src/__tests__/api-profile.test.ts src/__tests__/api-ingest-profile.test.ts
npm start
```

`npm start` 使用开发环境编译，首次成功输出后即可停止 watch 进程。
