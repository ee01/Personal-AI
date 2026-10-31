import { describe, expect, it } from "vitest";
import { resolveBenchmarkRunContext } from "../src/cost/proxy-attribution.js";

describe("proxy run attribution", () => {
  it("prefers X-Benchmark-Run header over active window", () => {
    const ctx = resolveBenchmarkRunContext({
      headers: {
        "x-benchmark-run": "run-header",
        "x-benchmark-scheme": "B",
      },
      embedded: {
        run_id: "run-embedded",
        scheme_id: "A",
        ledger_path: "/tmp/a.jsonl",
      },
      activeRun: {
        run_id: "run-active",
        scheme_id: "D",
        ledger_path: "/tmp/d.jsonl",
        started_at: new Date().toISOString(),
      },
    });
    expect(ctx.run_id).toBe("run-header");
    expect(ctx.scheme_id).toBe("B");
    expect(ctx.attribution).toBe("header");
  });

  it("uses active window for D/E server calls without header", () => {
    const ctx = resolveBenchmarkRunContext({
      headers: {},
      embedded: null,
      activeRun: {
        run_id: "run-active",
        scheme_id: "D",
        ledger_path: "/tmp/d.jsonl",
        started_at: new Date().toISOString(),
      },
    });
    expect(ctx.run_id).toBe("run-active");
    expect(ctx.attribution).toBe("active_window");
  });
});
