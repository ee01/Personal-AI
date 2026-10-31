import http from "node:http";
import { URL } from "node:url";
import {
  appendProxyLedgerEntry,
  type ProxyLedgerEntry,
} from "./proxy-ledger.js";
import { loadModelsConfig } from "../../adapters/new-core/config.js";

const UPSTREAM = "https://openrouter.ai/api/v1";

function upstreamUrl(upstreamBase: string, clientPath: string): string {
  const path = clientPath.startsWith("/v1/") ? clientPath.slice(3) : clientPath;
  return `${upstreamBase.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface OpenRouterProxyOptions {
  runId: string;
  schemeId: string;
  ledgerPath: string;
  upstreamBase?: string;
  apiKey?: string;
}

export interface OpenRouterProxyHandle {
  baseUrl: string;
  port: number;
  ledgerPath: string;
  stop(): Promise<void>;
}

function tierFromHeaders(headers: http.IncomingHttpHeaders): string {
  const raw = headers["x-memory-benchmark-tier"];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() || "unknown";
}

function labelFromHeaders(headers: http.IncomingHttpHeaders): string {
  const raw = headers["x-memory-benchmark-label"];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() || "chat";
}

function parseCost(usage: Record<string, unknown> | undefined): number {
  if (!usage) return 0;
  for (const key of ["cost", "total_cost", "generation_cost"]) {
    const v = usage[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function inferTier(model: string | null): string {
  if (!model) return "unknown";
  try {
    const models = loadModelsConfig();
    if (model === models.fast.model || model.endsWith(models.fast.model)) return "fast";
    if (model === models.main.model || model.endsWith(models.main.model)) return "main";
    if (model === models.judge.model || model.endsWith(models.judge.model)) return "judge";
  } catch {
    /* ignore */
  }
  if (/flash/i.test(model)) return "fast";
  return "main";
}

async function fetchGenerationCost(
  apiKey: string,
  upstreamBase: string,
  generationId: string,
): Promise<{
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  model: string | null;
}> {
  const res = await fetch(
    `${upstreamBase.replace(/\/+$/, "")}/generation?id=${encodeURIComponent(generationId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    return { cost_usd: 0, input_tokens: 0, output_tokens: 0, model: null };
  }
  const json = (await res.json()) as {
    data?: {
      total_cost?: number;
      tokens_prompt?: number;
      tokens_completion?: number;
      model?: string;
    };
  };
  const data = json.data;
  return {
    cost_usd: typeof data?.total_cost === "number" ? data.total_cost : 0,
    input_tokens: data?.tokens_prompt ?? 0,
    output_tokens: data?.tokens_completion ?? 0,
    model: data?.model ?? null,
  };
}

function recordFromJsonBody(
  opts: OpenRouterProxyOptions,
  path: string,
  tier: string,
  label: string,
  streaming: boolean,
  json: Record<string, unknown>,
  requestModel: string | null,
  apiKey: string,
  upstreamBase: string,
): Promise<void> {
  return (async () => {
    const usage = json.usage as Record<string, unknown> | undefined;
    let generation_id = typeof json.id === "string" ? json.id : null;
    let model = typeof json.model === "string" ? json.model : requestModel;
    let input_tokens = Number(usage?.prompt_tokens ?? 0) || 0;
    let output_tokens = Number(usage?.completion_tokens ?? 0) || 0;
    let cost_usd = parseCost(usage);

    if (generation_id && cost_usd === 0) {
      const enriched = await fetchGenerationCost(apiKey, upstreamBase, generation_id);
      cost_usd = enriched.cost_usd;
      input_tokens = enriched.input_tokens || input_tokens;
      output_tokens = enriched.output_tokens || output_tokens;
      model = enriched.model ?? model;
    }

    const resolvedTier = tier === "unknown" ? inferTier(model) : tier;
    const entry: ProxyLedgerEntry = {
      at: new Date().toISOString(),
      scheme_id: opts.schemeId,
      run_id: opts.runId,
      tier: resolvedTier,
      label,
      generation_id,
      model,
      input_tokens,
      output_tokens,
      cost_usd,
      path,
      streaming,
    };
    appendProxyLedgerEntry(opts.ledgerPath, entry);
  })();
}

async function forwardNonStreaming(
  opts: OpenRouterProxyOptions,
  targetPath: string,
  tier: string,
  label: string,
  bodyJson: Record<string, unknown>,
  apiKey: string,
  upstreamBase: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const injected = {
    ...bodyJson,
    usage: { include: true, ...(bodyJson.usage as object | undefined) },
  };
  const requestModel = typeof bodyJson.model === "string" ? bodyJson.model : null;
  const res = await fetch(upstreamUrl(upstreamBase, targetPath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://personal-ai.local/memory-benchmark",
      "X-Title": "memory-benchmark-openrouter-proxy",
    },
    body: JSON.stringify(injected),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    await recordFromJsonBody(
      opts,
      targetPath,
      tier,
      label,
      false,
      json,
      requestModel,
      apiKey,
      upstreamBase,
    );
  } catch {
    /* non-json error body */
  }
  const headers: Record<string, string> = {
    "Content-Type": res.headers.get("content-type") ?? "application/json",
  };
  return { status: res.status, headers, body: text };
}

async function forwardStreaming(
  opts: OpenRouterProxyOptions,
  targetPath: string,
  tier: string,
  label: string,
  bodyJson: Record<string, unknown>,
  apiKey: string,
  upstreamBase: string,
  res: http.ServerResponse,
): Promise<void> {
  const injected = {
    ...bodyJson,
    stream: true,
    stream_options: { include_usage: true, ...(bodyJson.stream_options as object | undefined) },
    usage: { include: true, ...(bodyJson.usage as object | undefined) },
  };
  const requestModel = typeof bodyJson.model === "string" ? bodyJson.model : null;
  const upstream = await fetch(upstreamUrl(upstreamBase, targetPath), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://personal-ai.local/memory-benchmark",
      "X-Title": "memory-benchmark-openrouter-proxy",
    },
    body: JSON.stringify(injected),
  });

  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastData: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    res.write(chunk);

    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        lastData = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
    }
  }
  res.end();

  if (lastData) {
    await recordFromJsonBody(
      opts,
      targetPath,
      tier,
      label,
      true,
      lastData,
      requestModel,
      apiKey,
      upstreamBase,
    );
  }
}

