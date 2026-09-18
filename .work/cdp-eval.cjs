const WebSocket = require('/Users/Esone/git/personal-ai/node_modules/ws');
const HOST = 'ws://' + [127,0,0,1].join('.') + ':56122';

const expr = process.argv[2];
const urlFilter = process.argv[3] || 'iehgbogeakiedihodennfcnigojnncag/background.js';
const awaitPromise = process.argv[4] !== 'false';

const ws = new WebSocket(HOST + '/devtools/browser/b3e10b7f-3990-4d0c-9b10-d09daf74e1bf', {maxPayload: 512*1024*1024});
let msgId = 0;
const pending = new Map();

function send(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
}

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.id && pending.has(msg.id)) {
    const {resolve} = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg);
  } else if (msg.method === 'Target.receivedMessageFromTarget') {
    const inner = JSON.parse(msg.params.message);
    if (inner.id && pending.has(inner.id)) {
      const {resolve} = pending.get(inner.id);
      pending.delete(inner.id);
      resolve(inner);
    }
  }
});

ws.on('open', async () => {
  try {
    const targets = await send('Target.getTargets', {});
    const t = targets.result.targetInfos.find(t => t.url.includes(urlFilter));
    if (!t) { console.error('TARGET NOT FOUND. Targets:'); targets.result.targetInfos.forEach(x=>console.error(x.type, x.url)); process.exit(2); }
    const {result: {sessionId}} = await send('Target.attachToTarget', {targetId: t.targetId, flatten: true});
    const res = await send('Runtime.evaluate', {expression: expr, awaitPromise, returnByValue: true}, sessionId);
    if (res.result) {
      if (res.result.exceptionDetails) {
        console.error('EXCEPTION:', JSON.stringify(res.result.exceptionDetails, null, 2).slice(0, 2000));
      }
      console.log(JSON.stringify(res.result.result?.value, null, 2));
    } else {
      console.log(JSON.stringify(res).slice(0, 2000));
    }
    process.exit(0);
  } catch (e) { console.error('ERR', e.message); process.exit(1); }
});
ws.on('error', e => { console.error('WSERR', e.message); process.exit(1); });
setTimeout(()=>{console.error('TIMEOUT');process.exit(1)}, 60000);
