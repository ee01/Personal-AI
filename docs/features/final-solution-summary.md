# Jira 302 规避最终方案

这份文档是 `jira-302-redirect-fix.md` 的简版总结。当前实现不是把所有 `releaseInfo` 放进每分钟执行请求，而是拆成两条 Jira Automation Rule。

## 当前架构

1. **Timeline Sync Rule**
   - 每天 05:00 运行。
   - 逐项目调用内网 release info API。
   - 逐项目用 POST JSON body 调用 Apps Script `cacheReleaseInfo`，把里程碑信息写入 Script Properties。
   - 每个缓存 webhook 都开启 `responseEnabled`，失败信息可在 Jira Audit Log 和扩展的 Timeline 缓存状态里看到；单个项目失败不阻断后续项目同步。

2. **Bot Executor Rule**
   - 每分钟运行。
   - 用 GET 调用 Apps Script `getBotMessageCurrentTime`。
   - Apps Script 从缓存读取 Timeline release info，匹配当前应该发送的一条 Bot/AI 消息。
   - 发送后用 POST JSON body 调用 `markBotMessageExecuted` 写回执行结果，并携带 `executionKey` 做幂等标记，避免 Jira/网络重试导致重复记账。

## 为什么这样做

- Google Apps Script `ContentService` 会把响应重定向到 `script.googleusercontent.com` 的一次性 URL；Jira Automation 对这类 POST 重定向支持不稳定。
- 每分钟执行请求保持短 GET，避开最频繁路径上的 POST body + redirect 组合风险。
- Timeline 数据按项目缓存，避免每分钟请求携带大对象；缓存和执行回写使用 JSON body，避免 Jira smart value 在 URL query 中把空格、`+`、`%`、换行和长文本解析坏。
- Apps Script 仍支持兼容 GET 入口，但正式 Rule 以 POST JSON body 为准，并通过 `responseEnabled` 暴露失败。
- Executor Rule 仍保留旧 inline `releaseInfo` 参数解析，主要用于兼容旧规则或手工调试。

## 用户路径

在 Scheduled Messages 页面配置 Bot 推送后，系统会同时创建 Executor Rule 和 Timeline Sync Rule。

首次配置后，Timeline 消息不会等到第二天才可用：页面会提示用户打开 Timeline Sync Rule 手动运行一次，让缓存立即生效。新增或编辑 Timeline 消息时，页面会读取 Apps Script 的缓存状态，并按所选项目展示可用 Milestone。

如果缓存状态尚未读取、读取失败、用户选择的项目没有出现在 Apps Script 返回的缓存状态中，缓存过期，或所选 Milestone 不在当前项目缓存内，页面会阻止保存并提示先刷新状态、手动运行 Sync Rule、更新脚本或重新配置 Sync Rule。

如果缓存状态接口返回 HTML、空响应或 Apps Script 错误对象，页面会显示面向排查的错误说明，避免用户只看到底层 JSON 解析错误。

时间触发的 Bot/AI 消息如果使用 `{currentRelease}`、`{nextPhase}` 等项目变量，也会复用同一套 Timeline 缓存状态面板和保存前校验，避免消息发送时变量无法替换。

Apps Script 会拒绝格式异常、未知项目、空 release info、超出单个 Script Properties value 限制的缓存写入，并返回可读错误，便于从 Jira Audit Log 排查。

## 验证重点

- `app-script-template.gs` 的 `TIMELINE_PROJECT_PARAM_MAP` 必须和 `timelineProjects.ts` 的项目清单一致。
- Timeline Sync Rule 的缓存 webhook 使用 POST JSON body 且 `responseEnabled=true`。
- `getTimelineCacheStatus` 只返回项目状态和 Milestone key，不暴露具体 release 日期。
- `markBotMessageExecuted` 使用 POST JSON body 且 `responseEnabled=true`，避免特殊字符导致执行状态写回失败时被静默吞掉。
- 同一个 `executionKey` 重复写回时应返回 `duplicate=true`，且不重复更新执行次数或日志。
- Timeline 消息保存前必须能成功读取缓存状态，避免配置完成但永远不触发。
- 时间触发项目变量消息也必须能成功读取所选项目的 Timeline 缓存，避免发送未替换占位符。
