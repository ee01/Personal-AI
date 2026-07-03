# Scheduled Messages：通道激活与初始化引导 Plan（v2）

> 生成日期：2026-06-10 CST（v2 同日更新）
> 背景：AsMe 的 AppScript email 网关（`*@reply.ringcentral.glip.com`）已被封禁
> 交付物：方案 Plan + 初始化最后一步交互 Demo（先不编码）
> Demo：[`scheduled-messages-channel-activation-demo.html`](./scheduled-messages-channel-activation-demo.html)
>
> **v2 变更**：
> 1. AsMe 改为 **AppScript 直调 RingCentral API**（基于已有的 `app-script-glip_sender.gs`），不再经由 Jira rule → Dify——AsMe 成为与 Jira 主通道**相互独立**的通道；
> 2. **废弃**「共享 Bot 账号 token 发 welcome」方案：memory-service 在公司内网，AppScript（Google 云）无法访问；若改由客户端直调后端接口生成 welcome，又达不到冒烟测试目的；
> 3. Welcome 确定为「通道自检探针」：Bot 通道激活 → Bot 私信探针；AsMe 通道激活 → AsMe 自检消息（发给自己）。

## 结论

1. **现状**：email 封禁后，未配置 Jira executor rule 且未配置 RC token 的用户，初始化走完 **6 类消息全部不可发送**，且自动投放的 AsMe welcome **静默失败但日志记成功**。
2. **方案**：初始化向导追加「最后一步：激活发送通道」——两个可勾选能力项（Jira admin 默认勾选 / RingCentral token 默认不勾），勾选展开配置板块；都不勾时主按钮变为「跳过配置」。
3. **AsMe 直发改造**：`app-script-glip_sender.gs` 已实现完整直发链路（JWT 换 token + 缓存、目录解析、建 DM、发帖、附件、@mention），集成后 **RC token 单独勾选即可解锁 AsMe（1/6）**，无需 Jira；Jira 主通道解锁 4/6；双通道 5/6。
4. **Welcome / 冒烟**：每个激活的通道各发一条自检消息（下一分钟执行，结果回写 Logs），UI 轮询 Logs 亮绿；RC 配置时另做同步 Token 测试（秒级反馈）。

---

## 一、现状确认（问题证据）

### 1.1 执行链路全景（改造前）

| 消息类型 | 执行引擎 | 前置条件 | 无任何配置时 |
|---|---|---|---|
| AsMe（默认值） | AppScript email 网关 | 无（曾经） | ❌ 网关已封，**静默失败** |
| AsMe + RC sender | Jira executor → Dify → RC API | executor rule **且** RC token | ❌ |
| Bot 消息 | Jira executor rule | Jira project admin | ❌ UI 拦截创建 |
| AI Report | Jira executor rule | 同上 | ❌ |
| 托管 JiraAutomation（带 AI_Endpoint） | Jira executor rule | 同上 | ❌ |
| 个人提醒（reminder 模式） | Bot 私信 | 同上 | ❌ |
| Outreach | memory-service `ringClient` | 后端 RC 配置 + 启用 | ❌ |

### 1.2 关键代码证据

- `src/scheduled-messages/executionRoute.ts:45-49`：AsMe 无 RC sender 时路由到 "AppScript · Mail fallback" 且 `state: 'ready'`——封禁后判定失真，用户仍能创建注定失败的消息。
- `src/scheduled-messages/app-script-template.gs:658-719`（`sendEmailToGlip`）：`MailApp.sendEmail` 本身成功 → `Exec_Log` 记成功，但 Glip 网关不再投递，**收不到且无报错**。
- `src/scheduled-messages/app-script-template.gs:297-306`（`isRingCentralSenderReady`）：现要求 `executorRuleId`——改造前 RC token 是 Jira rule 的叠加项而非替代。**v2 改造后此依赖取消**。
- `src/scheduled-messages/SheetInitializer.ts:483-538`（`addSampleData`）：welcome 样例 `Push_Method='AsMe'` + `Active` + 一分钟后执行 → 命中静默失败路径。
- `src/scheduled-messages/setupReceipt.ts:130`：收据承诺"一分钟后可检查测试推送"——不会兑现。
- `src/scheduled-messages/ScheduledMessagesManager.tsx:3688`：状态栏只有"已初始化"，与实际可用性（0/6）错位。

