const SHEET_ID_PATTERN = /^[a-zA-Z0-9-_]{20,}$/;
const SHEET_PATH_PATTERN = /\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/;
const DRIVE_FILE_PATH_PATTERN = /\/file\/d\/([a-zA-Z0-9-_]+)/;

export interface ManualBindSheetInputFeedback {
  sheetId: string | null;
  canonicalSheetUrl: string | null;
  error: string;
}

export function buildSheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

export function extractSheetId(input: string): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const sheetPathMatch = value.match(SHEET_PATH_PATTERN);
  if (sheetPathMatch) {
    return sheetPathMatch[1];
  }

  const driveFileMatch = value.match(DRIVE_FILE_PATH_PATTERN);
  if (driveFileMatch) {
    return driveFileMatch[1];
  }

  try {
    const url = new URL(value);
    const queryId = url.searchParams.get('id');
    if (queryId && SHEET_ID_PATTERN.test(queryId)) {
      return queryId;
    }
  } catch {
    // Not a URL; fall through to raw Sheet ID handling.
  }

  if (SHEET_ID_PATTERN.test(value)) {
    return value;
  }

  return null;
}

export function getManualBindSheetInputFeedback(input: string): ManualBindSheetInputFeedback {
  const value = input.trim();
  if (!value) {
    return {
      sheetId: null,
      canonicalSheetUrl: null,
      error: '',
    };
  }

  const sheetId = extractSheetId(value);
  if (!sheetId) {
    return {
      sheetId: null,
      canonicalSheetUrl: null,
      error: '无法识别 Sheet 链接或 ID，请粘贴 Google Sheet 分享链接、Drive open?id 链接或完整 Sheet ID。',
    };
  }

  return {
    sheetId,
    canonicalSheetUrl: buildSheetUrl(sheetId),
    error: '',
  };
}
