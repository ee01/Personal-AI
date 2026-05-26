import assert from 'node:assert/strict';

const storageState: Record<string, unknown> = {};
const listeners = new Set<(changes: Record<string, any>, area: string) => void>();

(globalThis as any).chrome = {
  storage: {
    local: {
      get(keys: string[] | string, callback: (result: Record<string, unknown>) => void) {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          result[key] = storageState[key];
        }
        callback(result);
      },
      set(items: Record<string, unknown>, callback?: () => void) {
        for (const [key, value] of Object.entries(items)) {
          storageState[key] = value;
          for (const listener of listeners) {
            listener({ [key]: { newValue: value } }, 'local');
          }
        }
        callback?.();
      },
    },
    onChanged: {
      addListener(listener: (changes: Record<string, any>, area: string) => void) {
        listeners.add(listener);
      },
      removeListener(listener: (changes: Record<string, any>, area: string) => void) {
        listeners.delete(listener);
      },
    },
  },
};

const {
  EXTENSION_UI_PREFERENCES_STORAGE_KEY,
  normalizeUiLanguage,
  readExtensionUiPreferences,
  t,
  watchExtensionUiLanguage,
  writeExtensionUiLanguage,
} = await import('../src/i18n/index.js');
const { translateStaticText } = await import(
  '../src/i18n/staticTranslations.js'
);

assert.equal(normalizeUiLanguage('en'), 'en-US');
assert.equal(normalizeUiLanguage('zh_CN'), 'zh-CN');
assert.equal(normalizeUiLanguage('fr-FR'), 'zh-CN');
assert.equal(t('terms.composeAssist', undefined, 'zh-CN'), '回复助手');
assert.equal(t('terms.composeAssist', undefined, 'en-US'), 'Compose Assist');
assert.equal(
  t('desktop.memoryList.summary', { total: 3, source: 'Doubao' }, 'en-US'),
  '3 total · Source: Doubao',
);
assert.equal(t('missing.key', undefined, 'en-US'), 'missing.key');
assert.equal(
  translateStaticText('消息分析频度（分钟）', 'en-US'),
  'Message analysis frequency (minutes)',
);
assert.equal(
  translateStaticText('Message analysis frequency (minutes)', 'zh-CN'),
  '消息分析频度（分钟）',
);
assert.equal(
  translateStaticText('  记忆入口规则  ', 'en-US'),
  '  Memory Entry Rules  ',
);
assert.equal(translateStaticText('稍后处理', 'en-US'), 'Remind');
assert.equal(translateStaticText('关注后续', 'en-US'), 'Watch');
assert.equal(translateStaticText('自动答复', 'en-US'), 'Reply');
assert.equal(translateStaticText('跟进追问', 'en-US'), 'Followup');
assert.equal(translateStaticText('联动操作', 'en-US'), 'Openclaw');
assert.equal(translateStaticText('稍后处理快捷选项', 'en-US'), 'Remind quick options');
assert.equal(translateStaticText('自定义时间', 'en-US'), 'Custom time');
assert.equal(translateStaticText('选择日期和时间', 'en-US'), 'Choose date and time');
assert.equal(translateStaticText('请选择未来时间', 'en-US'), 'Choose a future time');
assert.equal(translateStaticText('Openclaw', 'zh-CN'), '联动操作');

const initial = await readExtensionUiPreferences();
assert.equal(initial.language, 'zh-CN');

const unsubscribe = watchExtensionUiLanguage(() => undefined);
assert.equal(listeners.size, 1);
const saved = await writeExtensionUiLanguage('en-US');
assert.equal(saved.language, 'en-US');

const stored = storageState[EXTENSION_UI_PREFERENCES_STORAGE_KEY] as {
  language?: string;
};
assert.equal(stored.language, 'en-US');
unsubscribe();
assert.equal(listeners.size, 0);

console.log('i18n verification passed');