### 1.3 体验问题归纳

1. **虚假完成感**：初始化报成功 + welcome 承诺 → 实际 0 类可发。
2. **静默失败陷阱**：AsMe 路由仍判 `ready`，创建放行、日志记成功、消息永不到达。
3. **最坏时机的墙**：lazy 配置让用户在"想发第一条消息"时才发现需要 Jira admin（可能要申请数天）。

---

## 二、AsMe 直发改造（v2 核心变更）

### 2.1 可行性结论：可行，且大部分已实现

`platform.ringcentral.com` 是公网 SaaS，AppScript 的 `UrlFetchApp` 可直接访问（这与 memory-service / Dify 在内网、AppScript 够不着，形成对照——也是放弃共享 Bot 方案、放弃 Jira→Dify 链路的同一个原因的两面）。

`src/scheduled-messages/app-script-glip_sender.gs` 已实现：

| 能力 | 实现 | 备注 |
|---|---|---|
| JWT 换 access token | `_getRingCentralAccessToken_`：`POST /restapi/oauth/token`（jwt-bearer grant，Basic clientId:secret） | `CacheService` 缓存（expires_in − 120s），避免 token 端点限频 |
| 收件人解析 | `_resolveGlipTarget_`：纯数字 → 直接当 chatId；`first.last` → 目录查询 → personId → `POST /team-messaging/v1/conversations` 开 DM | 兼容 `Glip_Team_ID`（数字）与 `Glip_User_Name` |
| 发帖 | `POST /team-messaging/v1/chats/{chatId}/posts` | 返回 postId → 可回写 Logs |
| 附件 | `POST /team-messaging/v1/files` 上传后挂到 post | 对应 `Attachment` 列 |
| @mention | `@first.last` → `![:Person](id)`、`@team` → `![:Team](chatId)` | 邮件网关做不到的增强 |
| 失败兜底 | `fallbackToEmailOnMissingConfig / OnError` | **集成时必须关掉**（见 2.3-⑤） |

### 2.2 改造后的依赖模型

```
基座（Sheet + AppScript + 触发器）
   ├── Jira 主通道（executor rule，需 project admin）→ Bot / AI / 个人提醒 / 托管 API（4 类）
   ├── AsMe 通道（RC personal token，AppScript 直发）→ AsMe（1 类）   ← 与 Jira 互相独立
   └── （旁路）memory-service → Outreach（1 类，维持 lazy）
```

勾选组合与解锁：仅 Jira = 4/6；仅 RC = 1/6；双通道 = 5/6；都不勾 = 0/6（可跳过、可建草稿）。

### 2.3 副作用清单（实现时必须逐条处理）

1. **新 OAuth scope → 老用户需重新授权**。现模板 `UrlFetchApp` 出现 0 次；加入 sender 引入 `script.external_request` scope。新初始化用户在授权页一并同意，无感；**存量用户经 `AppScriptUpdater` 升级后，分钟触发器会因缺 scope 报授权错误**，需复用现有 `AUTHORIZATION_REQUIRED` → `authUrl`（`?action=authSuccess`）的重授权引导，升级流程要显式提示。
2. **双发风险与原子迁移**。现状 v1.4.0：RC 就绪时 AppScript 跳过 AsMe、Jira executor 领取 AsMe。改造必须在**同一个 .gs 版本**里同时完成：①AppScript 直发 AsMe；②webapp `findMatchingMessage` 不再把 AsMe 行给 Jira（移除 `ringCentralSenderEnabled` 分支）。两处同文件天然原子，杜绝同一条消息被 AppScript 和 Jira 各发一次。已配置 v1.4.0 的存量用户升级后，旧 rule 的 AsMe 分支自动失活（领不到消息），rule 本身无需重建。
3. **两个 .gs 的发布链路**（用户已点名）。Apps Script `projects/{id}/content` 的 PUT 是**整体替换文件列表**：
   - `SheetInitializer.createAppScriptProject`（:590-614）`files` 数组追加 `{ name: 'GlipSender', type: 'SERVER_JS', source: glipSenderCode }`；
   - `AppScriptUpdater`（:645-680）同样改为读取并推送**两个** .gs（漏推即等于删除该文件）；归属检查（扫描所有 SERVER_JS 找 marker，:746-761）已兼容多文件；
   - `webpack.common.cjs` 的拷贝规则 + `src/manifest.json` / `static/manifest.json` 的 `web_accessible_resources` 加入 `app-script-glip_sender.gs`（与 template 同机制，扩展内 `chrome.runtime.getURL` 读取）；
   - `appScriptVersioning.ts` 版本号提升，版本语义覆盖双文件。
