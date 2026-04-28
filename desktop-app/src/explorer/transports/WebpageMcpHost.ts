/**
 * WebpageMcpHost manages the lifecycle of the `webpage-mcp-stdio` child
 * process and exposes a high-level `callTool()`, `evalInTab()`, and
 * `findTabByUrl()` API for using it.
 *
 * Architecture:
 *  - Spawns `webpage-mcp-stdio` via the MCP SDK's StdioClientTransport.
 *  - Connects to the existing native-messaging UNIX socket managed by the
 *    Webpage MCP Chrome extension / native host. Does NOT call `register`
 *    (which would overwrite the existing registration and break the active
 *    Chrome extension connection).
 *  - Health-checks the extension connection every 30 s via `get_windows_and_tabs`.
 *  - Auto-restarts up to 3 times before giving up and flagging all callers
 *    to fall back to Playwright.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import type { WebpageMcpStatus } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEALTH_INTERVAL_MS = 30_000;
const MAX_RESTART_ATTEMPTS = 3;

function resolveMcpStdioPath(): string {
  return path.join(
    __dirname,
    '..',
    '..',
    '..',
    'node_modules',
    'webpage-mcp',
    'dist',
    'mcp',
    'mcp-server-stdio.js',
  );
}

/** Minimal shape of an MCP tool call result. */
interface McpToolResult {
  content?: Array<{ type: string; text?: string }>;
}

/** Shape of the chrome_javascript MCP response envelope. */
interface CJsEnvelope {
  success?: boolean;
  result?: unknown;
  error?: string;
}

/** Shape of the get_windows_and_tabs MCP response. */
interface WindowsAndTabsResult {
  windows?: Array<{
    windowId: number;
    tabs?: Array<{ tabId: number; url?: string | null; title?: string | null }>;
  }>;
}

export class WebpageMcpHost {
  private static instance: WebpageMcpHost | null = null;

  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private restartAttempts = 0;
  private starting = false;

  private status: WebpageMcpStatus = {
    running: false,
    extensionConnected: false,
  };

  static getInstance(): WebpageMcpHost {
    WebpageMcpHost.instance ??= new WebpageMcpHost();
    return WebpageMcpHost.instance;
  }

  getStatus(): WebpageMcpStatus {
    return { ...this.status };
  }

  /**
   * Ensure the host is running. Idempotent.
   */
  async start(): Promise<void> {
    if (this.status.running || this.starting) return;
    this.starting = true;
    try {
      await this.doStart();
    } catch (error) {
      this.status.lastError =
        error instanceof Error ? error.message : String(error);
      this.status.running = false;
    } finally {
      this.starting = false;
    }
  }

  /**
   * Try to start and call get_windows_and_tabs; returns tab count on success.
   * Throws with a descriptive message on failure.
   */
  async testConnection(): Promise<{ tabCount: number }> {
    await this.start();
    if (!this.client) {
      throw new Error(
        this.status.lastError ||
          '无法启动 webpage-mcp 服务。请确认 Chrome 扩展已安装并显示为绿色连接状态。',
      );
    }
    const raw = (await this.client.callTool({
      name: 'get_windows_and_tabs',
      arguments: {},
    })) as McpToolResult;
    const data = this.parseTextContent<WindowsAndTabsResult>(raw);
    if (!data?.windows) {
      throw new Error('扩展已连接但返回了空数据，请尝试重启 Chrome。');
    }
    const tabCount = data.windows.reduce(
      (n, w) => n + (w.tabs?.length ?? 0),
      0,
    );
    this.status.extensionConnected = true;
    return { tabCount };
  }

