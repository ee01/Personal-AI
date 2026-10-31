#!/usr/bin/env node
/**
 * Foreground OpenRouter accounting proxy for memory-benchmark (E-167).
 * Start before D/E services and harness; set MEMORY_BENCHMARK_PROXY_URL for harness reuse.
 */
import { loadBenchmarkDotenv } from "../../adapters/mem0/load-env.js";
import {
  parseBenchmarkProxyPort,
  startStandaloneOpenRouterProxy,
} from "../cost/openrouter-proxy.js";

async function main() {
  loadBenchmarkDotenv();
  const port = parseBenchmarkProxyPort();
  const handle = await startStandaloneOpenRouterProxy({ port });
  console.error(
    `[memory-benchmark-proxy] listening ${handle.baseUrl} (port ${handle.port})`,
  );
  console.error(
    `[memory-benchmark-proxy] set MEMORY_BENCHMARK_PROXY_URL=${handle.baseUrl}`,
  );

  const shutdown = async () => {
    await handle.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await new Promise<void>(() => {
    /* run until signal */
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
