#!/usr/bin/env python3
"""E-155 recommended allocation: phase-1 full builds, phase-2 slice builds+ablations, phase-3 mini-7d."""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import random
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
BENCH = ROOT / "experiments/memory-benchmark"
DATE = os.environ.get("E155_RUN_DATE") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
OUT = BENCH / "reports" / f"run-{DATE}"
MINI_FIXTURE = "production-mini-7d"
MINI_STUB_VALIDATE = BENCH / "fixtures/production-mini-7d/validate-replay.ts"
EVENTS = ROOT / "memory-service/evals/personal-memory-dataset/raw-only/events.jsonl"
PROBES = ROOT / "memory-service/evals/personal-memory-dataset/raw-only/probes/development.v1.1.jsonl"
AUTHORITY = BENCH / "fixtures/synthetic-mini/authority.json"
SLICE_EVENTS = OUT / "slice-events.jsonl"
SLICE_MANIFEST = OUT / "slice-manifest.json"
PROGRESS_PATH = OUT / "matrix-progress.json"
STATUS_PATH = OUT / "matrix-status.json"
MANIFEST_PATH = OUT / "runs.jsonl"

SCHEMES = ["A", "B", "C", "D", "E"]
TOTAL_BUDGET_SOFT = float(os.environ.get("E155_TOTAL_BUDGET", "300"))
STOP_PROXY_USD = float(os.environ.get("E155_STOP_PROXY_USD", "290"))
PHASE1_SCHEME_SOFT = float(os.environ.get("E155_PHASE1_SCHEME_SOFT", "60"))
PHASE1_STOP_USD = float(os.environ.get("E155_PHASE1_STOP_USD", "220"))
HARNESS_BUDGET_USD = float(os.environ.get("E155_HARNESS_BUDGET", "999"))
SLICE_SEED = int(os.environ.get("E155_SLICE_SEED", "15520261031"))
PILOT_USD_PER_CALL = float(os.environ.get("E155_PILOT_USD_PER_CALL", "0.0015"))
EVENTS_COUNT = int(os.environ.get("E155_EVENTS_COUNT", "14892"))

ABLATIONS = [
    "raw_hybrid_only",
    "no_background_consolidation",
    "no_link_precalc",
]
ABLATION_SCHEMES = ["A", "B"]

GATE_REPORTS: dict[str, pathlib.Path] = {
    "A": BENCH / "reports/e155-intraday-gates-2026-10-31/scheme-A.json",
    "B": BENCH / "reports/e155-intraday-gates-2026-10-31/scheme-B.json",
    "C": BENCH / "reports/e155-intraday-gates-2026-10-31/scheme-C.json",
    "D": BENCH / "reports/e155-d-e-gates-2026-10-31/D/scheme-D.json",
    "E": BENCH / "reports/e155-d-e-gates-2026-10-31/E/scheme-E.json",
}
REQUIRED_GATES = ("future_evidence_hard", "intraday_derived_as_of")

SCHEME_FILTER = [s.upper() for s in sys.argv[1:] if s.upper() in SCHEMES] or SCHEMES

PROXY_URL = os.environ.get("MEMORY_BENCHMARK_PROXY_URL", "http://127.0.0.1:4555/v1")
PROXY_ROOT = PROXY_URL.replace("/v1", "").rstrip("/")


