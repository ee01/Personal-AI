# Source Memory Distiller Deterministic Rubric

每个 case 直接执行生产保存、deep worker 和可选 Context Recall，并按硬条件判断：

- P0、deep 或 blocked 状态必须与预期完全一致。
- artifact evidence IDs 必须全部指向当前输入快照的真实 spans。
- 注入阻断前不得调用模型。
- 来源聚类只能新增派生链接，不能代替独立 capsule。
- 画像写入、动作 proposal、自动 Skill 激活和单来源建议必须保持为 0。
- matching scene 必须召回，mismatched scene 必须不召回。

任一 proof check 失败即为 `fail`。最终模型措辞、线上 provider 可用性和远端数据分布不在本 rubric 的证明范围内。
