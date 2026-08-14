# Agent Worker 分发与远程执行器 Plan（Desktop App 内嵌 / 独立安装 / Options 连通性）

日期：2026-08-08
关联：[agent_executor_runtime.md](../features/agent_executor_runtime.md)（执行器 runtime 已落地）、原架构 plan 的 Block E（反向 Worker，registry 尚无 `remote-worker` 类型）
核心问题：反向 Worker 怎么装到用户机器上、Options 怎么配和测、GitHub release 怎么组织、服务自部署走什么通道。

---

## 1. 现状事实（2026-08-08 核对）

| 事实 | 位置 |
|---|---|
| 执行器 registry 已有 4 类：`openclaw-responses` / `openclaw-gateway` / `acp-codex` / `acp-claude-code`，**无 remote-worker** | `memory-service/src/integrations/executors/executorRegistry.ts`、`src/components/AgentExecutorsSettings.tsx:5-9` |
| AcpExecutor 是本机 stdio spawn（`npx codex-acp` / `ACP_CLAUDE_COMMAND`），cwd 取 memory-service 主机路径 → **codex/cc 目前只能跑在 memory-service 同机** | `memory-service/src/integrations/executors/AcpExecutor.ts:240-264` |
| Options 执行器设置无「运行位置」开关、无连通性测试按钮 | `src/components/AgentExecutorsSettings.tsx`（447 行）、`src/options.tsx:4884-4912` |
| memory-service 无执行器 probe 端点 | `routes/` 无匹配 |
| desktop-app = Electron（electron-builder + @electron/packager 自定义打包，mac target `dir`），**未用 electron-updater**，自定义 `scripts/deploy.mjs` 发 GitHub release；内部已跑本地 fastify + MCP SDK | `desktop-app/package.json` |
| 自部署现行路径 = 源码 clone + docker compose（memory-service 有 Dockerfile；凭据分层 API_KEY / BOOTSTRAP_API_KEY 已定义） | `docs/self-hosting-memory-service.md` |
| 典型部署形态：memory-service 在远端公共服务器（memory.xmnup.com），**codex/cc 在用户自己的电脑上** → 对多数用户，codex/cc 执行器天然必须是"远程"（worker）形态 | 同上 |

## 2. 总体设计：Worker 的三种宿主形态

Worker = 确定性领取协议的执行节点（注册/lease 领取/心跳/回传，内部经 ACP stdio 驱动 codex/cc，或调本机 OpenClaw）。三种宿主，同一协议，服务端视角无差别：

| 形态 | 适用 | 安装动作 | 守护 |
|---|---|---|---|
| **① Desktop App 内嵌（主推）** | 用户日常电脑（正是 codex/cc 所在机器） | 无需单独安装——装 desktop app 即得 worker | Electron main 进程守护（见 §3） |
| ② 独立 Worker（headless） | 服务器、无桌面环境的机器 | 一行安装脚本（从 worker release 轨道拉 tarball） | launchd / systemd / cron |
| ③ platform-schedule（零安装） | 不想装任何东西、平台自带调度器 | 一次 prompt 建 schedule，经 MCP 工具领取 | 平台自身 |

**回答"是否需要单独安装包"**：不需要以它为主。desktop-app 恰好跑在 codex/cc 所在的用户机器上，是 worker 的天然宿主——**内嵌是主路径，独立安装包只服务 headless 场景**。

## 3. Desktop App 内嵌 Worker 设计

### 3.1 进程模型与守护
- worker 抽成 monorepo 内独立包（`worker/`，纯 Node、零 Electron 依赖——保证同一份代码可打进 desktop-app 也可独立分发）。
- desktop-app 构建时把 worker 打进 `dist/`；Electron main 用 `utilityProcess.fork()` 拉起（隔离崩溃、独立 stdio）。
- **守护即 Electron main 的职责**：crash 自动重启（指数退避，上限 5 次/小时后转告警）、开机自启随 desktop-app 的 login item、菜单栏/tray 显示 worker 状态（online / stale / error + 当前任务数）。这正是"desktop app 反而可以守护 worker"——比 launchd 方案多了可视化和用户可控的开关。
- worker 日志落 desktop-app 日志目录，UI 可一键打开。

