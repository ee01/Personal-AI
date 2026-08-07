# 会议历史归档读取失败回执

## 目标

随机功能：`会议历史归档`（Meeting Pilot）。

修复一个用户信任问题：会议归档读取失败时，页面不能继续展示上一轮成功读取回执，让用户误以为当前刷新、筛选或加载更早会议已经成功。

## 计划

1. 在 `MeetingHistoryPage.vue` 增加失败态读取回执，覆盖初始读取、刷新、筛选、清除筛选和加载更早会议失败。
2. 失败回执要说明当前筛选范围、本次没有更新的事实、仍显示的已加载快照或空状态，以及不会重跑会议分析、生成 PDF、发送纪要、写入 Memory Service 或修改行动项。
3. 扩展 `desktop-app/scripts/meeting-pilot-history-check.mjs`，模拟加载更早会议失败并断言失败回执不会伪装成成功追加。
4. 更新 `docs/features/meeting_pilot.md` 和 `docs/index.md` 的当前行为描述。
5. 运行 targeted verifier、首次 dev compile、E2E 和 scoped whitespace 检查。

## 边界

- 不改会议归档 API、状态筛选算法、PDF 安全判断、Panorama 参数、Memory Service 写入、Minutes API 轮询或 Reminder。
- 只改会议历史页失败态呈现、测试断言和文档。
