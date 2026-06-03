# Rehearsal（场景预演）

_最后更新: 2026-05-30_

## 定位

Rehearsal 是 Personal AI 的未来场景预演记忆层。它保存的是“如果未来遇到某个场景，我应该想起、说或做什么”，而不是事实本身。

它不替代 Reflection 或 Dream：

| 系统 | 处理的信息 | 主要产出 | 消费方 |
|---|---|---|---|
| Reflection | 真实证据、开放问题、动作结果 | 反思线程、确认请求、动作、`rehearsal_candidate` | Action Queue、Decision Center、Today Pilot、Rehearsal |
| Dream | 长期记忆的低置信联想和弱关联 | dream run、洞察、风险、弱线索 | Reflection，不直接进现场提示 |
| Rehearsal | 可执行的未来场景脚本和稳定触发线索 | active/candidate/stale 预演提示 | `/context-recall`、Compose Assist、Today Pilot、Meeting Pilot、Memory Lens |

大白话说：Reflection 负责“从已经发生的事里复盘出结论”，Dream 负责“从长期记忆里试探弱关联”，Rehearsal 负责“把未来某个场景里该怎么做保存成可触发脚本”。

## 大白话运行逻辑

Rehearsal 的主入口不是管理页，而是具体场景：

- 打开 Colin Liu 的 RingCentral 聊天窗口时，Compose Assist 可以看到“下次和 Colin 聊天记得提 xxx”。
- 今天有包含 Colin 的会议时，Today Pilot / Meeting prep 可以把这条提示提前放进 cue card。
- 浏览 Jira issue、网页或消息会话时，Memory Lens 可以低打扰提示“这里命中了一条预演提醒”。
- 面对面场景目前无法实时投射到用户眼前，因此只能通过 Today Pilot、popup、人物页或日历相关卡片提前提醒。

### 核心边界：未来可识别场景

Rehearsal 不是无限制的“随便想一想”，也不是普通事实记忆。它只保存这种形态的内容：**以后遇到某个可识别场景时，我应该想起、说或做什么**。

一条合格的 Rehearsal 至少要同时回答三个问题：

- 未来什么时候会触发：例如某个人、某个群组、某个会议、某个 Jira issue、某个项目、某类问题、某个网页或某个写作 surface。
- 到时候要带入什么：例如要提醒用户提一件事、采用某个回答思路、避免重复踩坑、先确认某个风险或把某个观点带进会议。
- 什么时候不要打扰：例如过期、长期没命中、用户标记不相关、只有弱联想、缺少稳定触发线索，或只是在记录一个已发生事实。

因此 Rehearsal 的场景类型是开放的，不限于会议；但每条预演都必须有“未来场景边界”。典型例子包括：

- 下次和 Colin Liu 聊天时，记得提某个未闭环问题。
- 下次包含 Colin Liu 的会议里，记得先问某个风险是否已经解决。
- 下次有人问某个项目为什么延迟时，回答思路按背景、阻塞、下一步三段走。
- 下次打开某个 Jira issue 或项目页面时，提醒用户已有一个重要结论，不要从头判断。
- 下次在 AI 工具里写某类 prompt 时，提醒用户使用某个表达模板或安全边界。

以下内容不应该直接变成 Rehearsal：

- “已经发生了什么”或“某个字段是什么”：这是普通记忆或 Reflection 证据。
- “我隐约觉得 A 和 B 可能有关”：这是 Dream 或 Reflection 的弱线索。
- “某件事要做但没有未来触发场景”：更像 Action Queue、Reminder 或 Today Pilot 任务。
- “用户长期偏好某种表达方式”：更像 User Profile 或 Personal Skill。

匹配不会只靠向量相似。`RehearsalActivationService` 会同时看人物、项目、群组、会话、日历、issue、URL、surface、主题、时间窗口、置信度、陈旧度和负反馈。

默认展示阈值：

| 分数 | 行为 |
|---|---|
| `>= 0.82` | 高置信候选可自动转为 active |
| `>= 0.72` | 现场强提示，`displayPriority=p1` |
| `>= 0.55` | 弱提示或用户主动展开，`displayPriority=p2` |
| `< 0.55` | 隐藏 |

## 产生入口

Rehearsal 自身是“保存、管理、匹配、反馈”的场景预演层，不独立凭空产生预演内容。预演内容由其他系统或用户入口创建，然后交给 `RehearsalService` 管理生命周期。创建时的首要判断不是“这件事重要不重要”，而是“未来是否能识别出该在什么时候提醒用户”。

