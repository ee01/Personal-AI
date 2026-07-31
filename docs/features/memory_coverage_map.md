# Memory Coverage Map / 记忆覆盖地图

*最后更新: 2026-07-15*

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

- 覆盖快照回执：说明服务端生成时间、本机读取时间；如果重扫失败但旧数据仍在屏幕上，会明确说当前显示的是上次成功快照，失败结果不会覆盖平台卡片。
- 快照年龄回执：首屏直接显示快照年龄；如果服务端 `generatedAt` 已超过 `staleAfterDays` 新鲜度窗口，会把标题切成“覆盖快照已过期”，并说明质量分和平台卡片仍来自旧快照，用户应先点击 `重扫覆盖` 确认当前状态。这个提示不触发 provider sync、不改配置、不写库，也不外发。
- 手动重扫回执：用户点击 `重扫覆盖` 后会保留本次请求的发起/完成时间、旧快照、新快照、本次 messages / chunks / entities / 覆盖缺口读数，以及只读边界；重扫失败时不会用失败结果覆盖旧平台卡片。
- 最近覆盖信号回执：时间线只展示当前快照中带 `lastSeenAt` 的平台事件，用来辅助判断地图新鲜度；回执会标明这是最多 8 条的可见切片，不是完整同步 / 错误日志或权限证明。如果没有可排序事件，会显示空态并说明这不等于所有来源健康或全部失联，且不会触发同步、写库、标记已读或外发。
- 已接入平台数。
- 健康平台数。
- 需关注平台数。
- 积压压力。
- 未启用通道。
- 覆盖缺口：只统计需要用户主动处理的 warning / critical 修复项；未启用的 P1+ 可选通道作为 info 规划项展示，不把“尚未接入”误报成当前故障。
- 当前 Memory Service 消息、chunks、entities 总量。

这些数字来自 `GET /api/v1/coverage/map`，不是 demo 固定值。主聚合接口也会返回响应级 `receipt`：它说明本轮读取的聚合来源、平台 / 缺口 / info 规划项 / 时间线读数、近 7 天新鲜度窗口，以及“只读覆盖聚合快照”的边界。这个 receipt 用来避免调用方把 `/coverage/map` 误读成一次 provider sync、权限 / ACL 完整校验、外部平台修复或内容事实正确性证明。

P0 切片接口也会返回只读诊断回执：`generatedAt`、`staleAfterDays` 和 `receipt`。`receipt.slice` 标明当前读取的是 messages / provider jobs / pressure / skills sync 哪个切片，`receipt.source` 标明聚合来源，`receipt.boundary` 明确这只是只读覆盖诊断，不会写入记忆、重跑同步、修复配置、标记已读或外发到任何平台。`receipt.summary` 会补充本轮读数摘要，例如行数、总量、近 7 天新鲜度、失败数、启用数、最新时间、诊断窗口和空态解释，避免用户或调试脚本只看到空数组时误以为已经执行了同步、修复或完整审计。

Coverage 页面会在主快照下方展示 `P0 只读诊断切片` 面板，把 messages-by-source、pressure、provider-jobs-recent 和 skills-sync 四个切片的 source、窗口、读数、空态解释、诊断说明和无副作用边界直接显示出来。切片读取失败只影响这个诊断面板，不会覆盖主平台卡片；`刷新切片` 的 hover / 读屏也说明它只重新读取这四个只读 API，不会重扫 `/coverage/map`、不会替换质量分、不会重跑 provider sync、不会写库、不会修复配置、不会标记已读或外发。

### 平台地图

平台按四组展示：

| 分组 | 说明 |
|---|---|
| 已激活平台 | RingCentral、Jira、网页记忆等已经有输入/输出信号的平台 |
| Personal AI 派生能力 | 用户画像、反思、动作队列、技能等内部能力 |
| 未启用通道 | Reminders、本地 Notes、外部 AI 历史等当前不自动抓取的来源 |
| 系统入口 | 智能录入 / 记忆备份等用户主动触发的入口 |

外部 AI 历史有一个特殊状态：未上传前仍属于“未启用通道”，因为 Personal AI 不会自动抓取 ChatGPT / Claude / Gemini；用户主动导入 `conversations.json` zip 后，Coverage Map 会把它转成已激活的 ingest 信号，展示已导入批次、会话数、纳入文本消息数、最近提交时间、读取的 `conversations.json` 路径、被忽略的归档文件数，以及被跳过的非文本附件/消息部件。如果最近一次导入超过 `staleAfterDays`，它会进入 stale，并提示用户重新导出并导入，而不是永久显示健康。

