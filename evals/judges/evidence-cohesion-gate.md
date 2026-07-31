# Evidence Cohesion Gate Deterministic Rubric

该 suite 不使用 LLM judge。每个 case 直接调用生产 Gate，并按以下硬条件判断：

- `state` 必须精确匹配。
- `includedEvidenceRefs` 与 `excludedEvidenceRefs` 必须集合相等。
- Gate 后跨题泄漏数必须为 0。
- 预期保留证据的召回率必须为 100%。
- 有基线泄漏时，Gate 后泄漏必须严格下降。
- 阻断状态与静默回执必须符合场景预期。

任一条件失败即为 `fail`。最终回答文本、LLM 文风和线上 connector 可用性不在本 rubric 的证明范围内。
