# Findings & Decisions

## Requirements
- 检查本机 Reminder 的 `Personal AI` 列表，只接受全新功能 idea；多条时随机挑选一条。
- 无合格 Reminder 时，结合项目目标、真实 `esone.qiu` 记忆、当前 AI 产品/论文/专家观点提出 idea。
- 遍历 `docs/progressing`，包括已搁置能力，禁止重复或换名重复。
- 只产出完整 plan；有新页面或集成交互时，同目录提供中文 HTML demo。
- plan 先讲真实用户旅程，再讲细节；包含竞品、实现、隐私/权限、风险、eval 决策与实现后 feature docs 移交。
- 若选题来自 Reminder，完成后写备注并标记 done。

## Repository/History Findings
- `AGENT.md` 把 Personal AI 定义为自主反思型私人记忆系统，优先内部机制与可逆 receipts，只有跨高责任边界才要求用户确认。
- 最近自动化已规划：例行差分记忆、共同上下文记忆、教一次就记住；本轮禁止相似变体。
- 只做方案时验证应聚焦路径级 whitespace、必备章节、inline JS、浏览器/Playwright；不运行产品 build。

## Research Findings
- 待填充。

## Technical/Design Decisions
| Decision | Rationale |
|----------|-----------|
| 先从真实 Reminder 选择，若无再综合取题 | 严格遵守用户的候选优先级 |
| Demo 用单文件 HTML/CSS/JS | 可直接打开、避免 React/Babel 网络依赖，适合 docs 原型 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 复合 shell 输出超过工具呈现上限 | 拆分读取并只在此文件保存关键结论 |

## Resources
- `/Users/Esone/git/personal-ai/AGENT.md`
- `/Users/Esone/.codex/automations/automation-2/memory.md`

## Visual/Browser Findings
- 待填充。