网页记忆平台同时包含 ingest 和 derive：`source-memory:deep-distillation` 贡献项读取 `source_memory_distillation_jobs`，展示已成功、待处理（queued/running/retry）和阻断/失败数量。待处理或 deep 失败只降低派生层健康度，detail 必须明确“同步 P0 资料仍可召回”，不能把 deep job 状态误报成网页资料未保存、provider 未接入或原始证据丢失。

每个平台卡片展示：

- `healthy` / `partial` / `stale` / `sparse` / `failing` / `blocked` / `pressure` / `not_configured` / `unknown` 状态。
- ingest / push / sync / derive 方向标签。
- 贡献项、数量、最近信号、证据 SQL / API source。
- 质量分 `qualityScore`，范围 0-100。
- 平台卡片直接显示质量分摘要、近 7 天信号占比和失败扣分；点开平台后再看完整 `qualityScoreBreakdown`。
- 质量分解释 `qualityScoreBreakdown`，把状态基准、健康贡献、新鲜度和失败惩罚拆开，避免只给一个黑箱数字。
- 质量分解释先显示 `质量分快照口径`：说明分数来自当前 Coverage API 快照、快照年龄、最近信号、新鲜度窗口，以及只有 `重扫覆盖` 拿到新的 `/coverage/map` 响应后才会替换质量分、平台卡片和优先处理。
- 低分平台会在质量分解释里标出 `优先处理` 的贡献项、状态、最近信号和证据 source，让用户不用从列表里猜先修哪里。
- 质量分解释同时显示 `质量分边界`：分数只衡量当前可读覆盖状态、贡献项健康、新鲜度和失败/积压惩罚；不判断内容事实是否正确、是否完整，也不代表可以直接进入回复、画像或外部同步。未启用的可选通道不会混进当前平台低分，修复仍需要用户检查来源或显式执行录入/同步动作。
- 总览下方会高亮 active / derived 平台里最需要处理的最低分平台，直接展示短板贡献项、焦点来源、证据 source 和下一步；`查看平台` 的 hover / 读屏说明它只定位当前覆盖快照与修复队列，不会重扫 Coverage API、刷新诊断切片、重跑同步、改配置、写入记忆、标记已读或外发。
- Coverage API 会返回结构化 `priorityFocus`，优先选择 active / derived 平台里的 critical / warning 修复项，再按质量分和状态排序；前端优先消费这个字段，旧数据缺字段时才回退到本地低分推断。这样 info 级 P1+ 规划项不会被误当成当前故障。
- `priorityFocus` 还会返回质量分修复路线回执：本轮比较了多少候选平台、排除了多少 info 规划项、为什么当前短板成为下一步，以及查看平台的只读边界。平台详情里的 `质量分修复路线` 会复述同一条路线，避免用户把可选未启用通道误读成当前故障。
- 平台列表支持 `默认` / `低分优先` 排序；低分优先只作用于 active / derived 平台，不把未启用的 P1+ 规划通道混成当前故障。排序按钮本身带 hover / 读屏边界：`低分优先` 只重排当前前端快照，`默认` 只恢复 API 返回顺序和平台分组；两者都不会重扫 Coverage API、重算质量分、重跑 provider sync、写库、标记已读或外发。切到低分优先时页面显示 `质量分排序回执`，说明排序范围、未启用 / 系统入口的排除口径，以及质量分不判断内容事实正确性。
- 选中后的详情、贡献列表和修复队列。

### 修复队列

修复队列只展示可解释的下一步，不自动修改同步设置。

右侧修复队列默认跟随当前选中的平台，便于先处理当前卡片的质量分短板；同时提供 `当前平台 / 全部` 切换。用户选到健康平台但顶部仍有全局 warning / critical 覆盖缺口时，空态会提示“全局仍有需处理的覆盖缺口”并可一键切到全部修复项，避免全局故障被平台筛选藏起来。如果全局只有 info 级 P1+ 可选规划项，空态和全部视图会明确说这是“可选规划项 / 不算覆盖故障”，不把未启用通道伪装成当前缺口。全部视图会标出每条修复项所属平台。

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
| ChatGPT / Claude `conversations.json` zip | 会先在完整 zip 目录里查找 `conversations.json`，按会话转成低权重 shadow memory；抽屉显示外部 AI 对话数、纳入消息数、长会话截断数、读取的源文件路径、被忽略的归档文件数、来源预览和被忽略的非对话文件提醒 |
| Personal AI 备份 zip | 自动切到恢复模式，不按普通文档分析 |

