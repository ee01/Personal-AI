# Findings

## Requirements
- 用户 Options 有两个 OpenClaw Gateway：
  - `openclaw` / OpenClaw / `http://10.32.57.190:18789`（本机）
  - `exec_t4com0` / Mac mini openclaw / `http://claw.xmnup.com`（Mac mini ai@10.32.56.212，声称指向 18789）
- Agent Task 默认执行器 UI 显示为 Mac mini openclaw (`exec_t4com0`)
- 在 memory-exploring `#/actions?sourceKind=agent_task&sourceRefId=msg_1786694923950` 执行时，本机 OpenClaw 打开了 baidu.com
- 需要判断：代码 bug vs claw.xmnup.com 解析/连通 vs 动作写死本机 executor

## Research Findings

### 执行器选择（代码）
- `agentTasks.ts` 创建动作时：`executor = body.executor || defaults.agent_task`，写入 `params.executor` 和 `metadata.executorId`
- `ActionExecutor.resolveExecutorForAction`：若 params/metadata 已有 executor，**不再读当前 Options 默认值**
- 无 executor 时：`delegate_openclaw` 固定找 `openclaw`；否则用 `defaults.agent_task`
- `resolveExecutorDefaults`：若 `agent_task` 空或不在列表里，回退到 **enabled[0]**，即列表第一项 `openclaw`（本机）
- memory-exploring `ActionQueue.executeAction` 只按 action id 执行，不改 executor
- **没有**「Mac mini 连不上就回退本机」的代码路径；连通失败应报错，不应静默换执行器

### Options 保存
- `AgentExecutorsSettings.primaryOpenClaw` 优先 `id === 'openclaw'` 来同步遗留 `openClawBaseUrl`
- 因此遗留字段会一直指向本机 URL；真正 Agent Task 应走 `agentExecutors` + `executorDefaults`
- PUT `/config` 会保存 `executorDefaults.agent_task`

### Gateway URL
- `toGatewayWsUrl('http://claw.xmnup.com')` → `ws://claw.xmnup.com`（**没有端口则是 80**，不是 18789）
- 本机那条是 `http://10.32.57.190:18789` → `ws://10.32.57.190:18789`（正确）

### Visual (screenshot)
- Agent Task 默认下拉已选 `Mac mini openclaw (exec_t4com0)`
- Mac mini Base URL 为 `http://claw.xmnup.com`（无 :18789）
- 本机 Base URL 为 `http://10.32.57.190:18789`

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 只读查线上 config/action + DNS/端口 | 用真实数据区分「默认没生效」和「域名没打到 gateway」 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `memory-service/src/core/actions/ActionExecutor.ts` `resolveExecutorForAction`
- `memory-service/src/routes/agentTasks.ts` execute 创建
- `memory-service/src/integrations/openclaw/OpenClawGatewayClient.ts` `toGatewayWsUrl`
- `src/modals/components/ActionQueue.vue` executeAction
