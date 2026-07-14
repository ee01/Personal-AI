import type { PushMethod } from './types';
import { hasLocalScheduleTime } from './scheduleDateTime.js';

export type ExecutionRouteState = 'ready' | 'needs_setup' | 'external';
export type ExecutionLaneTone = 'info' | 'warning';

export interface ExecutionRouteInput {
  Push_Method: PushMethod;
  AI_Endpoint?: string;
  Automation_Link?: string;
  Schedule_Date?: string;
}

export interface ExecutionRouteContext {
  botConfigured?: boolean;
  ringCentralSenderConfigured?: boolean;
  outreachEnabled?: boolean;
  outreachConfigured?: boolean;
}

export interface ExecutionRouteDescriptor {
  engine: string;
  detail: string;
  state: ExecutionRouteState;
}

export interface ExecutionLaneReceipt {
  headline: string;
  detail: string;
  boundary: string;
  tone: ExecutionLaneTone;
}

function hasConfiguredAiEndpoint(endpoint?: string): boolean {
  return Boolean(endpoint?.trim());
}

function isManagedExecutorRoute(message: ExecutionRouteInput): boolean {
  return message.Push_Method === 'Bot' ||
    message.Push_Method === 'AI' ||
    message.Push_Method === 'AgentTask' ||
    (message.Push_Method === 'JiraAutomation' && hasConfiguredAiEndpoint(message.AI_Endpoint));
}

function getExecutorWritebackBoundary(message: ExecutionRouteInput): string {
  if (message.Push_Method === 'AgentTask') {
    return '领取后由 Jira Rule 调 memory-service 发起 Agent run；Sheet 只记录计划/领取，执行账本、结果和通知以 memory-service 为准。';
  }

  if (
    message.Push_Method === 'AI' ||
    (message.Push_Method === 'JiraAutomation' && hasConfiguredAiEndpoint(message.AI_Endpoint))
  ) {
    return '领取时先写 Last_Exec / Logs 防重复；endpoint 成败需要回到 Jira/API 运行记录确认。';
  }

  return 'Bot/RingCentral sender 发送后才通过回调写 Last_Exec / Logs；领取本身不等于已发送。';
}

export function getScheduledMessageExecutionRoute(
  message: ExecutionRouteInput,
  context: ExecutionRouteContext = {},
): ExecutionRouteDescriptor {
  switch (message.Push_Method) {
    case 'AsMe': {
      if (context.ringCentralSenderConfigured) {
        return {
          engine: 'Jira Automation · RingCentral sender',
          detail: context.botConfigured
            ? '保留 AsMe 09:00 默认语义，由 executor rule 调用 RingCentral sender，执行结果回写 Sheet。'
            : 'RingCentral sender 已配置但 Bot executor 缺失，需要先修复 Bot 推送配置。',
          state: context.botConfigured ? 'ready' : 'needs_setup',
        };
      }

      return {
        engine: 'AppScript · Mail fallback',
        detail: '由 Apps Script 时间触发器按用户身份发往 Glip 邮箱，未配置 RingCentral sender 时使用。',
        state: 'ready',
      };
    }

    case 'Bot':
      return {
        engine: 'Jira Automation · Bot API',
        detail: context.botConfigured
          ? '按当前分钟 / 30 分钟补偿 / 08:00 后队列领取一条 Bot 消息，发送后通过回调写入 Last_Exec / Logs。'
          : 'Bot executor 尚未配置，需先配置 Bot 推送后才能执行。',
        state: context.botConfigured ? 'ready' : 'needs_setup',
      };

    case 'AI':
      return {
        engine: 'Jira Automation · AI/API',
        detail: context.botConfigured
          ? '按三段顺序领取一条 AI Report/API 消息；领取时即写入 Last_Exec / Logs 防重复，endpoint 结果需看 Jira/API 运行记录。'
          : 'AI Report 依赖 Bot executor，需先配置 Bot 推送后才能执行。',
        state: context.botConfigured ? 'ready' : 'needs_setup',
      };

    case 'AgentTask':
      return {
        engine: 'Jira Automation · memory-service AgentTask',
        detail: context.botConfigured
          ? '按当前分钟 / 30 分钟补偿 / 08:00 后队列领取一条帮我做任务；到期才调用 memory-service，memory-service 负责 OpenClaw 执行、run 账本和 Bot 私发通知。'
          : '帮我做依赖 Bot executor rule 作为 Jira 侧入口，需先配置 Bot 推送后才能执行。',
        state: context.botConfigured ? 'ready' : 'needs_setup',
      };

    case 'JiraAutomation':
      if (hasConfiguredAiEndpoint(message.AI_Endpoint)) {
        return {
          engine: 'Jira Automation · 托管 API',
          detail: context.botConfigured
            ? '带 AI_Endpoint 的 JiraAutomation 行进入 Personal AI executor 队列；领取即标记本次已处理，避免长耗时 API 被重复领取。'
            : '托管 JiraAutomation API 行依赖 Bot executor，需先修复 Bot 推送配置。',
          state: context.botConfigured ? 'ready' : 'needs_setup',
        };
      }

      return {
        engine: '外部 Jira Automation',
        detail: message.Automation_Link && message.Schedule_Date
          ? '只展示外部规则调度；未设置 AI_Endpoint 前不会接入 Personal AI executor。'
          : '外部 Jira 规则由 Jira 自己触发，Personal AI 只保留查看入口。',
        state: 'external',
      };

    case 'Outreach':
      return {
        engine: 'memory-service · Outreach Runtime',
        detail: context.outreachEnabled && context.outreachConfigured
          ? '同步主动询问模板，触发前先查已有答案，再发问、追问并记录结果。'
          : '需要先启用 Outreach 并完成 RingCentral 配置，才能派发主动询问。',
        state: context.outreachEnabled && context.outreachConfigured ? 'ready' : 'needs_setup',
      };

    default:
      return {
        engine: '未知执行引擎',
        detail: '当前推送方式未被 Scheduled Messages 识别。',
        state: 'needs_setup',
      };
  }
}

