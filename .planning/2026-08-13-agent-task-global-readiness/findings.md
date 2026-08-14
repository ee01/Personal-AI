# Findings: agent_task 连接层就绪门禁

## Requirements
- Clear stuck live readiness contracts for agent_task
- For generic `agent_task` delegation, keep only `openclaw:global` as the dispatch gate
- Capability-layer judgment stays inside the executor (OpenClaw)

## Research Findings
- `getActionReadinessScope` currently partitions `targetSystem=agent_task` by `metadata.triggerSource`, producing keys like `openclaw:agent_task:jira_rule:read`
- A browser `capability_missing` on “打开百度” therefore blocked later tasks that shared the jira_rule trigger, even when they did not need a browser
- `unknown` is allow; readiness is a circuit breaker, not a permission matrix
- Connection-layer signals already exist: `auth_error` 401/403, `capability_missing` with `configured=false`, pairing / ECONNREFUSED text
- Scoped jira/drive contracts remain useful because those actions name a real target system

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| `agent_task` scopeKey = `openclaw:global` | Dispatch only asks “can we talk to the gateway?” |
| Skip contract writes for per-task capability/proof/error | Prevents one missing tool from degrading the whole gateway |
| Probe source still updates global | Agent-task probe is rewritten as a gateway check |
| Expire live `openclaw:agent_task*` rows | User asked to clear; leftover scoped rows become unused after the code change |

## Resources
- `memory-service/src/core/ActionReadinessService.ts`
- `docs/features/action_readiness_contracts.md`
- Live DB: `rcadmin@10.32.56.212` `~/personal-ai/memory-service/data/users/esone.qiu/memory.db`
