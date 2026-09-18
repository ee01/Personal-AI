---
name: roadmap-planning
description: >
  把需求变成 Personal Roadmap 的 Draft 主任务/子任务与初排甘特。
  在用户要「根据需求建 Roadmap Draft / Epic / Ticket 排期」且目标是该团队的 Roadmap 时使用。
  不创建 Jira，不读取 Memory，不签发分享链接。
---

# Roadmap Draft 规划

合同版本 `1.0.0`，schema `1`。不兼容时在花费服务端 LLM 或写入 Draft 前拒绝，不要静默丢字段。

## 触发

- 用户要把需求/纪要/Markdown 变成 Roadmap Draft。
- 用户要复用已有主任务并只加子任务。
- 用户只要「整理建议 / 预览」，不要直接写入。

## 步骤

1. 调用 `roadmap_get_context`，核对 contract/schema 与团队父项、成员。
2. 只用用户授权的文档。链接原文未读取时明确说明「只保存引用」。
3. 用宿主模型产出 `DraftPlanV1`：两级 parents/children；保留 Overall 背景、里程碑、风险、待确认项、多人 Owner 候选、TBD。
4. `roadmap_validate_plan`。`needs_input` 时向用户集中询问，再 `roadmap_revise_plan`。
5. 用户已经明确要求创建 Draft 且范围一致 → `roadmap_commit_plan`（固定 revision/hash/requestId）。
   用户只要分析/建议 → 不要 commit。
6. 网络超时用同一个 `requestId` 调 `roadmap_get_request`，不要换新 id 盲重试。
7. 返回不含 token 的 Roadmap 链接、警告、待分配 Owner。创建 Jira 请有扩展的用户在 Roadmap「创建 Jira」完成。

## 保真

- 不要把「Jimmie / Fairy」收成单人 Owner；TBD 保持未分配。
- 不要编造 Jira key、数据库 ID 或成员。
- 不要调用任何 Jira create / Memory 工具。
- attach 已有父项时默认只加子任务，不改父标题/Jira/非空描述。

Schema 详见 [references/plan-schema.md](references/plan-schema.md)。