export async function startOpenRouterProxy(
  options: OpenRouterProxyOptions,
): Promise<OpenRouterProxyHandle> {
  const upstreamBase = (options.upstreamBase ?? UPSTREAM).replace(/\/+$/, "");
  const apiKey =
    options.apiKey?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST" && req.method !== "GET") {
      res.writeHead(405);
      res.end("method_not_allowed");
      return;
    }

    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const targetPath = url.pathname + url.search;

    if (req.method === "GET") {
      if (!apiKey) {
        res.writeHead(503);
        res.end("missing_api_key");
        return;
      }
      try {
        const upstream = await fetch(upstreamUrl(upstreamBase, targetPath), {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const body = await upstream.text();
        res.writeHead(upstream.status, { "Content-Type": "application/json" });
        res.end(body);
      } catch (err) {
        res.writeHead(502);
        res.end(String((err as Error).message));
      }
      return;
    }

    if (!apiKey) {
      res.writeHead(503);
      res.end("missing_api_key");
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");
    let bodyJson: Record<string, unknown> = {};
    try {
      bodyJson = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      res.writeHead(400);
      res.end("invalid_json");
      return;
    }

    const tier = tierFromHeaders(req.headers);
    const label = labelFromHeaders(req.headers);
    const streaming = bodyJson.stream === true;

    try {
      if (streaming) {
        await forwardStreaming(
          options,
          targetPath,
          tier,
          label,
          bodyJson,
          apiKey,
          upstreamBase,
          res,
        );
        return;
      }
      const forwarded = await forwardNonStreaming(
        options,
        targetPath,
        tier,
        label,
        bodyJson,
        apiKey,
        upstreamBase,
      );
      res.writeHead(forwarded.status, forwarded.headers);
      res.end(forwarded.body);
    } catch (err) {
      res.writeHead(502);
      res.end(String((err as Error).message));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("proxy_listen_failed");
  }

  const baseUrl = `http://127.0.0.1:${addr.port}/v1`;

  return {
    baseUrl,
    port: addr.port,
    ledgerPath: options.ledgerPath,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
