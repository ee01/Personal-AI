/**
 * Thin OpenClaw Gateway WebSocket RPC client (protocol v4-ish).
 * Inject WebSocketImpl for unit tests.
 */

import { randomUUID } from 'node:crypto';

export type GatewayWebSocket = {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
  removeEventListener?(
    type: string,
    listener: (event: { data?: unknown; message?: string }) => void,
  ): void;
};

export type GatewayWebSocketConstructor = new (url: string) => GatewayWebSocket;

type PendingRequest = {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function toGatewayWsUrl(baseUrl: string): string {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) throw new Error('OpenClaw gateway baseUrl is required');
  let url = trimmed
    .replace(/\/v1\/responses$/i, '')
    .replace(/\/v1$/i, '');
  if (url.startsWith('https://')) url = `wss://${url.slice('https://'.length)}`;
  else if (url.startsWith('http://')) url = `ws://${url.slice('http://'.length)}`;
  else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = `ws://${url}`;
  }
  return url.replace(/\/+$/, '');
}

export class OpenClawGatewayClient {
  private socket: GatewayWebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private challengeNonce: string | null = null;
  private challengeTs: number | null = null;
  private connected = false;
  private connectWaiters: Array<() => void> = [];

  constructor(
    private readonly options: {
      baseUrl: string;
      apiKey?: string;
      WebSocketImpl?: GatewayWebSocketConstructor;
      requestTimeoutMs?: number;
      protocol?: number;
      clientName?: string;
      clientVersion?: string;
    },
  ) {}

  async connect(): Promise<void> {
    if (this.connected && this.socket) return;

    const WebSocketImpl =
      this.options.WebSocketImpl ||
      (globalThis as { WebSocket?: GatewayWebSocketConstructor }).WebSocket;
    if (!WebSocketImpl) {
      throw new Error('WebSocket is not available in this runtime');
    }

    const url = toGatewayWsUrl(this.options.baseUrl);
    const socket = new WebSocketImpl(url);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        /* listeners stay for the session life */
      };

      socket.addEventListener('open', () => {
        // Wait briefly for connect.challenge, then send connect.
        void this.handshake()
          .then(() => {
            this.connected = true;
            for (const waiter of this.connectWaiters) waiter();
            this.connectWaiters = [];
            resolve();
          })
          .catch(fail);
      });
      socket.addEventListener('error', (event) => {
        fail(new Error(event.message || 'OpenClaw gateway WebSocket error'));
      });
      socket.addEventListener('close', () => {
        this.connected = false;
        this.rejectAll(new Error('OpenClaw gateway connection closed'));
      });
      socket.addEventListener('message', (event) => {
        this.handleMessage(String(event.data ?? ''));
      });
    });
  }

  async request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    if (!this.socket || this.socket.readyState > 1) {
      await this.connect();
    }
    return this.sendRequest<T>(method, params, timeoutMs);
  }

  private sendRequest<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    if (!this.socket) throw new Error('OpenClaw gateway socket missing');

    const id = randomUUID();
    const timeout = Math.max(
      1000,
      timeoutMs ?? this.options.requestTimeoutMs ?? 60_000,
    );

    const payload = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OpenClaw gateway RPC timeout: ${method}`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(
        JSON.stringify({
          type: 'req',
          id,
          method,
          params: params ?? {},
        }),
      );
    });

    return payload as Promise<T>;
  }

  close(): void {
    this.connected = false;
    this.rejectAll(new Error('OpenClaw gateway client closed'));
    try {
      this.socket?.close();
    } catch {
      /* ignore */
    }
    this.socket = null;
  }

  private async handshake(): Promise<void> {
    // Prefer waiting for connect.challenge; token-only auth can proceed without device.
    await this.waitForChallenge(1500).catch(() => undefined);

    const protocol = this.options.protocol ?? 4;
    const params: Record<string, unknown> = {
      minProtocol: protocol,
      maxProtocol: protocol,
      client: {
        id: this.options.clientName || 'personal-ai',
        version: this.options.clientVersion || '1.0.0',
        platform: process.platform,
        mode: 'operator',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.admin'],
      caps: [],
      commands: [],
      permissions: {},
      auth: this.options.apiKey ? { token: this.options.apiKey } : undefined,
      locale: 'zh-CN',
      userAgent: `personal-ai/${this.options.clientVersion || '1.0.0'}`,
    };

    if (this.challengeNonce && this.challengeTs != null) {
      params.device = {
        id: 'personal-ai-memory-service',
        nonce: this.challengeNonce,
        signedAt: this.challengeTs,
      };
    }

    await this.sendRequest('connect', params, 15_000);
  }

  private waitForChallenge(timeoutMs: number): Promise<void> {
    if (this.challengeNonce) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('connect.challenge timeout')),
        timeoutMs,
      );
      const check = () => {
        if (this.challengeNonce) {
          clearTimeout(timer);
          resolve();
        } else {
          setTimeout(check, 25);
        }
      };
      check();
    });
  }

  private handleMessage(raw: string): void {
    let frame: Record<string, unknown>;
    try {
      frame = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (frame.type === 'event' && frame.event === 'connect.challenge') {
      const payload =
        frame.payload && typeof frame.payload === 'object'
          ? (frame.payload as Record<string, unknown>)
          : {};
      this.challengeNonce =
        typeof payload.nonce === 'string' ? payload.nonce : null;
      this.challengeTs =
        typeof payload.ts === 'number' ? payload.ts : Date.now();
      return;
    }

    if (frame.type === 'res' && typeof frame.id === 'string') {
      const pending = this.pending.get(frame.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(frame.id);
      if (frame.ok === false) {
        const error =
          frame.error && typeof frame.error === 'object'
            ? (frame.error as { message?: string; code?: string })
            : {};
        pending.reject(
          new Error(
            error.message ||
              error.code ||
              `OpenClaw gateway RPC failed (${frame.id})`,
          ),
        );
        return;
      }
      pending.resolve(frame.payload);
    }
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
