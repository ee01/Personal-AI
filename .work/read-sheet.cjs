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
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sheetId + '/values/Messages?valueRenderOption=FORMATTED_VALUE', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const json = await res.json();
  if (!json.values) return { error: JSON.stringify(json).slice(0, 500) };
  const headers = json.values[0];
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const rows = [];
  for (let i = 1; i < json.values.length; i++) {
    const row = json.values[i];
    rows.push({
      rowNo: i + 1,
      ID: row[idx['ID']] || '',
      Topic: row[idx['Topic']] || '',
      Status: row[idx['Status']] || '',
      Push_Method: row[idx['Push_Method']] || '',
      Category: row[idx['Category']] || '',
      Glip_User_Name: row[idx['Glip_User_Name']] || '',
      Glip_Team_ID: row[idx['Glip_Team_ID']] || '',
      Frequency: row[idx['Frequency']] || '',
      Next_Exec: row[idx['Next_Exec']] || ''
    });
  }
  return { total: rows.length, headers: headers.join('|'), rows: rows };
})()
`;
const cmd = `node cdp-eval.cjs "${expr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}" "hkmimegiefnbeadjoonnlogikcdddcho"`;
const out = execSync(cmd, { maxBuffer: 128*1024*1024 }).toString();
require('fs').writeFileSync('sheet-rows.json', out);
console.log('bytes:', out.length);
