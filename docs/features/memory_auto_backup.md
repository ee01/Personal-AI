# 记忆自动备份 / Memory Auto Backup

_最后更新: 2026-08-25_

## 状态与定位

P0/P1 已落地，P2 的桌面拉取、slim 导出、pull-receipt 与远端列表也已可用。尚未做：GFS 保留、yauzl 流式导入、coverage 一键远端恢复 UI、slim 恢复后的向量 re-embed 回填任务。

记忆库是全系统唯一不可再生资产。自动备份把全量快照（现有 manifest + Layer A/B/C）定时加密后送到用户自己的存储，并修掉大库手动导出超时。

它不是增量备份、多端合并或云同步。也不备份 `analytics/usage.db`、WAL/SHM 或 `backups/state.json`。

配套交互原型：[memory-auto-backup-demo.html](../demo/memory-auto-backup-demo.html)

## 用户场景

服务器磁盘损坏时，用户应能从自己的坚果云 / S3 / 本机目录拿出一份 `.zip` 或 `.zip.enc`，解密后走 Coverage 页「录入 → 备份 zip」恢复。

配置一次即可：

1. Options「自动备份」选 WebDAV 或 S3，设周期、保留份数、加密口令，点「测试连接」再开开关。
2. 可选：在 Desktop App 打开「自动拉取备份」，选本机目录（iCloud Drive 也可）。Mac 只出站 HTTPS，不开端口。
3. Coverage 页看上次/下次、体积分解、两通道历史；右上角「记忆备份」仍可手动下载未加密 zip。

灾难恢复：`.zip.enc` 先用 `npx tsx memory-service/tools/backup-crypt.ts decrypt`（口令来自 `BACKUP_PASSPHRASE` 或 stdin），再 `POST /import`。口令丢失则密文不可恢复。

## 两条通道

**服务端推送（主通道）**：memory-service 每 15 分钟检查到期（错过窗口会补跑）。流式导出 → 默认 AES-256-GCM 加密 → WebDAV/S3 PUT → HEAD 校验 size → 再 keep-last-N 清理。口令只存在用户 `config.json`，GET `/config` 只回 `xxxConfigured`。

**桌面端拉取**：desktop-app 用已有 Memory Service URL + 设备密钥，创建导出作业、流式下载、校验 sha256、本地保留，并 `POST /backup/pull-receipt` 记入同一份 `state.json`。Options 的「个人电脑拉取」tab 是引导卡，真正周期/目录在 Desktop 设置页（`personal-ai://settings/backup`）。

LocalDirProvider 只给测试用，不出现在 UI。

## 导出什么

| 层 | 内容 | 自动备份 |
| --- | --- | --- |
| A | `memory.db` 快照 + `config.json` | 必含 |
| B | 根 markdown 与 daily/dreams/entities/reflections 等全部 `.md` | 必含（不能由 DB 再生） |
| C | derived/ 概览快照 | 默认含，`includeDerived` 可关 |

slim（`includeVectors=false`）会从快照 DROP `chunks_vec` / `messages_vec` / `chunks_fts` 再 VACUUM。恢复时重建空表并 FTS rebuild；向量要等后续写入/回填。服务端推送默认 slim=off。

`config.json` 含明文密钥，出服务器必须加密（默认开）。

## 大库对策

旧 `POST /export` 把 zip 整包进内存再同步返回，GB 级库会超时。现改为：

1. `VACUUM INTO` 做在线紧凑快照（失败回退 `db.backup`）
2. `yazl` 流式 zip + 流式 sha256
3. `POST /export/jobs` 立即返回 jobId，后台写临时文件；`GET /export/jobs/:id` 轮询；`GET .../download` 带 Content-Length 流式下载
4. Coverage「记忆备份」走作业轮询；旧 `POST /export` 仅适合小库

加密格式：`PABK1`(5) + salt(32) + iv(12) + 密文 + GCM tag(16) 在 EOF。必须整文件解密校验后再导入。

## 配置与 API

Options 写入既有 `PUT /config`：

- `autoBackupEnabled` / `autoBackupScheduleType`（daily / every_x_hours / weekly）/ `autoBackupPreferredHour` / `autoBackupIntervalHours`
- `autoBackupProvider`：`webdav` | `s3`，以及对应 URL/凭证
- `autoBackupPrefix`、`autoBackupRetentionCount`（默认 7）
- `autoBackupEncryptionEnabled`（默认 true）+ `autoBackupEncryptionPassphrase`
- `autoBackupIncludeDerived` / `autoBackupIncludeVectors`

敏感键响应为 `xxxConfigured`，可用 `clearXxx` 清除。调度不依赖 `proactiveSchedulerEnabled`；可用 `AUTO_BACKUP_SCHEDULER_ENABLED=false` 关掉。

| API | 用途 |
|---|---|
| `POST /api/v1/export/jobs` | 创建流式导出作业（`includeDerived` / `includeVectors` / `encrypt`） |
| `GET /api/v1/export/jobs/:id` | 进度：queued / exporting / packaging / encrypting / ready / failed |
| `GET /api/v1/export/jobs/:id/download` | 流式下载；`X-Personal-AI-Backup-Archive-SHA256` |
| `GET /api/v1/backup/status` | 脱敏配置摘要、历史、下次预计、体积分解 |
| `POST /api/v1/backup/run` | 手动触发服务端推送（与导出作业互斥，忙则 409） |
| `POST /api/v1/backup/test-connection` | 探针写→读→删 |
| `POST /api/v1/backup/pull-receipt` | 桌面拉取回执 |
| `GET /api/v1/backup/remote` | 列远端对象（恢复 UI 尚未接） |
| `POST /api/v1/export` | 同步小库导出，兼容保留 |

连败 ≥ 3 次写入 `notification_records`（`auto_backup_failed`）。新备份 HEAD 校验通过前绝不 prune。

## 入口

- Options：`src/components/AutoBackupSettings.tsx`
- Coverage 状态中心：`src/modals/components/MemoryCoveragePage.vue`
- Desktop 拉取：`desktop-app/src/backupPuller.ts`、设置页 `#backup-pull-settings`
- 导出管线：`memory-service/src/core/MemoryBackupService.ts` `exportMemoryBackupToFile`
- 解密 CLI：`memory-service/tools/backup-crypt.ts`

## 边界

- 不做增量链、不做 GFS、不把服务器本地路径当成用户选项。
- 手动 Coverage 下载默认未加密 zip，可直接 import；服务端推送默认加密。
- 恢复仍必须用户选文件、dry-run、再 merge/replace；没有远端一键恢复按钮。
- slim 恢复后向量通道为空，FTS 可用；不自动花 token 全库重嵌。
