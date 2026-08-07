# Findings

## Repo / Reminder

- `docs/progressing/to-verify.md` 为空，适合从 `docs/index.md` 抽样新目标。
- AppleScript 未列出 `Personal AI` Reminders；EventKit 找到 `Personal AI` 列表，4 条全部 completed，且都是 Doubao / digest / test 历史反馈，与会议历史归档无关。

## External Scan

- Teams Recap 把 recording、transcript、shared files、notes、summary、agenda、follow-up tasks 放在会后 recap 页，说明会议历史应同时呈现材料可用性和后续动作状态。
- Zoom AI Companion Meeting Summary 需要显式启动，并可选择保留 transcript；说明归档页必须区分已生成材料、生成中、失败和不可用链接。
- Otter action items 支持从行动项回到 transcript 依据；会议归档的 Panorama / PDF 打开路径应持续保留可复核材料，而不是把摘要当成最终事实。
- LLM-powered meeting recap 论文指出 highlights 和 hierarchical minutes 满足不同复盘需求，且 LLM recap 会遗漏细节、误归因；失败态和只读边界应保持显性。

## UX Gap

- `archiveLoadReceipt` 在读取失败时没有被清空或改成失败状态。因为模板在 error 区块之前渲染读取回执，用户可能看到上一轮“已读取 / 已刷新 / 已追加”的成功回执和当前失败提示并存。
- `loadMoreMeetings` 失败时只显示 inline error，不更新顶部读取回执，用户看不到“仍然只是旧页快照”的范围说明。
