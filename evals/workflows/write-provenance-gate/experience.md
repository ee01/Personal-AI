# Write Provenance Gate 确定性验证

运行 `npm run eval:run -- --suite write-provenance-gate --no-repair`。
五组 case 直接执行生产迁移与写入、Ask/Compose 提示词、候选门控、来源独立性和 turn taint 的 vitest 校验。无 LLM judge：所有边界都是可断言的字段、行数或状态。历史 fixture 100 行覆盖 owner 保留和无效 JSON；生产只读审计在 `memory-service/evals/write-provenance-gate/phase0.json`，不暴露原文。

与六能力回归串联：`npm run eval:memory-abilities`。该命令先验证本地门控，再跑指定部署端点的召回质量。结构标记被移除的任意自由复述、工具未声明网络来源不在可证明范围；外部 Context Pack 会剥离内部标记，仍按外部来源不可信处理。

## Report requirements
报告包含五组逐项结果、执行断言数量、失败原因、代码验证范围和未声明网络来源的边界。回填同时执行 100 条合成历史迁移 fixture 与 100 条生产只读去内容样本。禁止将部署端点的旧代码测试作为本地改动证明。
