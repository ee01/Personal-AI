# Rehearsal（场景预演）

_最后更新: 2026-07-01_

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
- 创建和更新都会先做“未来场景边界”校验：新建 Rehearsal 至少要有一个结构化触发线索（人物、项目、主题、关键词、群组、会话、会议、日历、issue、URL 或 surface）。如果请求只有标题和脚本、没有任何 cue，API 会返回 `REHEARSAL_FUTURE_CUE_REQUIRED`，避免普通事实、灵感或无场景待办进入预演层。只有补齐线索后，才会进入 candidate / active / stale / paused 等可现场消费状态。
- Reflection 自动候选：`ReflectionWorker` 可以在反思真实证据时输出 `rehearsalCandidates`；`ReflectionThreadService.runReflection()` 会写入 `rehearsals`，来源标记为 `source_kind='reflection'`，并把 `reflection_thread:{id}`、`reflection_run:{id}` 和相关证据放入 `evidence_refs_json`。如果 Reflection 只是复盘事实、追踪 Jira 字段或继续观察状态，而没有“未来遇到 X 时应该 Y”的场景脚本，就不应勉强生成 Rehearsal。
- Reflection 线程来源：高重要消息、确认请求、实体事实变化、用户画像变化、动作结果、Dream run 形成的反思线程，都可能在后续 Reflection run 中产出候选。

当前明确不做的入口：

- Dream 不直接创建 active Rehearsal。Dream 的弱联想只能先进入 Reflection 或其他验证流程。
- Compose Assist、Meeting Pilot、Today Pilot、Memory Lens 默认只消费和反馈 Rehearsal，不在现场直接新建预演。
- `RehearsalActivationService` 只负责场景命中，不负责生成新内容。

Reflection 自动候选的去重规则：同一 reflection thread 下，场景类型和触发线索相同的候选会复用同一个 `source_ref_id`，再次生成时更新现有 Rehearsal，而不是重复创建。高置信且有稳定触发线索的候选会自动成为 `active`；否则保留为 `candidate`。

### 产出语言

Rehearsal 的标题、摘要和预演内容是面向用户消费的内容，不能因为内部 prompt 是英文就默认产出英文。

生成语言的优先级：

- 先看用户画像里的明确语言偏好，例如 `user_profile_items.language_preference` 写着“回复和生成面向用户的内容时使用中文”。
- 再看用户资料 Markdown，例如 `user.md`、`USER.md`、`USER_CORE.md`、`CORE_MEMORY.md` 或 agent identity 中是否明确写了输出语言。
- 如果没有明确配置，再按本轮 Reflection 证据的主语言兜底。

模糊策略不会被当成明确偏好，例如 `Match user's language (Chinese/English)` 只说明“跟随用户”，但没有告诉后台心跳在没有当前对话语言时该用中文还是英文。

推荐线上稳定配置：在用户画像中保存一条高置信、用户确认的偏好，例如 `item_key=language_preference`、`item_value=回复和生成面向用户的内容时使用中文`。这样由 Reflection 自动生成的 Rehearsal 会稳定使用中文，同时保留人名、项目名、URL、Jira key、群组名等原文。

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
- stale 默认不自动弹出；如果精确命中人物、会议、issue 等强线索，仍可作为弱提示，但后端会把展示优先级 cap 在 `p2`，不会因为多条强 cue 命中重新变成 `p1` 强提示。召回原因里会带出“已过期 / 长期未命中 / 已降权，仅弱提示”之类的边界说明。
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

创建/更新失败时，如果返回 `code='REHEARSAL_FUTURE_CUE_REQUIRED'`，说明这条内容还没有可识别的未来场景，不会被保存为新 Rehearsal。需要补至少一个 cue，而不是让用户事后在管理页猜它为什么不触发。

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
- 输入框 hover 预览会用一行轻量提示说明“预演提醒”和命中的主要线索；线索优先来自 `metadata.matchedCues` / `activationCues`，会压缩人物、项目、issue、群组、会话、会议、URL、surface、主题或关键词，帮助用户在插入前判断来源；它不是完整证据卡，也不自动发送。
- 含 Rehearsal evidence 的建议会先进入确认预览，提示用户核对“未来场景脚本”是否仍适合当前回复，再插入草稿；复核态会显示 `预演复核` 回执，把命中线索、提示资格（强提示 / 弱提示、active / stale / candidate、过期或降权原因）、预演脚本、只写入草稿不发送/提交的边界，以及 thumb-down 后相同场景降权的反馈路径拆开呈现。下面的“建议依据”仍会保留来源类型、标题、分数、命中原因和压缩后的预演内容，避免用户只看到来源标题却看不到真正要带入的脚本。
- 用户点击 thumb-down 时，Compose Assist 会把相关 Rehearsal activation 记录为 `irrelevant`，并在输入框旁显示“已隐藏预演建议 / 命中线索 / 相同场景降权”的短回执；用户插入建议且撤销窗口结束后记录为 `accepted`，完成回执会单独显示预演使用反馈是否已写入、未写入或没有可写 activation。这条反馈只影响具体预演提醒的后续命中，不会自动发送消息。
- 不自动发送；高风险或私人内容仍必须只进入预览或被前端阈值挡住。

