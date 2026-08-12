# Personal Roadmap Service

团队排期看板（Gantt）后端 + Vue 前端。默认公共站点：`http://roadmap.xmnup.com`。

## 何时自托管

Roadmap 存的是**团队协作数据**（team、share token、activity），粒度是 per-team / per-org，不是 per-user。常见原因：

- `.env` 里的 `JIRA_PAT` 是组织级凭据，不宜放在第三方公共服务器
- 内网隔离 / 合规要求

个人隐私数据请走 Memory Service 自托管，见 [`docs/self-hosting-memory-service.md`](../docs/self-hosting-memory-service.md)。

## Docker Compose

```bash
# 在仓库根目录
cp roadmap-service/.env.example roadmap-service/.env
# 编辑 JIRA_BASE_URL / JIRA_PAT（可选，用于 Target 回写 fallback）
npm --prefix roadmap-service run build
docker compose up -d roadmap-service
curl http://localhost:3220/health
```

默认端口 `3220`。

## 连接 Chrome 扩展

1. Options →「项目 Roadmap」→ 填你的站点地址（如 `https://plan.acme.com`）
2. 保存后扩展会动态注册 content script
3. **刷新 Roadmap 页面**；桥接脚本按配置的 hostname 注入（不再要求域名含 `roadmap` 字样）

Memory Service 地址与 Roadmap 地址互不影响，两边服务端都**不需要**登记对方域名。

## 部署到已有环境

```bash
npm run deploy:roadmap
```

注意：部署脚本 **不会** 同步 `.env`（避免密钥被覆盖）。改完远端 `.env` 后需单独 rsync 并 `docker compose up -d --force-recreate roadmap-service`。

## 文档

- 功能说明：[`docs/features/personal_roadmap.md`](../docs/features/personal_roadmap.md)
