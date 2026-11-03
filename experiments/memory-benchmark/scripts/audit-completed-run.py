#!/usr/bin/env python3
"""Read-only aggregation of E-155 saved results. Never calls an LLM or edits source reports."""
import argparse
import collections
import datetime
import hashlib
import json
import math
import pathlib

SCHEMES = 'ABCDE'
ACCEPTANCE = {'message_sidecar', 'proactive_discovery'}
DENSE = {'2026-08-18T06:51:44.000Z', '2026-08-18T09:51:44.000Z', '2026-08-18T15:51:44.000Z'}

def read(path): return json.loads(path.read_text())
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def summarize(outcomes):
    positive=[o for o in outcomes if o['probe']['should_trigger']]
    negative=[o for o in outcomes if not o['probe']['should_trigger']]
    tp=sum(o['decide']['action']!='silence' for o in positive)
    tn=sum(o['decide']['action']=='silence' for o in negative)
    fp=len(negative)-tn;fn=len(positive)-tp
    return {'n':len(outcomes),'mean_composite':sum(o['composite'] for o in outcomes)/len(outcomes) if outcomes else None,
        'action_match':sum(o['decide']['action'] in o['probe']['allowed_actions'] for o in outcomes),
        'tp':tp,'tn':tn,'fp':fp,'fn':fn,'balanced_accuracy':(tp/len(positive)+tn/len(negative))/2 if positive and negative else None,
        'precision':tp/(tp+fp) if tp+fp else None,'recall':tp/len(positive) if positive else None,
        'legacy_probes_passed':sum(o['passed'] for o in outcomes)}
def quantiles(values):
    values=sorted(values)
    return {k:values[max(0,math.ceil(len(values)*q)-1)] if values else None for k,q in [('p50',.5),('p95',.95),('p99',.99)]}

