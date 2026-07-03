# Dream Digest notification deep link plan

## 目标功能

- 随机抽中：`Notification Center` / `周报与梦境摘要推送`
- 本轮聚焦：Dream Digest 通知点击后直接定位本期相关 dream 文件，而不是只进入 `/dreams` 总页。

## 外部参考信号

- Microsoft Viva Digest 把 digest 作为可进入具体个人洞察的入口，而不是只有“有摘要”的空提醒。
- Apple Scheduled Summary 强调低打扰批量通知，但用户仍需要在指定时间看到可判断价值的内容。
- 通知 batching / bounded deferral 研究支持减少打断，但摘要延迟不能破坏 awareness：通知应保留足够上下文和可达的落点。

## 改进计划

1. 服务端 Dream Digest payload 写入本期 dream 文件列表和主文件。
2. Chrome 后台通知点击把 `dream_digest` 路由到 `#/dreams?file=...`，并防御非法路径。
3. `DreamInsights.vue` 读取 `file` query，主动加载并展开目标文件，即使它不在默认最近 10 个文件里。
4. 补充 heartbeat payload 单测、backend notification 路由单测、梦境页 E2E。
5. 更新 `docs/features/notification_center.md`，记录周报和 Dream Digest 的不同深链落点。

## Reminder

本机 Reminders 可访问，但没有名为 `Personal AI` 的列表；本轮无 Reminder 来源事项可合并或完成。
