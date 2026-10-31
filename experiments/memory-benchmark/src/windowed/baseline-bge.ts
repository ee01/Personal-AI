import { createRequire } from "node:module";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { strictEmbed, strictEmbedBatch } from "./history.js";
import type { MemoryBenchmarkAdapter } from "../types.js";

/** Process-local benchmark configuration; production source and storage are untouched. */
export async function configureBaselineBge(adapter: MemoryBenchmarkAdapter) {
  process.env.EMBEDDING_MODEL = "bge-m3";
  process.env.EMBEDDING_DIMENSION = "1024";
  process.env.MEMORY_READ_V3_VECTOR = "";
  const clientPath = resolve("../../memory-service/src/llm/EmbeddingClient.js");
  const { EmbeddingClient } = await import(clientPath);
  EmbeddingClient.getInstance = async () => ({ embed: strictEmbed, embedBatch: strictEmbedBatch });
  EmbeddingClient.getModelName = () => "bge-m3";
  EmbeddingClient.isLoaded = () => true;
  await (adapter as MemoryBenchmarkAdapter & { init(): Promise<void> }).init();
  const path = resolve(".local/baseline-data/users/benchmark-scheme-a/memory.db");
  const db = new Database(path);
  try {
    const require = createRequire(resolve("../../memory-service/package.json"));
    db.loadExtension(require("sqlite-vec").getLoadablePath());
    const count = db.prepare("SELECT count(*) AS n FROM messages_raw").get() as { n: number };
    if (count.n) throw new Error("baseline_bge_requires_fresh_empty_database");
    db.exec(`DROP TABLE chunks_vec; DROP TABLE messages_vec;
      CREATE VIRTUAL TABLE chunks_vec USING vec0(chunk_id INTEGER PRIMARY KEY, embedding float[1024]);
      CREATE VIRTUAL TABLE messages_vec USING vec0(message_id TEXT PRIMARY KEY, embedding float[1024]);`);
  } finally { db.close(); }
}