export function formatExecutionRouteSummary(route: ExecutionRouteDescriptor): string {
  return `${route.engine}：${route.detail}`;
}

export function getScheduledMessageExecutionLaneReceipt(
  message: ExecutionRouteInput,
  context: ExecutionRouteContext = {},
): ExecutionLaneReceipt {
  if (message.Push_Method === 'Outreach') {
    return {
      headline: 'Outreach Runtime · 模板触发/追问',
      detail: '主动询问由 memory-service runtime 根据模板、已有答案和追问状态推进，不走 Bot/AI 的当前分钟、补偿窗口或 08:00 后队列。',
      boundary: '本页只展示和同步计划；是否已发问、等回复或结束以 Outreach session 状态为准。',
      tone: context.outreachEnabled && context.outreachConfigured ? 'info' : 'warning',
    };
  }

  if (message.Push_Method === 'JiraAutomation' && !hasConfiguredAiEndpoint(message.AI_Endpoint)) {
    return {
      headline: '外部规则 · Personal AI 不领取',
      detail: '未设置 AI_Endpoint 的 JiraAutomation 行只保留外部规则查看入口，不进入 Personal AI executor 的三段领取链路。',
      boundary: '不会由 Personal AI 补偿、改 Logs 或标记 Last_Exec；真实执行结果需要查看外部 Jira Automation。',
      tone: 'info',
    };
  }

  if (isManagedExecutorRoute(message)) {
    const hasExplicitTime = hasLocalScheduleTime(message.Schedule_Time);

    if (hasExplicitTime) {
      return {
        headline: message.Push_Method === 'Bot'
          ? '明确时间槽 · 当前分钟/30分钟补偿 · 发送后回调写回'
          : message.Push_Method === 'AgentTask'
            ? '明确时间槽 · 当前分钟/30分钟补偿 · 到期触发 Agent run'
          : '明确时间槽 · 当前分钟/30分钟补偿 · 领取时先写回',
        detail: '执行器先检查准点或最多迟到 1 分钟的当前分钟；错过后再查过去 2-30 分钟补偿窗口，支持跨午夜，不会提前发送。',
        boundary: getExecutorWritebackBoundary(message),
        tone: 'info',
      };
    }

    return {
      headline: message.Push_Method === 'Bot'
        ? '08:00 后队列 · 表格顺序每分钟一条 · 发送后回调写回'
        : message.Push_Method === 'AgentTask'
          ? '08:00 后队列 · 表格顺序每分钟一条 · 到期触发 Agent run'
        : '08:00 后队列 · 表格顺序每分钟一条 · 领取时先写回',
      detail: '未填写 Schedule_Time 时，执行日 08:00 后才进入 executor 兜底队列；同一天按 Messages 表格行顺序每分钟领取一条。',
      boundary: `${getExecutorWritebackBoundary(message)} 这不是明确 08:00 准点消息。`,
      tone: 'info',
    };
  }

  if (message.Push_Method === 'AsMe' && context.ringCentralSenderConfigured) {
    return {
      headline: hasLocalScheduleTime(message.Schedule_Time)
        ? 'AsMe 明确时间槽 · RingCentral sender 回调写回'
        : 'AsMe 09:00 默认 · 不进入 08:00 后队列',
      detail: 'AsMe 保留个人提醒时间语义；留空时使用 09:00 默认时间，不参与 Bot/AI 的 08:00 后队列表格顺序。',
      boundary: context.botConfigured
        ? 'RingCentral sender 发送后通过 executor 回调写 Last_Exec / Logs；未回调前不应视为已发送。'
        : 'RingCentral sender 已开启但 Bot executor 缺失，保存前需要先完成 Bot 配置。',
      tone: context.botConfigured ? 'info' : 'warning',
    };
  }

  return {
    headline: hasLocalScheduleTime(message.Schedule_Time)
      ? 'AppScript 明确时间槽 · 执行后写 Logs'
      : 'AppScript 09:00 默认 · 非 executor 队列',
    detail: 'AsMe 邮件 fallback 由 Apps Script 时间触发器处理；留空时按 09:00 默认时间，不进入 Bot/AI 的 08:00 后队列。',
    boundary: '执行完成和失败恢复以 Apps Script 写回的 Last_Exec / Logs 为准。',
    tone: 'info',
  };
}

export function formatExecutionLaneSummary(receipt: ExecutionLaneReceipt): string {
  return `领取口径：${receipt.headline}`;
}

export function formatExecutionLaneReceipt(receipt: ExecutionLaneReceipt): string {
  return `${formatExecutionLaneSummary(receipt)}；${receipt.detail}；${receipt.boundary}`;
}
