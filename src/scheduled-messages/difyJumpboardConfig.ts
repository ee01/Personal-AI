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
  let result = envConfig.AGENT_TASK_DIFY_API_KEY?.trim()
    ? templateString
    : buildDirectAgentTaskRule(templateString);
  const replacements = getScheduledMessagesDifyJumpboardReplacements(envConfig);
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(
      new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'),
      () => escapeJsonStringValue(value),
    );
  }
  return result;
}

/** Build from the pristine template for both creation and upgrades. Never fall
 * back after a delivery attempt: an unknown outcome must not be sent again. */
function buildDirectAgentTaskRule(templateString: string): string {
  const rule = JSON.parse(templateString);
  const condition = (first: string, second: string) => ({
    component: 'CONDITION', schemaVersion: 1, type: 'jira.comparator.condition',
    value: { first, second, operator: 'EQUALS' }, children: [], conditions: [], optimisedIds: [], newComponent: false,
  });
  const walk = (node: any): void => {
    if (!Array.isArray(node.children)) return;
    node.children = node.children.flatMap((child: any) => {
      const relay = child.children?.find((action: any) => action.value?.url === '{{AGENT_TASK_DIFY_API_BASE_URL}}/workflows/run');
      if (!relay) { walk(child); return [child]; }
      return ['multica', 'legacy_memory'].flatMap(provider => ['http', 'https'].map(scheme => {
        const branch = JSON.parse(JSON.stringify(child));
        branch.conditions.push(condition('{{webhookResponse.body.agentProvider}}', provider),
          condition('{{webhookResponse.body.agentTaskRequest.scheme}}', scheme));
        const request = branch.children[0].value;
        // Jira requires a literal scheme in its URL field.
        request.url = scheme + '://{{webhookResponse.body.agentTaskRequest.hostAndPath}}';
        const names = provider === 'multica'
          ? [['Idempotency-Key', 'idempotencyKey']]
          : [['Authorization', 'authorization'], ['X-User-Id', 'userId'], ['X-Request-ID', 'requestId']];
        request.headers = [['Content-Type', 'application/json'], ['Accept', 'application/json']].map(([name, value]) => ({
          name, value: { keyOrValue: value, secret: false },
        })).concat(names.map(([name, field]) => ({ name, value: {
          keyOrValue: '{{webhookResponse.body.agentTaskRequest.' + field + '}}', secret: false,
        } })));
        request.headers.forEach((header: any) => {
          header.id = '_header_agent_direct_' + provider + '_' + scheme + '_' + header.name.toLowerCase().replace(/-/g, '_');
        });
        request.customBody = '{{webhookResponse.body.agentTaskRequest.body}}';
        const callback = branch.children[1].value;
        callback.url = callback.url.split('&requestId=')[0]
          + '&requestId={{executionKey.urlEncode}}&directReceipt=1&transportOk=true&statusCode={{webhookResponse.status}}'
          + '&accepted={{agentTaskAccepted.substring(0,6).urlEncode}}'
          + '&actionId={{webhookResponse.body.actionId.substring(0,129).urlEncode}}'
          + '&dispatchStatus={{webhookResponse.body.status.substring(0,32).urlEncode}}'
          + '&runId={{webhookResponse.body.run_id.substring(0,129).urlEncode}}'
          + '&issueId={{webhookResponse.body.issue_id.substring(0,129).urlEncode}}';
        // Jira variables render as strings, including the Memory boolean accepted.
        branch.children.splice(1, 0, {
          component: 'ACTION', schemaVersion: 1, type: 'jira.create.variable',
          value: { id: '_customsmartvalue_agentTaskAccepted_' + provider + '_' + scheme,
            name: { type: 'FREE', value: 'agentTaskAccepted' }, type: 'SMART',
            query: { type: 'SMART', value: '{{webhookResponse.body.accepted}}' }, lazy: false },
          children: [], conditions: [], optimisedIds: [], newComponent: false,
        });
        return branch;
      }));
    });
  };
  for (const component of rule.components || []) walk(component);
  return JSON.stringify(rule);
}

export function assertScheduledMessagesDifyJumpboardsConfigured(
  envConfig: DifyJumpboardEnv,
): void {
  const replacements = getScheduledMessagesDifyJumpboardReplacements(envConfig);
  const missing: string[] = [];
  if (!replacements['{{BOTMAN_DIFY_API_BASE_URL}}'] || !replacements['{{BOTMAN_DIFY_API_KEY}}']) {
    missing.push('BOTMAN_DIFY_API_BASE_URL / BOTMAN_DIFY_API_KEY');
  }
  if (missing.length > 0) {
    throw new Error(
      `Scheduled Messages Dify 跳板未配置完整：缺少 ${missing.join('；')}。请先在 .env 填写并发布对应 Dify Workflow。`,
    );
  }
}
