import {
  getMemoryServiceClient,
  MemoryServiceClient,
} from './MemoryServiceClient';
import { sanitizeIndependentUserConfig } from './userConfigSanitizer';

export const INDEPENDENT_USER_CONFIG_ITEM_TYPE = 'preference';
export const INDEPENDENT_USER_CONFIG_ITEM_KEY =
  'personal_ai_independent_user_config';
export const EXPLICIT_USER_CONTEXT_ITEM_TYPE = 'preference';
export const EXPLICIT_USER_CONTEXT_ITEM_KEY =
  'personal_ai_explicit_user_context_config';

type JsonConfig = Record<string, any>;

function getConfigTimestamp(config: any): number {
  const candidates = [
    config?.lastUpdated,
    config?.updatedAt,
    config?.userContextConfig?.lastUpdated,
    config?.userContextConfig?.updatedAt,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return 0;
}

function parseProfileItemValue(item: any): any {
  const rawValue = item?.itemValue ?? item?.item_value;
  if (typeof rawValue !== 'string') return rawValue ?? null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

function pickLatestProfileItem(items: any[]): any | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  return [...items].sort((a, b) => {
    const bConfig = parseProfileItemValue(b);
    const aConfig = parseProfileItemValue(a);
    const bTime =
      getConfigTimestamp(bConfig) || Number(b.updatedAt || b.createdAt || 0);
    const aTime =
      getConfigTimestamp(aConfig) || Number(a.updatedAt || a.createdAt || 0);
    return bTime - aTime;
  })[0];
}

async function listConfigItems(
  client: MemoryServiceClient,
  itemType: string,
  itemKey: string,
): Promise<any[]> {
  const result = await client.getProfileItems({
    type: itemType,
    key: itemKey,
    limit: 200,
  });

  return Array.isArray(result.items) ? result.items : [];
}

export async function getJsonConfigProfileItem(
  itemType: string,
  itemKey: string,
  client: MemoryServiceClient = getMemoryServiceClient(),
): Promise<{ item: any | null; config: any | null }> {
  const item = pickLatestProfileItem(
    await listConfigItems(client, itemType, itemKey),
  );

  return {
    item,
    config: item ? parseProfileItemValue(item) : null,
  };
}

export async function upsertJsonConfigProfileItem(
  params: {
    itemType: string;
    itemKey: string;
    config: JsonConfig;
  },
  client: MemoryServiceClient = getMemoryServiceClient(),
): Promise<{ item: any; config: JsonConfig; operation: 'created' | 'updated' }> {
  const configWithMetadata = {
    ...params.config,
    lastUpdated: Date.now(),
    version: params.config.version || '1.0',
  };
  const itemValue = JSON.stringify(configWithMetadata);
  const existing = (
    await getJsonConfigProfileItem(params.itemType, params.itemKey, client)
  ).item;

  if (existing?.id) {
    const item = await client.updateProfileItem(existing.id, {
      itemValue,
      confidence: 1.0,
      status: 'active',
    });
    return { item, config: configWithMetadata, operation: 'updated' };
  }

  try {
    const item = await client.createProfileItem({
      itemType: params.itemType,
      itemKey: params.itemKey,
      itemValue,
      confidence: 1.0,
    });
    return { item, config: configWithMetadata, operation: 'created' };
  } catch (error: any) {
    if (error?.status === 409 || /409|same key and value/i.test(String(error))) {
      const duplicate = (
        await getJsonConfigProfileItem(params.itemType, params.itemKey, client)
      ).item;
      if (duplicate?.id) {
        return { item: duplicate, config: configWithMetadata, operation: 'updated' };
      }
    }
    throw error;
  }
}

export async function getIndependentUserConfig(
  client: MemoryServiceClient = getMemoryServiceClient(),
): Promise<any | null> {
  const result = await getJsonConfigProfileItem(
    INDEPENDENT_USER_CONFIG_ITEM_TYPE,
    INDEPENDENT_USER_CONFIG_ITEM_KEY,
    client,
  );
  return result.config;
}

export async function storeIndependentUserConfig(
  config: JsonConfig,
  client: MemoryServiceClient = getMemoryServiceClient(),
) {
  return upsertJsonConfigProfileItem(
    {
      itemType: INDEPENDENT_USER_CONFIG_ITEM_TYPE,
      itemKey: INDEPENDENT_USER_CONFIG_ITEM_KEY,
      config: sanitizeIndependentUserConfig(config),
    },
    client,
  );
}

export async function storeExplicitUserContextConfig(
  userContextConfig: JsonConfig,
  client: MemoryServiceClient = getMemoryServiceClient(),
) {
  return upsertJsonConfigProfileItem(
    {
      itemType: EXPLICIT_USER_CONTEXT_ITEM_TYPE,
      itemKey: EXPLICIT_USER_CONTEXT_ITEM_KEY,
      config: {
        userContextConfig,
      },
    },
    client,
  );
}