### 3.2 配对（零粘贴流程）
desktop-app 本地已有 fastify —— 利用它做本机回环配对：
1. 扩展 Options 添加远程执行器时，探测 `http://127.0.0.1:<desktopPort>/health`；
2. 检测到 desktop-app → 显示「一键配对本机 Desktop App」→ Options 把 pairing token `POST http://127.0.0.1:<port>/worker/pair`；
3. desktop-app 持久化 token、启动 worker、worker 出站握手 memory-service → Options 里执行器转 online。
全程用户零复制粘贴。检测不到 desktop-app 时回退到引导卡（§5）。
- 安全：`/worker/pair` 仅监听 127.0.0.1 + 校验请求来源（扩展 ID header）；token 一次性、可撤销。

### 3.3 codex/cc 的执行环境
- worker 配置里维护每个 executor 的本机参数（codex 登录态、cwd 白名单、ACP 命令）；desktop-app 设置页提供编辑 UI。
- MCP 注入：worker 侧给 codex 的 `session/new` 只传 **HTTP 型 memory MCP**（URL 从用户机器可达），不传本机 stdio fallback。

## 4. Options UI 改造（`AgentExecutorsSettings.tsx`）

### 4.1 运行位置开关
`acp-codex` / `acp-claude-code` 实例增加 `runtime` 字段：
- **`local`（Memory Service 主机）**：现状行为（AcpExecutor 本机 spawn）。自托管同机部署的用户用这档。
- **`remote`（经 Worker）**：需绑定 workerId（下拉列出该用户已配对的 worker + 各自在线状态）；无可用 worker → 引导卡：
  1. 首选「安装 Personal AI Desktop App」（GitHub release 下载链接 + 一键配对说明）；
  2. 备选「headless 一行命令」：`curl -fsSL <install.sh> | bash -s -- --server <url> --token <pairing>`（token 现场生成、有效期短）；
  3. 零安装档链接到 platform-schedule 文档。
- OpenClaw 类型不需要此开关（gateway 本身就是远程协议）；但 gateway 地址为 127.0.0.1/内网时提示「该地址仅 memory-service 主机可达」。

### 4.2 连通性测试（所有类型统一）
- 新端点 `POST /api/v1/agent-executors/:id/probe` → `{ ok, latencyMs, stage, detail }`（stage = dns/connect/auth/ready，失败指明卡在哪层）。
- 每行执行器一个「测试」按钮 + 常驻状态 chip（复用 probe 结果缓存，TTL 5 分钟）。
- **轻量语义（不跑 LLM）**分型实现：

| 类型 | probe 动作 |
|---|---|
| openclaw-gateway | WS 握手 + 鉴权 ping（或 gateway health RPC） |
| openclaw-responses | HTTP 探活 + 401/403 区分鉴权失败 |
| acp-*（local） | spawn → ACP `initialize` 握手成功即 kill（连带验证命令存在、node 可用） |
| acp-*（remote/worker） | worker 心跳年龄（<2×心跳间隔 = ok）；「深度测试」按钮可选发一条 `echo` 指令走端到端（worker 收到即回，不启 codex） |

- probe 结果写入 readiness 的 task 级记录（不触发 scope 熔断），失败文案直接给出下一步动作（"worker 离线 → 打开 Desktop App / 检查安装"）。

## 5. Registry 与服务端改造

1. executor 类型语义调整：`runtime: 'local' | 'remote'` 是 acp 实例的属性（不新增 `remote-worker` 执行器类型——worker 是**通道**不是执行器；一个 worker 可承载多个 executor 实例）。
2. 新表 `agent_workers`：workerId、pairing token hash、capabilities、最近心跳、状态；`proposed_actions` 路由时 `runtime=remote` 的任务标记目标 workerId，置 `awaiting_claim`。
3. worker API：`POST /agent-workers/pair`（换长期凭据）、`POST /agent-workers/:id/heartbeat`、`POST /agent-workers/:id/claim`（lease + fencing）、`POST /agent-workers/:id/report`、`GET /agent-workers/:id/commands`。
4. probe 端点见 §4.2。

## 6. 发布与分发（GitHub Release 怎么组织）

**GitHub 的模型**：release 绑定 tag，一个 repo 可有任意多 release，一个 release 可挂任意多资产——没有"一个 release 内部分两块"的概念。两种成立的组织方式：

