# 记忆自动备份 / Memory Auto Backup

_最后更新: 2026-10-16_

## 是什么

记忆库是 Personal AI 唯一不可再生的用户资产。自动备份把**全量快照**（现有 backup zip：manifest + Layer A/B/C）按用户周期加密后送到用户自己的存储，并修掉 GB 级库手动导出超时。

它不是增量备份、多端合并或云同步，也不备份 `analytics/usage.db`、WAL/SHM 或 `backups/state.json`。

交互原型：[memory-auto-backup-demo.html](../demo/memory-auto-backup-demo.html)

Coverage 页的手动下载/恢复回执仍以 [memory_coverage_map.md](./memory_coverage_map.md) 为准。Desktop 拉取配置落在 Personal AI.app 设置页，豆包桥接总览见 [doubao_bridge.md](./doubao_bridge.md)。

## 大白话运行逻辑

系统在替用户做一件事：**到期了就做一份可恢复的冷备，确认远端写成功后再删旧份。**

1. 先看这份用户有没有打开自动备份、周期到了没有、有没有口令/远端凭证。没开或没到期就跳过。
2. 到期后在线打一份紧凑 SQLite 快照，再把 markdown 和 derived 流式打进 zip。默认把 zip 加密成 `.zip.enc` 再上传。
3. 上传后立刻 HEAD 核对体积。对不上就当失败，**绝不删旧备份**。对上了才按「只留最近 N 份」清理。
4. Coverage「记忆备份」和 Desktop 拉取走同一条导出作业：先创建 job、轮询、再流式下载。手动下载默认不加密，方便直接导入。
5. 恢复永远是用户选文件 → dry-run → merge/replace。系统不会从远端一键覆盖当前库。

主要影响因素（大致优先级）：

1. 开关与凭证是否齐全（没口令不能加密推送；没 URL/bucket 不能测连接）。
2. 是否到点或错过窗口（错过会补跑，不依赖「主动能力」总开关）。
3. 当前是否已有导出/推送在跑（同用户互斥，忙则 409）。
4. 新备份是否通过远端 size 校验（失败则保留旧份并记连续失败）。
5. slim 开关：关向量/FTS 能缩小体积，但恢复后召回要等回填。

门控：

- 加密口令只存在服务端 `config.json`，GET 只回「已配置」；丢失口令 = 密文不可恢复。
- 关闭加密前 Options 会确认：`config.json` 含明文密钥。
- 连败 ≥ 3 次写一条 `auto_backup_failed` 通知，不自动外发或改配置。
- 导入仍走现有高风险/跨用户/replace 二次确认，见 Coverage 文档。

## 用户场景

服务器磁盘损坏时，用户从坚果云 / S3 / 本机目录拿出 `.zip` 或 `.zip.enc`，解密后走 Coverage「录入 → 备份 zip」恢复。

配置一次：

1. Options「自动备份」选 WebDAV 或 S3，设周期、保留份数、加密口令，「测试连接」后再开开关。
2. 可选：Desktop App 打开「自动拉取备份」，选本机目录（iCloud Drive 也可）。Mac 只出站 HTTPS，不开端口。
3. Coverage 看上次/下次、体积分解、两通道历史；右上角仍可手动下载未加密 zip。

灾难恢复：`.zip.enc` 先 `npx tsx memory-service/tools/backup-crypt.ts decrypt`（口令来自 `BACKUP_PASSPHRASE` 或 stdin），再 `POST /import`。必须整文件解密校验后再导入（GCM tag 在文件尾）。

## 两条通道

**服务端推送（主通道）**：memory-service 每 15 分钟检查到期。流式导出 → 默认 AES-256-GCM → WebDAV/S3 PUT → HEAD 校验 → keep-last-N。LocalDirProvider 只给测试，不出现在 UI。

**桌面端拉取**：desktop-app 用已有 Memory Service URL + 设备密钥，创建导出作业、流式下载、校验 sha256、本地保留，并 `POST /backup/pull-receipt` 记入同一份 `state.json`。Options「个人电脑拉取」tab 是引导卡；周期/目录/本地保留只存在 Desktop 设置（`personal-ai://settings/backup`）。

## 导出什么

| 层 | 内容 | 自动备份 |
| --- | --- | --- |
| A | `memory.db` 快照 + `config.json` | 必含 |
| B | 根 markdown 与 daily/dreams/entities/reflections 等全部 `.md` | 必含（不能由 DB 再生） |
| C | derived/ 概览快照 | 默认含，`includeDerived` 可关 |

