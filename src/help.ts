/**
 * Help Center page script (vanilla TS).
 * Language follows Options via chrome.storage, with optional page-local override.
 */

import {
  DEFAULT_UI_LANGUAGE,
  EXTENSION_UI_PREFERENCES_STORAGE_KEY,
  type UiLanguage,
  type UiPreferences,
} from './i18n';
import { formatLocalScheduleDateTime } from './scheduled-messages/scheduleDateTime';

type HelpLang = 'zh' | 'en';

const HELP_LANG_OVERRIDE_KEY = 'helpCenterLangOverride';
const HELP_SHARE_SELECTED_KEY = 'helpCenterShareSelected';

const WIKI =
  'https://wiki.ringcentral.com/spaces/XTO/pages/911054301/Personal+AI+-+Tools';
const STORE =
  'https://chromewebstore.google.com/detail/kefnadjndpllbibeklhajjddgmlbafel';

const PRESETS: Record<
  string,
  { zh: string; en: string; meta: { zh: string; en: string } }
> = {
  identity: {
    zh: '# Persona Context — 拉取于今天 09:42\n你正在协助的用户具备以下身份与偏好:\n- 身份:RingCentral 敏捷教练 / Scrum Master,负责跨团队协同\n- 沟通偏好:中文为主、结论先行;代码示例用 TypeScript\n- 当前重点:Personal AI 记忆平台、Sprint 排期与依赖跟进\n- 边界:不要代发消息或创建外部任务,先给预览',
    en: '# Persona Context — pulled today 09:42\nThe user you are assisting has this identity and these preferences:\n- Role: RingCentral agile coach / Scrum Master, driving cross-team coordination\n- Communication: Chinese first, conclusion first; TypeScript for code samples\n- Current focus: Personal AI memory platform, sprint planning and dependency tracking\n- Boundaries: never send messages or create external tasks — always preview first',
    meta: {
      zh: '来源:用户画像(身份投影,已脱敏) · scope=identity_preferences',
      en: 'Source: user profile (identity projection, redacted) · scope=identity_preferences',
    },
  },
  recent: {
    zh: '# Recent Focus — 滚动更新\n- 帮助中心页面设计中,等待 review\n- 商家认证账号审核:等平台结果,Rebecca 跟进中\n- 下个 Sprint 评审材料:周四前需要 timeline 截图\n- Memory Service v2 迁移:context-pack 单接口方案已定稿',
    en: '# Recent Focus — rolling\n- Help center page in design, awaiting review\n- Merchant verification: waiting on the platform, Rebecca following up\n- Next sprint review deck: timeline screenshot needed by Thursday\n- Memory Service v2 migration: single context-pack endpoint finalized',
    meta: {
      zh: '来源:Recent Focus 滚动上下文 · scope=recent_focus',
      en: 'Source: rolling recent-focus context · scope=recent_focus',
    },
  },
  today: {
    zh: '# Today — 今日安排与待闭环\n- 10:00 敏捷教练周会:待闭环——认证材料截图是否同步\n- 14:00 1:1 with Stephen:上次遗留——认证流程结论\n- 今日 Top:评审材料初稿、回复平台审核邮件',
    en: '# Today — schedule and open loops\n- 10:00 agile coach weekly: open loop — has the verification screenshot been shared?\n- 14:00 1:1 with Stephen: leftover — conclusion on the verification flow\n- Top today: first draft of the review deck, reply to the platform review email',
    meta: {
      zh: '来源:Today Pilot 当日简报 · scope=today',
      en: 'Source: Today Pilot daily brief · scope=today',
    },
  },
  projects: {
    zh: '# Focus Project Updates — 重点项目动态\n- [Personal AI] 帮助中心进入 review;v9.0.0 已发布\n- [商家认证] 平台审核中,预计今天上午出结果\n- [Roadmap Q3] 两个 milestone 已回填 Jira key',
    en: '# Focus Project Updates\n- [Personal AI] Help center in review; v9.0.0 shipped\n- [Merchant verification] Under platform review, result expected this morning\n- [Roadmap Q3] Two milestones now backfilled with Jira keys',
    meta: {
      zh: '来源:watched projects 快照 · scope=projects',
      en: 'Source: watched-projects snapshot · scope=projects',
    },
  },
  custom: {
    zh: '(输入自定义主题后点「复制 Prompt」——演示环境返回模拟结果)\n\n# Personal AI 项目的近期动态\n- 最近发布:v9.0.0(Personal Roadmap 协作规划)\n- 进行中:扩展帮助中心(三板块引导)\n- 近期讨论:记忆外接命名与预设/自定义混合方案',
    en: '(Type a topic, then copy — this demo returns a canned result)\n\n# Recent activity on the Personal AI project\n- Latest release: v9.0.0 (Personal Roadmap collaborative planning)\n- In progress: extension help center (three-section guide)\n- Under discussion: Context Pack naming and the preset/custom mix',
    meta: {
      zh: '来源:记忆检索(实验性) · scope=custom&q=…',
      en: 'Source: memory retrieval (experimental) · scope=custom&q=…',
    },
  },
};

