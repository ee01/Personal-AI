# E-79 Markdown Git Mirror 验收复核

日期：2026-10-16。被检查实现：`d2ed7f2`。依据：E-79 当前描述、触发评论、该提交父版本中的 `docs/progressing/memory-markdown-git-mirror-plan.md`、`AGENT.md`。

**结论：需求尚未全部完成，不能进入真实用户数据的生产镜像测试，也不能据此关闭卡片。** 本轮未部署、未设置 GitHub 仓库/token、未推送用户记忆。原实现已有大量主体代码，但现有测试通过不足以证明隐私与冲突约束成立。本次提交的是可复跑的验收检查与复核记录，没有修复或宣称修复这些产品缺口。

## 本轮实际验证

| 检查 | 实际结果 | 能证明的范围 |
| --- | --- | --- |
| `npm run eval:markdown-git-mirror` | 12/12 通过 | 原有六组固定样本；本轮刷新 `report.json` |
| `npm --prefix memory-service test -- --run src/__tests__/api-backup.test.ts src/__tests__/backupCrypto.test.ts src/__tests__/backupSchedule.test.ts` | 8/8 通过 | 既有备份 API、PABK1 通用加解密、调度算法；不是 GitHub 加密包完整链路 |
| `npm --prefix memory-service run build` | 通过 | 服务端 TypeScript 编译 |
| `npm start` | webpack 首次编译成功，随后 Ctrl-C 停止 | 当前工作树扩展构建；包含已有其他任务修改，不是可发布包 |
| 新 Chromium persistent context 加载新 `dist/`，Options 点击 | 连接、预览、立即镜像、token 不回显通过 | 所有 HTTP(S) 均 mock；无真实服务/GitHub 写入 |
| `node tools/verify-memory-mirror-readiness.mjs` | **0/12 通过，退出码 1** | 12 条新增要求断言确实失败；全部为合成内存数据和假 GitHub |

检查器从原测试文件复用 fixture 和 FakeGitHub，在独立临时测试文件执行 `readiness-probes.ts.txt`，最终删除临时文件。JSON 产物为 `test-results/markdown-git-mirror-readiness.json`。其退出码 1 是验收失败，不是 expected-failure 测试，也不是运行环境报错。

## 已复现的失败断言

以下源码路径均相对于仓库根目录。

| # | 要求与合成复现 | 实际结果 / 原因 |
| --- | --- | --- |
| 1 | interop 只含 confirmed：新增 `active`、`confirmation_state=unconfirmed` 的 owner 偏好 | 未确认偏好出现在 `interop/`；`MirrorProjectionService.loadUnits` 不读取/过滤 `confirmation_state` |
| 2 | 一页纸新鲜度：把 artifact 的 `expiry_at` 设为 1 | 过期内容仍导出；`renderOnePager` 不检查有效期 |
| 3 | 缺失策略必须拒绝：`evaluateMirrorEgress(owner, {})` | 返回 `allowed=true`；未知/缺失值回退到 `internal` + `approved_destinations`，与其 fail-closed 注释相反 |
| 4 | `self_only` 必须关于本人：owner 消息支持的 fact，`subject_key=person:colleague`、`evidence_class=third_party_report` | 他人信息进入 self_only 投影及 interop；owner 来源不等于 subject=self |
| 5 | 一页纸继承来源边界：内容写合成他人医疗信息，`source_unit_ids_json` 指向 restricted unit | self_only 一页纸仍包含该信息；只用“他人/third-party”关键词判断，未沿来源检查策略和主体 |
| 6 | workstreams 继承来源策略：candidate attention 标题引用 restricted unit | restricted 标题出现在 self_only；`loadWorkstreams` 为所有标题硬编码可外发策略，未检查 source unit/message |
| 7 | 实体不含 token/密钥：已确认关系人物添加 inferred `password` 属性，内容为合成 token | token 明文进入 entities；人物关系确认不能替代全部属性/关系/描述的逐项外发授权 |
| 8 | 画像不含 token/密钥：confirmed profile 项设 `item_key=github_token`、值为合成 token | token 明文进入 profile；`user_confirmed=1` 不能替代字段过滤 |
| 9 | 相同真源跨时间重建 diff 0：时钟前进 1 秒，不改 DB | 多个文件哈希改变；运行时 `generated_at` 被写入业务文件。原测试固定同一个 `now`，掩盖此问题 |
| 10 | 初次镜像保留远端手写：空 manifest，远端已存在同名 `profile/USER_CORE.md` | 文件直接被本地版本覆盖；冲突检测要求先有 manifest |
| 11 | 后续运行仍保留手改：首推 → 用户手改 → 冲突 → 按真实 runner 的 `markRemoteState` 更新 → 本地再变化 | 第三轮覆盖用户手改；`MirrorService` 把手改 SHA 记作基线，下一轮不再检测出冲突 |
| 12 | 缺失分支首次推送：让假服务拒绝 PATCH 不存在的 ref | 推送失败；`GitHubProvider.putTree` 无论 ref 是否存在都调用 PATCH。原 FakeGitHub 会让 PATCH 创建分支，掩盖真实协议限制 |

