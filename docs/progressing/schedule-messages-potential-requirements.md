# Personal AI（Chrome Extension）在 RingCentral/Glip 中的潜在需求场景清单

> 目标：整理真实工作聊天中的"消息处理/沟通闭环/项目运营"场景，并标注是否适配当前 Personal AI 能力（定时以我身份发消息 / Bot 提醒与推送 / JQL+LLM 分析推送），用于后续挑选优先实现的 MVP 场景。

---

## 📋 Todos（待实现功能）

> 以下是经过分析后选出的、适合本项目且可优先实现的功能列表。每条 todo 对应文档中的需求位置。

### 🔴 优先级 P0（核心 MVP）

- [ ] **T1. 稍后处理（Snooze）** → [§3.1](#31-snooze稍后处理延迟提醒)
  - 实现：在 RingCentral/Glip 任意消息上悬停 1.5 秒后，右下角出现带红色 icon（`@static/icons/icon16.png`）的菜单
  - 菜单中一个文字按钮是"稍后处理"
  - 点击后弹出窗口选择时间，默认明天 9 点
  - 确认时间后在 scheduled messages（Google Sheet）添加一条记录：
    - `Push_Method`: Bot
    - `Schedule_Date` / `Schedule_Time`: 用户选择的时间
    - `Content`: 包含原消息的链接/内容摘要
    - `Glip_User_Name`: 当前用户（私聊提醒自己）
  - 到时由 Jira Automation 执行 Bot 推送提醒我处理该消息

- [ ] **T2. 匹配自动回复** → [§3.6](#36-下班专注模式自动回复) / [§5.1](#51-自动澄清问题减少往返)
  - 实现：同样在悬停 1.5 秒的菜单中有"自动答复"按钮
  - 点击后弹出配置窗口：
    - LLM 根据当前消息生成回复建议（多一个勾选，每次 AI 生成类似答复）
    - 勾选匹配条件：
      - ☐ 匹配类似内容（LLM 语义匹配）
      - ☐ 匹配发送者（同一发送人）
      - ☐ 匹配在当前群组（同一 Team ID）
    - 同时满足勾选的条件时触发自动回复
    - 审核模式开关：
      - 选项1："仅添加到审核列表"（需手动确认后发送），可以考虑直接用定时消息的 status 来过滤审核列表
      - 选项2："自动答复前 X 小时可拦截"（用户输入小时数，在此时间窗口内可取消），同时要推送通知给用户提醒用户审核（chrome notification，以及 调用 @bot.ts 推送给用户）
  - 存储结构需扩展，新增 `auto_reply_rules` 表或字段

### 🟡 优先级 P1（高价值扩展）

- [ ] **T3. 分阶段回复** → [§3.2](#32-分阶段回复先回执后结论)
  - 在悬停菜单中添加"快速回执"按钮
  - 一键发送回执消息（以我身份 AsMe）："收到，我先看一下"
  - 同时创建定时提醒（Bot）在 N 小时后提醒我补充结论
  - 技术：调用 ScheduledMessageService 创建两条消息

- [ ] **T4. 自动追问（等对方反馈）** → [§3.4](#34-等对方反馈的自动追问)
  - 在悬停菜单中添加"设置追问"按钮
  - 配置：X 小时后如果该线程无新回复，则以我身份（AsMe）追问
  - 需扩展：线程监控机制（检测是否有新回复）

- [ ] **T5. 消息一键转 Todo** → [§4.1](#41-消息一键转-todo提醒链)
  - 在悬停菜单中添加"转为待办"按钮
  - LLM 自动提取行动项（人物、截止时间、任务内容）
  - 创建提醒链：到点提醒我 / 追问对方 / 升级

- [ ] **T6. Jira Ticket 摘要卡片** → [§6.3](#63-群里提到某-ticket-自动补全上下文卡片摘要)
  - 已部分实现：Jira 链接悬浮卡片功能（`contentScript.tsx`）
  - 待扩展：在群里发送消息时自动识别 Jira key，Bot 发送摘要卡片

### 🟢 优先级 P2（增强体验）

- [ ] **T7. 批量延迟回复队列** → [§3.7](#37-批量延迟回复消息队列集中处理窗口)
  - 将多条消息加入"待处理队列"
  - 在固定时间窗（如 11:30/17:30）Bot 提醒我集中处理

- [ ] **T8. 温和提醒模板** → [§3.8](#38-礼貌提醒他人避免催促感)
  - 在悬停菜单提供"温和提醒"模板
  - 以我身份（AsMe）定时发送礼貌追问

- [ ] **T9. 每日个人待办雷达** → [§6.5](#65-个人待办雷达assigneeme)
  - 定时跑 JQL（assignee = currentUser()）
  - LLM 排序并给今日建议
  - Bot 每日早上私聊推送

### 🔵 优先级 P3（后续规划）

- [ ] **T10. 长线程总结** → [§5.5](#55-长线程代我总结--收口结论)
- [ ] **T11. 多级升级机制** → [§3.5](#35-多级升级escalation-ladder)
- [ ] **T12. 未回复监控** → [§3.3](#33-未回复监控if-no-reply-then-remind)
- [ ] **T13. 消息一键生成 Jira Ticket** → [§4.2](#42-消息一键生成-jira-ticket或补全字段)

---

## 1. 现有能力抽象（可组合的动作原语）

> 基于项目代码的实际能力总结

### A1. 以"我"的身份发送定时/延迟消息（AsMe）
- **技术实现**：Google Apps Script + Gmail → Glip Email 网关
- **特点**：
  - 通过发送邮件到 `{username}@reply.ringcentral.glip.com` 实现
  - 由 Apps Script 每分钟触发执行
  - 在 Glip 中显示为用户本人发送的消息
- **用途**：延迟回复、自动回执、定时跟进、分阶段沟通、到点补充结论等

### A2. Bot 发送提醒/通知给我或群组（Bot）
- **技术实现**：Jira Automation → 内网 Bot API
- **特点**：
  - 每分钟由 Jira Automation 触发，调用 AppScript Web App
  - AppScript 读取 Google Sheet，调用 Bot API 发送消息
  - 支持私聊（`Glip_User_Name`）和群组（`Glip_Team_ID`）
- **用途**：提醒我处理、提醒他人补信息、群内播报、定时汇总推送

### A3. LLM 分析 Jira JQL 数据并由 Bot 推送结果（AI）
- **技术实现**：Jira Automation → AppScript → 外部 AI API（如 Dify）→ Bot 推送
- **特点**：
  - 支持 `{Topic}`、`{Content}` 变量替换
  - 提供 AI Report / PEP Report / 自定义三种模板
- **用途**：项目健康度、风险识别、趋势与分布分析、瓶颈定位等

### A4. RingCentral/Glip 消息交互（Content Script）
- **技术实现**：Chrome Extension Content Script 注入到 `app.ringcentral.com`
- **现有能力**：
  - 获取用户信息（`GET_USER_INFO`）
  - 获取消息数据（`FETCH_USER_MESSAGES`）
  - Jira 链接悬浮卡片（已实现，悬停 300ms 显示）
  - 消息 LLM 分析和实体提取
- **待扩展**：消息悬停菜单（Snooze / 自动答复 / 快速回执等）

---

## 2. 场景目录与适配度说明

- **适配度（当前项目能力）**
  - ✅ 直接适配：现有能力即可落地
  - ⚠️ 可适配（需扩展）：需要增加 Content Script 交互或存储结构
  - ❌ 不建议：更适合 Bot 或风险较高，不建议默认用"我身份"自动发

- **实现复杂度（建议）**
  - S：简单（规则/模板/定时器即可）
  - M：中等（需要 Content Script 扩展、状态检查、队列）
  - L：复杂（需要链接读取、RAG、外部 API 写入、权限治理）

---

## 3. 高频基础类：单条消息延迟处理与跟进（优先推荐）

### 3.1 Snooze（稍后处理/延迟提醒）
- **用户痛点**：消息已读但当下无法处理，易忘。
- **Personal AI 实现方案**：
  - 在 Glip 消息上悬停 2 秒，显示操作菜单
  - 点击"稍后处理"，选择提醒时间（默认明天 9 点）
  - Bot 在指定时间私聊提醒我（包含消息链接/摘要）
  - 可选：以我身份自动回"收到，我会在 X 点前回复"（AsMe）
- **适配度**：✅
- **复杂度**：M（需扩展 Content Script 悬停菜单）

### 3.2 分阶段回复（先回执后结论）
- **用户痛点**：需要即时响应但结论要调查。
- **Personal AI 实现方案**：
  1. 以我身份（AsMe）立即/延迟 1–2 分钟回执："收到，我先查一下"
  2. 定时 Bot 提醒我补充结论
  3. 到点仍未处理可自动发"我还在查，预计 X 点更新"（AsMe，可配置）
- **适配度**：✅
- **复杂度**：S–M

### 3.3 未回复监控（If no reply then remind）
- **用户痛点**：线程太多，容易漏回。
- **Personal AI 实现方案**：
  - 定时检查：若我未在该线程回复，则 Bot 提醒我
  - 可选：以我身份（AsMe）补一句"我在跟进，X 点更新"
- **适配度**：⚠️（需扩展线程状态检测）
- **复杂度**：M（需要"我是否已回复"的检测）

### 3.4 等对方反馈的自动追问
- **用户痛点**：等待他人补信息，反复拉扯耗时。
- **Personal AI 实现方案**：
  - 设置 X 小时后自动追问（以我身份 AsMe）：请求日志/链接/结论/截图等
  - 同时 Bot 提醒我关注是否收到回应
- **适配度**：✅
- **复杂度**：S–M

### 3.5 多级升级（Escalation Ladder）
- **用户痛点**：依赖方不响应导致阻塞。
- **Personal AI 实现方案**：
  - 24h 温和追问 → 48h 抄送/拉群 → 72h 升级到负责人（可配置）
  - 建议提供：白名单、敏感群禁用、发送前确认
- **适配度**：✅（但建议加强治理）
- **复杂度**：M

### 3.6 下班/专注模式自动回复
- **用户痛点**：不想"已读不回"影响协作体验。
- **Personal AI 实现方案**：
  - 在非工作时间或专注时段自动回"我已离线/我在深度工作，X 点统一回复"（AsMe）
  - 可通过匹配规则配置触发条件
- **适配度**：✅
- **复杂度**：S

### 3.7 批量延迟回复（消息队列/集中处理窗口）
- **用户痛点**：同类消息太多，希望集中处理。
- **Personal AI 实现方案**：
  - 将消息加入"待处理队列"（扩展 Google Sheet 或本地存储）
  - 在固定时间窗（如 11:30/17:30）Bot 提醒我，并支持一键发出整理后的回复
- **适配度**：✅
- **复杂度**：M（队列与 UI）

### 3.8 礼貌提醒他人（避免"催促感"）
- **用户痛点**：需要提醒但不想显得 pushy。
- **Personal AI 实现方案**：
  - 以我身份（AsMe）定时发送"温和提醒模板"
  - 或让 Bot 以中性口吻提醒（更适合群场景）
- **适配度**：✅
- **复杂度**：S

---

## 4. 任务化：从聊天到可执行工作项（适合做"效率飞轮"）

### 4.1 消息一键转 Todo/提醒链
- **用户痛点**：聊天里行动项没人记。
- **Personal AI 实现方案**：
  - 从消息提取行动项（使用现有 LLM 实体提取能力：`extractEntitiesFromMessage`）
  - 创建提醒链：到点提醒我/追问对方/升级
  - 存储到 Google Sheet 作为定时消息
- **适配度**：✅
- **复杂度**：M

### 4.2 消息一键生成 Jira Ticket（或补全字段）
- **用户痛点**：落 Jira 耗时，信息不完整。
- **Personal AI 实现方案**：
  - LLM 抽取：标题/背景/复现/期望/影响面/优先级建议
  - 调用 Jira API 创建/更新 ticket
  - 以我身份（AsMe）把 ticket 链接回帖到线程
- **适配度**：⚠️（需扩展 Jira 写入 API）
- **复杂度**：L

### 4.3 评审/批准类请求自动回执 + 到点提醒
- **用户痛点**：review/approve 请求易漏。
- **Personal AI 实现方案**：
  - 自动回"收到，我会在 X 点前处理"（AsMe）
  - 到点 Bot 提醒我；若未处理，自动更新 ETA
- **适配度**：✅
- **复杂度**：M

### 4.4 阻塞/依赖管理自动化
- **用户痛点**：每天被问 ETA，沟通成本高。
- **Personal AI 实现方案**：
  - 识别"blocked/依赖/卡住/ETA?"，自动要求补充信息（AsMe）
  - 设置"下一次状态更新时间"并定时在群里更新口径
- **适配度**：✅
- **复杂度**：M

---

## 5. LLM 参与的"读懂上下文并代我沟通"（差异化强，但需治理）

> 建议默认"生成草稿 + 发送前确认"，或仅在白名单对象/群启用自动发送。

### 5.1 自动澄清问题（减少往返）
- **用户痛点**：对方提问模糊，来回问很慢。
- **Personal AI 实现方案**：
  - LLM 根据消息类别生成澄清问题清单（bug/需求/数据/权限）
  - 以我身份（AsMe）发出；并设置未回复自动追问
  - 使用现有 `IntelligentAgent` 分析能力
- **适配度**：✅
- **复杂度**：M

### 5.2 事故/线上问题信息收集模板化
- **用户痛点**：事故群信息混乱，关键细节缺失。
- **Personal AI 实现方案**：
  - LLM 生成"事故信息模板"（影响、时间线、回滚、错误码、Dashboard）
  - 建议用 Bot 发；如需我身份发，强制确认
- **适配度**：❌（默认不建议我身份自动发）
- **复杂度**：M–L

### 5.3 帮我写专业回复并定时发送（多语气版本）
- **用户痛点**：跨团队/对客户措辞需要谨慎。
- **Personal AI 实现方案**：
  - LLM 给 2–3 版本（强硬/中性/协作）
  - 我选择版本；定时发送（等数据确认后再发）（AsMe）
- **适配度**：✅（建议发送前确认）
- **复杂度**：M

### 5.4 从引用链接中抽取要点再回复（Jira/Wiki/Sheet/Slide）
- **用户痛点**：对方丢链接让我看，阅读成本高。
- **Personal AI 实现方案**：
  - 抓取链接内容摘要/关键字段（利用现有 Jira 详情获取能力）
  - LLM 提炼结论与风险，并回帖
  - 已有基础：`fetchJiraTicketDetail`、Google Slides Analyzer
- **适配度**：⚠️（需扩展更多链接类型支持）
- **复杂度**：L

### 5.5 长线程"代我总结 + 收口结论"
- **用户痛点**：讨论很长没人收口，行动项不清。
- **Personal AI 实现方案**：
  - 抓取线程最近 N 条消息（通过 `FETCH_USER_MESSAGES`）
  - LLM 输出：共识/争议点/行动项/Owner/截止时间
  - 以我身份（AsMe）发"结论贴"，并建立提醒链
- **适配度**：✅（依赖线程抓取）
- **复杂度**：L

---

## 6. 项目运营与数据洞察（JQL+LLM）：更适合 Bot 推送

### 6.1 每日/每周项目健康度播报（群短版 + 私聊长版）
- **用户痛点**：团队需要节奏化透明的状态。
- **Personal AI 实现方案**：
  - 定时跑 JQL：新增/关闭/超期/高优先级
  - LLM 输出：群公告短版 + 我私聊长版
  - Bot 推送到群/私聊
  - 技术：使用现有 `AI` Push_Method，配合 Dify/PEP Report 模板
- **适配度**：✅（已支持 AI Report）
- **复杂度**：M

### 6.2 风险票自动识别并提醒 Owner
- **用户痛点**：不想靠人肉盯 SLA/超期。
- **Personal AI 实现方案**：
  - LLM 找风险票（due date、久未更新、blocked 标签）
  - Bot @Owner 提醒，并把摘要发我
- **适配度**：✅
- **复杂度**：M

### 6.3 群里提到某 Ticket 自动补全上下文（卡片摘要）
- **用户痛点**：新成员看不懂票背景。
- **Personal AI 实现方案**：
  - 识别 Jira key，抓取摘要/状态/负责人/更新时间
  - Bot 在群里贴卡片摘要
  - 已有基础：`contentScript.tsx` 中的 Jira 悬浮卡片功能
- **适配度**：⚠️（悬浮卡片已实现，Bot 主动发送待扩展）
- **复杂度**：M

### 6.4 发布前阻塞清单（T-24h / T-4h / T-1h）
- **用户痛点**：发布前风险需要提前暴露。
- **Personal AI 实现方案**：
  - JQL 拉阻塞票/未回归/高危
  - LLM 给建议动作
  - Bot 定时推送
  - 技术：利用现有 Timeline 消息类型（基于 Milestone 触发）
- **适配度**：✅（已支持 Timeline 消息）
- **复杂度**：M

### 6.5 个人待办雷达（assignee=me）
- **用户痛点**：每天想知道"我今天最该做什么"。
- **Personal AI 实现方案**：
  - 定时跑 JQL（分状态/优先级/更新时间）
  - LLM 排序并给今日建议
  - Bot 私聊我
- **适配度**：✅
- **复杂度**：M

---

## 7. 文档与表格联动（Wiki/Sheets/Slides）：高价值，需扩展读取能力

### 7.1 Wiki 阅读后总结并给行动项
- **Personal AI 实现方案**：
  - 抓取 wiki 内容
  - LLM 输出 TL;DR / 风险点 / 我的行动项
  - 回帖到线程（我身份 AsMe 或 Bot）
- **适配度**：⚠️
- **复杂度**：L

### 7.2 Sheet 数据快速解释与结论输出
- **Personal AI 实现方案**：
  - 读取指定范围/最近更新
  - LLM 输出：关键指标变化、异常点、下一步建议
  - 已有基础：`contentScriptGoogleSheet.tsx`
- **适配度**：⚠️
- **复杂度**：L

### 7.3 周会 Slides 自动生成/更新并通知
- **Personal AI 实现方案**：
  - 将 JQL 指标/行动项填入 slide 模板
  - Bot 会前推送链接
  - 已有基础：`contentScriptGoogleSlide.tsx`、`google_slides_analyzer`
- **适配度**：⚠️（已有分析能力，生成能力待扩展）
- **复杂度**：L

### 7.4 讨论沉淀到 wiki（会议纪要/ADR）
- **Personal AI 实现方案**：
  - LLM 抽取决策记录与行动项
  - 写入 wiki 并回帖链接
- **适配度**：❌（更适合 Bot）
- **复杂度**：L

---

## 8. 事故与运维类（价值高但风险高：默认 Bot + 审批/白名单）

### 8.1 事故定时状态更新（15/30 分钟）
- **Personal AI 实现方案**：
  - Bot 定时发状态模板
  - LLM 基于最新信息草拟更新（发送前确认）
- **适配度**：⚠️（建议不用我身份自动发）
- **复杂度**：M–L

### 8.2 事故群消息分流（关键进展 vs 噪音）
- **Personal AI 实现方案**：
  - LLM 分类消息：关键进展/请求/日志/猜测
  - Bot 私聊我"关键 5 条"
  - 已有基础：`messageDealing.ts` 中的消息分析能力
- **适配度**：✅
- **复杂度**：M

### 8.3 事故后复盘材料自动生成
- **Personal AI 实现方案**：
  - LLM 输出时间线、根因假设、行动项
  - 写入 wiki 模板并提醒 Owner 认领
- **适配度**：❌
- **复杂度**：L

---

## 9. 推荐优先级（建议先做的 MVP Top 6）

> 标准：高频 + 易落地 + 价值可感知 + 风险可控 + 与现有代码架构契合

1. **Snooze（稍后处理）+ Bot 提醒**（§3.1）→ T1
2. **匹配自动回复**（§3.6 / §5.1）→ T2
3. **分阶段回复：先回执、后提醒、超时自动更新 ETA（可选）**（§3.2）→ T3
4. **自动追问：等对方反馈未回则追问**（§3.4）→ T4
5. **消息一键转 Todo/提醒链（队列）**（§4.1 / §3.7）→ T5
6. **Jira key 识别 → 票据摘要卡片（Bot 发）**（§6.3）→ T6

---

## 10. 关键扩展能力建议（按投入产出比排序）

### E1. 消息悬停菜单 + 发送队列 + 可撤销
- **技术实现**：扩展 `contentScript.tsx`，参考现有 Jira 悬浮卡片实现
- 对任意消息提供快捷动作：
  - Snooze / 自动回执 / 追问 / 加入队列 / 生成草稿 / 结论贴
- 关键：支持"撤销/取消定时发送"、发送前预览确认（对我身份发消息尤其重要）
- 复用现有 `ScheduledMessageService.createMessage()` API

### E2. 线程上下文抓取（为 LLM 提供材料）
- **技术实现**：扩展 `FETCH_USER_MESSAGES` 或新增消息类型
- 拉取同一线程最近 N 条消息、@关系、引用链接
- 一键生成：总结、行动项、澄清问题清单
- 复用现有 `IntelligentAgent` 和 `extractEntitiesFromMessage`

### E3. 链接解析与检索（RAG / Connector）
- **技术实现**：扩展现有 `fetchJiraTicketDetail` 模式
- 自动识别 Jira/wiki/sheet/slide 链接与 key
- 抽取最小必要信息（标题、状态、最后更新时间、关键表格范围）
- 让 LLM 输出"可溯源"，降低幻觉风险

### E4. 工作流编排（Trigger-Condition-Action）
- **技术实现**：扩展 Google Sheet 结构或新增 Rules 表
- 例如：
  - Trigger：有人问 ETA
  - Condition：Jira last updated > 3 天且状态未变化
  - Action：Bot 提醒 Owner + 我身份给 requester 更新口径（需确认）

### E5. 权限与治理（企业场景必要）
- 我身份（AsMe）自动发送：默认白名单对象/群；高风险群强制确认
- 审计日志：何时发、发给谁、基于什么上下文生成
- 敏感关键词策略：承诺日期/外部客户/金额/事故关键群等，强制人工确认或降级为 Bot

---

## 11. 实现时的通用"安全策略"建议（默认值）

- 默认模式：**生成草稿 + 发送前确认**
- 自动发送仅对：
  - 明确模板类（回执/追问/提醒）
  - 白名单对象/群
- 所有定时消息必须支持：
  - 一键取消（利用现有 `Status: Paused` 机制）
  - 到期前提醒我"即将发送"（Bot 提前 X 分钟通知）
  - 历史记录与审计（已有 `Exec_Log` 字段）

---

## 12. 技术实现参考

### 12.1 现有代码资产

| 能力 | 文件位置 | 说明 |
|------|----------|------|
| Jira 悬浮卡片 | `src/contentScript.tsx` | 悬停 300ms 显示，可复用 UI 模式 |
| 定时消息 CRUD | `src/scheduled-messages/ScheduledMessageService.ts` | 封装 Google Sheets API |
| Bot 发送 | `src/bot.ts` | Bot API 调用封装 |
| LLM 分析 | `src/agentThinking.ts` | `IntelligentAgent` 通用分析框架 |
| 实体提取 | `src/services/entityExtraction.ts` | 从消息提取人物/项目/时间等 |
| 消息处理 | `src/messageDealing.ts` | 消息分析和 Bot 推送逻辑 |
| 类型定义 | `src/scheduled-messages/types.ts` | `ScheduledMessage`、`PushMethod` 等 |

### 12.2 待新增的数据结构

```typescript
// 自动回复规则（T2 功能）
interface AutoReplyRule {
  id: string;
  trigger: {
    matchContent: boolean;      // 匹配类似内容
    matchSender: boolean;       // 匹配发送者
    matchTeam: boolean;         // 匹配当前群组
    senderName?: string;        // 触发的发送者
    teamId?: string;            // 触发的群组 ID
    contentPattern?: string;    // LLM 语义匹配描述
  };
  response: {
    content: string;            // 回复内容
    pushMethod: 'AsMe' | 'Bot'; // 推送方式
  };
  reviewMode: 'manual' | 'delayed';  // 审核模式
  delayHours?: number;          // 延迟小时数（delayed 模式）
  status: 'Active' | 'Paused';
  createdAt: string;
}

// 待处理消息队列（T7 功能）
interface PendingMessage {
  id: string;
  originalMessageId: string;    // 原消息 ID
  originalContent: string;      // 原消息内容
  sender: string;
  teamId: string;
  teamName: string;
  addedAt: string;
  remindAt?: string;            // 提醒时间
  status: 'pending' | 'processed' | 'dismissed';
}
```

---

## T3. 用户回复风格学习（未来增强）

### 需求背景
自动答复功能需要生成符合用户个人风格的回复，当前仅依赖 replyContent 模板，无法学习用户的整体回复习惯。

### 功能设计

#### 1. 回复行为监控
- 监控用户在 RingCentral 页面发送消息的操作
- 记录用户的回复内容、回复对象、回复时间、上下文等
- 在 contentScript 中监听消息发送事件

#### 2. 风格分析
- 定期分析用户的回复数据
- 提取用户的语言风格特征（正式/随意、简短/详细、表情使用等）
- 生成 few-shot 示例库

#### 3. Context 记录方案
- 存储位置：chrome.storage.local
- 数据结构：
```typescript
interface UserReplyRecord {
    id: string;
    originalMessage: string;      // 原消息
    userReply: string;            // 用户回复
    sender: string;               // 原消息发送者
    groupName?: string;           // 群组名
    timestamp: number;
    // 分析结果
    style?: {
        formality: 'formal' | 'casual';
        length: 'short' | 'medium' | 'long';
        hasEmoji: boolean;
    };
}
```
- 保留最近 100 条记录用于 few-shot

#### 4. generateAutoReply 集成
- 读取用户回复历史
- 筛选相似场景的 few-shot（同一发送者/群组）
- 拼接到 prompt 中作为示例

### 实现优先级
此功能为未来增强，当前版本暂不实现。

---
