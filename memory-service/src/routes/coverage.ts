import type { FastifyInstance } from 'fastify';

import {
  MEMORY_COVERAGE_STALE_AFTER_DAYS,
  MemoryCoverageService,
} from '../core/MemoryCoverageService.js';

function sumBy<T>(items: T[], select: (item: T) => number | null | undefined): number {
  return items.reduce((total, item) => total + Number(select(item) ?? 0), 0);
}

function latestAtBy<T>(
  items: T[],
  select: (item: T) => number | null | undefined,
): number | null {
  const timestamps = items
    .map(select)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

export async function coverageRoutes(app: FastifyInstance): Promise<void> {
  app.get('/coverage/map', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    return reply.status(200).send(service.buildMap());
  });

  app.get('/coverage/messages-by-source', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    const items = service.getMessagesBySource();
    return reply.status(200).send(
      service.buildSliceResponse({
        slice: 'messages-by-source',
        source: "messages_raw GROUP BY source_type",
        summary: {
          itemCount: items.length,
          totalCount: sumBy(items, (item) => item.count),
          recentCount: sumBy(items, (item) => item.recentCount),
          latestAt: latestAtBy(items, (item) => item.latestAt),
          windowLabel: `全量 source_type 聚合 + 近 ${MEMORY_COVERAGE_STALE_AFTER_DAYS} 天新鲜度`,
          emptyState:
            items.length > 0
              ? '已读取 source_type 聚合；空 source_type 会归为 unknown。'
              : '没有读到 messages_raw source_type 行；这不代表连接器已经重扫或修复。',
        },
        note:
          '按 source_type 聚合消息覆盖和近 7 天新鲜度；不读取消息正文、不补写 missing source，也不触发召回。',
        payload: {
          items,
        },
      }),
    );
  });

  app.get('/coverage/provider-jobs/recent', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    const items = service.getProviderJobsRecent();
    return reply.status(200).send(
      service.buildSliceResponse({
        slice: 'provider-jobs-recent',
        source: 'provider_sync_jobs from the last 30 days',
        summary: {
          itemCount: items.length,
          totalCount: sumBy(items, (item) => item.total),
          failureCount: sumBy(items, (item) => item.failed),
          latestAt: latestAtBy(items, (item) => item.latestAt),
          windowLabel: '最近 30 天 provider_sync_jobs 聚合',
          emptyState:
            items.length > 0
              ? '已按 provider/scenario 汇总最近任务；latestStatus 只描述该组合的最新一条任务。'
              : '最近 30 天没有 provider_sync_jobs；这不等于 provider 已启用或同步成功。',
        },
        note:
          '展示 provider job 最近状态、失败数和最新错误；不重跑 provider sync、不清空错误，也不修改同步设置。',
        payload: {
          items,
        },
      }),
    );
  });

  app.get('/coverage/pressure', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    const payload = service.getPressure();
    return reply.status(200).send(
      service.buildSliceResponse({
        slice: 'pressure',
        source:
          'notification_records + proposed_actions + confirm_requests + reflection_threads',
        summary: {
          itemCount: 5,
          totalCount: payload.totalPressureItems,
          windowLabel: '当前未完成压力队列快照',
          emptyState:
            payload.totalPressureItems > 0
              ? '已读取当前待处理压力；这些数字不是执行结果，也不会自动清队列。'
              : '当前没有待处理压力项；这不代表历史通知、动作或反思已经被重新审计。',
        },
        note:
          '只统计待通知、动作队列、待确认决策和 active 反思压力；不发送通知、不执行动作、不确认决策，也不关闭反思线程。',
        payload,
      }),
    );
  });

  app.get('/coverage/skills-sync', async (request, reply) => {
    const service = new MemoryCoverageService(request.userContext.db);
    const items = service.getSkillSync();
    return reply.status(200).send(
      service.buildSliceResponse({
        slice: 'skills-sync',
        source: 'skill_platform_sync_settings + skill_platform_bindings',
        summary: {
          itemCount: items.length,
          totalCount: sumBy(items, (item) =>
            Object.values(item.bindingsByState).reduce(
              (total, count) => total + Number(count ?? 0),
              0,
            ),
          ),
          enabledCount: items.filter((item) => item.enabled).length,
          failureCount: items.filter((item) => Boolean(item.lastError)).length,
          latestAt: latestAtBy(items, (item) => item.lastProbeAt),
          windowLabel: '当前技能同步设置 + 最近探测状态',
          emptyState:
            items.length > 0
              ? '已读取技能平台设置和绑定计数；未启用平台仍只是规划项。'
              : '没有读到 skill_platform_sync_settings；不会自动创建平台设置或拉取技能。',
        },
        note:
          '展示技能平台同步设置、探测状态和绑定状态计数；不启用平台、不拉取外部技能，也不写入 active skill truth。',
        payload: {
          items,
        },
      }),
    );
  });
}