const REC: Record<string, { zh: [string, string]; en: [string, string] }> = {
  'context-pack': {
    zh: ['记忆外接', '一个接口把你的身份偏好输出成 Prompt,任何 AI 都能用'],
    en: [
      'Context Pack',
      'one endpoint turns your identity and preferences into a prompt any AI can use',
    ],
  },
  'ask-ai': { zh: ['记忆查询', ''], en: ['Ask', ''] },
  'memory-lens': {
    zh: ['记忆提示', '浏览网页时自动浮出相关记忆'],
    en: ['Memory Lens', 'related memories surface as you browse'],
  },
  compose: {
    zh: ['回复助手', '输入框旁按你的风格给草稿'],
    en: ['Compose Assist', 'drafts beside the composer, in your voice'],
  },
  today: {
    zh: ['今日领航', '每天先看 Top 3 和会前准备'],
    en: ['Today Pilot', 'start the day with Top 3 and meeting prep'],
  },
  meeting: {
    zh: ['会议弹幕', '提醒直接飘在会议画面上,会后一页回放'],
    en: [
      'Meeting Pilot',
      'nudges drift over the meeting view, one-page replay after',
    ],
  },
  'jira-links': {
    zh: [
      'Jira 设计稿与后端依赖',
      '在 User Story 上直接看到设计入口和后端上线日期',
    ],
    en: [
      'Jira design & backend dates',
      'design entries and backend ship dates right on the story',
    ],
  },
  'scheduled-messages': {
    zh: ['定时消息管理', '可以假装"我"定时发消息,也可以管理 AI report'],
    en: [
      'Scheduled messages',
      'send later as yourself, and manage AI reports',
    ],
  },
  reaction: {
    zh: ['消息联动操作', '稍后提醒、自动回复,联动 OpenClaw 执行任务'],
    en: [
      'Message actions',
      'snooze, auto-reply, and run tasks via OpenClaw',
    ],
  },
  doubao: {
    zh: ['豆包互联', '手机上的豆包也能用你的记忆'],
    en: [
      'Memory on mobile',
      'your memory, available in Doubao on your phone',
    ],
  },
  capture: {
    zh: ['划词记住', '选中文字一键存为资料记忆'],
    en: ['Selection save', 'select text and keep it as a source memory'],
  },
  'message-analysis': {
    zh: ['消息分析入库', '分析过滤出我感兴趣的话题'],
    en: ['Message analysis', 'filters out the topics you care about'],
  },
  'import-ai': {
    zh: ['外部 AI 导入', '把 ChatGPT/Claude 历史带进记忆库'],
    en: [
      'Import AI history',
      'bring ChatGPT/Claude history into memory',
    ],
  },
  profile: {
    zh: ['用户画像', '看它眼里的你,可修正可导出'],
    en: ['Your profile', 'see how it models you — correct or export it'],
  },
  backup: {
    zh: ['记忆备份', '一键下载全部记忆的 backup zip,换机也不怕丢'],
    en: [
      'Memory backup',
      'one click to download a backup zip of everything',
    ],
  },
};

function uiLanguageToHelpLang(language: UiLanguage | undefined): HelpLang {
  return language === 'en-US' ? 'en' : 'zh';
}

