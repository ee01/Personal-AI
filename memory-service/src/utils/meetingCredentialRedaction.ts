const MEETING_ID_PATTERN =
  /((?:meeting\s*(?:id|number)|会议(?:\s*id|号)|会议号码)\s*[:：=]\s*)(?:\d[\s-]?){6,}/gi;

const MEETING_SECRET_PATTERN =
  /((?:password|passcode|pwd|host\s*key|access\s*code|密码|口令|主持人密钥|访问码)\s*[:：=]\s*)[^\s<;,，；]+/gi;

export function redactMeetingCredentials(value: unknown): string {
  return String(value || '')
    .replace(MEETING_ID_PATTERN, '$1[redacted]')
    .replace(MEETING_SECRET_PATTERN, '$1[redacted]');
}
