/**
 * Shared Dify jumpboard placeholder substitution for Scheduled Messages Jira rules.
 * AgentTask / Botman jumpboard DSL lives in ./dify/
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function escapeJsonStringValue(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

export interface DifyJumpboardEnv {
  AGENT_TASK_DIFY_API_BASE_URL?: string;
  AGENT_TASK_DIFY_API_KEY?: string;
  BOTMAN_DIFY_API_BASE_URL?: string;
  BOTMAN_DIFY_API_KEY?: string;
  RINGCENTRAL_SENDER_DIFY_API_BASE_URL?: string;
}

const DEFAULT_DIFY_BASE = 'https://dify.int.rclabenv.com/v1';

export function getScheduledMessagesDifyJumpboardReplacements(
  envConfig: DifyJumpboardEnv,
): Record<string, string> {
  const sharedBase = trimTrailingSlash(
    envConfig.AGENT_TASK_DIFY_API_BASE_URL ||
      envConfig.BOTMAN_DIFY_API_BASE_URL ||
      envConfig.RINGCENTRAL_SENDER_DIFY_API_BASE_URL ||
      DEFAULT_DIFY_BASE,
  );

  return {
    '{{AGENT_TASK_DIFY_API_BASE_URL}}': trimTrailingSlash(
      envConfig.AGENT_TASK_DIFY_API_BASE_URL || sharedBase,
    ),
    '{{AGENT_TASK_DIFY_API_KEY}}': envConfig.AGENT_TASK_DIFY_API_KEY || '',
    '{{BOTMAN_DIFY_API_BASE_URL}}': trimTrailingSlash(
      envConfig.BOTMAN_DIFY_API_BASE_URL || sharedBase,
    ),
    '{{BOTMAN_DIFY_API_KEY}}': envConfig.BOTMAN_DIFY_API_KEY || '',
  };
}

export function replaceScheduledMessagesDifyJumpboardPlaceholders(
  templateString: string,
  envConfig: DifyJumpboardEnv,
): string {
  let result = templateString;
  const replacements = getScheduledMessagesDifyJumpboardReplacements(envConfig);
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => escapeJsonStringValue(value),
    );
  }
  return result;
}

export function assertScheduledMessagesDifyJumpboardsConfigured(
  envConfig: DifyJumpboardEnv,
): void {
  const replacements = getScheduledMessagesDifyJumpboardReplacements(envConfig);
  const missing: string[] = [];
  if (!replacements['{{AGENT_TASK_DIFY_API_BASE_URL}}'] || !replacements['{{AGENT_TASK_DIFY_API_KEY}}']) {
    missing.push('AGENT_TASK_DIFY_API_BASE_URL / AGENT_TASK_DIFY_API_KEY');
  }
  if (!replacements['{{BOTMAN_DIFY_API_BASE_URL}}'] || !replacements['{{BOTMAN_DIFY_API_KEY}}']) {
    missing.push('BOTMAN_DIFY_API_BASE_URL / BOTMAN_DIFY_API_KEY');
  }
  if (missing.length > 0) {
    throw new Error(
      `Scheduled Messages Dify 跳板未配置完整：缺少 ${missing.join('；')}。请先在 .env 填写并发布对应 Dify Workflow。`,
    );
  }
}
