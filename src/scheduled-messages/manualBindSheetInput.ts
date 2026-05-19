const SHEET_ID_PATTERN = /^[a-zA-Z0-9-_]{20,}$/;
const SHEET_PATH_PATTERN = /^\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]{20,})(?:[/?#]|$)/;
const DRIVE_FILE_PATH_PATTERN = /^\/file\/d\/([a-zA-Z0-9-_]{20,})(?:[/?#]|$)/;

function isGoogleSheetsHost(hostname: string): boolean {
  return hostname.toLowerCase() === 'docs.google.com';
}

function isGoogleDriveHost(hostname: string): boolean {
  return hostname.toLowerCase() === 'drive.google.com';
}

function extractSheetIdFromOfficialUrl(url: URL): string | null {
  if (isGoogleSheetsHost(url.hostname)) {
    const sheetPathMatch = url.pathname.match(SHEET_PATH_PATTERN);
    return sheetPathMatch ? sheetPathMatch[1] : null;
  }

  if (isGoogleDriveHost(url.hostname)) {
    const driveFileMatch = url.pathname.match(DRIVE_FILE_PATH_PATTERN);
    if (driveFileMatch) {
      return driveFileMatch[1];
    }

    const queryId = url.searchParams.get('id');
    if (queryId && SHEET_ID_PATTERN.test(queryId)) {
      return queryId;
    }
  }

  return null;
}

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

  try {
    const url = new URL(value);
    return extractSheetIdFromOfficialUrl(url);
  } catch {
    // Not a full URL; fall through to path-only and raw Sheet ID handling.
  }

  const sheetPathMatch = value.match(SHEET_PATH_PATTERN);
  if (sheetPathMatch) {
    return sheetPathMatch[1];
  }

  const driveFileMatch = value.match(DRIVE_FILE_PATH_PATTERN);
  if (driveFileMatch) {
    return driveFileMatch[1];
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
      error: '无法识别 Sheet 链接或 ID，请粘贴 Google Sheets 分享链接、Google Drive open?id 链接或完整 Sheet ID。',
    };
  }

  return {
    sheetId,
    canonicalSheetUrl: buildSheetUrl(sheetId),
    error: '',
  };
}
