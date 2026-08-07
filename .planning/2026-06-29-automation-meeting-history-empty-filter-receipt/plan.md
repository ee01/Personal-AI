# 会议历史归档空筛选回执计划

创建时间：2026-06-29T05:03:52+08:00

## 目标

本轮从 `docs/index.md` 随机抽中 `会议历史归档`。近期自动化已覆盖 ASR、Today Pilot、Reflection、Coverage、User Profile、通知和 Decision Center 等方向；本轮聚焦 Meeting Pilot 历史归档页的筛选路径。

## 外部参考

- Zoom AI Companion、Microsoft Teams Intelligent recap、RingCentral AI notes、Otter 和 Granola 都把会后摘要、transcript、action items、分享/后续动作拆开呈现。
- LLM meeting recap 论文强调 highlights 与结构化 minutes 服务不同复盘需求，且摘要和行动项可能漏上下文或错归因。
- MeetingBank、QMSum 和 action item detection 相关研究说明会议归档检索需要覆盖 transcript、结构化字段和会议材料，空结果要能解释范围。

## 问题

会议历史归档已经支持服务端关键词/状态筛选和读取回执，但筛选成功返回 0 条时，页面只显示普通空卡片。真实用户会难以判断这是读取失败、历史丢失、只筛了第一页，还是当前条件确实没有匹配。

## 实施步骤

1. 在 `MeetingHistoryPage.vue` 的空筛选状态加入 `空结果回执`，说明：
   - 服务端已按当前关键词/状态读取并返回 0 条；
   - 关键词覆盖标题、摘要、参会者、会议 ID、错误码、归档转写/观察文本；
   - 这不是读取失败或历史被删除；
   - 本次操作没有重跑分析、生成 PDF、写入 Memory Service、发送纪要或修改行动项；
   - 用户可清除筛选、放宽关键词或切换状态恢复。
2. 更新 `docs/features/meeting_pilot.md` 的会议历史归档说明。
3. 扩展 `test:meeting-pilot-history`，覆盖空筛选回执。
4. 验证：targeted history E2E、`npm start` 首次成功编译、`npm run verify:i18n`、scoped `git diff --check`。
