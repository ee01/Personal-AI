# Findings & Decisions

## Requirements

- Reminder 仅接受全新功能 idea；多条时随机选择。
- 若无合格 Reminder，则结合真实 `esone.qiu` 记忆、项目目标和最新产品/研究提出候选。
- 与 `docs/progressing` 的 active/shelved 方案做语义去重，不允许换名重复。
- 交付仅限完整 plan 与必要的中文 HTML demo；不实施运行时代码。
- plan 的详细设计前必须先给真实场景；覆盖竞品、实现、隐私、权限、恢复、eval 和 feature docs 移交。
- Reminder 来源的 idea 在交付后写备注并标记 done。

## Repository/History Findings

- `AGENT.md` 要求把 Personal AI 视为自主反思型私人记忆系统：优先低打扰内部机制与可逆回执，仅在高责任边界要求确认。
- `docs/progressing/to-verify.md` 当前只有 Usage Analytics 部署/运行验证与豆包登录后的真实投递验证，均不是本轮新能力候选。
- 最近已规划 `Routine Delta Memory`、`Common Ground Memory`、`Teach Once Memory`，以及大量生命周期、来源、注入、主动回忆、跨 AI 上下文方案；必须明确近义排除。
- 2026-08-26 的自动化 planning 停在 Phase 1，没有产出或 memory 记录，本轮不能假装已完成。
- 2026-09-07 通过 Reminders 当前辅助功能树直接读到 `Personal AI, 0 reminders`；列表存在，但没有未完成条目，因此不存在可随机选择的全新 Reminder idea。历史 memory 中 2026-08-12/19 的 EventKit 读数是 4 条已完成、0 条未完成，与当前 UI 的“隐藏已完成后为 0”一致；本轮不修改 Reminder。
- `memory-frontier-2026-index.md` 已覆盖召回评测、注入防护、PPR、行为亲密度、来源可见、记忆演化/TTL、睡眠期预计算、主动性代价、MCP、级联删除、skill 质量门控。其他计划还覆盖操作轨迹、成果来源链、研究足迹、桌面选区、会话漂移、反思治理、决策回放、相关性训练、主动回忆、跨 AI 搬运等；新点子必须绕开这些语义中心。

## Research Findings