def audit(base, ledger_dir):
    summary=read(base/'summary.json');state=read(base/'matrix-status.json');plan=read(base/'matrix-plan.json');schedule=read(base/'schedule.json')
    canonical=[]
    for cid in state['completed']:
        path=base/cid/'report.json'
        if path.exists(): canonical.append((cid,path))
    for name,mini in summary['mini_7d'].items():canonical.append(('mini-7d/'+name,base/mini['report_file']))
    assert len({str(path) for _,path in canonical})==len(canonical)
    groups=collections.defaultdict(list);manifest=[];degraded=[];isolation={}
    for cid,path in canonical:
        report=read(path);rescored=read(path.parent/'report.rescored.json')
        assert rescored['rescored_revision']==2
        assert report['outcomes']==rescored['outcomes'], 'Rescore altered original outcomes'
        assert len(report['outcomes'])==report['probes_run']
        assert len(rescored['rescored_outcomes'])==report['probes_run']
        groups[(cid.split('/')[0],cid.split('/')[1])].append((cid,report,rescored))
        manifest.append({'cell':cid,'report':str(path.relative_to(base)),'sha256':digest(path),'probes':report['probes_run']})
        isolation[cid]=report.get('ingest_isolation')
        for extra in ['execution.json','adapter-export.json']:
            ep=path.parent/extra
            if ep.exists():manifest[-1][extra+'_sha256']=digest(ep)
        export=path.parent/'adapter-export.json'
        if export.exists():
            data=read(export)
            if 'ingest_failure_count' in data:
                attempts=len(data.get('evidence_events',[]));failures=data['ingest_failure_count']
                degraded.append({'cell':cid,'attempts':attempts,'recorded_failures':failures,'failure_rate':failures/attempts if attempts else None,'degraded':failures>attempts*.05 if attempts else None})
    def outcomes(stage,scheme,dense=False):
        return [o for _,r,_ in groups[stage,scheme] for o in r['outcomes'] if not dense or o['probe']['as_of'] in DENSE]
    first={};expansion={};paired={};mini={}
    for s in SCHEMES:
        os=outcomes('first-build',s)
        safety=[o for _,_,r in groups['first-build',s] for o in r['rescored_outcomes']]
        first[s]={'all':summarize(os),'acceptance':summarize([o for o in os if o['probe']['scene'] in ACCEPTANCE]),
            'identified_safety_findings':sum(bool(o['safety_violations']) for o in safety),
            'identified_runtime_safety_stop':sum(o['runtime_safety_stop'] for o in safety),
            'identity_fixture_probe_ids':[o['probe_id'] for o in safety if o['identity_boundary_fixture']],
            'safety_audit_coverage':'partial; missing tool/recipient audit is not proof of safety',
            'recorded_decide_ms':quantiles([o['decide']['latency_ms'] for o in os])}
        expansion[s]={}
        for stage in ['paired-control','expanded-24h','expanded-72h']:
            if stage=='paired-control':
                for strategy in ['full','8h']:
                    os=[o for cid,r,_ in groups[stage,s] if cid.split('/')[2]==strategy for o in r['outcomes']]
                    expansion[s][strategy]={'all':summarize(os),'acceptance':summarize([o for o in os if o['probe']['scene'] in ACCEPTANCE])}
            else:
                os=outcomes(stage,s,True)
                expansion[s][stage]={'all':summarize(os),'acceptance':summarize([o for o in os if o['probe']['scene'] in ACCEPTANCE])}
        review=base/f'paired-control/{s}/review/reviews.json'
        rs=read(review) if review.exists() else []
        paired[s]={**summary['paired_controls'][s],'judge_review_count':len(rs),'judge_counts':{k:sum(bool(r['review'].get(k)) for r in rs) for k in ['material_regression','old_evidence_omission','safety_regression']}}
    ledger=[];ledger_manifest=[];malformed=0
    for path in sorted(ledger_dir.glob('*.jsonl')):
        ledger_manifest.append({'file':path.name,'sha256':digest(path)})
        for line in path.read_text().splitlines():
            try:ledger.append(json.loads(line))
            except json.JSONDecodeError:malformed+=1
    ids=[r['generation_id'] for r in ledger if r.get('generation_id')]
    totals={'generation_ids':{s:sum(bool(r.get('generation_id')) for r in ledger if r.get('scheme_id')==s) for s in SCHEMES},'total':sum(r.get('cost_usd',0) for r in ledger),'schemes':{s:sum(r.get('cost_usd',0) for r in ledger if r.get('scheme_id')==s) for s in SCHEMES}}
    run_cost=collections.defaultdict(float)
    for row in ledger:run_cost[row['run_id']]+=row.get('cost_usd',0)
    attempts=[json.loads(l) for l in (base/'runs.jsonl').read_text().splitlines() if l.strip()]
    last={r['id']:r for r in attempts}
    for name,meta in summary['mini_7d'].items():
        r=read(base/meta['report_file']);os=r['outcomes'];peer=last['mini-7d/'+name]
        mini[name]={'run_id':r['run_id'],'all':summarize(os),'acceptance':summarize([o for o in os if o['probe']['scene'] in ACCEPTANCE]),'seconds':peer['seconds'],
            'report_proxy_usd':r['cost']['proxy_usd'],'final_ledger_run_tagged_usd':run_cost[r['run_id']],'cell_wall_proxy_delta':peer['proxy_delta'],
            'consolidations':r['consolidations'],'events_ingested':r['events_ingested']}
    raw_skips=collections.Counter((r['id'].split('/')[0],r['reason']) for r in state['skipped'])
    stale_skips=[r['id'] for r in state['skipped'] if r['id'].endswith('/review') and (base/r['id']/'complete.json').exists()]
    scheduled={c['id'] for c in schedule};extra_completed=sorted(set(state['completed'])-scheduled)
    normalized_complete=(set(state['completed'])&scheduled)|set(stale_skips)
    normalized_skipped=[r for r in state['skipped'] if r['id'] not in normalized_complete]
    unresolved=scheduled-normalized_complete-{r['id'] for r in normalized_skipped}
    assert not unresolved,unresolved
    models=collections.defaultdict(lambda:{'rows':0,'generation_ids':0,'usd':0})
    for r in ledger:
        if r.get('scheme_id')=='A' and 'glm-' not in str(r.get('model')):
            m=models[str(r.get('model'))];m['rows']+=1;m['generation_ids']+=bool(r.get('generation_id'));m['usd']+=r.get('cost_usd',0)
    close_key=read(base/'final-audit/key-current.json')
    close_proxy_delta=totals['total']-plan['prior_costs']['total']
    close_key_delta=close_key['usage']-plan['key_start']['usage']
    for scheme in SCHEMES:
        live=summary['mini_7d'].get(scheme+'/live');cache=summary['mini_7d'].get(scheme+'/cache')
        if not live or not cache:continue
        a={o['probe']['probe_id']:o for o in read(base/live['report_file'])['outcomes']}
        b={o['probe']['probe_id']:o for o in read(base/cache['report_file'])['outcomes']}
        mini[scheme+'/cache']['action_changes_vs_live']=sum(a[i]['decide']['action']!=b[i]['decide']['action'] for i in a)
        mini[scheme+'/cache']['decision_payload_changes_vs_live']=sum(any(a[i]['decide'][k]!=b[i]['decide'][k] for k in ['action','output_text','cited_event_ids']) for i in a)
    for meta in mini.values():meta['generation_ids']=sum(bool(r.get('generation_id')) for r in ledger if r['run_id']==meta['run_id'])
    sample=read(base/'final-audit/generation-cost-sample.json')
    lookup_ok=[r for r in sample if 'api_total_cost' in r]
    return {'generation_cost_sample':{'requested':len(sample),'successful':len(lookup_ok),'sum_api_minus_ledger':sum(r['api_total_cost']-r['ledger_cost'] for r in lookup_ok)},'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scorer_revision':2,'canonical_reports':len(canonical),'canonical_probe_outcomes':sum(m['probes'] for m in manifest),
        'source_files':manifest,'source_ledger_files':ledger_manifest,'input_hashes':{k:plan[k] for k in ['golden_sha256','events_sha256','slice_sha256']},
        'status':{'driver_finished':state['finished'],'raw_completed':len(state['completed']),'raw_skipped':len(state['skipped']),'final_schedule_cells':len(schedule),
            'legacy_extra_completed':extra_completed,'artifact_resolved_stale_skips':stale_skips,'normalized_completed':len(normalized_complete),'normalized_skipped':len(normalized_skipped),
            'skip_groups':[{'stage':k[0],'reason':k[1],'count':v} for k,v in raw_skips.items()],'recorded_attempts':len(attempts),'nonzero_exit_attempts':sum(r['exit_code']!=0 for r in attempts)},
        'first_build':first,'paired_controls':paired,'dense_expansion_diagnostics':expansion,'mini_7d':mini,'degraded_ingestion':degraded,
        'cost':{'frozen_summary':summary['costs_including_prior_attempts'],'close_ledger':totals,'frozen_reconciliation':summary['reconciliation'],
            'frozen_unreconciled_usd':summary['reconciliation']['key_usage_delta']-summary['reconciliation']['proxy_delta'],
            'close_proxy_delta':close_proxy_delta,'close_key_usage_delta':close_key_delta,'close_unreconciled_usd':close_key_delta-close_proxy_delta,
            'key_start':plan['key_start'],'key_at_summary':summary['key_end'],'key_at_close':close_key,'ledger_rows':len(ledger),'malformed_rows':malformed,
            'generation_id_rows':len(ids),'duplicate_generation_ids':len(ids)-len(set(ids)),'zero_cost_rows':sum(not r.get('cost_usd') for r in ledger),
            'zero_cost_with_generation_id':sum(not r.get('cost_usd') and bool(r.get('generation_id')) for r in ledger),'scheme_A_non_zai_attempts':dict(models),
            'unknown_scheme_usd':totals['total']-sum(totals['schemes'].values())},
        'ingest_isolation_by_cell':isolation,'winner':None,'quality_equivalence':'not established','original_acceptance_complete':False,
        'limitations':['one full development build, no repeated-build variance or ablations','paired controls cover only three dense windows (24 outcomes, 12 acceptance)','paired-control isolation differs from expanded normal ingestion; not a matched window-only causal comparison','D ready-status failure >5% marks degraded results','semantic rubric not fully rejudged; paired difference reviews only','safety audit coverage partial','runtime service active-run attribution is not independent causal spend attribution','latency cold/hot/miss/consolidation-concurrent matrix not completed']}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--run',type=pathlib.Path,required=True);parser.add_argument('--ledgers',type=pathlib.Path,required=True)
    args=parser.parse_args();result=audit(args.run,args.ledgers);path=args.run/'final-audit/evidence.json';path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'output':str(path),'reports':result['canonical_reports'],'outcomes':result['canonical_probe_outcomes'],'status':result['status'],'cost':{k:result['cost'][k] for k in ['close_proxy_delta','close_key_usage_delta','close_unreconciled_usd']}},ensure_ascii=False))
