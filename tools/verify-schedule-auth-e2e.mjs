import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import playwright from '../desktop-app/node_modules/playwright/index.js';

// Real Schedule routes only: no meta override, no register/exchange shim.
// Supply an already browser-trusted localhost certificate and key. Never use
// ignoreHTTPSErrors, SPKI exceptions or Security-domain overrides.
const source = path.resolve(process.env.SCHEDULE_SOURCE || '../personal-schedule/service');
const { openDb } = await import(pathToFileURL(path.join(source, 'src/db.js')));
const { buildApp } = await import(pathToFileURL(path.join(source, 'src/server.js')));
const { config } = await import(pathToFileURL(path.join(source, 'src/config.js')));
const db = openDb(':memory:'); const { app, services } = buildApp(db);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'schedule-real-bridge-'));
const certPath = process.env.SCHEDULE_TEST_TLS_CERT || path.join(temp,'cert.pem');
const keyPath = process.env.SCHEDULE_TEST_TLS_KEY || path.join(temp,'key.pem');
const codes = new Map(); const contexts = []; let server,base;
const originalFetch = globalThis.fetch;
const report = { routes:'actual Schedule loginBridge/register/exchange', mail:'controlled Resend; no real delivery',
  tls:'normal browser verification; no certificate bypass', browserFunctional:'not run', results:[] };
config.authLoginBridgeEnabled=true; config.authDevFallback=false;
config.authResendApiKey='fixture-only'; config.authResendFrom='fixture@example.test'; config.authResendIntervalSec=0;
globalThis.fetch=async(url,init)=>{
  if(url==='https://api.resend.com/emails'){
    const data=JSON.parse(init.body); codes.set(data.to[0],data.text.match(/[0-9]{6}/)[0]);
    return new Response('{}',{status:200});
  }
  return originalFetch(url,init);
};
try {
  if(!process.env.SCHEDULE_TEST_TLS_CERT || !process.env.SCHEDULE_TEST_TLS_KEY){
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,
      '-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
  }
  server=https.createServer({cert:await fs.readFile(certPath),key:await fs.readFile(keyPath)},(req,res)=>app.handle(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`https://localhost:${server.address().port}`;
  async function browser(name){
    const ctx=await playwright.chromium.launchPersistentContext(path.join(temp,name),{channel:'chromium',headless:true,
      args:[`--disable-extensions-except=${path.resolve('dist')}`,`--load-extension=${path.resolve('dist')}`]});
    contexts.push(ctx); let[worker]=ctx.serviceWorkers(); if(!worker)worker=await ctx.waitForEvent('serviceworker');
    const options=await ctx.newPage(); await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
    return{ctx,worker,options};
  }
  const first=await browser('first'); const page=await first.ctx.newPage();
  try { await page.goto(`${base}/app`); }
  catch(error){
    if(!/ERR_CERT/.test(String(error))) throw error;
    report.browserFunctional='BLOCKED: provide browser-trusted SCHEDULE_TEST_TLS_CERT and SCHEDULE_TEST_TLS_KEY paths';
    report.results.push({name:'untrusted TLS refused by real browser',passed:true});
    process.exitCode=2;
  }
  if(!process.exitCode){
    const email='fixture@ringcentral.com';
    async function bind(b){
      const panel=b.options.locator('#personal-schedule-config');
      await panel.getByLabel('Schedule 服务地址',{exact:true}).fill(base);
      await panel.getByLabel('Schedule 登录邮箱',{exact:true}).fill(email);
      await panel.getByRole('button',{name:'发送邮箱验证码',exact:true}).click();
      await panel.getByRole('status').filter({hasText:'验证码已发送'}).waitFor();
      await panel.getByLabel('Schedule 邮箱验证码',{exact:true}).fill(codes.get(email));
      await panel.getByRole('button',{name:'验证邮箱并绑定此设备',exact:true}).click();
      await panel.getByRole('status').filter({hasText:`已绑定 ${email}`}).waitFor();
    }
    await bind(first); await first.ctx.clearCookies();
    const exchanged=page.waitForResponse(r=>r.url().endsWith('/auth/bridge/exchange')&&r.status()===200);
    await page.reload(); await exchanged; await page.waitForEvent('load');
    const me=await page.evaluate(async()=> (await fetch('/api/v1/me')).json());
    assert.equal(me.email,email); assert.equal(me.isGuest,false);
    report.results.push({name:'actual extension + actual Schedule automatic exchange',passed:true});
    const cookies=await first.ctx.cookies(); assert(cookies.find(c=>c.name==='ps_session').httpOnly);
    assert(!(await page.evaluate(()=>document.cookie)).includes('ps_session'));
    report.results.push({name:'HttpOnly cookie inaccessible to webpage script',passed:true});
    const second=await browser('second'); await bind(second);
    assert.equal(db.prepare('SELECT count(*) n FROM users WHERE email=?').get(email).n,1);
    assert.equal(db.prepare('SELECT count(*) n FROM tokens WHERE user_id=?').get(me.id).n,2);
    report.results.push({name:'independent second profile restores same server account',passed:true});
    const other=services.auth.ensureUser('other@ringcentral.com');
    await first.ctx.addCookies([{name:'ps_session',value:services.auth.createSession(other.id,null),url:base,httpOnly:true}]);
    await page.reload(); await page.waitForTimeout(650);
    assert.equal((await page.evaluate(async()=> (await fetch('/api/v1/me')).json())).id,other.id);
    report.results.push({name:'extension does not silently replace an existing real account',passed:true});
    const deviceToken=await first.worker.evaluate(async()=>
      (await chrome.storage.local.get('personalScheduleConnection')).personalScheduleConnection.token);
    const tokenId=services.auth.tokenIdByBearer(deviceToken);
    assert.equal(await first.options.evaluate(async({base,tokenId})=>{
      const c=(await chrome.storage.local.get('personalScheduleConnection')).personalScheduleConnection;
      return(await fetch(`${base}/api/v1/auth/tokens/${tokenId}`,{method:'DELETE',headers:{Authorization:`Bearer ${c.token}`}})).status;
    },{base,tokenId}),200);
    await first.ctx.clearCookies(); await page.reload(); await page.waitForTimeout(650);
    assert.equal((await page.evaluate(async()=> (await fetch('/api/v1/me')).json())).isGuest,true);
    report.results.push({name:'revoked device cannot automatically log back in',passed:true});
    report.browserFunctional='completed with actual routes; server security assertions are separate';
    const dir=path.resolve('test-results/schedule-auth'); await fs.mkdir(dir,{recursive:true});
    await first.options.locator('#personal-schedule-config').screenshot({path:path.join(dir,'real-email-device-binding.png')});
  }
} catch(error){report.error=String(error);process.exitCode=1;}
finally{
  for(const ctx of contexts)await ctx.close();
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  globalThis.fetch=originalFetch;db.close();await fs.rm(temp,{recursive:true,force:true});
  const dir=path.resolve('test-results/schedule-auth');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'real-browser-bridge.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