4. **多收件人语义变化**。邮件网关 `a+b@reply...` 是一封邮件进一个含 a、b 的会话；glip_sender 按目标逐个开 DM 各发一条。需要决策：接受"N 个单聊"，或增强为一次 `POST /conversations members:[a,b]` 建群发一条（推荐后者，保持与旧行为一致）。另有格式适配：表里存 `a+b`，sender 按 `,` 切分——集成时 `+` → 目标数组。
5. **email fallback 必须熔断**。`fallbackToEmailOnMissingConfig/OnError` 默认 true，会把失败静默回落到已死的邮件网关，重新制造"伪成功"；集成版必须置 false 或直接删除 email 分支，同时移除硬编码的 `defaultBcc: 'esone.qiu@ringcentral.com'`。
6. **凭据面**：比现状更安全——不再经 webapp → Jira rule → Dify 传输（现模板 :2968 会把 RC 凭据字段返回给 Jira）；凭据仅由用户自己的 AppScript 从 Config 子表读取。但 Config 子表域共享可见性问题仍在（见 P2 加固）。
7. **配额/限频**：UrlFetchApp 每日 2 万（消费者）/ 10 万（Workspace）次，每条 AsMe ≈ 2-4 次调用，分钟级调度完全够用；RC token 端点限频已由 CacheService 缓存化解；目录全量拉取（`recordCount=1000`）仅在含 @mention 时发生，可后续加 personId 缓存优化。

### 2.4 RC App 权限要求（写进获取引导）

JWT auth flow App 需勾选 **Team Messaging**（发帖/建会话/传文件）+ **Read Accounts**（目录解析收件人）。引导文案四步：Developer Portal 登录 → Create App（REST API / JWT auth flow / 上述权限）→ 复制 Client ID & Secret → Credentials 里生成 Personal JWT（Production）。

---

## 三、新最后一步「激活发送通道」UI 规格

> 交互细节见 Demo（v2 已更新）。
> **挂载点说明**：`SheetInitializer` 是无 UI 的逻辑类；该步骤渲染在 `ScheduledMessagesManager` 的初始化流程 UI 中——`completeInitialization` 成功返回后、关闭初始化界面之前展示；提交逻辑复用 `BotConfigDialog`（`ScheduledMessagesManager.tsx:9391+`）的 `testAccess → createBotAutomationRules → withBotAutomation / withRingCentralSender → ConfigSyncService.syncConfig`。

### 3.1 结构

- 顶部：基座完成 chips（Sheet ✓ / AppScript ✓ / 触发器 ✓）+「步骤 3/3」。
- **能力项 1（默认勾选）**「我在某个 Jira 项目有 Admin 权限」→ 展开：规则说明、`Jira URL`（默认 `https://jira.ringcentral.com`）、`Project Key`、「预检权限」（复用 `testAccess`，403 给申请指引）、解锁 chips ×4。
- **能力项 2（默认不勾）**「我有 RingCentral 个人 API Token」→ 展开：获取引导（含权限要求）+ `Client ID` / `Client Secret` / `JWT`；蓝色说明块讲清直发链路（触发器 → JWT 换 token → 解析收件人 → 直发 → 回写 Logs），与 Jira 互相独立。
- 底部动态摘要 + 主按钮四态：