### Today Pilot / Meeting Pilot

- Today Pilot 扫描 active/stale Rehearsal，生成“今天可能要带入的预演提示”。
- Today Pilot 首页的预演卡会在展开后显示 `预演回执`：本次命中的人物/会议/项目/issue 等线索、active/stale 状态、要复习的脚本，以及“只做准备提醒、不自动发言或执行”的边界。
- Meeting prep 和 Meeting Pilot cue cards 消费参会人、会议标题、日历事件、项目命中的 Rehearsal。
- 面对面场景只提前提醒，不承诺现场触发。

### Memory Lens

- 当前网页、Jira、消息会话、选中文本命中 Rehearsal 时，只显示低打扰“预演提醒”。
- 不生成回复、不插入文本。
- 必须解释“为什么此刻相关”和“预演内容摘要”。
- 卡片文案使用“预演内容 / 我能做什么”，避免把未来场景脚本当成普通事实记忆。后端返回 Rehearsal match 时会把 `metadata.rehearsal.summary` 和 `metadata.rehearsal.content` 一起带出；Memory Lens 展开卡优先展示真正“到时要怎么做”的 `content`，如果 `summary` 与脚本不同，再作为摘要补充展示。
- 展开卡会显示 `预演回执`：本次触发线索、Active / Candidate / Stale 等提示资格、Rehearsal 管理页复核入口、只读预演不生成/插入/发送/执行的边界，以及有用/不相关只影响这条预演后续命中的反馈范围。
- `exploreLink` 指向 `#/rehearsals?rehearsalId=...`，Memory Lens 会打开 Rehearsal 管理页并定位到这条预演。
- 正向/负向反馈会写入 `/rehearsals/:id/feedback` 的 activation 记录；正向反馈保留为 `accepted`，负向反馈标记为 `irrelevant`，用于后续降低类似触发。负反馈面板必须称为“预演提醒不适合当前场景”，不能把未来场景脚本说成普通事实记忆。

### Memory Exploring

`memory-exploring.html#/rehearsals` 是轻量管理页，不是主要使用入口：

