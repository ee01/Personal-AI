import subprocess,json,sys
from pathlib import Path
queries=json.loads(sys.stdin.read())
script="const DB=require('better-sqlite3');const db=new DB('/app/data/users/esone.qiu/memory.db',{readonly:true,fileMustExist:true});db.pragma('query_only=ON'); db.loadExtension(require('sqlite-vec').getLoadablePath()); const qs="+json.dumps(queries)+";let out={};for(const [k,q] of Object.entries(qs)){try{out[k]=db.prepare(q).all()}catch(e){out[k]={error:e.message}}}console.log(JSON.stringify(out,null,2));db.close();"
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=8','rcadmin@10.32.56.212','PATH=/usr/local/bin:/opt/homebrew/bin:$PATH; docker exec -i -w /app memory-service node'],input=script,text=True,capture_output=True,timeout=50)
if r.returncode: print(r.stderr);sys.exit(r.returncode)
if len(sys.argv)>1: Path(sys.argv[1]).write_text(r.stdout)
print(r.stdout)