| 勾选状态 | 解锁 | 摘要要点 | 主按钮 |
|---|---|---|---|
| Jira + RC | 5/6 | 两条自检私信（Bot + AsMe）分别验证两条链路 | 「激活双通道并完成初始化」（primary） |
| 仅 Jira | 4/6 | Bot 私信自检；AsMe 可后补 | 「激活主通道并完成初始化」（primary） |
| 仅 RC | 1/6 | 同步测试 Token + AsMe 自检消息；Bot/AI/提醒仍需 Jira | 「激活 AsMe 通道并完成初始化」（primary） |
| 都不勾 | 0/6 | 所有类型不可发；可建草稿、状态卡随时激活 | 「跳过配置，仅完成基座初始化」（ghost） |

- 执行进度（按勾选拼装）：预检 Jira 权限 → 创建 Executor Rule → 创建 Sync Rule → 保存 RC 配置 → **测试 Token（同步）** → 写入 Bot 自检私信 → 写入 AsMe 自检消息 → 同步 Config。
- 完成态：按激活通道展示对应自检气泡（Bot 🤖 / AsMe 👤）+ 6 类消息解锁矩阵 + 「创建第一条消息」入口；跳过态展示 0/6 + 草稿引导 + 状态卡入口。

---

## 四、Welcome / 冒烟测试设计

| | A. email welcome（现状） | B. Bot 私信探针 | C. AsMe 自检探针（v2 新增） | D. 共享 Bot token welcome |
|---|---|---|---|---|
| 时机 | 基座完成 +1 分钟 | Bot 通道激活后 +1 分钟 | AsMe 通道激活后 +1 分钟 | — |
| 验证 | 无（只证明 MailApp 不抛错） | Jira rule → webapp 领取 → Bot 发送 → Logs 回写 | 触发器 → 取数 → JWT/直发 → Logs 回写 | — |
| 结论 | ❌ 移除 | ✅ 必做 | ✅ 必做 | ❌ **已废弃**：memory-service 在内网，AppScript 不可达；客户端直调后端接口生成 welcome 又验证不了用户链路，失去冒烟意义 |

补充：RC 配置提交时增加**同步 Token 测试**（新 webapp `action=testRingCentralSender`：JWT 换 token + `GET /restapi/v1.0/account/~/extension/~` 返回姓名），秒级反馈凭据有效性；自检消息负责验证调度链路。探针消息均写入 Messages 表（`Status=Active`、`Next_Exec=下一分钟`、目标=本人），送达后 Logs 写 `Sent_Chat_ID/Sent_Post_ID`，UI 轮询亮绿；超时给 repair 入口（`getBotDialogModeForStatus` 已有）。

---

## 五、落地改动清单

### P0 · 止血（独立先行）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `executionRoute.ts` | AsMe 无 RC sender：`ready` → `needs_setup`，detail "邮件网关已停用，AsMe 需配置 RingCentral token"（不再要求 botConfigured） |
| 2 | `app-script-template.gs` | `sendEmailToGlip` 熔断：返回明确失败（`EMAIL_GATEWAY_DISABLED`），消灭伪成功 |
| 3 | `SheetInitializer.ts` | `completeInitialization` 移除 `addSampleData`（探针在通道激活后写入，见 P1-⑨） |
| 4 | `setupReceipt.ts` | 删除"一分钟后可检查测试推送"；改为"基座就绪 · 下一步：激活发送通道"，tone 降为 info |

### P1 · AsMe 直发集成 + 激活向导 + 探针 + 状态卡

