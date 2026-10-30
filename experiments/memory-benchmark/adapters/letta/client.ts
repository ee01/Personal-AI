import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface LettaClientOptions {
  url?: string;
  requestTimeoutMs?: number;
}

type AppServerClientLike = {
  connect(): Promise<unknown>;
  close(): void;
  request(
    type: string,
    body?: Record<string, unknown>,
    options?: {
      timeoutMs?: number;
      predicate?: (message: Record<string, unknown>) => boolean;
    },
  ): Promise<Record<string, unknown>>;
};

export class LettaAppClient {
  readonly url: string;
  private requestTimeoutMs: number;
  private inner: AppServerClientLike | null = null;
  private connecting: Promise<void> | null = null;

  constructor(opts: LettaClientOptions = {}) {
    this.url = opts.url ?? process.env.LETTA_APP_SERVER_URL ?? "ws://127.0.0.1:4500";
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 120_000;
  }

  async connect(): Promise<void> {
    if (this.inner) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const checkout = defaultLettaCheckout();
      const modulePath = join(checkout, "dist/app-server-client.js");
      if (!existsSync(modulePath)) {
        throw new Error(`LETTA_CLIENT_MISSING:${modulePath}`);
      }
      const mod = (await import(pathToFileURL(modulePath).href)) as {
        createAppServerClient: (o: {
          url: string;
          requestTimeoutMs?: number;
        }) => AppServerClientLike;
      };
      this.inner = mod.createAppServerClient({
        url: this.url,
        requestTimeoutMs: this.requestTimeoutMs,
      });
      await this.inner.connect();
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async typedRequest(
    type: string,
    body: Record<string, unknown>,
    responseType: string,
  ): Promise<Record<string, unknown>> {
    await this.connect();
    const response = await this.inner!.request(type, body, {
      timeoutMs: this.requestTimeoutMs,
      predicate: (message) => message.type === responseType,
    });
    if (response.success === false) {
      throw new Error(
        `${type} failed: ${typeof response.error === "string" ? response.error : JSON.stringify(response)}`,
      );
    }
    return response;
  }

  async healthOk(): Promise<boolean> {
    try {
      await this.connect();
      const info = await (this.inner as AppServerClientLike & {
        info?: () => Promise<Record<string, unknown>>;
      }).info?.();
      return info?.success === true;
    } catch {
      return false;
    }
  }

  async createBenchmarkAgent(model: string, tag: string): Promise<string> {
    const created = await this.typedRequest(
      "create_agent",
      {
        personality: "memo",
        model,
        pin_global: false,
        tags: ["memory-benchmark", tag],
      },
      "create_agent_response",
    );
    const agentId = created.agent_id;
    if (typeof agentId !== "string" || !agentId) {
      throw new Error("create_agent did not return agent_id");
    }
    return agentId;
  }

  async writeMemoryFile(
    agentId: string,
    path: string,
    content: string,
    commitMessage?: string,
  ): Promise<void> {
    await this.typedRequest(
      "write_memory_file",
      {
        agent_id: agentId,
        path,
        content,
        commit_message: commitMessage ?? `benchmark write ${path}`,
      },
      "write_memory_file_response",
    );
  }

  async readMemoryFile(agentId: string, path: string): Promise<string | null> {
    const read = await this.typedRequest(
      "read_memory_file",
      { agent_id: agentId, path },
      "read_memory_file_response",
    );
    return typeof read.content === "string" ? read.content : null;
  }

  async deleteMemoryFile(agentId: string, path: string): Promise<void> {
    await this.typedRequest(
      "delete_memory_file",
      { agent_id: agentId, path },
      "delete_memory_file_response",
    );
  }

  async listMemory(agentId: string): Promise<
    Array<{ relative_path: string; content: string }>
  > {
    const listed = await this.typedRequest(
      "list_memory",
      { agent_id: agentId },
      "list_memory_response",
    );
    const entries = listed.entries;
    if (!Array.isArray(entries)) return [];
    return entries
      .filter(
        (e): e is { relative_path: string; content: string } =>
          e &&
          typeof e === "object" &&
          typeof (e as { relative_path?: unknown }).relative_path === "string" &&
          typeof (e as { content?: unknown }).content === "string",
      )
      .map((e) => ({ relative_path: e.relative_path, content: e.content }));
  }

  async tryDream(
    agentId: string,
    conversationId: string,
  ): Promise<{ ok: boolean; output: string; native: boolean }> {
    await this.connect();
    try {
      const response = await this.inner!.request(
        "execute_command",
        {
          command_id: "dream",
          runtime: {
            agent_id: agentId,
            conversation_id: conversationId,
          },
        },
        {
          timeoutMs: this.requestTimeoutMs,
          predicate: (message) => message.type === "execute_command_response",
        },
      );
      return {
        ok: response.success === true,
        output: typeof response.output === "string" ? response.output : "",
        native: true,
      };
    } catch (e) {
      return {
        ok: false,
        output: e instanceof Error ? e.message : String(e),
        native: true,
      };
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    try {
      await this.typedRequest("agent_delete", { agent_id: agentId }, "agent_delete_response");
    } catch {
      /* best effort */
    }
  }

  close(): void {
    this.inner?.close();
    this.inner = null;
  }
}

export function defaultLettaCheckout(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../../../../personal-ai-letta");
}

export function lettaIntegrationAvailable(): boolean {
  const checkout = defaultLettaCheckout();
  return (
    existsSync(checkout) &&
    existsSync(join(checkout, "dist/app-server-client.js"))
  );
}
