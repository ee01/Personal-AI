# AI Service — Nova Agent 接入 Contact Center Epics

> **Goal:** Air (Nova Agent) <-> RCCC & RingCX (Digital / Voice × Inbound / Outbound × Handoff)
>
> **Overall 背景：**
> - Steve 打算让团队 E2E 地对整个功能负责（Nova 侧），不止负责 Channel，还包括 NCA 的 prompt/TTS 等
> - IVR / Telco 仍由 Troy 团队负责
> - 新做的功能需要考虑如何和 Air 2.0 串联（2.0 目前仅前端概念，后端仍复用现有组件）
> - Bi-Weekly Planning share to Steve
> - **Week 1 目标：** 先基于现有后端跑起来，识别问题；需要前端的话先用大模型随便做一个。下周一内部 Sharing
> - **当前无 PM 支持**（PM 全力赶 10.22 的 2.0 版本），需向上反馈

---

## Epic 1: [RCCC] Nova Agent Inbound Voice 接入

**Description:**

将 Nova Agent 接入 RCCC（RingCentral Contact Center）的 Inbound Voice 通道。核心链路为：外部来电 → IVR 路由 → RCCC 将通话转接至 Nova Agent → Agent 进行多轮对话、收集信息 → 无法解决时 handoff 到人工客服。

此 Epic 同时涵盖 Air 与 RingEX 的解耦（在 Inbound 开发过程中自然完成）、环境搭建、以及 AuditLog 审计日志对接。

### Tickets

#### 1. [RCCC Inbound] Voice + Handoff 接入
- **Assignee:** Zack
- **描述:** 基于现有 IVR → RCCC → Inbound 链路，实现 Nova Agent 在 Voice 通道的介入。Agent 先与用户进行多轮语音对话，收集必要信息，无法解决时 handoff 转接至 RCCC 人工客服处理。需要对接 RCCC 提供的 API 进行 channel 层面的适配。
- **参考:** https://wiki.ringcentral.com/x/_14kQw
- **依赖:** 环境 ready（Tail 组件部署到 Nova 环境）

#### 2. [RCCC Inbound] Air 与 RingEX 解耦
- **Assignee:** Zack
- **描述:** 当前 Air 与 RingEX 存在耦合，需要在 Inbound Voice 开发过程中将两者解耦，使 Air Agent 能独立于 RingEX 运行。此项工作预期随 Inbound 开发自然完成，不需要额外的大量工作。

#### 3. [RCCC Inbound] 开发 & Regression 环境搭建
- **Assignee:** Barry
- **描述:** 当前 RCCC 的开发和 Regression 环境尚未 ready。需要将 Tail（电话拨出服务）组件部署到 Nova 环境（Lab01 / Lab02 / INT 待定），确保 Inbound Voice 端到端可联调。同时需要与 RCCC / RCX 团队确认他们的组件部署在哪套环境上，保证环境对齐。

#### 4. [RCCC] AuditLog 审计日志对接
- **Assignee:** Bernard
- **描述:** 后端需要支持 Account 级别的审计日志功能，记录用户对 RCCC 系统所做的操作（如 Agent 配置变更等）。PM 需求已有，属于小功能，预估约 1 人天。需要对接设备侧的 Account 审计体系。

---

## Epic 2: [RCCC] Nova Agent Outbound Voice 接入

**Description:**

将 Nova Agent 接入 RCCC 的 Outbound Voice 通道。Outbound 场景即主动外呼：系统按预定义的联系人列表和定时规则主动拨出电话，对方接通后 Nova Agent 介入对话，无法解决时 handoff 到人工客服。

整体流程：NOCC（前端配置界面）→ NOA（编排服务，存储联系人列表、定时任务等）→ Telco/Tail 服务拨出电话 → 对方接通 → 平台建立连接后产生 Inbound 事件回流 IVR → Agent 处理。因此 Outbound 接通后的 Agent 处理逻辑（Bot Leg）可以复用 Inbound 的设计。

Kasni 团队已有一版 design，基于 assistant-runtime-ng 改动。RCCC 团队已有 demo（除 handoff 外已跑通）。

**关键待确认项：** Outbound 拨出是走 RCCC 平台的能力，还是走我方 Telco 服务直拨？这决定了我方组件是否需要额外适配。

### Tickets

#### 1. [RCCC Outbound] Voice + Handoff 接入
- **Assignee:** Dylan
- **描述:** 实现 Outbound Voice 场景下 Nova Agent 的介入和 handoff 能力。对方接通后 Agent 进行多轮语音对话，无法解决时转接人工客服。Bot Leg（Agent 处理逻辑）可复用 Inbound 的设计，开发重点在于 Outbound 触发链路的对接和上下文（标识本次为 Outbound 触发）的传递。需基于 assistant-runtime-ng 进行改动。
- **参考:** Kasni design https://wiki.ringcentral.com/x/iM8sR

