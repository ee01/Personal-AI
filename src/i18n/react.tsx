import * as React from 'react';
import {
  applyDocumentLanguage,
  DEFAULT_UI_LANGUAGE,
  readExtensionUiPreferences,
  t as translate,
  UiLanguage,
  UiMessageParams,
  watchExtensionUiLanguage,
  writeExtensionUiLanguage,
} from './index.js';
import {
  applyStaticUiTranslations,
  observeStaticUiTranslations,
} from './staticTranslations.js';

export function useExtensionUiLanguage() {
  const [language, setLanguageState] =
    React.useState<UiLanguage>(DEFAULT_UI_LANGUAGE);

  React.useEffect(() => {
    let cancelled = false;
    void readExtensionUiPreferences().then((preferences) => {
      if (cancelled) return;
      setLanguageState(preferences.language);
      applyDocumentLanguage(preferences.language);
    });
    const unsubscribe = watchExtensionUiLanguage((preferences) => {
      setLanguageState(preferences.language);
      applyDocumentLanguage(preferences.language);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const setLanguage = React.useCallback(async (nextLanguage: UiLanguage) => {
    const preferences = await writeExtensionUiLanguage(nextLanguage);
    setLanguageState(preferences.language);
    applyDocumentLanguage(preferences.language);
  }, []);

  const t = React.useCallback(
    (key: string, params?: UiMessageParams) =>
      translate(key, params, language),
    [language],
  );

  return { language, setLanguage, t };
}

export function useStaticDomI18n(
  language: UiLanguage,
  rootRef?: React.RefObject<ParentNode | null>,
) {
  React.useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const target = rootRef?.current || document.body || document.documentElement;
    applyStaticUiTranslations(target, language);
    return observeStaticUiTranslations(target, () => language);
  }, [language, rootRef]);
}
