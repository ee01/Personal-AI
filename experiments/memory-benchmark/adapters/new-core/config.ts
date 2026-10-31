import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface ModelTierConfig {
  provider: string;
  model: string;
  temperature: number;
}

export interface NewCoreModelsConfig {
  scheme_id: string;
  main: ModelTierConfig & { base_url?: string };
  fast: ModelTierConfig & { base_url?: string };
  judge: ModelTierConfig & { base_url?: string };
  embedding: { provider: string; model: string; dimensions: number };
}

const DEFAULT_MODELS: NewCoreModelsConfig = {
  scheme_id: "B",
  main: { provider: "openrouter", model: "z-ai/glm-5.3", temperature: 0 },
  fast: { provider: "openrouter", model: "z-ai/glm-5.3-flash", temperature: 0 },
  judge: { provider: "openrouter", model: "anthropic/claude-sonnet-4", temperature: 0 },
  embedding: { provider: "local", model: "bge-m3", dimensions: 1024 },
};

export function loadModelsConfig(): NewCoreModelsConfig {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../config/models.json"),
    join(here, "../../../config/models.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<NewCoreModelsConfig>;
      return { ...DEFAULT_MODELS, ...raw, scheme_id: "B" };
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_MODELS;
}

export const SPEC_VERSION = "B-spec-1-preflight";
