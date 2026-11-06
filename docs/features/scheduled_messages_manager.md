# Personal Schedule 计划任务联动

更新：2026-11-06。旧版 Sheet/GAS 任务管理界面已移除，计划由独立 Personal Schedule 管理。用户自行维护原 Google Sheet 或手动迁移；扩展不迁移、不清理、不改写这些数据。

## 大白话运行逻辑

在 Options 的 Personal Schedule 区域填入服务地址和自己的 API Token，连接后可以打开新版网站。Glip 输入框的定时按钮把消息提交到这个服务；没配置就打开配置页，保存后继续提交。旧管理页链接直接跳转新版。

分享页上的扩展导入面板会显示将使用的接收方账号、默认勾选全部任务，也可取消部分。扩展只为已在设置中授权的网站使用自己的凭证；任务导入后是独立、未启用的副本，缺少的收件人、凭证和时区到新版补全。已有默认执行器由服务复用。重复导入需要再次明确确认，重复点击复用同一个请求。

Schedule 决定计划任务何时开始；Memory 保存 Outreach 会话、审批、回复判断、追问和执行记录。Memory 不再扫描旧模板发放初问。运行结果与发布正文分离，缺少执行器明确输出时不能把私有日志当作群消息发布。Memory 执行路径默认只发本人运行回执，群组产出只能由 Schedule 发布；若显式将通知归属交给 Schedule，Memory 不再通知。每次 occurrence 保存自己的 actionId 并读取精确 run 结果，不用任务级“最新结果”混淆重叠执行。消息模板是独立字段配置，由系统约定输出 publish_fields 对象，不要求用户在执行指令中添加格式或提供通知凭据。

## JIRA Automation

原 JIRA 页面保留托管入口，只有无需 JQL/issue 上下文的定时规则可转换成 webhook。先保存暂停草稿，再转换并绑定；在新版确认后启用。服务适配器目前支持已核验源码格式的 Server/Data Center，Cloud 明确拒绝。

分享者在扩展设置预览脱敏规则并授权导出；接收方选择自己的目标项目，核对字段和凭证依赖，创建禁用的 webhook 副本，得到新的 rule ID 和 token。绑定中断可续接，未知创建结果先核对残留规则，避免生成两份。副本先通过专用接口登记为待审查。用户在目标 JIRA 补齐并启用后，回扩展勾选审查确认并点“核验目标规则并完成绑定”；扩展只读核验该副本的启用状态及 webhook 触发器，补全完成后计划仍暂停，最后再到 Schedule 显式启用。核验不会执行或启用 JIRA 规则。

Schedule 已透传服务端再次净化的已授权规则 payload；仅有源 rule ID 的任务不能导入。JIRA 源规则在其他页面修改后，需源用户重新准备、审查导出。扩展已对齐新版状态接口、v1 presence 与创建幂等；HTTP 分享页也可生成持久请求 ID。真实 JIRA 创建与执行器发布仍需授权测试对象验收，不以本地受控 HTTP 响应替代。

## 关键代码和验证

`src/scheduleService.ts`：账户配置、API、Glip 创建与续提、防重、来源授权。`src/contentScriptSchedule.ts`：接收方导入面板。`src/scheduleJira.ts`：源侧导出与目标侧补全。`memory-service/src/routes/outreach.ts` 和 `agentTasks.ts`：外部 occurrence 与精确运行结果。

运行 `npm run verify:schedule-service`、开发构建，以及 `npm run verify:schedule-service:e2e`、`npm run verify:schedule-jira:e2e`。浏览器 E2E 默认连接相邻 personal-schedule 仓库的本地服务实现，不使用生产凭据，不启动 Runner，不产生真实消息。完整接口差异、线上限制与证据见 `docs/integrations/personal-schedule-contract.md`。
