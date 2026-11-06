import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const memory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(process.env.SCHEDULE_SOURCE||path.join(memory,'../personal-schedule/service'));
const playwright=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||path.join(memory,'desktop-app/node_modules/playwright/index.js')).href);
const {chromium}=playwright.default||playwright;
const out=path.resolve(process.env.SCHEDULE_INSTALL_OUTPUT||path.join(memory,'test-results/schedule-install'));await fs.mkdir(out,{recursive:true});
const {openDb}=await import(pathToFileURL(path.join(source,'src/db.js')));
const {buildApp}=await import(pathToFileURL(path.join(source,'src/server.js')));
const {listen}=await import(pathToFileURL(path.join(source,'src/http.js')));
const db=openDb(':memory:');const {app,services}=buildApp(db);
let server,browser,context,failure=null;const profile=await fs.mkdtemp(path.join(os.tmpdir(),'e184-install-profile-'));const checks=[],errors=[];
const check=(id,expected,actual)=>checks.push({id,expected,actual,passed:JSON.stringify(expected)===JSON.stringify(actual)});
try {
 server=await listen(app,{host:'127.0.0.1',port:3230});const base='http://127.0.0.1:3230';
 const owner=services.auth.ensureUser('controlled-owner@ringcentral.com');const ownerToken=services.auth.issueToken(owner.id);
 const api=async(p,method='GET',body,token=ownerToken)=>{const r=await fetch(base+'/api/v1'+p,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
 const tag=(await api('/tags','POST',{name:'受控安装续导入'})).body;
 for(const title of ['保留任务','取消任务'])await api('/tasks','POST',{type:'asme',title,content:'Controlled draft; never send',tagIds:[tag.id],status:'draft',scheduleSpec:{kind:'rate',intervalMinutes:120}});
 const share=(await api('/tags/'+tag.id+'/share','POST',{})).body.share;
 context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH||'/Users/Esone/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 browser=context.browser();await context.setDefaultTimeout(15000);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/app');await page.waitForSelector('#btnNew');
 const receiver=await page.evaluate(async()=> (await fetch('/api/v1/me')).json());
 check('receiver-is-single-device',true,receiver.isGuest);
 const personal=await page.evaluate(async()=> (await fetch('/api/v1/auth/tokens',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:'controlled-install-only'})})).json());
 await page.goto(base+'/share/'+share.token);await page.locator('input[data-i]').last().uncheck();
 check('before-install-web-selection',[true,false],await page.locator('input[data-i]').evaluateAll(xs=>xs.map(x=>x.checked)));
 check('before-install-no-extension',0,await page.locator('#personal-schedule-extension').count());
 // Actual Chrome extension load into a browser that already has the share tab open.
 // This is unpacked developer installation, not a Web Store installation claim.
 const cdp=browser?await browser.newBrowserCDPSession():await context.newCDPSession(page);const installed=await cdp.send('Extensions.loadUnpacked',{path:path.join(memory,'dist')});
 await new Promise(r=>setTimeout(r,500));
 await fs.writeFile(path.join(out,'runtime-installation.json'),JSON.stringify({installed,workers:context.serviceWorkers().map(w=>w.url()),tabs:context.serviceWorkers()[0]?await context.serviceWorkers()[0].evaluate(async()=>(await chrome.tabs.query({})).map(t=>({url:t.url}))):[]},null,2));
 const panel=page.locator('#personal-schedule-extension');await panel.waitFor();
 await panel.getByRole('status').filter({hasText:'请先在扩展设置中授权'}).waitFor();
 check('actual-extension-installed',true,Boolean(installed.id));
 check('installed-unconfigured-shows-setup',true,(await panel.getByRole('status').innerText()).includes('请先在扩展设置中授权'));
 await page.screenshot({path:path.join(out,'installed-needs-connection.png')});
 const setupTab=context.waitForEvent('page');await panel.getByRole('button',{name:'配置 / 切换 Schedule 账户'}).click();const options=await setupTab;await options.waitForLoadState();
 await options.locator('#personal-schedule-config').waitFor();
 await options.getByLabel('Schedule 服务地址',{exact:true}).fill(base);
 await options.locator('#personal-schedule-config details').first().locator('summary').click();
 await options.getByLabel('Schedule API Token',{exact:true}).fill(personal.token);
 await options.getByRole('button',{name:'连接并保存',exact:true}).click();
 await panel.getByRole('status').filter({hasText:'已恢复此前勾选'}).waitFor();
 check('after-setup-no-reload-selection',[true,false],await panel.locator('input[type=checkbox]').evaluateAll(xs=>xs.map(x=>x.checked)));
 check('setup-preserves-single-device-account',receiver.id,(await api('/me','GET',undefined,personal.token)).body.id);
 const before=await api('/tasks','GET',undefined,personal.token);check('before-explicit-import-no-write',0,before.body.length);
 await page.screenshot({path:path.join(out,'restored-selection.png')});
 // A real setup reinjection must retain an explicit empty set too.
 await panel.locator('input[type=checkbox]').first().uncheck();
 await options.evaluate(()=>chrome.runtime.sendMessage({type:'SCHEDULE_SETUP_SAVED'}));
 await panel.getByRole('status').filter({hasText:'已恢复此前勾选'}).waitFor();
 check('empty-selection-preserved',[false,false],await panel.locator('input[type=checkbox]').evaluateAll(xs=>xs.map(x=>x.checked)));
 await panel.locator('input[type=checkbox]').first().check();
 await options.evaluate(()=>chrome.runtime.sendMessage({type:'SCHEDULE_SETUP_SAVED'}));
 await panel.getByRole('status').filter({hasText:'已恢复此前勾选'}).waitFor();
 check('repeated-setup-preserves-selection',[true,false],await panel.locator('input[type=checkbox]').evaluateAll(xs=>xs.map(x=>x.checked)));
 await panel.getByRole('button',{name:'导入勾选任务',exact:true}).dblclick();
 await panel.getByRole('status').filter({hasText:'导入副本默认未启用'}).waitFor();
 let imported=(await api('/tasks','GET',undefined,personal.token)).body;
 check('selected-only-single-import',['保留任务'],imported.map(t=>t.title));
 check('never-enabled',true,imported.every(t=>t.status!=='active'&&!t.config.chatId));
 await panel.getByRole('button',{name:'查看 / 重放本次导入结果',exact:true}).click();
 check('replay-no-extra-copy',1,(await api('/tasks','GET',undefined,personal.token)).body.length);
 await page.screenshot({path:path.join(out,'actual-extension-imported.png')});
 check('no-page-errors',[],errors);
 const info=await api('/extension/info');
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({checks,extensionVersion:JSON.parse(await fs.readFile(path.join(memory,'dist/manifest.json'),'utf8')).version,extensionInstallation:'actual CDP loadUnpacked after opening share; not a Web Store install',serviceInfo:info.body,identity:'single-device throughout; existing locally-issued PAT configured through actual Options; no email bridge',cleanup:'pending'},null,2));
 if(checks.some(c=>!c.passed))process.exitCode=1;
} catch(e){failure=String(e.stack||e);await fs.writeFile(path.join(out,'failure.txt'),String(e.stack||e));console.error(String(e));process.exitCode=1;}
finally {
 if(context)await context.close();await fs.rm(profile,{recursive:true,force:true});services.runner.stop();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}db.close();
 const p=path.join(out,'report.json');let r;try{r=JSON.parse(await fs.readFile(p,'utf8'));}catch{r={checks};}r.fatal=failure;r.cleanup={profileRemoved:true,browserClosed:true,runnerStopped:true,serverClosed:true,inMemoryDatabaseClosed:true,productionWrites:0};await fs.writeFile(p,JSON.stringify(r,null,2));console.log(JSON.stringify({passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed),fatal:failure,cleanup:r.cleanup}));
}
