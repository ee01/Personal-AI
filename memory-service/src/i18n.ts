export type UiLanguage = 'zh-CN' | 'en-US';

const DEFAULT_UI_LANGUAGE: UiLanguage = 'zh-CN';

const MESSAGES: Record<UiLanguage, Record<string, string>> = {
  'zh-CN': {
    'ask.status.extractingLocal':
      '已提取本地结论，正在调用外部工具补充细节...',
    'ask.status.checkingExternal': '正在调用外部工具查证...',
    'ask.status.creatingConfirmRequest':
      '本地信息不足，正在创建待确认事项...',
    'ask.status.preparingExternalAsk': '本地信息不足，正在准备外部询问...',
    'ask.status.recalling': '正在检索相关记忆...',
    'ask.status.analyzing': '正在分析已知信息...',
    'ask.status.integratingExternal':
      '已获取外部证据，正在整合上下文...',
    'ask.status.needsClarification':
      '需要先确认你指的是哪个话题...',
    'ask.status.generating': '正在生成回答...',
    'ask.status.structuring': '正在整理结构化要点...',
    'ask.error.answer':
      'Sorry, I was unable to process your question. Please try again later.',
    'ask.error.stream': 'Unable to process the question.',
  },
  'en-US': {
    'ask.status.extractingLocal':
      'Local findings are ready. Calling external tools for more detail...',
    'ask.status.checkingExternal': 'Checking external tools...',
    'ask.status.creatingConfirmRequest':
      'Local information is insufficient. Creating a confirmation request...',
    'ask.status.preparingExternalAsk':
      'Local information is insufficient. Preparing an external ask...',
    'ask.status.recalling': 'Searching related memories...',
    'ask.status.analyzing': 'Analyzing known information...',
    'ask.status.integratingExternal':
      'External evidence received. Integrating context...',
    'ask.status.needsClarification':
      'Need to confirm which topic you mean...',
    'ask.status.generating': 'Generating answer...',
    'ask.status.structuring': 'Organizing structured takeaways...',
    'ask.error.answer':
      'Sorry, I was unable to process your question. Please try again later.',
    'ask.error.stream': 'Unable to process the question.',
  },
};

const LEGACY_TEXT_KEYS = new Map<string, string>([
  [
    '已提取本地结论，正在调用外部工具补充细节...',
    'ask.status.extractingLocal',
  ],
  ['正在调用外部工具查证...', 'ask.status.checkingExternal'],
  ['本地信息不足，正在创建待确认事项...', 'ask.status.creatingConfirmRequest'],
  ['本地信息不足，正在准备外部询问...', 'ask.status.preparingExternalAsk'],
  ['正在检索相关记忆...', 'ask.status.recalling'],
  ['正在分析已知信息...', 'ask.status.analyzing'],
  ['已获取外部证据，正在整合上下文...', 'ask.status.integratingExternal'],
  ['需要先确认你指的是哪个话题...', 'ask.status.needsClarification'],
  ['正在生成回答...', 'ask.status.generating'],
  ['正在整理结构化要点...', 'ask.status.structuring'],
]);

export function normalizeUiLanguage(value: unknown): UiLanguage {
  if (value === 'en-US' || value === 'en') return 'en-US';
  if (value === 'zh-CN' || value === 'zh_CN' || value === 'zh') {
    return 'zh-CN';
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized.startsWith('en')) return 'en-US';
    if (normalized.startsWith('zh')) return 'zh-CN';
  }
  return DEFAULT_UI_LANGUAGE;
}

export function getUiLanguageFromHeaders(
  headers: Record<string, unknown>,
): UiLanguage {
  return normalizeUiLanguage(
    headers['x-personal-ai-language'] || headers['accept-language'],
  );
}

export function t(
  key: string,
  language: UiLanguage = DEFAULT_UI_LANGUAGE,
): string {
  const normalized = normalizeUiLanguage(language);
  return MESSAGES[normalized]?.[key] || MESSAGES[DEFAULT_UI_LANGUAGE][key] || key;
}

export function localizeUiText(
  text: string,
  language: UiLanguage = DEFAULT_UI_LANGUAGE,
): string {
  const key = LEGACY_TEXT_KEYS.get(text);
  return key ? t(key, language) : text;
}
