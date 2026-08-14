/**
 * Thin OpenClaw Gateway WebSocket RPC client (protocol v4-ish).
 * Inject WebSocketImpl for unit tests.
 *
 * Prefer globalThis.WebSocket (Node 22+ / browsers). Fall back to the `ws`
 * package so Node 20 Docker images still work.
 */

import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

import {
  buildDeviceAuthPayloadV3,
  loadOrCreateGatewayDeviceIdentity,
  publicKeyRawBase64UrlFromPem,
  signDevicePayload,
  type OpenClawDeviceIdentity,
} from './openclawDeviceIdentity.js';

/** OpenClaw ConnectParams.client.id allowlist (gateway-protocol). */
export const OPENCLAW_GATEWAY_CLIENT_ID = 'gateway-client';
/** OpenClaw ConnectParams.client.mode allowlist — not the same as role. */
export const OPENCLAW_GATEWAY_CLIENT_MODE = 'backend';
export const OPENCLAW_GATEWAY_ROLE = 'operator';
export const OPENCLAW_GATEWAY_SCOPES = [
  'operator.read',
  'operator.write',
  'operator.admin',
] as const;

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

const require = createRequire(import.meta.url);

function resolveWebSocketImpl(
  override?: GatewayWebSocketConstructor,
): GatewayWebSocketConstructor {
  if (override) return override;
  const globalWs = (globalThis as { WebSocket?: GatewayWebSocketConstructor })
    .WebSocket;
  if (typeof globalWs === 'function') return globalWs;
  try {
    const wsModule = require('ws') as
      | GatewayWebSocketConstructor
      | { WebSocket?: GatewayWebSocketConstructor; default?: GatewayWebSocketConstructor };
    const candidate =
      typeof wsModule === 'function'
        ? wsModule
        : wsModule.WebSocket || wsModule.default;
    if (typeof candidate === 'function') return candidate;
  } catch {
    /* package missing — surface a clear error below */
  }
  throw new Error(
    'WebSocket is not available in this runtime (need Node 22+ global WebSocket or the `ws` package)',
  );
}

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
      /** Must be an OpenClaw allowlisted client id; defaults to gateway-client. */
      clientName?: string;
      clientVersion?: string;
      /** Persist path for Ed25519 device identity used in connect.device. */
      deviceIdentityPath?: string;
      /** Skip device identity (loopback token-only helper path). */
      omitDevice?: boolean;
    },
  ) {}

  async connect(): Promise<void> {
    if (this.connected && this.socket) return;

    const WebSocketImpl = resolveWebSocketImpl(this.options.WebSocketImpl);

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
    // OpenClaw requires waiting for connect.challenge before signing device auth.
    await this.waitForChallenge(5_000).catch(() => undefined);

    const protocol = this.options.protocol ?? 4;
    const clientId =
      this.options.clientName && this.options.clientName.trim()
        ? this.options.clientName.trim()
        : OPENCLAW_GATEWAY_CLIENT_ID;
    const clientMode = OPENCLAW_GATEWAY_CLIENT_MODE;
    const role = OPENCLAW_GATEWAY_ROLE;
    // Keep the wire scopes identical to the signed scopes (server does not
    // expand/sort before verifyDeviceSignature).
    const scopes = [...OPENCLAW_GATEWAY_SCOPES];
    const platform = process.platform;
    const version = this.options.clientVersion || '1.0.0';
    const authToken = this.options.apiKey?.trim() || undefined;
    // Match official gateway-client: signedAt is Date.now() at connect time,
    // not the challenge timestamp.
    const signedAtMs = Date.now();

    const params: Record<string, unknown> = {
      minProtocol: protocol,
      maxProtocol: protocol,
      client: {
        // Must be an allowlisted GatewayClientId — arbitrary names fail schema.
        id: clientId,
        version,
        platform,
        // mode ≠ role. Allowed: webchat|cli|ui|backend|node|probe|test
        mode: clientMode,
        // Omit deviceFamily unless we also sign it. Server rebuilds the v3
        // payload from connectParams.client.deviceFamily (undefined → "").
      },
      role,
      scopes,
      caps: [],
      commands: [],
      permissions: {},
      auth: authToken ? { token: authToken } : undefined,
      locale: 'zh-CN',
      userAgent: `personal-ai/${version}`,
    };

    if (!this.options.omitDevice) {
      const device = this.buildDeviceConnectParams({
        clientId,
        clientMode,
        role,
        scopes,
        platform,
        signedAtMs,
        token: authToken,
      });
      if (device) params.device = device;
    }

    await this.sendRequest('connect', params, 15_000);
  }

  private buildDeviceConnectParams(input: {
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    platform: string;
    signedAtMs: number;
    token?: string;
  }): Record<string, unknown> | undefined {
    // Incomplete device objects fail schema (publicKey/signature required).
    // Without a challenge nonce, skip device and rely on token-only trust paths.
    if (!this.challengeNonce) return undefined;

    let identity: OpenClawDeviceIdentity;
    try {
      identity = loadOrCreateGatewayDeviceIdentity(
        this.options.deviceIdentityPath,
      );
    } catch (error) {
      throw new Error(
        `OpenClaw gateway device identity unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Must mirror server resolveDeviceSignaturePayloadVersion():
    // platform/deviceFamily come from connectParams.client (not free-form).
    const payload = buildDeviceAuthPayloadV3({
      deviceId: identity.deviceId,
      clientId: input.clientId,
      clientMode: input.clientMode,
      role: input.role,
      scopes: input.scopes,
      signedAtMs: input.signedAtMs,
      token: input.token ?? null,
      nonce: this.challengeNonce,
      platform: input.platform,
      // Intentionally empty — we do not set client.deviceFamily above.
      deviceFamily: undefined,
    });

    return {
      id: identity.deviceId,
      publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
      signature: signDevicePayload(identity.privateKeyPem, payload),
      signedAt: input.signedAtMs,
      nonce: this.challengeNonce,
    };
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
