# 解决方案对比：为什么升级为双 Jira Rule

*最后更新: 2026-05-03*

## 当前结论

当前实现采用两条 Jira Automation Rule：

1. `Timeline Sync Rule`
   - 每天 05:00 执行一次
   - 按项目逐个调用内网 `get_release_info`
   - 再通过 POST JSON 逐个调用 Apps Script `cacheReleaseInfo`
   - 将每个项目的 timeline 数据持久化到 Script Properties
   - 每个缓存写入 webhook 都启用 response capture，方便在 Jira audit log 中确认单项目写入结果；同步规则不在单项目后接阻断式 condition，避免一个项目失败导致后续项目全部跳过

2. `Scheduled Messages Executor Rule`
   - 每分钟执行一次
   - 只调用 `getBotMessageCurrentTime`
   - Apps Script 从缓存中读取 timeline 数据并匹配消息

这个方案替代了旧的“一步 GET”和“两批 GET cache”方案。

Apps Script 端仍保留 GET inline releaseInfo 参数解析能力，主要用于兼容旧版 Jira Rule 或手工调试；正常链路应优先读取 Timeline Sync Rule 用 POST JSON 写入的缓存。

---

## 问题背景

定时消息的 timeline 数据位于公司内网：

- Google Apps Script 服务器不能直接访问内网
- Jira Automation 可以访问内网 `get_release_info`
- 因此必须由 Jira 先取到 timeline 数据，再把数据传给 Apps Script 做时间匹配

同时存在三个硬约束：

1. Google Apps Script ContentService 的响应会重定向到一次性 URL，调用方必须能跟随重定向
2. 直接把所有项目 `releaseInfo` 放进一个 GET URL 会遇到长度和编码风险
3. Jira Automation 的 `urlEncode` 会把空格编码成 `+`，复杂 Groovy Map 放在 query string 中容易出现跨解析器歧义

所以当前主链路采用“缓存写入 POST JSON + 执行器短 GET 读缓存”的组合：复杂 payload 不进入 URL，执行器的高频请求仍保持短 URL。

---

## 方案对比

### 方案 0：Jira 每分钟直接 POST 所有 releaseInfo 到 Apps Script

```text
Jira -> POST getBotMessageCurrentTime
     -> body 中包含所有项目 releaseInfo
     -> Apps Script
```

结论：

- 不采用
- 每分钟携带所有项目 releaseInfo 会让执行规则既大又难排障
- 执行器不需要复杂 payload；让它读缓存更清晰

---

### 方案 1：一步 GET，直接把所有 releaseInfo 塞进 URL

```text
Jira -> GET getBotMessageCurrentTime
     -> URL 中包含所有项目 releaseInfo
     -> Apps Script 直接匹配
```

优点：

- 只需一次请求
- 无缓存
- 实时数据

缺点：

- URL 长度会随项目数量线性增长
- 7 个项目时实测完整 URL 已超过 Apps Script 可接受范围
- 一旦 releaseInfo 字段继续增加，风险会进一步放大

结论：

- 3 个项目时代可以工作
- 扩展到 Nova / RIO / NC / Rooms 后不再可持续

---

### 方案 2：单条 Rule 内做两批 GET cache

```text
Jira Rule 同一次执行中:
  batch 1 cache -> batch 2 cache -> executor
```

优点：

- 仍然全部使用 GET
- 能绕开单条 URL 过长问题

缺点：

- 仍然依赖手工分组
- 新增项目时必须重新测长度、重新切 batch
- 规则职责混在一起，可维护性差
- 本质上只是把 URL 问题推迟，而不是消除

结论：

- 过渡方案
- 不适合作为长期架构；后续已被 POST JSON cache 写入替代

---

### 方案 3：双 Jira Rule + 每项目单独 POST JSON 缓存

```text
Rule A: Timeline Sync Rule (daily)
  Jira -> GET internal release info (per project)
      -> POST Apps Script cacheReleaseInfo (per project JSON body)

Rule B: Scheduled Messages Executor Rule (every minute)
  Jira -> GET Apps Script getBotMessageCurrentTime
      -> Apps Script 从缓存读取所有项目 releaseInfo
      -> 返回当前应触发的消息
```

优点：

- 每次 `cacheReleaseInfo` 只传一个项目，不再依赖 batch 拆分
- `releaseInfo` 走 JSON body，不再把 Groovy Map、空格、`+` 和百分号放进 URL query
- `getBotMessageCurrentTime` 不携带大块 timeline 参数，URL 很短
- timeline 采集和消息执行解耦，规则职责清晰
- 新增项目只需要加项目配置，不需要重新估算 batch
- 单个 Script Properties value 也不会因为所有项目聚合而逼近 9 KB 限制

缺点：

- 需要两条 Jira Rule，而不是一条
- timeline 数据不是实时读取，而是按天同步
- 如果 Sync Rule 丢失，Timeline Bot/AI 消息会停止触发
- 如果单个项目写入失败，需要从 Jira audit log 或 Apps Script 日志定位对应项目
- 单项目写入失败不应阻断后续项目同步，否则部分项目的偶发异常会扩散成整条规则不可用

结论：

- 当前推荐方案
- 在现有 Apps Script + Jira Automation 边界下最稳妥、最可扩展

---

## 为什么不是“一条共享 Sync Rule”

当前架构中，每个用户都有自己独立的：

- Google Sheet
- Apps Script 项目
- Web App URL
- Script Properties 存储空间

因此 timeline 缓存天然是“按用户隔离”的，不能靠一个用户的 Apps Script 缓存供所有人共享。

这意味着：

