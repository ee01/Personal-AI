# Source Memory Distiller Experience Eval

本 suite 验证资料保存后的双层蒸馏是否真正满足“立即可用、异步增强、证据可追、低副作用”的用户体验，而不是只验证模型能返回 JSON。

## 用户场景

1. 同一 Jira 工作被分别保存在 Jira 与文档中：系统应关联来源，但不能合并或删除独立原文。
2. 保存视觉状态表：每一行先成为可定位 evidence span，模型伪造的 span 引用必须被丢弃。
3. 保存其他 AI 对话中的工作流：可以形成 Skill seed，但单一来源不能写画像、创建动作或激活 Skill。
4. 页面正文含 prompt injection：异步模型调用必须为零，P0 回执与原资料仍可复核。
5. Ask 专用 deep 触发词出现在会议查询中：只有匹配 Ask 场景才允许召回。

## 执行步骤

1. 每个 case 在独立内存数据库中应用当前全部 migration。
2. 通过生产 `SourceMemoryCaptureService.createCapsule()` 保存资料并同步生成 P0。
3. 通过生产 `SourceMemoryDistillationWorker` 执行队列；LLM 端使用固定、可重复的候选输出。
4. 检查 evidence span、normalized artifact、queue/deep 状态、来源簇、Skill/Profile/Action 表。
5. 场景 case 继续调用生产 `ContextRecallService.recall()`，比较匹配场景与不匹配场景。
6. 由确定性 heuristic 对每项 hard gate 精确判分并生成共享 HTML report。

## 通过标准

- 同步 P0 在 deep 成功或阻断时都保持 `ready`。
- 所有落库 artifact 的引用必须属于同 capsule、同 input hash 的真实 evidence span。
- 视觉表格至少生成预期数量的 `visual_table_row` spans；伪引用产物不得落库。
- 注入 case 在模型调用前进入 `blocked`，模型调用数必须为 0。
- Profile 写入和 Action proposal 必须始终为 0；单一 Skill seed 不得物化或激活。
- 相同 Jira key 只建立派生 cluster/link，不减少 capsule 数量。
- deep-only 关键词只有在 trigger card 场景匹配时可召回。

## Judge 选择

本 suite 不使用 LLM judge。被验证的是引用集合、状态机、副作用和召回集合等确定性事实，LLM judge 会降低可重复性。固定模型响应用于覆盖生产后处理契约；它不证明线上模型文风或所有开放域摘要质量，真实数据抽样应在后续迭代中继续补入 cases。

## Report Requirements

- 使用共享 Reader Contract 渲染，不新增 suite 专属 HTML。
- 每个 case 展示 P0/deep 状态、模型调用数、实际 artifact/span 计数和逐项 proof check。
- 聚类 case 展示 cluster size 与派生链接数；场景 case 展示 matching/mismatched recall 结果。
- 报告必须明确列出 Profile、Action、Skill 的实际写入计数，不能只用文字声称“无副作用”。
- 报告注明固定模型响应只证明生产后处理 hard gate，不代表线上模型开放域输出已经全面达标。

## 命令

```bash
npm run eval:validate
npm run eval:run -- --suite source-memory-distiller --no-repair
```
