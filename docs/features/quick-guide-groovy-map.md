# 快速指南：Jira Groovy Map 兼容

## 当前实现

Jira Timeline 同步现在走“双 Rule + POST JSON 缓存”：

1. `Timeline Sync Rule` 每天 05:00 按项目读取内网 release info。
2. 每个项目用 `POST {{WEB_APP_URL}}?action=cacheReleaseInfo` 写入 Apps Script，`Content-Type: application/json`，body 形如：

```json
{
  "project": "mThor",
  "releaseInfo": {{mThorReleaseInfo.asJsonString}}
}
```

3. `Scheduled Messages Executor Rule` 每分钟只调用短 GET，Apps Script 从缓存读取 Timeline 数据。

Apps Script 会优先解析标准 JSON；如果 Jira 返回 `{key=value}` 这类 Groovy/Java Map 字符串，再走 bounded fallback parser。缓存写入前会做 schema 校验、长度限制、嵌套限制和 Script Properties 9KB 预检。

当前生成的 Timeline Sync Rule 不再把 `releaseInfo` 放在 URL query 里；旧的 GET/query 写入链路仍保留为兼容入口。

缓存会保留完整项目对象，因此 Timeline 消息里的 `{currentRelease}`、`{currentPhase}`、`{nextPhase}` 等项目变量和 Milestone 日期可以同时从同一份 releaseInfo 中读取。旧的扁平 inline 参数仍兼容。

## Milestone 可用性

`releaseInfo.releaseInfo` 中只有值为 `MM/DD/YYYY` 的 milestone 会暴露给扩展 UI。空日期、ISO 日期、非法日期或非字符串值不会出现在可选 milestone 中；如果一个项目没有任何有效日期，`cacheReleaseInfo` 会返回 `INVALID_RELEASE_INFO_SCHEMA`，不会写入可触发缓存。

这样可以避免用户在界面选择了看似存在但实际不会触发的 milestone。

旧 inline 参数链路仍然兼容：Apps Script 通过 `extractReleaseInfoFromParameters()` 统一读取 inline 参数，再交给 `parseJiraJson()` 兼容 Groovy Map 和标准 JSON。

## 用户排障路径

- App Script 部署版本应不低于 `2.7.9`。
- 修改 Jira Rule 后，先手动运行 `Timeline Sync Rule`。
- 回到扩展的定时消息表单，点击“刷新状态”。
- 如果仍失败，先看 Timeline 缓存状态面板里的“下一步”，必要时复制当前项目的 JSON 模板修复 Jira `Send web request`，再复制 Timeline 缓存诊断，对照 Jira Automation Audit Log 中的 `cacheReleaseInfo` 响应。

每次 `cacheReleaseInfo` 响应和 Timeline 缓存状态的最近同步记录都会带 `requestId`。排障时可以用它把扩展里的“复制诊断”和 Jira Automation Audit Log 中的具体一次请求对应起来。状态面板也会按错误码给更具体的下一步，例如缺少 `releaseInfo`、Milestone 日期格式不对、payload 太大或 Groovy 嵌套过深。

状态面板里的 JSON 模板会按当前项目生成正确的 `project` 参数、`{{xxxReleaseInfo.asJsonString}}` 变量和 `Content-Type: application/json`，避免用户在 Jira Rule 中手动猜项目参数名。

状态面板也提供 dry-run 测试 curl：请求会用 `dryRun=true` 走同一套 `cacheReleaseInfo` 解析、schema 校验和 9KB 预检，但不会写入 Timeline 缓存，也不会覆盖最近一次 Jira 同步诊断。它用于区分“Apps Script Web App 部署/权限问题”和“Jira Rule payload 问题”。

常见错误：

| 错误码 | 含义 | 处理 |
| --- | --- | --- |
| `INVALID_POST_JSON` | POST body 不是合法 JSON | 检查 Custom data、`Content-Type: application/json`、动态文本是否用了 `.asJsonString` |
| `PARSE_RELEASE_INFO_FAILED` | JSON/Groovy Map 都无法解析 | 检查括号、引号、逗号和等号；复杂文本值要加引号 |
| `INVALID_RELEASE_INFO_SCHEMA` | 没有可用的 `releaseInfo` milestone 日期 | 确认至少一个 milestone 值是 `MM/DD/YYYY` |
| `TIMELINE_CACHE_TOO_LARGE` | 单项目缓存超过 Apps Script 单属性 9KB | 减少同步字段或改用外部缓存 |

## 限制

- 无引号字符串里包含逗号时，Groovy Map 无法可靠区分文本逗号和字段分隔符；优先让 Jira 输出标准 JSON。
- 兜底解析最多处理 12,000 字符、12 层嵌套。
- Script Properties 单 value 只有 9KB，不能承载过大的项目 timeline。

## 验证

相关测试：

```bash
TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test \
  src/scheduled-messages/__tests__/timelineProjects.test.ts \
  src/scheduled-messages/__tests__/timelineSyncRule.test.ts \
  src/scheduled-messages/__tests__/timelineCacheStatus.test.ts \
  src/scheduled-messages/__tests__/timelineMilestones.test.ts
```

```bash
npm run verify:scheduled-messages-timeline-cache
```

参考资料：

- [Atlassian JSON smart values](https://support.atlassian.com/jira-software-cloud/docs/smart-values-json-functions/)
- [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
- [n8n Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)
- [Make webhooks](https://help.make.com/webhooks)
