# LLM 采样参数兼容策略

*最后更新: 2026-07-31*

统一约束 Personal AI 所有 LLM 出站请求里的 `temperature` / `top_p` 与 token 上限字段，
避免换成推理型模型后整条链路 400。

## 要解决的问题

推理型模型不接受自定义采样参数。命中时 API 直接报错：

```json
{
  "error": {
    "message": "Unsupported value: 'temperature' does not support 0.3 with this model. Only the default (1) value is supported.",
    "type": "invalid_request_error",
    "param": "temperature",
    "code": "unsupported_value"
  }
}
```

历史上 `temperature` 是写死在 provider handler 里的（扩展侧 `0.3`、memory-service 侧
`DEFAULT_TEMPERATURE = 0.3`），业务调用方并不传，所以只要 `OPENAI_MODEL` 换成
`o3-mini` / `gpt-5-mini` 这类模型，**所有**走该 handler 的请求都会失败。

## 实现位置

| 构建树 | 策略模块 | 接入点 |
|---|---|---|
| 扩展 | `src/modelSampling.ts` | `src/llm.ts`（OpenAI / Groq / Ollama handler、`OpenAIChat` / `GroqChat` / `OllamaChat`）、`src/meeting-shell/meetingOffscreen.ts` |
| memory-service | `memory-service/src/llm/modelSampling.ts` | `memory-service/src/llm/LLMClient.ts`（阻塞与流式的 OpenAI 兼容路径、Ollama 路径） |

两份实现逻辑等价，因为两个构建树互相不可见；**改一份必须同步另一份**。

## 判定规则

先做网关前缀归一化（`openai/o3-mini` → `o3-mini`、`us.anthropic.claude-opus-4-7` →
`claude-opus-4-7`、`vertex_ai/claude-opus-4-7@default` → `claude-opus-4-7`），再匹配：

| 模型族 | 示例 | 处理 |
|---|---|---|
| OpenAI o-series | `o1`、`o1-mini`、`o3`、`o3-mini`、`o3-pro`、`o4-mini` | 省略 `temperature` / `top_p`，`max_tokens` → `max_completion_tokens` |
| OpenAI gpt-5 推理 | `gpt-5`、`gpt-5-mini`、`gpt-5-nano`、`gpt-5.1` | 同上 |
| Anthropic Opus 4.7+ | `claude-opus-4-7`、`claude-opus-4-8` | 省略 `temperature` / `top_p`，保留 `max_tokens` |
| Claude 5 家族 | `claude-sonnet-5`、`claude-opus-5` | 同上 |

例外：`gpt-5-chat*`（如 `gpt-5-chat-latest`）走非推理路径，仍支持采样参数。

选择「整体省略」而不是「改成 1」，是因为各厂商判定口径不一致：OpenAI 按取值判定
（`temperature=1` 可过），Anthropic 按字段是否出现判定（出现即 400）。省略在两边都安全。

未识别的模型名（本地模型、私有网关模型）默认**保留**采样参数，不做保守降级。

## 场景温度预设

`SCENARIO_TEMPERATURE` 把温度按任务性质分档，调用方选场景而不是随手写数字：

| 场景 | 值 | 适用 |
|---|---|---|
| `extraction` | 0.1 | OCR、实体抽取、字段解析、分类打标 |
| `analysis` | 0.2 | 判定、打分、结构化分析、JSON 输出 |
| `summary` | 0.3 | 摘要、要点归纳、检索问答（未标注场景时的默认档） |
| `drafting` | 0.5 | 回复草稿、建议文案、改写 |
| `conversation` | 0.7 | 多轮对话、开放问答 |
| `creative` | 0.9 | 发散联想、记忆重放、多样化生成 |

优先级：显式 `temperature` > `scenario` > 默认档。受限模型下三者都不下发。

扩展侧调用方可在 `handleLLMRequest` / `callLLMJsonAPI` 的 body 里带 `scenario`，
memory-service 侧在 `LLMOptions.scenario` 里带。

## 验证

```bash
npm run verify:model-sampling
```

覆盖受限模型矩阵、网关前缀归一化、场景预设优先级，以及 `LLMClient` 出站 body 里
`temperature` / `top_p` / `max_completion_tokens` 的实际取舍。

## 参考

- [OpenAI Community: GPT-5 models - Temperature](https://community.openai.com/t/gpt-5-models-temperature/1337957)
- [OpenAI Community: o3-mini unsupported parameter temperature](https://community.openai.com/t/o3-mini-unsupported-parameter-temperature/1140846)
- [Anthropic Claude migration guide](https://platform.claude.com/docs/en/about-claude/models/migration-guide)
