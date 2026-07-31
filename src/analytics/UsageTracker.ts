/**
 * 前端用量打点缓冲（Chrome 扩展）
 *
 * 仿 `src/utils/logger.ts` 用 `chrome.storage.local` 做环形缓冲：
 * 每次 LLM 调用把真实 token 用量追加到缓冲区，由 background 的
 * `chrome.alarms` 定时刷新 + 缓冲达阈值即刷，最终上报到 memory-service 的
 * `POST /api/v1/usage/telemetry`。
 *
 * 事件形状（跨仓库契约，与后端 usage_events 对齐）：
 *   { ts, side:'frontend', capability, feature, model, promptTokens,
 *     completionTokens, status, errorKind?, tokensEstimated? }
 */

import {
  normalizeCapability,
  type CapabilityKey,
} from './capabilities';

export type UsageStatus = 'ok' | 'error';

/**
 * 单条用量事件。
 */
export interface UsageEvent {
  /** 事件时间戳（epoch ms）。 */
  ts: number;
  /** 前端固定为 'frontend'。 */
  side: 'frontend';
  /** 所属能力（归一化后的合法键）。 */
  capability: CapabilityKey;
  /** 细粒度调用标签（自由字符串，如 'message_analysis'）。 */
  feature: string;
  /** 使用的模型名。 */
  model: string;
  /** 输入 token。 */
  promptTokens: number;
  /** 输出 token。 */
  completionTokens: number;
  /** 调用结果：成功或失败。 */
  status: UsageStatus;
  /** 失败原因分类（http_401 / timeout / network / ...）。 */
  errorKind?: string;
  /** token 是否为长度估算（网关未返回 usage）。 */
  tokensEstimated?: boolean;
}

/**
 * `record()` 入参：省略由 tracker 自动填充的 `ts` / `side`，
 * `capability` 允许传任意值（内部归一化）。
 */
export interface UsageRecordInput {
  capability?: unknown;
  feature?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  status?: UsageStatus;
  errorKind?: string;
  tokensEstimated?: boolean;
}

export interface UsageFlushDiagnostics {
  lastFlushAt: number | null;
  lastFlushError: string | null;
  lastFlushIngested: number;
  bufferSize: number;
}

const STORAGE_KEY = 'personal_ai_usage_events';
const DIAG_STORAGE_KEY = 'personal_ai_usage_flush_diag';

/** 环形缓冲上限：超出后丢弃最旧事件，避免无限增长。 */
const MAX_BUFFER = 500;

/** 缓冲达到该阈值即触发一次即时刷新（不必等定时器）。 */
const FLUSH_THRESHOLD = 50;

/** 单次上报批次大小。 */
const FLUSH_BATCH_SIZE = 100;

/** 单飞：避免多次并发 flush 造成重复上报。 */
let flushInFlight: Promise<void> | null = null;

function toNonNegInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * 前端用量打点缓冲器（全静态，仿 Logger 风格）。
 */
export class UsageTracker {
  /**
   * 记录一条用量事件（副作用，绝不向调用方抛错）。
   * 达阈值时 fire-and-forget 触发一次刷新。
   */
  static async record(input: UsageRecordInput): Promise<void> {
    try {
      const status: UsageStatus = input.status === 'error' ? 'error' : 'ok';
      const event: UsageEvent = {
        ts: Date.now(),
        side: 'frontend',
        capability: normalizeCapability(input.capability),
        feature: String(input.feature || 'unknown'),
        model: String(input.model || ''),
        promptTokens: toNonNegInt(input.promptTokens),
        completionTokens: toNonNegInt(input.completionTokens),
        status,
      };
      if (status === 'error' && input.errorKind) {
        event.errorKind = String(input.errorKind);
      }
      if (input.tokensEstimated) {
        event.tokensEstimated = true;
      }

      const events = await UsageTracker.getEvents();
      events.push(event);

      // 环形缓冲：仅保留最新的 MAX_BUFFER 条
      if (events.length > MAX_BUFFER) {
        events.splice(0, events.length - MAX_BUFFER);
      }

      await UsageTracker.saveEvents(events);

      if (events.length >= FLUSH_THRESHOLD) {
        void UsageTracker.flush();
      }
    } catch (e) {
      console.warn('[UsageTracker] 记录用量失败:', e);
    }
  }