普通资料的写入规则：

- 必须先 dry-run，不会一上传就写库。
- 抽屉打开后会先显示 `智能录入范围回执`：说明当前输入/范围、`查看 dry-run` 只读不写库、只有后续 `提交录入` 才会写入低权重 `manual` shadow memory，以及未预检 / 阻塞 / 重复条目不会自动补写。
- 空文本文件、空粘贴内容、扫描件 PDF 或不支持格式会显示阻塞原因，不允许写入空 shadow memory。
- dry-run warning 会在抽屉里直接展示；普通文档 / zip 会额外显示预检回执，说明可录入、阻塞、未预检和 chunks 数，避免用户误以为大型 zip 已完整分析。
- 普通文档 / zip dry-run 后还会显示 `资料录入恢复回执`：说明现在提交只会写入 ready 条目，阻塞或未预检内容不会被后台自动补扫，并给出拆分 zip、修正格式、重新 dry-run 的恢复路径。
- 抽屉底部主按钮会把当前动作边界写进 hover 和读屏名称：未 dry-run 时说明 `查看 dry-run` 只读不建 batch / messages / chunks；ready 后说明 `提交录入` 会写入哪个范围的低权重 `manual` shadow memory；高风险、重复、阻塞、外部 AI 和备份恢复状态也会在同一控制点说明禁用或下一步原因。
- 如果发现 password / token / api key / 密钥等高风险词，用户必须勾选确认后才能提交；后端 `/import/commit` 也会重新计算高风险信号，没有明确 `confirmHighRisk` 时拒绝写入，避免绕过 UI。
- 确认后写入 `messages_raw` 和 `chunks`。
- 使用 `source_type = manual`、`source = import:<batchId>`。
- metadata 标记 `shadowMemory: true`、`lowWeight: true`、`importBatchId`、`importEntryPath`、`parserVersion`。
- `memory_metadata` 以低 salience / temporary consolidation 写入，避免刚导入的资料直接压过长期高质量记忆。
- `memory_import_batches` 记录 batch id、hash、来源名、解析结果和 warning，用于去重和审计。
- 如果 dry-run 命中既有 `sourceHash`，抽屉会显示 `重复录入回执`：说明匹配的既有 batch、本次没有新增 messages / chunks、不会覆盖/删除/降权/重新同步已录入内容，也不会写回外部平台；用户需要复查时按 `memory_import_batches.source_hash`、batch id 或 `source import:<batchId>` 定位。
- batch summary 会记录 `profileCandidates`、`skillSignals`、`highRisk`、`unsupported`、`externalAiConversations` 和被跳过/忽略的 warning，方便后续把高价值条目升级成候选。
- 外部 AI 历史包不会受普通 zip 80 文件预检上限影响；命中 `conversations.json` 后只把对话内容作为导入候选，归档里的附件、账户文件或其他导出元数据会被忽略并在 dry-run 中提示。
- 外部 AI dry-run 会显示 `外部 AI 导入范围` 回执，明确读取哪个 `conversations.json`、纳入多少文本消息、多少长会话被截断、多少非文本部件和非对话归档文件被忽略；commit 后这些字段也写入 `memory_import_batches.summary_json`，用于 Coverage Map 平台卡继续展示来源范围。
- 外部 AI dry-run 还会显示 `提交前会发生什么` 回执，说明本次会把多少会话/文本消息写入哪个范围、写入后只是低权重 `manual` shadow memory、不会自动抓取原平台或外发回原平台、不会直接升级为 confirmed 画像/skill/项目事实，并提示重复归档按 source hash 去重、需要复查时按 import batch / source 路径审计。回执还会明确旧 assistant 回答只是对话证据，不等于事实确认。
- 点击普通资料 / 文档 / 普通 zip 的 `提交录入` 后、服务端确认前，抽屉显示 `资料写入提交中回执`：复述 ready 条目、chunks、目标范围、高风险确认状态、阻塞/未预检遗漏，以及提交中不等于写入成功；成功也只是低权重 `manual` shadow memory，不会自动同步外部平台、覆盖旧 batch、确认画像/skill/项目事实、发送消息或外发导入内容。
- 点击 `提交录入` 后、服务端确认前，外部 AI 历史会显示 `外部 AI 写入提交中回执`：复述本次会话/文本消息/遗漏项、目标范围和 `conversations.json` 路径，并说明提交中不等于写入成功，不会继续抓取 ChatGPT / Claude / Gemini、不会外发回原平台，也不会直接升级为 confirmed 画像、skill 或项目事实；旧 assistant 回答同样不会在服务端确认后直接变成事实。
- dry-run 或提交请求处理中，来源切换、文件选择、work/personal 范围和粘贴文本会临时锁定；按钮 / 输入框 hover 与读屏说明本次请求仍使用点击时的输入快照和范围，完成前不能改来源、文件、范围或文本，避免旧 dry-run / 写入结果挂到新输入旁边。
- dry-run、普通资料写入或备份恢复请求处理中，关闭、取消和点击抽屉外背景也会保持抽屉打开，并提示这些动作不会撤回已发出的请求；入口 `录入` 本身只打开本地抽屉，不读取本机文件、创建 batch / messages / chunks、恢复备份、同步外部平台或外发内容。
- 录入完成后，完成回执会保留 batch/source hash 审计路径和事实边界：已写入的用户原话与旧 assistant 回答仍只是可追溯对话证据，后续召回、画像、skill 或项目事实需要各自证据门控。
- 普通 zip 只预检前 80 个文件，dry-run summary 会返回 zip 总文件数、已预检文件数和未预检文件数；未预检部分不会在 commit 中写入。
- 外部 AI 历史最多预检前 40 个会话、每个会话纳入前 80 条消息；如果长会话被截断，dry-run 会显示纳入消息数、总消息数、截断会话数和 warning，避免用户误以为完整历史已经写入。
- ChatGPT mapping 会按会话树和时间回退保持真实对话顺序；没有文本内容的图片、附件和对象型 message part 不会被 JSON 原样塞进记忆，而是在 dry-run 中计为“跳过非文本”并写入 warning。

