# Findings: Personal AI 新能力规划（automation-2）

## Requirements

- 优先检查本机 Reminders 的 `Personal AI` 列表，只选择全新功能 idea；多条时随机选一条。
- 若无合适 Reminder idea，则结合真实 `esone.qiu` 记忆、当前 AI 技术、竞品、论文与专家观点提出新能力。
- 必须与 `docs/progressing` 中已有或搁置能力去重，并核对现有 features。
- 最终只生成 `docs/progressing/<slug>-plan.md` 和必要的中文 demo HTML，不实现功能。
- Plan 开头给 1-2 个真实场景与逐步体验；包含竞品、UX、架构、边界、风险、rollout、eval 决策、canonical docs 交接。
- 若 idea 来自 Reminder，最终写回摘要和路径并标记 done。

## Research Findings

- `AGENT.md` 要求优先机制、治理层、召回/写入边界与场景契约，避免再做被动总览页或用户维护的 review queue。
- 历史记忆显示，迁移账本、时间口径、记忆变更沙盒、秘密保险箱、主动回忆教练、桌面选区胶囊等概念已被搁置；开放问题退场、证据对齐、执行就绪、会议结果装订器等已经实现或进入 canonical docs。
- automation-2 不是空历史：截至 2026-07-14 的记录已覆盖 Source Memory Distiller、Persona Projection、Memory Continuity/Ask Continuity、Evidence Watch、Prompt Context Compiler、Keystone Briefs、Change Ledger、Open Question Exit、Meeting Outcome Binder 等方向；本轮必须避开这些近邻。
- 2026-07-02 至 2026-07-14 的 EventKit 记录持续显示 `Personal AI` 列表存在但未完成条目为 0；仍需本轮重新读取，不能把旧快照当当前事实。
- 当前 worktree 极其繁忙，含大量他人/用户未提交修改、删除与未跟踪文件；本轮只新增独立 planning 工作文件和最终新 plan/demo，不触碰或整理其他状态。
- 本轮 EventKit 实时结果：Reminders 权限 `fullAccess`（raw 3），17 个可见列表中精确命中 1 个 `Personal AI`，总条目 4、未完成 0；独立 `predicateForIncompleteReminders` 复核成功且仍为 0。无 A/B/C 候选、无随机选择、无完成/备注写回。
- `docs/progressing/to-verify.md` 当前为“暂无”。
- 当前 `IngestionPipeline` 有 owner-authored gate：只有 metadata 带 `isSelf/authorRole=user` 等信号才允许抽取 profile candidate；但 `MessageRaw` 仍只有整体 `sender`，抽取 schema 没有 claim-level owner、speech act、quoted/AI-generated/observed/completed 状态。owner 自己粘贴的引用、AI 草稿、假设与真实自述会进入同一段 extraction prompt。
- 当前 opinion candidate 路径只看非 neutral sentiment + Person entity，并不使用 owner-authored gate；虽然结果为 `pending_confirm`，仍可能把他人的情绪、引用或 AI 文案变成“关于用户的意见候选”。
- 全仓库按 `speaker / attribution / quoted / who said / claim owner / speech act / assistant echo` 扫描，没有发现覆盖 claim-level ownership 的 plan 或 canonical feature；现有“当时谁说了什么”只是 Timeline 回放，“speaker”主要用于会议显示/Storyline 输出，“source attribution”主要指证据来源而非主张归属。
- Memory Frontier 2026 的 11 项规划与完成报告覆盖注入防护、PPR、显著性、weave、merge/evolution/TTL、sleep-time、通知、MCP、级联删除、Skill 质量等，没有 claim ownership；这说明候选不是旧计划换名。
- `Memory Intake Quality Gate` 的搁置原因是独立 review queue 与愿景冲突。claim attribution 必须作为 ingestion 内部机制自动运行，并把 receipt 放在 Capture/Ask/Lens/Compose/Meeting 的现有控制点；不能复活“逐条质检台”。
- ChatGPT 2026 Memory Sources 已把 past chats、saved memories、custom instructions、files/Gmail 等“来源”暴露给用户，并允许 relevant/not relevant、纠正或不再提及；行业 UI 正从“记住了什么”转向“为何这样个性化”，但仍没有细到一段话内部“这是谁的主张”。
- Mem0 V3 `messages` 明确保留 user/assistant role；官方 additive extraction prompt 还特别要求不要把 assistant 对 user 的回声二次抽成记忆。Group Chat 文档要求给每个参与者准确 role，说明角色归属已是基础设施问题；但 role 仍无法表示 user 转述他人、粘贴 AI 草稿或假设。
- Mem0 当前 prompt 明写 `Correct Attribution` 与 `No Echo Extraction`，并把 assistant 新建议/研究结论/计划也视为可抽取信息；Group Chat 进一步按 participant `name + role` 分离 profile。这可作为最低竞品基线：Personal AI 若只加 user/assistant role 并不惊艳，必须做到 claim span、speech act、owner、commitment 与可消费权限的组合。
- Zep/Graphiti 强调每个 entity/relationship 可追溯到 raw episode（provenance）；Granola 文档只在 iPhone 面对面场景支持多 speaker 识别。二者分别覆盖来源 episode 和说话人，但未覆盖 claim-level epistemic ownership。
- `M3-SLU`（arXiv:2510.19358）用 12k+ 多说话人样本显示模型能理解“说了什么”却仍常失败于“谁在何时说的”；`Attribution and the discourse structure of reports`（D&D 2023）把直接、间接、混合引用都建模为 attribution relation，支持先切 claim/report segment 再赋 owner。
- ACL 2024 对话摘要研究发现 LLM 会基于上下文生成“合理但无直接证据”的推断，并把这种错误单列为 contextual inference；这正是把摘要直接当长期事实时的风险。
- 2026 `Hidden in Memory` 与 `From Untrusted Input to Trusted Memory` 显示持久记忆会把外部内容污染为关于用户的记忆，且传统 prompt-injection 防御覆盖不完整。新能力若成立，应把 benign attribution 与 security trust 两条轴分开，而不是重做注入扫描。
- OpenAI 当前 Memory FAQ 说明用户可直接修改 memory summary 或点 Memory Sources 纠正来源，但“完全删除”仍需跨 past chats、files、summary、connected apps 等多个源处理。这印证消费时 source receipt 有价值，也说明不能把修正都推给用户；claim ownership 应默认自动判定，仅在高责任写入或低置信冲突时请求确认。
- `From Untrusted Input to Trusted Memory` 明确列出 instruction-data boundary blindness：文档/UI 中伪装成“记住用户偏好”的内容可能被当作权威写入。现有 repo 的 injection screen 解决恶意指令形态；claim ownership 要解决更广的“内容是谁的、处于什么认知状态、允许进入哪一层记忆”。
- 仓库去重审计最终结论：Claim Attribution 是真实缺口，重叠风险低—中。Injection Defense 管 transport/source trust，Evidence Cohesion 管是否同题，Change Ledger 管事件级 authority/time，Persona Projection 管输出端身份代表，Meeting Binder 管目标—结果闭环；都没有区分同一 owner-authored 消息内的用户自述、他人转述、AI 建议、假设、计划与验证完成。
- 线上只读查询刻意避开会写 analytics 或恢复 stale action 的业务 API，改用 SSH + SQLite `-readonly` + `immutable=1` 聚合查询；未修改远端/本地数据。快照最多落后 WAL 约 30 分钟。
- 线上量化：11,472 messages / 10,261 chunks / 14,186 entities；只有 1,632 条消息有 `isSelf/authorRole`，9,840 条缺失。1,645 条 owner 语料中 91 条至少命中引用、多人 mention、AI、条件/假设或转述风险。
- 161 条 ChatGPT/豆包导入记忆无 sender/role，却已被分成 91 fact、28 task、24 preference、11 note、4 decision、3 policy。1,887 条 entity property 全部 `inferred` 且 source author 为空；1,780 条可连回消息，其中 1,693 条来自非用户消息，793 条证据命中至少一种归属风险。
- Profile 与 opinion 已有 `pending_confirm` 兜底，这是必须保留的安全边界；新能力不是替换确认，而是在候选前降低错误归属和噪声。
- 其他线上强信号已有相邻能力：OpenClaw 失败/超时邻近 Action Readiness / Agent Run Profile，开放 reflection 邻近 Open Question Exit / Evidence Watch，outcome 空白邻近 Memory Outcome Loop。因此主张归属更独立、更底层。
- 最终选择名为 `Memory Claim Attribution / 记忆主张归属`，不采用“防火墙”作为 UI 名，避免和 Injection Defense 混淆；安全效果可以在方案里描述为 fail-closed attribution gate。

