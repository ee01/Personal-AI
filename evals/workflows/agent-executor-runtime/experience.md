# Agent Executor Runtime Eval Workflow

## Goal

Deterministically verify Agent Executor architecture contracts without live OpenClaw/Codex.

## Real Scenarios

1. Gateway `agent.wait` 断连但 `sessions.*` 仍显示 running → 保持 `running`，不得直接 `failed`。
2. Gateway `agent.wait` 超时后确认环读到最终结果 → 写入 `succeeded`，不得直接 `dead_letter`。
3. OpenClaw 返回 `observedFields` 对象形状 → 仍通过可验证 artifact。
4. MCP 仅有 `memory.read` → `memory_evidence_get` 拒绝原文。
5. 空 `agentExecutors` + legacy OpenClaw 开启 → 合成 `id=openclaw` 的 Gateway 默认执行器。
6. mock ACP stdio → 成功 envelope + verifiable artifact。
7. A2A `taskId`/`contextId` ↔ `agent_run_id`/`agent_conversation_id`。

## Steps

1. Load one case from `evals/cases/agent-executor-runtime/cases.jsonl`
2. Run `tools/eval-agent-executor-runtime.ts` with local fixtures only
3. Compare `expectedBehavior` keys to actual proof checks
4. Report pass/fail with deterministic scores (no LLM judge)

## Pass Criteria

- Gateway reconcile must prefer `running` over hard fail when remote session is active
- Gateway wait timeout must confirm the remote run and accept a later success instead of dead-lettering
- Object-shaped `observedFields` must count as verifiable
- Raw evidence fetch must require `evidence.raw.read`
- Empty registry must synthesize legacy OpenClaw defaults
- ACP success path must return verifiable artifacts
- A2A id mapping conventions must hold

## Report requirements

- 使用共享 Reader Contract 渲染，不新增 suite 专属 HTML。
- 每个 case 展示场景、expectedBehavior、actual proof checks。
- 明确说明本 eval 使用本地 fixture，不证明线上 OpenClaw/Codex 凭据可用。
- 报告必须保留失败项和改进建议；完整请求/响应放在 run artifacts。

## Command

```bash
npm run eval:validate
npm run eval:run -- --suite agent-executor-runtime --no-repair
```
