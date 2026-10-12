# Write Provenance Gate 验证记录（2026-10-12）

实现范围：来源闭集、会话资格、历史回填、后台上下文、Ask/Compose 召回标记、exposure 审计、legacy/v3 durable 门控、同族来源去增益、持久化同轮网络污染。规范已归入 memory_claim_attribution / memory_foundation；规划文档已删除。

| 确定性 case 组 | 证据 | 结果 |
|---|---|---|
| 后台产物 | 10 次 pipeline 写入 + 并行上下文隔离 | PASS，无晋升资格；原文保留 |
| Ask → Compose → ingest | 10 次真实提示词组装回放 | PASS，raw/unit 增量 0；exposure 每次 +1 |
| 独立来源 | 10 组同作者重复、系统派生与独立作者对照 | PASS，同族 salience 频次增量 0 |
| 同轮污染 | 6 组 web_fetch / OpenClaw / 外部 AI | PASS，后续 assistant 全部 untrusted；用户新消息清除 |
| 历史回填 | 100 条 pre-074 fixture + 100 条生产去内容 owner 抽样 | PASS，owner 误标 0；已有 exposure 保留；可重入 |

`npm run eval:run -- --suite write-provenance-gate --no-repair`：5/5 组通过，39 项断言。报告 `.eval-runs/20261012T091227Z-write-provenance-gate-3e20im/report.html`。
`npm run eval:validate`：27 suites 校验通过；既有四个空 suite 提示保留。

本地整体针对性回归：19 文件 / 232 测试通过；最终细化覆盖另行验证 53 项、51 项通过。memory-service TypeScript build、Node 脚本解析、路径范围 diff --check 通过。`npm start` 首次 webpack development 编译通过，watch 已停止。

线上已部署，数据仍挂载 `personal-ai_memory-data` named volume。只读检查 17,628 条原文：origin_class 空值 0；后台晋升违规 0；memory_unit_sources 与原文资格不一致 0。上线前审计 181 条 system/AI 来源原文、1,763 条相关/派生 chunks；可追溯到的 profile/truth 行为 0。旧记录普遍没有 session_kind，声明的后台回灌次数 0 不代表历史不存在回灌。

已知既有测试问题：Ask 两条 OpenClaw 用例期待 resolutionState=complete，但得到 partial；原始 HEAD 副本相同环境复现。新增门控覆盖范围不依赖这两条用例。

边界：未声明的网络工具、丢失结构标记的任意自由复述无法确定性追踪。外部 Context Pack 剥离内部标记；外部/导入内容本身没有 durable 自动晋升资格。origin 分类不调用 LLM，不删除已入库内容。

线上回放：`POST /ingest` recalled 标记请求 HTTP 200，status=duplicate、reason=recalled_exposure、originClass=agent、derivedFrom 正确；raw 增量 0、exposure 增量 1。

## 六能力实际结果与同数据对照

部署容器内 loopback 运行同一 `eval-memory-abilities.ts` 基准，使用默认双次规则，读取真实 esone.qiu 数据并启用 evaluationMode=read_only：extraction 1.00、multi_session 1.00、temporal 1.00、knowledge_update 0.67、abstention 1.00、prospective 0.50；5/6 单项通过。存储基线比较退出码 1（knowledge_update 和 prospective 均低于原 1.00），没有修改或降低基线。

对照启动临时同代码、同数据、同模型配置的 API 进程，关闭 WRITE_ORIGIN_GATE_ENABLED / RECALL_LOOP_GUARD_ENABLED / TURN_TAINT_ENABLED，重新运行两个回退 case（每个两次）。结果仍为 0.67 和 0.50；未观察到新增门控引起的额外回退。当前既有召回/数据质量没有满足存储基线，这是明确保留的交付风险，并非“六能力全过”。对照进程、临时本地进程均已停止，未保留生产数据本地副本。

线上门控模块 SHA256 与本地编译产物一致：ee2ece88e1fd5e42fa026c207c356f3dd9785a403ce8d4553c97d171ac7da55b。汇总见 abilities-comparison.json；完整能力报告与对照报告随任务评论附件交付。此前主机侧连接中断发生在容器重建期；生产模型缓存还报告过 protobuf 解析失败，容器内执行用于排除传输问题。
