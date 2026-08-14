# Task Plan: 新用户默认 Mac mini OpenClaw Gateway

## Goal
让 memory-service `.env` 成为新用户的默认 Agent 执行器来源：未自定义 Options 的用户开箱使用 `openclaw-gateway`（Mac mini Openclaw / http://claw.xmnup.com）。

## Current Phase
Phase 5

## Phases

### Phase 1: Discovery
- [x] Confirm OPENCLAW_* exists but synthesizes openclaw-responses
- [x] Confirm empty agentExecutors inherit env URL/key at runtime
- **Status:** complete

### Phase 2: Planning
- [x] Add OPENCLAW_EXECUTOR_TYPE / LABEL
- [x] Default synthesis type = openclaw-gateway
- [x] First GET /config persists env default for new users
- [x] Do not commit the API key; write it only to gitignored .env
- **Status:** complete

### Phase 3: Implementation
- [x] config + runtimeConfig + executorRegistry
- [x] tests, .env.example, docs
- [x] write live/local gitignored .env and deploy
- **Status:** complete

### Phase 4: Verification
- [x] unit tests
- [x] GET /config for a user without executors shows gateway
- **Status:** complete

## Decisions
| Decision | Rationale |
|----------|-----------|
| Env is the default; persisted agentExecutors win | Users who already configured Options keep their list |
| Default type openclaw-gateway | Product path is Gateway, not HTTP responses |
| API key only in gitignored .env | User pasted a live secret |
