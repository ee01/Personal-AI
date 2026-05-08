# Personal Skill Foundry — 个人技能炼金台

_最后更新: 2026-05-08_

## 是什么

`Personal Skill Foundry` 是 Personal AI 的个人技能库模块，入口位于：

`memory-exploring.html#/skills`

它的目标是把用户在不同 agent、真实操作和记忆系统中沉淀出的“做事方法”统一保存为可追踪、可版本化、可安装到其他 agent 平台的个人 skill。

这个模块里，**Memory Service 是真源**。所有技能最终都会进入 Memory Service 的 `active` 技能库，再通过平台级同步机制分发到 OpenClaw、Codex CLI、Claude Code、Cursor 等平台。

## 核心概念

| 概念 | 说明 |
|---|---|
| `suggestion` | 待用户决策的技能建议，可能来自 Flight Recorder、OpenClaw、本地 agent 平台或其他来源 |
| `active` | 已确认入库的真源技能，会参与分享 URL 和平台同步 |
| `dismissed` | 用户丢弃的建议，保留记录并用于冷却去重 |
| Skill Version | 每次技能内容版本，包含 `SKILL.md`、package、workflow、evidence、sourceEpisodes、files、sha256 |
| Platform Binding | 某个技能在某个平台的安装/同步状态 |
| Share Link | 带 token 的只读 skill URL，用于外部 agent 拉取 `SKILL.md` 和资源 |

当前状态机只保留：

```
suggestion -> active
suggestion -> dismissed
```

不引入 draft / candidate / eval run 等额外状态。

## 用户主流程

### 1. 查看技能建议

页面顶部的 Inbox Bar 展示待决策建议。

建议会按来源分组：

- `OpenClaw 导入`
- `Flight Recorder 萃取`
- `本地 agent 导入`
- `其他建议`

每张建议卡片支持：

- `使用`：promote 为 `active`
- `丢弃`：标记为 `dismissed`
- `稍后审`：保留在 suggestion，但更新 snooze 时间
- 点击卡片：展开右侧详情

OpenClaw 或其他 agent 平台同步回来的新 skill 不会直接进入 active，而是先作为 suggestion 让用户确认，避免外部平台内容无感覆盖个人真源库。

### 2. 管理在用技能

左侧技能列表默认只显示 `active` 技能。

过滤器：

- `在用`
- `全部`
- `已丢弃`

`suggestion` 不混入默认技能列表，只显示在 Inbox Bar。

### 3. 查看技能详情

右侧详情区包含四个 tab：

| Tab | 内容 |
|---|---|
| 工作流 | trigger、not_use、来源、风险策略、步骤 |
| 证据 | 来源证据、episode / 外部平台证据 |
| 版本 | 当前版本、sha256、changelog、createdFrom |
| 绑定 | share URL、平台安装状态、安装指引、平台同步状态 |

技能列表和详情区不使用内层纵向滚动，页面跟随 `memory-exploring` 外层主滚动条展开。

## 数据模型

Memory Service 通过迁移 `019_personal_skill_library.sql` 建表。

| 表 | 用途 |
|---|---|
| `personal_skills` | 统一存 `suggestion / active / dismissed` 技能，包含 slug、title、summary、scope、risk、trigger、not_use、来源和决策 metadata |
| `skill_versions` | 存技能版本、`SKILL.md`、package JSON、workflow、evidence、sourceEpisodes、files、sha256、changelog |
| `skill_platform_bindings` | 存某技能在各平台的安装状态、版本、sha256、remoteMtime、lastSync/error |
| `skill_platform_sync_settings` | 平台级自动同步设置，包含 capability 和 enabled |
| `skill_share_links` | 存 token hash、skill/version 绑定和 revokedAt，用于安全暴露只读 URL |

不建：

- `skill_eval_cases`
- `skill_eval_runs`
- `skill_runs`

eval / run receipt 以后作为次级能力再加，不进入 MVP 主链路。

## Public Skill URL

每个 active skill version 都可以生成 tokenized read-only URL。

支持端点：

| 端点 | 说明 |
|---|---|
| `GET /skills/:slug@:version?token=...` | HTML 预览 |
| `GET /skills/:slug@:version/SKILL.md?token=...` | 返回 `SKILL.md` |
| `GET /skills/:slug@:version/package.json?token=...` | 返回完整 package |
| `GET /skills/:slug@:version/files/*?token=...` | 返回 scripts/resources |

注意：

- UI 可以展示短链，例如 `/skills/capdev-monthly-data@v0.1`。
- 真正可访问、可复制给 agent 的 URL 必须带 `?token=...`。
- token 原文只返回给调用方，数据库只保存 hash。
- 每次获取详情会生成新的 live token；旧 token 继续有效，直到被 revoke。
- public URL 返回 `ETag`，支持 `If-None-Match`。
- 生成 share link 前会做 secret pattern scan；命中疑似 secret 时不生成 share，并在详情里返回 `shareError`。

## 平台同步

平台同步是 **per-platform**，不是 per-skill。

开启某个平台后，会同步所有 `active` 技能。

| 平台 | capability | 默认 | 说明 |
|---|---|---|---|
| Personal AI | `internal` | 开启且不可关闭 | 真源 |
| OpenClaw remote | `api` | 开启 | 通过 OpenClaw remote API 双向同步 |
| Codex CLI | `fs_via_desktop_app` | 关闭 | 需要 Desktop App 读写本机 skill 目录 |
| Claude Code | `fs_via_desktop_app` | 关闭 | 目录可配置 |
| Cursor | `fs_via_desktop_app` | 关闭 | 通过 Desktop App 读写本机目录 |
| ChatGPT / GPTs | `manual_only` | 不可自动同步 | 只提供复制安装指引 |
| Claude.ai Skills | `manual_only` | 不可自动同步 | 只提供复制安装指引 |

