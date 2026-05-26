import { ref } from 'vue';
import {
  applyDocumentLanguage,
  DEFAULT_UI_LANGUAGE,
  readExtensionUiPreferences,
  t,
  UiLanguage,
  UiMessageParams,
  watchExtensionUiLanguage,
} from './index.js';

export const extensionUiLanguage = ref<UiLanguage>(DEFAULT_UI_LANGUAGE);

let initialized = false;
let unsubscribe: (() => void) | null = null;

export function initExtensionVueI18n(): () => void {
  if (!initialized) {
    initialized = true;
    void readExtensionUiPreferences().then((preferences) => {
      extensionUiLanguage.value = preferences.language;
      applyDocumentLanguage(preferences.language);
    });
    unsubscribe = watchExtensionUiLanguage((preferences) => {
      extensionUiLanguage.value = preferences.language;
      applyDocumentLanguage(preferences.language);
    });
  }
  return () => {
    unsubscribe?.();
    unsubscribe = null;
    initialized = false;
  };
}

export function vueT(key: string, params?: UiMessageParams): string {
  return t(key, params, extensionUiLanguage.value);
}
