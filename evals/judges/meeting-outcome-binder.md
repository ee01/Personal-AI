# Meeting Outcome Binder Deterministic Rubric

本 rubric 使用 0 或 100 的确定性分数，不调用 LLM judge。

- `preview_contract`: candidate slots 是否完整进入会前 binder，并保持 `planned / not_seen`。
- `status_guard`: binder 总状态、slot 状态与 mention state 是否满足证据强度规则。
- `evidence_grounding`: 结果是否只引用存在且与目标匹配的会议证据，摘要是否没有保留被守卫推翻的模型结论。
- `persistence`: 结果能否通过 `meetingId` 重读，slot 内容是否与刚绑定的结果一致。
- `ask_read_boundary`: Ask 是否只命中相关 binder，并带出只读、不写回 Calendar/Jira/RingCentral 的边界。

任一 proof check 失败，对应维度为 0，case 判定为 fail；全部通过时 case 判定为 pass。
