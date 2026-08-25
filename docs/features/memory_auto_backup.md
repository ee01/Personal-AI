# 记忆自动备份 / Memory Auto Backup

_最后更新: 2026-08-25_

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
| `POST /api/v1/export` | 同步小库导出，兼容保留 |

## 入口

- Options：`src/components/AutoBackupSettings.tsx`
- Coverage 状态中心：`src/modals/components/MemoryCoveragePage.vue`
- Desktop 拉取：`desktop-app/src/backupPuller.ts`、`#backup-pull-settings`
- 导出管线：`memory-service/src/core/MemoryBackupService.ts` `exportMemoryBackupToFile`
- 解密 CLI：`memory-service/tools/backup-crypt.ts`

## 边界

- 不做增量链、GFS、服务器本地路径用户选项、远端一键恢复。
- 手动 Coverage 下载默认未加密 zip；服务端推送默认加密。
- slim 恢复后向量通道为空，FTS 可用；不自动全库重嵌。

## 验证

- `npx vitest --run src/__tests__/backupCrypto.test.ts src/__tests__/backupSchedule.test.ts src/__tests__/api-backup.test.ts`（memory-service）
- Desktop：`NODE_ENV=test npx tsx --test src/__tests__/settings.test.ts`（含 `backupPull` 持久化）
- 线上未部署时 Options 仍应打开；`GET /backup/status` 404 只让状态卡为空，不崩页