当前已接入的产生入口：

- 手动或外部 API 创建：`POST /api/v1/rehearsals`，适合用户明确写下“下次遇到 X 时提醒我 Y”。
- Reflection 自动候选：`ReflectionWorker` 可以在反思真实证据时输出 `rehearsalCandidates`；`ReflectionThreadService.runReflection()` 会写入 `rehearsals`，来源标记为 `source_kind='reflection'`，并把 `reflection_thread:{id}`、`reflection_run:{id}` 和相关证据放入 `evidence_refs_json`。如果 Reflection 只是复盘事实、追踪 Jira 字段或继续观察状态，而没有“未来遇到 X 时应该 Y”的场景脚本，就不应勉强生成 Rehearsal。
- Reflection 线程来源：高重要消息、确认请求、实体事实变化、用户画像变化、动作结果、Dream run 形成的反思线程，都可能在后续 Reflection run 中产出候选。

当前明确不做的入口：

- Dream 不直接创建 active Rehearsal。Dream 的弱联想只能先进入 Reflection 或其他验证流程。
- Compose Assist、Meeting Pilot、Today Pilot、Memory Lens 默认只消费和反馈 Rehearsal，不在现场直接新建预演。
- `RehearsalActivationService` 只负责场景命中，不负责生成新内容。

Reflection 自动候选的去重规则：同一 reflection thread 下，场景类型和触发线索相同的候选会复用同一个 `source_ref_id`，再次生成时更新现有 Rehearsal，而不是重复创建。高置信且有稳定触发线索的候选会自动成为 `active`；否则保留为 `candidate`。

## 数据模型

### `rehearsals`

保存预演记忆本体：

- 标题、场景类型、状态、摘要、建议内容。
- `activation_cues_json`：人物、项目、主题、关键词、群组、会话、会议、日历、issue、URL、surface。
- `evidence_refs_json`：来源证据引用。
- `source_kind` / `source_ref_id`：来自 manual、reflection、dream hint 等来源。
- `confidence`、`priority`、`valid_from`、`valid_until`。
- `activation_count`、`used_count`、`dismissed_count`、最近触发和使用时间。
- `stale_reason` 与 `markdown_path`。

### `rehearsal_activations`

保存每次命中和反馈：

- 命中的 surface、context type、scene key。
- 匹配分数、展示优先级、命中的 cue。
- `matched / shown / accepted / dismissed / used / irrelevant` 等 outcome。
- 触发和反馈时间。

### Markdown 快照

每条 Rehearsal 会写入用户目录下的 `rehearsals/{id}.md`，用于可读审计、导出和长期备份。SQLite 是运行态事实源，Markdown 是审计快照。

## 生命周期

状态：

- `candidate`
- `active`
- `paused`
- `used`
- `stale`
- `archived`
- `dismissed`

策略：

- 高置信且有稳定触发线索的 candidate 可以自动 active。
- 过期或 30 天未触发会进入 aging 降权。
- 90 天未触发且无强硬线索会进入 stale。
- stale 默认不自动弹出；如果精确命中人物、会议、issue 等强线索，仍可作为弱提示。
- 用户在管理页手动重新激活 stale / paused / dismissed / candidate 时，会清除降权原因；如果是有效期过期导致 stale，会同步清除过期时间，避免恢复后立刻又被生命周期任务打回 stale。
- 物理删除只由用户手动触发或未来隐私清理策略触发；默认归档或降权保留。
- 用户标记 `used` 会增加使用计数并可回流 Reflection；多次成功的 Rehearsal 后续可晋升为 Personal Skill。

Reflection / Dream 的生命周期也遵守同一原则：旧反思线程无新证据、无 pending action、无开放问题时不再进入 Today Pilot；旧 dream 保留审计，但不能直接进入现场提示，只能作为 Reflection 的弱线索。

## API

| 操作 | 端点 | 说明 |
|---|---|---|
| 列表 | `GET /api/v1/rehearsals` | 支持 `status`、`search`、`limit`、`offset` |
| 创建 | `POST /api/v1/rehearsals` | 创建 candidate 或 active Rehearsal |
| 详情 | `GET /api/v1/rehearsals/:id` | 返回本体与最近 activation |
| 更新 | `PATCH /api/v1/rehearsals/:id` | 更新状态、内容、触发线索、有效期等 |
| 归档 | `DELETE /api/v1/rehearsals/:id` | 软删除为 `archived` |
| 反馈 | `POST /api/v1/rehearsals/:id/feedback` | 记录 used、dismissed、irrelevant 等反馈 |

