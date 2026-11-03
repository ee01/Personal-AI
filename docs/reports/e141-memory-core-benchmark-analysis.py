import json,pathlib,collections,random,statistics,math,sqlite3
ROOT=pathlib.Path.cwd(); P=ROOT/'experiments/memory-benchmark/reports/run-2026-10-31-8h-v1'; L=ROOT/'experiments/memory-benchmark/.local/proxy-ledger'
def mean(a):return statistics.mean(a) if a else None
def quant(a,p):return sorted(a)[max(0,math.ceil(p*len(a))-1)] if a else None
def read(f):return json.load(open(f))
def ledger(run):
 f=L/(run+'.jsonl');return [json.loads(l) for l in open(f)] if f.exists() else []
def summarize(rs):
 os=[o for r in rs for o in r['outcomes']];vs=[o for r in rs for o in r['rescored_outcomes']];sc={}
 for scene in sorted(set(o['scene'] for o in vs)):
  v=[o for o in vs if o['scene']==scene]; oo=[o for o in os if o['probe']['scene']==scene]
  tn=sum(not o['should_trigger'] and o['observed_action']=='silence' for o in v); fp=sum(not o['should_trigger'] and o['observed_action']!='silence' for o in v); fn=sum(o['should_trigger'] and o['observed_action']=='silence' for o in v);tp=sum(o['should_trigger'] and o['observed_action']!='silence' for o in v)
  pos=[o for o in oo if o['probe']['should_trigger']]
  sc[scene]={'mean':mean([o['composite_unchanged'] for o in v]),'TN_FP_FN_TP':[tn,fp,fn,tp],'precision':tp/(tp+fp) if tp+fp else 0,'recall':tp/(tp+fn) if tp+fn else 0,'recall5':mean([len(set(h['event_id'] for h in o['recall']['hits'][:5])&set(o['probe']['visible_evidence_ids']))/len(o['probe']['visible_evidence_ids']) for o in pos if o['probe']['visible_evidence_ids']]),'quality':sum(bool(o['quality_violations']) for o in v),'safety':sum(bool(o['safety_violations']) for o in v)}
 calls=[x for r in rs for x in ledger(r['run_id'])];c=collections.defaultdict(float)
 for x in calls:c[x['label']]+=x['cost_usd']
 effective=sum(o['probe']['should_trigger'] and o['probe']['scene'] in ['message_sidecar','proactive_discovery'] and o['scores']['F']==1 and o['scores']['E']==1 and o['scores']['D']==1 and o['scores']['N']==1 and o['scores']['L']==1 and not v['safety_violations'] for o,v in zip(os,vs))
 return {'n':len(os),'scenes':sc,'mean':mean([o['composite'] for o in os]),'safety':sum(bool(o['safety_violations']) for o in vs),'identity':sum(o['identity_boundary_fixture'] for o in vs),'runtime_safety':sum(o['runtime_safety_stop'] for o in vs),'unknown':sum(o['safety_unknown'] for o in vs),'invalid':sum(bool(o['evaluation_invalid']) for o in vs),'action_match':sum(o['action_matches_golden']==True for o in vs),'events':sum(r['events_ingested'] for r in rs),'consolidations':sum(r['consolidations'] for r in rs),'cost':dict(c),'proxy_total':sum(c.values()),'effective_reminders':effective,'recall_ms':{str(q):quant([o['recall']['latency_ms'] for o in os],q) for q in [.5,.95,.99]},'decide_ms':{str(q):quant([o['decide']['latency_ms'] for o in os],q) for q in [.5,.95,.99]}}
def ci(a,b,scenes):
 aa={o['probe']['probe_id']:o for r in a for o in r['outcomes'] if o['probe']['scene'] in scenes};bb={o['probe']['probe_id']:o for r in b for o in r['outcomes'] if o['probe']['scene'] in scenes};assert aa.keys()==bb.keys();groups=collections.defaultdict(list)
 for k,o in aa.items(): groups[o['probe']['storyline_key']].append(bb[k]['composite']-o['composite'])
 vals=[mean(v) for k,v in sorted(groups.items())];rng=random.Random(141156);boots=sorted(mean(rng.choices(vals,k=len(vals))) for _ in range(20000));return {'delta':mean(vals),'lo':quant(boots,.025),'hi':quant(boots,.975),'storylines':len(vals),'pairs':len(aa)}
out={'first':{},'ci':{},'expanded':{},'mini':{},'controls':{},'rescored_files':len(list(P.rglob('report.rescored.json')))};first={s:[read(f) for f in sorted(P.glob(f'first-build/{s}/build-1/*/report.rescored.json'))] for s in 'ABCDE'}
for s,rs in first.items():
 out['first'][s]=summarize(rs)
 if s!='A':out['ci'][s]={scene:ci(first['A'],rs,scenes) for scene,scenes in {'core':['message_sidecar','proactive_discovery'],'sidecar':['message_sidecar'],'discovery':['proactive_discovery']}.items()}
for phase in ['expanded-24h','expanded-72h']:
 out['expanded'][phase]={s:summarize([read(f) for f in sorted(P.glob(f'{phase}/{s}/slice/w[123]/report.rescored.json'))]) for s in 'ABCDE'}
for s in 'BCDE':out['controls'][s]={typ:summarize([read(f) for f in sorted(P.glob(f'paired-control/{s}/{typ}/*/report.rescored.json'))]) for typ in ['full','8h']}
for s in 'ACDE':
 out['mini'][s]={typ:summarize([read(P/f'mini-7d/{s}/{typ}/report.rescored.json')]) for typ in ['live','cache']}
(ROOT/'.multica/e156-stats.json').write_text(json.dumps(out,indent=2))
print(json.dumps({k:v for k,v in out.items() if k in ['ci','first','rescored_files']},indent=2))