## Technical Decisions

| Decision | Rationale |
| --- | --- |
| Reminder 优先使用 EventKit | AppleScript 过去可能漏掉 `Personal AI` 列表 |
| 真实记忆只读且做最小化摘录 | 用场景模式支撑产品判断，不暴露不必要的个人原文 |
| 外部事实优先官方产品文档、原始论文与作者/机构原文 | 需要当前、可核查的竞品与技术依据 |
| 本轮进入自选 idea 分支 | 当前 `Personal AI` 列表没有未完成条目 |
| 候选默认不建独立管理页 | 去重与搁置历史明确反对 review queue；价值在内部归属判定和消费时回执 |
| 最终选 Claim Attribution | 相比 Silent Miss、Correction Memory、Negative Evidence，它有更强的当前数据证据、更广的下游价值，也更少依赖新增用户维护行为 |

## Issues Encountered

| Issue | Resolution |
| --- | --- |
| `git status` 显示大范围既有脏改动 | 严格限定到新建的本轮 planning 目录和最终 plan/demo；不回退、不暂存、不格式化全仓库 |
| zsh 中 `status` 是只读保留变量 | 标题扫描脚本改用 `plan_state`，不重复原命令 |

## Resources

- `/Users/Esone/git/personal-ai/AGENT.md`
- `/Users/Esone/.codex/automations/automation-2/memory.md`
- `/Users/Esone/git/personal-ai/docs/progressing/`
- https://help.openai.com/en/articles/8590148-memory-faq
- https://docs.mem0.ai/api-reference/memory/add-memories
- https://github.com/mem0ai/mem0/blob/main/mem0/configs/prompts.py
- https://docs.mem0.ai/platform/features/group-chat
- https://github.com/getzep/graphiti/blob/main/README.md
- https://docs.granola.ai/help-center/taking-notes/transcription
- https://arxiv.org/abs/2510.19358
- https://aclanthology.org/2023.dnd-14.6/
- https://aclanthology.org/2024.acl-long.677/
- https://arxiv.org/abs/2605.15338
- https://arxiv.org/abs/2606.04329

## Visual/Browser Findings

- Web 搜索确认 ChatGPT Memory Sources 当前把 source-level provenance 放在回答下方书本入口中；这可作为“低打扰、消费时显示”设计参考，但 Personal AI demo 应再展示 claim owner/utterance mode，而不是照搬设置页 review queue。
- Mem0 Group Chat 的公开示例把 Alice/Bob/Charlie 的 React/Vue/Angular 立场分别归到参与者；适合作为对照。Personal AI demo 应展示更难的同一 owner 消息内部混合：`我倾向 Vue`、`Claude 建议 React`、`同事说 Angular`、`先假设 7/1`，并让四种 claim 获得不同长期记忆权限。