| 方式 | 说明 | 适合 |
|---|---|---|
| A. 单轨多资产 | 同一个 tag 的 release 同时挂 desktop dmg/zip + worker tarball | 版本永远同步发布时最省事 |
| B. **多 tag 轨道（推荐）** | `desktop-vX.Y.Z` 与 `worker-vX.Y.Z` 两条前缀轨道，各自独立 release、独立节奏 | worker 迭代快、desktop 发版重（签名/打包）时 |

推荐 **B**，理由：worker 是纯 Node 小包、会跟随协议快速迭代；desktop-app 发版成本高（打包/签名）。你们没用 electron-updater（自定义 deploy.mjs），所以**没有"latest release 必须是 desktop"的工具链约束**，多轨道零风险。同时：
- desktop 轨道**天然内含 worker**（§3 内嵌），普通用户永远不用碰 worker 轨道；
- worker 轨道资产：`worker-<ver>.tgz` + `install.sh`（headless 一行命令的下载源）；
- **版本兼容靠协议握手而非同步发版**：worker 握手上报 `protocolVersion`，memory-service 维护最低兼容版本表，不兼容时握手即拒 + 提示升级路径（desktop-app 弹升级、headless 打日志）。

## 7. memory-service / roadmap-service 自部署通道

**结论：不走 GitHub release 二进制；保持"源码 + docker compose"为正式路径，升级为"ghcr.io 预构建镜像 + 一键 bootstrap"。**

- 为什么不发 release 二进制：两个服务都有原生依赖（better-sqlite3、sqlite-vec），二进制要维护 平台×架构 矩阵，收益低；容器世界里"release"的对应物是**镜像 tag**。
- 改进项（在现有 [self-hosting-memory-service.md](../self-hosting-memory-service.md) 基础上）：
  1. CI 按版本 tag 推 `ghcr.io/ee01/personal-ai-memory-service:<ver>` 与 `.../personal-ai-roadmap-service:<ver>`——用户免本地 build（当前文档要求 npm install + build，是最重的一步）；
  2. `deploy/docker-compose.yml` 覆盖两个服务（roadmap 用 profile 可选启用）+ `deploy/bootstrap.sh` 一键：生成密钥写 `.env`（API_KEY/BOOTSTRAP_API_KEY 自动随机）、拉镜像、起服务、健康检查、最后打印「扩展 Options 该填什么」；
  3. 源码 clone 路径保留，定位为开发者/贡献者通道；
  4. 版本升级 = 改 compose 里的镜像 tag + `docker compose up -d`，数据卷不动（SQLite 文件 + migrations 自动跑）。

## 8. 阶段划分与验收

| 阶段 | 内容 | 验收锚点 |
|---|---|---|
| **P1** | probe 端点 + Options 各类型「测试」按钮/状态 chip（不含 worker） | 4 种现有类型均可测，失败指明 stage；acp local probe 在缺 codex-acp 时给出可读错误 |
| **P2** | worker 包 + 服务端 worker API（pair/heartbeat/claim/report）+ `runtime: remote` 路由 | headless 一行命令装好 worker 后，remote codex 任务端到端跑通；kill worker 后 lease 过期任务回队、fencing 拒绝旧结果 |
| **P3** | desktop-app 内嵌 + 守护 + 一键配对 | 装 desktop app → Options 一键配对 → remote 执行器 online；杀 worker 进程 5 秒内自动拉起；tray 状态正确 |
| **P4** | release 轨道拆分 + install.sh + ghcr 镜像 + bootstrap.sh | 两条 tag 轨道各自发布成功；全新机器 bootstrap.sh 一条命令起服务并通过健康检查 |

## 9. 开放决策点

1. **worker 包的独立分发是否也上 npm**（`npx @personal-ai/worker`）：比 install.sh 更顺手，但要维护 npm 发布凭据；install.sh 从 GitHub release 拉已够用，倾向暂不上 npm。
2. **desktop-app 未装但用户想用远程 codex 的最低门槛**：是否值得做"仅 worker 的菜单栏精简版"？倾向不做——引导装完整 desktop app（它本来就有记忆同步价值）。
3. **一台机器多 worker**（desktop app + headless 并存）：按 workerId 区分即可，但 Options 需明示哪个 executor 绑哪个 worker，避免用户困惑。
4. **pairing token 的有效期与撤销 UI**：放 Options 还是 desktop-app 设置页（倾向 Options 统一管理，desktop-app 只展示）。
