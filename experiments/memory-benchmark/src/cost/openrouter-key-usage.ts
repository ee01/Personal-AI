export interface OpenRouterKeyUsage {
  usage?: number;
  usage_daily?: number;
  limit?: number | null;
  effective_budget?: { spend_usd?: number };
}

export function keySpendUsd(snapshot: OpenRouterKeyUsage): number {
  const spend = snapshot.effective_budget?.spend_usd;
  if (typeof spend === "number" && Number.isFinite(spend)) return spend;
  return snapshot.usage ?? 0;
}

export async function fetchOpenRouterKeyUsage(apiKey: string): Promise<OpenRouterKeyUsage> {
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`openrouter_key_usage_http_${res.status}`);
  }
  const json = (await res.json()) as { data?: OpenRouterKeyUsage };
  return json.data ?? {};
}

export function usageDelta(before: OpenRouterKeyUsage, after: OpenRouterKeyUsage): number {
  return keySpendUsd(after) - keySpendUsd(before);
}