  /**
   * 读取缓冲区所有事件。
   */
  static async getEvents(): Promise<UsageEvent[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const events = result[STORAGE_KEY];
      return Array.isArray(events) ? events : [];
    } catch {
      return [];
    }
  }

  /**
   * 当前缓冲事件数量。
   */
  static async size(): Promise<number> {
    return (await UsageTracker.getEvents()).length;
  }

  /**
   * 清空缓冲区。
   */
  static async clear(): Promise<void> {
    try {
      await chrome.storage.local.remove(STORAGE_KEY);
    } catch (e) {
      console.warn('[UsageTracker] 清空用量缓冲失败:', e);
    }
  }

  /**
   * 读取上次 flush 诊断信息。
   */
  static async getFlushDiagnostics(): Promise<UsageFlushDiagnostics> {
    const bufferSize = await UsageTracker.size();
    try {
      const result = await chrome.storage.local.get(DIAG_STORAGE_KEY);
      const diag = result[DIAG_STORAGE_KEY] as
        | Partial<UsageFlushDiagnostics>
        | undefined;
      return {
        lastFlushAt:
          typeof diag?.lastFlushAt === 'number' ? diag.lastFlushAt : null,
        lastFlushError:
          typeof diag?.lastFlushError === 'string' ? diag.lastFlushError : null,
        lastFlushIngested:
          typeof diag?.lastFlushIngested === 'number'
            ? diag.lastFlushIngested
            : 0,
        bufferSize,
      };
    } catch {
      return {
        lastFlushAt: null,
        lastFlushError: null,
        lastFlushIngested: 0,
        bufferSize,
      };
    }
  }

  /**
   * 刷新：读取缓冲事件、分批上报到 memory-service、成功后清除已上报部分。
   *
   * - 单飞保护，避免并发重复上报。
   * - 上报成功后只移除本次读取到的前 N 条，保留刷新期间新追加的事件。
   * - 任何失败都保留缓冲，等待下次定时/阈值重试。
   */
  static async flush(): Promise<void> {
    if (flushInFlight) {
      return flushInFlight;
    }

    flushInFlight = (async () => {
      try {
        const events = await UsageTracker.getEvents();
        if (events.length === 0) {
          await UsageTracker.saveFlushDiagnostics({
            lastFlushAt: Date.now(),
            lastFlushError: null,
            lastFlushIngested: 0,
          });
          return;
        }

        // 延迟引入，规避与 MemoryServiceClient 的加载期耦合/循环依赖
        const { getMemoryServiceClient } = await import(
          '../services/MemoryServiceClient'
        );
        const client = getMemoryServiceClient();
        let ingested = 0;
        for (let i = 0; i < events.length; i += FLUSH_BATCH_SIZE) {
          const batch = events.slice(i, i + FLUSH_BATCH_SIZE);
          await client.postUsageTelemetry(batch);
          ingested += batch.length;
        }

        // 仅移除已成功上报的前 N 条，保留刷新期间新写入的事件
        const current = await UsageTracker.getEvents();
        const remaining = current.slice(events.length);
        await UsageTracker.saveEvents(remaining);
        await UsageTracker.saveFlushDiagnostics({
          lastFlushAt: Date.now(),
          lastFlushError: null,
          lastFlushIngested: ingested,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn('[UsageTracker] 上报用量失败（保留缓冲待重试）:', e);
        await UsageTracker.saveFlushDiagnostics({
          lastFlushAt: Date.now(),
          lastFlushError: message,
          lastFlushIngested: 0,
        });
      } finally {
        flushInFlight = null;
      }
    })();

    return flushInFlight;
  }

  private static async saveEvents(events: UsageEvent[]): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: events });
    } catch (e) {
      console.warn('[UsageTracker] 保存用量缓冲失败:', e);
    }
  }

  private static async saveFlushDiagnostics(
    diag: Omit<UsageFlushDiagnostics, 'bufferSize'>,
  ): Promise<void> {
    try {
      await chrome.storage.local.set({ [DIAG_STORAGE_KEY]: diag });
    } catch (e) {
      console.warn('[UsageTracker] 保存 flush 诊断失败:', e);
    }
  }
}