slim（`includeVectors=false`）从快照 DROP `chunks_vec` / `messages_vec` / `chunks_fts` 再 VACUUM。恢复时重建空表并 FTS rebuild；向量要等后续写入/回填。服务端推送默认 slim=off。

## 大库对策

旧 `POST /export` 把 zip 整包进内存再同步返回，GB 级会超时。现改为 `VACUUM INTO`（失败回退 `db.backup`）、`yazl` 流式 zip、流式 sha256，以及 `POST /export/jobs` 异步作业。Coverage 手动下载走作业轮询。

加密格式：`PABK1`(5) + salt(32) + iv(12) + 密文 + GCM tag(16) 在 EOF。

## 配置与 API

Options 写入既有 `PUT /config`：`autoBackupEnabled`、周期（daily / every_x_hours / weekly）、WebDAV 或 S3 凭证、`autoBackupPrefix`、`autoBackupRetentionCount`（默认 7）、加密开关与口令、`includeDerived` / `includeVectors`。敏感键响应为 `xxxConfigured`，可用 `clearXxx` 清除。调度不依赖 `proactiveSchedulerEnabled`；`AUTO_BACKUP_SCHEDULER_ENABLED=false` 可关掉。

| API | 用途 |
|---|---|
| `POST /api/v1/export/jobs` | 创建流式导出作业 |
| `GET /api/v1/export/jobs/:id` | 进度 |
| `GET /api/v1/export/jobs/:id/download` | 流式下载；`X-Personal-AI-Backup-Archive-SHA256` |
| `GET /api/v1/backup/status` | 脱敏摘要、历史、下次预计、体积分解 |
| `POST /api/v1/backup/run` | 手动推送（忙则 409） |
| `POST /api/v1/backup/test-connection` | 探针写→读→删 |
| `POST /api/v1/backup/pull-receipt` | 桌面拉取回执 |
| `GET /api/v1/backup/remote` | 列远端对象（恢复 UI 尚未接） |
| `GET /api/v1/backup/mirror/status` | 镜像配置（脱敏）、上次运行回执、manifest 文件数 |
| `POST /api/v1/backup/mirror/preview` | 渲染投影并返回将推送的文件清单（不写远端） |
| `POST /api/v1/backup/mirror/test-connection` | 读 ref 探活 |
| `POST /api/v1/backup/mirror/run` | 手动镜像一次 |
| `POST /api/v1/export` | 同步小库导出，兼容保留 |

## 入口

- Options：`src/components/AutoBackupSettings.tsx`
- Coverage 状态中心：`src/modals/components/MemoryCoveragePage.vue`
- Desktop 拉取：`desktop-app/src/backupPuller.ts`、`#backup-pull-settings`
- 导出管线：`memory-service/src/core/MemoryBackupService.ts` `exportMemoryBackupToFile`
- 解密 CLI：`memory-service/tools/backup-crypt.ts`
- GitHub 镜像：`memory-service/src/core/MirrorService.ts`、`memory-service/src/core/mirror/MirrorProjectionService.ts`、`memory-service/src/integrations/backupStorage/GitHubProvider.ts`

## GitHub 镜像通道（Markdown Git Mirror）

**验收状态（2026-10-16）：尚未完成，未在本轮部署。** 已有离线 eval 12/12 通过，但补充上线断言 12/12 失败，涉及敏感字段外泄、`self_only`/confirmed 边界、后续运行覆盖手改、缺失分支初始化和跨时间重建。以下功能契约尚不能视为全部已实现的保证。逐项证据及修复后体验步骤见 [E-79 验收复核](../../memory-service/evals/markdown-git-mirror/readiness-review-2026-10-16.md)；运行 `node tools/verify-memory-mirror-readiness.mjs` 可复现。

这是第三个 provider（WebDAV / S3 之外），但语义不同：它推的是**人类可读的 Markdown 投影**，不是全量快照。SQLite 仍是唯一真源；全量恢复仍走加密 zip。每晚巩固后渲染一次投影，经 egress 过滤后以**一次 commit**推到用户在 Options 填写的 GitHub 仓库；token 只存服务端，永不 force push。

