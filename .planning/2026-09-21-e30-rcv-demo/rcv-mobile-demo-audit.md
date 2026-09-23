# RCV Mobile demo 记忆覆盖与时效核查

2026-09-21 · E-30 · 核查用户命名空间 `esone.qiu` · 时间统一为北京时间（UTC+8）

**结论：不是整个记忆库没有 RCV Mobile demo 信息。最新 Edit notes 的日历安排和私聊在原 Ask 之前已经入库；另有明确的历史 Mobile demo 录屏消息。问题同时涉及召回遗漏、跨来源关联不足、Slides 正文未采集，以及消息同步延迟。建议渐进修复现有链路，不更换数据库或整体记忆架构。**

本次只读核查生产存储、Desktop 本地快照、当前来源及代码，未修改生产代码、配置、记忆或外部内容，未重新执行 Ask、同步、部署或外部查证任务。

## 1. 当时已经有什么证据

Desktop 保存了原问题 `rcv mobile有什么 demo 么？` 和与用户粘贴内容一致的回复摘要，快照时间 **09-21 13:58:54**。同期唯一的本地 `/assistant/ask/stream` 请求为 **13:54:52–13:58:54**，HTTP 200、耗时约 **241.5 秒**；日志没有请求正文，因此这是时间强关联，不是完整请求回放。服务端同题外部查证 action 于 **13:55:05** 创建。

| 证据 | 来源发生/安排时间 | 已入库时间 | 能证明什么 |
|---|---|---|---|
| 用户对 Sandy：“明天要demo Edit notes么，后天 weekly” | 09-20 21:59:56 | 09-20 22:21:31 | 原 Ask 之前已有具体 demo 议题线索；问句本身不是已完成证明 |
| Sandy：“奇怪，我约的会怎么不生效，我重新约一个”；同串确认下午 3 点半、邀请次日 weekly | 09-21 08:53 起 | Sandy 主消息 09-21 09:57:37 | 已存原文、摘要及上下文，支持重新安排会议的解释 |
| `pre demo of eidt notes`，组织者 Sandy | **09-21 15:30–16:00** | **08:56:58** 首次写入；09:11:58 更新日历/chunk | `calendar_events`、`messages_raw`、`chunks` 三层都有；不是日历完全没覆盖 |
| `Canceled: pre demo of edit notes` | 原安排 09-21 15:00–15:30 | 09-20 17:06:58 | 旧事件 `cancelled=1`；不能把两个安排当两次有效 demo |
| RCV Mobile VT3 中 Sandy：“pre demo啦, santorini” | **09-21 15:30:49** | **16:22:37** | 实测延迟 **51分48秒**；消息在原 Ask 之后才发生，不能倒推 13:58 时应已检索到它 |
| Video Weekly Sync Up：“Demo recording… Mobile: AVA delegate… Native Client: NC Switcher” | 09-01 14:16:24 | 09-01 14:21:34 | 库中明确有 Mobile demo 录屏链接，不是只有 AI Delegate 后端演示 |
| Video Weekly Sync Up：“Mobile PLG: In-app awareness campaign / Mobile: AI Notes everywhere” demo recording | 08-14 16:51:33 | 08-17 10:51:41 | 更早的 Mobile 演示资料也存在 |