第 12 项的协议依据：[GitHub Git references 官方文档](https://docs.github.com/en/rest/git/refs)。创建 ref 使用 POST，更新现存 ref 使用 PATCH；空仓库还有初始化限制。此处是官方协议与隔离模拟证据，并非真实 GitHub 实测。

## 全部阶段与细节对照

| 范围 | 已有实现 | 尚未完成 / 尚无证据 |
| --- | --- | --- |
| Phase 0 | 确定性渲染器、写本地目录、profile/entities/knowledge/daily、MIRROR 声明 | 上述隐私、主体、确认与时钟缺口；未对真实 esone.qiu 快照检查内容；没有 weekly reports 投影 |
| Phase 1 | Git Data API 合并树为一次 commit、manifest、回执、`force:false`、Options 第四 tab | 首次同名文件/后续冲突保护失败；缺失分支初始化失败；真实测试仓库 7 晚未跑；只读回 ref，未读回 tree SHA；递归 tree 的 `truncated` 未处理 |
| Phase 2 | unit 级 egress、self_only、zip+PABK1 加密分支、服务端 token 脱敏 | 未做到所有来源/文件真实策略过滤；无用户级 local_only 禁用链路或 UI 置灰；加密镜像完整生成→提交→下载→解密尚未验证 |
| Phase 3 | `workstreams`、三个 interop 文件、回声标记 | interop 未限制 confirmation_state/subject；attention 外发边界失败；没有计划中的 `interop/openclaw/memory/`；无真实 OpenClaw 引用/只读索引与命中率实测 |
| Phase 4 | `consolidation/DIARY.md` 判决计数 | 无计划中的 diff 高亮；`shadow` 和 `applied` 一起计数，未区分未落地判决 |
| 调度 | 自动备份循环每 15 分钟调用 `tickMirrors` | `ProactiveScheduler.runAutoBackupCycle` 与每日 consolidation cron 独立；不保证巩固后执行。复用备份周期，默认 03:00、整小时；不是独立默认 23:30 |
| Options | 保存、连接、预览、运行、模式/范围/token、commit 回执 | fresh dist 实测运行后 GitHub tab 失去选中态（`load()` 重设 WebDAV）；GitHub 页加密模式只有 token 密码框、无口令和时间控件，提示“下方配置”实际在其他 tab；无首次开启专用说明确认 |
| 配置与观测 | migration 079、运行/manifest 表、用户开关、过滤计数、通用失败通知 | 计划所写 `AUTO_BACKUP_GITHUB_ENABLED` / `MIRROR_PROJECTION_ENABLED` 无实现；`bytesTotal` 未传入 finishRun；多通道共享连续失败计数，其他通道成功会清零 GitHub 连败（静态风险，未做跨通道故障注入） |
| 产品边界 | 镜像不做反向导入；代码没有 force push；不打包 SQLite/config 作为 Markdown | 字段内容仍可能包含 token/敏感信息（已复现）；加密后旧 Git 历史里的明文不会消失，不能把切换加密当作历史清除 |
| 文档交接 | 原 plan 已删、demo 已移 `docs/demo/`、主功能文档和索引已有入口 | 本轮补齐真实验收状态与复核链接，避免把能力描述当作上线证明 |

补充区别：计划的可选模式 B/importer 已拆到独立 OpenClaw Link 需求，不把未实现 importer 本身作为 E-79 阻塞项。E-79 的“标记存在”也不能证明回流新 unit 为 0。

## 原六组 eval 为什么不够

原 suite 的 self_only 只有 2 条（要求至少 10），冲突 1 条（要求至少 3），interop 3 条（要求至少 5）；回声 marker 的存在未实际走 importer。五晚增量用同一份已渲染 `files`，没有每天重新渲染；FakeGitHub 的 `blobUploads` 仅在 SHA 首次出现时加一，不能证明未重复发送 blob API 请求。原重建测试未真正删除本地目录、未跨时钟重渲染。没有真实 OpenClaw 读取、7 晚 commit 或逐字段全量扫描证据。

`POST /backup/mirror/preview` 只返回路径、bytes、hash，不返回内容。查看该清单本身不能满足“人工检查投影无原文/敏感信息”的 Phase 0 门槛。

## 修复后如何体验与验收

当前可做隔离 UI/合成数据检查；下列真实仓库步骤须在上述失败项修复、检查器变绿之后执行。本轮没有声称已完成这些线上步骤。

1. 完成本地 targeted/API/eval 与 fresh dist E2E。部署 `npm run deploy:memory`，检查 `http://10.32.56.212:3210/health` 和数据卷挂载；扩展 Options 需要重新加载新构建，服务端部署不会自动更新已安装扩展。
2. 使用专用**私有测试仓库**，初始化 README，准备仅该仓库 Contents: Read and write 的 fine-grained PAT。在 Options → Memory Service → 自动备份 → GitHub 镜像填写仓库、分支、token，选择 Markdown 和 self_only。不要把 PAT 发到评论或截图里。首次用合成账号；真实账号按已有设备密钥授权访问。
3. 保存后重新打开，token 输入为空而显示已配置；GET config/status 不返回 PAT。测试连接应显示当前分支。预览应该给出目录、大小和过滤计数；另在本地真实数据快照上渲染并人工检查**内容**，不向 GitHub 推送快照。
4. 点击立即镜像，一次运行对应一个 commit，回执链接可打开。检查 MIRROR/profile/knowledge/workstreams/timeline/DIARY/interop，确认没有原文、DB、config、密钥、restricted、他人信息或未确认的 interop 条目。再次运行不改数据，应不重复上传未变文件；仅允许有意设计的独立回执元数据变化。
5. 在测试仓库手改一份投影，再运行并修改本地真源后再运行。两轮都必须保留用户手改，conflict 保留两版。新仓库第一次已有同名文件也不得静默覆盖。并发移动 ref 必须失败而不是 force push。
6. 换专用测试分支验证加密包：仓库只产生密文 payload；下载 `.zip.enc`，用现有 `memory-service/tools/backup-crypt.ts` 解密，再解压检查投影。错误口令必须失败。用独立分支避免把已有明文历史误当成已加密。
7. OpenClaw 保持自己的 workspace；通过 instruction 引用或只读 bridge 读取 `interop/openclaw/`，用至少 5 个 confirmed 自我偏好场景验证命中率 ≥0.8。未确认、observed、他人和被撤回条目不能进入子集；保留 `pai:unit` 标记。
8. 启用修复后的巩固后调度，用测试仓库记录连续 **7 个真实夜晚**的运行时间、commit SHA、变更/上传数、过滤数和错误。离线改时钟/连点七次不算七晚。完成全部门槛后再关闭 E-79。

## 后续修复顺序

先修复确认/主体/来源策略/秘密字段与 fail-closed，再修复 manifest 冲突、ref 初始化和 tree 校验，然后处理稳定投影、巩固调度及 Options 配置体验。补齐六组最少样本和真实消费/加密路径，再部署专用测试账号，最后完成七晚实测。未通过前卡片保持 `in_progress`，不标 `done`。