Options 交互：**只有一个「自动备份」总开关**（Toggle 样式，与其它设置页开关一致），镜像通道随总开关生效，没有镜像单独开关——总开关关闭时整个通道配置区隐藏；通道切换（WebDAV 推送 / S3 兼容推送 / 个人电脑拉取 / GitHub 镜像）用 Tab 栏样式，选中的 Tab 记忆在本地，刷新后保持。镜像在总开关开启且仓库 + token 都已配置时才会在夜间调度中执行；「测试连接 / 预览 / 立即镜像」随时可用（服务端未部署该通道时会显示红色提示条）。

大白话：本地投影是视图、可重建；镜像仓库是给人和别的 agent 读的，不是拿来恢复全量库的。

- 认证：fine-grained PAT，只勾目标仓库 `Contents: Read and write`；`config.json` 存 token，GET 只回 `autoBackupGithubTokenConfigured`。
- 写入：Git Data API 单 commit（blobs → tree → commit → update ref），按内容哈希增量，未变文件不重传；commit 后读回 ref 校验，对不上判失败。
- 分支：默认 `main`，可配；永不 force push。远端手改不被覆盖，冲突版本保留到 `conflict-<date>/`（本地版本另存 `.local`）。
- 范围：`all`（全部已确认内容）或 `self_only`（只镜像关于我的内容）；`entities/people` 默认只出有已确认关系的人。
- 模式：`markdown`（可读）或 `encrypted`（整个投影打成 zip 再 PABK1 加密成单个 `.zip.enc`，仓库里只有密文）。
- 每份投影含 `MIRROR.md`，声明包含/未包含什么与恢复入口。

### 投影目录

| 目录 / 文件 | 内容 | 过滤 |
|---|---|---|
| `profile/USER_CORE.md` | 画像视图 | `user_confirmed=1` |
| `profile/one-pager.md` | 常驻一页纸 | `reconcile_artifacts(kind=one_pager)`，缺失时用已确认画像回退 |
| `entities/{people,orgs,projects,topics,technologies}/<slug>.md` | 实体 frontmatter + 属性 + 关系 | 他人只出已确认关系；`self_only` 全不出 |
| `knowledge/{facts,preferences,decisions}/<id>.md` | 原子 unit | `status ∈ {active,superseded}`、`promotion_eligible=1` |
| `workstreams/{active,completed}/<slug>.md` | 关注项 + 注意力账本 | — |
| `timeline/daily/YYYY-MM-DD.md` | 每日派生 unit 链接 | **不含原文**；同样经过 egress 过滤 |
| `consolidation/DIARY.md` | 夜间判决计数 | `unit_reconcile_decisions(phase=B)` |
| `interop/openclaw/{PERSONAL_AI,USER,MEMORY}.md` | OpenClaw 只读互通子集 | 一律 `scope=self`、confirmed；每行带 `<!-- pai:unit:<id> -->` 回声标记 |
| `MIRROR.md` | 生成时间/范围/过滤策略/未包含声明 | — |

### 明确不做

- 不把 Markdown 变真源；不从镜像仓库反向导入（手改只留 conflict 副本）。
- 不推原文、SQLite、`config.json`、token/密钥、`local_only`/`private`/`restricted` 条目。
- 不支持 force push、不自动合并冲突、不做多端同步。
- 不让 OpenClaw / Hermes 的 workspace 直接指向镜像目录（互通走 `interop/` 只读子集）。

## 边界

- 不做增量链、GFS、服务器本地路径用户选项、远端一键恢复。
- 手动 Coverage 下载默认未加密 zip；服务端推送默认加密。
- slim 恢复后向量通道为空，FTS 可用；不自动全库重嵌。

## 验证

- `npx vitest --run src/__tests__/backupCrypto.test.ts src/__tests__/backupSchedule.test.ts src/__tests__/api-backup.test.ts`（memory-service）
- GitHub 镜像：`npm run eval:markdown-git-mirror`（六组离线 case；真实 7 晚 commit 与 esone.qiu 快照人工检查需在有数据的服务上跑 `POST /backup/mirror/preview`）
- GitHub 上线验收：`node tools/verify-memory-mirror-readiness.mjs`（当前 12 条断言失败，不可当作上线通过）；preview 只返回路径/大小/哈希，内容隐私检查需要本地快照渲染。
- Desktop：`NODE_ENV=test npx tsx --test src/__tests__/settings.test.ts`（含 `backupPull` 持久化）
- 线上未部署时 Options 仍应打开；`GET /backup/status` 404 只让状态卡为空，不崩页
