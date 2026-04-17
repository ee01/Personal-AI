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
  | 'linkedAction';

export interface MessageReactionActionDefinition {
  key: MessageReactionActionKey;
  label: string;
  className: string;
  usesClockIcon?: boolean;
  runtimeMessageType?: string;
}

export const LINKED_ACTION_RUNTIME_MESSAGE_TYPE = 'OPEN_LINKED_ACTION_CONFIG';

const ALL_ACTIONS: MessageReactionActionDefinition[] = [
  {
    key: 'snooze',
    label: '稍后处理',
    className: 'message-reaction-action-btn snooze-icon-btn',
    usesClockIcon: true,
  },
  {
    key: 'followThread',
    label: '关注后续',
    className: 'message-reaction-action-btn follow-thread-btn',
    runtimeMessageType: 'OPEN_FOLLOW_THREAD_CONFIG',
  },
  {
    key: 'autoReply',
    label: '自动答复',
    className: 'message-reaction-action-btn auto-reply-btn',
    runtimeMessageType: 'OPEN_AUTO_REPLY_CONFIG',
  },
  {
    key: 'linkedAction',
    label: '联动操作',
    className: 'message-reaction-action-btn linked-action-btn',
    runtimeMessageType: LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  },
];

export function getMessageReactionActionDefinitions(
  config: MessageReactionToolbarConfig,
): MessageReactionActionDefinition[] {
  return ALL_ACTIONS.filter((action) => {
    switch (action.key) {
      case 'snooze':
        return config.enableSnooze;
      case 'followThread':
        return config.enableFollowThread;
      case 'autoReply':
        return config.enableAutoReply;
      case 'linkedAction':
        return config.enableLinkedAction;
    }
  });
}
