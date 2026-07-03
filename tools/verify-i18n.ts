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
assert.equal(translateStaticText('打开中...', 'en-US'), 'Opening...');
assert.equal(translateStaticText('提醒路径', 'en-US'), 'Reminder path');
assert.equal(translateStaticText('去向', 'en-US'), 'Queue');
assert.equal(
  translateStaticText('到点由 Bot 推送，并在原消息显示稍后标注', 'en-US'),
  'Bot sends it when due, and the original message shows a Remind marker',
);
assert.equal(translateStaticText('本次点击', 'en-US'), 'This pick');
assert.equal(
  translateStaticText('会改期这条同源 Snooze，不新增第二条', 'en-US'),
  'Reschedules this same-source Remind item instead of adding another one',
);
assert.equal(
  translateStaticText(
    '来自本地 marker 快照；以 Scheduled Messages 管理页和后台同步为准',
    'en-US',
  ),
  'Based on the local marker snapshot; Scheduled Messages and background sync remain authoritative',
);
assert.equal(
  translateStaticText(
    '原消息标注会随后台同步刷新，当前页面可能短暂仍显示旧快照',
    'en-US',
  ),
  'Original message marker refreshes with background sync; this page may briefly show the old local snapshot',
);
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
