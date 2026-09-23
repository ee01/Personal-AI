# Roadmap AI Draft Planning Experience Workflow

## Goal

验证 Roadmap「AI 批量创建 Draft」与 MCP 结构化提交共用同一契约：层次、Owner 保真、幂等、凭证隔离、不创建 Jira。

## Real User Scenarios

1. PM 无扩展，粘贴 E-12 需求，一次生成 3 个 Epic / 12 个 Ticket Draft 并初排甘特。
2. 三个主任务已存在时，只挂新子任务，不覆盖父描述或重复建 Epic。
3. 「Jimmie / Fairy」与 TBD 保持待确认；创建 Jira 仍走原扩展 UI。

## Steps

1. Load cases from `evals/cases/roadmap-ai-draft-planning/cases.jsonl`.
2. For each case run `tools/eval-roadmap-ai-draft-planning.ts` against an isolated SQLite `DATA_DIR`.
3. Structured plans use the E-12 fixture and `DraftPlanValidator` / `submitStructuredPlan`; MCP cases inspect the stdio tool surface.
4. Confirm no Jira create tool exists and share tokens are stripped from events.
5. Produce the standard HTML eval report.

## Pass Criteria

- Schema/领域约束非法时 100% 拒绝，不部分写入。
- 明确层次案例节点覆盖/父子归属 100%。
- TBD / 多人 Owner 不被操作人代替。
- 越权、泄密、重复写入、无扩展 Jira 创建均为 0。

## Report Requirements

- 逐 case 展示 receipt 计数、owner_resolution、error code。
- 声明本套件使用合成 fixture 与结构化计划，不把通过结果写成真实模型拆解质量证明。
- 标明未执行真实 Jira 创建、未调用 Memory Service。

## Local Run

```bash
npm run eval:validate
npm run eval:run -- --suite roadmap-ai-draft-planning --no-repair
npm --prefix ../personal-roadmap test -- --run src/__tests__/draftPlanning.test.ts mcp/src/http.test.ts
```
