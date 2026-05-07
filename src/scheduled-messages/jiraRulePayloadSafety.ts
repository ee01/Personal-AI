const REDACTED_VALUE = '[REDACTED]';

const SENSITIVE_KEY_PATTERN = /(authorization|api[_-]?key|password|secret|token)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSensitiveHeaderName(value: unknown): boolean {
  return typeof value === 'string' && SENSITIVE_KEY_PATTERN.test(value);
}

function shouldRedactProperty(key: string, value: unknown, sensitiveContext: boolean): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  if (sensitiveContext && (key === 'keyOrValue' || key === 'value')) {
    return true;
  }

  return SENSITIVE_KEY_PATTERN.test(key) && key !== 'name' && key !== 'headerName';
}

function redactValue(value: unknown, sensitiveContext = false): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, sensitiveContext));
  }

  if (!isRecord(value)) {
    return value;
  }

  const currentObjectIsSensitive = value.secret === true || sensitiveContext;
  const headerNameIsSensitive = isSensitiveHeaderName(value.name) || isSensitiveHeaderName(value.headerName);
  const nextSensitiveContext = currentObjectIsSensitive || headerNameIsSensitive;
  const result: Record<string, unknown> = {};

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (shouldRedactProperty(key, nestedValue, nextSensitiveContext)) {
      result[key] = REDACTED_VALUE;
      return;
    }

    result[key] = redactValue(nestedValue, nextSensitiveContext && key === 'value');
  });

  return result;
}

export function redactJiraRulePayloadForLog<T>(payload: T): T {
  return redactValue(payload) as T;
}
