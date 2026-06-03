export const USER_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const USER_ID_FORMAT_DESCRIPTION =
  'Only letters, digits, dots, hyphens, and underscores are allowed.';

export interface UserIdHeaderResolution {
  userId?: string;
  fallbackToDefault?: boolean;
  error?: string;
}

export function normalizeUserId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !USER_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function isValidUserId(userId: string): boolean {
  return USER_ID_PATTERN.test(userId);
}

export function assertValidUserId(userId: string): string {
  const normalized = normalizeUserId(userId);
  if (!normalized) {
    throw new Error(`Invalid userId format. ${USER_ID_FORMAT_DESCRIPTION}`);
  }
  return normalized;
}

export function resolveUserIdHeader(
  rawUserId: string | string[] | undefined,
): UserIdHeaderResolution {
  if (rawUserId == null) {
    return { userId: 'default', fallbackToDefault: true };
  }

  if (Array.isArray(rawUserId)) {
    return {
      error: 'Invalid X-User-Id format. Provide exactly one X-User-Id header.',
    };
  }

  const trimmed = rawUserId.trim();
  if (!trimmed) {
    return { userId: 'default', fallbackToDefault: true };
  }

  const normalized = normalizeUserId(trimmed);
  if (!normalized) {
    return {
      error: `Invalid X-User-Id format. ${USER_ID_FORMAT_DESCRIPTION}`,
    };
  }

  return { userId: normalized, fallbackToDefault: false };
}
