const WebSocket = require('/Users/Esone/git/personal-ai/node_modules/ws');
const HOST = 'ws://' + [127,0,0,1].join('.') + ':56122';
const ws = new WebSocket(HOST + '/devtools/browser/b3e10b7f-3990-4d0c-9b10-d09daf74e1bf', {maxPayload: 512*1024*1024});
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.result && msg.result.targetInfos) {
    msg.result.targetInfos.filter(t=>t.url.includes('chrome-extension')).forEach(t=>console.log(t.targetId, '|', t.type, '|', t.title.slice(0,60), '|', t.url.slice(0,110)));
    process.exit(0);
  }
});
ws.on('open', () => ws.send(JSON.stringify({id:1, method:'Target.getTargets', params:{}})));
setTimeout(()=>process.exit(1), 5000);
