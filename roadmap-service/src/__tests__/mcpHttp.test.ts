import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ActorContext } from '../types.js';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'roadmap-mcp-http-'));
process.env.ROADMAP_AI_ENABLED = 'true';
process.env.ROADMAP_OPENAI_API_KEY = 'test-key';
process.env.ROADMAP_AI_AGENT_ACCESS = 'true';
process.env.ROADMAP_PUBLIC_BASE_URL = 'http://roadmap.xmnup.com';

const { createShareToken, createTeam } = await import('../core/TeamService.js');
const { registerMcpRoutes } = await import('../routes/mcp.js');
const { MCP_TOOL_NAMES } = await import('../mcp/catalog.js');

const actor: ActorContext = {
  name: 'McpTester',
  clientId: 'mcp-test',
  source: 'agent',
};

describe('remote MCP HTTP', () => {
  const app = Fastify({ logger: false });
  let teamId = '';
  let token = '';

  beforeAll(async () => {
    await registerMcpRoutes(app);
    const snapshot = createTeam({
      name: 'MCP Team',
      jql: 'project = NOVA AND issuetype = Epic',
      actor,
    });
    teamId = snapshot.team.id;
    token = createShareToken(teamId, actor).token;
  });

  it('advertises the hosted MCP URL without requiring a git clone', async () => {
    const res = await app.inject({ method: 'GET', url: '/mcp' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mcpUrl).toBe('http://roadmap.xmnup.com/mcp');
    expect(body.skillUrl).toBe('http://roadmap.xmnup.com/skills/roadmap-planning/SKILL.md');
    expect(body.transport).toBe('streamable-http');
  });

  it('initializes and lists tools without a local node binary', async () => {
    const init = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test' } },
      },
    });
    expect(init.statusCode).toBe(200);
    expect(init.headers['mcp-session-id']).toBeTruthy();
    expect(init.json().result.serverInfo.name).toBe('roadmap-planning');

    const listed = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    });
    const names = listed.json().result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual([...MCP_TOOL_NAMES]);
    expect(names.join(',')).not.toMatch(/jira|memory/i);
  });

  it('rejects tool calls without a share token and succeeds with headers', async () => {
    const denied = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'roadmap_get_context', arguments: {} },
      },
    });
    expect(denied.json().result.isError).toBe(true);
    expect(denied.json().result.structuredContent.error).toBe('mcp_auth_required');

    const ok = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: { 'x-team-id': teamId, 'x-share-token': token },
      payload: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'roadmap_get_context', arguments: {} },
      },
    });
    expect(ok.json().result.isError).toBe(false);
    expect(ok.json().result.structuredContent.context.teamId).toBe(teamId);
  });

  it('serves the skill markdown from the live service', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills/roadmap-planning/SKILL.md' });
    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain('name: roadmap-planning');
  });
});