### 备份下载与恢复

右上角 `记忆备份` 直接调用 `POST /api/v1/export` 下载 Personal AI backup zip，不再进入 Options 设置页。点击前页面会先显示 `备份操作前回执`，说明这个按钮只会请求并保存本机 backup zip，不会恢复、删除、替换、同步或外发；请求等待期间会显示 `备份下载提交中回执`，把当前未确认的新 zip、旧成功/失败回执和无副作用边界分开；真正恢复必须从 `录入 > 备份 zip` 重新选择文件，先 dry-run，再按 merge/replace 影响预览确认。下载成功后页面会保留 `备份下载回执`，展示文件名、下载时间、zip 类型/大小、manifest 摘要和 archive SHA-256 短指纹；这只是本机保存的备份文件，不会自动恢复、删除、同步或外发。如果下载失败，页面会保留 `备份下载失败回执` 并替换旧的成功回执，明确本次没有生成或保存 backup zip，也没有恢复、删除、同步或外发任何记忆，用户需要确认 Memory Service 可用后重试。

备份恢复共用 `录入` 抽屉：

1. 用户上传 zip。
2. `POST /api/v1/import/inspect` 识别是否为 Personal AI backup schema。
3. 只有后端预检明确返回 `backup_zip` 后才显示恢复区域；如果用户从 `备份 zip` 入口选了普通 zip，页面会退回普通资料 dry-run，不会误报成备份。
4. 命中备份 zip 后，抽屉会隐藏普通资料的 `work/personal` 写入范围，改为显示 `备份恢复目标回执`：恢复目标来自当前 Memory Service 用户空间，普通资料范围只用于文档 / 普通 zip / 外部 AI 历史录入。
5. 命中备份 zip 但还没有 restore dry-run 预览前，抽屉显示 `备份恢复预览门禁`：说明当前文件、merge/replace 预览模式、下一步只是读取 manifest / archive 指纹 / DB / 文件影响的 dry-run，不会写入、删除、替换、同步外部平台或外发。
6. 命中备份 zip 后默认 merge；勾选 `覆盖替换现有记忆` 后使用 replace。
7. restore dry-run 会先展示备份用户、导出时间、archive SHA-256 短指纹、DB 行数、文件写入/覆盖/保留/删除影响、关键影响路径和 warning，避免用户在不知道影响范围或无法核对备份快照时确认。
8. 如果存在跨用户 warning、replace、覆盖或删除影响，确认恢复前必须勾选已复核影响预览；replace 不再使用浏览器原生 confirm，而是在抽屉内额外要求勾选“确认按 replace 替换当前记忆数据库”后才允许写入。
9. 最终恢复复用现有 `POST /api/v1/import`；恢复完成后抽屉显示写入回执和 `恢复后续回执`，说明已写入的 Layer、同一 archive 指纹、Coverage Map 自动刷新结果、再次恢复必须重新选 zip，以及恢复不会自动同步外部平台、启用未配置通道或替用户发送内容。如果写入成功但自动刷新 Coverage Map 失败，回执会明确说当前主视图可能仍是旧快照，并保留失败原因与手动 `重扫覆盖` 路径；同时禁用重复确认按钮，需要再次恢复时重新选择备份文件。

