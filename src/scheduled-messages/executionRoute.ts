import type { PushMethod } from './types';

export type ExecutionRouteState = 'ready' | 'needs_setup' | 'external';

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

function hasConfiguredAiEndpoint(endpoint?: string): boolean {
  return Boolean(endpoint?.trim());
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
          ? '每分钟领取一条 Bot 消息，发送后通过回调写入执行结果。'
          : 'Bot executor 尚未配置，需先配置 Bot 推送后才能执行。',
        state: context.botConfigured ? 'ready' : 'needs_setup',
      };

    case 'AI':
      return {
        engine: 'Jira Automation · AI/API',
        detail: context.botConfigured
          ? '每分钟领取一条 AI Report/API 消息，调用 endpoint 后回写成功或失败。'
          : 'AI Report 依赖 Bot executor，需先配置 Bot 推送后才能执行。',
        state: context.botConfigured ? 'ready' : 'needs_setup',
      };

    case 'JiraAutomation':
      if (hasConfiguredAiEndpoint(message.AI_Endpoint)) {
        return {
          engine: 'Jira Automation · 托管 API',
          detail: context.botConfigured
            ? '带 AI_Endpoint 的 JiraAutomation 行进入 Personal AI executor 队列。'
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
