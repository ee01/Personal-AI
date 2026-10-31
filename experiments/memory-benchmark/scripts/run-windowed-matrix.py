#!/usr/bin/env python3
"""E-155 approved incremental 8h policy. Run serially behind the accounting proxy."""
from __future__ import annotations
import hashlib
import json
import os
import pathlib
import signal
import subprocess
import time
import urllib.request
from datetime import datetime, timezone

BENCH = pathlib.Path(__file__).resolve().parents[1]
ROOT = BENCH.parents[1]
OUT = BENCH / "reports/run-2026-10-31-8h-v1"
OLD = BENCH / "reports/run-2026-10-31"
EVENTS = ROOT / "memory-service/evals/personal-memory-dataset/raw-only/events.jsonl"
PROBES = EVENTS.parent / "probes/development.v1.1.jsonl"
LEDGERS = BENCH / ".local/proxy-ledger"
POLICY = BENCH / ".local/windowed-budget.json"
SCHEMES = "ABCDE"
ACTIVE_CHILD = None

def terminate_cell(child):
    if child is None or child.poll() is not None: return
    try: os.killpg(child.pid,signal.SIGTERM)
    except ProcessLookupError: return
    try: child.wait(timeout=10)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid,signal.SIGKILL);child.wait()

def stop_requested(signum, _frame):
    # Pause provider traffic before stopping this run's exact child process group.
    write(POLICY,{"paused":True})
    terminate_cell(ACTIVE_CHILD)
    raise SystemExit(128+signum)


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")
    tmp.replace(path)

def rows(path):
    return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]

def totals():
    result = dict.fromkeys(SCHEMES, 0.0)
    total, generations = 0.0, dict.fromkeys(SCHEMES, 0)
    for path in LEDGERS.glob("*.jsonl"):
        for line in path.read_text().splitlines():
            try: row = json.loads(line)
            except json.JSONDecodeError: continue
            cost = float(row.get("cost_usd", 0))
            total += cost
            scheme = row.get("scheme_id")
            if scheme in result:
                result[scheme] += cost
                generations[scheme] += bool(row.get("generation_id"))
    return {"total": total, "schemes": result, "generation_ids": generations}