### OpenClaw 同步

OpenClaw remote 不要求和 Personal AI app 在同一台机器上。

同步通过远端 API 完成，优先使用 `/v1/responses` strict JSON 方式执行 skill CRUD；如果 OpenClaw 提供 `skills.status/install/update` RPC，则可作为优化路径。

当前同步策略：

1. `sha256` 相同：noop，并更新 binding。
2. OpenClaw 有新 skill，而 Personal AI 不存在：导入为 `suggestion`。
3. Personal AI 已有 active skill，OpenClaw 版本更新：从 OpenClaw export 完整 package，覆盖 Personal AI 当前 active version。
4. Personal AI 版本更新或 OpenClaw 缺失：推送 Personal AI active package 到 OpenClaw。
5. 冲突判断会综合 `sha256`、version 和 remote mtime。

用户点击 suggestion 的 `使用` 后，如果 OpenClaw 同步已开启，会只同步这一条刚入库的 active skill，不会顺带拉取全部 OpenClaw 技能。

### Desktop App 本机同步

Codex CLI / Claude Code / Cursor 的 skill 目录在本机文件系统里，Chrome Extension 和 Memory Service 不能直接读写。

因此这些平台通过 Desktop App 完成：

1. Desktop App 定期扫描本机 skill 目录。
2. 调用 Memory Service `POST /api/v1/skills/sync/local-platform`。
3. Memory Service 判断本机平台和 Personal AI 哪边更新。
4. 如果本机 skill 是新内容，创建 suggestion 或更新 active。
5. 如果 Personal AI active 更新，Memory Service 返回 `packagesToInstall`。
6. Desktop App 把 package 写回对应平台目录。

如果 Desktop App 未安装或未运行，UI 对 Codex CLI / Claude Code / Cursor 显示 `状态未知`，而不是 `未安装`。绑定 tab 顶部会引导用户下载安装最新版 Desktop App。

### Manual-only 平台

ChatGPT / GPTs 和 Claude.ai Skills 暂不支持自动写入，只提供一句安装指引。

安装指引中使用的是带 token 的可访问 skill URL。

## API

技能管理 API 挂在 `/api/v1/skills` 下。

| API | 说明 |
|---|---|
| `GET /api/v1/skills?filter=active|all|dismissed&q=` | 主列表；默认不返回 suggestion |
| `GET /api/v1/skills/suggestions` | Inbox Bar 建议列表 |
| `POST /api/v1/skills/suggestions` | 创建 suggestion，供同步器或 miner 写入 |
| `POST /api/v1/skills/suggestions/:id/use` | promote 为 active，生成版本和 share link，并触发已开启平台同步 |
| `POST /api/v1/skills/suggestions/:id/dismiss` | 标记 dismissed，并记录冷却 key |
| `POST /api/v1/skills/suggestions/:id/snooze` | 暂缓建议 |
| `GET /api/v1/skills/:id` | 技能详情，返回 workflow / evidence / versions / bindings / share |
| `GET /api/v1/skills/sync-settings` | 平台同步设置 |
| `PUT /api/v1/skills/sync-settings/:platform` | 更新平台同步开关 |
| `POST /api/v1/skills/bindings/:platform/probe` | 只读探测平台能力 |
| `POST /api/v1/skills/sync/run` | Memory Service 主动触发 API 平台同步，目前主要用于 OpenClaw |
| `POST /api/v1/skills/sync/local-platform` | Desktop App 上报本机平台 skill 列表并拉取待写入 package |

## 关键安全边界

- tokenized public URL 是只读能力，不提供写入接口。
- `skill_share_links` 只保存 token hash，不保存明文 token。
- 短展示 URL 不能直接打开，避免误把无 token URL 当公开 URL。
- share 生成前扫描疑似 secret，例如 api key、bearer token、private key、password 等。
- 外部平台导入的 skill 默认先进入 suggestion，不直接进入 active。
- 自动同步按平台开启，避免用户误以为单条 skill 有独立同步开关。

## 已知边界

- Flight Recorder miner 只负责产生 suggestion；是否入库由用户确认。
- OpenClaw remote 的完整 CRUD 依赖远端 `/v1/responses` 能稳定返回 strict JSON。
- Codex CLI / Claude Code / Cursor 的双向同步依赖 Desktop App 安装、运行和目录权限。
- 本机平台目录默认值可能不稳定，Claude Code 等目录应允许用户配置。
- ChatGPT / GPTs、Claude.ai Skills 当前只支持手动安装指引。
- 暂不做 eval 面板、run receipt、per-skill 自动同步矩阵。

## 验证建议

Memory Service：

```bash
npm --prefix memory-service test -- --run src/__tests__/api-skills.test.ts
npm --prefix memory-service run build
```

Extension：

```bash
npm start
```

运行到首次 webpack compile success 后停止 watch。

真实服务验证：

```bash
npm run deploy:memory

curl -H 'X-User-Id: esone.qiu' \
  'http://10.32.56.212:3210/api/v1/skills?filter=active&q=capdev'
```

验证 public skill URL 时必须使用详情接口返回的 `share.urlPath`，不要只测 `displayUrl`。
