export function isGoogleSheetsInvalidCredentialError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const hasCredentialReason = /(?:Invalid Credentials|invalid_token|invalid authentication credentials|Login Required)/i.test(message);
  const hasSheets401Status = /(?:读取|写入|更新|添加|删除|获取)[^\n]{0,80}(?:Sheet|Sheets|工作表)[^\n]{0,80}(?:\(401\)|HTTP\s*401|Unauthorized)/i.test(message);
  return hasCredentialReason || hasSheets401Status;
}