  /**
   * Stop the host process and cancel health checks.
   */
  async stop(): Promise<void> {
    this.clearHealthTimer();
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // best-effort
      }
    }
    this.client = null;
    this.transport = null;
    this.status.running = false;
    this.status.extensionConnected = false;
  }

  /**
   * Restart the host. Resets restart counter.
   */
  async restart(): Promise<void> {
    this.restartAttempts = 0;
    await this.stop();
    await this.start();
  }

  /**
   * Call a webpage-mcp tool. Starts the host if not running.
   * Throws if the host cannot be started or the call fails.
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolResult> {
    if (!this.status.running) {
      await this.start();
    }
    if (!this.client) {
      throw new Error('WebpageMcpHost is not running');
    }
    return (await this.client.callTool({ name, arguments: args })) as McpToolResult;
  }

  /**
   * Find the first tab whose URL contains `urlPattern`.
   * Returns undefined if no matching tab is found.
   */
  async findTabByUrl(urlPattern: string): Promise<number | undefined> {
    const raw = await this.callTool('get_windows_and_tabs', {});
    const data = this.parseTextContent<WindowsAndTabsResult>(raw);
    for (const win of data?.windows ?? []) {
      for (const tab of win.tabs ?? []) {
        if (tab.url?.includes(urlPattern)) return tab.tabId;
      }
    }
    return undefined;
  }

  /**
   * Execute JavaScript in a Chrome tab and return the JS return value as a
   * string. If `tabId` is undefined the active tab is used.
   *
   * The MCP response is an envelope `{ success, result, ... }` — we extract
   * the `result` field and normalise it to a string.
   */
  async evalInTab(tabId: number | undefined, code: string): Promise<string> {
    const args: Record<string, unknown> = { code };
    if (tabId !== undefined) args.tabId = tabId;
    const raw = await this.callTool('chrome_javascript', args);
    const envelope = this.parseTextContent<CJsEnvelope>(raw);
    if (envelope?.result !== undefined) {
      return typeof envelope.result === 'string'
        ? envelope.result
        : JSON.stringify(envelope.result);
    }
    // Fallback: return raw text
    const textContent = raw?.content?.find((c) => c.type === 'text');
    return textContent?.text ?? '';
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private parseTextContent<T>(raw: McpToolResult): T | undefined {
    const textContent = raw?.content?.find((c) => c.type === 'text');
    if (!textContent?.text) return undefined;
    try {
      return JSON.parse(textContent.text) as T;
    } catch {
      return undefined;
    }
  }

  private async doStart(): Promise<void> {
    const mcpPath = resolveMcpStdioPath();
    // Cursor/Codex run `npx … webpage-mcp-stdio` with real Node. In Electron,
    // `process.execPath` is the Electron binary — without ELECTRON_RUN_AS_NODE
    // the MCP child exits immediately → MCP -32000 Connection closed.
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [mcpPath],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stderr: 'pipe',
    });

    const client = new Client(
      { name: 'personal-ai-desktop', version: '1.0.0' },
      { capabilities: {} },
    );

    transport.onerror = (error) => {
      console.warn('[WebpageMcpHost] transport error:', error.message);
      this.status.lastError = error.message;
    };

    transport.onclose = () => {
      this.status.running = false;
      this.status.extensionConnected = false;
      void this.handleUnexpectedClose();
    };

    await client.connect(transport);

    this.client = client;
    this.transport = transport;
    this.status.running = true;
    this.status.lastError = undefined;
    this.restartAttempts = 0;

    this.startHealthChecks();
    await this.healthCheck();
  }

  private async handleUnexpectedClose(): Promise<void> {
    this.clearHealthTimer();
    if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
      console.error(
        `[WebpageMcpHost] Crashed ${MAX_RESTART_ATTEMPTS} times, giving up.`,
      );
      this.status.lastError = `Crashed ${MAX_RESTART_ATTEMPTS} times; sources will fall back to Playwright.`;
      return;
    }
    this.restartAttempts++;
    console.warn(
      `[WebpageMcpHost] Process closed unexpectedly; restarting (attempt ${this.restartAttempts}/${MAX_RESTART_ATTEMPTS})...`,
    );
    try {
      await this.doStart();
    } catch (error) {
      this.status.lastError =
        error instanceof Error ? error.message : String(error);
    }
  }

  private startHealthChecks(): void {
    this.clearHealthTimer();
    this.healthTimer = setInterval(() => {
      void this.healthCheck();
    }, HEALTH_INTERVAL_MS);
    this.healthTimer.unref?.();
  }

  private clearHealthTimer(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private async healthCheck(): Promise<void> {
    if (!this.client || !this.status.running) return;
    try {
      await this.client.callTool({ name: 'get_windows_and_tabs', arguments: {} });
      this.status.extensionConnected = true;
      this.status.lastError = undefined;
    } catch (error) {
      this.status.extensionConnected = false;
      this.status.lastError =
        error instanceof Error ? error.message : String(error);
    }
  }
}
