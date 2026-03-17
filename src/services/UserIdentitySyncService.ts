import { getMemoryServiceClient } from './MemoryServiceClient';

interface UserInfo {
  fullName?: string;
  username?: string;
  userEmail?: string;
}

interface ProfileFactItem {
  id: string;
  itemKey: string;
  itemValue: string;
  sourceKind?: string;
  userConfirmed?: boolean;
  status?: string;
}

interface SyncStats {
  created: string[];
  updated: string[];
  skipped: string[];
}

const PLACEHOLDER_VALUES = new Set([
  '',
  'unknown',
  'n/a',
  'na',
  'none',
  'null',
  '-',
  '_',
]);

function cleanValue(value?: string): string {
  return (value || '').trim();
}

function normalizeComparable(value?: string): string {
  return cleanValue(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlaceholder(value?: string): boolean {
  return PLACEHOLDER_VALUES.has(normalizeComparable(value));
}

function deriveIdentityFacts(userinfo: UserInfo): Array<{ key: string; value: string }> {
  const facts: Array<{ key: string; value: string }> = [];
  const fullName = cleanValue(userinfo.fullName);
  const username = cleanValue(userinfo.username);
  const timezone = cleanValue(Intl.DateTimeFormat().resolvedOptions().timeZone);

  if (fullName || username) {
    facts.push({
      key: 'name',
      value: fullName || username,
    });
  }

  if (timezone) {
    facts.push({
      key: 'timezone',
      value: timezone,
    });
  }

  return facts;
}

function shouldReplaceExistingFact(
  existing: ProfileFactItem,
  key: string,
  nextValue: string,
  userinfo: UserInfo,
): boolean {
  const currentValue = cleanValue(existing.itemValue);
  if (!currentValue || isPlaceholder(currentValue)) {
    return true;
  }

  if (normalizeComparable(currentValue) === normalizeComparable(nextValue)) {
    return false;
  }

  // Upgrade username-like placeholders to the real display name when available.
  if (key === 'name') {
    const username = cleanValue(userinfo.username);
    const fullName = cleanValue(userinfo.fullName);
    const currentNormalized = normalizeComparable(currentValue);
    const usernameNormalized = normalizeComparable(username);
    const fullNameNormalized = normalizeComparable(fullName);

    if (
      fullNameNormalized &&
      currentNormalized === usernameNormalized &&
      currentNormalized !== fullNameNormalized
    ) {
      return true;
    }
  }

  // Do not overwrite a non-empty explicit/user-confirmed value automatically.
  if (existing.userConfirmed || existing.sourceKind === 'explicit') {
    return false;
  }

  return false;
}

export async function syncUserIdentityToMemory(
  userinfo?: UserInfo | null,
): Promise<SyncStats> {
  const stats: SyncStats = {
    created: [],
    updated: [],
    skipped: [],
  };

  if (!userinfo) {
    return stats;
  }

  const username = cleanValue(userinfo.username);
  const facts = deriveIdentityFacts(userinfo);
  if (facts.length === 0) {
    return stats;
  }

  const client = getMemoryServiceClient();
  if (username) {
    client.setUserId(username);
  }

  let existingFacts: ProfileFactItem[] = [];
  try {
    const result = await client.getProfileItems({
      type: 'fact',
      status: 'active',
      limit: 100,
    });
    existingFacts = (result.items || []) as ProfileFactItem[];
  } catch (error) {
    console.warn('Failed to load existing profile facts before identity sync:', error);
  }

  for (const fact of facts) {
    const matches = existingFacts.filter((item) => item.itemKey === fact.key);
    const exact = matches.find(
      (item) => normalizeComparable(item.itemValue) === normalizeComparable(fact.value),
    );

    if (exact) {
      stats.skipped.push(fact.key);
      continue;
    }

    const existing = matches[0];
    if (!existing) {
      await client.createProfileItem({
        itemType: 'fact',
        itemKey: fact.key,
        itemValue: fact.value,
        confidence: 1.0,
      });
      stats.created.push(fact.key);
      existingFacts.unshift({
        id: '',
        itemKey: fact.key,
        itemValue: fact.value,
        sourceKind: 'explicit',
        userConfirmed: true,
        status: 'active',
      });
      continue;
    }

    if (shouldReplaceExistingFact(existing, fact.key, fact.value, userinfo)) {
      await client.updateProfileItem(existing.id, {
        itemValue: fact.value,
        confidence: 1.0,
      });
      stats.updated.push(fact.key);
      existing.itemValue = fact.value;
      continue;
    }

    stats.skipped.push(fact.key);
  }

  return stats;
}

export async function syncStoredUserIdentityToMemory(): Promise<SyncStats> {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
    return { created: [], updated: [], skipped: [] };
  }

  try {
    const result = (await chrome.storage.local.get('userinfo')) as {
      userinfo?: UserInfo;
    };
    return await syncUserIdentityToMemory(result.userinfo);
  } catch (error) {
    console.warn('Failed to sync stored user identity to memory:', error);
    return { created: [], updated: [], skipped: [] };
  }
}
