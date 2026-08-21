# Task Plan: Agent Worker 分发与远程执行器

## Goal
按 `docs/progressing/agent-worker-distribution-plan.md` 落地 P1–P4：probe + Options 测试、worker 协议与 remote 路由、Desktop 内嵌守护/一键配对、release 轨道与自部署 bootstrap；并用测试验证。

## Current Phase
Complete

## Phases

### Phase 1: P1 Probe 端点 + Options 测试按钮
- [x] executor 实例增加 `runtime` / `workerId` 字段（为 P2 铺路）
- [x] `POST /api/v1/agent-executors/:id/probe`（四类执行器轻量探活，失败指明 stage）
- [x] probe 写入 readiness task 级记录，不触发 scope 熔断
- [x] Options 每行「测试」按钮 + 状态 chip（TTL 5 分钟缓存）
- [x] OpenClaw 127.0.0.1/内网提示
- [x] 单元/API 测试
- **Status:** complete

### Phase 2: P2 Worker 包 + 服务端 API + remote 路由
- [x] `agent_workers` 表 + pairing token + lease/fencing
- [x] worker API：pair / heartbeat / claim / report / commands / 列表 / 撤销
- [x] `runtime=remote` 任务置 `awaiting_claim`；lease 过期回队；旧 fence 拒绝
- [x] `worker/` 纯 Node 包 + echo 深度测试 + ACP prompt
- [x] 测试：pair/claim/report/fencing/lease 过期
- **Status:** complete

### Phase 3: P3 Desktop App 内嵌 + 守护 + 一键配对
- [x] desktop 构建打入 worker；main `utilityProcess.fork` + crash 退避重启
- [x] `POST /worker/pair` 仅 127.0.0.1 + 扩展来源校验
- [x] tray 显示 worker 状态；日志可打开
- [x] Options 一键配对本机 Desktop App；无 desktop 时引导卡
- [x] 设置页编辑本机 ACP cwd/命令
- **Status:** complete

### Phase 4: P4 Release 轨道 + install.sh + ghcr + bootstrap
- [x] worker-v* / desktop-v* GitHub workflow
- [x] `worker/install.sh`
- [x] `deploy/docker-compose.yml` + `deploy/bootstrap.sh` + ghcr 镜像 workflow
- [x] 文档迁入 `docs/features/` 与 `docs/index.md`；删除 progressing plan
- **Status:** complete

### Phase 5: 测试验证与收口
- [x] memory-service 定向测试（41 passed）
- [x] worker / desktop 定向测试
- [x] 扩展 `npm start` 首次编译
- [x] 文档与索引
- **Status:** complete

## Key Questions
1. Worker 凭据格式？→ `awk.<base64url(userId)>.<workerId>.<secret>`，与 pak 同层、写入对应用户库。
2. 不上 npm；install.sh 从 GitHub worker-v* release 拉，开发回退 raw `worker/install.sh`。
3. Eval：确定性协议，不新建 LLM eval suite。

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 不新增 remote-worker 执行器类型 | worker 是通道；runtime 是 acp 实例属性 |
| probe 缓存在进程内 TTL 5min + readiness task 记录 | 满足 chip 与「不熔断」 |
| awaiting_claim 新 queue_status | 与 running 区分，heartbeat 不会误派本机 |
| Desktop 已用 desktop-v* tag | 保持；补 worker-v* 与 ghcr 轨道 |
| 协议版本整数 1 | 握手上报 protocolVersion，服务端最低兼容=1 |
| Electron main 用 utilityProcess.fork | 崩溃与 bridge 隔离；无 Electron 时 supervisor 自己 fork |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| API 测试 401（环境有 API_KEY） | 1 | 测试里清空 API_KEY 并 resetConfigForTests |
| actionExecutor 走 gateway | 1 | 测试配置显式 openclaw-responses |
| lease 用例缺 taskId | 1 | 补 taskId |
