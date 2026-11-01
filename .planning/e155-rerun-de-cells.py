#!/usr/bin/env python3
"""Rerun failed first-build D/E cells (does not mutate matrix-status.json)."""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
BENCH = ROOT / "experiments/memory-benchmark"
OUT = BENCH / "reports/run-2026-10-31-8h-v1"
EVENTS = ROOT / "memory-service/evals/personal-memory-dataset/raw-only/events.jsonl"
PROBES = ROOT / "memory-service/evals/personal-memory-dataset/raw-only/probes/development.v1.1.jsonl"
POLICY = BENCH / ".local/windowed-budget.json"
SCHEDULE = OUT / "schedule.json"
RERUNS = OUT / "reruns.jsonl"

DEFAULT_CELLS = [
    "first-build/D/build-1/w1",
    "first-build/D/build-1/w2",
    "first-build/D/build-1/w3",
    "first-build/D/build-1/w6",
    "first-build/E/build-1/w1",
    "first-build/E/build-1/w2",
    "first-build/E/build-1/w3",
    "first-build/E/build-1/w5",
    "first-build/E/build-1/w6",
    "first-build/E/build-1/w7",
]


def cell_as_of(cell_id: str) -> str:
    for row in json.loads(SCHEDULE.read_text()):
        if row["id"] == cell_id:
            return row["as_of"]
    raise KeyError(cell_id)


def run_cell(cell_id: str) -> dict:
    scheme = cell_id.split("/")[1]
    cell_out = OUT / cell_id
    cell_out.mkdir(parents=True, exist_ok=True)
    cli = cell_out / "cli.log"
    if cli.exists():
        n = 1
        while (cell_out / f"cli.failed-{n}.log").exists():
            n += 1
        cli.rename(cell_out / f"cli.failed-{n}.log")

    run_id = "e155-8h-" + hashlib.sha256(cell_id.encode()).hexdigest()[:12]
    as_of = cell_as_of(cell_id)
    cmd = [
        "npx",
        "tsx",
        "src/cli/run-windowed.ts",
        "--scheme",
        scheme,
        "--events",
        str(EVENTS),
        "--probes",
        str(PROBES),
        "--as-of",
        as_of,
        "--strategy",
        "8h",
        "--ablation",
        "none",
        "--run-id",
        run_id,
        "--out",
        str(cell_out),
        "--hours",
        "8",
    ]
    env = os.environ.copy()
    env["MEMORY_BENCHMARK_BUDGET_POLICY"] = str(POLICY)
    env.setdefault("MEMORY_BENCHMARK_PROXY_URL", "http://127.0.0.1:4555/v1")
    started = time.monotonic()
    with cli.open("w") as log:
        proc = subprocess.run(cmd, cwd=BENCH, env=env, stdout=log, stderr=subprocess.STDOUT)
    report_path = cell_out / "report.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    rec = {
        "cell_id": cell_id,
        "scheme": scheme,
        "exit_code": proc.returncode,
        "seconds": time.monotonic() - started,
        "probes_run": report.get("probes_run", 0),
        "stopped_reason": report.get("stopped_reason"),
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    with RERUNS.open("a") as f:
        f.write(json.dumps(rec) + "\n")
    return rec


def main() -> None:
    cells = sys.argv[1:] if len(sys.argv) > 1 else DEFAULT_CELLS
    results = []
    for cid in cells:
        print(f"rerun {cid}...", flush=True)
        results.append(run_cell(cid))
        print(json.dumps(results[-1]), flush=True)
    ok = sum(1 for r in results if r["exit_code"] == 0 and r["probes_run"] == 8)
    print(json.dumps({"cells": len(results), "ok": ok, "results": results}))


if __name__ == "__main__":
    main()
