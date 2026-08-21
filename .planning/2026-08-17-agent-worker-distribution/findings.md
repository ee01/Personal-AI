# Findings: Agent Worker 分发

## Requirements
- P1: 四类执行器 probe + Options 测试按钮/chip；acp local 缺命令可读错误
- P2: worker 包 + pair/heartbeat/claim/report + runtime=remote 路由 + lease/fencing
- P3: desktop 内嵌守护、一键配对、tray 状态
- P4: desktop-v* / worker-v* 轨道、install.sh、ghcr 镜像、bootstrap.sh

## Research Findings
- Registry 四类，无 remote-worker；AcpExecutor 本机 spawn；Options 无 runtime 开关、无测试按钮
- memory-service 无 probe 端点；desktop-app 已有 127.0.0.1:46321 `/health` `/pair`，deploy.mjs 已发 `desktop-v${version}`
- 自托管仍是 clone + docker compose 本地 build；无 `deploy/` 目录
- `worker_leases` 表是通知调度租约，不能复用为 agent worker
- 下一 migration 编号 061
- 认证：`pak.` 用户 key / API_KEY / 匿名（无 API_KEY 时）。Worker 需独立 `awk.` 凭据并在 auth 中间件解析
- ActionExecutor.executeAction 先 markRunning 再 dispatch；remote 必须在此前 park 为 awaiting_claim
- 成功/失败后处理（readiness、outreach、thread）在 executeAction；worker report 必须走同一收口
- Desktop tray 在 `app/main.mjs`；设置在 `app/index.html` + `renderer.js`
- GitHub org：ee01；desktop deploy 已用 desktop-v* 前缀

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| runtime/workerId 存在 AgentExecutorInstance | 不新增执行器类型 |
| Worker token `awk.<userIdB64>.<workerId>.<secret>` | 能路由到对应用户 DB |
| probe 注入 fetch/WS/spawn | 单测不连真网 |
| 深度测试 = worker echo command | 不启 codex |
| worker 零 npm 依赖 | 独立 tarball 可跑 |

## Resources
- Plan: docs/progressing/agent-worker-distribution-plan.md
- Feature doc: docs/features/agent_executor_runtime.md
- Self-host: docs/self-hosting-memory-service.md
- Registry: memory-service/src/integrations/executors/executorRegistry.ts
- Options: src/components/AgentExecutorsSettings.tsx
- Desktop server: desktop-app/src/server.ts (port 46321)
