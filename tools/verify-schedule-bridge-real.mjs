import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const source = path.resolve(process.env.SCHEDULE_SOURCE || '../personal-schedule/service');
const sourceRevision = execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
const { openDb } = await import(pathToFileURL(path.join(source, 'src/db.js')));
const { buildApp } = await import(pathToFileURL(path.join(source, 'src/server.js')));
const { listen } = await import(pathToFileURL(path.join(source, 'src/http.js')));
const { config } = await import(pathToFileURL(path.join(source, 'src/config.js')));
const db = openDb(':memory:');
const { app, services } = buildApp(db);
config.authLoginBridgeEnabled = true; config.authDevFallback = false;
config.authResendApiKey = 'fixture-only'; config.authResendFrom = 'fixture@example.test'; config.authResendIntervalSec = 0;
const originalFetch = globalThis.fetch; const codes = new Map();
globalThis.fetch = async (url, init) => {
  if (url === 'https://api.resend.com/emails') {
    const data = JSON.parse(init.body); codes.set(data.to[0], data.text.match(/\d{6}/)[0]);
    return new Response('{}', {status:200});
  }
  return originalFetch(url, init);
};
const server = await listen(app, {port:0,host:'127.0.0.1'});
const base = `http://127.0.0.1:${server.address().port}`;
const results = [];
const supplementary = [];
const check = (name, expected, actual) => results.push({name,expected,actual,passed:JSON.stringify(expected)===JSON.stringify(actual)});
const extraCheck = (name, expected, actual) => supplementary.push({name,expected,actual,passed:JSON.stringify(expected)===JSON.stringify(actual)});
async function call(endpoint, body, cookie, bearer, method = body === undefined ? 'GET' : 'POST', origin) {
  const response = await fetch(`${base}/api/v1${endpoint}`, {method,headers:{'Content-Type':'application/json',
    ...(cookie ? {Cookie:cookie}:{}),...(bearer ? {Authorization:`Bearer ${bearer}`} : {}),...(origin ? {Origin:origin}: {})},
    body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const guest = () => call('/auth/guest', {});
const nonce = () => crypto.randomUUID();
const register = (g,n) => call('/auth/bridge/register', {nonce:n},g.cookie);
const exchange = (g,n,token,origin) => call('/auth/bridge/exchange',{nonce:n},g?.cookie,token,'POST',origin);
try {
  const e = services.auth.ensureUser('a@eexx.me');
  const token = services.auth.issueToken(e.id,'real-api-regression');
  let g = await guest(), n = nonce(); await register(g,n);
  const concurrent = await Promise.all([exchange(g,n,token),exchange(g,n,token)]);
  check('nonce concurrent consumption', [200,400], concurrent.map(r=>r.status).sort());
  const success = concurrent.find(r=>r.status===200);
  check('rotation invalidates initiating guest cookie',401,(await call('/me',undefined,g.cookie)).status);
  check('rotation sets distinct cookie',true,success.cookie!==g.cookie);
  check('restored E identity',e.id,(await call('/me',undefined,success.cookie)).body.id);
  g=await guest(); n=nonce(); await register(g,n);
  db.prepare('UPDATE login_bridges SET expires_at=? WHERE nonce=?').run(Math.floor(Date.now()/1000)-1,n);
  check('expired nonce rejected',400,(await exchange(g,n,token)).status);
  g=await guest(); n=nonce(); await register(g,n);
  check('no PAT cannot exchange',400,(await exchange(g,n,undefined)).status);
  const otherGuest=await guest();
  check('nonce tied to initiating session',400,(await exchange(otherGuest,n,token)).status);
  g=await guest(); n=nonce(); await register(g,n);
  check('nonce requires initiating cookie',true,(await exchange(null,n,token)).status!==200);
  g=await guest(); n=nonce(); await register(g,n);
  check('wrong Origin rejected by server',true,(await exchange(g,n,token,'https://evil.example.test')).status!==200);
  const other=services.auth.ensureUser('other@ringcentral.com'); const otherToken=services.auth.issueToken(other.id);
  const signed=await call('/auth/login',{token:otherToken});
  g=await guest(); n=nonce(); await register(g,n);
  check('server refuses replacing existing real session',true,(await exchange(signed,n,token)).status!==200);
  g=await guest(); n=nonce();
  await register(g,n);
  check('cannot overwrite another session nonce',true,(await register(await guest(),n)).status!==200);
  g=await guest();
  const task=await call('/tasks',{type:'asme',title:'guest fixture',content:'Do not execute',status:'active',
    scheduleSpec:{kind:'one_shot',dateTime:Math.floor(Date.now()/1000)-10,timezone:'UTC'},config:{chatId:'fixture-only'}},g.cookie);
  assert.equal(task.status,200);
  check('guest create never active',false,task.body.task.status==='active');
  check('guest enable rejected',400,(await call(`/tasks/${task.body.task.id}/status`,{status:'active'},g.cookie)).status);
  const patched=await call(`/tasks/${task.body.task.id}`,{status:'active'},g.cookie,undefined,'PATCH');
  check('guest PATCH cannot activate',false,patched.body.task.status==='active');
  check('guest cannot bind credentials',400,(await call('/connections/rc_user',{token:'fixture'},g.cookie,undefined,'PUT')).status);
  await services.runner.tick();
  check('guest has no execution occurrences',0,db.prepare('SELECT count(*) n FROM occurrences WHERE user_id=?').get(g.body.id).n);
  const saved=await call('/auth/login',{token},g.cookie);
  const again=await call('/auth/login',{token},saved.cookie);
  const tasks=await call('/tasks',undefined,again.cookie);
  check('guest drafts merge only once',1,tasks.body.filter(t=>t.title==='guest fixture').length);
  check('draft remains non-active after login',false,tasks.body.find(t=>t.title==='guest fixture').status==='active');
  check('existing E PAT login preserved',e.id,again.body.user.id);
  check('existing E email login available',200,(await call('/auth/email/request',{email:'a@eexx.me'})).status);
  await call('/auth/email/request',{email:'new@ringcentral.com'});
  const emailResponses=await Promise.all([1,2].map(()=>call('/auth/email/verify',{email:'new@ringcentral.com',code:codes.get('new@ringcentral.com')})));
  check('actual email-code single consumption',[200,400],emailResponses.map(r=>r.status).sort());
  const historical=services.auth.createSession(e.id,null);
  const tokenId=services.auth.tokenIdByBearer(token);
  await call(`/auth/tokens/${tokenId}`,undefined,again.cookie,undefined,'DELETE');
  check('device-issued cookie revoked',401,(await call('/me',undefined,again.cookie)).status);
  check('revoked device PAT rejected',400,(await call('/auth/login',{token})).status);
  check('historical unlinked cookie remains explicit exception',200,(await call('/me',undefined,`ps_session=${historical}`)).status);
  config.authLoginBridgeEnabled=false;
  check('bridge disable flag denies register',400,(await register(await guest(),nonce())).status);
  // Keep the original 25 cases/count intact. These extra cases prove failed
  // attacks do not consume a valid nonce or break subsequent legitimate login.
  config.authLoginBridgeEnabled=true;
  const followupToken=services.auth.issueToken(e.id,'failed-exchange-followup');
  for(const attack of ['different guest','missing cookie','wrong origin','real logged-in cookie','overwrite registration']){
    const initiator=await guest(), value=nonce();
    assert.equal((await register(initiator,value)).status,200);
    let rejected;
    if(attack==='different guest') rejected=await exchange(await guest(),value,followupToken);
    if(attack==='missing cookie') rejected=await exchange(null,value,followupToken);
    if(attack==='wrong origin') rejected=await exchange(initiator,value,followupToken,'https://evil.example.test');
    if(attack==='real logged-in cookie') rejected=await exchange(signed,value,followupToken);
    if(attack==='overwrite registration') rejected=await register(await guest(),value);
    const retained=Boolean(db.prepare('SELECT nonce FROM login_bridges WHERE nonce=?').get(value));
    const legitimate=await exchange(initiator,value,followupToken);
    extraCheck(`rejection preserves legitimate nonce: ${attack}`,
      {rejected:400,retained:true,legitimate:200,sameUser:true},
      {rejected:rejected.status,retained,legitimate:legitimate.status,sameUser:legitimate.body.user?.id===e.id});
  }
  const eGuest=await guest();
  const eLogin=await call('/auth/email/verify',{email:e.email,code:codes.get(e.email)},eGuest.cookie);
  assert.equal((await call('/auth/email/request',{email:e.email})).status,200);
  const repeatedELogin=await call('/auth/email/verify',{email:e.email,code:codes.get(e.email)},eLogin.cookie);
  extraCheck('existing E email verifies twice without duplicate account',
    {first:200,second:200,sameUser:true,count:1},
    {first:eLogin.status,second:repeatedELogin.status,sameUser:eLogin.body.user?.id===e.id&&repeatedELogin.body.user?.id===e.id,
      count:db.prepare('SELECT count(*) n FROM users WHERE email=?').get(e.email).n});
  extraCheck('unregistered external-domain email still rejected',400,
    (await call('/auth/email/request',{email:'new-outsider@example.test'})).status);
  const schemaVersion=db.prepare('SELECT version FROM schema_version').get().version;
  extraCheck('actual migration has nonce session binding',
    {version:6,sessionColumn:true},
    {version:schemaVersion,sessionColumn:db.prepare('PRAGMA table_info(login_bridges)').all().some(c=>c.name==='session_id')});
  const dir=path.resolve('test-results/schedule-auth'); await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'real-server-contract.json'),JSON.stringify({sourceRevision,schemaVersion,transport:'local HTTP API, not browser TLS evidence',mail:'controlled Resend only; no login/nonce route shim',results,supplementary},null,2));
  const failed=[...results,...supplementary].filter(r=>!r.passed);
  console.log(JSON.stringify({sourceRevision,schemaVersion,originalPassed:results.filter(r=>r.passed).length,supplementaryPassed:supplementary.filter(r=>r.passed).length,failed},null,2));
  if(failed.length) process.exitCode=1;
} finally {
  server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); db.close(); globalThis.fetch=originalFetch;
}
