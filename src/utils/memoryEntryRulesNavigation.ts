/**
 * Canonical navigation helper for the Memory Entry Rules surface.
 * Prefer the memory-exploring hash route over the legacy topic-modal popup window.
 *
 * `surface` decides which shell renders around the rules form. See
 * `memoryEntryRulesSurface.ts` for why message-toolbar entries must use `task`.
 */

import type {
  MemoryEntryRulesIntent,
  MemoryEntryRulesSurface,
} from './memoryEntryRulesSurface';

export const MEMORY_ENTRY_RULES_HASH = '/memory-entry-rules';

export function buildMemoryEntryRulesUrl(options?: {
  onboarding?: boolean;
  surface?: MemoryEntryRulesSurface;
  intent?: MemoryEntryRulesIntent;
}): string {
  const params = new URLSearchParams();
  if (options?.onboarding) params.set('onboarding', '1');
  if (options?.surface === 'task') params.set('surface', 'task');
  if (options?.intent && options.intent !== 'manual') {
    params.set('intent', options.intent);
  }
  const query = params.toString();
  return chrome.runtime.getURL(
    `memory-exploring.html#${MEMORY_ENTRY_RULES_HASH}${query ? `?${query}` : ''}`,
  );
}

export async function openMemoryEntryRules(options?: {
  onboarding?: boolean;
  surface?: MemoryEntryRulesSurface;
  intent?: MemoryEntryRulesIntent;
  width?: number;
  height?: number;
  asPopup?: boolean;
}): Promise<void> {
  const url = buildMemoryEntryRulesUrl({
    onboarding: options?.onboarding,
    surface: options?.surface,
    intent: options?.intent,
  });
  if (options?.asPopup && chrome.windows?.create) {
    await chrome.windows.create({
      url,
      type: 'popup',
      width: options.width ?? 1100,
      height: options.height ?? 920,
      focused: true,
    });
    return;
  }
  await chrome.tabs.create({ url, active: true });
}

/**
 * Task-surface popups drop the explorer sidebar and the global search header, so
 * they only need to fit a single rule form.
 */
export const MEMORY_ENTRY_RULES_TASK_POPUP_SIZE = {
  width: 760,
  height: 780,
} as const;
