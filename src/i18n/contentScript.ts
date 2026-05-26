import {
  applyDocumentLanguage,
  DEFAULT_UI_LANGUAGE,
  readExtensionUiPreferences,
  UiLanguage,
  watchExtensionUiLanguage,
} from './index.js';
import { translateStaticText } from './staticTranslations.js';

let cachedLanguage: UiLanguage = DEFAULT_UI_LANGUAGE;
let initialized = false;

export function initContentScriptI18n(
  onChange?: (language: UiLanguage) => void,
): () => void {
  if (!initialized) {
    initialized = true;
    void readExtensionUiPreferences().then((preferences) => {
      cachedLanguage = preferences.language;
      applyDocumentLanguage(cachedLanguage);
      onChange?.(cachedLanguage);
    });
  }
  const unsubscribe = watchExtensionUiLanguage((preferences) => {
    cachedLanguage = preferences.language;
    applyDocumentLanguage(cachedLanguage);
    onChange?.(cachedLanguage);
  });
  return unsubscribe;
}

export function getContentScriptUiLanguage(): UiLanguage {
  return cachedLanguage;
}

export function uiPhrase(text: string): string {
  return translateStaticText(text, cachedLanguage);
}

export function formatContentScriptDate(value: string | number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(cachedLanguage);
}
