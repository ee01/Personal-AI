# Progress: Memory Foundation Rearchitecture Review

## Session: 2026-09-07

### Phase 1: 仓库与原 plan 审阅

- **Status:** complete
- **Started:** 2026-09-07
- Actions taken:
  - 读取 `AGENT.md`、planning-with-files skill、原 plan 的首段与关键中段。
  - 检索与 Memory Lens、Common Ground Memory、memory-service 相关的历史记忆。
  - 确认仓库已有其他任务的 planning 文件，创建隔离审查目录且不切换 `.planning/.active_plan`。
  - 完整读取 `AGENT.md`，并索引原 plan 的全部章节标题和行号。
  - 阅读原 plan §0-§5，记录执行文本冲突、lineage JSON、版本历史和重复加固的完整性风险。
  - 阅读 §6-§7.9，记录抽取失败污染、产量配额、Batch 时效矛盾、FSRS 曝光反馈环与容量类推问题。
  - 阅读 §7.10-§9，记录多视图裁决未同步、强制最小结果、阈值校准、反馈学习选择偏差和画像来源独立性问题。
  - 阅读 §10-附录，记录去重唯一键不可执行、时间恢复造假、备份/切库风险、适配器隐私和 schema 漂移问题。
  - 回读 §2-§5，记录生产证据因果等级、读路径 fail-open 安全边界和表数量口径问题。
  - 精读 §3 与 §12，确认 P0 超载、阶段清单漂移、不可满足依赖和迁移观测不足。
  - 完成首轮外部检索，确认 Supermemory、Cognee、LangMem 是 plan 的重要遗漏，并发现 MemoryAgentBench、MemEvoBench、LongMemEval-V2 三类补充评测。
  - 补充确认 Hindsight（约 18.9k★）、TencentDB-Agent-Memory（约 26.0k★）与 memU（约 14.4k★）为必须审视的热门漏项；GitHub direct repo API 受 403 限制，已切换到官方页面检索。
  - 用 2026-09-07 官方 GitHub 页面重算热门项目快照，并确认 TencentDB-Agent-Memory 的 ACL/loadout 分层与 Letta 旧 API 已停止维护。
  - 深读 memU、A-MEM、LongMemEval/LongMemEval-V2、MemoryAgentBench、AMemGym/MemoryBench；形成“被动零 LLM + 显式 deep agentic 慢路径”和 on-policy eval 建议。
  - 核对 SQLite FTS5、VACUUM INTO、Online Backup 与 sqlite-vec 量化官方文档，确认 FTS 同步/回填、切库 quiesce 和版本 pin 是必须补齐的执行 contract。
  - 完成阶段重排、评测矩阵、迁移双读和 schema 正规化建议，进入最终引用与行号复核。
  - 复核本地章节行号、研究来源与修改范围；原 plan 和运行时代码均未改动，审查报告完成。
- Files created/modified:
  - `.planning/2026-09-07-memory-foundation-plan-review/task_plan.md`
  - `.planning/2026-09-07-memory-foundation-plan-review/findings.md`
  - `.planning/2026-09-07-memory-foundation-plan-review/progress.md`

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| 任务范围检查 | 不修改原 plan/运行时代码 | 当前仅创建隔离研究记录 | 通过 |
| `git diff --check`（owned docs） | 无 whitespace error | 无输出，exit 0 | 通过 |
| Markdown 结构检查 | 9 份变更 Markdown 无失效相对链接、奇数 fence、重复 heading | errors=[] | 通过 |
| Superseded contract scan | 主/回填/benchmark 不含已废弃检索、模型或 LLM-judge contract | 0 命中 | 通过 |
| Demo Playwright 1440×900 | 6 sections、文本已同步、无 overflow/console error | 通过 | 通过 |
| Demo Playwright 1024×768 | 6 sections、文本已同步、无 overflow/console error | 通过 | 通过 |
| Demo Playwright 390×844 | 6 sections、文本已同步、无 overflow/console error | 通过；首次 4px overflow 已修复 | 通过 |

## Error Log

