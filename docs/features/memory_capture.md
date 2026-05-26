# Memory Capture / 记忆捕捉

*最后更新: 2026-05-26*

## 是什么

Memory Capture 是 Personal AI 的低打扰资料入库层。它负责把用户真正关注的网页、选中文本、用户对外输入、会议资料、AI 工具资料等捕捉成可追溯的长期记忆。

用户看到的简单表达是：

> 重要内容自动记住；不确定但可能重要的内容给一个很小的 `+`；用户主动选中内容时可以一键记住。

当前 P0 已落地的是 **选中文字保存**、**整页资料保存**、**Jira owner comment 自动捕捉** 和 **source memory 召回**：

- 用户在非敏感网页选中文字。
- 内容脚本先用现有 Selection Memory Search 查关联记忆，同时调用 Memory Capture 候选评分。Memory Capture 有独立的选区信息量判断，不再被 Memory Lens 的只读展示门槛拦掉。
- 如果选区有足够信息量且不含 secret/token/password 等风险，页面最右侧、与选区同高度显示一个半露出的 `+`；hover / focus 后展开为 `+ 入库`，右侧带 Personal AI logo。
- 划词关联记忆的 Personal AI icon 仍留在选区旁，只负责打开 Memory Lens 结果；入库入口与它分离，避免两个能力在同一个 button bar 里互相抢注意力。
- 点击 `+ 入库` 后可输入可选备注，确认后保存为 `source_memory_capsule`；如果在备注框按取消，不会保存，入口会保留。
- 页面有复制、深度滚动或足够停留等用户意图信号时，页面接近右上角显示同样的右侧半露出 `+ 入库`，点击后保存整页正文为 `webpage` capsule。
- 当整页候选达到更高置信度时会自动入库：例如复制页面内容且阅读到较深位置、浏览时间较久且阅读较深、或浏览时间非常久。自动入库不弹确认框，只在右上角显示 5 秒轻提示；默认只显示 Personal AI logo 和 `已存入记忆`，hover / focus 后展开显示原因和 `撤销` 按钮。用户 hover / focus 在提示上时暂停消失计时，移开或失焦后重新开始 5 秒倒计时。
- 已有 Jira owner-authored learning 信号会继续写入原 ingest，同时自动生成 `jira_comment` capsule，作为用户对外输入的资料记忆。
- 后端同时写入 `messages_raw.source_type='web'` 和 `chunks.source_type='web'`，让 Coverage Map、搜索和后续召回能看见这条网页记忆信号。
- `/context-recall` 支持 `sourceTypes: ['source_memory']`，返回专门的 `source_memory` 资料记忆卡。

## 产品边界

Memory Capture 负责：

- 判断网页/选区/外部输入是否值得入库。
- 执行自动入库、建议入库和用户主动入库。
- 保存 source capsule、source anchors、takeaways、future triggers 和行为事件。
- 把已保存资料写成 `web` 来源记忆信号，保持 Memory Service 现有搜索、覆盖地图和召回链路可用。

Memory Capture 不负责：

- 不展示“你以前见过什么”。这是 [Memory Lens](./memory_lens.md) 的职责。
- 不把普通浏览历史全量保存。
- 不把“看过网页”直接推断成用户偏好或 confirmed profile。
- 不做校准平台。保存、忽略、打开、引用等行为可以被 Ambient Calibration 消费，但校准层是横切反馈层。

## 授权分层

| 层级 | 用户体验 | 当前状态 |
|---|---|---|
| 自动入库 | 可信来源 + 强意图行为时后台保存，不弹大面板；右上角 5 秒 compact toast 默认只显示 logo + `已存入记忆`，hover 后显示原因和撤销 | P0 已用于 Jira owner comment 和高置信整页网页 |
| 建议入库 | 强信号但不确定时显示很小的右侧半露出 `+ 入库` | P0 已用于选中文本和整页资料 |
| 主动入库 | 用户选中文本或当前页面后点击 `+`，可加备注保存 | P0 已实现 |

