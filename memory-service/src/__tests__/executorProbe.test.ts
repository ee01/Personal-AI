import { describe, expect, it } from 'vitest';

import { createFakeAcpChild } from '../integrations/acp/AcpStdioClient.js';
import {
  isPrivateOrLoopbackUrl,
  probeExecutor,
} from '../integrations/executors/executorProbe.js';
import type { GatewayWebSocket } from '../integrations/openclaw/OpenClawGatewayClient.js';

class FakeSocket implements GatewayWebSocket {
  readyState = 1;
  private listeners = new Map<string, Array<(event: { data?: unknown; message?: string }) => void>>();
  sent: string[] = [];

  addEventListener(type: string, listener: (event: { data?: unknown; message?: string }) => void) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string) {
    this.sent.push(data);
    const frame = JSON.parse(data) as { id: string; method: string };
    if (frame.method === 'connect') {
      this.emit('message', {
        data: JSON.stringify({ type: 'res', id: frame.id, ok: true, payload: {} }),
      });
    }
  }

  close() {
    this.readyState = 3;
  }

  emit(type: string, event: { data?: unknown; message?: string }) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  triggerOpen() {
    this.emit('open', {});
    this.emit('message', {
      data: JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'n1', ts: Date.now() },
      }),
    });
  }
}

describe('executorProbe', () => {
  it('flags loopback and RFC1918 URLs', () => {
    expect(isPrivateOrLoopbackUrl('http://127.0.0.1:18789')).toBe(true);
    expect(isPrivateOrLoopbackUrl('http://10.32.56.212:3210')).toBe(true);
    expect(isPrivateOrLoopbackUrl('https://openclaw.example')).toBe(false);
  });

  it('openclaw-responses treats 401 as auth stage', async () => {
    const result = await probeExecutor(
      {
        id: 'http-1',
        label: 'HTTP',
        type: 'openclaw-responses',
        baseUrl: 'https://openclaw.example/v1/responses',
        apiKey: 'bad',
        enabled: true,
      },
      {},
      {
        fetchFn: async () =>
          new Response('nope', { status: 401 }) as Response,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('auth');
    expect(result.nextAction).toMatch(/API Key/);
  });

  it('openclaw-responses treats fetch failure as connect', async () => {
    const result = await probeExecutor(
      {
        id: 'http-2',
        label: 'HTTP',
        type: 'openclaw-responses',
        baseUrl: 'https://openclaw.example/v1/responses',
        enabled: true,
      },
      {},
      {
        fetchFn: async () => {
          throw new Error('ECONNREFUSED');
        },
      },
    );
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('connect');
  });

  it('openclaw-gateway ready after WS handshake', async () => {
    const result = await probeExecutor(
      {
        id: 'gw',
        label: 'GW',
        type: 'openclaw-gateway',
        baseUrl: 'http://127.0.0.1:18789',
        enabled: true,
      },
      {},
      {
        WebSocketImpl: class {
          constructor() {
            const socket = new FakeSocket();
            queueMicrotask(() => socket.triggerOpen());
            return socket;
          }
        } as unknown as new (url: string) => GatewayWebSocket,
      },
    );
    expect(result.ok).toBe(true);
    expect(result.stage).toBe('ready');
  });

  it('acp local missing command is a readable connect error', async () => {
    const result = await probeExecutor(
      {
        id: 'codex',
        label: 'Codex',
        type: 'acp-codex',
        runtime: 'local',
        enabled: true,
      },
      {},
      {
        spawnFn: () => {
          const err = new Error('spawn npx ENOENT');
          throw err;
        },
      },
    );
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('connect');
    expect(result.detail).toMatch(/ENOENT|不可用/);
    expect(result.nextAction).toMatch(/codex-acp|PATH/i);
  });

  it('acp local initialize handshake is ready', async () => {
    const result = await probeExecutor(
      {
        id: 'codex',
        label: 'Codex',
        type: 'acp-codex',
        runtime: 'local',
        cwd: '/tmp',
        enabled: true,
      },
      {},
      {
        spawnFn: () =>
          createFakeAcpChild({
            onRequest: (method, _params, respond) => {
              if (method === 'initialize') {
                respond({ protocolVersion: 1 });
              }
            },
          }),
      },
    );
    expect(result.ok).toBe(true);
    expect(result.stage).toBe('ready');
  });

  it('acp remote without worker tells the user to pair', async () => {
    const result = await probeExecutor({
      id: 'codex-remote',
      label: 'Codex',
      type: 'acp-codex',
      runtime: 'remote',
      enabled: true,
    });
    expect(result.ok).toBe(false);
    expect(result.nextAction).toMatch(/Desktop App|pairing/i);
  });

  it('acp remote uses heartbeat age and optional echo', async () => {
    const now = Date.now();
    const light = await probeExecutor(
      {
        id: 'codex-remote',
        label: 'Codex',
        type: 'acp-codex',
        runtime: 'remote',
        workerId: 'w1',
        enabled: true,
      },
      {},
      {
        now: () => now,
        lookupWorkerHeartbeat: async () => ({
          lastHeartbeatAt: Math.floor(now / 1000),
          status: 'online',
          label: 'Mac',
        }),
      },
    );
    expect(light.ok).toBe(true);
    expect(light.detail).toMatch(/心跳正常/);

    const deep = await probeExecutor(
      {
        id: 'codex-remote',
        label: 'Codex',
        type: 'acp-codex',
        runtime: 'remote',
        workerId: 'w1',
        enabled: true,
      },
      { deep: true },
      {
        now: () => now,
        lookupWorkerHeartbeat: async () => ({
          lastHeartbeatAt: Math.floor(now / 1000),
          status: 'online',
        }),
        enqueueEcho: async () => ({ commandId: 'cmd-1' }),
        waitEcho: async () => true,
      },
    );
    expect(deep.ok).toBe(true);
    expect(deep.detail).toMatch(/echo/);
  });
});
