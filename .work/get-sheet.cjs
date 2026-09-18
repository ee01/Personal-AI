const { execSync } = require('child_process');
const expr = `
(async () => {
  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false, scopes: ['https://www.googleapis.com/auth/spreadsheets'] }, (t) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(t);
    });
  });
  const sheetId = '1_E0sei4HkBGScliHHQNlbS2l4E9yZHJJEv7ehPmwulU';
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '?fields=sheets.properties', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const meta = await res.json();
  return (meta.sheets || []).map(s => s.properties.title + ' | gid=' + s.properties.sheetId);
})()
`;
execSync(`node cdp-eval.cjs "${expr.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: 'inherit', maxBuffer: 64*1024*1024 });