def key_snapshot():
    key = os.environ["OPENROUTER_API_KEY"]
    req = urllib.request.Request("https://openrouter.ai/api/v1/auth/key", headers={"Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.load(response)["data"]
    return {k: data.get(k) for k in ("usage", "usage_daily", "limit", "limit_remaining")}

def policy(plan, fraction, paused=False):
    base = plan["prior_costs"]["schemes"]
    current = totals()
    # Later stages always retain a share of each scheme's remaining $49 envelope.
    ceilings = {s: base[s] + (49 - base[s]) * fraction for s in SCHEMES}
    write(POLICY, {"ledger_dir": str(LEDGERS), "total_ceiling_usd": plan["total_ceiling_usd"], "scheme_ceilings_usd": ceilings, "paused": paused})
    return ceilings, current

def make_plan():
    probes = rows(PROBES)
    events = rows(EVENTS)
    points = sorted(set(p["as_of"] for p in probes))
    def stamp(s): return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    windows = [{"as_of": t, "event_count": sum(stamp(t)-28800 < stamp(e["observed_at"]) <= stamp(t) for e in events), "probes": sum(p["as_of"] == t for p in probes)} for t in points]
    key = key_snapshot()
    if not isinstance(key["limit_remaining"], (float, int)) or key["limit_remaining"] <= 2:
        raise RuntimeError("key_remaining_budget_unavailable_or_exhausted")
    old_costs = totals()
    # Key headroom and authorized 5x$50 cap both apply. Reserve $2 against key exhaustion.
    ceiling = min(245.0, old_costs["total"] + key["limit_remaining"] - 2)
    return {"version": "8h-v1", "created": datetime.now(timezone.utc).isoformat(), "golden": "v1.1", "golden_sha256": hashlib.sha256(PROBES.read_bytes()).hexdigest(), "events_sha256": hashlib.sha256(EVENTS.read_bytes()).hexdigest(), "models_sha256": hashlib.sha256((BENCH/"config/models.json").read_bytes()).hexdigest(), "slice_sha256": hashlib.sha256((OLD/"slice-events.jsonl").read_bytes()).hexdigest(), "prior_costs": old_costs, "key_start": key, "total_ceiling_usd": ceiling, "windows": windows, "stages": {"first-build": .35, "paired-control": .65, "repeat-builds": .85, "ablations": .9, "expanded-24h": .75, "expanded-72h": .85, "mini-7d": 1.0}, "old_results": str(OLD.relative_to(ROOT)), "quality_rules": {"max_acceptance_score_drop": 5, "max_added_errors": 1, "max_added_safety_failures": 0, "old_evidence_omissions": 0}, "limitations": ["candidate + common historical hybrid retrieval; not native full-history build", "deterministic rubric plus frozen non-z-ai judge for paired differences; not a statistical equivalence claim", "7 storylines are not independent statistical samples", "local raw embeddings reusable; generated memory and answers never reused between builds", "unknown historical attribution remains in total budget"], "decision_context": {"top_k":20,"max_utf8_bytes":12000}, "budget_reserve": "Each scheme stops new calls at $49 (below authorized $50); key reserve $2. Actual in-flight cost is settled before the next call."}

def gates_ok(scheme):
    if scheme in "ABC": path = BENCH / f"reports/e155-intraday-gates-2026-10-31/scheme-{scheme}.json"
    else: path = BENCH / f"reports/e155-d-e-gates-2026-10-31/{scheme}/scheme-{scheme}.json"
    report = json.loads(path.read_text())
    gates = {g["gate"]: g["ok"] for g in report["gates"]}
    return not report.get("skipped") and all(gates.get(k) is True for k in ["future_evidence_hard", "intraday_derived_as_of"])

def schedule(plan):
    windows = sorted(plan["windows"], key=lambda w: -w["event_count"])
    cells = []
    def add(stage, scheme, label, strategy="8h", events=EVENTS, ablation="none"):
        for i, window in enumerate(windows):
            cells.append({"id":f"{stage}/{scheme}/{label}/w{i+1}", "stage":stage,"scheme":scheme,"as_of":window["as_of"],"strategy":strategy,"events":str(events),"ablation":ablation})
    for s in SCHEMES: add("first-build",s,"build-1")
    for s in SCHEMES:
        for strategy in ["full", "8h"]: add("paired-control",s,strategy,strategy,OLD/"slice-events.jsonl")
    for s in SCHEMES: cells.append({"id":f"paired-control/{s}/review","stage":"paired-control","scheme":s,"review":True})
    for hours in [24,72]:
        for s in SCHEMES:
            add(f"expanded-{hours}h",s,"slice",events=OLD/"slice-events.jsonl")
            for cell in cells:
                if cell["stage"]==f"expanded-{hours}h":cell["hours"]=hours
    for b in [2,3]:
        for s in SCHEMES: add("repeat-builds",s,f"build-{b}")
    for mode in ["raw_hybrid_only","no_background_consolidation","no_link_precalc"]:
        for s in "AB": add("ablations",s,mode,ablation=mode)
    for s in SCHEMES:
        for replay in ["live","cache"]: cells.append({"id":f"mini-7d/{s}/{replay}","stage":"mini-7d","scheme":s,"replay":replay})
    return cells

def summarize(plan, state):
    cost = totals()
    summary = {"version": plan["version"], "status": state, "costs_including_prior_attempts": cost, "new_run_proxy_usd":cost["total"]-plan["prior_costs"]["total"], "coverage":{}, "paired_controls":{}, "winner":None, "quality_equivalence":"not established; complete paired controls and difference review required"}
    for scheme in SCHEMES:
        records = []
        for path in (OUT/f"first-build/{scheme}").glob("**/report.json"):
            records.extend(json.loads(path.read_text())["outcomes"])
        acceptance = [o for o in records if o["probe"]["scene"] in ["message_sidecar","proactive_discovery"]]
        summary["coverage"][scheme] = {"probes":len(records),"expected":56,"acceptance_probes":len(acceptance),"expected_acceptance":28,"mean_acceptance":sum(o["composite"] for o in acceptance)/len(acceptance) if acceptance else None}
        controls = {}
        for strategy in ["full","8h"]:
            outcomes = []
            for path in (OUT/f"paired-control/{scheme}/{strategy}").glob("**/report.json"):
                outcomes.extend(json.loads(path.read_text())["outcomes"])
            controls[strategy] = {o["probe"]["probe_id"]:o for o in outcomes}
        full, new = controls["full"], controls["8h"]
        common = sorted(set(full)&set(new))
        acceptance = [i for i in common if full[i]["probe"]["scene"] in ["message_sidecar","proactive_discovery"]]
        diffs = []
        for i in common:
            a,b = full[i],new[i]
            if any(a["decide"].get(k)!=b["decide"].get(k) for k in ["action","output_text","cited_event_ids"]) or any(a["scores"][k]!=b["scores"][k] for k in ["F","E","D","N"]):
                diffs.append({"probe_id":i,"as_of":a["probe"]["as_of"],"full":a,"8h":b})
        write(OUT/f"paired-control/{scheme}/differences.json",diffs)
        error = lambda o: bool(o["hard_gate_failures"]) or o["scores"]["F"] < 1 or o["scores"]["D"] < 1
        drop = sum(full[i]["composite"]-new[i]["composite"] for i in acceptance)/len(acceptance) if acceptance else None
        added = sum(error(new[i]) and not error(full[i]) for i in acceptance)
        old_omissions = []
        by_id = {e["event_id"]:e for e in rows(EVENTS)}
        for i in common:
            p=full[i]["probe"]
            cutoff=datetime.fromisoformat(p["as_of"].replace("Z","+00:00")).timestamp()-28800
            old_ids=[eid for eid in p["visible_evidence_ids"] if eid in by_id and datetime.fromisoformat(by_id[eid]["observed_at"].replace("Z","+00:00")).timestamp()<=cutoff]
            if old_ids and new[i]["scores"]["F"] < full[i]["scores"]["F"]: old_omissions.append(i)
        safety = lambda o: [f for f in o["hard_gate_failures"] if any(x in f for x in ["future","scope_leak","deleted","revoked"])]
        added_safety = sum(bool(set(safety(new[i]))-set(safety(full[i]))) for i in common)
        complete = len(full)==56 and len(new)==56
        passed = complete and drop is not None and drop<=5 and added<=1 and not added_safety and not old_omissions
        review_path=OUT/f"paired-control/{scheme}/review/reviews.json"
        reviews=json.loads(review_path.read_text()) if review_path.exists() else []
        judge_failed=any(any(r["review"].get(k) for k in ["material_regression","old_evidence_omission","safety_regression"]) for r in reviews)
        summary["paired_controls"][scheme]={"judge_complete":(OUT/f"paired-control/{scheme}/review/complete.json").exists(),"judge_regression":judge_failed,"paired_probes":len(common),"complete":complete,"acceptance_score_drop":drop,"added_acceptance_errors":added,"added_safety_failures":added_safety,"old_evidence_fact_regressions":old_omissions,"exploratory_numeric_rule_passed":passed,"difference_review_required":True,"window_expansion_required":complete and not passed}
    summary["expansion_required"]=any(c["window_expansion_required"] or c["judge_regression"] for c in summary["paired_controls"].values())
    if summary["expansion_required"]:
        summary["quality_equivalence"]="8h control regression; uniform 24h/72h slice diagnostics required; no winner"
    try:
        key = key_snapshot()
        summary["key_end"] = key
        summary["reconciliation"] = {"proxy_delta":summary["new_run_proxy_usd"],"key_usage_delta":key["usage"]-plan["key_start"]["usage"]}
    except Exception as e: summary["key_snapshot_error"] = repr(e)
    write(OUT/"summary.json", summary)
    return summary

def main():
    global ACTIVE_CHILD
    signal.signal(signal.SIGTERM,stop_requested)
    signal.signal(signal.SIGINT,stop_requested)
    OUT.mkdir(parents=True,exist_ok=True)
    plan_path=OUT/"matrix-plan.json"
    plan=json.loads(plan_path.read_text()) if plan_path.exists() else make_plan()
    for path,key in [(PROBES,"golden_sha256"),(EVENTS,"events_sha256"),(BENCH/"config/models.json","models_sha256"),(OLD/"slice-events.jsonl","slice_sha256")]:
        if hashlib.sha256(path.read_bytes()).hexdigest()!=plan[key]: raise RuntimeError("frozen_input_changed:"+str(path))
    plan["stages"].update({"expanded-24h":.75,"expanded-72h":.85})
    implementation_files=["src/cli/run-windowed.ts","src/cli/review-windowed-pairs.ts","src/windowed/adapter.ts","src/windowed/history.ts","src/windowed/baseline-bge.ts","adapters/new-core/embedding.ts","src/cost/budget-guard.ts","src/cost/openrouter-proxy.ts","src/cli/run-windowed-mini.ts","scripts/run-windowed-matrix.py"]
    plan["implementation_sha256"]={p:hashlib.sha256((BENCH/p).read_bytes()).hexdigest() for p in implementation_files}
    write(plan_path,plan)
    cells=schedule(plan); write(OUT/"schedule.json",cells)
    state_path=OUT/"matrix-status.json"
    state=json.loads(state_path.read_text()) if state_path.exists() else {"completed":[],"failed":[],"skipped":[],"safety_stopped_schemes":[]}
    finished=set(state["completed"])|{x["id"] for x in state["failed"]}|{x["id"] for x in state["skipped"]}
    state.pop("runner_error",None)
    state["stopped"]=False
    previous_scheme=None
    try:
        for cell in cells:
            if cell["id"] in finished: continue
            scheme=cell["scheme"]
            ceilings,current=policy(plan,plan["stages"][cell["stage"]])
            reason = None
            if scheme in state["safety_stopped_schemes"]: reason="safety_stopped"
            elif not gates_ok(scheme): reason="missing_or_failed_prior_safety_gates"
            elif current["total"]>=plan["total_ceiling_usd"]: reason="total_budget"
            elif current["schemes"][scheme]>=ceilings[scheme]: reason="stage_budget_reserved"
            summary=summarize(plan,state) if cell["stage"].startswith("expanded-") or cell["stage"] in ["repeat-builds","ablations"] else None
            if cell["stage"].startswith("expanded-") and not summary["expansion_required"]:reason="8h_controls_do_not_require_expansion"
            if cell["stage"] in ["repeat-builds","ablations"] and summary["expansion_required"]:reason="8h_policy_failed_controls_reserve_for_expansion_and_replay"
            if reason:
                state["skipped"].append({"id":cell["id"],"reason":reason});write(state_path,state);continue
            if previous_scheme and previous_scheme!=scheme:
                time.sleep(65)
                write(OUT/f"key-switch-{len(state['completed'])+len(state['failed'])}.json",key_snapshot())
            previous_scheme=scheme
            state.update({"current":cell,"updated_at":datetime.now(timezone.utc).isoformat(),"finished":False});write(state_path,state)
            print(json.dumps({"event":"cell_start",**cell}),flush=True)
            cell_out=OUT/cell["id"];cell_out.mkdir(parents=True,exist_ok=True)
            run_id="e155-8h-"+hashlib.sha256(cell["id"].encode()).hexdigest()[:12]
            if cell.get("review"):
                current_summary=summarize(plan,state)
                if not current_summary["paired_controls"][scheme]["complete"]:
                    state["skipped"].append({"id":cell["id"],"reason":"incomplete_paired_control"});write(state_path,state);continue
                cmd=["npx","tsx","src/cli/review-windowed-pairs.ts","--scheme",scheme,"--out",str(cell_out)]
            elif cell["stage"]=="mini-7d":
                cmd=["npx","tsx","src/cli/run-windowed-mini.ts","--scheme",scheme,"--fixture","production-mini-7d","--out",str(cell_out),"--adapter-run-id",f"e155-8h-mini-{scheme}","--fresh","true" if cell["replay"]=="live" else "false"]
                if cell["replay"]=="cache" and f"mini-7d/{scheme}/live" not in state["completed"]:
                    state["skipped"].append({"id":cell["id"],"reason":"no_complete_live_replay"});write(state_path,state);continue
            else:
                cmd=["npx","tsx","src/cli/run-windowed.ts","--scheme",scheme,"--events",cell["events"],"--probes",str(PROBES),"--as-of",cell["as_of"],"--strategy",cell["strategy"],"--ablation",cell["ablation"],"--run-id",run_id,"--out",str(cell_out),"--hours",str(cell.get("hours",8))]
            before=totals();started=time.monotonic()
            env=os.environ.copy();env["MEMORY_BENCHMARK_BUDGET_POLICY"]=str(POLICY)
            with (cell_out/"cli.log").open("w") as log:
                with subprocess.Popen(cmd,cwd=BENCH,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True) as child:
                    ACTIVE_CHILD=child
                    try: code=child.wait(timeout=7200)
                    except subprocess.TimeoutExpired:
                        # This process group was created solely for this cell. Never
                        # kill by executable name or leave an npx grandchild billing.
                        terminate_cell(child)
                        code=124
                    finally: ACTIVE_CHILD=None
            reports=list(cell_out.glob("report.json")) or list(cell_out.glob(f"{scheme}-run-*.json"))
            report=json.loads(reports[-1].read_text()) if reports else {}
            rec={"id":cell["id"],"exit_code":code,"seconds":time.monotonic()-started,"proxy_delta":totals()["total"]-before["total"],"probes":report.get("probes_run",0),"stopped_reason":report.get("stopped_reason")}
            expected=40 if cell["stage"]=="mini-7d" else 8
            if code==0 and ((cell.get("review") and (cell_out/"complete.json").exists()) or (rec["probes"]==expected and not rec["stopped_reason"])):state["completed"].append(cell["id"])
            else:state["failed"].append(rec)
            safety_failures=[f for o in report.get("outcomes",[]) for f in o.get("hard_gate_failures",[]) if any(k in f for k in ["future","scope_leak","revoked","deleted"])]
            if safety_failures: state["safety_stopped_schemes"].append(scheme)
            if "safety_gate_failed" in str(rec["stopped_reason"]) or "native_scope_leak" in str(rec["stopped_reason"]) or "native_future_leak" in str(rec["stopped_reason"]):state["safety_stopped_schemes"].append(scheme)
            with (OUT/"runs.jsonl").open("a") as f:f.write(json.dumps(rec)+"\n")
            write(state_path,state)
            print(json.dumps({"event":"cell_end",**rec}),flush=True)
            summarize(plan,state)
        state.update({"current":None,"finished":True});write(state_path,state)
    except BaseException as error:
        state.update({"runner_error":repr(error),"finished":False,"stopped":True})
        write(state_path,state)
        raise
    finally:
        policy(plan,1,paused=True)
        summarize(plan,state)

if __name__=="__main__":main()