## 入库触发逻辑

选中文本不会每次都出现入库入口。当前必须同时满足这些条件：

- 页面不是 incognito、敏感 URL，也没有可见的 password / token / MFA / 支付等敏感输入控件。
- 选区不在输入框、textarea、contenteditable 或 Personal AI 自己的浮层里。
- 选中文本通过本地信息量判断：去掉空白和 UI 壳文本后，至少约 28 个有效字符或 10 个中文字符；不能像 Memory Lens 自己的展示卡片；不能包含 secret、token、password、银行卡号等敏感模式。
- 文本还要有明确语义：命中具体项目 / 任务 / 技术 / 数字等信号，或至少 5 个有意义 token，或中文信息量足够。
- 后端候选评分必须达到建议阈值。评分会叠加来源 URL、标题、来源类型、文本长度、选中、复制、停留、滚动、重复访问、用户对外输入、实体线索等；命中敏感 URL 或 secret 会直接 blocked。

是否必须点 `+`：

- 选中文本：当前必须点右侧半露出 `+ 入库`，不会因为划词自动写入。
- 整页网页：不一定必须点 `+`。普通强信号只显示右侧半露出 `+ 入库`；达到自动阈值时直接保存，并在右上角显示 compact 轻提示。默认态只显示 logo + `已存入记忆`；hover / focus 后展开“因为 xxx，本网页信息已自动存入记忆库”和 `撤销`，撤销会把 capsule 标记为 dismissed。提示在 hover / focus 期间不会消失，移开后再等 5 秒消失。
- Jira owner comment：已有 owner-authored learning 信号会自动写入 `jira_comment` capsule，不需要点 `+`。
- 后端评分已经能返回 `auto_save`、`suggest`、`ignore`、`blocked`。P0 前端对选区仍采用“强信号才提示、用户确认才保存”；整页网页只有达到更高置信度时才自动保存，避免把普通浏览史或误选文本静默入库。

整页自动入库的前端阈值：

- 页面正文至少约 `260` 词。短页面、目录页、搜索结果页即使被后端评为高分候选，也不会整页自动入库。
- `copiedText = true` 且 `dwellMs >= 90s` 且 `scrollDepth >= 0.85` 且候选分 `score >= 0.70`：复制过页面内容、停留较久并读到很深位置。
- `dwellMs >= 240s` 且 `scrollDepth >= 0.90` 且候选分 `score >= 0.58`：浏览时间很久且阅读到页面深处。
- `dwellMs >= 480s` 且 `scrollDepth >= 0.75` 且候选分 `score >= 0.58`：在当前页面停留非常久。

后端 `auto_save` 只表示候选评分高，不会单独触发整页自动入库；前端仍必须满足上面的正文长度、停留时间和阅读深度门槛。这样保留“无打扰保存”的能力，但把普通浏览、快速复制、浅滚动这类信号降为右侧 `+ 入库` 建议或完全安静。

存储层区分主动和自动：

- `source_memory_capsules.capture_mode` 保存 `manual` / `auto` / `suggested`，并有 `idx_source_memory_capsules_capture_mode_saved` 索引，后续可以直接统计自动入库占比。
- `source_memory_events.metadata_json.captureMode` 记录每次 save / resave / duplicate / dismiss 事件的来源模式。
- 主动入库的 `messages_raw.importance` / `memory_metadata.importance` 高于自动入库。当前权重：`manual = 0.72`，`suggested = 0.64`，`auto = 0.58`；chunk 权重在 message 权重基础上略低。

候选评分会参考：

- 来源 URL、标题、来源类型。
- 文本长度和信息量。
- 是否选中、复制、停留、滚动、重复访问。
- 是否是用户对外输入。
- 是否有实体线索。
- 是否命中敏感 URL 或 secret/token/password。

## 数据模型

