import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/** Load ignored `experiments/memory-benchmark/.env` once (OPENROUTER_API_KEY only). */
export function loadBenchmarkDotenv(): void {
  if (loaded) return;
  loaded = true;
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "../../.env");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function openRouterKeyPresent(): boolean {
  loadBenchmarkDotenv();
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
