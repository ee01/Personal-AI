# E-76 续作与 rollout 验证（2026-10-14）

runner 是服务内的 A–E 执行模块，已接入原 daily consolidation；原服务已有日巩固、每周 Dreaming 和每日 Reflect。新模块调用受预算约束的模型 API，不启动 Codex CLI 或任意工具 Agent。

本轮补齐：有界两跳与单次重排、隐藏中间节点权限门、向量加载 single-flight/400ms 降级、空 v3 命中仅补 legacy FTS、被动 Lens 当前真值过滤与实体锚定、梦境页回执/来源/版本保护撤销、长期偏好确认和拒绝、人工 blind 样本导出、生产读取与 nightly/manual 执行统计。扫描改为小批写事务并让出事件循环。B/C 使用现有低成本首目标，资格按 provider/model 隔离；C both-valid 门统计误 supersede。显式回答目标使用现有 Flash，默认 9s 未提高。

## 实际验证

- Memory Service build：通过；Chrome 扩展 npm start 首次编译：通过，watch 已停止。
- 13 个相关测试文件：278/278 通过；另行复验偏好接受/拒绝与用户修订。
- eval registry：28 suites 校验通过，四个既有空 suite 警告保留。
- 原五组 67 项 + 续作集成 9 项：76 项 experience 断言通过。
- 实际生产低成本目标 openai/deepseek/deepseek-v4.1-flash，50 对受控匿名场景：最新值 1、both-valid 误报 0、推断覆盖违规 0、一致率 1。
- 新建 Chrome 扩展实例 UI E2E：shadow 标记、原文链接、撤销成功/版本冲突、偏好拒绝、空人工标签导出通过。截图是受控 API fixture，不是生产记忆截图。
- 已部署分支的线上六能力：extraction / multi_session / temporal / knowledge_update / abstention / prospective 均 1.00，overall 1.00，no regression vs baseline。按既有 best-of-two rubric，prospective 两次分别 .50 与 1.00；不能声称每次都稳定通过。
- 初次 rollout 回归曾因冷启动/数据库锁与请求失败全组失败；修正读取/扫描边界后，旧主模型 9s 超时导致 prospective .50；显式使用已配置 Flash 回答目标后的六能力结果如上。失败没有算通过。
- scoped git diff --check：通过。

## 真实 rollout

部署验证：health 200，新 runner 存在，A–E/两车道开启，B/C shadow，原 personal-ai_memory-data 数据卷保留。首轮对 2,695 units 执行 A，alias 映射 14，A/D/E 为 0 LLM；B judged 54/applied 0/deferred 847，C judged 21/applied 0/deferred 507。B/C token 预留上界分别 118,342/59,664，未越各自上限。这是手动首轮，不是七晚记录。

当前模型可导出 B 50 对人工样本，C 21 对，期望标签留空；没有导入任何 synthetic gold，也没有打开 live。真实生产读取指标目前样本不足，p95/deepRate 空值保留，不拿 read_only benchmark 填充。

## 下一步与自测

重新加载开发扩展后，打开 Memory Explorer → 梦境重放 → 夜间记忆整理。查看“候选判决，未改真值”、较早/较新值和原文入口；profile 提案只有明确确认后才生效。可展开“上线人工验收样本”导出 B JSON，在本地根据原文填写 expectedDecision，完成后再由操作员导入。C 尚未达到 50 对，还需积累至少 15 对人工 both-valid 标签；不降低门槛。

生产 live 资格通过以前，同槽新旧值不会被 shadow 自动替代。现在可运行 `memory-service/node_modules/.bin/tsx memory-service/tools/demo-sleep-reconciliation.ts`，在内存 fixture 中看到新旧并存→只召回新值，以及四年前偏好归档后主动可搜的对照；固定 gold，不代表模型真实判断。

人工资格、真实七晚、Passive p95 <500ms、深车道率 <20%、每日 token 与整个 Ask p95 改善仍未闭环。任务保持 in_progress。当前安装的 Multica CLI 不支持 issue wakeup，未成功建立自动复核唤醒；服务自己的 nightly 会继续运行，七晚后需要重新触发本卡复核。没有后台遗留的 run-owned 工作。
