/**
 * Transport mode for browser-based data sources.
 *
 * - `playwright` (default): Launches Playwright's bundled Chromium. Works
 *   out of the box with no extra configuration.
 * - `webpage_mcp`: Connects to the user's daily Chrome browser via the
 *   "Webpage MCP Connector" Chrome extension + Native Messaging host. Allows
 *   reusing existing login sessions (avoids Cloudflare challenges, etc.).
 *   Requires the Chrome extension to be installed. Falls back to Playwright
 *   automatically when the extension is unreachable.
 */
export type TransportMode = 'playwright' | 'webpage_mcp';

export interface WebpageMcpStatus {
  /** Whether the MCP host process is running. */
  running: boolean;
  /** Whether the Chrome extension is connected and responding. */
  extensionConnected: boolean;
  /** Last error message from the MCP host, if any. */
  lastError?: string;
}
