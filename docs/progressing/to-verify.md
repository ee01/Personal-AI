# 待校验事项

## Memory Day Pilot P0.5：真实数据质量校验

- **最早运行日期**：2026-05-19
- **状态**：pending
- **范围**：只读校验，不写入真实用户数据。
- **对象**：`esone.qiu` 在真实 memory-service 数据中的 Day Pilot brief 生成质量。

### 校验目标

确认 P0 已实现的“从原始记忆生成今日 mission”在真实数据里不是只会生成分类汇总，而是能稳定生成 3-7 张具体、可执行、可追溯的 mission card。

### 校验步骤

1. 连接真实 memory-service，使用 `X-User-Id: esone.qiu`。
2. 生成或刷新当天 Day Pilot brief。
3. 检查 top 3-7 mission 是否是具体事情，而不是“几条消息”“几个动作”这类分类。
4. 每张 card 必须有 `whyNow`、`nextBestAction`、真实 `evidenceRefs`、priority、state 和可渲染 context pack。
5. 人工判断 top 5 中至少 2 张是否真正有用。
6. 检查 recurring meeting、低价值通知、旧 open-loop 是否被降噪。
7. 验证 `done`、`later`、`mute`、`wrong`、`useful` feedback 是否影响下一次返回和排序。
8. 记录失败样例，作为 P1/P2 ranking 和聚类优化输入。

### 通过标准

- 当天返回 3-7 张具体 mission card。
- 不出现分类汇总标题。
- 每张 card 至少 1 条证据和 1 个下一步动作。
- 高优先级 card 能解释“为什么今天出现”。
- 用户反馈不会丢失，并能影响之后的可见性或排序。
