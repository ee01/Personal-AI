/** Editor-only old-sheet migration assistant. Paste ALONGSIDE template 3.0.x.
 * Select only oldSheetMigration01Diagnose / 02Copy / 03Activate / 04Status.
 * It never sends messages, deletes source properties, resets pending operations,
 * clears Messages/Logs, deploys code, or automatically resumes Jira/triggers.
 */
var OLD_SHEET_MIGRATION = {
  spreadsheetId: 'REPLACE_WITH_YOUR_EXISTING_SPREADSHEET_ID',
  // Set these only after the corresponding real-world checks are complete.
  backupsVerified: false,
  oldWritersRetired: false,
  isolatedValidationPassed: false,
  maxBatchesPerRun: 5
};

function oldSheetMigrationGuard() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('NO_BOUND_SPREADSHEET: open the target spreadsheet > Extensions > Apps Script');
  if (book.getId() !== OLD_SHEET_MIGRATION.spreadsheetId) {
    throw new Error('WRONG_SPREADSHEET: expected=' + OLD_SHEET_MIGRATION.spreadsheetId + ', actual=' + book.getId());
  }
  if (typeof APP_SCRIPT_VERSION === 'undefined' || !/^3[.]0[.][0-9]+$/.test(APP_SCRIPT_VERSION) ||
      typeof maintenanceInitializeExecutionStore !== 'function') {
    throw new Error('TEMPLATE_REQUIRED: paste the complete 3.0.x template in the same project');
  }
  return book;
}

function oldSheetMigrationStage(stage, action) {
  Logger.log(JSON.stringify({ event: 'old_sheet_migration', stage: stage, state: 'START' }));
  try {
    const result = action();
    Logger.log(JSON.stringify({ event: 'old_sheet_migration', stage: stage, state: 'OK', result: result }));
    return result;
  } catch (error) {
    Logger.log(JSON.stringify({ event: 'old_sheet_migration', stage: stage, state: 'STOP', error: String(error) }));
    throw error;
  }
}

