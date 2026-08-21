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
#   OPENAI_API_KEY=...          # LLM 能力需要
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
4. 保存后刷新扩展；首次访问记忆接口时会自动为本机签发设备 key

`ROADMAP_BASE_URL` 与 Memory 地址彼此独立。Roadmap 私有部署时同样只改 Options 里的 Roadmap 地址，**不需要**在 Memory Service 上登记 Roadmap 域名。

## 凭据分层（必读）

| 凭据 | 能力 | 放哪 |
|---|---|---|
| `API_KEY` | 任意 `X-User-Id` 读写；**配置后关闭匿名 `X-User-Id`** | 仅运维 / Desktop App / 部署脚本 |
| `BOOTSTRAP_API_KEY` | 只能签发 `/users/me/keys` | 可进扩展 Options / 构建注入 |
| 每设备 `pak.…` 个人 key | 只能访问自己的记忆 | 扩展自动签发，存在本机 `chrome.storage.local`（不是 envConfig） |

公共/生产环境应设置 `API_KEY`。未设置时（本地开发），任意能打到服务的客户端只要伪造 `X-User-Id` 就能读写对应用户。设置后，匿名请求返回 401；新用户签发设备 key 仍走 `BOOTSTRAP_API_KEY`，不受影响。部署 Roadmap **不会**清理 Chrome 里的设备 key；若服务端用户库重建导致旧 pak 失效，扩展会在收到 `invalid_user_api_key` 后用 Bootstrap 自动重签。

不要把 `API_KEY` 打进 Chrome 扩展包或 Options。扩展只需要 Bootstrap；全权密钥留给 Desktop App 环境变量和运维脚本（`curl -H "Authorization: Bearer $API_KEY" -H "X-User-Id: someone"`）。

## CORS

扩展通过 background service worker 访问 Memory Service，**不走浏览器 CORS**。因此默认 `ALLOWED_ORIGINS` 留空即可。

仅当你自己写网页 dashboard 直连 Memory Service 时，才在 `.env` 里写：

```
ALLOWED_ORIGINS=https://your-dashboard.example.com
```

## 更多

- 工程细节：[`memory-service/README.md`](../memory-service/README.md)
- Roadmap 组织级自托管：[`roadmap-service/README.md`](../roadmap-service/README.md)
- 记忆系统总览：[`memory_system.md`](./memory_system.md)
