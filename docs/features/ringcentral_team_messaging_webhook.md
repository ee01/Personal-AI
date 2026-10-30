# RingCentral Team Messaging Webhook（Server 侧 Glip 入库 POC）

E-154 最小 POC：用 RingCentral `WebHook` 订阅 `/team-messaging/v1/posts`，把 **PostAdded / PostChanged / PostRemoved** 写入 `memory-service` 的 `IngestionPipeline`，替代 Extension IndexedDB 爬取作为主入库路径（Extension 仍保留 message_analysis、owner speech 等能力）。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/webhooks/ringcentral/team-messaging/:token` | RC 投递入口；创建订阅时回显 `Validation-Token` / `Verification-Token` |
| `GET` | `/api/v1/ringcentral/team-messaging/webhook/status` | 本地 + 远端订阅状态、blacklisted 列表（需常规 API 鉴权） |

## 环境变量

| 变量 | 含义 |
| --- | --- |
| `RINGCENTRAL_TM_WEBHOOK_TOKEN` | URL 路径密钥（勿提交 git） |
| `RINGCENTRAL_TM_WEBHOOK_USER_ID` | 写入哪份用户 SQLite（如 `esone.qiu`） |
| `RINGCENTRAL_TM_WEBHOOK_PUBLIC_URL` | 公网 HTTPS 根地址（ngrok / 生产反代），**不含** path |
| `RINGCENTRAL_*` | 与现有 `RingCentralClient` 相同的 JWT 应用凭据 |

完整投递地址：`{PUBLIC_URL}/webhooks/ringcentral/team-messaging/{TOKEN}`

## 本地跑通（ngrok 示例）

```bash
cd memory-service
export RINGCENTRAL_TM_WEBHOOK_TOKEN="$(openssl rand -hex 16)"
export RINGCENTRAL_TM_WEBHOOK_USER_ID=esone.qiu
export RINGCENTRAL_TM_WEBHOOK_PUBLIC_URL=https://YOUR.ngrok-free.app
# RINGCENTRAL_CLIENT_ID / SECRET / JWT 已在 user config 或 env

npm run dev   # 默认 :3210

# 另一终端
ngrok http 3210

npm run rc:tm-webhook -- --user esone.qiu create
```

在 RC Developer 控制台确认 JWT 应用具备 **SubscriptionWebhook** + **TeamMessaging** 权限。创建订阅后向受控群发帖，检查：

```bash
curl -s -H "X-User-Id: esone.qiu" http://127.0.0.1:3210/api/v1/stats | jq '.messages'
```

## 订阅生命周期脚本

```bash
npm run rc:tm-webhook -- --user esone.qiu monitor
npm run rc:tm-webhook -- --user esone.qiu renew --subscription-id <id>
```

日志为 JSON stdout；`blacklisted` 订阅需到 RC 控制台或 API 排查 delivery 失败原因。

## 历史回填

```bash
npm run rc:tm-backfill -- --user esone.qiu --max-chats 10
npm run rc:tm-backfill -- --user esone.qiu --chat-id 54490570758 --since 1730000000
```

水位表：`rc_tm_backfill_watermarks`（每 chat 的 `last_post_id` / `last_creation_time`）。

## 行为摘要

- **幂等**：`rc_tm_webhook_deliveries.delivery_key`（优先 RC `uuid`）+ ingest 层 `metadata.postId` 去重。
- **PostChanged**：更新 `messages_raw.content` / metadata。
- **PostRemoved**：metadata 标记 `accessRevoked`，并将 message/chunk `memory_metadata.retrieval_tier` 降为 `archive_only`（撤权传播，不删 raw 正文）。
- **429**：`RingCentralClient` 出站 REST 对 CMN-301 指数退避重试（最多 5 次）。

## 与 IndexedDB 路径差集（E-141 §3）

| 能力 | Webhook + REST 回填 | Chrome Extension |
| --- | --- | --- |
| Glip 消息 raw 入库 | ✅ 主路径 | ✅ 经 ingestBatch |
| 历史消息 | REST 分页 + 水位 | IndexedDB 全量扫描 |
| message_analysis / 规则自动化 | ❌ | ✅ |
| owner speech 学习 | ❌ | ✅ `messageDealing` |
| Calendar / SMS / transcript IndexedDB | ❌ | ✅ |
| 附件本地缓存 | ❌ | 部分 |

评测阶段以 Server webhook 水位为准；Extension 仅作补充与对照。

## 相关代码

- `src/routes/ringcentralTeamMessagingWebhook.ts`
- `src/integrations/ringcentral/TeamMessagingWebhookService.ts`
- `src/storage/migrations/082_ringcentral_team_messaging_webhook.sql`
