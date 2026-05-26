import { uiPhrase as ui } from '../i18n/contentScript.js';

export interface MessageReactionToolbarConfig {
  enableSnooze: boolean;
  enableFollowThread: boolean;
  enableAutoReply: boolean;
  enableLinkedAction: boolean;
}

export type MessageReactionActionKey =
  | 'snooze'
  | 'followThread'
  | 'autoReply'
  | 'followupAsk'
  | 'linkedAction';

export interface MessageReactionActionDefinition {
  key: MessageReactionActionKey;
  label: string;
  compactLabel: string;
  compactAlign?: 'start' | 'end';
  className: string;
  usesClockIcon?: boolean;
  runtimeMessageType?: string;
}

export const LINKED_ACTION_RUNTIME_MESSAGE_TYPE = 'OPEN_LINKED_ACTION_CONFIG';

type MessageReactionActionTemplate = Omit<
  MessageReactionActionDefinition,
  'label' | 'compactLabel'
> & {
  labelKey: string;
  compactLabelKey: string;
};

export type MessageReactionLabelTranslator = (text: string) => string;

const ALL_ACTIONS: MessageReactionActionTemplate[] = [
  {
    key: 'snooze',
    labelKey: '稍后处理',
    compactLabelKey: '稍后',
    className: 'message-reaction-action-btn snooze-icon-btn',
  },
  {
    key: 'followThread',
    labelKey: '关注后续',
    compactLabelKey: '关注',
    className: 'message-reaction-action-btn follow-thread-btn',
    runtimeMessageType: 'OPEN_FOLLOW_THREAD_CONFIG',
  },
  {
    key: 'autoReply',
    labelKey: '自动答复',
    compactLabelKey: '答复',
    compactAlign: 'end',
    className: 'message-reaction-action-btn auto-reply-btn',
    runtimeMessageType: 'OPEN_AUTO_REPLY_CONFIG',
  },
  {
    key: 'followupAsk',
    labelKey: '跟进追问',
    compactLabelKey: '跟进',
    className: 'message-reaction-action-btn followup-ask-btn',
    runtimeMessageType: 'CREATE_OUTREACH_FROM_MESSAGE',
  },
  {
    key: 'linkedAction',
    labelKey: '联动操作',
    compactLabelKey: '联动',
    className: 'message-reaction-action-btn linked-action-btn',
    runtimeMessageType: LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  },
];

function localizeAction(
  action: MessageReactionActionTemplate,
  translate: MessageReactionLabelTranslator,
): MessageReactionActionDefinition {
  const { labelKey, compactLabelKey, ...definition } = action;
  return {
    ...definition,
    label: translate(labelKey),
    compactLabel: translate(compactLabelKey),
  };
}

export function getMessageReactionActionDefinitions(
  config: MessageReactionToolbarConfig,
  context: { isOwnMessage?: boolean } = {},
  translate: MessageReactionLabelTranslator = ui,
): MessageReactionActionDefinition[] {
  return ALL_ACTIONS.filter((action) => {
    switch (action.key) {
      case 'snooze':
        return config.enableSnooze;
      case 'followThread':
        return config.enableFollowThread;
      case 'autoReply':
        return config.enableAutoReply && !context.isOwnMessage;
      case 'followupAsk':
        return config.enableAutoReply && context.isOwnMessage;
      case 'linkedAction':
        return config.enableLinkedAction;
    }
  }).map((action) => localizeAction(action, translate));
}
