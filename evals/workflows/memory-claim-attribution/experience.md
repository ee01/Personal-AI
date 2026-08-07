# Memory Claim Attribution Experience Eval

本 suite 验证 Personal AI 是否真的在 claim 粒度分清“谁说的、怎么说的、验证到哪一步、允许进入哪一层记忆”，并在归属不确定或解析失败时保护画像、当前事实与承诺。它不是只检查 schema 是否存在，也不把整条 message 的 sender 当作所有子句的 owner。

## 用户场景

1. 用户把 AI 建议、同事转述、本人决定和上线假设写在同一段中；只有本人明确决定可以进入当前事实候选。
2. 会议里先出现负责人指派，随后才有用户接受；assigned 不能提前冒充 accepted，AI summary 不能冒充 verified completion。
3. 外部 AI 导入缺 sender/role，或归属解析器失败；raw 仍保存，但画像、事实和行动必须失败关闭。
4. 用户就地选择“这不是我的观点”；系统只追加 attribution revision 并失效后续权限，不修改原聊天。
5. 普通单一本人偏好继续静默处理，不给 Ask、Memory Lens 或 Compose 增加无意义徽章。

## 执行步骤

1. 从 `evals/cases/memory-claim-attribution/cases.jsonl` 读取中英混合的脱敏真实模式和 failure-path 红队样本。
2. 每个 case 在应用当前全部 migration 的隔离内存数据库中插入一条原始 message。
3. 调用生产 `ClaimSegmenter` / `MemoryClaimAttributionService` 生成 claim，并调用生产 `ClaimPolicyCompiler` 编译高责任 policy；不能在 eval 中重新实现归属规则。
4. failure case 使用受控失败注入验证 attribution status 与 raw/policy 边界；不得把异常改判为通过。
5. correction case 调用生产 `MemoryClaimCorrectionService`，比较 revision 前后 claim、raw content/hash 和响应中的 `rawSourceChanged`。
6. 调用生产 attribution receipt builder，验证 mixed/downgraded/corrected 才返回 compact/review，普通单一 self 消息保持无回执。
7. 对 claim span、owner/mode/commitment/verification、policy、revision、raw 不变和 receipt visibility 做确定性判分，并保存 request/response/judge artifacts。

## 通过标准

- mixed message 生成独立 claim spans；parent `ownerAuthored=true` 不会把 AI、他人和 hypothesis 子句升级为 self。
- AI suggestion、reported speech、hypothesis 与 unknown owner 的 `profileCandidate/currentTruthCandidate/actionCandidate` 均为 false。
- assigned 与 accepted 分离；只有明确 `self + commitment + accepted` 可以成为 action candidate。
- 没有独立 connector receipt 时，任何措辞或 AI summary 都不能成为 `verified_completion`。
- resolver failure 保留 raw，并把高责任候选计数保持为 0；不能回退为全段 self。
- correction 增加 revision、加入 `user_correction` signal、关闭不再允许的 policy，且 raw 逐字不变、`rawSourceChanged=false`。
- 单一明确 self claim 不产生 attribution receipt；mixed、blocked 或 corrected 场景才产生可理解的低打扰回执。

## Judge 选择

本 suite 使用确定性 heuristic，不使用 LLM judge。被验证的是生产 segmenter、policy compiler、repository/correction transaction 与 receipt builder 的结构化输出；这些 hard gate 不能依赖另一轮模型主观打分。样本中的语义类别来自人工复核的脱敏场景，开放域语言覆盖仍由后续真实样本扩充。

## Report Requirements

- 使用共享 Reader Contract 渲染，不新增 suite 专属 HTML。
- 每个 case 展示脱敏输入、实际 claim spans、owner/mode/verification/commitment、四项 policy、message attribution status 与 receipt visibility。
- mixed 与 meeting case 必须显示逐条 expectation 的 expected/actual；不能只给总体平均分。
- failure case 必须显示 raw 是否存在、高责任候选实际计数和 failure status，不能把异常或 runner error 当作 fail-closed 证明；没有可复核 claim 时不伪造归属回执。
- correction case 必须显示 revision、correction signal、raw before/after hash/content equality 和 `rawSourceChanged`。
- readerProof 只引用本次真实执行的 case 和 0–3 分 score；报告契约完整度不能冒充功能证明。
- 明确说明本 suite 使用本地隔离数据库和脱敏样本，不证明线上全部语言分布、真实 UI 点击链路或远端 connector 当前可用。

## 运行命令

```bash
npm run eval:validate
npm run eval:memory-claim-attribution
npm run eval:run -- --suite memory-claim-attribution --no-repair
npm run eval:run -- --case correction-not-my-view-preserves-raw --no-repair
```