- 2026-09-07：运行 `huashu-design/scripts/verify.py` 验证关联 demo 时，Python 环境缺少 Playwright。该失败属于验证环境问题，不代表 demo 缺陷；后续改用内置依赖或 `npx playwright`，不重复原命令。
- 2026-09-07：补充并发幂等 contract 的跨章节 patch 因一个上下文位置未匹配而整体未应用；改为按章节拆分窄 patch。
- 2026-09-07：合并更新 Phase 状态与 Test Results 时 progress 上下文未匹配，整体未应用；后续按文件和实际表头拆分。

| Timestamp | Error | Attempt | Resolution |
|---|---|---:|---|
| 2026-09-07 | 合并读取输出被截断 | 1 | 后续按章节分块读取 |

## 5-Question Reboot Check

| Question | Answer |
|---|---|
| Where am I? | Phase 1，完整阅读并结构化原 plan |
| Where am I going? | 外部证据研究、差距分析、交付 |
| What's the goal? | 形成证据充分、可映射到章节的改进建议 |
| What have I learned? | 见 findings.md |
| What have I done? | 见上方进度 |

## Session: 2026-09-07 Canonical Rewrite

### Phase 5-9: Canonical 重写、审计与交付

- **Status:** complete（canonical rewrite、red-team audit、关联文档对齐与验证完成）
- **Started:** 2026-09-07
- Actions taken:
  - 用户授权直接改写原 plan，并要求持续正反分析直到方案无内部冲突且可执行。
  - 重新读取 planning-with-files skill、根 planning 文件、本任务隔离记录、当前 plan 结构与相关历史记忆索引。
  - 决定采用“canonical RFC + 决策记录 + 分阶段 runbook”结构，旧增量式正文不再继续叠加修正。
  - 补充 2026 memory poisoning、安全修复、ACL 落地反例与 EvoMemBench 等一手研究。
  - 冻结 24 项 canonical decisions，覆盖文档版本、阶段、schema、写入、检索、反馈、权限、删除、迁移和评测。
  - 用 1071 行 canonical v3 整体替换原 2217 行增量式 plan；旧推理保留在 Git 历史。
  - 首轮审计修复 P0b/P0c 数据作业重复归属、线性 sensitivity filter、edge revision 缺失、safe-mode 阶段与 vector coverage 误判风险。
  - 对照当前 checkout 复核 ingest skip、passive/composer raw fallback、浏览器 metadata 嵌套和 rehearsal 逐次 INSERT，确认 P0a 根因仍有代码证据。
  - 新增浏览器 client_hint 与服务端 canonical extraction 的唯一职责边界。
  - 审计并同步更新关联的 backfill plan 与 demo，删除旧模型先换、Tier 1/2 立即回填、created_at 冒充事件时间、三库分离、trigger 双通道、展示即强化等冲突。
  - 因修改了关联 HTML demo，完整读取 huashu-design skill 与 verification reference；将执行 Playwright 渲染、控制台和多视口检查。
  - 第二轮 red-team 修复 pre-persist secret screening、安全隔离存储、projection policy prefilter、FTS raw/segmented 口径、exposure TTL、ingest schema v2 与 P3-P5 可执行性缺口。
  - 确认 huashu-design 的 verify.py 存在且 `npx playwright` CLI 可解析；随后实跑发现 Python 环境未安装 Playwright，已记录并改用 Codex bundled Node/Playwright。
  - 首次整体替换 patch 因 apply_patch 不允许同一路径同时 Delete + Add 而失败；改用两个独立 patch，不重复原失败方式。
  - 改用 Codex bundled Node/Playwright 完成 1440×900、1024×768、390×844 三视口渲染；首次发现移动端 4px table overflow，增加 fixed layout/anywhere wrap/mobile padding 后复测横向溢出为 0，控制台错误为 0。
  - 第三轮语义审计补齐 UTF-8 span、derived lineage、truth/policy/delete 表、quarantine key 管理、terminal receipt/checkpoint、explicit exact-span note、统计非劣门和 evidence bundle。
  - 冻结服务端 feature flag 依赖图，明确 P0.5 的 MiniLM control、multilingual-e5-small 与条件式 BGE-M3 dense-only 候选，以及 prefix/model revision 隔离。
  - 审计主 plan 顶部关联文档；对齐 benchmark/delete runbook，并把仍基于旧 HTTP/权限模型的 MCP 与 Context Passport 文档降级为历史产品输入，避免并存实现真源。
