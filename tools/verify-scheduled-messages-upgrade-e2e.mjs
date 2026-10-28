import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import playwright from '../desktop-app/node_modules/playwright/index.js';
const { chromium } = playwright;
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pai-upgrade-e2e-'));
const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`] });
const sourceUrl = 'https://script.google.com/macros/s/old/exec';
const targetUrl = 'https://script.google.com/macros/s/new/exec';
const headers = ['ID','Topic','Content','Schedule_Date','Schedule_Time','Push_Method','Status','Last_Exec','Next_Exec','Exec_Count','Exec_Log'];
const sourceRows = [headers,
 ['sent','Sent today','=literal()','2026-10-23','09:00','Bot','Active','2026-10-23 09:00','','2','✅ 推送成功'],
 ['pending','Unknown delivery','body','2026-10-23','10:00','Bot','Active','2026-10-23 10:00','','0','⏳ API 已领取待确认'],
 ['pending2','Second unknown','body','2026-10-23','10:00','Bot','Active','2026-10-23 10:00','','0','⏳ API 已领取待确认']];
let targetRows = [headers], configRows = [['Key','Value']], targetMode = 'paused', slowHealth = false;
let replayResponseLost = false;
let corruptReadback = false;
let sheetCreates = 0, scriptCreates = 0, failDeployment = true, failJira = false, jiraFailed = false, retirementCode;
let deploymentCreates = 0, deploymentExists = false;
const headDeployment = {deploymentId:'head',deploymentConfig:{scriptId:'new-script'},entryPoints:[{webApp:{url:'https://script.google.com/macros/s/head/exec',entryPointConfig:{access:'ANYONE_ANONYMOUS'}}}]};
const publishedDeployment = {deploymentId:'new',deploymentConfig:{versionNumber:1,scriptId:'new-script'},entryPoints:[{webApp:{url:targetUrl}}]};
const rule = id => ({ id, name: `Custom ${id}`, state: 'ENABLED', trigger: { id: 'old-trigger', type: 'scheduled', value: { cron: '* * * * *' } },
  components: [{ id: 'old-poll', type: 'web', url: sourceUrl+'?action=getBotMessageCurrentTime' }, { type: 'web', url: sourceUrl+'?action=confirmBotMessageTriggered' }, { type: 'custom', url: sourceUrl+'?action=cacheReleaseInfo', customExpression: 'keep-me', children: [{ id: 'old-child', parentId: 'old-parent', type: 'web', value: { id: 'business-id', url: sourceUrl+'?action=confirm' } }], conditions: [{ id: 'old-condition', conditionParentId: 'old-parent', value: { jql: 'status = Open' } }] }], projects: [], tags: [], labels: [] });
let nodeSequence = 0;
// Jira persists new structural node IDs and may return object keys in another order.
const jiraRoundtrip = (value, node = false) => {
  if (Array.isArray(value)) return value.map(item => jiraRoundtrip(item, node));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key,
    node && ['id', 'parentId', 'conditionParentId'].includes(key) ? `server-${++nodeSequence}` : jiraRoundtrip(item, node && ['children', 'conditions'].includes(key))]));
};
const rules = [rule(1),rule(2)];
const calls = [];
const props = ['Messages','Config','Logs'].map((title,i)=>({ properties:{ title, sheetId:i+11,index:i } }));
const errors = [];
try {
  let [worker] = context.serviceWorkers(); worker ||= await context.waitForEvent('serviceworker');
  const origin = `chrome-extension://${new URL(worker.url()).host}`;
  await worker.evaluate(({sourceUrl})=>chrome.storage.local.set({ scheduledMessagesConfig: {
    sheetId:'old-book', sheetUrl:'https://docs.google.com/spreadsheets/d/old-book/edit', scriptId:'old-script', deploymentId:'old', webAppUrl:sourceUrl,
    sheet_version:'2.13', appScriptVersion:'2.9.0', created_by:'test', created_at:'2026-10-23',
    botAutomation:{ executorRule:{ruleId:'1',jiraUrl:'https://jira.example.com',projectKey:'TEST'},timelineSyncRule:{ruleId:'2',jiraUrl:'https://jira.example.com',projectKey:'TEST'} }
  }, envConfig:{JIRA_API_TOKEN:'fixture-token',JIRA_URL:'https://jira.example.com',ENABLE_OUTREACH:false} }),{sourceUrl});
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    chrome.identity.getAuthToken = (_options, cb)=>cb('fixture-google-token');
    chrome.identity.removeCachedAuthToken = (_options, cb)=>cb();
  });
  await page.route('**/*', async route=>{
    const req=route.request(), url=new URL(req.url()), method=req.method();
    if (url.protocol==='chrome-extension:') return route.continue();
    calls.push({url:url.href,method});
    const respond = (body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (url.hostname==='www.googleapis.com') return respond({email:'test@example.com',given_name:'Upgrade Test'});
    if (url.hostname==='sheets.googleapis.com') {
      if (url.pathname==='/v4/spreadsheets' && method==='POST') {sheetCreates++; return respond({spreadsheetId:'new-book',spreadsheetUrl:'https://docs.google.com/spreadsheets/d/new-book/edit',sheets:props});}
      const old=url.pathname.includes('old-book');
      if (url.pathname.endsWith(':batchUpdate')) {
        const body=req.postDataJSON();
        const update=body.requests.find(r=>r.updateCells?.range?.sheetId===11&&r.updateCells.fields==='userEnteredValue');
        if(update) targetRows=update.updateCells.rows.map(r=>r.values.map(v=>v.userEnteredValue.stringValue));
        for(const r of body.requests) {
          if(r.appendCells) targetRows.push(...r.appendCells.rows.map(row=>row.values.map(v=>v.userEnteredValue.stringValue)));
          if(r.updateCells?.start?.sheetId===11) targetRows[r.updateCells.start.rowIndex]=r.updateCells.rows[0].values.map(v=>v.userEnteredValue.stringValue);
        }
        if(body.requests.some(r=>r.appendCells) && !replayResponseLost) { replayResponseLost=true; return route.abort('failed'); }
        return respond({replies:[]});
      }
      if(url.pathname.includes('/values/')) {
        const range=decodeURIComponent(url.pathname.split('/values/')[1]);
        if(method==='PUT') {configRows=req.postDataJSON().values; return respond({updatedRows:configRows.length});}
        if(range.includes('_UpgradeRetirement')) {
          const draft=await page.evaluate(()=>chrome.storage.local.get('scheduledMessagesUpgradeDraft'));
          return respond({values:[['Cutover_ID','Retired_At'],[draft.scheduledMessagesUpgradeDraft.id,'2026-10-23T10:00:00Z']]});
        }
        if(range.includes('Config')) return respond({values:configRows});
        if(range.includes('Logs')) return respond({values:[]});
        return respond({values:old?sourceRows:targetRows});
      }
      return respond({sheets:props});
    }
    if(url.hostname==='script.googleapis.com') {
      if(url.pathname==='/v1/projects'&&method==='POST') {scriptCreates++; return respond({scriptId:'new-script'});}
      if(url.pathname.includes('old-script/content')) {
        if(method==='PUT') {retirementCode=req.postDataJSON(); return respond({});}
        return respond({files:[{name:'Code',type:'SERVER_JS',source:"var APP_SCRIPT_VERSION='2.9.0'; function minuteTrigger(){ executeScheduledMessages(); } function executeScheduledMessages() {}"},{name:'appsscript',type:'JSON',source:'{"runtimeVersion":"V8"}'}]});
      }
      if(url.pathname.endsWith('/content')) return respond({});
      if(url.pathname.endsWith('/versions')) return respond({versionNumber:1});
      if(url.pathname.endsWith('/deployments')&&method==='GET') return url.searchParams.has('pageToken')
        ? respond({deployments:deploymentExists?[publishedDeployment]:[]})
        : respond({deployments:[headDeployment],nextPageToken:'published-page'});
      if(url.pathname.endsWith('/deployments')) {
        deploymentCreates++;
        if(failDeployment) {failDeployment=false;return respond({error:'fixture failure'},403);}
        deploymentExists=true;return respond(publishedDeployment);
      }
    }
    if(url.hostname==='script.google.com') {
      if(url.searchParams.get('action')==='getRuntimeHealth'&&slowHealth) await new Promise(resolve=>setTimeout(resolve,1500));
      if(url.href.startsWith(sourceUrl)) return respond({status:'OK',version:'2.9.0'});
      if(url.searchParams.get('action')==='getVersion')return respond({version:'3.1.0',lastUpdated:'2026-10-23'});
      if(method==='POST') {const data=JSON.parse(req.postData());if(data.operation==='activate')targetMode='sheet_primary';if(data.operation==='pause')targetMode='paused';}
      return respond({success:true,spreadsheetId:'new-book',scriptVersion:'3.1.0',executionStoreSchemaVersion:1,mode:targetMode,ready:targetMode==='sheet_primary',freshCandidate:true});
    }
    if(url.hostname==='jira.example.com') {
      if(url.pathname==='/rest/api/2/project/TEST')return respond({id:'99'});
      if(url.pathname.endsWith('/rule')&&method==='GET')return respond(rules);
      if(method==='PUT') {
        const body=req.postDataJSON();
        if(failJira && !jiraFailed && body.id === 2 && JSON.stringify(body).includes(targetUrl)) {jiraFailed=true;return respond({error:'fixture permission denied'},403);}
        const index=rules.findIndex(r=>r.id===body.id);
        rules[index]={...body,trigger:jiraRoundtrip(body.trigger,true),components:jiraRoundtrip(body.components,true)};
        if(corruptReadback && body.id===2 && body.state==='DISABLED' && JSON.stringify(body).includes(targetUrl)) {
          corruptReadback=false;rules[index].components[0].url=sourceUrl+'?action=getBotMessageCurrentTime';
        }
        return respond(rules[index]);
      }
      return respond({});
    }
    if(url.hostname==='localhost'||url.hostname==='127.0.0.1')return respond({outreachEnabled:false,templates:[],tasks:[]});
    return respond({});
  });
  await page.goto(origin+'/scheduled-messages.html');
  const wizard=page.getByRole('region',{name:'新表升级向导'});
  await wizard.getByText('当前表只读 · 升级到兼容新表',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'➕ 新增',exact:true}).isEnabled(),false);
  assert.equal(calls.some(c=>c.url.includes('old-book')&&c.method!=='GET'),false);
  await wizard.getByRole('button',{name:'开始新表升级',exact:true}).click();
  await wizard.getByRole('button',{name:'创建新表',exact:true}).click();
  await wizard.getByRole('alert').waitFor();
  assert.equal(sheetCreates,1);assert.equal(scriptCreates,1);
  await worker.evaluate(async head=>{const result=await chrome.storage.local.get('scheduledMessagesUpgradeDraft');const d=result.scheduledMessagesUpgradeDraft;d.candidate.webAppUrl=head.entryPoints[0].webApp.url;d.candidate.deploymentId=head.deploymentId;await chrome.storage.local.set({scheduledMessagesUpgradeDraft:d});},headDeployment);
  await wizard.getByRole('button',{name:'继续准备同一张新表',exact:true}).click();
  await wizard.getByRole('button',{name:'已授权，检查新表',exact:true}).waitFor();
  assert.equal(sheetCreates,1);assert.equal(scriptCreates,1);
  assert.equal(deploymentCreates,2,'HEAD-only projects must create a versioned deployment');
  await wizard.getByRole('button',{name:'继续准备同一张新表',exact:true}).click();
  await wizard.getByRole('button',{name:'已授权，检查新表',exact:true}).waitFor();
  assert.equal(deploymentCreates,2,'retries recover the published deployment on a later page');
  const recovered=(await worker.evaluate(()=>chrome.storage.local.get('scheduledMessagesUpgradeDraft'))).scheduledMessagesUpgradeDraft.candidate;
  assert.equal(recovered.webAppUrl,targetUrl);assert.equal(recovered.deploymentId,'new');
  assert.equal((await worker.evaluate(()=>chrome.storage.local.get('scheduledMessagesConfig'))).scheduledMessagesConfig.sheetId,'old-book');
  assert.equal(calls.some(c=>c.url.includes('/permissions')),false,'candidate remains owner-only');
  await wizard.getByRole('button',{name:'已授权，检查新表',exact:true}).click();
  await wizard.getByRole('button',{name:'自动带入并检查',exact:true}).click();
  await wizard.getByRole('heading',{name:'3. 切换到新表',exact:true}).waitFor();
  assert.equal(targetRows[1][2],'=literal()');assert.equal(targetRows[1][9],'2');assert.equal(targetRows[2][6],'Paused');
  await page.reload();
  await wizard.getByRole('heading',{name:'3. 切换到新表',exact:true}).waitFor();
  await wizard.getByRole('button',{name:'停用旧触发器 / 核对回执',exact:true}).click();
  await wizard.getByRole('button',{name:'旧发送触发器已核对',exact:true}).waitFor();
  assert.match(retirementCode.files.find(f=>f.type==='SERVER_JS').source,/PERSONAL_AI_RETIREMENT_V1/);
  const secret=(await worker.evaluate(()=>chrome.storage.local.get('scheduledMessagesUpgradeDraft'))).scheduledMessagesUpgradeDraft.token;
  assert.equal(JSON.stringify(retirementCode).includes(secret),false,'fresh setup secret is never written into old project/receipt');
  assert.equal(calls.some(c=>c.url.includes('old-script/deployments')&&c.method!=='GET'),false);
  await wizard.getByLabel(/我已核对导入、所有账号旧触发器及在途发送状态/).check();
  failJira=true;
  await wizard.getByRole('button',{name:'切换到新表',exact:true}).click();
  await wizard.getByRole('alert').waitFor();
  assert.equal(jiraFailed,true);assert.equal(targetMode,'paused');assert.ok(rules.every(r=>r.state==='DISABLED'));
  assert.equal((await worker.evaluate(()=>chrome.storage.local.get('scheduledMessagesConfig'))).scheduledMessagesConfig.sheetId,'old-book');
  corruptReadback=true;
  await wizard.getByRole('button',{name:'切换到新表',exact:true}).click();
  await wizard.getByRole('alert').filter({hasText:'动作内容或顺序'}).waitFor();
  assert.equal(corruptReadback,false);
  assert.equal(targetMode,'paused');assert.ok(rules.every(r=>r.state==='DISABLED'));
  assert.equal((await worker.evaluate(()=>chrome.storage.local.get('scheduledMessagesConfig'))).scheduledMessagesConfig.sheetId,'old-book');
  await wizard.getByRole('button',{name:'切换到新表',exact:true}).click();
  await wizard.getByRole('heading',{name:'4. 新表已接管',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('fieldset')?.disabled===false);
  assert.equal(await page.getByRole('button',{name:'➕ 新增',exact:true}).isEnabled(),true,'successful cutover reloads the manager and unlocks the candidate without another click');
  const saved=(await worker.evaluate(()=>chrome.storage.local.get('scheduledMessagesConfig'))).scheduledMessagesConfig;
  assert.equal(saved.sheetId,'new-book');assert.equal(targetMode,'sheet_primary');
  for(const r of rules){assert.equal(r.state,'ENABLED');assert.equal(JSON.stringify(r).includes(sourceUrl),false);assert.equal(r.components[2].customExpression,'keep-me');}
  assert.equal(rules[0].components[2].children[0].value.id,'business-id');
  assert.notEqual(rules[0].trigger.id,'old-trigger');
  assert.ok(configRows.some(r=>r[0]==='web_app_url'&&r[1]===targetUrl));
  await wizard.getByRole('button',{name:'检查真实领取回执',exact:true}).click();
  await wizard.getByText(/尚无真实领取；可能暂无到期任务/).waitFor();
  await wizard.getByRole('button',{name:'读取隔离任务与下一次计划',exact:true}).click();
  await wizard.getByRole('button',{name:'现在补发',exact:true}).first().waitFor();
  page.on('dialog',dialog=>dialog.accept());
  await wizard.getByRole('button',{name:'现在补发',exact:true}).first().click();
  await wizard.getByRole('alert').waitFor();
  assert.equal(replayResponseLost,true);
  await wizard.getByRole('button',{name:'现在补发',exact:true}).first().click();
  await wizard.getByText('已创建补发任务',{exact:true}).waitFor();
  assert.equal(targetRows.filter(r=>r[0].startsWith('pending_upgrade_')).length,1);
  assert.equal(targetRows.find(r=>r[0]==='pending')[6],'Paused');
  assert.equal(JSON.stringify(targetRows).includes(secret),false);
  await wizard.getByRole('button',{name:'已发出',exact:true}).click();
  await wizard.getByText('已人工确认发出',{exact:true}).waitFor();
  assert.equal(targetRows.find(r=>r[0]==='pending2')[6],'Done');
  assert.equal(targetRows.find(r=>r[0]==='pending2')[9],'1');
  await wizard.getByRole('button',{name:'进入新表管理',exact:true}).click();
  await page.getByRole('button',{name:'➕ 新增',exact:true}).waitFor();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='➕ 新增')?.disabled);
  assert.equal(await page.getByRole('button',{name:'➕ 新增',exact:true}).isEnabled(),true);
  // A live new-system claim is not an orphan imported from the source sheet.
  targetRows.push(['live-claim','Current claim','body','2026-10-23','10:00','Bot','Active','2026-10-23 10:00','','0','⏳ API 已领取待确认']);
  const beforeRepair=JSON.stringify(targetRows);
  await Promise.all([
    page.waitForEvent('load'),
    wizard.getByRole('button',{name:'修复部署和引用（保留新表数据）',exact:true}).click(),
  ]);
  await page.waitForFunction(()=>document.querySelector('fieldset')?.disabled===false);
  assert.equal(JSON.stringify(targetRows),beforeRepair,'repair of a completed upgrade must not reimport or reset messages');
  assert.equal(deploymentCreates,2,'repair reuses the published deployment');
  await wizard.getByRole('button',{name:'收起向导（保留进度）',exact:true}).click();
  await wizard.waitFor({state:'hidden'});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('fieldset')?.disabled===false);
  assert.equal(await wizard.count(),0,'completed receipt stays collapsed after reload');
  assert.equal((await worker.evaluate(()=>chrome.storage.local.get('scheduledMessagesUpgradeDraft'))).scheduledMessagesUpgradeDraft.stage,'complete','collapsing keeps upgrade history');
  targetMode='paused';
  await page.reload();
  await wizard.getByRole('status').filter({hasText:'paused'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'➕ 新增',exact:true}).isEnabled(),false,'dismissal must not bypass an unhealthy runtime');
  targetMode='sheet_primary';
  await wizard.getByRole('button',{name:'重新检查连接',exact:true}).click();
  await wizard.waitFor({state:'hidden'});
  // A compatible table must stay usable while the runtime check is still pending.
  slowHealth=true;
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('fieldset')!==null);
  assert.equal(await page.evaluate(()=>document.querySelector('fieldset')?.disabled),false,'a pending runtime check must not lock the manager');
  assert.equal(await page.getByRole('button',{name:'➕ 新增',exact:true}).isEnabled(),true,'healthy tables are usable immediately');
  await page.waitForFunction(()=>document.querySelector('fieldset')?.disabled===false);
  assert.equal(await wizard.count(),0,'a healthy table shows no upgrade panel after the check concludes');
  slowHealth=false;
  await fs.mkdir('test-results',{recursive:true});
  await page.screenshot({path:'test-results/scheduled-messages-upgrade.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Upgrade extension E2E passed: read-only, resumable create, import, retirement, partial Jira failure, retry and honest receipt');
} catch(error) { console.error('E2E FAILURE:', String(error?.message || error)); try { console.error(await context.pages().at(-1)?.getByRole('region',{name:'新表升级向导'}).innerText()); } catch {} throw error; } finally {await context.close();await fs.rm(profile,{recursive:true,force:true});}