- 每个用户都必须拥有自己的 `Timeline Sync Rule`
- 配置有效性检查也必须分别检查 `executorRule` 和 `timelineSyncRule`

---

## 为什么 Sync Rule 可以每天执行一次

timeline 数据更新频率不高，按天同步可以接受。

当前设计采用：

- `Timeline Sync Rule` 每天 05:00 同步一次
- Apps Script 缓存允许 36 小时冗余窗口

这样做的目的：

- 避免偶发执行延迟导致当天全部 timeline 消息失效
- 在规则偶发晚跑或 Jira 有短暂抖动时，仍有足够容错空间

如果未来 timeline 更新频率升高，再把每日同步提升到每 6 小时或每小时即可，整体架构无需变化。

---

## 当前实现核对

关键实现位置：

- `src/scheduled-messages/jira-timeline-sync-rule-template.json`
  - 定义每天 05:00 的 Timeline Sync Rule
  - 动态插入每个项目的 releaseInfo 读取与缓存写入步骤

- `src/scheduled-messages/timelineProjects.ts`
  - 维护项目列表、内网 releaseInfo 变量名和 `cacheReleaseInfo` webhook
  - 缓存写入 webhook 使用 POST JSON body，并启用 response capture，便于在 Jira audit log 中查看单项目结果
  - 不生成 top-level success condition；Atlassian Automation 的普通 condition 失败会停止后续 action，不适合作为每项目缓存写入后的线性断言

- `src/scheduled-messages/app-script-template.gs`
  - `cacheReleaseInfo` 按项目写入 Script Properties
  - `cacheReleaseInfo` 同时保留旧 GET query 和新 POST JSON body 入口
  - 缺少 project、未知 project、空 releaseInfo 或解析失败时返回 `success: false`，避免静默成功
  - `getTimelineCacheStatus` 只返回每个项目缓存是否就绪、过期、缺失或格式异常，不返回具体 release 日期
  - `getBotMessageCurrentTime` 优先读缓存，找不到缓存时跳过 Timeline 消息，但普通时间消息仍可执行

- `src/scheduled-messages/ScheduledMessagesManager.tsx`
  - 老用户缺少 Timeline Sync Rule 时显示补齐入口
  - Timeline 触发创建表单会在缺少执行 rule 或 sync rule 时阻止提交
  - Timeline 触发表单会显示当前项目缓存状态，并支持手动刷新
  - Timeline 偏移天数在提交时校验为 -30 到 30 的整数，避免空输入或中间态输入被保存成无效值
  - 普通 Bot/AI 时间触发消息如果使用 `{currentRelease}` 等项目变量，也会保存所选项目，确保执行器能用缓存替换变量
  - 首次配置后提示用户可手动运行 Sync Rule 或等待下一次 05:00 同步

---

## 本轮可靠性改进

结合 Zapier / n8n / Temporal 等自动化产品的共性做法，最值得补强的不是把当前架构改成新服务，而是先提升失败可见性：

- 自动化平台通常会提供错误分支、失败执行记录、重试或持久化状态；本功能的薄弱点是每个项目的缓存写入以前不够可见，且线性阻断会放大单点失败。
- Timeline Sync Rule 现在捕获 `cacheReleaseInfo` 响应，Jira audit log 可以看到每个项目的写入结果。
- `cacheReleaseInfo` 写入使用 POST JSON body，避免复杂 `releaseInfo` 在 URL query 中被长度限制或 `+`/空格解析差异破坏；旧 GET 入口保留为兼容路径。
- Timeline Sync Rule 不再用普通 condition 检查每个项目的 `success` 字段，因为 condition 失败会停止后续 action；当前策略是继续同步其他项目，再通过 UI 缓存状态和 audit log 暴露失败项目。
- Apps Script 缓存端点现在对无效输入返回结构化失败结果，而不是在没有写入缓存时仍返回 `success: true`。
- UI 文案明确“补齐 Sync Rule”与“每日 05:00 同步”的关系，减少用户误以为补齐后马上可触发 Timeline 消息。
- UI 现在可直接读取 Timeline 缓存诊断状态。用户创建 Timeline 消息时能看到所选项目是否已经同步、是否过期，以及需要手动运行 Sync Rule 还是等待每日同步。

---

## UI 升级策略

老用户只配置过旧版执行 rule 时，系统按以下逻辑处理：

- 如果没有激活的 Timeline Bot/AI 消息：
  - 不显示全局失效警告
  - 普通 Bot/AI 消息仍可工作

- 如果存在激活的 Timeline Bot/AI 消息：
  - 显示 warning banner
  - 提示缺少 `Timeline Sync Rule`
  - 点击后进入“补齐模式”，只创建缺失的 sync rule

新用户初始化时则一次创建两条 rule。

---

## 长期演进方向

如果未来想做到“全员只采一次 timeline 数据，再共享给所有用户”，不应继续压在 Apps Script 或 memory-service 上硬改。

更合理的方向是引入独立的公网 timeline-cache service：

- 接收 Jira 或定时任务提交的数据
- 统一存储所有项目 timeline
- Apps Script 或执行 rule 再去读取该服务

但在当前代码库和部署方式下，这会引入新的服务边界和运维成本，不适合作为这轮改造的前提。

---

## 最终结论

在当前约束下，最佳方案是：

- 保留 Jira 访问内网的能力
- 放弃每分钟携带所有 releaseInfo 的直接调用
- 放弃一步 GET 和手工 batch GET
- 采用“双 Jira Rule + 每项目单独 POST JSON 缓存 + Executor 短 GET 只读缓存”的结构

这是当前实现采用的正式方案。