`POST /api/v1/context-recall` 会在 `sourceTypes` 包含 `rehearsal` 时合并 Rehearsal activation 结果，统一返回 `ContextRecallMatch`：

- `type='rehearsal'`
- `sourceType='rehearsal'`
- `evidenceRole='rehearsal_cue'`
- `reasonType='prospective_cue'`

匹配逻辑集中在召回层；各消费端仍需要显式把 `rehearsal` 放入自己的 `sourceTypes` allowlist，并做展示文案、风险门控和自动化边界控制。

## 配置与开关

Rehearsal 没有独立的“系统启用”开关。它作为记忆层默认存在，产生和消费分开控制：

- 产生侧：`SELF_REFLECTION_ENABLED` 默认开启，控制自我反思心跳是否运行；关闭后不会自动从 Reflection 产生新的 `rehearsal_candidate`，但手动 API 创建仍可用，已存在 Rehearsal 也不会被删除。
- 消费侧：`CONTEXT_ASSIST_ENABLED`、`COMPOSE_ASSIST_ENABLED`、`MEETING_PREP_ENABLED`、`MEETING_PILOT_ENABLED` 等控制对应 surface 是否请求或展示场景化记忆。对应请求的 `sourceTypes` 必须包含 `rehearsal` 才会激活 Rehearsal。
- 展示总闸：Options 的 Context Assist 区域提供 `SCENE_REHEARSAL_DISPLAY_ENABLED`（显示场景预演提醒）。关闭后，扩展会在 Compose Assist、Memory Lens、Meeting prep、Meeting Pilot passive recall、Today Pilot Overview 等消费入口过滤掉 `rehearsal` source；即使某个入口原本只请求 `rehearsal`，也会退回非 Rehearsal 来源列表，避免后端默认来源把预演提醒重新带回来。数据、生命周期和 Reflection 候选生成不受影响。

不提供 “Reflection 自动创建场景预演候选” Options 开关：这是 Reflection 的默认能力，是否运行由 `SELF_REFLECTION_ENABLED` 决定。后续如果需要更细的隐私或实验控制，再新增候选生成专用开关。

## 消费端

### Compose Assist

- RingCentral、Jira、Web AI adapter 的 `sourceTypes` 包含 `rehearsal`。
- 命中后作为“预演提醒” evidence，而不是普通背景记忆。
- Compose Assist 会保留已经通过人物、群组、会话、issue、URL 等场景线索命中的 `rehearsal_cue`，不会再用普通记忆的文本 overlap 过滤误杀。
- 输入框 hover 预览会用一行轻量提示说明“预演提醒”和命中的主要线索，帮助用户在插入前判断来源；它不是完整证据卡，也不自动发送。
- 含 Rehearsal evidence 的建议会先进入确认预览，提示用户核对“未来场景脚本”是否仍适合当前回复，再插入草稿。
- 用户点击 thumb-down 时，Compose Assist 会把相关 Rehearsal activation 记录为 `irrelevant`；用户插入建议且未撤销时记录为 `accepted`。这条反馈只影响具体预演提醒的后续命中，不会自动发送消息。
- 不自动发送；高风险或私人内容仍必须只进入预览或被前端阈值挡住。

### Today Pilot / Meeting Pilot

- Today Pilot 扫描 active/stale Rehearsal，生成“今天可能要带入的预演提示”。
- Meeting prep 和 Meeting Pilot cue cards 消费参会人、会议标题、日历事件、项目命中的 Rehearsal。
- 面对面场景只提前提醒，不承诺现场触发。

### Memory Lens

- 当前网页、Jira、消息会话、选中文本命中 Rehearsal 时，只显示低打扰“预演提醒”。
- 不生成回复、不插入文本。
- 必须解释“为什么此刻相关”和“预演内容摘要”。
- 卡片文案使用“预演内容 / 我能做什么”，避免把未来场景脚本当成普通事实记忆。
- `exploreLink` 指向 `#/rehearsals?rehearsalId=...`，Memory Lens 会打开 Rehearsal 管理页并定位到这条预演。
- 正向/负向反馈会写入 `/rehearsals/:id/feedback` 的 activation 记录；正向反馈保留为 `accepted`，负向反馈标记为 `irrelevant`，用于后续降低类似触发。