- 列表：active、candidate、paused、stale、used、dismissed、archived、all。
- 列表顶部显示 `列表范围回执`：当前 status/search 读取范围、可见结果数、缺少 future cue 的仅审计条目数、是否有深链临时置顶，以及“筛选/搜索/查看 All/深链定位只读取和置顶，不激活、暂停、归档、标记反馈、写入外部系统或执行预演脚本”的边界。
- 列表卡片会先显示提示资格、future cue 摘要和不自动执行边界，用户不用点进详情就能看出 Active、Stale、Candidate、Paused、Archived 或缺少 cue 的历史记录是否会进入现场提示。
- 详情：触发线索、建议内容、来源证据、激活历史、反馈、有效期、降权原因。
- 操作：暂停、恢复、归档、标记已使用、标记不相关。
- 详情页顶部先显示 `场景资格总览`：未来线索覆盖、现场提示资格、来源/触发审计保留和动作边界，帮助用户先判断“这条脚本会不会真的触发”，再看命中诊断或处理按钮。
- 详情页会按状态给出下一步处理建议：active 可暂停或标记不相关，candidate 可激活，stale 可重新激活，dismissed 可恢复观察，used / archived 更偏审计。
- 从 Today Pilot、Memory Lens 或 cue card 深链进入时，如果目标 Rehearsal 不在当前筛选/搜索结果中，管理页会直接拉取详情并临时置顶，避免用户落到无关的第一条结果。
- 如果深链目标不存在、详情请求失败，或当前筛选里没有目标且直取详情也失败，管理页会显示 `深链目标未确认` 回执：说明这不等于目标已删除、归档或标记不相关，当前列表只是继续显示可用结果；用户可以重试目标或切到 All 重新浏览，改状态前必须先确认目标标题、脚本和触发线索。
- 如果用户已经停留在 Rehearsal 管理页，再从其他入口打开新的 `?rehearsalId=` 深链，页面会重新加载并聚焦目标条目，不需要刷新整个 Memory Exploring。
- 用户主动切换状态筛选、搜索或刷新时，筛选意图优先于旧 deep-link：若当前条目不在新结果中，页面会选择新筛选内第一条并同步 URL，避免 Active / Stale 等筛选看起来失效。
- 如果状态筛选或搜索成功读取但返回 0 条，管理页会显示 `空筛选回执`：当前读取范围、可见结果为 0、这是成功空结果而不是失败或删除、没有改状态/写外部/执行脚本，并提供查看 All、清空搜索或刷新路径。
- 详情页会展示 `evidenceRefs` 来源证据列表；如果来源为空，会明确显示“暂无来源证据记录”，避免用户误以为来源被隐藏或加载失败。
- 对历史导入或外部写入留下的无 cue 预演，详情页会显示“缺少未来场景边界”诊断，提示先补人物、项目、issue、URL、主题或 surface，再恢复现场提示。这样旧数据不会被误读成“系统没找到线索但仍可正常触发”。
- 管理页判断“是否会进入现场提示”时必须同时看状态和触发线索：`active` 但没有任何 future cue 的历史记录只能显示为“缺少线索，不应现场提示”，下一步提示应引导先补 cue、暂停或归档，而不是只按状态说它会参与现场匹配。
- 管理页还会把 future cue 拆成“有锚定线索”和“仅弱泛化线索”：人物、项目、群组、会话、会议、日历、issue、URL 属于更可靠的现场锚点；只有 topic / keyword / surface 的条目即使是 Active，也会用 warning 态显示“会参与，但只有弱线索”，提示先补人物、项目、会话、会议、issue 或 URL，避免宽泛关键词在相似文本里误提示。
- 激活历史需要显示 outcome、分数、surface/context 和本次命中的线索摘要，方便判断这条预演是该恢复、更新、标记已使用还是降权。
- 详情页顶部会把激活历史压缩成“命中诊断”：最近触发、最高分、正/负反馈、主要入口和建议动作。这样用户从 Memory Lens、Today Pilot 或 cue card 深链进来时，不需要扫完整日志也能判断这条预演是该恢复、暂停、标记不相关还是继续观察。
- 用户点击暂停、恢复、重新激活、标记已使用、不相关或归档后，详情页会显示“处理回执”：新状态、是否还会进入现场提示、来源证据和触发历史是否保留，以及下一步恢复或复核路径。这样管理页不会只用一句成功提示掩盖现场提示资格的变化。
- 如果这些处理动作的写入请求失败，详情页会显示“写入失败回执”：明确本次 `未确认写入`、当前状态仍以旧状态为准、现场提示资格和审计证据未变，并提示用户检查 Memory Service 后重试。同一请求进行中会禁用动作按钮，避免连续点击制造重复写入或误以为已经处理完成。

## 业内参考与启发