| 表 | 用途 |
|---|---|
| `source_memory_capsules` | 资料记忆主对象，保存来源、标题、fingerprint、状态、摘要、capture reason |
| `source_memory_anchors` | 原文证据锚点，当前 P0 是 text selection/page excerpt |
| `source_memory_takeaways` | 从证据中提取的初始 takeaways，默认 draft，不等于 confirmed fact |
| `source_memory_triggers` | 未来触发线索，例如 host、实体、标题搜索 |
| `source_memory_links` | 未来用于连接 project/message/meeting/skill 等对象 |
| `source_memory_events` | 保存、重复保存、dismiss 等行为事件，可供无感校准层消费 |
| `messages_raw` / `chunks` | 兼容现有 Memory Service 的 `web` 来源检索和覆盖信号 |

DB 是运行时真源；Markdown 只作为 daily/source snapshot。

## API

| API | 用途 |
|---|---|
| `POST /api/v1/source-memory/candidates/score` | 通用候选评分 |
| `POST /api/v1/source-memory/candidates/selection` | 选中文本候选评分，默认带 selectedText 信号 |
| `POST /api/v1/source-memory/capsules` | 保存 source memory capsule，并写入 `web` 记忆信号 |
| `GET /api/v1/source-memory/capsules/:id` | 读取资料记忆详情 |
| `POST /api/v1/source-memory/capsules/:id/dismiss` | 标记资料记忆为 dismissed |

## 代码入口

- Backend service: `memory-service/src/core/SourceMemoryCaptureService.ts`
- Backend route: `memory-service/src/routes/sourceMemory.ts`
- Migration: `memory-service/src/storage/migrations/029_memory_capture.sql`
- Extension client: `src/services/MemoryServiceClient.ts`
- Background bridge: `src/background.ts`
- Selection UI: `src/contentScriptWebIntelligence.ts`
- Context Recall source card: `memory-service/src/core/ContextRecallService.ts`

## 后续实现顺序

1. 页级自动捕捉：当前已接入停留时间、滚动深度、复制信号和低打扰建议保存；后续再接 active tab、重复访问、白名单来源和设置项控制的强兴趣自动保存。
2. 用户对外输入自动入库：Jira owner comment 已接入；RingCentral reply、Web AI prompt 等 owner-authored 内容待统一归入 Memory Capture。
3. Context Recall source memory：基础 source memory card 已实现；后续补 Memory Exploring 中的 capsule 深链页面。
4. 深度蒸馏：后台异步补全实体链接、open questions、skill candidate、future triggers。
5. Coverage Map 增强：展示 capsule 数、自动/主动入库比例、最近保存来源和阻断原因。

## 参考与产品判断

- [Notion Web Clipper](https://www.notion.com/en-US/web-clipper)、[Readwise Reader extension](https://docs.readwise.io/reader/docs/saving-content) 和 [Hypothesis](https://web.hypothes.is/) 都把网页保存、划词高亮/注释做成明确的用户动作，并允许附加备注或私有/群组语境；Memory Capture 的 `+` 应保持同样的“确认才写入”语义。
- PIM 研究（[Keeping Found Things Found on the Web](https://www.microsoft.com/en-us/research/publication/keeping-found-things-found-web/)、[Personal Information Management](https://arxiv.org/abs/2107.03291)）强调用户保存网页资料时通常需要保留“当时为什么重要”的上下文。备注是这个上下文的一部分，所以取消备注框应被视为取消保存，而不是静默保存空备注。
- 2026-05-26 检查结果：本机 Reminders 没有 `Personal AI` 列表，本轮没有 Reminder 条目可合并或完成。

## 验证建议

```bash
npm --prefix memory-service test -- --run src/__tests__/api-source-memory.test.ts src/__tests__/api-coverage.test.ts
npm --prefix memory-service run build
npm run verify:webpage-memory-detection
npm start
```

`npm start` 是 webpack watch，需要等首次 successful compile 后停止。
