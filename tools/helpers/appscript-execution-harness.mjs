import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';

// In-memory Sheets API model: validates an entire batch on a copy before commit.
// It deliberately has no Properties writes or CacheService implementation.
export function executionHarness(options = {}) {
  let clock = Date.parse(options.now || '2026-10-23T09:00:00Z');
  let apiReads = 0;
  function Clock(...args) { return new Date(...(args.length ? args : [clock])); }
  Clock.now = () => clock;
  Clock.parse = Date.parse;
  Clock.UTC = Date.UTC;
  Clock.prototype = Date.prototype;
  const headers = ['ID', 'Status', 'Topic', 'Content', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Last_Exec', 'Exec_Count', 'Next_Exec', 'Exec_Log', 'Agent_Last_Run_At', 'Agent_Last_Status', 'Agent_Last_Error'];
  let tables = [
    { id: 1, name: 'Messages', rows: [headers, ['M1', 'Active', 'Hello', 'Body', 'AI', '2026-10-23', '09:00', '', '0', '', '', '', '', '']], maxRows: 1000 },
    { id: 2, name: 'Logs', rows: [], maxRows: 1000 },
  ];
  if (options.data) tables[0].rows = options.data;
  if (options.configRows) tables.push({ id: 3, name: 'Config', rows: options.configRows, maxRows: 1000 });
  const properties = new Map(Object.entries(options.properties || {}));
  const events = [];
  let failure = null;
  let lockHeld = false;
  const sheet = (id) => ({
    getSheetId: () => id,
    getMaxRows: () => tables.find(t => t.id === id).maxRows,
    insertRowAfter(row) { const t = tables.find(t => t.id === id); t.rows.splice(row, 0, []); t.maxRows++; },
    getDataRange: () => ({ getDisplayValues: () => structuredClone(tables.find(t => t.id === id).rows) }),
    getRange: (row, col) => ({
      setValue(value) { this.setValues([[value]]); },
      getDisplayValue() { const t = tables.find(t => t.id === id); return String((t.rows[row - 1] || [])[col - 1] ?? ''); },
      setValues(values) {
        const t = tables.find(t => t.id === id);
        values.forEach((r, i) => r.forEach((v, j) => { t.rows[row - 1 + i] ||= []; t.rows[row - 1 + i][col - 1 + j] = String(v); if (options.onDirectWrite) options.onDirectWrite(id, row + i, col + j, v); }));
      },
    }),
  });
  const book = {
    getId: () => 'test-book',
    getSheets: () => tables.filter(t => !options.staleSheetMetadata || !t.name.startsWith('_Execution')).map(t => sheet(t.id)),
    getSheetByName: name => { if (options.staleSheetMetadata && name.startsWith('_Execution')) return null; const t = tables.find(t => t.name === name); return t ? sheet(t.id) : null; },
  };
  function apply(requests) {
    const copy = structuredClone(tables);
    for (const r of requests) {
      if (r.addSheet) { const p = r.addSheet.properties; if (copy.some(t => t.name === p.title)) throw Error('duplicate_sheet'); copy.push({ id: p.sheetId, name: p.title, rows: [], maxRows: p.gridProperties.rowCount }); }
      else if (r.updateCells) {
        const { start, rows } = r.updateCells;
        const t = copy.find(t => t.id === start.sheetId);
        if (!t || start.rowIndex + rows.length > t.maxRows) throw Error('invalid_grid');
        rows.forEach((row, i) => row.values.forEach((cell, j) => {
          const rr = start.rowIndex + i; t.rows[rr] ||= [];
          t.rows[rr][start.columnIndex + j] = String(cell.userEnteredValue.stringValue ?? cell.userEnteredValue.numberValue);
        }));
      } else if (r.appendDimension) { const p = r.appendDimension; copy.find(t => t.id === p.sheetId).maxRows += p.length; }
      else if (r.insertDimension) { const p = r.insertDimension.range; const t = copy.find(t => t.id === p.sheetId); t.rows.splice(p.startIndex, 0, []); t.maxRows++; }
      else if (r.deleteDimension) { const p = r.deleteDimension.range; const t = copy.find(t => t.id === p.sheetId); t.rows.splice(p.startIndex, p.endIndex - p.startIndex); t.maxRows -= p.endIndex - p.startIndex; }
      else if (!r.addProtectedRange) throw Error('unsupported_request');
    }
    tables = copy;
    if (options.onBatch) options.onBatch(requests, tables);
  }
  const context = vm.createContext({
    Date: Clock, console, Logger: { log: entry => events.push(entry) },
    Session: { getScriptTimeZone: () => 'UTC' },
    Utilities: {
      getUuid: randomUUID,
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, text) => [...createHash('sha256').update(text).digest()],
      formatDate: (date, tz, format) => {
        const iso = date.toISOString();
        if (format === 'yyyy-MM-dd') return iso.slice(0, 10);
        if (format === 'yyyyMMddHHmm') return iso.slice(0, 16).replace(/\D/g, '');
        return iso.slice(0, format.includes('ss') ? 19 : 16).replace('T', ' ');
      },
    },
    LockService: { getScriptLock: () => {
      let owns = false;
      return { waitLock: () => { if (lockHeld) throw Error('lock_timeout'); lockHeld = true; owns = true; }, releaseLock: () => { if (owns) lockHeld = false; } };
    } },
    SpreadsheetApp: { getActiveSpreadsheet: () => book, flush: () => {} },
    ScriptApp: { getOAuthToken: () => 'test-token' },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key) ?? null, getKeys: () => [...properties.keys()],
      setProperty: () => { throw Error('property storage quota'); },
      deleteProperty: key => properties.delete(key),
    }) },
    UrlFetchApp: { fetch: (url, opts) => {
      if (!opts.payload) {
        apiReads++;
        if (failure?.phase === 'read') { const f = failure; failure = null; return { getResponseCode: () => f.code || 403 }; }
        if (new URL(url).searchParams.has('fields')) return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ sheets: tables.map(t => ({ properties: {
            sheetId: t.id, title: t.name, hidden: t.name.startsWith('_Execution'), gridProperties: { rowCount: t.maxRows, columnCount: 100 }
          } })) })
        };
        const ranges = [...new URL(url).searchParams.getAll('ranges')];
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ valueRanges: ranges.map(range => {
          const name = range.match(/^'([^']+)'/)[1];
          let rows = tables.find(t => t.name === name)?.rows || [];
          if (range.endsWith('!1:1')) rows = rows.slice(0, 1);
          return { values: structuredClone(rows) };
        }) }) };
      }
      const requests = JSON.parse(opts.payload).requests;
      const isPrepare = requests.length === 1 && requests[0].updateCells?.start.sheetId === tables.find(t => t.name === '_ExecutionMarkControl')?.id && JSON.parse(requests[0].updateCells.rows[0].values[0].userEnteredValue.stringValue).pending;
      const phase = isPrepare ? 'prepare' : 'commit';
      events.push({ phase, requests: structuredClone(requests) });
      if (failure?.phase === phase) {
        const f = failure; failure = null;
        if (f.apply) apply(requests);
        if (f.throw) throw Error('network_timeout');
        return { getResponseCode: () => f.code || 403 };
      }
      apply(requests);
      return { getResponseCode: () => 200 };
    } },
  });
  vm.runInContext(readFileSync('src/scheduled-messages/app-script-template.gs', 'utf8'), context);
  return {
    context, properties, events, headers,
    apiReads: () => apiReads,
    table: name => tables.find(t => t.name === name),
    cell: name => tables.find(t => t.name === 'Messages').rows[1][headers.indexOf(name)],
    setCell: (name, value) => { tables.find(t => t.name === 'Messages').rows[1][headers.indexOf(name)] = String(value); },
    advance: ms => { clock += ms; },
    fail: spec => { failure = spec; },
    lock: held => { lockHeld = held; },
    initialize() { context.maintenanceInitializeExecutionStore(); },
    activate() { context.maintenanceMigrateExecutionMarks(); return context.maintenanceActivateExecutionStore({ oldWritersRetired: true, isolatedValidationPassed: true }); },
    claim: (key = 'k1', id = 'M1', row = 2) => context.claimMessagePending(id, row, null, key),
    confirm: (key = 'k1', success = true, id = 'M1', row = 2) => context.markBotMessageExecuted(id, row, success, '', '', '', key),
    records() { return context.readExecutionStore().entries.map(e => e.record); },
  };
}