def proxy_healthy() -> bool:
    try:
        req = urllib.request.Request(f"{PROXY_ROOT}/v1/models")
        with urllib.request.urlopen(req, timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def ensure_proxy_running() -> None:
    """Proxy must be up (launchd) before matrix starts."""
    run_preflight()


def wait_for_proxy() -> None:
    for _ in range(30):
        if proxy_healthy() and proxy_active_run_ok():
            return
        time.sleep(1)
    raise RuntimeError("proxy_unreachable")


def phase1_complete(state: dict, clearance: dict[str, dict]) -> bool:
    for scheme in SCHEME_FILTER:
        if not clearance.get(scheme, {}).get("ok"):
            continue
        if not cell_done(state, f"phase1:{scheme}:build-1:full"):
            return False
    return True


def load_key() -> str:
    envfile = BENCH / ".env"
    for line in envfile.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == "OPENROUTER_API_KEY":
            return v.strip().strip('"').strip("'")
    raise SystemExit("OPENROUTER_API_KEY missing in experiments/memory-benchmark/.env")


def snapshot(key: str) -> dict:
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/auth/key",
        headers={"Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    d = data.get("data", data)
    spend = d.get("effective_budget", {}).get("spend_usd")
    if spend is None:
        spend = d.get("usage")
    return {"spend_usd": spend, "raw": {k: d.get(k) for k in ("usage", "usage_daily", "limit_remaining")}}


def load_progress() -> dict:
    if PROGRESS_PATH.is_file():
        return json.loads(PROGRESS_PATH.read_text())
    return {
        "completed_cells": [],
        "failed_cells": [],
        "cumulative_proxy_usd": 0.0,
        "phase1_proxy_usd": 0.0,
        "stopped_at": None,
        "stop_reason": None,
    }


def save_progress(state: dict) -> None:
    PROGRESS_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n")


def cell_done(state: dict, cell_id: str) -> bool:
    return cell_id in state.get("completed_cells", [])


def mark_cell(state: dict, cell_id: str) -> None:
    cells = state.setdefault("completed_cells", [])
    if cell_id not in cells:
        cells.append(cell_id)


def mark_failed_cell(state: dict, cell_id: str, rec: dict) -> None:
    failed = state.setdefault("failed_cells", [])
    failed.append(
        {
            "cell_id": cell_id,
            "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "exit_code": rec.get("exit_code"),
            "scheme": rec.get("scheme"),
            "phase": rec.get("phase"),
        },
    )


def log_event(event: str, **fields: object) -> None:
    payload = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": event,
        **fields,
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def supermemory_reachable() -> bool:
    try:
        req = urllib.request.Request("http://127.0.0.1:6767/health")
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status < 500
    except urllib.error.HTTPError as e:
        return e.code < 500
    except Exception:
        return False


def letta_reachable() -> bool:
    try:
        with socket.create_connection(("127.0.0.1", 4500), timeout=5):
            return True
    except OSError:
        return False


def proxy_active_run_ok() -> bool:
    body = json.dumps(
        {
            "run_id": "preflight-probe",
            "scheme_id": "A",
            "ledger_path": str(BENCH / ".local/proxy-ledger/preflight-probe.jsonl"),
        },
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{PROXY_ROOT}/_benchmark/active-run",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status == 200
    except Exception:
        return False


def run_preflight() -> None:
    errors: list[str] = []
    if not proxy_healthy():
        errors.append("proxy_models_unreachable")
    elif not proxy_active_run_ok():
        errors.append("proxy_active_run_failed")
    if not supermemory_reachable():
        errors.append("supermemory_unreachable")
    if not letta_reachable():
        errors.append("letta_unreachable")
    if errors:
        log_event("preflight_failed", errors=errors)
        raise SystemExit(1)
    log_event("preflight_ok")


def stop_phase_zero_success(state: dict, phase: int) -> None:
    state["stop_reason"] = f"phase{phase}_zero_successful_cells"
    state["stopped_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    save_progress(state)
    write_matrix_status(
        {
            "stopped": True,
            "stop_reason": state["stop_reason"],
            "phase": phase,
            "completed_cells": state.get("completed_cells"),
            "failed_cells": state.get("failed_cells"),
        },
    )

def gate_clearance() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for scheme in SCHEMES:
        path = GATE_REPORTS.get(scheme)
        rec = {"ok": True, "gates": {}, "report": str(path.relative_to(ROOT)) if path else None}
        if not path or not path.is_file():
            rec["ok"] = scheme in ("A", "B", "C")
            rec["note"] = "missing_gate_report_assumed_ok_for_abc" if rec["ok"] else "missing_gate_report"
            out[scheme] = rec
            continue
        report = json.loads(path.read_text())
        gates = {g["gate"]: g for g in report.get("gates", [])}
        rec["gates"] = {g: gates.get(g, {}).get("ok") for g in REQUIRED_GATES}
        rec["ok"] = all(rec["gates"].get(g) is True for g in REQUIRED_GATES) and not report.get("skipped")
        out[scheme] = rec
    return out


def storyline_key(event: dict) -> str:
    gid = event.get("group_id") or ""
    tr = event.get("thread_root") or ""
    return f"{gid}:{tr}"


def load_probes() -> list[dict]:
    probes: list[dict] = []
    with PROBES.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                probes.append(json.loads(line))
    return probes


def build_slice_manifest() -> dict:
    if SLICE_MANIFEST.is_file() and SLICE_EVENTS.is_file():
        return json.loads(SLICE_MANIFEST.read_text())

    probes = load_probes()
    evidence_ids: set[str] = set()
    storyline_keys: set[str] = set()
    for p in probes:
        for eid in p.get("visible_evidence_ids") or []:
            evidence_ids.add(eid)
        sk = p.get("storyline_key")
        if sk:
            storyline_keys.add(sk)

    events_by_id: dict[str, dict] = {}
    all_events: list[dict] = []
    with EVENTS.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            ev = json.loads(line)
            all_events.append(ev)
            events_by_id[ev["event_id"]] = ev
            if ev["event_id"] in evidence_ids:
                storyline_keys.add(storyline_key(ev))

    closure: set[str] = set()
    for ev in all_events:
        if storyline_key(ev) in storyline_keys:
            closure.add(ev["event_id"])
    for eid in evidence_ids:
        if eid in events_by_id:
            closure.add(eid)

    closure_events = [events_by_id[eid] for eid in closure if eid in events_by_id]
    if not closure_events:
        raise SystemExit("slice closure empty — check probes/events paths")

    times = [ev["observed_at"] for ev in closure_events]
    t_min, t_max = min(times), max(times)
    pool = [
        ev
        for ev in all_events
        if ev["event_id"] not in closure and t_min <= ev["observed_at"] <= t_max
    ]
    rng = random.Random(SLICE_SEED)
    n_distractors = min(len(pool), len(closure) * 3)
    distractors = rng.sample(pool, n_distractors) if n_distractors else []
    selected_ids = sorted(closure | {ev["event_id"] for ev in distractors})
    id_blob = "\n".join(selected_ids).encode("utf-8")
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seed": SLICE_SEED,
        "probes_file": str(PROBES.relative_to(ROOT)),
        "probe_count": len(probes),
        "closure_event_count": len(closure),
        "distractor_count": len(distractors),
        "total_event_count": len(selected_ids),
        "observed_at_window": [t_min, t_max],
        "storyline_keys": sorted(storyline_keys),
        "event_ids": selected_ids,
        "event_ids_sha256": hashlib.sha256(id_blob).hexdigest(),
    }
    SLICE_MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    id_set = set(selected_ids)
    with SLICE_EVENTS.open("w", encoding="utf-8") as out_f:
        for ev in all_events:
            if ev["event_id"] in id_set:
                out_f.write(json.dumps(ev, ensure_ascii=False) + "\n")
    return manifest


def write_matrix_status(extra: dict) -> None:
    status = {
        "issue": "E-155",
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_date": DATE,
        "out_dir": str(OUT.relative_to(ROOT)),
        **extra,
    }
    STATUS_PATH.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n")


def append_manifest(rec: dict) -> None:
    with MANIFEST_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def write_cost_snapshot(label: str, records: list[dict], state: dict) -> None:
    usd = [r.get("proxy_usd") for r in records if r.get("proxy_usd") is not None]
    payload = {
        "label": label,
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "runs": records,
        "cumulative_proxy_usd": state.get("cumulative_proxy_usd"),
        "phase1_proxy_usd": state.get("phase1_proxy_usd"),
        "budget": {
            "total_soft": TOTAL_BUDGET_SOFT,
            "stop_at_proxy_usd": STOP_PROXY_USD,
            "phase1_stop_at": PHASE1_STOP_USD,
            "phase1_per_scheme_soft": PHASE1_SCHEME_SOFT,
        },
        "projection": {
            "remaining_proxy_usd_before_stop": max(0, STOP_PROXY_USD - (state.get("cumulative_proxy_usd") or 0)),
        },
    }
    path = OUT / f"cost-snapshot-{label}.json"
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def apply_run_cost(state: dict, rec: dict, *, phase1: bool = False) -> list[str]:
    warnings: list[str] = []
    usd = rec.get("proxy_usd") or 0.0
    if rec.get("counts_toward_inference", True):
        state["cumulative_proxy_usd"] = round(state.get("cumulative_proxy_usd", 0) + usd, 4)
        if phase1:
            state["phase1_proxy_usd"] = round(state.get("phase1_proxy_usd", 0) + usd, 4)
    scheme = rec.get("scheme")
    if phase1 and scheme and usd > PHASE1_SCHEME_SOFT:
        warnings.append(f"phase1_scheme_soft_exceeded:{scheme}:{usd:.2f}>{PHASE1_SCHEME_SOFT}")
        rec["soft_cap_warning"] = warnings[-1]
    if state["cumulative_proxy_usd"] >= STOP_PROXY_USD:
        state["stopped_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        state["stop_reason"] = f"total_proxy_usd>={STOP_PROXY_USD}"
    return warnings


def should_stop(state: dict) -> bool:
    return bool(state.get("stop_reason"))


DETERMINISTIC_FAILURE_MARKERS = (
    "database connection is not open",
    "the database connection is not open",
    "sqlite error",
    "typeerror:",
    "referenceerror:",
)

NETWORK_FAILURE_MARKERS = (
    "econnrefused",
    "econnreset",
    "etimedout",
    "enotfound",
    "fetch failed",
    "network error",
    "proxy_unreachable",
    "socket hang up",
    "502 bad gateway",
    "503 service unavailable",
)


def harness_cli_log_path(
    scheme: str,
    build: int,
    *,
    ablation: str | None = None,
    out_subdir: str | None = None,
) -> pathlib.Path:
    if ablation:
        out_dir = OUT / "ablations" / scheme / ablation
    elif out_subdir and "/" in out_subdir:
        out_dir = OUT / out_subdir
    elif out_subdir:
        out_dir = OUT / scheme / out_subdir
    else:
        out_dir = OUT / scheme / f"build-{build}"
    return out_dir / "cli.log"


def read_harness_cli_log(
    scheme: str,
    build: int,
    *,
    ablation: str | None = None,
    out_subdir: str | None = None,
) -> str:
    cli = harness_cli_log_path(scheme, build, ablation=ablation, out_subdir=out_subdir)
    if cli.is_file():
        return cli.read_text(errors="replace")
    return ""


def harness_failure_is_deterministic(log_text: str) -> bool:
    lower = log_text.lower()
    return any(m in lower for m in DETERMINISTIC_FAILURE_MARKERS)


def harness_should_network_retry(log_text: str, exit_code: int | None) -> bool:
    if exit_code in (0, None):
        return False
    if harness_failure_is_deterministic(log_text):
        return False
    lower = log_text.lower()
    return any(m in lower for m in NETWORK_FAILURE_MARKERS)


def run_harness_with_retry_policy(
    *,
    scheme: str,
    build: int,
    key: str,
    cell_id: str,
    phase: str,
    fixture: str = "production-dev",
    events_path: pathlib.Path | None = None,
    fresh: bool = True,
    ablation: str | None = None,
    out_subdir: str | None = None,
) -> dict:
    rec = run_harness(
        scheme,
        build,
        key,
        ablation=ablation,
        out_subdir=out_subdir,
        fixture=fixture,
        events_path=events_path,
        fresh=fresh,
        phase=phase,
        cell_id=cell_id,
    )
    if rec.get("exit_code") in (0, None):
        return rec
    log_text = read_harness_cli_log(
        scheme, build, ablation=ablation, out_subdir=out_subdir
    )
    if harness_failure_is_deterministic(log_text):
        rec["retry_policy"] = "no_retry_deterministic"
        return rec
    if not harness_should_network_retry(log_text, rec.get("exit_code")):
        rec["retry_policy"] = "no_retry_non_network"
        return rec
    rec["attempt"] = 1
    append_manifest(rec)
    print(json.dumps(rec, ensure_ascii=False), flush=True)
    time.sleep(30)
    wait_for_proxy()
    rec2 = run_harness(
        scheme,
        build,
        key,
        ablation=ablation,
        out_subdir=out_subdir,
        fixture=fixture,
        events_path=events_path,
        fresh=fresh,
        phase=phase,
        cell_id=cell_id,
    )
    rec2["attempt"] = 2
    rec2["retry_policy"] = "network_retry_once"
    return rec2


def run_harness(
    scheme: str,
    build: int,
    key: str,
    *,
    ablation: str | None = None,
    out_subdir: str | None = None,
    fixture: str = "production-dev",
    events_path: pathlib.Path | None = None,
    fresh: bool = True,
    adapter_run_id: str | None = None,
    replay_kind: str | None = None,
    phase: str | None = None,
    cell_id: str | None = None,
) -> dict:
    if ablation:
        out_dir = OUT / "ablations" / scheme / ablation
    elif out_subdir and "/" in out_subdir:
        out_dir = OUT / out_subdir
    else:
        out_dir = OUT / scheme / (out_subdir or f"build-{build}")
    out_dir.mkdir(parents=True, exist_ok=True)
    rec = {
        "scheme": scheme,
        "build": build,
        "phase": phase,
        "cell_id": cell_id,
        "ablation": ablation or "none",
        "fixture": fixture,
        "events": str((events_path or EVENTS).relative_to(ROOT))
        if events_path is None or events_path.is_relative_to(ROOT)
        else str(events_path or EVENTS),
        "fresh": fresh,
        "adapter_run_id": adapter_run_id,
        "replay_kind": replay_kind,
        "started": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    rec["key_before"] = snapshot(key)
    wait_for_proxy()
    t0 = time.monotonic()
    env = os.environ.copy()
    env["MEMORY_BENCHMARK_PROXY_URL"] = PROXY_URL
    env.setdefault("MEMORY_BENCHMARK_PROXY_URL", PROXY_URL)
    ev_path = events_path or EVENTS
    cmd = [
        "npm",
        "run",
        "run",
        "--",
        "--scheme",
        scheme,
        "--out",
        str(out_dir),
        "--budget-usd",
        str(HARNESS_BUDGET_USD),
        "--fixture",
        fixture,
        "--events",
        str(ev_path),
        "--probes",
        str(PROBES),
        "--authority",
        str(AUTHORITY),
    ]
    if fixture == MINI_FIXTURE:
        cmd = [
            "npm",
            "run",
            "run",
            "--",
            "--scheme",
            scheme,
            "--out",
            str(out_dir),
            "--budget-usd",
            str(HARNESS_BUDGET_USD),
            "--fixture",
            MINI_FIXTURE,
        ]
    if not fresh:
        cmd.extend(["--fresh", "false"])
    if adapter_run_id:
        cmd.extend(["--adapter-run-id", adapter_run_id])
    if ablation:
        cmd.extend(["--ablation", ablation])
    p = subprocess.run(cmd, cwd=BENCH, text=True, capture_output=True, env=env)
    rec["elapsed_seconds"] = round(time.monotonic() - t0, 3)
    rec["exit_code"] = p.returncode
    log_path = out_dir / "cli.log"
    log_path.write_text(p.stdout + p.stderr)
    try:
        rec["key_after"] = snapshot(key)
    except Exception as e:
        rec["key_after_error"] = repr(e)
    prefix = f"{scheme}-run-"
    reports = sorted(out_dir.glob(f"{prefix}*.json"))
    if reports:
        rep = json.loads(reports[-1].read_text())
        rec["run_id"] = rep.get("run_id")
        rec["probes"] = f"{rep.get('probes_passed')}/{rep.get('probes_run')}"
        rec["proxy_usd"] = rep.get("cost", {}).get("proxy_usd")
        rec["live_inference_calls"] = rep.get("cost", {}).get("live_inference_calls")
        rec["cached_replay_calls"] = rep.get("cost", {}).get("cached_replay_calls")
        rec["generation_ids"] = rep.get("cost", {}).get("proxy_calls")
        rec["stopped_reason"] = rep.get("stopped_reason")
        rec["ablation_mode"] = rep.get("ablation_mode")
    rec["ended"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return rec


def run_mini_stub_schedule_gate() -> dict:
    rec = {
        "kind": "mini7d_stub_schedule",
        "fixture": MINI_FIXTURE,
        "started": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "proxy_usd": 0.0,
        "counts_toward_inference": False,
    }
    t0 = time.monotonic()
    p = subprocess.run(
        ["npx", "tsx", str(MINI_STUB_VALIDATE)],
        cwd=BENCH,
        text=True,
        capture_output=True,
    )
    rec["elapsed_seconds"] = round(time.monotonic() - t0, 3)
    rec["exit_code"] = p.returncode
    rec["ended"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    log_dir = OUT / "mini-7d" / "_harness"
    log_dir.mkdir(parents=True, exist_ok=True)
    (log_dir / "stub-schedule-validate.log").write_text(p.stdout + p.stderr)
    return rec


def run_phase1(key: str, state: dict, clearance: dict[str, dict]) -> None:
    phase_records: list[dict] = []
    for scheme in SCHEME_FILTER:
        if should_stop(state):
            break
        cell_id = f"phase1:{scheme}:build-1:full"
        if cell_done(state, cell_id):
            continue
        if not clearance.get(scheme, {}).get("ok"):
            skip = {
                "cell_id": cell_id,
                "scheme": scheme,
                "skipped": True,
                "skip_reason": "gate_precheck_failed",
                "clearance": clearance.get(scheme),
            }
            append_manifest(skip)
            save_progress(state)
            continue
        log_event("harness_start", cell_id=cell_id, scheme=scheme, phase="1", build=1)
        rec = run_harness_with_retry_policy(
            scheme=scheme,
            build=1,
            key=key,
            cell_id=cell_id,
            phase="1",
            fixture="production-dev",
        )
        if rec is None:
            continue
        if rec.get("exit_code") not in (0, None):
            rec["skipped_after_retries"] = True
            mark_failed_cell(state, cell_id, rec)
            append_manifest(rec)
            save_progress(state)
            continue
        apply_run_cost(state, rec, phase1=True)
        append_manifest(rec)
        print(json.dumps(rec, ensure_ascii=False), flush=True)
        mark_cell(state, cell_id)
        save_progress(state)
        phase_records.append(rec)
        write_matrix_status(
            {
                "phase": 1,
                "last_cell": cell_id,
                "cumulative_proxy_usd": state["cumulative_proxy_usd"],
                "gate_clearance": clearance,
            },
        )
        if state.get("phase1_proxy_usd", 0) >= PHASE1_STOP_USD:
            state["phase1_stopped_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
            state["phase1_stop_reason"] = f"phase1_proxy_usd>={PHASE1_STOP_USD}"
            save_progress(state)
            break
        if should_stop(state):
            break
        time.sleep(65)
    write_cost_snapshot("phase1-end", phase_records, state)
    if len(phase_records) == 0:
        stop_phase_zero_success(state, 1)


def run_phase2(key: str, state: dict, clearance: dict[str, dict]) -> None:
    if should_stop(state) or not phase1_complete(state, clearance):
        return
    if state.get("stop_reason"):
        return
    manifest = build_slice_manifest()
    slice_path = SLICE_EVENTS
    phase_records: list[dict] = []
    for build in (2, 3):
        if should_stop(state):
            break
        round_records: list[dict] = []
        for scheme in SCHEME_FILTER:
            if should_stop(state):
                break
            cell_id = f"phase2:{scheme}:build-{build}:slice"
            if cell_done(state, cell_id):
                continue
            if not clearance.get(scheme, {}).get("ok"):
                continue
            log_event("harness_start", cell_id=cell_id, scheme=scheme, phase="2", build=build)
            rec = run_harness(
                scheme,
                build,
                key,
                phase="2",
                cell_id=cell_id,
                fixture="production-dev",
                events_path=slice_path,
            )
            apply_run_cost(state, rec, phase1=False)
            append_manifest(rec)
            print(json.dumps(rec, ensure_ascii=False), flush=True)
            if rec.get("exit_code") not in (0, None):
                mark_failed_cell(state, cell_id, rec)
                state["stop_reason"] = "harness_exit_nonzero"
                state["stopped_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
                save_progress(state)
                break
            mark_cell(state, cell_id)
            save_progress(state)
            round_records.append(rec)
            phase_records.append(rec)
            write_matrix_status(
                {
                    "phase": 2,
                    "build": build,
                    "last_cell": cell_id,
                    "slice_manifest_sha256": manifest.get("event_ids_sha256"),
                    "cumulative_proxy_usd": state["cumulative_proxy_usd"],
                },
            )
            if should_stop(state):
                break
            time.sleep(65)
        write_cost_snapshot(f"phase2-build-{build}", round_records, state)
        if should_stop(state):
            break

    for scheme in ABLATION_SCHEMES:
        if scheme not in SCHEME_FILTER or should_stop(state):
            continue
        for ablation in ABLATIONS:
            cell_id = f"phase2:{scheme}:ablation:{ablation}:slice"
            if cell_done(state, cell_id):
                continue
            if not clearance.get(scheme, {}).get("ok"):
                continue
            rec = run_harness(
                scheme,
                0,
                key,
                ablation=ablation,
                phase="2",
                cell_id=cell_id,
                fixture="production-dev",
                events_path=slice_path,
            )
            apply_run_cost(state, rec, phase1=False)
            append_manifest(rec)
            print(json.dumps(rec, ensure_ascii=False))
            mark_cell(state, cell_id)
            save_progress(state)
            phase_records.append(rec)
            if should_stop(state):
                break
            time.sleep(65)
    write_cost_snapshot("phase2-end", phase_records, state)
    if len(phase_records) == 0:
        stop_phase_zero_success(state, 2)


def run_phase3(key: str, state: dict, clearance: dict[str, dict]) -> None:
    if should_stop(state) or os.environ.get("E155_SKIP_MINI_7D") == "1":
        return
    if state.get("stop_reason"):
        return
    phase3_ok = 0
    mini_manifest = OUT / "mini-7d.jsonl"
    stub_cell = "phase3:stub_schedule"
    if not cell_done(state, stub_cell):
        stub = run_mini_stub_schedule_gate()
        with mini_manifest.open("a", encoding="utf-8") as f:
            f.write(json.dumps(stub, ensure_ascii=False) + "\n")
        mark_cell(state, stub_cell)
        save_progress(state)
        if stub.get("exit_code") not in (0, None):
            return

    for scheme in SCHEME_FILTER:
        if should_stop(state):
            break
        if not clearance.get(scheme, {}).get("ok"):
            continue
        adapter_key = f"mini7d-{scheme}-{DATE}"
        live_cell = f"phase3:{scheme}:mini7d:live"
        if not cell_done(state, live_cell):
            log_event("harness_start", cell_id=live_cell, scheme=scheme, phase="3", replay="live")
            live = run_harness(
                scheme,
                0,
                key,
                out_subdir=f"mini-7d/{scheme}/live",
                fixture=MINI_FIXTURE,
                fresh=True,
                adapter_run_id=adapter_key,
                replay_kind="live_inference",
                phase="3",
                cell_id=live_cell,
            )
            live["counts_toward_inference"] = True
            apply_run_cost(state, live, phase1=False)
            with mini_manifest.open("a", encoding="utf-8") as f:
                f.write(json.dumps(live, ensure_ascii=False) + "\n")
            append_manifest(live)
            if live.get("exit_code") not in (0, None):
                mark_failed_cell(state, live_cell, live)
            else:
                mark_cell(state, live_cell)
                phase3_ok += 1
            save_progress(state)
            time.sleep(65)

        cache_cell = f"phase3:{scheme}:mini7d:cache"
        if not cell_done(state, cache_cell):
            log_event("harness_start", cell_id=cache_cell, scheme=scheme, phase="3", replay="cache")
            cache = run_harness(
                scheme,
                0,
                key,
                out_subdir=f"mini-7d/{scheme}/cache-replay",
                fixture=MINI_FIXTURE,
                fresh=False,
                adapter_run_id=adapter_key,
                replay_kind="cached_replay",
                phase="3",
                cell_id=cache_cell,
            )
            cache["counts_toward_inference"] = False
            with mini_manifest.open("a", encoding="utf-8") as f:
                f.write(json.dumps(cache, ensure_ascii=False) + "\n")
            append_manifest(cache)
            if cache.get("exit_code") not in (0, None):
                mark_failed_cell(state, cache_cell, cache)
            else:
                mark_cell(state, cache_cell)
                phase3_ok += 1
            save_progress(state)
            time.sleep(65)

    write_cost_snapshot("phase3-end", [], state)
    if phase3_ok == 0 and not cell_done(state, stub_cell):
        stop_phase_zero_success(state, 3)


def main() -> None:
    if os.environ.get("E155_DRY_RUN") == "1":
        print("dry-run: would write to", OUT)
        return
    key = load_key()
    OUT.mkdir(parents=True, exist_ok=True)
    ensure_proxy_running()
    state = load_progress()
    clearance = gate_clearance()
    key_start = snapshot(key)
    (OUT / "key-usage-start.json").write_text(json.dumps(key_start, indent=2) + "\n")
    plan = {
        "allocation": "recommended",
        "total_budget_soft_usd": TOTAL_BUDGET_SOFT,
        "stop_proxy_usd": STOP_PROXY_USD,
        "phase1": "full build-1 per scheme A→E",
        "phase2": "shared slice builds 2-3 + A/B ablations",
        "phase3": MINI_FIXTURE,
        "golden": "v1.1",
        "gate_clearance": clearance,
        "resume": {
            "progress_file": str(PROGRESS_PATH.relative_to(ROOT)),
            "completed_cells": len(state.get("completed_cells", [])),
        },
    }
    (OUT / "matrix-plan.json").write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n")
    write_matrix_status({"started": True, "plan": "recommended", "gate_clearance": clearance})
    log_event("matrix_start", out=str(OUT.relative_to(ROOT)))

    run_phase1(key, state, clearance)
    if should_stop(state) or state.get("stop_reason"):
        finalize_run(key, state)
        return
    run_phase2(key, state, clearance)
    if should_stop(state) or state.get("stop_reason"):
        finalize_run(key, state)
        return
    run_phase3(key, state, clearance)
    finalize_run(key, state)


def finalize_run(key: str, state: dict) -> None:
    key_end = snapshot(key)
    (OUT / "key-usage-end.json").write_text(json.dumps(key_end, indent=2) + "\n")
    write_matrix_status(
        {
            "finished": not state.get("stop_reason"),
            "stopped": bool(state.get("stop_reason")),
            "stop_reason": state.get("stop_reason"),
            "cumulative_proxy_usd": state.get("cumulative_proxy_usd"),
            "completed_cells": state.get("completed_cells"),
            "failed_cells": state.get("failed_cells"),
        },
    )
    save_progress(state)
    log_event("matrix_exit", stop_reason=state.get("stop_reason"))


if __name__ == "__main__":
    main()
