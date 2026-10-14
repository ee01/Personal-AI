import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(path.resolve('desktop-app/package.json'));
const {chromium}=require('playwright');
const profile=await fs.mkdtemp(path.join(os.tmpdir(),'sleep-receipts-e2e-'));
const extension=path.resolve('dist');
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,viewport:{width:1280,height:900},
  args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
let reverted=false,revertCalls=0,stale=false,profilePending=true;
const makeReceipt=(id,state)=>({id,phase:'B',decision:'supersede',state,reason:'较新一手记录替代旧转述',createdAt:1700000000,
  units:[{id:'old',text:'Aurora 等待设计',status:'superseded',observedAt:1699800000,sourceCount:1,sources:[{episodeId:'source-old',evidenceClass:'third_party_report'}]},
    {id:'new',text:'Aurora 已开始开发',status:'active',observedAt:1700000000,sourceCount:2,sources:[{episodeId:'source-new',evidenceClass:'first_party_record'}]}]});
try {
  await context.route('http://localhost:3210/api/v1/**',async route=>{
    const req=route.request(),url=new URL(req.url());let body={},status=200;
    if(url.pathname.endsWith('/reconciliation')) body={receipts:[makeReceipt('applied-one',reverted?'reverted':'applied'),makeReceipt('shadow-one','shadow')]};
    else if(url.pathname.endsWith('/reconciliation/profiles')) body={proposals:profilePending?[{id:'profile-one',value:'我偏好简洁回答',revision:1}]:[]};
    else if(url.pathname.endsWith('/profiles/profile-one/confirm')) {assert.deepEqual(req.postDataJSON(),{accept:false,revision:1});profilePending=false;body={confirmed:false};}
    else if(url.pathname.endsWith('/reconciliation/samples')) body={availablePairs:1,requiredPairs:50,labels:[{decisionId:'shadow-one',expectedDecision:null}]};
    else if(url.pathname.endsWith('/revert')) {revertCalls++;if(stale){status=409;body={error:'newer revision'};}else{reverted=true;body={reverted:true};}}
    else if(url.pathname.includes('/user-files')) body={files:[]};
    else if(url.pathname.endsWith('/stats')) body={messages:0,entities:0};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  let [worker]=context.serviceWorkers();if(!worker) worker=await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>chrome.storage.local.set({userinfo:{username:'receipt-owner'},envConfig:{MEMORY_SERVICE_BASE_URL:'http://localhost:3210/api/v1',MEMORY_SERVICE_API_KEY:'fixture-key'}}));
  const page=await context.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).host}/memory-exploring.html#/dreams`);
  const panel=page.getByRole('region',{name:'夜间记忆整理回执'});
  await panel.getByText('候选判决，未改真值').waitFor();
  await panel.getByRole('button',{name:'不采纳',exact:true}).click();await panel.getByText('我偏好简洁回答',{exact:true}).waitFor({state:'hidden'});
  await panel.getByText('上线人工验收样本',{exact:true}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),panel.getByRole('button',{name:'导出更新判决验收样本'}).click()]);
  const file=await download.path();assert.equal(JSON.parse(await fs.readFile(file,'utf8'))[0].expectedDecision,null);
  assert.equal(await panel.getByRole('button',{name:'撤销这次整理'}).count(),1);
  assert.ok((await panel.getByRole('link',{name:'查看原文'}).first().getAttribute('href')).includes('source-old'));
  await panel.getByRole('button',{name:'撤销这次整理'}).click();await panel.getByText('已撤销',{exact:true}).waitFor();assert.equal(revertCalls,1);
  reverted=false;stale=true;await panel.getByRole('button',{name:'刷新',exact:true}).click();
  await panel.getByRole('button',{name:'撤销这次整理'}).click();await panel.getByRole('alert').waitFor();
  assert.match(await panel.getByRole('alert').innerText(),/未撤销/);assert.equal(revertCalls,2);
  await fs.mkdir('test-results',{recursive:true});await panel.screenshot({path:'test-results/sleep-reconciliation-receipts.png'});
  console.log('PASS fresh-extension receipts: shadow label, source navigation, one-click undo, stale revision error, profile rejection, blind label export');
} finally {await context.close();await fs.rm(profile,{recursive:true,force:true});}