function oldSheetMigrationMetadata(book) {
  const response = UrlFetchApp.fetch('https://sheets.googleapis.com/v4/spreadsheets/' +
    book.getId() + '?fields=sheets.properties(sheetId,title,hidden)', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = JSON.parse(response.getContentText());
  if (code !== 200) {
    // Do not log tokens, Config contents, raw mark values or API response bodies.
    const reasons = body.error && body.error.details ? body.error.details.map(function(d) { return d.reason || ''; }).filter(Boolean) : [];
    throw new Error('SHEETS_API_HTTP_' + code + (reasons.length ? ':' + reasons.join(',') : '') +
      ': check API enablement, executing Google identity, spreadsheet access and OAuth scopes');
  }
  return (body.sheets || []).map(function(s) {
    return { title: s.properties.title, hidden: s.properties.hidden === true };
  });
}

function oldSheetMigrationRequireCopyReview() {
  if (OLD_SHEET_MIGRATION.backupsVerified !== true || OLD_SHEET_MIGRATION.oldWritersRetired !== true) {
    throw new Error('REVIEW_REQUIRED: verify spreadsheet/script/mark backups and retire old writers; then set backupsVerified and oldWritersRetired to true');
  }
}

/** Optional mark-only backup. Creates a NEW backup workbook owned by the runner.
 * Does not copy Config/secrets or mutate/delete source properties. Stop old writers
 * first. Base64 preserves malformed raw values as data rather than Sheet formulas.
 */
function oldSheetMigration00BackupMarks() {
  const book = oldSheetMigrationGuard();
  if (OLD_SHEET_MIGRATION.oldWritersRetired !== true) throw new Error('STOP_OLD_WRITERS_BEFORE_BACKUP');
  return oldSheetMigrationStage('00_BACKUP_MARKS', function() {
    const sources = legacyExecutionSources();
    const manifest = executionDigest(JSON.stringify(sources));
    const backup = SpreadsheetApp.create('E125 mark backup ' + new Date().toISOString());
    const sheet = backup.getSheets()[0];
    const values = [['Property_Key', 'Raw_Value_Base64_UTF8', 'Raw_Value_SHA256', 'Source_Spreadsheet_ID']];
    sources.forEach(function(source) {
      values.push([source.key, Utilities.base64Encode(String(source.raw), Utilities.Charset.UTF_8), executionDigest(String(source.raw)), book.getId()]);
    });
    if (values.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
    sheet.getRange(1, 1, values.length, 4).setValues(values);
    SpreadsheetApp.flush();
    if (executionDigest(JSON.stringify(legacyExecutionSources())) !== manifest) throw new Error('SOURCE_CHANGED_DURING_BACKUP: keep old writers stopped and repeat backup');
    return { success: true, sourceSpreadsheetId: book.getId(), records: sources.length, manifest: manifest, backupUrl: backup.getUrl() };
  });
}

/** READ ONLY. Run this first, even if initialize/activate previously failed. */
function oldSheetMigration01Diagnose() {
  return oldSheetMigrationStage('01_DIAGNOSE_READ_ONLY', function() {
    const book = oldSheetMigrationGuard();
    const sheets = oldSheetMigrationMetadata(book);
    const result = {
      spreadsheetId: book.getId(), scriptId: ScriptApp.getScriptId(), version: APP_SCRIPT_VERSION,
      effectiveGoogleAccount: '(not disclosed by Google)',
      sheets: sheets,
      installableTriggers: '(not inspected)',
      legacyMarkProperties: legacyExecutionSources().length
    };
    try { result.effectiveGoogleAccount = Session.getEffectiveUser().getEmail() || '(not disclosed by Google)'; }
    catch (error) { result.effectiveGoogleAccount = '(identity lookup unavailable)'; }
    try {
      result.installableTriggers = ScriptApp.getProjectTriggers().map(function(t) {
        return { handler: t.getHandlerFunction(), event: String(t.getEventType()) };
      });
    } catch (error) { result.installableTriggers = '(trigger lookup unavailable; inspect editor Triggers manually)'; }
    const names = sheets.map(function(s) { return s.title; });
    result.missingBusinessSheets = ['Messages', 'Logs'].filter(function(n) { return names.indexOf(n) < 0; });
    result.missingLedgerSheets = [EXECUTION_LEDGER_SHEET, EXECUTION_CONTROL_SHEET].filter(function(n) { return names.indexOf(n) < 0; });
    if (!result.missingLedgerSheets.length && !result.missingBusinessSheets.length) {
      try { result.store = maintenanceExecutionStoreStatus(); }
      catch (error) { result.storeReadError = String(error); }
    }
    return result;
  });
}

/** Initializes and copies up to 5 batches; rerun this SAME function to resume.
 * Requires backups + stopped/retired old writers; never activates claims.
 */
function oldSheetMigration02Copy() {
  oldSheetMigrationRequireCopyReview();
  const book = oldSheetMigrationGuard();
  const sheets = oldSheetMigrationStage('02A_API_PREFLIGHT', function() { return oldSheetMigrationMetadata(book); });
  const names = sheets.map(function(s) { return s.title; });
  if (names.indexOf('Messages') < 0 || names.indexOf('Logs') < 0) throw new Error('MESSAGES_AND_LOGS_REQUIRED: verify the bound project before creating business sheets');
  if (names.indexOf(EXECUTION_LEDGER_SHEET) >= 0 && names.indexOf(EXECUTION_CONTROL_SHEET) >= 0) {
    const existing = readExecutionStore();
    if (existing.control.mode === 'sheet_primary') throw new Error('ALREADY_ACTIVE: use 04Status; do not recopy or reset the ledger');
  }
  oldSheetMigrationStage('02B_INITIALIZE', function() { return maintenanceInitializeExecutionStore(); });
  const limit = Math.max(1, Math.min(5, Number(OLD_SHEET_MIGRATION.maxBatchesPerRun) || 5));
  let copied;
  for (let i = 0; i < limit; i++) {
    copied = oldSheetMigrationStage('02C_COPY_BATCH', function() { return maintenanceMigrateExecutionMarks(); });
    if (copied.complete) break;
  }
  if (!copied.complete) {
    Logger.log(JSON.stringify({ next: 'Run oldSheetMigration02Copy again; do not activate yet', progress: copied }));
    return copied;
  }
  const status = oldSheetMigrationStage('02D_VERIFY_STATUS', function() { return maintenanceExecutionStoreStatus(); });
  Logger.log(JSON.stringify({ next: 'COPY_COMPLETE_REVIEW_REQUIRED; claims remain paused. Reconcile pending/UNKNOWN before activation.', progress: copied, status: status }));
  return { complete: true, progress: copied, status: status };
}

/** Explicit activation AFTER copy verification and actual isolation validation. */
function oldSheetMigration03Activate() {
  oldSheetMigrationGuard();
  oldSheetMigrationRequireCopyReview();
  if (OLD_SHEET_MIGRATION.isolatedValidationPassed !== true) {
    throw new Error('VALIDATION_REQUIRED: actual isolation validation must pass before setting isolatedValidationPassed=true');
  }
  return oldSheetMigrationStage('03_ACTIVATE_AFTER_REVIEW', function() {
    const status = maintenanceExecutionStoreStatus();
    if (!status.control.migrated) throw new Error('COPY_NOT_COMPLETE: run oldSheetMigration02Copy first');
    if (status.legacyUnknownMessageIds.length) throw new Error('ORPHAN_PENDING_REQUIRES_RECONCILIATION: ' + status.legacyUnknownMessageIds.length);
    if (status.control.mode === 'sheet_primary') return { success: true, mode: 'sheet_primary', alreadyActive: true };
    return maintenanceActivateExecutionStore({ oldWritersRetired: true, isolatedValidationPassed: true });
  });
}

function oldSheetMigration04Status() {
  oldSheetMigrationGuard();
  return oldSheetMigrationStage('04_STATUS_READ_ONLY', function() { return maintenanceExecutionStoreStatus(); });
}