#### 2. [RCCC Outbound] 需求确认：拨出走 RCCC 还是 Telco
- **Assignee:** Dylan
- **描述:** 当前 Outbound Voice 的拨出存在两种可能路径：(1) 复用 RCCC 平台自有的拨出能力，我方不需做额外适配，仅需在 RCCC flow 中配置 Agent 脚本；(2) 由 Nova 侧的 Telco/Tail 服务直接拨出。需与 RCCC 团队确认实际方案。如果走 RCCC 平台，则我方代码改动极小（仅需写配置脚本在 RCCC 上运行）；如果走 Telco，则需要更多开发工作。

#### 3. [RCCC Outbound] 现有 Demo 验证 & Gap 识别
- **Assignee:** Dylan
- **描述:** RCCC 团队已有 Outbound 的 demo（注册美国电话号码 → 在 RCCC 平台配置拨出对象列表 → 触发外呼 → 对方接通后进入 RCCC flow）。已跑通基本流程，但 handoff 部分尚未实现。Week 1 需验证该 demo，识别与我方 Agent 集成的 gap，确认剩余工作量。

---

## Epic 3: [RingCX] Nova Agent 接入 RingCX (Engage)

**Description:**

将 Nova Agent 接入 RingCX 平台。RingCX 的前身是 Engage Digital，系公司收购的第三方 Contact Center 平台，本质是人工客服平台。架构上较为单体（基本一个服务、一个代码仓库），与 RCCC 的微服务架构不同。之前由 Bevis team 负责开发，Nova 侧已有 Digital 和 Voice 的实现。

对我方而言，RingCX 类似于一个"内部的 RCCC"——不需要维护 RingCX 平台本身，仅需基于其提供的 API 进行接入。

本期目标：先跑通 Nova 团队已有的功能、识别问题，评估后续与 Air 2.0 的集成方式。

**环境:** https://aws46-engage-dev.vacd.biz/ （Wiki 上有现成测试账号，Voice 和 Digital 分不同账号）

### Tickets

#### 1. [RingCX] Digital + Handoff 跑通 & 问题识别
- **Assignee:** Jimmie / Fairy
- **描述:** Nova 团队之前已实现 RingCX Digital 通道（Chat）的 Agent 接入 + handoff。Week 1 目标是基于现有代码和 Wiki 上的测试账号将整个流程跑通，识别存在的问题和缺失的功能点。同时需评估 Air 2.0 的集成方式（2.0 目前仅前端概念，后端预期复用现有组件）。下周一内部 Sharing 汇报结果。
- **参考:** https://wiki.ringcentral.com/x/V8ZlOw
- **备注:** RingCX 平台除 Chat 外也有 SMS/Message 概念，但属于 RCX 体系而非 RingEX 的 SharedInbox，需注意区分。

#### 2. [RingCX] Inbound Voice + Handoff 跑通 & 问题识别
- **Assignee:** Jimmie / Fairy
- **描述:** 同 Digital，针对 Inbound Voice 通道。Nova 已有实现，需跑通并识别问题。重点关注：语音通话的建立和释放流程、Agent 对话体验、handoff 到人工客服的切换是否正常。
- **参考:** https://wiki.ringcentral.com/x/V8ZlOw

#### 3. [RingCX] Outbound Voice + Handoff 调研 & 跑通
- **Assignee:** Jimmie / Fairy
- **描述:** RingCX 的 Outbound Voice 流程：NOCC（前端）→ NOA 编排触发 → Telco 服务拨出。Nova 已有一定实现，需调研和跑通。与 RCCC Outbound 类似，接通后的 Agent 处理逻辑可复用 Inbound 设计。
- **参考:** https://wiki.ringcentral.com/x/ikDtQ

#### 4. [RingCX] 电话号码体系 & Billing 调研
- **Assignee:** Jimmie / Fairy
- **描述:** 调研当用户同时购买了 RingCX 和 Nova 后，要实现 Inbound 到 Nova Agent，是否需要额外购买 RingEX 的电话号码？RingCX 作为独立系统后，计费体系如何运作？是否需要接入 RingEX 的 Billing 模块？这涉及产品层面的号码归属和计费架构问题。

#### 5. [RingCX] Account Autodiscovery 概念澄清
- **Assignee:** TBD
- **描述:** 会议中提到 Account Autodiscovery，但具体需求和概念尚不明确，需与 PM 或 RingCX 团队确认其含义和范围后再规划。

---

---

## 里程碑 & 时间线

| 阶段 | 时间 | 目标 |
|------|------|------|
| Week 1 | 9.15 - 9.19 | 基于现有后端跑起来，识别问题。下周一内部 Sharing |
| Week 2 | TBD | 根据 Week 1 识别的问题制定后续计划 |
| Week 3 | TBD | TBD |
| RCX 节点 | ~10.16 | RingCX 相关功能 |
| RCCC 节点 | ~10.30 | RCCC 相关功能 |
| 总截止 | ~11.30 | 全部完成（Steve 早会提到 11.16 节点可能后推） |

> **风险：** PM 团队目前聚焦 2.0（10.22 截止），无法支持本项目需求定义。Claire 以为截止日期是 12.31，实际为 11.30。需尽快向上反馈获取 PM 资源。
