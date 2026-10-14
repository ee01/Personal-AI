# 睡眠期巩固验收

运行 `npm run eval:run -- --suite sleep-time-reconciliation --no-repair`。五组运行真实迁移、nightly runner、TruthMaintainer、遗忘引擎与 reader，共 67 项边界断言。注入 judge 判决用于确定性验证执行安全，不能证明真实模型的判决质量。

另有 `sr-continuation` 9 项有界两跳、隐藏中间节点、重排输出、向量 single-flight、女儿/儿子区分、被动真值、回执/偏好 API 和 C 资格门集成，合计 76 项。界面另跑 `node tools/verify-sleep-reconciliation-e2e.mjs`：新的扩展实例、shadow 标记、来源跳转、撤销/冲突、偏好拒绝、空标签导出。该 UI proof 使用受控服务响应，不冒充生产体验。

另运行 `memory-service/node_modules/.bin/tsx memory-service/evals/sleep-time-reconciliation/quality.ts`，用配置中的实际 LLM 评估 50 个匿名场景（20 最新版本、15 both-valid、5 corroborate、10 推断），产出 `quality-report.json`。标签来自 issue 中的 Jira/会议与礼物场景；生产原文未进入 fixture，长年份为合成压力条件。门槛：最新值正确率 >=.9、both-valid 误判 <=.1、推断覆盖违规 0、整体判决一致率 >=.85。该报告不代替每用户 50 对人工 shadow 抽样，更不能向生产写合成 gold。

生产只读统计在 `memory-service/evals/sleep-time-reconciliation/phase0.json`。六能力回归必须指向本分支启动的本地服务或部署本分支后的生产服务；不能用旧端点成绩冒充新代码结果。

## Report requirements
逐组列出实际断言与失败，说明真实 judge 与执行边界的区别。保留 production baseline、LLM quality 和六能力报告，明确未执行的延迟、流量与人工 shadow 资格门槛。
