# Meeting Panorama 归档来源回执

## 目标

随机抽中的功能是 `会后 Panorama`（`docs/features/meeting_pilot.md`）。

当前 Panorama 从会议历史打开时会优先拉取 memory-service 完整归档；如果详情加载失败，页面只显示一个 `仅显示基础归档` pill。这个状态过轻，用户容易把空行动项、空决议、空时间线误读为“这场会议没有这些内容”，而不是“完整归档没载入”。

## 外部参考

- Microsoft Teams Intelligent recap 明确区分 recording / transcription / recap 能力前置条件。
- Otter action items 支持回到 transcript 来源位置，说明行动项应保留来源和可复核路径。
- LLM meeting recap 研究强调 highlights 和结构化 minutes 是互补视图，归档缺失时不能把一个视图的缺失误当成会议事实。

## 改进计划

1. 在 Panorama 归档模式新增 `归档来源回执`。
2. 对 `loading / loaded / fallback` 三种归档详情状态分别展示来源、覆盖范围、边界和下一步。
3. fallback 时说明当前只来自历史列表参数，缺失行动项/决议/时间线不代表会议没有这些内容，也不会自动重写归档或补发 PDF。
4. 更新 Panorama E2E，覆盖 fallback 和 loaded 回执。
5. 更新 `docs/features/meeting_pilot.md` 的 Panorama 边界说明。
6. 验证：Meeting Pilot 目标 E2E、首次 `npm start` compile、`git diff --check`。
