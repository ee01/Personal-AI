export interface OpenRouterKeyUsage {
  usage?: number;
  usage_daily?: number;
  limit?: number | null;
}

export async function fetchOpenRouterKeyUsage(apiKey: string): Promise<OpenRouterKeyUsage> {
  const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`openrouter_key_usage_http_${res.status}`);
  }
  const json = (await res.json()) as { data?: OpenRouterKeyUsage };
  return json.data ?? {};
}

export function usageDelta(before: OpenRouterKeyUsage, after: OpenRouterKeyUsage): number {
  const a = after.usage ?? 0;
  const b = before.usage ?? 0;
  return a - b;
}
