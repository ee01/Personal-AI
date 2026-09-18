import {
  PLANNING_CLIENT_MIN_VERSION,
  PLANNING_CONTRACT_VERSION,
  PLANNING_SCHEMA_VERSION,
  createRoadmapClient,
  loadClientFromEnv,
  type RoadmapClientConfig,
} from './http.js';

export const MCP_TOOL_NAMES = [
  'roadmap_get_context',
  'roadmap_validate_plan',
  'roadmap_revise_plan',
  'roadmap_generate_plan',
  'roadmap_get_request',
  'roadmap_cancel_job',
  'roadmap_commit_plan',
  'roadmap_get_batch',
  'roadmap_undo_batch',
] as const;

export const MCP_TOOLS = [
  {
    name: 'roadmap_get_context',
    description:
      'Read the bound team planning context: limits, candidate parents, members, versions. Does not write Draft or call the server LLM.',
    inputSchema: {
      type: 'object',
      properties: {
        itemKeys: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'roadmap_validate_plan',
    description:
      'Submit a DraftPlanV1 structured plan for validation/normalization. Saves a pending revision. No Draft/Jira writes and no server LLM cost. autoCommit is always false.',
    inputSchema: {
      type: 'object',
      required: ['requestId', 'sources', 'plan', 'referenceDate'],
      properties: {
        requestId: { type: 'string' },
        sources: { type: 'array' },
        plan: { type: 'object' },
        referenceDate: { type: 'string' },
        planningStart: { type: 'string' },
        timezone: { type: 'string' },
        quarter: { type: 'string' },
        parentSelection: { type: 'object' },
      },
    },
  },
  {
    name: 'roadmap_revise_plan',
    description: 'Revise a saved plan revision and re-validate. Does not write Draft.',
    inputSchema: {
      type: 'object',
      required: ['planId', 'baseRevision'],
      properties: {
        planId: { type: 'string' },
        baseRevision: { type: 'number' },
        changes: { type: 'object' },
      },
    },
  },
  {
    name: 'roadmap_generate_plan',
    description:
      'Explicitly delegate parsing to the Roadmap server LLM. Consumes server quota. Defaults to autoCommit=false.',
    inputSchema: {
      type: 'object',
      required: ['requestId', 'text', 'referenceDate'],
      properties: {
        requestId: { type: 'string' },
        text: { type: 'string' },
        referenceDate: { type: 'string' },
        planningStart: { type: 'string' },
        timezone: { type: 'string' },
        quarter: { type: 'string' },
        parentSelection: { type: 'object' },
        autoCommit: { type: 'boolean' },
      },
    },
  },
  {
    name: 'roadmap_get_request',
    description: 'Look up a generate/validate/commit result by requestId or jobId for timeout recovery.',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string' },
        jobId: { type: 'string' },
      },
    },
  },
  {
    name: 'roadmap_cancel_job',
    description:
      'Cancel a generation job that has not committed. If already committed, returns the receipt instead of pretending it was undone.',
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: { jobId: { type: 'string' } },
    },
  },
  {
    name: 'roadmap_commit_plan',
    description: 'Atomically write Draft items from a fixed plan revision/hash. Jira issue creation is out of scope.',
    inputSchema: {
      type: 'object',
      required: ['planId', 'requestId', 'revision', 'planHash'],
      properties: {
        planId: { type: 'string' },
        requestId: { type: 'string' },
        revision: { type: 'number' },
        planHash: { type: 'string' },
        decisions: { type: 'object' },
        quarter: { type: 'string' },
      },
    },
  },
  {
    name: 'roadmap_get_batch',
    description: 'Read a committed batch receipt and Roadmap URL (never includes the edit token).',
    inputSchema: {
      type: 'object',
      required: ['batchId'],
      properties: { batchId: { type: 'string' } },
    },
  },
  {
    name: 'roadmap_undo_batch',
    description: 'Undo a Draft batch. Rows that already have a Jira key, or were edited after commit, are left in place.',
    inputSchema: {
      type: 'object',
      required: ['batchId'],
      properties: { batchId: { type: 'string' } },
    },
  },
];

type Client = ReturnType<typeof createRoadmapClient>;

export async function dispatchTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'roadmap_get_context':
      return {
        contractVersion: PLANNING_CONTRACT_VERSION,
        schemaVersion: PLANNING_SCHEMA_VERSION,
        planningClientMinVersion: PLANNING_CLIENT_MIN_VERSION,
        capabilities: await client.capabilities(),
        context: await client.context(
          Array.isArray(args.itemKeys) ? args.itemKeys.map(String) : undefined,
        ),
      };
    case 'roadmap_validate_plan':
      return client.validatePlan(args);
    case 'roadmap_revise_plan':
      return client.revisePlan(String(args.planId), {
        baseRevision: args.baseRevision,
        changes: (args.changes || {}) as Record<string, unknown>,
      });
    case 'roadmap_generate_plan':
      return client.generatePlan({ ...args, autoCommit: args.autoCommit === true });
    case 'roadmap_get_request':
      if (args.jobId) return client.getJob(String(args.jobId));
      return client.getRequest(String(args.requestId || ''));
    case 'roadmap_cancel_job':
      return client.cancelJob(String(args.jobId));
    case 'roadmap_commit_plan':
      return client.commitPlan(String(args.planId), args);
    case 'roadmap_get_batch':
      return client.getBatch(String(args.batchId));
    case 'roadmap_undo_batch':
      return client.undoBatch(String(args.batchId));
    default:
      throw new Error(`unknown_tool:${name}`);
  }
}

export function createClient(config?: RoadmapClientConfig) {
  return config ? createRoadmapClient(config) : loadClientFromEnv();
}
