# Task Plan: 即时通知拼接多条命中关注项

## Goal
同一条消息命中多条即时通知关注项时，Glip 推送的「关注项」要拼出这些规则，并标出真正导致 @提醒 的那条，避免用户只看到 `mentionMe: false` 的规则却被 @。

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Add delivery helpers for all immediate items, mention OR, concatenated display
- [x] Wire three `messageDealing.ts` notify paths
- [x] Stop LLM review from replacing concatenated 关注项
- [x] Update docs
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Extend `verify-memory-entry-runtime.ts` and digest bot display checks
- [x] Run targeted verify scripts
- **Status:** complete

### Phase 5: Delivery
- [x] Summarize behavior change and evidence
- **Status:** complete

## Key Questions
1. 拼接全部即时命中，还是硬限制 2 条？全部即时命中，用户例子恰好是 2 条。
2. mention 是否改为任一命中规则 `mentionMe`？是，否则显示两条但仍可能漏 @ 或误 @。
3. LLM 审核文案能否覆盖 关注项？不能替换，只能合并。

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 即时通知列出全部非摘要命中规则 | 用户要看到真正导致 mention 的关联关注项 |
| mention = 任一命中即时规则 mentionMe | 不再只看第一条 |
| 命中且 mentionMe 的规则加「（@提醒）」 | 用户能把橙色 @ 和配置对上 |
| LLM 审核只合并、不替换 matchedRule | 现有覆盖会把显示改成单条规则 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- 摘要-only 规则仍不进入即时通知列表。
- 关注后续仍优先作为第一条通知渠道来源，但显示会带上同时命中的普通即时规则。
