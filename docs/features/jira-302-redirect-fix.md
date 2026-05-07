# Jira Automation 302 重定向规避

## 背景

Google Apps Script `ContentService` 返回文本内容时，会把响应重定向到 `script.googleusercontent.com` 的一次性 URL。Jira Automation 的 Send web request 对第三方 POST 重定向仍有兼容风险，Atlassian 有对应跟踪项（AUTO-2123）。

Personal AI 当前采用“双 Rule + 缓存状态校验”的方案：每分钟执行请求保持短 GET；体积较大、容易被 URL 编码破坏的 Timeline 缓存和执行回写使用 POST JSON body，并开启响应捕获，让失败能在 Jira Audit Log 和扩展 UI 中被看到。

参考：
- Google Apps Script Content Service: https://developers.google.com/apps-script/guides/content#redirects
- Jira Automation Send web request: https://support.atlassian.com/cloud-automation/docs/jira-automation-actions/#Send-web-request
- Atlassian AUTO-2123: https://jira.atlassian.com/browse/AUTO-2123

## 当前架构

Personal AI 会创建两条 Jira Automation Rule：

1. **Bot Executor Rule**
   - 每分钟运行一次。
   - 使用 GET 调用 Apps Script：`action=getBotMessageCurrentTime`。
   - Apps Script 从缓存读取 Timeline release info，并返回当前需要发送的一条消息。
   - Jira Automation 根据返回内容调用 Bot API / AI endpoint / email，并用 POST JSON 调用 `markBotMessageExecuted` 写回执行状态。
   - `markBotMessageExecuted` 开启响应捕获，并携带 `executionKey` 做幂等写回，便于在 Audit Log 中发现 rowIndex、messageId 或 Apps Script 写回异常，同时避免重试重复增加执行次数。

2. **Timeline Sync Rule**
   - 默认每天 05:00 运行一次。
   - 逐项目从内网 release info API 获取项目里程碑。
   - 逐项目使用 POST JSON 调用 Apps Script：`action=cacheReleaseInfo`，body 中传 `project` 和 `releaseInfo`。
   - Apps Script 把每个项目的 release info 写入 Script Properties 缓存，供 Executor Rule 读取。
   - 每个项目的最近一次缓存写入尝试会额外记录一份安全诊断，只保留成功/失败、错误码、简短错误、payload 大小和 Milestone key，不保留 release 日期。

这个方案把“获取项目 release info”和“每分钟匹配消息”解耦，避免每分钟携带 release info，也保留了旧 GET inline `releaseInfo` 参数的兼容解析。

## 用户路径

在 Scheduled Messages 页面配置 Bot 推送后，系统会创建 Executor Rule 和 Timeline Sync Rule。Executor Rule 会立即按分钟生效；Timeline 消息需要先有 Timeline Sync 缓存。

首次配置或补齐 Timeline Sync Rule 后，可以：

1. 在 Jira Automation 中手动运行一次 Timeline Sync Rule，让缓存立即可用。
2. 或等待每天 05:00 的自动同步。

如果有 Active 的 Timeline Bot/AI 消息但缺少 Timeline Sync Rule，页面会显示修复入口，避免 Timeline 消息处于不可触发状态。

新增或编辑 Timeline 消息时，页面会读取当前 Timeline 缓存状态。项目缓存可用时，Milestone 下拉优先展示该项目缓存里真实存在的 Milestone；如果缓存状态尚未读到、读取失败、项目缺失、缓存过期或 Milestone 不存在，保存会被拦截并提示先刷新状态、手动运行 Sync Rule 或改选可用项，避免消息保存后一直不触发。

如果最近一次 Timeline Sync 写入失败，缓存状态面板会直接显示错误码和简短原因；若旧缓存仍可用，页面会提示当前仍在使用已有缓存。面板提供复制诊断入口，便于把当前项目、Milestone、最近同步尝试和 Rule 链接一起带到 Jira Audit Log 或排查对话里。

## 运行时保护

- GET 接口复用同一套消息匹配逻辑，保证普通时间消息和 Timeline 消息的行为一致。
- 没有 release info 缓存时，Timeline 消息会被跳过，普通时间消息仍可发送。
- Timeline 缓存按项目拆分，并带有过期时间，避免长期使用陈旧数据。
- 缓存状态接口只暴露项目可用性、Milestone key 和最近同步尝试摘要，不暴露实际 release 日期或 Script Properties 内部 key；前端会校验响应结构，旧版 App Script 会提示先升级，不会把异常响应当作有效缓存。
- Jira rule 模板会为缓存写入开启响应捕获，让 release info 为空、格式错误、未知项目等问题在 Jira Audit Log 和扩展缓存状态中显性暴露；失败不会中断后续项目同步。
- `markBotMessageExecuted` 接收 `rowIndex`、`messageId` 和 `executionKey`；`rowIndex` 可减少重复 ID 或查找歧义，但有 `messageId` 时会校验行 ID，不匹配则按 `messageId` 重新定位，避免 Sheet 排序、插行或延迟回调误标记其他消息；`executionKey` 会先于 Sheet 行定位做幂等短路，防止同一次 Jira 回调被网络或平台重试后重复记账。
- Bot Executor Rule v1.3.7 起会把 Bot API `Authorization` header 标记为 Jira Automation hidden value；扩展创建规则时的诊断日志也会脱敏 token，避免排查 302/回调问题时把 Bot 凭证暴露在浏览器控制台或导出的日志里。

## 验证重点

- App Script 版本已更新，部署后 `action=getVersion` 返回最新版本。
- Timeline Sync Rule 的缓存 webhook 使用 POST JSON body，且 `responseEnabled=true`。
- 缓存 webhook 不使用阻断式 condition，避免单个项目失败后停止同步后续项目；失败项目通过响应日志、最近同步尝试诊断和缓存状态面板排查。
- Executor Rule 的 `getBotMessageCurrentTime` 使用 GET；`markBotMessageExecuted` 使用 POST JSON body，且 `responseEnabled=true`。
- 消息 ID、内容包含 `%`、空格、换行等字符时，执行标记不会因 URL 参数编码/解码失败而阻塞。
- Jira 回调里的 `rowIndex` 指向 header、越界或已被排序到其他消息时，`markBotMessageExecuted` 应按 `messageId` 兜底定位，不能更新错误行。
- 同一个 `executionKey` 重复调用 `markBotMessageExecuted` 时，即使原消息行后续被移动或删除，也应返回 `duplicate=true`，且不重复更新 `Exec_Count` 或 Logs。
- Timeline 消息保存前必须能成功读取缓存状态；读取失败时不允许静默保存。
- 旧版 App Script 返回未知 action 或非缓存状态结构时，前端必须显示升级/修复提示，而不是继续渲染或允许保存。
- 缓存状态面板的复制诊断文本应包含选中项目、缓存状态、最近同步失败原因、选中 Milestone 和 Timeline Sync Rule 链接。
- 创建或升级 Jira Rule 后，浏览器控制台日志不能包含 Bot token 明文；Jira Rule 模板中的 Bot API Authorization header 应保持 `secret=true`。
