# 自托管 Memory Service

面向想把记忆数据留在自己机器上的用户。默认公共服务器是 `http://memory.xmnup.com`；私有部署后只需在扩展 Options 里改一个地址。

## 为什么自托管

Memory Service 存的是你的消息、实体、画像和项目焦点。公共服务器按用户隔离，但对隐私敏感的场景，自己跑一份更安心。

Chrome 扩展支持任意 Memory Service 地址；绝大部分人继续用默认公共实例即可。

## 最快路径（预构建镜像 + bootstrap）

正式自托管路径是 **ghcr.io 镜像 + `deploy/bootstrap.sh`**，不必在目标机 `npm install` / `npm run build`。

```bash
git clone https://github.com/ee01/Personal-AI.git
cd Personal-AI/deploy
chmod +x bootstrap.sh
./bootstrap.sh
# 可选启用 Roadmap：docker compose --profile roadmap up -d
curl http://127.0.0.1:3210/health
```

脚本会生成 `deploy/.env`（随机 `API_KEY` / `BOOTSTRAP_API_KEY`）、拉 `ghcr.io/ee01/personal-ai-memory-service:<tag>`、健康检查，并打印扩展 Options 该填的地址和 Bootstrap 密钥。数据在 `deploy/data/` 卷里；升级改 `MEMORY_SERVICE_TAG` 后 `docker compose up -d`，SQLite 与 migrations 自动跑。

镜像由 tag 推送：`memory-service-v*` → `personal-ai-memory-service`，`roadmap-service-v*` → `personal-ai-roadmap-service`。

## 源码 compose（开发者 / 贡献者）

仓库：[ee01/Personal-AI](https://github.com/ee01/Personal-AI)（默认分支 `develop`）

```bash
git clone https://github.com/ee01/Personal-AI.git
cd Personal-AI
cp memory-service/.env.example memory-service/.env
# 编辑 memory-service/.env：
#   LLM_PROVIDER=claude         # 或 openai / groq / ollama / dify
#   CLAUDE_API_KEY=...          # Claude 不需要填 base URL
#   OPENAI_API_KEY=...          # LLM_PROVIDER=openai 时需要
#   API_KEY=...                 # 全权运维密钥（不要放进扩展）
#   BOOTSTRAP_API_KEY=...       # 仅签发设备 key；可放进扩展 Options
#   ALLOWED_ORIGINS=            # 留空：浏览器 CORS 全关（推荐）
npm --prefix memory-service install
npm --prefix memory-service run build
docker compose up -d memory-service
curl http://localhost:3210/health
```

## 在扩展里连接

1. 打开 Personal AI → Options →「记忆系统」
2. **记忆服务 API 地址**填 `http://localhost:3210/api/v1`（或你的公网/内网地址）
3. **Bootstrap 密钥**填与服务端 `BOOTSTRAP_API_KEY` 相同的值
4. 保存后刷新扩展；**全新用户**首次访问记忆接口时会自动为本机签发设备 key（TOFU 认领）
5. **已有数据的用户换机 / 重装**：Bootstrap 不再直接签发。扩展会提示用 Google 验证或请求管理员批准；未完成前不会继续发无凭证请求（避免 401 风暴）

`ROADMAP_BASE_URL` 与 Memory 地址彼此独立。Roadmap 私有部署时同样只改 Options 里的 Roadmap 地址，**不需要**在 Memory Service 上登记 Roadmap 域名。

## 凭据分层（必读）

| 凭据 | 能力 | 放哪 |
|---|---|---|
| `API_KEY` | 任意 `X-User-Id` 读写；**配置后关闭匿名 `X-User-Id`** | 仅运维 / Desktop App / 部署脚本 |
| `BOOTSTRAP_API_KEY` | 只能认领空命名空间并签发第一把 `/users/me/keys` | 可进扩展 Options / 构建注入 |
| 每设备 `pak.…` 个人 key | 只能访问自己的记忆 | 扩展自动签发，存在本机 `chrome.storage.local`（不是 envConfig） |
| `GOOGLE_OAUTH_CLIENT_IDS` / `GOOGLE_ALLOWED_EMAIL_DOMAINS` | 已认领用户自助换机（可选） | 仅服务端 `.env`；域名填**你自己的**公司域，不要沿用公共实例示例 |
| `ADMIN_CONTACT_EMAIL` / `ADMIN_API_TOKEN` | 409 兜底联系人 + `/api/v1/admin/key-requests` 批准页 | 仅服务端；联系人填部署方管理员 |

公共/生产环境应设置 `API_KEY`。未设置时（本地开发），任意能打到服务的客户端只要伪造 `X-User-Id` 就能读写对应用户。设置后，匿名请求返回 401；**新用户**认领仍走 `BOOTSTRAP_API_KEY`。自托管若不配 Google 相关变量：新用户仍可认领；老用户新设备只走管理员批准（`ADMIN_API_TOKEN`，可回落到 `ANALYTICS_ADMIN_TOKEN`）。部署 Roadmap **不会**清理 Chrome 里的设备 key；若服务端用户库重建导致旧 pak 失效，扩展会按认领门禁重试（空命名空间可 bootstrap 重签，已认领则需 Google / 管理员）。

不要把 `API_KEY` 打进 Chrome 扩展包或 Options。扩展只需要 Bootstrap；全权密钥留给 Desktop App 环境变量和运维脚本（`curl -H "Authorization: Bearer $API_KEY" -H "X-User-Id: someone"`）。

## CORS

扩展通过 background service worker 访问 Memory Service，**不走浏览器 CORS**。因此默认 `ALLOWED_ORIGINS` 留空即可。

仅当你自己写网页 dashboard 直连 Memory Service 时，才在 `.env` 里写：

```
ALLOWED_ORIGINS=https://your-dashboard.example.com
```

## 用量报表成本预估初始化（推荐，部署后做一次）

Usage Analytics 报表的“预估成本”按 `model_pricing` 表估算，源码自带的价目表只是 seed，只覆盖开发期已知的几个模型——换了 `LLM_PROVIDER` 或模型之后，报表会显示预估成本一直是 $0（并在成本卡片打 `⚠ 含未计价模型`）。管理员运行一次 `update-model-pricing` skill（`.claude/skills/update-model-pricing/SKILL.md`）即可补上：

1. 需要 `MEMORY_SERVICE_URL` 和 `ANALYTICS_ADMIN_TOKEN`
2. skill 会先调 `GET /api/v1/usage/pricing/unpriced?range=30d` 找出本实例**实际用过但没有价格**的模型，联网核对官方价目表，列出待确认的价格差异表，你确认后再写入
3. 写入立即生效（`PUT /api/v1/usage/pricing`），无需重启、无需等 rollup，历史数据也会跟着重新计价

之后每次换 `LLM_PROVIDER` / 模型，或 dashboard 顶部又出现未计价告警时，重新运行一次即可。详见 [usage_analytics.md](./features/usage_analytics.md) 的「成本估算」一节。

## 更多

- 工程细节：[`memory-service/README.md`](../memory-service/README.md)
- Roadmap 组织级自托管：[`roadmap-service/README.md`](../roadmap-service/README.md)
- 记忆系统总览：[`memory_system.md`](./memory_system.md)
- 用量与成本报表：[`usage_analytics.md`](./features/usage_analytics.md)
