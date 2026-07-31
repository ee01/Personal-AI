# Keystone Memory Briefs Experience Workflow

## Goal

验证关键记忆简报是否只在跨来源证据与当前场景都足够时进入现有 Memory Lens 主视图，并在单源、冲突、过期或外发风险下正确降级。

## Steps

1. 从 `evals/cases/keystone-memory-briefs/cases.jsonl` 读取真实工作场景脱敏样本。
2. 在内存 SQLite 中运行迁移；自动生成 case 写入 Reflection Thread 与真实消息形态证据，其余 case 直接写入 composed candidate。
3. 自动 case 运行 `KeystoneBriefComposerService`，验证无需用户操作即可生成；其余 case 运行 `KeystoneBriefService.upsertComposedCandidate()` 的来源覆盖与 freshness gate。
4. 用当前场景和本轮原始召回结果运行同步 `matchContext()`。
5. 核对 status、presentation mode、复制权限、hidden source count、external summary 脱敏与无副作用回执。
6. 输出逐 case JSON 和 HTML report。

## Pass Criteria

- `ready` 至少有两个独立来源、一个非 derived/reflection 权威来源，且所有 claim sourceRef 可解析。
- 活跃 Reflection Thread 有两条合格工作来源时，后台 composer 能自动生成 `ready` 简报；重复运行保持幂等。
- 弱单源保持 `candidate`，不接管 Memory Lens。
- `partial` 可作为冲突主视图，但不能复制外发摘要。
- `stale` 只返回 `stale_notice`，由 UI 展示警告并回退原始记忆卡。
- external summary 隐藏 URL、token、邮箱和电话号码，并报告只用于本机的来源数量。
- 所有状态都不写画像、不发送、不建任务、不更新确认事实。

## Report Requirements

- 展示 brief 输入、来源 provenance、当前场景和本轮 raw matches。
- 展示实际 status、blocked reason、freshness、source refs、display policy 和 presentation mode。
- 展示外发摘要及敏感信息泄漏检查结果。
- 展示每个 case 的用户结论、分数、失败原因和改进建议。

## Local Run

```bash
npm run eval:run -- --suite keystone-memory-briefs --no-repair
```
