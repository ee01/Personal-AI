# 多用户隔离写保护前置计划

## 目标

让缺失或空白 `X-User-Id` 的写请求在创建任何 `default` 用户上下文前 fail-closed，避免用户看到“写入被拦截”时，磁盘上却已经出现 default 用户目录或迁移副作用。

## 步骤

1. 检查 `AGENT.md`、`docs/progressing/to-verify.md`、自动化记忆、Reminders、功能文档和身份解析代码。
2. 复查外部产品与研究：Memory sources / memory controls、多租户 RAG 授权、local-first memory isolation 和 multiuser memory fabric。
3. 调整 Memory Service hook 顺序，让 `writeGuardMiddleware` 先于 auth middleware 处理写请求。
4. 在现有 `api-health.test.ts` 多用户隔离测试中补回归断言：无身份写请求返回 403，且不创建 `data/users/default/`。
5. 更新 `docs/memory_system.md` 的多用户隔离说明。
6. 跑定向后端测试、dev extension 首次编译、memory user identity E2E 和 scoped diff check。

