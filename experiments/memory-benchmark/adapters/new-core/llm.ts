import type { NewCoreModelsConfig } from "./config.js";

export interface LlmCallRecord {
  tier: "main" | "fast" | "judge";
  label: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  cached_replay: boolean;
  at_virtual: string;
}

export interface SharedCostLedger {
  totalUsd(): number;
  reserve(worstCaseUsd: number): boolean;
  settle(record: LlmCallRecord, releasedReserveUsd?: number): void;
  snapshot(): LlmCallRecord[];
}

export class InMemoryCostLedger implements SharedCostLedger {
  private records: LlmCallRecord[] = [];
  private reserved = 0;

  constructor(
    private maxUsd: number,
    existingRecords: LlmCallRecord[] = [],
  ) {
    this.records = [...existingRecords];
  }

  totalUsd(): number {
    const spent = this.records.reduce((s, r) => s + r.cost_usd, 0);
    return spent + this.reserved;
  }

  reserve(worstCaseUsd: number): boolean {
    const spent = this.records.reduce((s, r) => s + r.cost_usd, 0);
    if (spent + this.reserved + worstCaseUsd > this.maxUsd) return false;
    this.reserved += worstCaseUsd;
    return true;
  }

  settle(record: LlmCallRecord, releasedReserveUsd?: number): void {
    const release = releasedReserveUsd ?? record.cost_usd;
    this.reserved = Math.max(0, this.reserved - release);
    this.records.push(record);
  }

  snapshot(): LlmCallRecord[] {
    return [...this.records];
  }
}

export interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** OpenRouter chat completion; returns null when key missing (caller uses heuristic). */
export async function openRouterChat(
  config: NewCoreModelsConfig,
  tier: "main" | "fast" | "judge",
  system: string,
  user: string,
  ledger: SharedCostLedger,
  label: string,
  atVirtual: string,
  worstCaseUsd = 0.05,
): Promise<string | null> {
  if (process.env.VITEST === "true") return null;
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  if (!ledger.reserve(worstCaseUsd)) return null;

  const tierCfg = config[tier];
  const t0 = performance.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://personal-ai.local/memory-benchmark",
      "X-Title": "memory-benchmark-scheme-B",
    },
    body: JSON.stringify({
      model: tierCfg.model,
      temperature: tierCfg.temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const latency_ms = performance.now() - t0;
  if (!res.ok) {
    ledger.settle(
      {
        tier,
        label: `${label}:http_${res.status}`,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        latency_ms,
        cached_replay: false,
        at_virtual: atVirtual,
      },
      worstCaseUsd,
    );
    return null;
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: OpenRouterUsage;
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const inTok = json.usage?.prompt_tokens ?? Math.ceil((system.length + user.length) / 4);
  const outTok = json.usage?.completion_tokens ?? Math.ceil(text.length / 4);
  const cost_usd = estimateOpenRouterCost(tierCfg.model, inTok, outTok);
  ledger.settle(
    {
      tier,
      label,
      input_tokens: inTok,
      output_tokens: outTok,
      cost_usd,
      latency_ms,
      cached_replay: false,
      at_virtual: atVirtual,
    },
    worstCaseUsd,
  );
  return text;
}

function estimateOpenRouterCost(model: string, inputTokens: number, outputTokens: number): number {
  const inPerM = model.includes("flash") ? 0.1 : 0.5;
  const outPerM = model.includes("flash") ? 0.3 : 1.5;
  return (inputTokens / 1_000_000) * inPerM + (outputTokens / 1_000_000) * outPerM;
}
