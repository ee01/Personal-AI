# 解决方案对比：为什么升级为双 Jira Rule

## 当前结论

当前实现采用两条 Jira Automation Rule：

1. `Timeline Sync Rule`
   - 每天清晨执行一次
   - 按项目逐个调用内网 `get_release_info`
   - 再逐个调用 Apps Script `cacheReleaseInfo`
   - 将每个项目的 timeline 数据持久化到 Script Properties

2. `Scheduled Messages Executor Rule`
   - 每分钟执行一次
   - 只调用 `getBotMessageCurrentTime`
   - Apps Script 从缓存中读取 timeline 数据并匹配消息

这个方案替代了旧的“一步 GET”与“两批 GET cache”方案。

---

## 问题背景

定时消息的 timeline 数据位于公司内网：

- Google Apps Script 服务器不能直接访问内网
- Jira Automation 可以访问内网 `get_release_info`
- 因此必须由 Jira 先取到 timeline 数据，再把数据传给 Apps Script 做时间匹配

同时存在两个硬约束：

1. Google Apps Script Web App 对 `POST` 会返回 `302` 重定向
2. Jira Automation 对 `GET` 的 302 兼容较好，但对 `POST` 的 302 不可靠

所以主链路必须优先建立在 `GET` 之上。

---

## 方案对比

### 方案 0：Jira 直接 POST 到 Apps Script

```text
Jira -> POST getBotMessageCurrentTime
     -> Apps Script
     -> 302 Redirect
     -> Jira 无法稳定处理
```

结论：

- 失败方案
- Apps Script Web App 的 POST 302 行为决定了它不适合作为 Jira 的直接 POST 目标

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
- 不适合作为长期架构

---

### 方案 3：双 Jira Rule + 每项目单独 GET 缓存

```text
Rule A: Timeline Sync Rule (daily)
  Jira -> GET internal release info (per project)
      -> GET Apps Script cacheReleaseInfo (per project)

Rule B: Scheduled Messages Executor Rule (every minute)
  Jira -> GET Apps Script getBotMessageCurrentTime
      -> Apps Script 从缓存读取所有项目 releaseInfo
      -> 返回当前应触发的消息
```

优点：

- 全链路仍然是 GET，绕开 POST 302 限制
- 每次 `cacheReleaseInfo` 只传一个项目，不再依赖 batch 拆分
- `getBotMessageCurrentTime` 不携带大块 timeline 参数，URL 很短
- timeline 采集和消息执行解耦，规则职责清晰
- 新增项目只需要加项目配置，不需要重新估算 batch
- 单个 Script Properties value 也不会因为所有项目聚合而逼近 9 KB 限制

缺点：

- 需要两条 Jira Rule，而不是一条
- timeline 数据不是实时读取，而是按天同步
- 如果 Sync Rule 丢失，Timeline Bot/AI 消息会停止触发

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

- `Timeline Sync Rule` 每天清晨同步一次
- Apps Script 缓存允许 36 小时冗余窗口

这样做的目的：

- 避免偶发执行延迟导致当天全部 timeline 消息失效
- 在规则偶发晚跑或 Jira 有短暂抖动时，仍有足够容错空间

如果未来 timeline 更新频率升高，再把每日同步提升到每 6 小时或每小时即可，整体架构无需变化。

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
- 放弃 POST 到 Apps Script
- 放弃一步 GET 和手工 batch GET
- 采用“双 Jira Rule + 每项目单独 GET 缓存 + Executor 只读缓存”的结构

这是当前实现采用的正式方案。