备份 zip 的 schema 识别会先扫描完整 zip 文件列表确认 `manifest.json`、`user/memory.db`、`user/config.json` 和 `personal-ai-memory-backup` manifest，再把普通资料解析限制在前 80 个文件内。这样大型 Personal AI 备份不会因为条目数较多而被误判为普通文档包，但普通资料导入仍保持预检上限。

## API

| API | 用途 |
|---|---|
| `GET /api/v1/coverage/map` | Coverage Map 主聚合接口；响应级 `receipt` 给出聚合来源、读数摘要和只读边界，平台项包含 `qualityScore` / `qualityScoreBreakdown`，响应级 `priorityFocus` 给出当前最该处理的平台、贡献项、修复项和边界原因 |
| `GET /api/v1/coverage/messages-by-source` | 消息来源切片；响应带 `receipt.summary`，说明 source type 行数、总消息数、近 7 天消息数和最新信号；不读取正文、不补写 missing source、不触发召回 |
| `GET /api/v1/coverage/pressure` | 通知、确认项、动作队列等压力切片；响应带 `receipt.summary`，说明当前压力总数和队列快照口径；不会发送通知、执行动作、确认决策或关闭反思线程 |
| `GET /api/v1/coverage/provider-jobs/recent` | provider sync job 最近状态；响应带 `receipt.summary`，说明最近 30 天任务组合、任务数、失败数和最新任务时间；不会重跑 provider sync、清空错误或修改同步设置 |
| `GET /api/v1/coverage/skills-sync` | 技能平台同步状态；响应带 `receipt.summary`，说明平台设置数、绑定数、启用数、失败探测数和最新探测时间；不会启用平台、拉取外部技能或写入 active skill truth |
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
- Microsoft 365 Copilot connector connection details 还会展示 crawl 后更新的累计索引统计、`Updated at`、错误数和手动 Refresh；Coverage Map 因此在主视图保留覆盖快照回执，避免用户把上一次成功快照误读成刚刚重扫成功。
- Microsoft 365 Copilot connector 管理页会把 permanent crawl failure、service health 通知、on-demand crawl 和 connection 状态分开；Coverage Map 的 P0 slice 回执也按“只读诊断”和“真正重跑/修复”分界，避免 API 调试被误读成已经执行修复。
- Microsoft 365 Copilot connector 的 indexed-content 验证页会让管理员检查索引内容、metadata 和 ACL，错误监控页则把错误代码、次数和日志下载分开；Coverage Map 的质量分因此继续把“为什么选这个短板”和“这只是只读路线”放在页面上，而不是只给一个分数。
- Notion Enterprise Search 说明 connector 查询要遵守源系统权限、同步失败会重试并暴露进度/错误；Coverage Map 因此保留 source / permission / sync 语义，不把切片读数伪装成权限确认或外部平台写入。
- OpenAI ChatGPT data export 与 Claude data export 说明外部 AI 历史迁移正在变成用户预期，但导出通常是用户主动下载的 zip / conversations 数据，不能假设所有内容都安全、完整或高质量；长对话必须把纳入范围展示清楚。
- ChatGPT exported conversation transfer、Claude memory/file upload 和 Notion import docs 都把支持格式、大小限制、迁移边界或拆分大文件作为显性步骤；普通资料 dry-run 因此需要把 ready、blocked、uninspected 与恢复动作放在同一个回执里，而不是只给汇总数字。
- Google Takeout、ChatGPT data export 和 Claude memory import/export 都把“先生成/下载归档，再由用户选择导入或保存”的路径变成常见心智；NIST 的数据完整性恢复指南也强调恢复前识别正确备份版本和完整性。Coverage Map 因此保持一键下载、上传后自动识别、恢复前 dry-run，并把 archive 指纹贯穿下载、预览、失败和写入回执。
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