- 线上 `esone.qiu` 库当前含 14,610 条 `messages_raw`；按来源约为 Glip 11,775、Calendar 822、Jira 339、Meeting 313、Web 285，另有少量 system/Doubao/outreach。库文件约 1.38GB，mtime 为 2026-08-30。
- 当前派生能力使用明显不均：`conversation_context_frames=316`、`rehearsals=214`、`day_briefs=65`、`memory_claims=13,373`，但 `anticipation_briefs=0`、`memory_outcome_events=0`、`skill_executions=0`。这是候选线索，不直接等同产品缺陷。
- HTTP `/health` 当前返回 `degraded` 且 `database.connected=false`；`/api/v1/stats` 未带服务 API key 时返回 401。真实数据分析因此采用 SSH + `sqlite3 -readonly`，不执行任何写入。
- 修正时间单位后，线上消息最新到 2026-09-02；最近 180 天有 Glip 5,265、Calendar 822、Jira 339、Meeting 308、Web 285 等记录。`Esone Qiu` 在其中有 2,478 条 Glip 消息；关键词聚合显示 467 条含链接、282 条涉及 AI 工具、265 条涉及 Jira、108 条涉及文件/文档、95 条引用“之前/上次/刚才/继续”。这些只说明跨来源与连续工作很常见，不宣称单条召回错误。
- 最近 180 天共有 334 个小时桶同时出现至少 2 类来源，76 个小时桶同时出现至少 3 类来源，单小时最高 6 类；50 个自然日出现至少 3 类来源，9 个自然日出现至少 5 类来源。这证明“同一工作时段跨来源”不是边缘形态，但不等同于这些来源一定属于同一个事件。
- 现有 `conversation_context_frames` 按 `sourceType + group/conversation` 固定 key 持续合并，不按事件切段；代码会把项目、主题、角色与锚点追加到同一 frame，并把时间窗扩到最早/最晚消息。线上 316 个 frame 平均跨度 16.3 天、最大 111.4 天；110 个跨度至少 7 天、68 个至少 30 天、8 个至少 90 天；168 个包含至少 5 个 topic，130 个至少 5 个 source anchor。Glip frame 平均跨度 23.7 天、平均约 9.7 个 topic。这是“会话容器不等于事件”的直接结构证据。
- [EM-LLM / ICLR 2025](https://em-llm.github.io/) 用 surprise 初分段、图论边界细化和两阶段召回组织长上下文；启发是边界检测与事件内连续召回应成对设计。
- [CompassMem / ACL Findings 2026](https://aclanthology.org/2026.findings-acl.1123/) 将经验增量切成事件并以显式逻辑边构建 Event Graph，在 LoCoMo 与 NarrativeQA 上提升检索/推理；启发是事件应是可导航的召回单元，不只是 UI 分组。
- [ES-Mem 2026](https://arxiv.org/abs/2601.07582) 用动态事件切分 + 分层记忆，利用 boundary semantics 做精确 episodic localization；直接支持“先定位事件，再取事件内证据”。
- [ARTEM / AAAI 2026](https://ojs.aaai.org/index.php/AAAI/article/view/39773) 把时间、空间、实体和语义一起编码为 event，覆盖 partial cue、uncertainty、recent event、chronological recall；提示 Personal AI 不能只用文本相似度。
- [Memory Storyboard / CoLLAs 2026](https://proceedings.mlr.press/v330/yang26a.html) 用短期缓冲先形成 temporal segments，再转入长期 memory；适合 Personal AI 采用“可撤回 provisional boundary → 离线巩固”的两阶段实现。
- [Event boundaries: Costs and benefits for memory / Cognition 2025](https://www.sciencedirect.com/science/article/pii/S0010027725001799) 提醒边界也有成本：边界附近会重新分配注意力，不能把每次 tab change 都当作新事件；产品需要迟滞、最短时长和可合并策略。
- [How Memory Management Impacts LLM Agents / ACL 2026](https://aclanthology.org/2026.acl-long.27/) 发现高相似记忆会诱发 experience-following，可能造成错误传播和 misaligned replay；事件边界可作为相似度之前的上下文 gate，降低“同词但不同任务”的经验误用。
- [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调 context 是有限 attention budget，应选择最小高信号集合；事件内召回正是比“整个群聊历史 frame”更小的上下文预算。
- [Microsoft Recall](https://support.microsoft.com/en-us/windows/ai/ai-features/retrace-your-steps-with-recall) 提供本地快照时间线、语义搜索、恢复入口与 app/site 过滤；但它的 segments 是截图时间块，不理解“同一小时里两个不同任务”的语义边界。Personal AI 应少存截图，利用已经采集的消息/Jira/会议/网页来切事件。
- ChatGPT 2026 年 7 月已统一搜索 chats/projects/files，6 月 memory 自动更新并提供 sources；这证明“跨对象找回”正在成为基线，Personal AI 的差异应是把多来源证据定位到正确事件，而非再做一层全文搜索。

## Technical/Design Decisions

| Decision | Rationale |
|---|---|
| Demo 默认单文件原生 HTML/CSS/JS | 可直接双击预览，避免网络依赖，并便于自动化点击测试 |
| 先检查真实产品 UI 与 Personal AI 品牌资产 | Demo 应长在现有场景中，而非通用 AI Dashboard |
| 选题候选收敛为 `Memory Scene Boundary / 记忆分镜` | 线上 context frame 证明现有“会话容器”跨度过长；论文也显示事件切分是精确 episodic recall 的关键原语，且与现有方案边界可清晰分离 |
| P0 只使用现有已采集事件与确定性强信号，不持续截图/键盘监听 | 避开 Operation Flight Recorder 与 Working Memory Return Stack 的隐私、稳定性和意图误判问题 |
| 不把 AI Context Passport 的 `episode stitching` 当作本功能替代品 | Passport 只为跨 AI 交接拼接任务片段；记忆分镜是所有已采集来源的底层边界层，也必须把同一群聊里的两个事件可靠拆开 |
| 不把 Interaction Scene Contract 当作本功能替代品 | Scene Contract 描述用户此刻在做什么；记忆分镜描述历史证据属于哪一段，两者分别是 query-side 与 memory-side contract |

## Issues Encountered

| Issue | Resolution |
|---|---|
| 复合 shell 输出超出呈现上限 | 拆分读取并及时把关键结论固化在此文件 |
| 首次把 `messages_raw.timestamp` 当毫秒除以 1000，得到 1970 日期且 recent=0 | 通过数量级识别为秒级时间戳，后续查询改用 `datetime(timestamp, 'unixepoch')` 与秒级 cutoff |

## Resources

- `/Users/Esone/git/personal-ai/AGENT.md`
- `/Users/Esone/.codex/automations/automation-2/memory.md`
- `/Users/Esone/.codex/memories/MEMORY.md`

## Visual/Browser Findings

- Reminders 真实 UI 中 `Personal AI` 位于 `Work` 分组，显示 0 reminders；当前选中的不是该列表，未触发任何状态写入。