| # | 位置 | 改动 |
|---|---|---|
| 5 | `app-script-glip_sender.gs` | 产品化：凭据改读 Config 子表（复用 `getRingCentralSenderConfigFromSheet`）；`fallbackToEmail*` 置 false / 删 email 分支；删 `defaultBcc`；`Glip_User_Name` 的 `+` 分隔适配；多收件人语义决策（推荐单会话多成员） |
| 6 | `app-script-template.gs` | AsMe 分支改调 `sendGlipMessage`；移除 `shouldHandoffAsMeToJira` 跳过逻辑（RC 未配置时明确失败而非邮件）；webapp `findMatchingMessage` 移除 AsMe/`ringCentralSenderEnabled` 分支（防双发，与 ⑤⑥ 同版本原子发布）；`isRingCentralSenderReady` 去掉 `executorRuleId`；直发结果经 `insertPushLog` 写 `Sent_Chat_ID/Sent_Post_ID/Sent_At` |
| 7 | 双 .gs 发布链路 | `SheetInitializer.createAppScriptProject` 与 `AppScriptUpdater` 的 `files` 数组都包含两个 .gs（PUT 整体替换语义）；`webpack.common.cjs` 拷贝规则 + 两份 `manifest.json` 的 `web_accessible_resources` 加入 `app-script-glip_sender.gs`；`appScriptVersioning` 升版本 |
| 8 | 升级重授权 | `AppScriptUpdater` 升级路径检测新 scope 授权失败（复用 `AUTHORIZATION_REQUIRED`）→ 引导 `authUrl` 重新授权，文案说明"新增外部请求权限用于直发 RingCentral" |
| 9 | `ScheduledMessagesManager.tsx` | 接入「激活发送通道」步骤（第三节规格）；新增 `addChannelProbeMessage(channel)`（Bot / AsMe 两种探针）；激活完成页轮询 Logs 亮绿；新 webapp `action=testRingCentralSender` 同步校验 |
| 10 | `executionRoute.ts` / `botAutomationConfig.ts` | AsMe 路由改为 `engine: 'AppScript · RingCentral API'`、ready 仅取决于 RC 配置；`hasRingCentralSenderCredentials` 等判定与 executor 解耦；`shouldRecreateExecutorRuleForRingCentralSenderUpgrade` 退役 |
| 11 | `ScheduledMessagesManager.tsx` | 状态栏替换为「通道状态卡」：基座 / Jira 主通道 / AsMe / Outreach 四行 + 一键修复；创建表单默认 `Push_Method` 取已激活通道（不再默认坏 AsMe） |
| 12 | 存量迁移 | 检测 `Active` + AsMe + 无 RC 配置的存量行（含旧 welcome），`scheduleHealth` 提示并支持一键转 `Paused` |

### P2 · 安全加固（原 P3）

| # | 位置 | 改动 |
|---|---|---|
| 13 | RC 凭据存储 | Config 子表域共享时凭据组织内可见。评估：启用 AsMe 时提示收紧维护表共享（owner-only / 指定人）；或上传 .gs 时把凭据注入脚本 / Script Properties（注意：容器绑定脚本对 Sheet 编辑者同样可见，真正隔离仍依赖共享范围收紧） |

> 原 P2「共享 Bot welcome（memory-service）」整节废弃，原因见第四节表格 D 列。

---

## 六、验证清单

1. 全跳过：完成后状态卡 0/6、可建草稿、无 `Active` 样例行、收据无测试推送承诺。
2. 仅 Jira：规则创建成功 → 1~2 分钟收到 Bot 自检私信 → Logs Success（含 `Sent_Chat_ID`）→ 状态卡 4/6。
3. 仅 RC：同步 Token 测试通过 → 1~2 分钟收到**以自己身份**发出的 AsMe 自检 → Logs Success（含 `Sent_Post_ID`）→ 状态卡 1/6；AsMe 消息可创建可发送，全程未配置任何 Jira 规则。
4. 双通道：两条自检均送达，状态卡 5/6。
5. 防双发回归：已配置 v1.4.0 RC sender 的存量用户升级后，同一条 AsMe 仅 AppScript 发送一次（Jira executor 不再领取 AsMe 行）。
6. 重授权：存量用户升级 .gs 后首次触发报授权错误 → UI 引导 `authUrl` 重授权 → 恢复正常。
7. 熔断断言：无 RC 配置的 AsMe `Active` 行执行 → `Exec_Log` 明确失败（不再伪成功、不再发邮件）。
8. 附件 / 多收件人 / `Glip_Team_ID`（数字 chatId）三种目标形态直发回归。

## 七、开放问题

1. 多收件人 AsMe 的会话语义：单群（与邮件网关行为一致，推荐）还是逐人 DM？
2. 域共享维护表上的 RC 凭据可见范围是否可接受？启用 AsMe 时是否强制提示收紧共享（P2-13）？
3. 旧 v1.4.0 executor rule 中 RC sender webhook 分支的清理时机（功能上已无害，仅整洁度）；`jira-rule-template.json` 新版本是否同步移除该分支。
4. JWT 过期/吊销的长期监控：自检之外，`scheduleHealth` 是否增加"AsMe 连续失败 → 提示重新生成 JWT"的健康项。
