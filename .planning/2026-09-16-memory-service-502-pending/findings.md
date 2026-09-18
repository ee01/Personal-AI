# Findings & Decisions

## Requirements
- 检查 Memory Service 远程 Server 日志
- 解释之前一直出现的 502 或 pending
- 给出根因与如何避免未来再发生

## Research Findings

### 当前状态（2026-09-16 17:55 CST）
- 主机 `rcadmin@10.32.56.212` 于 **17:22 重启**（uptime 32 min），8GB RAM，swap 很重（swapins 419 万）。
- `memory-service` 17:43 才起来，docker health=healthy，`/health` 现在 1.5ms。
- 未认证 `/health` 返回 `status=degraded, database.connected=false` 是设计如此（无 userContext），**不是库挂了**。
- 看门狗锁目录仍在：`~/Library/Caches/pai-memory-service-watchdog.lock` 时间戳 **17:00:32**。reboot 后 mkdir 失败直接 exit 0，**看门狗目前是死的**。
- 应用日志仍在刷 `[RecallEngine] messages_vec search failed: SQLITE_EMPTY`。库本身 `integrity_check=ok`；`messages_raw=16331`，`messages_vec=11639`，`chunks_vec=18518`。向量表不是空的，是 MATCH 查询报 SQLITE_EMPTY。

### 今天 502 / pending 数字（NPM access，容器 TZ +1000 = CST+2）
| 状态 | 次数 | 含义 |
|------|------|------|
| 200 | 20629 | 正常 |
| 499 | 1859 | 客户端等不及断开 = 浏览器里的 pending 后取消 |
| 502 | 841 | 上游拒绝/重置 = 容器正在重启 |
| 504 | 84 | 上游连上但一直不回 header = 进程卡住 |
| 401/403 | 972+902 | 重启窗口里 key/鉴权抖动，次要 |

高峰：
- AEST 09:00（CST 07:03）：日常那一次 watchdog 重启
- AEST 12:00（CST 10:00）：两次重启
- AEST 18:00（CST 16:13–17:00）：**738 次 502 + 789 次 499** 主风暴
- AEST 19:00（CST 17:22 重启后）：499/504，17:43 容器起来时一串 connection reset/refused

NPM error：`upstream timed out while reading response header`（context-recall / calendar-sync / score / profile / composer），随后 `recv() failed (104)` 和 `connect() failed (111)`。

### 看门狗死亡螺旋（主因放大器）
脚本：`/Users/rcadmin/bin/pai-memory-service-watchdog.sh`，LaunchAgent 每 60s。
- `curl -m 3 http://127.0.0.1:3210/health` 连续两次失败就 `docker compose restart`
- 失败仍不恢复就 **quit/TERM/KILL OrbStack**
- 历史 1077 次 health failed；今天 16:13–17:00 约每 70 秒重启一次，close_wait 从 3 涨到 10
- 17:00 最后一次 restart 卡住（日志停在 Restarting，lock 未清），17:22 主机 reboot

每日 07:03 左右几乎必有一次同样的「health failed twice → restart」（8/29 至今）。

### 为什么 /health 会超过 3 秒
`/health` 无认证时不做 COUNT，空载 1.5ms。超过 3s 只能是 **Node 事件循环被同步 SQLite / 向量检索 / 嵌入模型堵住**，或 8GB 主机在 swap。
触发负载：扩展高频打 `context-recall`、`candidates/score`、`calendar-events/sync`、`agent-tasks/runtime-status`；服务端还有 `PROACTIVE_SCHEDULER_ENABLED=true`、heartbeat 15min、hourly usage rollup、v3-read-shadow 在 passive recall 上 fire-and-forget 但同进程同库。

### 502 vs pending 对应关系
1. 事件循环卡住 → 请求一直不回 header → 浏览器 **pending**
2. 客户端放弃 → NPM **499**
3. 看门狗 3 秒判死并 restart → 进行中的连接 reset → **502**
4. 重启后 OrbStack 端口在、容器未 listen → 再 pending，直到 timeout **504** 或 refused **502**

不是 Nginx 上游 IP 指错（4.conf 已是 `192.168.156.1:3210`）。也不是这次 SQLite 整库损坏（integrity ok）。八月那次 `SQLITE_CORRUPT_VTAB` 是另一条线；今天向量 MATCH 的 SQLITE_EMPTY 会拖慢 recall，但不是 502 的直接原因。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 本轮不改生产、不清 lock | 用户要根因；误清 lock 会让旧看门狗立刻恢复重启循环 |
| 建议先改 watchdog 再清 lock | 当前死锁反而让 17:43 之后稳住了 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 远端无 rg | 改用 grep/python |
| 未认证 /health 显示 database.connected=false | 确认是代码设计，不是库断连 |
| docker logs 只有当前容器 | 风暴现场靠 watchdog + NPM 日志还原 |

## Resources
- Watchdog: `/Users/rcadmin/bin/pai-memory-service-watchdog.sh`
- NPM: `~/nginxproxymanager/data/logs/proxy-host-4_{access,error}.log`
- Watchdog log: `~/Library/Logs/pai-memory-service-watchdog.log`
- 向量修复脚本: `memory-service/tools/repair-sqlite-vtab.ts`
- 历史：2026-08-21 SQLite 损坏 + 502；watchdog 曾重启 OrbStack