用户给的 [RingCentral 会话](https://app.ringcentral.com/l/messages/1350236299266) 实际解析为 **Esone 与 Sandy 的私聊**（`esone.qiu+sandy.pan`），不是 RCV Mobile VT3 群；后者的会话 ID 为 `54490570758`。这也说明不能只按群名包含 `RCV Mobile` 来找所有相关资料。

可复核消息：

- [Edit notes 私聊原消息](https://app.ringcentral.com/messages/1350236299266/83773714882564)
- [今天 VT3 的 pre-demo 提醒](https://app.ringcentral.com/messages/54490570758/83778348335108)
- [09-01 Mobile AVA delegate 录屏消息](https://app.ringcentral.com/messages/6543474694/83188883636228)
- [08-14 Mobile PLG / AI Notes everywhere 录屏消息](https://app.ringcentral.com/messages/6543474694/82662908526596)

消息链接按实际存储的 groupId/postId 定位；本次核查了存储文字，没有播放录屏或验证其内容及当前可访问性。

## 2. Slides：现在有明确内容，但没有相应正文记忆

通过 Google Drive 读取指定的 [Application Video Weekly Report](https://docs.google.com/presentation/d/1-KAOc2R704jxGQo9OuF3bdIfmqKAzQCTRiWISTpQso8/edit?slide=id.g37870fe1fcb_0_0#slide=id.g37870fe1fcb_0_0)，当前正文明确写着：

> Demo — Mobile: Edit notes in AI notes - Sandy Pan

正文另有 Video Mobile 26.4.10、MTR-144579 / Allow host to edit notes，与该议题相符。

数据库核对结果：指定 deck URL 作为直接 `source_url` 的 raw 为 **0**，对应 source-memory capsule 为 **0**，上述明确 demo 文本在 raw/chunks 中精确匹配均为 **0**。但该文件 ID 在其他内容里出现 **46** 次（29 条 calendar、14 条 glip、3 条 web）；3 条 web 的源其实是 RingCentral 页面。**记住了链接，不等于读入了文稿正文。** 精确匹配为零不能排除别处有改写摘要，但结合直接来源与 capsule 缺失，可确认没有发现这份 deck 的正常正文入库记录。

该文稿当前 `modified_time` 为 **09-21 16:48:48**，晚于原 Ask。没有做历史修订回放，所以只能证明现在有这条 demo 内容，不能证明 13:58 时这行已经存在。

## 3. 为什么已有日历、私聊也可能找不到

### 已证实的检索机制和现场数据

Ask 的默认 public topK 为 10，deep 内部扩大到 15，每通道通常先取 45；带解析过滤条件时会有更大窗口。原句的词法转换是：

```text
FTS: "rcv" OR "mobile有什么" OR "demo" OR "么"
raw terms: rcv, mobile, demo, 有什
```

它不是要求同时含 rcv/mobile/demo 的 AND 查询。仅有 `demo` 的日历能匹配，但仍要与大量候选竞争。raw 搜索把正文、标题、**群名**一起计词；RCV Mobile 群里不谈 demo 的消息，也天然命中 rcv 和 mobile 两项。

在当前保留数据上，按实际排序公式只读复算：

| 目标 | 当前原句词法名次 | 当前路径的主要窗口 |
|---|---:|---|
| `pre demo of eidt notes` chunk 331840 | **work 范围 FTS 第 774**；不限定范围第 911 | 默认 FTS 前 45 |
| 同一日历 raw | **第 626** | raw 初选最多 120，随后继续裁剪 |
| 昨晚 Edit notes 私聊 raw | **第 641** | 同上 |
| 09-01 Mobile AVA 录屏 raw | **第 144** | 同上 |

仅对当前 raw 再加“入库时间不晚于 13:55:05”，三条分别为第 **621、635、143**。这是当前存量的时间截断近似，**不是历史数据库快照，也不是完整 Ask 重放**；真实当次 query expansion、其他通道、去重与后过滤不能由此完全恢复。

该日历在 `chunks_vec` / `messages_vec` 中均没有向量，`entities_json` / `matched_projects_json` 为空，chunk 的 `related_project` 反而存事件标题。缺向量不是“绝对不可召回”，但减少了一条补救路径。时间加权发生在候选合并之后，无法救回已经被 SQL LIMIT 截掉的记录。

因此，**已有记忆落在候选窗口外、并缺少把 Mobile → Edit notes → Sandy → 日历串起来的关联，是有现场证据支持的主要原因**。这比“记忆库没有”更符合现有证据；是否还在后续 attribution/cohesion gate 被过滤，缺少当次完整 trace，不能断言。

### 两个容易误判的点

- **项目硬过滤确实有风险，但不是本次已证实原因。** 自动识别的 watched project 会成为硬过滤，而日历项目标签缺失；但现场 16 个活跃 watched projects 没有 RCV Mobile 及相应别名，不能拿这段代码直接给本次定因。
- `answer_memory_observations` 不是 Ask 全量请求日志。它有 topic lock、intent 和 evidence 门槛，保存 canonical question 而非原问题。不能因为查不到原句，就推断用户没有提问。

Desktop resume 只保存前 5 条证据及裁剪后的 ID，没有 channel/score/diagnostics。前五条确有 AI Delegate 后端演示、VT3 图片、RCV & RCW mobile daily 等，但不能据此前五条断言所有其余候选均未出现。原回答把候选不足呈现为“未发现”，保留了 unknown，然而没有交代实际来源覆盖与遗漏边界。

## 4. 三种采集场景的实现边界

| 场景 | 现有实现 | 本次判断 |
|---|---|---|
| 经常打开 Slides | 专用 Slides 分析器明确不写 Memory Service；通用网页捕捉取 DOM，截前 10,000 字符。视觉候选优先时不会自动保存，不等于原生 Slides 全文/OCR | 存在明确正文采集缺口；浏览频繁本身不是入库承诺 |
| RC 私聊/群消息 | 本人发言有独立 ingestBatch；他人消息经分析与规则筛选。读浏览器 IndexedDB，不是远端全历史。后台按“现在减时间窗口”取消息 | 私聊与 VT3 均有入库实例，非完全缺失；有筛选和可测延迟，离线超过窗口会有漏采风险 |
| Calendar | RC `/video/home` 初始化后读 Calendar/event2，约 5 分钟一次，过去 1 天至未来 14 天、最多 300 条；Outlook 另有约 30 分钟任务和授权/配置门槛 | 本条已及时入库；弱点主要在项目/话题关联、索引完整性与 Ask 排名；Desktop Ask 不会因此变成即时读所有日历 |

消息周期不能只看某一处默认值：任务定义有 30 分钟兜底，通用 envConfig 默认 120 分钟、上下文窗口 125 分钟；本仓库 `.env` / `.env.development` 分别配置了 60 / 180 分钟。**没有读取安装扩展的当前持久化调度配置，不能断言用户现场使用了哪个周期**。51分48秒是这条消息的端到端入库差值，不能单凭差值归咎某个定时器。

另一项文档更新风险：source-memory 指纹只含正文前 4,000 字符；尾部更新可能被当成重复。该机制已从代码确认，但本次 deck 根本没有正常正文记录，所以不是本案已证实的直接触发点。

## 5. 建议调整：先修候选和来源链路

建议让下一次同类问题直接得到：“近期是 Edit notes in AI notes，Sandy 负责；日历安排 9月21日15:30 pre-demo；是否完成及新录屏尚未证实。另有9月1日 Mobile AVA delegate 的历史录屏消息。”每项引用对应证据，分清安排、讨论、完成与材料。

| 方案 | 收益 | 成本/局限 | 判断 |
|---|---|---|---|
| 只调 prompt 或扩大 topK | 快速减少部分漏报 | 不能读到未入库 Slides；扩大上下文仍受前置截断、群名噪声影响 | 只作小对照实验 |
| 修现有采集、索引、分路候选与回答边界 | 直接覆盖本案三条链路；复用当前 SQLite、Source Memory、Ask | 需要真实回归集与同步状态记录 | **推荐** |
| 重做连接器、全面切换 v3 或更换向量/图数据库 | 长期可能改善覆盖与关联 | 权限、迁移、成本更高；缺失正文与截断问题不会自动消失 | 现阶段不采用 |

**P0：召回与回答契约。**

1. 将 query 拆成主题（RCV Mobile）与意图（demo/演示/预演/录屏），修中英文粘连分词；同时保留原句通道。为近期待办日历、demo 讨论、演示材料各给有限候选配额，不让群名双词匹配吃完所有窗口。已有明确的用户范围仍是硬边界。
2. 命中 `demo` 的日历即使没写 Mobile，也先作为候选保留；通过 Edit notes 议题、Sandy、上下文 thread、ticket 或文件链接验证关联。不能仅因同一个人参会或同一天，就把日历强认成 RCV Mobile。
3. 对已授权来源做一次有预算的二次本地检索：例如最近 demo/预演日历和相关会话；仍缺少证据时表述为“本轮未找到”，并说明哪些来源未采集/未更新。不要把查证任务 queued/running 当成已经检索到新资料。
4. 输出区分 `scheduled / discussed / completed / recording_available / cancelled`。用户问句可以证明“讨论过这个话题”，不能作为完成事实；旧 backend demo 也不能代表项目全部 Mobile 能力。
5. 记录最小可复核 trace：请求 ID、实际查询、范围、各通道候选 ID/排名、裁剪或过滤理由、最终 refs、来源覆盖状态。短期留存、脱敏，不记录会议口令或完整无关对话。已有恢复快照不是诊断日志替代品。

**P1：补三类来源的供给与更新。**

- **Slides**：对已经授权、已纳入采集范围的指定文稿，复用现有 Google 读取能力接入 Source Memory；原生读取各 slide 的文本、表格与锚点。用 `presentationId + slideId + 完整规范化内容 hash` 保存版本，不把前 4,000 字符当版本身份。图片型内容单独标为未提取，按需再做视觉解析。先在打开/重访文稿时检查版本，再评估周期同步。
- **RC**：将“可靠保留已授权范围的源证据”和“LLM 判定是否提醒”分开，避免只有被提醒的他人消息才有记忆机会。使用成功处理水位、重叠窗口、按 postId/编辑版本幂等处理、休眠后补偿；本地缓存已丢失时标明 gap。消息删除也要传播状态。源证据保留期与范围明确配置，不全量永久保存所有群。
- **Calendar**：保留现有事件身份，补统一索引与异步 embedding/project-topic links；`related_project` 不再混装标题。分开事件时间、观察时间、最后成功扫描时间，避免把未来会议时间当入库新鲜度；取消、删除、更改时间必须让 raw/chunks/向量与当前状态一致。
- **覆盖信息**：记录 `lastAttemptAt / lastSuccessAt / sourceWatermark / observedAt / indexedAt / error / gap` 等内部收据，在 Ask 需要说明缺口时使用。未变化日历不更新 `synced_at`，所以不能直接用它冒充最后成功扫描时间。

复用已有 `docs/features/ask.md`、`memory_capture.md`、`memory_coverage_map.md` 和 `memory_foundation.md`。保鲜水位可对齐已有 `memory-freshness-radar-plan.md`；不重启已搁置的成果记忆链，也不新增一个让用户逐条审批内部记忆的管理台。当前已有 v3 provisional open_question“明天是否要demo Edit notes”，但 Ask 代码主路径仍调用现有 RecallEngine，v3 shadow 中存在并不等于最终回答会用到它。

## 6. 小规模验证与停止条件

先以三种来源、近 30 天限定数据做修复实验，冻结脱敏样本，至少覆盖：

1. 原句、`RCV Mobile 最近演示`、`Mobile 的 Edit notes 预演`、精确错拼 `eidt notes`。
2. 只有日历、只有私聊、已有明确材料、来源尚未采集四种证据组合。
3. 大量 RCV Mobile 群闲聊竞争时仍召回目标事件；取消旧15:00、保留新15:30；会议结束但没有完成/录屏证据时不越界。
4. Slides 首次捕捉、重复读取、只改第4,000字符之后的正文、只改某张 slide、权限撤回。
5. 浏览器关闭超过125分钟后恢复；缓存缺记录；被过滤消息；编辑/删除；短暂服务失败后重试不重复。

**建议验收指标（目标，不是本次已测结果）**：核心正例对应的有效证据 Recall@10=100%；负例无虚构完成、录屏或来源覆盖；取消状态正确率100%；候选泛化集不显著降低精确率。在线活跃来源可先设端到端入库 P95≤5分钟，离线恢复后目标≤10分钟且有 gap 收据；需先测基线并确认成本，再定正式 SLO。固定快照离线检索 P95 延迟增量≤20%，避免先扩 LLM 调用。单次13:58请求的241.5秒仅是排障线索，不能当P95基线。

按仓库规则建立 `evals/` 场景，`eval:validate`、新 suite 单次运行并检查报告；变更 Recall/Ask/写路径时再跑 `npm run eval:memory-abilities`，六项能力任一回退超过0.05即不得交付。Desktop、扩展、真实源链路分层验收；本次未实现，故没有宣称这些测试已经通过。

若修完候选与索引仍无法稳定连接正确事件，且误关联控制不住，再比较现有图关系增强与 v3 读取；若失败主要来自缓存/离线覆盖，再试受限官方连接器。未达到上述触发条件，不做高成本迁移。

## 7. 代码与资料依据

代码基线为本地 HEAD `749c069`；工作区已有其他任务的改动，本次未触碰。只读比对了当前部署 `RecallEngine.js` 的 FTS 分词、raw 限120/排序，以及 `ask.js` 的 topK/deep 主路径，与引用源码机制一致；这不是对13:58运行版本的完整历史证明。

| 判断 | 代码位置 |
|---|---|
| Slides 分析不写记忆 | `src/contentScriptGoogleSlide.tsx:57` |
| DOM截断、视觉分支、自动保存门槛 | `src/contentScriptWebIntelligence.ts:2935`、`:3140`、`:5094`、`:5182` |
| source fingerprint前4000字符/重复处理 | `memory-service/src/core/SourceMemoryCaptureService.ts:475`、`:563` |
| RC IndexedDB/群筛选 | `src/metadata/message.ts:699`、`:1140` |
| owner入库、他人消息门控 | `src/messageDealing.ts:559`、`:1265`、`:1844`、`:1919` |
| RC任务周期/窗口 | `src/utils.ts:533`、`src/services/BackgroundJobs.ts:721`、`:1514` |
| Calendar采集窗口与触发 | `src/context-assist/ringCentralCalendar.ts:34`、`src/contentScriptRingCentralVideoHome.ts:163`、`:2931` |
| Calendar写三层/取消处理/时间语义 | `memory-service/src/routes/calendarEvents.ts:107`、`:323`、`:375`、`:394` |
| Ask topK及后过滤 | `memory-service/src/routes/ask.ts:1573`、`:1652` |
| 分词、FTS/raw窗口/排序、时间加权 | `memory-service/src/core/RecallEngine.ts:386`、`:440`、`:1210`、`:1334`、`:2215` |
| deep overfetch再截取 | `memory-service/src/core/ActiveRecallService.ts:151` |
| 自动项目识别与硬过滤 | `memory-service/src/core/QueryIntentParser.ts:205`、`memory-service/src/core/RecallEngine.ts:2622` |
| observation写入门槛 | `memory-service/src/core/AnswerMemoryService.ts:542`、`:687` |

官方接口依据均于 **2026-09-21** 访问，仅用于验证可行性，不代表本产品已接入：

- Google，[Slides presentations.get](https://developers.google.com/workspace/slides/api/reference/rest/v1/presentations/get)，页面更新2026-08-31：支持读取指定 presentation 与 `presentations.readonly`。内容权限仍应限制到用户认可的文件范围。
- Google，[Drive changes.list](https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list)，页面更新2026-07-07：分页消费完后使用 `newStartPageToken` 继续跟踪变化；`drive.metadata.readonly` 不替代 Slides 内容权限。第一阶段可不接全 Drive changes。
- RingCentral，[官方 OpenAPI 规范](https://assets-developers.ringcentral.com/dpw/api-reference/specs/public/office/rc-platform.yml)，版本 `1.0.60-20260812-12a43af6`，资源更新2026-08-13：chat posts GET 支持 `recordCount`（默认30、最大250）和 `pageToken`，没有 `modifiedSince`。`TeamMessaging` scope 包含写能力，不应包装成只读授权；应用限定 GET 仍需要权限复核。成功水位属于我们自己的同步机制，不能把分页 token 宣称为可靠永久增量游标。

## 8. 核查范围与置信度

只读连接真实用户数据库时使用 `readonly` 与 `query_only`，搜索 raw/chunks/calendar/source-memory/v3 unit，并用精确来源 ID、日期与关键词变体交叉核对。约16:54的一个计数截面为 **16,757 raw、25,169 chunks、1,086 calendar events、1,065 source-memory capsules、421 memory units**；采集仍在继续，计数会变化。此范围是当前保留的该用户数据，不包括已删除历史、备份及其他用户库；正例已足以否定“全库没有”。

**高置信**：有相关记忆且日历/私聊早于原 Ask；当前 Slides 有明确议题但未发现其正文入库；今天VT3消息有51分48秒延迟；当前词法路径会截掉关键证据。

**中等置信**：原回答主要由候选竞争与跨来源关联不足造成。缺少当次完整候选 trace、历史部署版本和Slides旧修订，无法将所有责任精确归到某一步；这三项证据可能改变细节归因，但不会改变优先修现有采集与召回链路的建议。

附带交付的两份 JSON 只保留本案必要证据、名次复算与Desktop脱敏快照。宽范围中间查询结果已清理，未附会议口令、token或完整无关日历。
