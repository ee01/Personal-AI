import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  OpenClawGatewayClient,
  toGatewayWsUrl,
  type GatewayWebSocket,
} from '../integrations/openclaw/OpenClawGatewayClient.js';
import {
  buildDeviceAuthPayloadV3,
  verifyDeviceSignature,
} from '../integrations/openclaw/openclawDeviceIdentity.js';
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
      if ((this as any).waitSnapshot) {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              runId: 'run-123',
              status: 'ok',
              startedAt: 1,
              endedAt: 2,
              stopReason: 'stop',
            },
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
    if (frame.method === 'chat.history') {
      const messages =
        (this as any).historyMessages ||
        [
          {
            role: 'assistant',
            text: JSON.stringify({
              status: 'success',
              summary: 'done via history',
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
        ];
      const historyPayload = (this as any).historyPayload || { messages };
      const delayMs = Number((this as any).slowHistoryMs || 0);
      const respond = () => {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: historyPayload,
          }),
        });
      };
      if (delayMs > 0) setTimeout(respond, delayMs);
      else respond();
      return;
    }
    if (frame.method === 'sessions.resolve') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: {
            ok: true,
            key: `agent:main:${frame.params?.key || 'session'}`,
          },
        }),
      });
      return;
    }
    if (frame.method === 'sessions.preview') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { messages: [] },
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

  it('connects with allowlisted client id/mode and signed device identity', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-id-'));
    const identityPath = path.join(tempDir, 'device.json');
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      queueMicrotask(() => {
        socket!.emit('open', {});
        socket!.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'connect.challenge',
            payload: { nonce: 'nonce-1', ts: 1_700_000_000_000 },
          }),
        });
      });
      return socket;
    });

    try {
      const client = new OpenClawGatewayClient({
        baseUrl: 'http://127.0.0.1:18789',
        apiKey: 'tok',
        WebSocketImpl: FakeWS as any,
        deviceIdentityPath: identityPath,
      });
      await client.connect();
      const connectFrame = JSON.parse(
        socket!.sent.find((raw) => {
          try {
            return JSON.parse(raw).method === 'connect';
          } catch {
            return false;
          }
        })!,
      ) as {
        params: {
          client: { id: string; mode: string; platform: string; deviceFamily?: string };
          role: string;
          scopes: string[];
          auth: { token: string };
          device: {
            id: string;
            publicKey: string;
            signature: string;
            nonce: string;
            signedAt: number;
          };
        };
      };
      expect(connectFrame.params.client.id).toBe('gateway-client');
      expect(connectFrame.params.client.mode).toBe('backend');
      expect(connectFrame.params.client.deviceFamily).toBeUndefined();
      expect(connectFrame.params.role).toBe('operator');
      expect(connectFrame.params.device.nonce).toBe('nonce-1');
      expect(connectFrame.params.device.publicKey.length).toBeGreaterThan(20);
      expect(connectFrame.params.device.signature.length).toBeGreaterThan(20);

      // Reconstruct the exact payload OpenClaw verifies on the server.
      const payload = buildDeviceAuthPayloadV3({
        deviceId: connectFrame.params.device.id,
        clientId: connectFrame.params.client.id,
        clientMode: connectFrame.params.client.mode,
        role: connectFrame.params.role,
        scopes: connectFrame.params.scopes,
        signedAtMs: connectFrame.params.device.signedAt,
        token: connectFrame.params.auth.token,
        nonce: connectFrame.params.device.nonce,
        platform: connectFrame.params.client.platform,
        deviceFamily: connectFrame.params.client.deviceFamily,
      });
      expect(
        verifyDeviceSignature(
          connectFrame.params.device.publicKey,
          payload,
          connectFrame.params.device.signature,
        ),
      ).toBe(true);
      client.close();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('OpenClawGatewayExecutor', () => {
  it('submits agent + wait and returns a verifiable success envelope', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-exec-'));
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      queueMicrotask(() => socket!.open());
      return socket;
    });

    const patches: Array<Record<string, unknown>> = [];
    try {
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
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('loads assistant envelope from chat.history after agent.wait snapshot', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-exec-'));
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      (socket as any).waitSnapshot = true;
      queueMicrotask(() => socket!.open());
      return socket;
    });

    try {
      const executor = new OpenClawGatewayExecutor(
        {
          id: 'gw-main',
          label: 'GW',
          type: 'openclaw-gateway',
          baseUrl: 'http://127.0.0.1:18789',
          apiKey: 'token',
          enabled: true,
        },
        { WebSocketImpl: FakeWS as any },
      );

      const result = await executor.submit({
        task: 'open baidu',
        mode: 'read',
        threadId: 't1',
        actionId: 'a-history',
        sessionKey: 'session-history',
        timeoutMs: 5000,
      });

      expect(result.status).toBe('succeeded');
      expect(result.summary).toBe('done via history');
      expect(result.remoteRunId).toBe('run-123');
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('parses OpenClaw content-part arrays from chat.history', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-exec-'));
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      (socket as any).waitSnapshot = true;
      (socket as any).historyMessages = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Codex reasoning:\n**thinking**' }],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'success',
                summary: 'content-parts-ok',
                artifacts: [
                  {
                    kind: 'note',
                    content: 'ok',
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
          ],
        },
      ];
      queueMicrotask(() => socket!.open());
      return socket;
    });

    try {
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
        task: 'x',
        mode: 'read',
        threadId: 't1',
        actionId: 'a-parts',
        sessionKey: 'session-parts',
        timeoutMs: 5000,
      });

      expect(result.status).toBe('succeeded');
      expect(result.summary).toBe('content-parts-ok');
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('parses assistant output from protocol v3 session previews', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-exec-'));
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      (socket as any).waitSnapshot = true;
      (socket as any).historyPayload = {
        previews: [{
          key: 'agent:main:session-preview',
          status: 'ok',
          items: [{
            role: 'assistant',
            text: JSON.stringify({
              status: 'success',
              summary: 'preview-ok',
              artifacts: [{
                kind: 'note',
                content: 'opened',
                metadata: {
                  sourceSystem: 'chrome',
                  entityId: '1',
                  verification: 'read',
                  observedFields: ['url'],
                },
              }],
            }),
          }],
        }],
      };
      queueMicrotask(() => socket!.open());
      return socket;
    });

    try {
      const executor = new OpenClawGatewayExecutor(
        {
          id: 'gw-main', label: 'GW', type: 'openclaw-gateway',
          baseUrl: 'http://127.0.0.1:18789', apiKey: 'token', enabled: true,
        },
        { WebSocketImpl: FakeWS as any },
      );
      const result = await executor.submit({
        task: 'open baidu', mode: 'read', threadId: 't1', actionId: 'a-preview',
        sessionKey: 'session-preview', timeoutMs: 5000,
      });
      expect(result.status).toBe('succeeded');
      expect(result.summary).toBe('preview-ok');
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps the gateway socket open until chat.history finishes', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-exec-'));
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      (socket as any).waitSnapshot = true;
      (socket as any).slowHistoryMs = 80;
      queueMicrotask(() => socket!.open());
      return socket;
    });

    try {
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
        task: 'x',
        mode: 'read',
        threadId: 't1',
        actionId: 'a-slow-history',
        sessionKey: 'session-slow',
        timeoutMs: 5000,
      });

      expect(result.status).toBe('succeeded');
      expect(result.summary).toBe('done via history');
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reconciles to running instead of failed when wait drops but session is active', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-exec-'));
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      (socket as any).failWait = true;
      (socket as any).sessionPayload = { status: 'running', runId: 'run-123' };
      queueMicrotask(() => socket!.open());
      return socket;
    });

    try {
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
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('sends a system-owned receipt contract and recovers markdown Jira receipts', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-gw-exec-'));
    const previousDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    let socket: FakeSocket | null = null;
    const FakeWS = vi.fn().mockImplementation(() => {
      socket = new FakeSocket();
      (socket as any).waitSnapshot = true;
      (socket as any).historyMessages = [
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `已按 Asia/Shanghai 当前季度 2026-Q3 检查并同步 Committed：

共更新 4 个：

- JIRA: NOVA-17023
- JIRA: NOVA-17011

全部已通过 Jira REST API 更新为 customfield_31650 = {"value":"Yes"}，更新后 JQL 复查结果为 0 个待更新。`,
            },
          ],
        },
      ];
      queueMicrotask(() => socket!.open());
      return socket;
    });

    try {
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
        task: '帮我做: Nova Committed 的 INIT 同步 Epic Commit=Yes',
        mode: 'write',
        targetSystem: 'agent_task',
        threadId: 't1',
        actionId: 'a-nova',
        sessionKey: 'session-nova',
        timeoutMs: 5000,
      });

      const agentFrame = JSON.parse(
        socket!.sent.find((raw) => {
          try {
            return JSON.parse(raw).method === 'agent';
          } catch {
            return false;
          }
        })!,
      ) as {
        params: { extraSystemPrompt?: string; message?: string };
      };
      expect(agentFrame.params.extraSystemPrompt).toContain(
        '用户的 Task 只描述要做什么',
      );
      expect(agentFrame.params.message).toContain(
        '回报格式由系统规定，不在 Task 里',
      );
      expect(agentFrame.params.message).toContain('Nova Committed');
      expect(result.status).toBe('succeeded');
      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts[0]?.metadata?.entityKey).toBe('NOVA-17023');
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
