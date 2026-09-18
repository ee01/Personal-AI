const WebSocket = require('/Users/Esone/git/personal-ai/node_modules/ws');
const ws = new WebSocket('ws://127.0.0.1:56122/devtools/browser/b3e10b7f-3990-4d0c-9b10-d09daf74e1bf', {maxPayload: 64*1024*1024});
ws.on('open', () => { console.log('OPEN'); ws.send(JSON.stringify({id:1, method:'Target.getTargets', params:{}})); });
ws.on('message', m => { console.log(String(m).slice(0,600)); ws.close(); process.exit(0); });
ws.on('error', e => console.log('ERR', e.message));
setTimeout(()=>{console.log('TIMEOUT');process.exit(1)}, 4000);
