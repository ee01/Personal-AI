import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export const MCP_NAME_PREFIX = 'personal-ai-';
const BACKUP_NAME = 'mcp.json.personal-ai-acp.bak';

export type HttpMcpServer = {
  name: string;
  type?: string;
  url: string;
  headers?: Record<string, string>;
};

export type McpFileShape = {
  mcpServers?: Record<string, unknown>;
};

export type McpSessionGuard = {
  filePath: string;
  backupPath: string;
  createdFile: boolean;
  warnings: string[];
};

const HTTP_TYPES = new Set([
  'http',
  'sse',
  'streamable-http',
  'streamable_http',
  'streamable-http',
]);

export function isHttpMcpServer(server: unknown): server is HttpMcpServer {
  if (!server || typeof server !== 'object') return false;
  const item = server as Record<string, unknown>;
  if (typeof item.url !== 'string' || !item.url.trim()) return false;
  if (typeof item.command === 'string' && item.command.trim()) return false;
  const type = typeof item.type === 'string' ? item.type.toLowerCase() : '';
  if (type && !HTTP_TYPES.has(type)) return false;
  return true;
}

export function namespacedMcpName(name: string): string {
  const trimmed = (name || 'memory').trim() || 'memory';
  return trimmed.startsWith(MCP_NAME_PREFIX) ? trimmed : `${MCP_NAME_PREFIX}${trimmed}`;
}

export function toCursorMcpEntry(server: HttpMcpServer): Record<string, unknown> {
  const entry: Record<string, unknown> = { url: server.url };
  if (server.headers && Object.keys(server.headers).length > 0) {
    entry.headers = server.headers;
  }
  return entry;
}

export function mergeHttpMcpServers(
  existing: McpFileShape | undefined,
  servers: unknown[],
): { next: McpFileShape; warnings: string[]; addedKeys: string[] } {
  const mcpServers = {
    ...((existing?.mcpServers && typeof existing.mcpServers === 'object'
      ? existing.mcpServers
      : {}) as Record<string, unknown>),
  };
  const warnings: string[] = [];
  const addedKeys: string[] = [];
  for (const server of servers) {
    if (!isHttpMcpServer(server)) continue;
    const key = namespacedMcpName(server.name);
    if (Object.prototype.hasOwnProperty.call(mcpServers, key)) {
      warnings.push(`MCP "${key}" already exists; leaving the project entry unchanged`);
      continue;
    }
    mcpServers[key] = toCursorMcpEntry(server);
    addedKeys.push(key);
  }
  return { next: { ...existing, mcpServers }, warnings, addedKeys };
}

export function mcpFilePath(cwd: string): string {
  return path.join(cwd, '.cursor', 'mcp.json');
}

export function backupFilePath(cwd: string): string {
  return path.join(cwd, '.cursor', BACKUP_NAME);
}

async function readJsonFile(filePath: string): Promise<McpFileShape | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as McpFileShape;
  } catch {
    return undefined;
  }
}

export async function restoreMcpFile(cwd: string): Promise<void> {
  const filePath = mcpFilePath(cwd);
  const backupPath = backupFilePath(cwd);
  const backup = await readJsonFile(backupPath);
  try {
    await unlink(backupPath);
  } catch {
    /* no backup */
  }
  if (!backup) return;
  if ((backup as { __personalAiMissing?: boolean }).__personalAiMissing) {
    try {
      await unlink(filePath);
    } catch {
      /* already gone */
    }
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8');
}

export async function injectHttpMcpServers(
  cwd: string,
  servers: unknown[],
): Promise<McpSessionGuard> {
  const filePath = mcpFilePath(cwd);
  const backupPath = backupFilePath(cwd);
  await restoreMcpFile(cwd);
  const existing = await readJsonFile(filePath);
  const createdFile = !existing;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(
    backupPath,
    `${JSON.stringify(existing || { __personalAiMissing: true }, null, 2)}\n`,
    'utf8',
  );
  const { next, warnings } = mergeHttpMcpServers(existing, servers);
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return { filePath, backupPath, createdFile, warnings };
}
