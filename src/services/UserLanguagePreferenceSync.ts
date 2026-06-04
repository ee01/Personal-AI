import type { UiLanguage } from '../i18n';
import type { MemoryServiceClient } from './MemoryServiceClient';

export const USER_LANGUAGE_PROFILE_ITEM_KEY = 'language_preference';

export function buildUserLanguagePreferenceValue(
  language: UiLanguage,
): string {
  if (language === 'en-US') {
    return 'Reply and generate user-facing content in English.';
  }
  return '回复和生成面向用户的内容时使用中文';
}

export async function syncUserLanguagePreferenceProfileItem(
  language: UiLanguage,
  client: MemoryServiceClient,
): Promise<{ operation: 'created' | 'updated' | 'unchanged'; item?: any }> {
  const itemValue = buildUserLanguagePreferenceValue(language);
  const existingItems = await client.getProfileItems({
    type: 'preference',
    status: 'active',
    key: USER_LANGUAGE_PROFILE_ITEM_KEY,
    limit: 10,
  });
  const existing = (existingItems.items || []).find(
    (item) => item?.itemKey === USER_LANGUAGE_PROFILE_ITEM_KEY,
  );

  if (existing?.id) {
    if (existing.itemValue === itemValue && existing.status === 'active') {
      return { operation: 'unchanged', item: existing };
    }
    const item = await client.updateProfileItem(existing.id, {
      itemValue,
      confidence: 1,
      salienceScore: 1,
      status: 'active',
    });
    return { operation: 'updated', item };
  }

  try {
    const item = await client.createProfileItem({
      itemType: 'preference',
      itemKey: USER_LANGUAGE_PROFILE_ITEM_KEY,
      itemValue,
      confidence: 1,
      evidenceRefs: [
        {
          source: 'options.ui_language',
          language,
          snippet: itemValue,
          timestamp: Date.now(),
        },
      ],
    });
    return { operation: 'created', item };
  } catch (error: any) {
    if (error?.status === 409) {
      const retry = await client.getProfileItems({
        type: 'preference',
        status: 'active',
        key: USER_LANGUAGE_PROFILE_ITEM_KEY,
        limit: 10,
      });
      const duplicate = (retry.items || []).find(
        (item) => item?.itemKey === USER_LANGUAGE_PROFILE_ITEM_KEY,
      );
      if (duplicate?.id) {
        return { operation: 'unchanged', item: duplicate };
      }
    }
    throw error;
  }
}
