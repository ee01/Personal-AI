# Jira Webhook 参数编码修复

## 功能现状

Jira Automation 的 `urlEncode` 会按 `application/x-www-form-urlencoded` 习惯把空格编码成 `+`。Personal AI 的 Scheduled Messages 需要把 Bot 执行结果、Timeline `releaseInfo` 等参数传给 Apps Script，因此要避免 `+`、空格、百分号和长文本在不同解析器里产生歧义。

当前实现采用“新规则走 JSON POST + 旧 GET 兼容不二次解码”的策略：

- Timeline Sync Rule 的 `cacheReleaseInfo` 默认用 POST JSON body 传 `project` 和 `releaseInfo`。
- Bot 发送后的 `markBotMessageExecuted` 默认用 POST JSON body 传 `messageId`、`rowIndex`、替换后的 `topic/content`。
- 自动生成的 App Script POST webhook 会显式声明 `Content-Type: application/json`，让 Jira Audit Log 和中间代理都能按 JSON 请求理解。
- 旧 GET 调用仍支持 Jira Automation URL 使用 `.urlEncode.replaceAll("\\+","%20")`，让空格明确编码为 `%20`。
- literal `+` 在旧 GET 中仍由 Jira `urlEncode` 编码为 `%2B`，不会被误改成空格；在新 POST JSON 中直接作为字符串内容传输。
- Apps Script 使用 `e.parameter` 已解析后的值，不再额外 `decodeURIComponent`，避免 `100% done`、`%2F` 等原文被二次解码破坏。
- Apps Script `doPost` 会解析 `e.postData.contents`，再复用同一套缓存与执行完成逻辑。
- 如果 POST 被误配成 `application/x-www-form-urlencoded`，Apps Script 会跳过 JSON.parse，直接使用已经解码好的 `e.parameter` 作为兼容兜底；正文看起来是 JSON 或 Content-Type 是 JSON 时，非法 JSON 仍会返回 `INVALID_POST_JSON` 诊断。

## 影响范围

- Timeline Sync Rule 的 `cacheReleaseInfo` webhook。
- Bot/AI 执行后写回 Apps Script 的 `markBotMessageExecuted` webhook。
- Apps Script 的 Groovy Map 解析仍由 `parseJiraJson` 负责；它处理的是已经解码后的字符串。

## 用户体验

Timeline 消息创建页会读取 Apps Script 的 Timeline 缓存状态。缓存缺失、过期、格式异常时会给出不同提示：

- 缺失：先运行 Timeline Sync Rule。
- 过期：手动运行一次或等待每日 05:00 自动同步。
- 格式异常/读取失败：升级或修复 Timeline Sync Rule 后重新同步。

如果已有 Timeline Sync Rule，状态面板会提供打开规则的入口，方便用户直接去 Jira Automation 手动运行同步。这样用户看到 Timeline 触发不可用时，不需要猜测是没同步、缓存过期，还是旧规则编码导致数据格式异常。

如果 POST body 被 Jira smart value 拼成了非法 JSON，Apps Script 会在响应中返回 `INVALID_POST_JSON`、当前 action、body 长度、content type、`asJsonString` 修复建议和 `releaseInfo` 兜底格式。用户可以直接在 Jira Automation Audit Log 里定位到 Custom data、`.asJsonString` 或 header 配置问题，而不是只看到泛化的脚本异常。

Timeline 缓存状态面板在缓存缺失、过期、异常或读取失败时，会提示用户打开 Timeline Sync Rule；用户在 Jira 里手动运行或修复规则后，需要回到扩展点击“刷新状态”确认缓存已经生效。

## 外部参考

- [Atlassian 官方 KB](https://support.atlassian.com/automation/kb/url-encode-jira-smart-values-using-20-instead-of-character/) 说明 Jira Automation `urlEncode` 会把空格编码成 `+`，并建议用 `replaceAll("\\+","%20")` 规避路径或 API 解析差异。
- Atlassian 的 JSON smart values 文档建议在 outgoing web request 中使用 `asJsonString` 这类 JSON 函数处理动态文本，避免引号、换行、逗号等破坏 JSON。
- [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) 明确 `%20` 是空格的 percent-encoding，并提醒不要对同一字符串重复编码或解码。
- [WHATWG URL Standard](https://url.spec.whatwg.org/) 说明 `URLSearchParams` / `application/x-www-form-urlencoded` 会把空格序列化为 `+`，这也是跨系统接入时需要消歧的根因。
- Google Apps Script Web Apps 支持 `doPost(e)`，POST body 可通过 `e.postData.contents` 读取，因此复杂 payload 不必放在 query string。
- n8n、Make 等自动化平台都把 webhook 的 raw body、JSON/urlencoded/text 类型和响应诊断作为一等能力；Personal AI 的 webhook 响应也应返回可操作的错误对象。
- URL parser cross-testing 相关论文和 Claroty/Snyk 的 URL parsing confusion 研究都指出：不同 URL parser 对编码数据的解释不完全一致。跨系统 webhook 应减少 URL query 中的复杂结构，把结构化数据放进单一 JSON payload。

## 验证要点

- 规则生成测试确认新 `cacheReleaseInfo` 和 `markBotMessageExecuted` webhook 使用 POST JSON body、显式 JSON header，不再把 `releaseInfo`、`topic`、`content` 放进 URL query。
- 旧 GET 编码 helper 测试确认 `%20` 空格编码规避写法仍保留。
- Apps Script 测试确认 form-urlencoded 解码后的 Groovy Map 可以解析空格字段，如 `Product DF`。
- Apps Script 测试确认 POST JSON body 可以传递空格和 literal `+`。
- Apps Script 测试确认 form-urlencoded POST 参数不会被误判为非法 JSON。
- Apps Script 测试确认非法 POST JSON 会返回 `INVALID_POST_JSON`、`.asJsonString` 指引和 releaseInfo 兜底格式，方便在 Jira Audit Log 中直接定位修复点。
- Apps Script 测试确认 literal `+` 仍能保留为 `A+B`。
- Timeline 缓存状态异常时，页面可以直接打开对应 Timeline Sync Rule。
