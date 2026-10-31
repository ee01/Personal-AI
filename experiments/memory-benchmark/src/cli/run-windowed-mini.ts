// Preserve the established continuous 7-day replay; apply the same benchmark-only
// baseline embedding configuration as the windowed runs before any ingestion.
import { BaselineSchemeAAdapter } from "../../adapters/baseline/baseline-adapter.js";
import { configureBaselineBge } from "../windowed/baseline-bge.js";
process.env.MEMORY_BENCHMARK_STRICT_BGE = "1";
const init = BaselineSchemeAAdapter.prototype.init;
const configured = new WeakSet<BaselineSchemeAAdapter>();
BaselineSchemeAAdapter.prototype.init = async function () {
  await init.call(this);
  if (!configured.has(this)) {
    configured.add(this);
    // Cached mini replay reopens populated storage and must preserve its schema.
    const freshArg = process.argv.indexOf("--fresh");
    if (freshArg < 0 || process.argv[freshArg + 1] !== "false") await configureBaselineBge(this);
  }
};
// The cache process must use the same embedding provider without resetting data.
// Install provider via the same helper only on live initialization; cache provider
// is set directly here because configureBaselineBge intentionally requires emptiness.
import { strictEmbed, strictEmbedBatch } from "../windowed/history.js";
import { resolve } from "node:path";
process.env.EMBEDDING_MODEL = "bge-m3";
process.env.EMBEDDING_DIMENSION = "1024";
process.env.MEMORY_READ_V3_VECTOR = "";
const { EmbeddingClient } = await import(resolve("../../memory-service/src/llm/EmbeddingClient.js"));
EmbeddingClient.getInstance = async () => ({ embed: strictEmbed, embedBatch: strictEmbedBatch });
EmbeddingClient.getModelName = () => "bge-m3";
EmbeddingClient.isLoaded = () => true;
await import("./run-benchmark.js");
