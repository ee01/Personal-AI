import { describe, expect, it, vi } from 'vitest';

import {
  OpenClawGatewayClient,
  toGatewayWsUrl,
  type GatewayWebSocket,
} from '../integrations/openclaw/OpenClawGatewayClient.js';
import { OpenClawGatewayExecutor } from '../integrations/executors/OpenClawGatewayExecutor.js';

class FakeSocket implements GatewayWebSocket {
  readyState = 1;
  private listeners = new Map<string, Array<(event: any) => void>>();
  sent: string[] = [];

  addEventListener(type: string, listener: (event: any) => void) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  send(data: string) {
    this.sent.push(data);
    const frame = JSON.parse(data) as {
      type: string;
      id: string;
      method: string;
      params?: Record<string, unknown>;
    };
    if (frame.method === 'connect') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { type: 'hello-ok', protocol: 4 },
        }),
      });
      return;
    }
    if (frame.method === 'agent') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { runId: 'run-123' },
        }),
      });
      return;
    }
    if (frame.method === 'agent.wait') {
      if ((this as any).failWait) {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: false,
            error: { message: 'fetch failed' },
          }),
        });
        return;
      }
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: {
            text: JSON.stringify({
              status: 'success',
              summary: 'done',
              artifacts: [
                {
                  kind: 'note',
                  content: 'opened',
                  metadata: {
                    sourceSystem: 'chrome',
                    entityId: '1',
                    verification: 'read',
                    observedFields: ['url'],
                  },
                },
              ],
            }),
          },
        }),
      });
      return;
    }
    if (frame.method === 'sessions.get' || frame.method === 'sessions.list') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: (this as any).sessionPayload ?? { status: 'running' },
        }),
      });
    }
  }

  close() {
    this.readyState = 3;
  }

  emit(type: string, event: any) {
    for (const listener of this.listeners.get(type) || []) listener(event);
  }

  open() {
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

describe('OpenClawGatewayClient', () => {
  it('normalizes http base urls to ws gateway roots', () => {
    expect(toGatewayWsUrl('http://127.0.0.1:18789/v1/responses')).toBe(
      'ws://127.0.0.1:18789',
    );
    expect(toGatewayWsUrl('https://gw.example/v1')).toBe('wss://gw.example');
  });
});

describe('OpenClawGatewayExecutor', () => {
  it('submits agent + wait and returns a verifiable success envelope', async () => {
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      queueMicrotask(() => socket!.open());
      return socket;
    });

    const patches: Array<Record<string, unknown>> = [];
    const executor = new OpenClawGatewayExecutor(
      {
        id: 'gw-main',
        label: 'GW',
        type: 'openclaw-gateway',
        baseUrl: 'http://127.0.0.1:18789',
        apiKey: 'token',
        enabled: true,
      },
      {
        WebSocketImpl: FakeWS as any,
        onProgress: (patch) => {
          patches.push(patch);
        },
      },
    );

    const result = await executor.submit({
      task: 'open baidu',
      mode: 'read',
      threadId: 't1',
      actionId: 'a1',
      sessionKey: 'session-1',
      timeoutMs: 5000,
    });

    expect(result.status).toBe('succeeded');
    expect(result.remoteRunId).toBe('run-123');
    expect(patches[0]).toMatchObject({
      remoteRunId: 'run-123',
      status: 'running',
    });
  });

  it('reconciles to running instead of failed when wait drops but session is active', async () => {
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      (socket as any).failWait = true;
      (socket as any).sessionPayload = { status: 'running', runId: 'run-123' };
      queueMicrotask(() => socket!.open());
      return socket;
    });

    const executor = new OpenClawGatewayExecutor(
      {
        id: 'gw-main',
        label: 'GW',
        type: 'openclaw-gateway',
        baseUrl: 'http://127.0.0.1:18789',
        enabled: true,
      },
      { WebSocketImpl: FakeWS as any },
    );

    const result = await executor.submit({
      task: 'long job',
      mode: 'read',
      threadId: 't1',
      actionId: 'a2',
      sessionKey: 'session-2',
      timeoutMs: 5000,
    });

    expect(result.status).toBe('running');
    expect(result.remoteRunId).toBe('run-123');
    expect(result.payload).toMatchObject({ stillRunning: true });
  });
});