### Memory Exploring

`memory-exploring.html#/rehearsals` 是轻量管理页，不是主要使用入口：

- 列表：active、candidate、paused、stale、used、dismissed、archived、all。
- 详情：触发线索、建议内容、来源证据、激活历史、反馈、有效期、降权原因。
- 操作：暂停、恢复、归档、标记已使用、标记不相关。
- 详情页会按状态给出下一步处理建议：active 可暂停或标记不相关，candidate 可激活，stale 可重新激活，dismissed 可恢复观察，used / archived 更偏审计。
- 从 Today Pilot、Memory Lens 或 cue card 深链进入时，如果目标 Rehearsal 不在当前筛选/搜索结果中，管理页会直接拉取详情并临时置顶，避免用户落到无关的第一条结果。
- 如果用户已经停留在 Rehearsal 管理页，再从其他入口打开新的 `?rehearsalId=` 深链，页面会重新加载并聚焦目标条目，不需要刷新整个 Memory Exploring。
- 用户主动切换状态筛选、搜索或刷新时，筛选意图优先于旧 deep-link：若当前条目不在新结果中，页面会选择新筛选内第一条并同步 URL，避免 Active / Stale 等筛选看起来失效。
- 详情页会展示 `evidenceRefs` 来源证据列表；如果来源为空，会明确显示“暂无来源证据记录”，避免用户误以为来源被隐藏或加载失败。
- 激活历史需要显示 outcome、分数、surface/context 和本次命中的线索摘要，方便判断这条预演是该恢复、更新、标记已使用还是降权。

## 业内参考与启发

- [Microsoft Research 的数字提醒研究](https://www.microsoft.com/en-us/research/wp-content/uploads/2017/07/memory_imwut2017.pdf)指出，很多“要记得做”的事情无法只靠时间/地点提醒覆盖，尤其是社交互动中要带入的信息；Rehearsal 因此优先按人、会话、会议、issue 和 URL 等场景线索触发。
- [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 的最新控制面强调 memory sources、相关/不相关反馈和用户可管理性；Rehearsal 的现场卡片也必须能解释来源线索、反馈命中质量，并能跳回管理页复核。
- Claude 的 memory import/export 和“View and edit your memory”路径强调迁移、备份与人工复核；Rehearsal 管理页也应把筛选状态、当前聚焦对象和来源证据保持可解释，不把用户困在旧深链目标上。
- Prospective memory 研究反复强调 cue 与目标动作的关联强度；因此 Memory Lens 只在有明确人物、项目、工单、会话或主题 cue 时显示预演提醒，弱命中不自动打扰。
- 2026-05-26 检索到的 ChatGPT Memory FAQ 还强调可查看来源、标记来源相关/不相关、优先或降级记忆、查看历史版本；这进一步支持 Rehearsal 管理页把证据来源和反馈动作放在详情里，而不是只给状态按钮。
- 近期 [agent memory 论文](https://arxiv.org/abs/2605.12978)也提醒，持续自动整合可能损坏原有有用记忆；Rehearsal 因此保留原始 `evidenceRefs`、activation history 和手动归档/恢复路径，不把管理页做成只展示合并结论的黑盒。

## 验证

后端固定验证：

```bash
npm --prefix memory-service test -- --run src/__tests__/reflectionThreadService.test.ts
npm --prefix memory-service test -- --run src/__tests__/api-rehearsals.test.ts
npm --prefix memory-service run build
```

建议联动验证：

```bash
npm --prefix memory-service test -- --run src/__tests__/api-context-recall.test.ts src/__tests__/api-composer-assist.test.ts src/__tests__/api-day-pilot.test.ts
npm start
node tools/verify-rehearsals-page-e2e.mjs
```

重点回归场景：

- Colin Liu 聊天命中 Rehearsal 并返回 `displayPriority=p1`。
- 包含 Colin 的会议 prep 能看到 cue。
- 无关聊天不返回 Rehearsal。
- `sourceTypes` 不包含 `rehearsal` 时完全不激活。
- 过期 Rehearsal 不删除，降为 stale 弱提示。
- Memory Exploring 可以筛选、暂停、恢复、归档和查看 activation history。
- Reflection 生成 `rehearsalCandidates` 后写入 Rehearsal；重复 reflection run 更新同一条来源候选而不是重复创建。
