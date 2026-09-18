const WebSocket = require('/Users/Esone/git/personal-ai/node_modules/ws');
const HOST = 'ws://' + [127,0,0,1].join('.') + ':56122';
const browserPath = '/devtools/browser/b3e10b7f-3990-4d0c-9b10-d09daf74e1bf';

async function withBrowser(fn) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(HOST + browserPath, {maxPayload: 512*1024*1024});
    let msgId = 0; const pending = new Map(); const innerPending = new Map();
    const sessions = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); p(msg); }
      else if (msg.method === 'Target.receivedMessageFromTarget') {
        const inner = JSON.parse(msg.params.message);
        if (inner.id && innerPending.has(inner.id)) { const p = innerPending.get(inner.id); innerPending.delete(inner.id); p(inner); }
      }
    });
    ws.on('open', async () => { try { await fn({send: (method, params, sessionId) => new Promise((res2, rej2) => {
        const id = ++msgId;
        if (sessionId) innerPending.set(id, res2); else pending.set(id, res2);
        ws.send(JSON.stringify({id, method, params, ...(sessionId?{sessionId}:{})}));
      }), rawWs: ws }); }
      catch(e){ reject(e); } });
    ws.on('error', reject);
    setTimeout(()=>reject(new Error('timeout')), 120000);
  });
}

(async () => {
  const sws = [];
  await withBrowser(async ({send}) => {
    const r = await send('Target.getTargets', {});
    r.result.targetInfos.filter(t=>t.type==='service_worker').forEach(t=>sws.push(t));
  }).catch(e=>console.error('ERR1', e.message));
  for (const t of sws) {
    try {
      const out = await withBrowser(async ({send}) => {
        const a = await send('Target.attachToTarget', {targetId: t.targetId, flatten: true});
        const sessionId = a.result.sessionId;
        const r = await send('Runtime.evaluate', {expression: `(()=>{try{return JSON.stringify({name:(chrome.runtime.getManifest&&chrome.runtime.getManifest().name)||'?',id:chrome.runtime.id,hasIdentity:!!chrome.identity})}catch(e){return 'ERR '+e.message}})()`, returnByValue: true}, sessionId);
        return r.result && r.result.result ? r.result.result.value : JSON.stringify(r).slice(0,200);
      });
      console.log(t.targetId.slice(0,8), t.url.replace('chrome-extension://','').slice(0,70), '=>', out);
    } catch (e) {
      console.log(t.targetId.slice(0,8), t.url.replace('chrome-extension://','').slice(0,70), '=> ATTACH FAIL', e.message);
    }
  }
  process.exit(0);
})();
