# Task Plan: Memory Auto Backup

## Goal
按记忆自动备份方案落地：流式导出作业修大库超时，服务端 WebDAV/S3 推送，桌面端拉取，coverage 状态中心与 options 配置。

## Current Phase
Complete

## Phases
### Phase 1: Requirements & Discovery
- [x] 读 plan / demo
- [x] 摸清 MemoryBackupService、export、config、coverage、desktop settings
- **Status:** complete

### Phase 2: P0 Streaming export + jobs + crypto
- [x] yazl 流式 zip + 流式 sha256 + VACUUM INTO
- [x] ExportJobService + /export/jobs 三路由
- [x] backupCrypto + tools/backup-crypt.ts
- [x] coverage / exploring 手动导出改 job 轮询
- **Status:** complete

### Phase 3: P1 AutoBackup + providers + config/UI
- [x] AutoBackupService + scheduler tick
- [x] WebDAV / S3 / LocalDir providers + retention + state
- [x] /backup/status·run·test + config 脱敏键
- [x] options 配置区块 + coverage 状态卡
- **Status:** complete

### Phase 4: P2 Desktop pull + slim + pull-receipt
- [x] desktop-app BackupPuller + settings
- [x] options 个人电脑拉取引导卡
- [x] pull-receipt、slim 模式、GET /backup/remote
- **Status:** complete（未做 GFS、yauzl 流式导入、远端一键恢复 UI、向量 re-embed 回填）

### Phase 5: Tests, docs, delivery
- [x] 单测（加密 round-trip、作业、retention、config 脱敏、备份 API）
- [x] 写入 `docs/features/memory_auto_backup.md` + coverage/index，归档 progressing
- [x] 验证并提交
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| AutoBackup 直接调 exportToFile，不走 job 队列 | 推送不需要可下载临时文件；job 专供 coverage/desktop 拉取 |
| 共享 per-user export lock | 避免推送与手动导出同时打爆磁盘 |
| AutoBackup tick 不依赖 proactiveSchedulerEnabled | 与 outreach 一样，数据保险应独立运行 |
| options 用独立 AutoBackupSettings 组件 | 配置全在服务端 PUT /config，避免塞进 chrome.storage 大表单 |
| 导入 multipart 上限提到 4GB | 现网 610MB zip 会被 512MB 限制挡住恢复 |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| api-backup 401 because env API_KEY | tests delete API_KEY + resetConfigForTests |
| tsc: promisify(scrypt) arity / WriteStream.end callback | explicit scrypt callback + end without err arg |
