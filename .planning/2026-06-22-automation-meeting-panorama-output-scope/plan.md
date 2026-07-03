# Meeting Pilot Panorama 输出范围回执计划

## 目标

随机目标为 `会后 Panorama`。本轮聚焦会后复盘页首屏输出/反馈边界，避免用户把复制、下载、打开或反馈按钮误读成已发送纪要、创建任务、写回 Memory Service 或重跑分析。

## 外部参考判断

- Teams Recap 把 recording、transcript、shared files、notes、agenda 和 follow-up tasks 放在会后 recap 中，但这些仍是可查看材料，不等于自动创建外部任务。
- Zoom AI Companion / meeting summary 把 summary、action items、review/share 状态作为显性会后路径，说明分享和发送应是独立可见动作。
- LLM meeting recap 研究强调 highlights 与 structured minutes 满足不同复盘需求，action items 需要保留上下文和可复核依据。

## 改进步骤

1. 在 Panorama header 下增加 `输出范围回执`，聚合页面链接、跟进清单、PDF、录制和 JSON 导出的可用性及副作用边界。
2. 给 footer 的 `内容准确` / `需要修正` 增加真实可见反馈回执，明确当前不会写入校准、重跑分析、创建修正任务或修改行动项。
3. 更新 `meeting_pilot.md` 与 `docs/features/index.md` 的 Panorama 描述。
4. 扩展 Panorama E2E，断言输出范围回执和反馈按钮回执存在。
5. 运行 targeted Panorama E2E、首次 `npm start` 编译和 scoped `git diff --check`。