- [Microsoft Research 的数字提醒研究](https://www.microsoft.com/en-us/research/wp-content/uploads/2017/07/memory_imwut2017.pdf)指出，很多“要记得做”的事情无法只靠时间/地点提醒覆盖，尤其是社交互动中要带入的信息；Rehearsal 因此优先按人、会话、会议、issue 和 URL 等场景线索触发。
- [Apple Reminders](https://support.apple.com/en-us/102484) 已经把时间、地点、给某人发消息时提醒、回到 app 链接等做成多 cue 触发；Rehearsal 的差异是把 cue 和“到时要怎么说/做”的脚本绑定，而不是只生成待办。
- [Microsoft To Do 的 flagged email](https://support.microsoft.com/en-gb/office/using-microsoft-to-do-with-flagged-email-from-outlook-f90c37b0-4453-4756-a6d5-e2ef8d33b395)把邮件来源、预览、due date 和 reminder 串起来；Rehearsal 管理页也需要保留来源证据和反馈诊断，但不能把所有场景脚本都推成任务队列。
- [智能手机提醒干预研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC8821124/)显示时间/地点提醒能改善 prospective memory；Personal AI 进一步把人物、群组、会议、issue、URL 和 surface 作为触发线索，减少只靠日程时间造成的漏提醒。
- [prospective memory strategic monitoring meta-analysis](https://journals.sagepub.com/doi/10.1177/17470218231161015)强调未来场景的心理模拟和上下文线索；这支持管理页优先展示“为什么此刻命中”和“下一步怎么处理”，而不是只列一堆状态按钮。
- [implementation intentions 与 prospective memory 研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC4113409/)强调“遇到某个 cue 时执行某个行动”的绑定关系；因此 Compose Assist 复核 Rehearsal 时需要露出预演动作脚本，不能只给用户一个来源名和分数。
- [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 的最新控制面强调 memory sources、相关/不相关反馈和用户可管理性；Rehearsal 的现场卡片也必须能解释来源线索、反馈命中质量，并能跳回管理页复核。
- Claude 的 memory import/export 和“View and edit your memory”路径强调迁移、备份与人工复核；Rehearsal 管理页也应把筛选状态、当前聚焦对象和来源证据保持可解释，不把用户困在旧深链目标上。
- Prospective memory 研究反复强调 cue 与目标动作的关联强度；因此 Memory Lens 只在有明确人物、项目、工单、会话或主题 cue 时显示预演提醒，弱命中不自动打扰。
- 2026-05-26 检索到的 ChatGPT Memory FAQ 还强调可查看来源、标记来源相关/不相关、优先或降级记忆、查看历史版本；这进一步支持 Rehearsal 管理页把证据来源和反馈动作放在详情里，而不是只给状态按钮。
- 近期 [agent memory 论文](https://arxiv.org/abs/2605.12978)也提醒，持续自动整合可能损坏原有有用记忆；Rehearsal 因此保留原始 `evidenceRefs`、activation history 和手动归档/恢复路径，不把管理页做成只展示合并结论的黑盒。
- 2026-06-06 检索到的 [context-aware reminders 论文](https://arxiv.org/abs/2605.23085)强调自然语言提醒会包含复杂的时间、活动、传感器和状态条件，需要被结构化成可解释的触发逻辑；这支持 Memory Lens 在现场同时展示“为什么此刻命中”和“到时要怎么做”，而不是只露出一句摘要。
- 2026-06-12 再次检索 Apple Reminders、Microsoft digital reminders、implementation intentions 和 context-aware reminder authoring 后，结论仍是：提醒系统的可靠性来自 cue 和 action 的绑定，而不是只保存一句愿望；因此 Rehearsal 的 API 入口必须拒绝没有结构化 cue 的脚本。
- 2026-06-21 检索 [ChatGPT Scheduled Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt)、Apple Reminders 和 Microsoft To Do 后，结论是主流产品把 scheduled / recurring / location / messaging-person reminder 管理得更清楚，但它们仍以“任务会被提醒”为中心；Rehearsal 管理页必须把“只具备未来场景提示资格，不等于已创建任务或自动执行”放在第一屏。
- 2026-06-21 检索到的 [Great Expectations: Anticipating a Reminder Influences Prospective Memory](https://pmc.ncbi.nlm.nih.gov/articles/PMC12262018/)继续支持一个设计判断：提醒预期会影响用户如何编码和回忆未来任务，所以管理页应先展示 cue-action 绑定强度和不自动执行边界，再给暂停、恢复或归档按钮。
- 2026-06-22 复查 ChatGPT Scheduled Tasks、Gmail Smart Compose、implementation intentions / prospective memory 研究和 context-aware reminder authoring 后，Compose Assist 的 Rehearsal 复核继续保持输入框内轻量审阅，但必须露出提示资格：强 active 提示可以低摩擦确认，stale / 弱提示 / 即将过期提示则应先提醒用户核对“这个脚本现在是否仍适合当前回复”。
- 2026-06-23 复查 Apple Reminders 的时间/地点/消息对象触发、ChatGPT Tasks 的监控/暂停状态、context-aware reminder authoring 和 implementation-intention 资料后，结论是 Rehearsal 列表页也要露出 cue-action 绑定质量；否则用户会把一个缺少 cue、已降权或不会执行的脚本误读成可立即触发的提醒。
- 2026-06-28 复查 [Microsoft To Do Planned/reminders](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do)、[Todoist filters](https://www.todoist.com/help/articles/introduction-to-filters-V98wIH)、[Todoist location reminders](https://www.todoist.com/help/articles/use-location-reminders-in-todoist-uGcwH2AJ6)、[digital reminder systems](https://cs.stanford.edu/~merrie/papers/memory_imwut2017.pdf) 和 [TriggerBench prospective memory for LLMs](https://arxiv.org/html/2606.23459v1) 后，结论是列表/过滤视图本身也要解释“为什么可见”和“可见不等于会执行”；因此 Rehearsal 管理页需要在列表顶部显示范围、缺少 cue、深链置顶和无副作用边界。
- 2026-07-01 复查 [ChatGPT Scheduled Tasks](https://help.openai.com/en/articles/10291617-tasks-in-chatgpt)、[Apple Reminders](https://support.apple.com/en-us/102484)、[context-aware reminder authoring](https://arxiv.org/html/2605.23085v1)、[digital reminder systems](https://cs.stanford.edu/~merrie/papers/memory_imwut2017.pdf) 和 [TriggerBench](https://arxiv.org/html/2606.23459v1) 后，结论是管理页不只要说明“有没有 cue”，还要说明 cue 是否足够锚定；弱 topic / keyword / surface 线索需要作为可复核风险显示，避免用户把宽泛匹配误读成稳定现场触发。

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
- 过期或 stale Rehearsal 不删除；即使精确命中多个强 cue，也只能作为 `p2` 弱提示，并在 `whyRelevant` 里解释降权原因。
- 创建/更新无结构化未来 cue 的 Rehearsal 会返回 `REHEARSAL_FUTURE_CUE_REQUIRED`；只带 topic / keyword / surface 的弱 cue 可以保存为 candidate，但不会因为高 confidence 自动 active。
- Memory Exploring 可以筛选、暂停、恢复、归档和查看 activation history。
- Rehearsal 管理页列表顶部需要显示 `列表范围回执`，覆盖当前筛选/搜索、可见结果、缺少 future cue 的仅审计数量、深链临时置顶状态和筛选无写入/无执行边界。
- Rehearsal 管理页列表卡片需要显示提示资格、future cue 摘要和不自动执行边界，覆盖 Active、Stale 和缺少 cue 的历史记录。
- Rehearsal 管理页需要在详情页第一屏显示 `场景资格总览`：future cue 摘要、现场提示资格、来源/触发审计保留，以及“只提示脚本、不自动发送/写入/执行”的边界。
- Rehearsal 管理页需要在列表范围、列表卡和 `场景资格总览` 中显示 future cue 强度；仅 topic / keyword / surface 的 Active 条目应显示为弱线索 warning，而不是和人物/会议/issue/URL 等锚定线索一样呈现。
- Rehearsal 管理页需要显示命中诊断摘要：最近触发、最高分、反馈分布、主要入口和恢复/降权建议。
- Rehearsal 管理页需要对历史无 cue 数据显示“缺少未来场景边界”诊断，而不是只显示空触发条件。
- Rehearsal 管理页的现场提示资格需要同时依赖状态和 future cue；无 cue 的 Active 旧记录不能显示成可可靠触发。
- Rehearsal 管理页从 `?rehearsalId=` 深链进入时，如果目标直取失败，需要显示 `深链目标未确认` 回执，不能静默选中当前列表第一条并让用户误以为已经定位到目标。
- Rehearsal 管理页筛选或搜索返回空列表时，需要显示 `空筛选回执`，把成功空结果和服务失败/删除/归档区分开，并提供查看 All、清空搜索或刷新恢复路径。
- Rehearsal 管理页操作后需要显示处理回执，明确本次动作是否影响现场提示、是否保留审计证据，以及如何恢复或继续复核。
- Rehearsal 管理页操作失败时需要显示写入失败回执，说明状态没有被确认修改、仍可重试，并防止重复点击造成多次写入请求。
- Today Pilot 预演卡需要显示 `预演回执`，让用户在首页就能看到命中线索、脚本和不自动执行边界。
- Compose Assist Rehearsal 建议的 hover、锁定预览、`预演复核` 回执和 thumb-down 回执都需要显示结构化命中线索；`预演复核` 还要显示提示资格、状态/降权/过期线索和插入前核对边界。如果后端只返回 `whyRelevant`，前端可以退回到原因短语，但不能把预演建议伪装成普通背景记忆。
- Memory Lens Rehearsal 卡片需要优先展示 `metadata.rehearsal.content`，并把不同的 `summary` 作为摘要展示；卡片正文要显示 `预演回执`，覆盖触发线索、提示资格、管理页复核入口、只读边界和反馈范围；负反馈面板要用预演提醒专属文案；`desktop-app/scripts/webpage-memory-detection-check.mjs` 覆盖这个现场展示、深链和 feedback endpoint。
- Reflection 生成 `rehearsalCandidates` 后写入 Rehearsal；重复 reflection run 更新同一条来源候选而不是重复创建。