function readLocalOverride(): HelpLang | null {
  try {
    const saved = localStorage.getItem(HELP_LANG_OVERRIDE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    // ignore
  }
  return null;
}

function writeLocalOverride(lang: HelpLang | null): void {
  try {
    if (!lang) localStorage.removeItem(HELP_LANG_OVERRIDE_KEY);
    else localStorage.setItem(HELP_LANG_OVERRIDE_KEY, lang);
  } catch {
    // ignore
  }
}

async function readOptionsLanguage(): Promise<HelpLang> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return 'zh';
    }
    const result = await chrome.storage.local.get([
      EXTENSION_UI_PREFERENCES_STORAGE_KEY,
    ]);
    const prefs = result[EXTENSION_UI_PREFERENCES_STORAGE_KEY] as
      | UiPreferences
      | undefined;
    return uiLanguageToHelpLang(prefs?.language || DEFAULT_UI_LANGUAGE);
  } catch {
    return 'zh';
  }
}

function revealPage(): void {
  document.documentElement.style.visibility = '';
}

function initHelpPage(): void {
  const root = document.getElementById('root');
  if (!root) {
    revealPage();
    return;
  }

  let pageOverride: HelpLang | null = readLocalOverride();
  let optionsLang: HelpLang = 'zh';
  let renderPrompt: () => void = () => undefined;
  let renderTray: () => void = () => undefined;
  let updateSendUi: () => void = () => undefined;
  let scheduledMsgReady = false;
  let isSending = false;

  const isEn = () => root.getAttribute('data-l') === 'en';

  const applyLang = (
    lang: HelpLang,
    { persistOverride }: { persistOverride?: boolean } = {},
  ) => {
    root.setAttribute('data-l', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    if (persistOverride) {
      pageOverride = lang;
      writeLocalOverride(lang);
    }
    renderPrompt();
    renderTray();
    updateSendUi();
  };

  const setLang = (lang: HelpLang) => {
    applyLang(lang, { persistOverride: true });
  };

  (window as unknown as { setLang: (l: HelpLang) => void }).setLang = setLang;

  document.querySelectorAll('.lang-zh').forEach((btn) => {
    btn.addEventListener('click', () => setLang('zh'));
  });
  document.querySelectorAll('.lang-en').forEach((btn) => {
    btn.addEventListener('click', () => setLang('en'));
  });

  // Apply sync override immediately to avoid wrong-language flash
  if (pageOverride) {
    root.setAttribute('data-l', pageOverride);
    document.documentElement.lang = pageOverride === 'en' ? 'en' : 'zh-CN';
  }

  /* ===== 记忆外接 ===== */
  const presetSel = document.getElementById('feedPreset') as HTMLSelectElement | null;
  const customInput = document.getElementById('feedCustom') as HTMLInputElement | null;
  const customHint = document.getElementById('customHint');
  const promptText = document.getElementById('promptText');
  const promptMeta = document.getElementById('promptMeta');

  renderPrompt = () => {
    if (!presetSel || !promptText || !promptMeta || !customInput || !customHint) return;
    const p = PRESETS[presetSel.value];
    if (!p) return;
    const en = isEn();
    Array.from(presetSel.options).forEach((o) => {
      o.textContent = o.getAttribute(en ? 'data-en' : 'data-zh') || o.textContent;
    });
    customInput.placeholder = en
      ? 'Recent activity on the Personal AI project'
      : 'Personal AI 项目的近期动态';
    promptText.textContent = en ? p.en : p.zh;
    promptMeta.textContent =
      (en ? p.meta.en : p.meta.zh) +
      (en ? ' · read-only, never writes to memory' : ' · 只读接口,不写入记忆');
    const isCustom = presetSel.value === 'custom';
    customInput.classList.toggle('visible', isCustom);
    customHint.style.display = isCustom ? 'block' : 'none';
  };

  presetSel?.addEventListener('change', () => renderPrompt());

  (window as unknown as { copyPromptText: (btn: HTMLButtonElement) => void }).copyPromptText =
    (btn: HTMLButtonElement) => {
      if (!promptText) return;
      void navigator.clipboard.writeText(promptText.textContent || '').then(() => {
        btn.textContent = '✓';
        setTimeout(() => {
          btn.textContent = 'copy';
        }, 1400);
      });
    };

  document.getElementById('copyPrompt')?.addEventListener('click', function onCopy() {
    if (!promptText) return;
    const b = this as HTMLButtonElement;
    const keep = b.innerHTML;
    void navigator.clipboard.writeText(promptText.textContent || '').then(() => {
      b.textContent = isEn() ? '✅ Copied' : '✅ 已复制';
      setTimeout(() => {
        b.innerHTML = keep;
      }, 1400);
    });
  });

  /* ===== 结果预览 toggle ===== */
  document.querySelectorAll('.pv-toggle').forEach((node) => {
    const t = node as HTMLButtonElement;
    (t as HTMLButtonElement & { __label?: string }).__label = t.innerHTML;
    t.addEventListener('click', () => {
      const extra = document.getElementById(t.getAttribute('data-pv') || '');
      if (!extra) return;
      const frameSrc = t.getAttribute('data-frame');
      // Show container first so iframe layout is non-zero when its script auto-plays
      const showing = extra.classList.toggle('visible');
      if (frameSrc) {
        const f = extra.querySelector('iframe') as HTMLIFrameElement | null;
        if (f) {
          if (!f.getAttribute('src')) {
            f.src = frameSrc;
          } else if (showing) {
            // Re-open: reload so the animation plays again
            try {
              f.contentWindow?.location.reload();
            } catch {
              f.src = frameSrc;
            }
          }
        }
      }
      if (t.getAttribute('data-swap')) {
        const stat = t.closest('.pv')?.querySelector('.pv-body');
        if (stat) stat.classList.toggle('hidden', showing);
      }
      const label = (t as HTMLButtonElement & { __label?: string }).__label || '';
      t.innerHTML = showing
        ? isEn()
          ? '▼ Hide preview'
          : '▼ 收起预览'
        : label;
    });
  });

  /* ===== 目录 scrollspy ===== */
  const spyLinks = Array.from(
    document.querySelectorAll('#sidebar a[data-spy]'),
  ) as HTMLAnchorElement[];
  const spyTargets = spyLinks
    .map((a) => document.getElementById(a.getAttribute('data-spy') || ''))
    .filter((el): el is HTMLElement => Boolean(el));
  let currentSpy: string | null = null;

  const setSpy = (id: string) => {
    if (id === currentSpy) return;
    currentSpy = id;
    spyLinks.forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-spy') === id);
    });
  };

  const updateSpy = () => {
    if (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 4
    ) {
      let last: HTMLElement | null = null;
      spyTargets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) last = el;
      });
      if (last) {
        setSpy(last.id);
        return;
      }
    }
    const line = window.innerHeight * 0.3;
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    spyTargets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const d =
        r.top <= line && r.bottom >= line ? -1 : Math.abs(r.top - line);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    });
    if (best) setSpy(best.id);
  };

  window.addEventListener('scroll', updateSpy, { passive: true });
  window.addEventListener('resize', updateSpy);
  spyLinks.forEach((a) => {
    a.addEventListener('click', () => {
      const el = document.getElementById(a.getAttribute('data-spy') || '');
      if (el && el.tagName === 'DETAILS') {
        (el as HTMLDetailsElement).open = true;
      }
    });
  });

  /* ===== 分享托盘 ===== */
  let selected: string[] = [];
  try {
    const raw = localStorage.getItem(HELP_SHARE_SELECTED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        selected = parsed.filter((id) => typeof id === 'string' && REC[id]);
      }
    }
  } catch {
    // ignore
  }

  const tray = document.getElementById('shareTray');
  const trayCnt = document.getElementById('trayCnt');
  const trayChips = document.getElementById('trayChips');
  const trayCopy = document.getElementById('trayCopy') as HTMLTextAreaElement | null;
  const trayRecipient = document.getElementById(
    'trayRecipient',
  ) as HTMLInputElement | null;
  const traySendBtn = document.getElementById(
    'traySendBtn',
  ) as HTMLButtonElement | null;
  const traySendNote = document.getElementById('traySendNote');
  const traySendResult = document.getElementById('traySendResult');
  const traySendDefaultHtml = traySendBtn?.innerHTML || '';

  const openScheduledMessagesSetup = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      chrome.windows.create({
        url: chrome.runtime.getURL('scheduled-messages.html'),
        type: 'popup',
        width: 1280,
        height: 700,
        focused: true,
      });
    }
  };

  const checkScheduledMsgReady = async (): Promise<boolean> => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return false;
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const config = result.scheduledMessagesConfig as
        | { sheetId?: string }
        | undefined;
      return !!(config && config.sheetId);
    } catch {
      return false;
    }
  };

  updateSendUi = () => {
    if (!traySendBtn || !traySendNote) return;
    const en = isEn();
    const recipient = (trayRecipient?.value || '').trim();
    const canSend =
      scheduledMsgReady && Boolean(recipient) && !isSending && Boolean(trayCopy?.value);

    if (scheduledMsgReady) {
      traySendNote.textContent = en
        ? 'Sends via scheduled messages · ready'
        : '发送走「定时消息」通道 · 已就绪';
    } else {
      traySendNote.innerHTML = en
        ? 'Sends via scheduled messages · <a href="#" id="traySetupLink">needs setup</a>'
        : '发送走「定时消息」通道 · <a href="#" id="traySetupLink">需先配置</a>';
      document.getElementById('traySetupLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        openScheduledMessagesSetup();
      });
    }

    traySendBtn.disabled = !canSend;
    traySendBtn.classList.toggle('loading', isSending);
    if (isSending) {
      traySendBtn.textContent = en ? 'Sending…' : '发送中…';
    } else {
      traySendBtn.innerHTML = traySendDefaultHtml;
    }
  };

  const setSendResult = (ok: boolean, message: string) => {
    if (!traySendResult) return;
    traySendResult.hidden = false;
    traySendResult.className = `tray-result ${ok ? 'ok' : 'err'}`;
    traySendResult.textContent = `${ok ? '✅' : '❌'} ${message}`;
  };

  const handleTraySend = async () => {
    if (!traySendBtn || !trayCopy || !trayRecipient) return;
    const recipient = trayRecipient.value.trim();
    if (!recipient || !scheduledMsgReady || isSending) {
      if (!scheduledMsgReady) {
        setSendResult(
          false,
          isEn()
            ? 'Scheduled messages not configured yet'
            : '定时消息尚未配置，请先完成初始化',
        );
        openScheduledMessagesSetup();
      }
      return;
    }

    isSending = true;
    updateSendUi();
    if (traySendResult) traySendResult.hidden = true;

    try {
      const formattedUsername = recipient.toLowerCase().replace(/\s+/g, '.');
      const scheduleTime = new Date(Date.now() + 60 * 1000);
      const { dateStr: scheduleDate, timeStr: scheduleTimeStr } =
        formatLocalScheduleDateTime(scheduleTime);

      const response = (await chrome.runtime.sendMessage({
        type: 'ADD_SCHEDULED_MESSAGE',
        data: {
          Topic: 'Personal AI 推荐',
          Content: trayCopy.value,
          Schedule_Date: scheduleDate,
          Schedule_Time: scheduleTimeStr,
          Push_Method: 'AsMe',
          Target_Type: 'private',
          Glip_User_Name: formattedUsername,
        },
      })) as { success?: boolean; error?: string } | undefined;

      if (response?.success) {
        setSendResult(
          true,
          isEn()
            ? 'Scheduled — will arrive within about 1 minute'
            : '消息已安排发送！将在1分钟内送达',
        );
      } else {
        setSendResult(
          false,
          response?.error || (isEn() ? 'Send failed' : '发送失败'),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isEn()
            ? 'Send failed'
            : '发送失败';
      setSendResult(false, message);
    } finally {
      isSending = false;
      updateSendUi();
    }
  };

  const label = (id: string) => {
    const r = REC[id];
    return isEn() ? r.en[0] : r.zh[0];
  };
  const desc = (id: string) => {
    const r = REC[id];
    return isEn() ? r.en[1] : r.zh[1];
  };

  const persistSelected = () => {
    try {
      localStorage.setItem(HELP_SHARE_SELECTED_KEY, JSON.stringify(selected));
    } catch {
      // ignore
    }
  };

  renderTray = () => {
    if (!trayCnt || !trayChips || !trayCopy) return;
    const en = isEn();
    trayCnt.textContent = String(selected.length);
    document.querySelectorAll('.rec-btn').forEach((node) => {
      const b = node as HTMLButtonElement;
      const on = selected.indexOf(b.getAttribute('data-rec') || '') >= 0;
      b.classList.toggle('on', on);
      if (on) b.textContent = en ? '✓ Added' : '✓ 已选';
      else
        b.innerHTML =
          '<span class="l-zh">+ 推荐</span><span class="l-en">+ Share</span>';
    });
    if (!selected.length) {
      trayChips.innerHTML =
        '<span class="empty">' +
        (en
          ? 'Nothing selected — hit "+ Share" on any card'
          : '还没选功能——去任意功能卡点「+ 推荐」') +
        '</span>';
      trayCopy.value =
        (en ? 'Install: ' : '安装:') +
        STORE +
        '\n' +
        (en ? 'or see the wiki: ' : '或者查看 wiki:') +
        WIKI;
      updateSendUi();
      return;
    }
    trayChips.innerHTML = selected
      .map((id) => `<span class="chip" data-id="${id}">${label(id)}</span>`)
      .join('');
    const first = selected[0];
    const d = desc(first);
    let text = d
      ? (en ? 'Sharing a small tool — ' : '推荐个小工具,') + d
      : en
        ? `Sharing a small tool with ${label(first)}`
        : `推荐个小工具,有「${label(first)}」`;
    if (selected.length > 1) {
      text +=
        '\n' +
        (en ? 'It also does: ' : '还可以做到:') +
        selected.slice(1).map(label).join(en ? ', ' : '、') +
        (en ? ' and more' : ' 等');
    }
    text +=
      '\n\n' +
      (en ? 'Install: ' : '安装:') +
      STORE +
      '\n' +
      (en ? 'or see the wiki: ' : '或者查看 wiki:') +
      WIKI;
    trayCopy.value = text;
    updateSendUi();
  };

  document.querySelectorAll('.rec-btn').forEach((node) => {
    const b = node as HTMLButtonElement;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = b.getAttribute('data-rec') || '';
      const i = selected.indexOf(id);
      if (i >= 0) selected.splice(i, 1);
      else selected.push(id);
      persistSelected();
      renderTray();
      if (selected.length) tray?.classList.add('open');
    });
  });

  trayChips?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const id = target?.getAttribute?.('data-id');
    if (!id) return;
    const i = selected.indexOf(id);
    if (i >= 0) selected.splice(i, 1);
    persistSelected();
    renderTray();
  });

  document.getElementById('trayPill')?.addEventListener('click', () => {
    tray?.classList.toggle('open');
  });

  document.getElementById('trayCopyBtn')?.addEventListener('click', function onTrayCopy() {
    if (!trayCopy) return;
    const b = this as HTMLButtonElement;
    const keep = b.innerHTML;
    void navigator.clipboard.writeText(trayCopy.value).then(() => {
      b.textContent = isEn() ? '✅ Copied' : '✅ 已复制';
      setTimeout(() => {
        b.innerHTML = keep;
      }, 1400);
    });
  });

  trayRecipient?.addEventListener('input', () => updateSendUi());
  traySendBtn?.addEventListener('click', () => {
    void handleTraySend();
  });

  // Configure CTA buttons that deep-link into extension pages
  document.querySelectorAll('.check .go').forEach((node) => {
    const btn = node as HTMLButtonElement;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = (btn.textContent || '').toLowerCase();
      let url = 'desktop-app.html';
      if (text.includes('授权') || text.includes('authorize')) {
        url = 'scheduled-messages.html';
      } else if (text.includes('配置') || text.includes('configure')) {
        url = 'options.html';
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL(url) });
      } else {
        window.open(url, '_blank');
      }
    });
  });

  const finishInit = (lang: HelpLang) => {
    applyLang(lang);
    updateSpy();
    if (location.hash === '#share') {
      tray?.classList.add('open');
      window.setTimeout(() => {
        tray?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
    revealPage();
  };

  void (async () => {
    optionsLang = await readOptionsLanguage();
    scheduledMsgReady = await checkScheduledMsgReady();
    const initial = pageOverride || optionsLang;
    finishInit(initial);

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const prefsChange = changes[EXTENSION_UI_PREFERENCES_STORAGE_KEY];
        if (prefsChange) {
          const prefs = prefsChange.newValue as UiPreferences | undefined;
          optionsLang = uiLanguageToHelpLang(
            prefs?.language || DEFAULT_UI_LANGUAGE,
          );
          if (!pageOverride) applyLang(optionsLang);
        }
        if (changes.scheduledMessagesConfig) {
          const config = changes.scheduledMessagesConfig.newValue as
            | { sheetId?: string }
            | undefined;
          scheduledMsgReady = !!(config && config.sheetId);
          updateSendUi();
        }
      });
    }
  })();
}

// Hide until language resolved (inline bootstrap may already have set override)
document.documentElement.style.visibility = 'hidden';
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHelpPage);
} else {
  initHelpPage();
}
