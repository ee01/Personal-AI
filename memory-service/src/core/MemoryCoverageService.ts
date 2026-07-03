import type BetterSqlite3 from 'better-sqlite3';

import { daysAgo, now } from '../utils/time.js';

export type MemoryCoverageDirection = 'ingest' | 'push' | 'sync' | 'derive';
export type MemoryCoverageState =
  | 'healthy'
  | 'partial'
  | 'stale'
  | 'sparse'
  | 'failing'
  | 'blocked'
  | 'pressure'
  | 'not_configured'
  | 'unknown';

export type MemoryCoveragePlatformGroup =
  | 'active'
  | 'derived'
  | 'inactive'
  | 'system';

export interface MemoryCoverageContribution {
  id: string;
  label: string;
  direction: MemoryCoverageDirection;
  state: MemoryCoverageState;
  count: number;
  recentCount?: number;
  latestAt?: number | null;
  detail: string;
  evidence: string;
}

export interface MemoryCoverageRepairAction {
  id: string;
  platformId: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  source: string;
}

export interface MemoryCoverageScoreBreakdown {
  base: number;
  healthyContributionBonus: number;
  freshnessBonus: number;
  failingPenalty: number;
  recentRatio: number;
  finalScore: number;
  reasons: string[];
}

export interface MemoryCoveragePlatform {
  id: string;
  name: string;
  nameEn?: string;
  icon: string;
  group: MemoryCoveragePlatformGroup;
  state: MemoryCoverageState;
  directions: MemoryCoverageDirection[];
  headline: string;
  description: string;
  lastSeenAt?: number | null;
  totalCount: number;
  recentCount: number;
  qualityScore: number;
  qualityScoreBreakdown: MemoryCoverageScoreBreakdown;
  contributions: MemoryCoverageContribution[];
  repairActions: MemoryCoverageRepairAction[];
}

export interface MemoryCoverageSummary {
  activePlatforms: number;
  healthyPlatforms: number;
  warningPlatforms: number;
  pressureItems: number;
  inactivePlatforms: number;
  coverageGaps: number;
  totalMessages: number;
  totalChunks: number;
  totalEntities: number;
}

export interface MemoryCoveragePriorityFocus {
  platformId: string;
  platformName: string;
  state: MemoryCoverageState;
  qualityScore: number;
  contributionId: string;
  contributionLabel: string;
  contributionState: MemoryCoverageState;
  actionId?: string;
  actionTitle?: string;
  actionSeverity?: MemoryCoverageRepairAction['severity'];
  reason: string;
  source: string;
  selectionBasis: string;
  comparedPlatformCount: number;
  ignoredInfoActionCount: number;
  boundary: string;
}

export interface MemoryCoverageTimelineEvent {
  id: string;
  platformId: string;
  at: number;
  title: string;
  state: MemoryCoverageState;
  source: string;
}

export interface MemoryCoverageMapReceipt {
  generatedAt: number;
  staleAfterDays: number;
  source: string;
  summary: MemoryCoverageMapReceiptSummary;
  boundary: string;
  note: string;
}

export interface MemoryCoverageMapReceiptSummary {
  platformCount: number;
  activeDerivedPlatformCount: number;
  healthyPlatformCount: number;
  warningPlatformCount: number;
  repairActionCount: number;
  coverageGapCount: number;
  infoPlanningActionCount: number;
  pressureItemCount: number;
  totalMessages: number;
  totalChunks: number;
  totalEntities: number;
  timelineEventCount: number;
  latestAt?: number | null;
  windowLabel: string;
  emptyState: string;
}

export interface MemoryCoverageMapResponse {
  generatedAt: number;
  staleAfterDays: number;
  receipt: MemoryCoverageMapReceipt;
  summary: MemoryCoverageSummary;
  platforms: MemoryCoveragePlatform[];
  repairActions: MemoryCoverageRepairAction[];
  priorityFocus: MemoryCoveragePriorityFocus | null;
  timeline: MemoryCoverageTimelineEvent[];
}

export interface MessageSourceCoverageRow {
  sourceType: string;
  count: number;
  latestAt: number | null;
  recentCount: number;
}

export interface ProviderJobCoverageRow {
  provider: string;
  scenario: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  latestAt: number | null;
  latestStatus: string | null;
  latestError: string | null;
}

export interface PressureCoverageResponse {
  notificationsPending: number;
  actionsQueued: number;
  actionsRunning: number;
  confirmRequestsPending: number;
  reflectionThreadsActive: number;
  totalPressureItems: number;
}

export interface SkillSyncCoverageRow {
  platform: string;
  enabled: boolean;
  capability: string;
  mode: string;
  lastProbeAt: number | null;
  lastProbeAgeDays: number | null;
  lastError: string | null;
  bindingsByState: Record<string, number>;
}

export type MemoryCoverageSliceName =
  | 'messages-by-source'
  | 'provider-jobs-recent'
  | 'pressure'
  | 'skills-sync';

export interface MemoryCoverageSliceReceipt {
  slice: MemoryCoverageSliceName;
  generatedAt: number;
  staleAfterDays: number;
  source: string;
  summary: MemoryCoverageSliceReceiptSummary;
  boundary: string;
  note: string;
}

export interface MemoryCoverageSliceReceiptSummary {
  itemCount: number;
  totalCount?: number;
  recentCount?: number;
  failureCount?: number;
  enabledCount?: number;
  latestAt?: number | null;
  windowLabel: string;
  emptyState: string;
}

export type MemoryCoverageSliceResponse<T extends object> = T & {
  generatedAt: number;
  staleAfterDays: number;
  receipt: MemoryCoverageSliceReceipt;
};

interface CountRow {
  count: number | null;
}

interface MessageSourceRow {
  source_type: string | null;
  count: number | null;
  latest_at: number | null;
  recent_count: number | null;
}

interface TableColumnRow {
  name: string;
}

interface SkillSyncSettingRow {
  platform: string;
  enabled: number;
  capability: string;
  mode: string;
  last_probe_at: number | null;
  last_error: string | null;
}

interface SkillBindingStateRow {
  platform: string;
  state: string;
  count: number;
}

interface ProviderJobAggregateRow {
  provider: string;
  scenario: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  latest_at: number | null;
}

interface ProviderJobLatestRow {
  provider: string;
  scenario: string;
  status: string | null;
  error_message: string | null;
  created_at: number | null;
}

interface ExternalAiImportBatchRow {
  source_name: string | null;
  source_count: number | null;
  summary_json: string | null;
  committed_at: number | null;
}

interface ExternalAiImportCoverageStats {
  batches: number;
  conversations: number;
  importedMessages: number;
  totalMessages: number;
  skippedParts: number;
  ignoredFiles: number;
  latestSourcePath: string | null;
  latestCommittedAt: number | null;
}

export const MEMORY_COVERAGE_STALE_AFTER_DAYS = 7;
const STALE_AFTER_DAYS = MEMORY_COVERAGE_STALE_AFTER_DAYS;

const INACTIVE_SKILL_PLATFORMS = [
  {
    id: 'codex',
    name: 'Codex',
    nameEn: 'Codex',
    icon: '⌘',
    capability: 'fs_via_desktop_app',
  },
  {
    id: 'claude_code',
    name: 'Claude Code',
    nameEn: 'Claude Code',
    icon: 'C',
    capability: 'fs_via_desktop_app',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    nameEn: 'Cursor',
    icon: '⌁',
    capability: 'fs_via_desktop_app',
  },
  {
    id: 'chatgpt_gpts',
    name: 'ChatGPT GPTs',
    nameEn: 'ChatGPT GPTs',
    icon: 'G',
    capability: 'manual_only',
  },
  {
    id: 'claude_skills_web',
    name: 'Claude Skills Web',
    nameEn: 'Claude Skills Web',
    icon: 'S',
    capability: 'manual_only',
  },
];

function asCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function maxTimestamp(values: Array<number | null | undefined>): number | null {
  const valid = values.filter(
    (value): value is number => typeof value === 'number' && value > 0,
  );
  return valid.length > 0 ? Math.max(...valid) : null;
}

function formatCount(count: number): string {
  return new Intl.NumberFormat('en-US').format(count);
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function readSummaryNumber(
  summary: Record<string, unknown>,
  key: string,
): number | null {
  const value = summary[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readSummaryString(
  summary: Record<string, unknown>,
  key: string,
): string | null {
  const value = summary[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function recentAfter(): number {
  return daysAgo(STALE_AFTER_DAYS);
}

function stateForCount(
  count: number,
  latestAt: number | null | undefined,
  options: { sparseBelow?: number; unknownWhenEmpty?: boolean } = {},
): MemoryCoverageState {
  if (count <= 0) {
    return options.unknownWhenEmpty ? 'unknown' : 'not_configured';
  }
  if (count < (options.sparseBelow ?? 3)) {
    return 'sparse';
  }
  if (latestAt && latestAt < recentAfter()) {
    return 'stale';
  }
  return 'healthy';
}

function combineStates(
  states: MemoryCoverageState[],
  emptyState: MemoryCoverageState = 'unknown',
): MemoryCoverageState {
  if (states.length === 0) return emptyState;
  if (states.includes('pressure')) return 'pressure';
  if (states.includes('failing')) return 'failing';
  if (states.every((state) => state === 'healthy')) return 'healthy';
  if (states.includes('healthy')) return 'partial';
  if (states.includes('stale')) return 'stale';
  if (states.includes('sparse')) return 'sparse';
  if (states.includes('blocked')) return 'blocked';
  if (states.includes('unknown')) return 'unknown';
  return states[0] ?? emptyState;
}

function qualityScoreForPlatform(
  state: MemoryCoverageState,
  contributions: MemoryCoverageContribution[],
  totalCount: number,
  recentCount: number,
): MemoryCoverageScoreBreakdown {
  const baseByState: Record<MemoryCoverageState, number> = {
    healthy: 84,
    partial: 64,
    stale: 42,
    sparse: 52,
    failing: 24,
    blocked: 12,
    pressure: 48,
    not_configured: 0,
    unknown: 32,
  };
  const stateReason: Record<MemoryCoverageState, string> = {
    healthy: '状态基准 healthy：覆盖健康且近期有信号',
    partial: '状态基准 partial：部分来源健康，但仍有缺口',
    stale: '状态基准 stale：有历史数据，但近期没有新信号',
    sparse: '状态基准 sparse：信号数量偏少',
    failing: '状态基准 failing：最近同步或读取失败',
    blocked: '状态基准 blocked：通道关闭或缺少绑定',
    pressure: '状态基准 pressure：待处理事项积压偏高',
    not_configured: '状态基准 not_configured：尚未配置',
    unknown: '状态基准 unknown：目前还读不到足够信号',
  };
  const healthyContributions = contributions.filter(
    (item) => item.state === 'healthy',
  ).length;
  const contributionBonus = Math.min(
    8,
    healthyContributions * 2,
  );
  const recentRatio =
    totalCount > 0 ? Math.min(1, Math.max(0, recentCount / totalCount)) : 0;
  const freshnessBonus = Math.round(recentRatio * 8);
  const failingPenalty = contributions.some((item) => item.state === 'failing')
    ? 10
    : 0;
  const finalScore = Math.max(
    0,
    Math.min(
      100,
      baseByState[state] + contributionBonus + freshnessBonus - failingPenalty,
    ),
  );
  const reasons = [
    `${stateReason[state]}：${baseByState[state]} 分`,
    healthyContributions > 0
      ? `${healthyContributions} 个健康贡献项：+${contributionBonus} 分`
      : '没有健康贡献项加分',
    totalCount > 0
      ? `近 ${STALE_AFTER_DAYS} 天信号占比 ${Math.round(recentRatio * 100)}%：+${freshnessBonus} 分`
      : '没有可计数信号，新鲜度不加分',
  ];
  if (failingPenalty > 0) {
    reasons.push(`存在失败贡献项：-${failingPenalty} 分`);
  }

  return {
    base: baseByState[state],
    healthyContributionBonus: contributionBonus,
    freshnessBonus,
    failingPenalty,
    recentRatio,
    finalScore,
    reasons,
  };
}

const SCORE_REPAIR_STATE_PRIORITY: Record<MemoryCoverageState, number> = {
  failing: 0,
  pressure: 1,
  blocked: 2,
  not_configured: 3,
  stale: 4,
  sparse: 5,
  unknown: 6,
  partial: 7,
  healthy: 99,
};

const PRIORITY_REPAIR_SEVERITY_RANK: Record<
  MemoryCoverageRepairAction['severity'] | 'none',
  number
> = {
  critical: 0,
  warning: 1,
  none: 2,
  info: 3,
};

function pickScoreRepairContribution(
  contributions: MemoryCoverageContribution[],
): MemoryCoverageContribution | null {
  return (
    [...contributions]
      .filter((item) => item.state !== 'healthy')
      .sort(
        (left, right) =>
          SCORE_REPAIR_STATE_PRIORITY[left.state] -
            SCORE_REPAIR_STATE_PRIORITY[right.state] ||
          (right.count ?? 0) - (left.count ?? 0),
      )[0] ?? null
  );
}

function severityForScoreRepair(
  state: MemoryCoverageState,
): MemoryCoverageRepairAction['severity'] {
  return state === 'failing' || state === 'pressure' ? 'critical' : 'warning';
}

function descriptionForScoreRepair(
  platformName: string,
  contribution: MemoryCoverageContribution,
  finalScore: number,
): string {
  const scorePrefix = `${platformName} 质量分 ${finalScore}/100，主要短板是「${contribution.label}」。`;
  switch (contribution.state) {
    case 'failing':
      return `${scorePrefix} 最近同步或读取失败，先检查该来源的错误和最近一次任务状态。`;
    case 'pressure':
      return `${scorePrefix} 积压偏高，先处理待通知、动作、反思或决策队列。`;
    case 'blocked':
    case 'not_configured':
      return `${scorePrefix} 通道未启用或缺少绑定，先确认是否需要开启该来源。`;
    case 'stale':
      return `${scorePrefix} 有历史信号但近 ${STALE_AFTER_DAYS} 天没有新数据，先确认采集或同步是否仍在运行。`;
    case 'sparse':
      return `${scorePrefix} 当前只有 ${formatCount(contribution.count)} 条信号，先补齐样本或确认是否只是低频来源。`;
    case 'unknown':
      return `${scorePrefix} Coverage Map 读不到足够信号，先确认数据表、source_type 或同步回执是否存在。`;
    case 'partial':
    default:
      return `${scorePrefix} 先打开贡献项明细，确认这个来源是否缺新数据、缺配置或缺回执。`;
  }
}

function scoreRepairActionForPlatform(input: {
  id: string;
  name: string;
  group: MemoryCoveragePlatformGroup;
  contributions: MemoryCoverageContribution[];
  repairActions: MemoryCoverageRepairAction[];
  qualityScoreBreakdown: MemoryCoverageScoreBreakdown;
}): MemoryCoverageRepairAction | null {
  if (input.group !== 'active' && input.group !== 'derived') return null;
  if (input.qualityScoreBreakdown.finalScore >= 80) return null;
  if (input.repairActions.some((action) => action.severity !== 'info')) {
    return null;
  }

  const contribution = pickScoreRepairContribution(input.contributions);
  if (!contribution) return null;

  return {
    id: `${input.id}:quality-score:${contribution.id}`,
    platformId: input.id,
    title: `处理 ${input.name} 覆盖质量短板`,
    description: descriptionForScoreRepair(
      input.name,
      contribution,
      input.qualityScoreBreakdown.finalScore,
    ),
    severity: severityForScoreRepair(contribution.state),
    source: contribution.evidence,
  };
}

function primaryNonInfoRepairAction(
  actions: MemoryCoverageRepairAction[],
): MemoryCoverageRepairAction | undefined {
  return [...actions]
    .filter((action) => action.severity !== 'info')
    .sort(
      (left, right) =>
        PRIORITY_REPAIR_SEVERITY_RANK[left.severity] -
        PRIORITY_REPAIR_SEVERITY_RANK[right.severity],
    )[0];
}

function priorityReasonForContribution(
  contribution: MemoryCoverageContribution,
  staleAfterDays: number,
): string {
  switch (contribution.state) {
    case 'failing':
      return '先检查最近一次同步或读取错误，再重跑该来源的采集链路。';
    case 'pressure':
      return '先处理积压队列，否则覆盖很多也会难以转成可执行下一步。';
    case 'blocked':
    case 'not_configured':
      return '先确认是否要启用这个通道；未启用时分数只能保持低位。';
    case 'stale':
      return `先确认这个来源近 ${staleAfterDays} 天是否应该继续产生新信号。`;
    case 'sparse':
      return '先补齐样本或确认这是低频来源，避免把少量历史信号误判成健康覆盖。';
    case 'unknown':
      return '先确认数据表、source_type 或同步回执是否存在。';
    case 'partial':
    default:
      return '先打开贡献项明细，确认缺口来自新鲜度、配置还是回执。';
  }
}

function priorityFocusForPlatforms(
  platforms: MemoryCoveragePlatform[],
): MemoryCoveragePriorityFocus | null {
  const eligiblePlatforms = platforms.filter(
    (platform) => platform.group === 'active' || platform.group === 'derived',
  );
  const ignoredInfoActionCount = platforms
    .flatMap((platform) => platform.repairActions)
    .filter((action) => action.severity === 'info').length;
  const selectionBasis =
    '先比较 active / derived 平台里的 critical / warning 修复项，再按质量分、状态严重度和平台名排序；info 规划项只进入修复队列，不参与当前故障焦点。';
  const boundary =
    '这是只读诊断路线；查看平台不会重跑同步、改配置、写入记忆、标记已读或外发。';
  const candidates = eligiblePlatforms
    .map((platform) => {
      const repairAction = primaryNonInfoRepairAction(platform.repairActions);
      const contribution = pickScoreRepairContribution(platform.contributions);
      return { platform, repairAction, contribution };
    })
    .filter(
      (item) =>
        item.repairAction ||
        item.platform.qualityScore < 80 ||
        item.platform.state !== 'healthy',
    )
    .sort((left, right) => {
      const leftSeverity = left.repairAction?.severity ?? 'none';
      const rightSeverity = right.repairAction?.severity ?? 'none';
      return (
        PRIORITY_REPAIR_SEVERITY_RANK[leftSeverity] -
          PRIORITY_REPAIR_SEVERITY_RANK[rightSeverity] ||
        left.platform.qualityScore - right.platform.qualityScore ||
        SCORE_REPAIR_STATE_PRIORITY[left.platform.state] -
          SCORE_REPAIR_STATE_PRIORITY[right.platform.state] ||
        left.platform.name.localeCompare(right.platform.name, 'zh-CN')
      );
    });

  const selected = candidates[0];
  if (!selected) return null;
  const contribution =
    selected.contribution ?? selected.platform.contributions[0] ?? null;
  if (!contribution) return null;

  return {
    platformId: selected.platform.id,
    platformName: selected.platform.name,
    state: selected.platform.state,
    qualityScore: selected.platform.qualityScore,
    contributionId: contribution.id,
    contributionLabel: contribution.label,
    contributionState: contribution.state,
    actionId: selected.repairAction?.id,
    actionTitle: selected.repairAction?.title,
    actionSeverity: selected.repairAction?.severity,
    reason: priorityReasonForContribution(contribution, STALE_AFTER_DAYS),
    source: selected.repairAction?.source ?? contribution.evidence,
    selectionBasis,
    comparedPlatformCount: candidates.length,
    ignoredInfoActionCount,
    boundary,
  };
}

function repairActionForInactiveSkillPlatform(input: {
  id: string;
  name: string;
  setting: SkillSyncCoverageRow | undefined;
  enabled: boolean;
}): MemoryCoverageRepairAction {
  const hasError = input.enabled && Boolean(input.setting?.lastError);
  return {
    id: `${input.id}:enable`,
    platformId: input.id,
    title: hasError
      ? `检查 ${input.name} 技能同步探测`
      : `按需启用 ${input.name} 技能同步`,
    description: hasError
      ? `${input.name} 已启用但最近探测失败：${input.setting?.lastError}`
      : input.enabled
        ? `${input.name} 技能同步已启用；当前只是 P1+ 可选覆盖通道，不作为主覆盖缺口。`
        : `${input.name} 是 P1+ 可选覆盖通道；未显式启用时只作为规划项，不算当前覆盖故障。`,
    severity: hasError ? 'warning' : 'info',
    source: `skill_platform_sync_settings.platform='${input.id}'`,
  };
}

export class MemoryCoverageService {
  constructor(private readonly db: BetterSqlite3.Database) {}

  buildSliceResponse<T extends object>(input: {
    slice: MemoryCoverageSliceName;
    source: string;
    summary: MemoryCoverageSliceReceiptSummary;
    note: string;
    payload: T;
  }): MemoryCoverageSliceResponse<T> {
    const generatedAt = now();
    const receipt: MemoryCoverageSliceReceipt = {
      slice: input.slice,
      generatedAt,
      staleAfterDays: STALE_AFTER_DAYS,
      source: input.source,
      summary: input.summary,
      boundary:
        '只读覆盖诊断切片；不会写入记忆、重跑同步、修复配置、标记已读或外发到任何平台。',
      note: input.note,
    };
    return {
      ...input.payload,
      generatedAt,
      staleAfterDays: STALE_AFTER_DAYS,
      receipt,
    };
  }

  buildMap(): MemoryCoverageMapResponse {
    const generatedAt = now();
    const messagesBySource = this.getMessagesBySource();
    const providerJobs = this.getProviderJobsRecent();
    const pressure = this.getPressure();
    const skillSync = this.getSkillSync();

    const messageSource = new Map(
      messagesBySource.map((row) => [row.sourceType, row]),
    );
    const skillSyncByPlatform = new Map(
      skillSync.map((row) => [row.platform, row]),
    );

    const platforms: MemoryCoveragePlatform[] = [
      this.buildRingCentralPlatform(messageSource),
      this.buildJiraPlatform(messageSource),
      this.buildOpenClawPlatform(skillSyncByPlatform),
      this.buildDoubaoPlatform(messageSource, providerJobs),
      this.buildWebPlatform(messageSource),
      this.buildCorePlatform(pressure),
      ...this.buildInactiveSkillPlatforms(skillSyncByPlatform),
      this.buildAppleRemindersPlatform(),
      this.buildAppleNotesPlatform(),
      this.buildExternalAiPlatform(),
      this.buildImportBackupPlatform(),
    ];

    const repairActions = platforms.flatMap((platform) => platform.repairActions);
    const activeAndDerived = platforms.filter(
      (platform) =>
        platform.group === 'active' || platform.group === 'derived',
    );
    const warningStates: MemoryCoverageState[] = [
      'partial',
      'stale',
      'sparse',
      'failing',
      'blocked',
      'unknown',
    ];

    const summary: MemoryCoverageSummary = {
      activePlatforms: activeAndDerived.length,
      healthyPlatforms: activeAndDerived.filter(
        (platform) => platform.state === 'healthy',
      ).length,
      warningPlatforms: activeAndDerived.filter((platform) =>
        warningStates.includes(platform.state),
      ).length,
      pressureItems: pressure.totalPressureItems,
      inactivePlatforms: platforms.filter(
        (platform) => platform.group === 'inactive',
      ).length,
      coverageGaps: repairActions.filter(
        (action) => action.severity !== 'info',
      ).length,
      totalMessages: this.countTable('messages_raw'),
      totalChunks: this.countTable('chunks'),
      totalEntities: this.countTable('entities'),
    };

    const timeline = platforms
      .filter((platform) => platform.lastSeenAt)
      .map((platform) => ({
        id: `latest:${platform.id}`,
        platformId: platform.id,
        at: platform.lastSeenAt ?? generatedAt,
        title: `${platform.name} 最近一次覆盖信号`,
        state: platform.state,
        source: platform.contributions
          .filter((item) => item.latestAt === platform.lastSeenAt)
          .map((item) => item.evidence)
          .join(' + '),
      }))
      .sort((a, b) => b.at - a.at)
      .slice(0, 8);

    const infoPlanningActionCount = repairActions.filter(
      (action) => action.severity === 'info',
    ).length;
    const receipt: MemoryCoverageMapReceipt = {
      generatedAt,
      staleAfterDays: STALE_AFTER_DAYS,
      source:
        'messages_raw + chunks + entities + provider_sync_jobs + skill_platform_sync_settings + notification_records + proposed_actions + confirm_requests + reflection_threads + memory_import_batches',
      summary: {
        platformCount: platforms.length,
        activeDerivedPlatformCount: activeAndDerived.length,
        healthyPlatformCount: summary.healthyPlatforms,
        warningPlatformCount: summary.warningPlatforms,
        repairActionCount: repairActions.length,
        coverageGapCount: summary.coverageGaps,
        infoPlanningActionCount,
        pressureItemCount: summary.pressureItems,
        totalMessages: summary.totalMessages,
        totalChunks: summary.totalChunks,
        totalEntities: summary.totalEntities,
        timelineEventCount: timeline.length,
        latestAt: timeline[0]?.at ?? null,
        windowLabel: `Coverage Map 聚合快照 + 近 ${STALE_AFTER_DAYS} 天新鲜度窗口`,
        emptyState:
          summary.totalMessages + summary.totalChunks + summary.totalEntities > 0
            ? '已聚合当前 Memory Service 覆盖快照；平台健康只代表本轮可读信号。'
            : '没有读到 messages/chunks/entities；这不代表连接器已经重扫、来源已经修复或外部平台为空。',
      },
      boundary:
        '只读覆盖聚合快照；不会写入记忆、重跑 provider sync、修复配置、标记已读或外发到任何平台。',
      note:
        '主聚合用于解释当前可读覆盖、质量分和修复队列；不是外部连接器同步结果、权限/ACL 完整验证或内容事实正确性证明。',
    };

    return {
      generatedAt,
      staleAfterDays: STALE_AFTER_DAYS,
      receipt,
      summary,
      platforms,
      repairActions,
      priorityFocus: priorityFocusForPlatforms(platforms),
      timeline,
    };
  }

  getMessagesBySource(): MessageSourceCoverageRow[] {
    if (!this.tableExists('messages_raw')) return [];
    const rows = this.db
      .prepare(
        `SELECT source_type,
                COUNT(*) AS count,
                MAX(COALESCE(timestamp, created_at)) AS latest_at,
                SUM(CASE WHEN COALESCE(timestamp, created_at) >= ? THEN 1 ELSE 0 END) AS recent_count
         FROM messages_raw
         GROUP BY source_type
         ORDER BY count DESC`,
      )
      .all(recentAfter()) as MessageSourceRow[];

    return rows.map((row) => ({
      sourceType: row.source_type || 'unknown',
      count: asCount(row.count),
      latestAt: row.latest_at ?? null,
      recentCount: asCount(row.recent_count),
    }));
  }

  getProviderJobsRecent(): ProviderJobCoverageRow[] {
    if (!this.tableExists('provider_sync_jobs')) return [];
    const rows = this.db
      .prepare(
        `SELECT provider,
                scenario,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
                MAX(created_at) AS latest_at
         FROM provider_sync_jobs
         WHERE created_at >= ?
         GROUP BY provider, scenario
         ORDER BY latest_at DESC`,
      )
      .all(daysAgo(30)) as ProviderJobAggregateRow[];

    const latestRows = this.db
      .prepare(
        `SELECT provider, scenario, status, error_message, created_at
         FROM provider_sync_jobs
         WHERE id IN (
           SELECT id
           FROM provider_sync_jobs latest
           WHERE latest.provider = provider_sync_jobs.provider
             AND latest.scenario = provider_sync_jobs.scenario
           ORDER BY latest.created_at DESC
           LIMIT 1
         )`,
      )
      .all() as ProviderJobLatestRow[];
    const latestByKey = new Map(
      latestRows.map((row) => [`${row.provider}:${row.scenario}`, row]),
    );

    return rows.map((row) => {
      const latest = latestByKey.get(`${row.provider}:${row.scenario}`);
      return {
        provider: row.provider,
        scenario: row.scenario,
        total: asCount(row.total),
        succeeded: asCount(row.succeeded),
        failed: asCount(row.failed),
        skipped: asCount(row.skipped),
        latestAt: row.latest_at ?? null,
        latestStatus: latest?.status ?? null,
        latestError: latest?.error_message ?? null,
      };
    });
  }

  getPressure(): PressureCoverageResponse {
    const notificationsPending = this.countWhere(
      'notification_records',
      'sent_at IS NULL AND clicked_at IS NULL AND dismissed_at IS NULL',
    );
    const actionsQueued = this.countWhere(
      'proposed_actions',
      "COALESCE(queue_status, state) = 'queued'",
    );
    const actionsRunning = this.countWhere(
      'proposed_actions',
      "COALESCE(queue_status, state) = 'running'",
    );
    const confirmRequestsPending = this.countWhere(
      'confirm_requests',
      "state = 'pending' AND COALESCE(routing, 'decision') = 'decision'",
    );
    const reflectionThreadsActive = this.countWhere(
      'reflection_threads',
      "status = 'active'",
    );
    return {
      notificationsPending,
      actionsQueued,
      actionsRunning,
      confirmRequestsPending,
      reflectionThreadsActive,
      totalPressureItems:
        notificationsPending +
        actionsQueued +
        actionsRunning +
        confirmRequestsPending +
        reflectionThreadsActive,
    };
  }

  getSkillSync(): SkillSyncCoverageRow[] {
    if (!this.tableExists('skill_platform_sync_settings')) return [];
    const settings = this.db
      .prepare(
        `SELECT platform, enabled, capability, mode, last_probe_at, last_error
         FROM skill_platform_sync_settings
         ORDER BY platform ASC`,
      )
      .all() as SkillSyncSettingRow[];

    const bindingRows = this.tableExists('skill_platform_bindings')
      ? (this.db
          .prepare(
            `SELECT platform, state, COUNT(*) AS count
             FROM skill_platform_bindings
             GROUP BY platform, state`,
          )
          .all() as SkillBindingStateRow[])
      : [];
    const bindingsByPlatform = new Map<string, Record<string, number>>();
    for (const row of bindingRows) {
      const current = bindingsByPlatform.get(row.platform) ?? {};
      current[row.state] = row.count;
      bindingsByPlatform.set(row.platform, current);
    }

    const current = now();
    return settings.map((row) => ({
      platform: row.platform,
      enabled: row.enabled === 1,
      capability: row.capability,
      mode: row.mode,
      lastProbeAt: row.last_probe_at ?? null,
      lastProbeAgeDays: row.last_probe_at
        ? Math.max(0, Math.floor((current - row.last_probe_at) / 86400))
        : null,
      lastError: row.last_error ?? null,
      bindingsByState: bindingsByPlatform.get(row.platform) ?? {},
    }));
  }

  private buildRingCentralPlatform(
    messageSource: Map<string, MessageSourceCoverageRow>,
  ): MemoryCoveragePlatform {
    const glip = messageSource.get('glip');
    const meetingMessage = messageSource.get('meeting');
    const meetingCount = this.countDistinctMeetings();
    const calendar = this.getCalendarStats();
    const contributions: MemoryCoverageContribution[] = [
      this.messageContribution('glip', '聊天消息', 'ingest', glip, 50),
      {
        id: 'ringcentral:meeting',
        label: '会议记录',
        direction: 'ingest',
        state: stateForCount(meetingCount, meetingMessage?.latestAt, {
          sparseBelow: 3,
        }),
        count: meetingCount,
        recentCount: meetingMessage?.recentCount ?? 0,
        latestAt: meetingMessage?.latestAt ?? null,
        detail: `${formatCount(meetingCount)} 场会议，来自 meeting source 的转写/摘要事件`,
        evidence:
          "messages_raw.source_type='meeting' + COUNT(DISTINCT group_id)",
      },
      {
        id: 'ringcentral:calendar',
        label: '日历事件',
        direction: 'ingest',
        state:
          calendar.upcoming > 0
            ? stateForCount(calendar.total, calendar.latestSyncedAt, {
                sparseBelow: 5,
              })
            : stateForCount(calendar.total, calendar.latestSyncedAt, {
                sparseBelow: 5,
                unknownWhenEmpty: true,
              }),
        count: calendar.total,
        recentCount: calendar.upcoming,
        latestAt: calendar.latestSyncedAt,
        detail: `${formatCount(calendar.total)} 条日历记录，${formatCount(calendar.upcoming)} 条未来事件`,
        evidence: 'calendar_events.start_at / synced_at',
      },
    ];

    return this.platform({
      id: 'ringcentral',
      name: 'RingCentral',
      nameEn: 'Glip · Calendar · Video',
      icon: 'RC',
      group: 'active',
      directions: ['ingest'],
      contributions,
      description: '聊天、会议和日历是当前最主要的工作记忆来源。',
    });
  }

  private buildJiraPlatform(
    messageSource: Map<string, MessageSourceCoverageRow>,
  ): MemoryCoveragePlatform {
    const jira = messageSource.get('jira');
    const reflectionCount = this.countWhere(
      'reflection_threads',
      "source_type = 'jira'",
    );
    const latestReflection = this.maxColumnWhere(
      'reflection_threads',
      'updated_at',
      "source_type = 'jira'",
    );
    const contributions: MemoryCoverageContribution[] = [
      this.messageContribution('jira', 'Issue / comment 记忆', 'ingest', jira, 5),
      {
        id: 'jira:reflection',
        label: '反射线程',
        direction: 'derive',
        state: stateForCount(reflectionCount, latestReflection, {
          sparseBelow: 2,
          unknownWhenEmpty: true,
        }),
        count: reflectionCount,
        latestAt: latestReflection,
        detail: `${formatCount(reflectionCount)} 条 Jira 关联反思线程`,
        evidence: "reflection_threads.source_type='jira'",
      },
    ];

    const repairActions: MemoryCoverageRepairAction[] =
      (jira?.count ?? 0) === 0
        ? [
            {
              id: 'jira:no-ingest',
              platformId: 'jira',
              title: '确认 Jira 页面捕获是否仍在运行',
              description:
                'Coverage Map 没有读到 jira source_type；如果浏览器里正在看 Jira，需要检查内容脚本或来源归类。',
              severity: 'warning' as const,
              source: "messages_raw.source_type='jira'",
            },
          ]
        : [];

    return this.platform({
      id: 'jira',
      name: 'Jira',
      nameEn: 'Issue · Comment · Writeback',
      icon: 'JI',
      group: 'active',
      directions: ['ingest', 'push', 'derive'],
      contributions,
      description: 'Jira 覆盖决定项目事实、Issue 背景和后续行动能否被可靠召回。',
      repairActions,
    });
  }

  private buildOpenClawPlatform(
    skillSyncByPlatform: Map<string, SkillSyncCoverageRow>,
  ): MemoryCoveragePlatform {
    const openClawSetting = skillSyncByPlatform.get('openclaw');
    const skillStats = this.getSkillStats();
    const openClawSkillCount = this.countOpenClawSkills();
    const delegatedActionCount = this.countOpenClawActions();
    const latestSkill = this.maxColumn('personal_skills', 'updated_at');
    const latestAction = this.maxColumnWhere(
      'proposed_actions',
      'created_at',
      "source_kind = 'openclaw' OR action_type LIKE '%openclaw%'",
    );
    const syncState: MemoryCoverageState = openClawSetting
      ? openClawSetting.enabled
        ? openClawSetting.lastError
          ? 'failing'
          : 'healthy'
        : 'blocked'
      : 'unknown';

    const contributions: MemoryCoverageContribution[] = [
      {
        id: 'openclaw:skills',
        label: '技能导入',
        direction: 'sync',
        state: stateForCount(openClawSkillCount, latestSkill, {
          sparseBelow: 2,
        }),
        count: openClawSkillCount,
        latestAt: latestSkill,
        detail: `${formatCount(skillStats.active)} 个在用技能，${formatCount(skillStats.suggestion)} 个建议`,
        evidence: "personal_skills.source_kinds_json LIKE '%openclaw%'",
      },
      {
        id: 'openclaw:delegation',
        label: '动作委派',
        direction: 'push',
        state: stateForCount(delegatedActionCount, latestAction, {
          sparseBelow: 1,
          unknownWhenEmpty: true,
        }),
        count: delegatedActionCount,
        latestAt: latestAction,
        detail: `${formatCount(delegatedActionCount)} 条 OpenClaw 相关动作`,
        evidence:
          "proposed_actions.source_kind='openclaw' OR action_type LIKE '%openclaw%'",
      },
      {
        id: 'openclaw:sync-setting',
        label: '平台同步设置',
        direction: 'sync',
        state: syncState,
        count: openClawSetting?.enabled ? 1 : 0,
        latestAt: openClawSetting?.lastProbeAt,
        detail: openClawSetting
          ? `${openClawSetting.enabled ? '已启用' : '未启用'} · ${openClawSetting.capability} · ${openClawSetting.mode}`
          : '未找到 openclaw sync setting',
        evidence: "skill_platform_sync_settings.platform='openclaw'",
      },
    ];

    const repairActions: MemoryCoverageRepairAction[] =
      openClawSetting?.lastError || openClawSetting?.enabled === false
        ? [
            {
              id: 'openclaw:sync-setting',
              platformId: 'openclaw',
              title: '检查 OpenClaw 技能同步设置',
              description:
                openClawSetting?.lastError ||
                'OpenClaw 同步通道关闭，技能只能停留在 Personal AI 内部。',
              severity: 'warning' as const,
              source: "skill_platform_sync_settings.platform='openclaw'",
            },
          ]
        : [];

    return this.platform({
      id: 'openclaw',
      name: 'OpenClaw',
      nameEn: 'Skills · Delegation',
      icon: 'OC',
      group: 'active',
      directions: ['sync', 'push'],
      contributions,
      description: 'OpenClaw 负责把技能和动作委派带到外部 agent 工作流。',
      repairActions,
    });
  }

  private buildDoubaoPlatform(
    messageSource: Map<string, MessageSourceCoverageRow>,
    providerJobs: ProviderJobCoverageRow[],
  ): MemoryCoveragePlatform {
    const doubaoMessages = messageSource.get('doubao');
    const jobs = providerJobs.filter((row) => row.provider === 'doubao');
    const succeeded = jobs.reduce((sum, row) => sum + row.succeeded, 0);
    const failed = jobs.reduce((sum, row) => sum + row.failed, 0);
    const latestAt = maxTimestamp(jobs.map((row) => row.latestAt));
    const latestFailed = jobs.find((row) => row.latestStatus === 'failed');
    const providerState: MemoryCoverageState =
      jobs.length === 0
        ? 'unknown'
        : latestFailed
          ? 'failing'
          : succeeded > 0
            ? 'healthy'
            : 'sparse';

    const contributions: MemoryCoverageContribution[] = [
      {
        id: 'doubao:provider-sync',
        label: '长期记忆推送',
        direction: 'push',
        state: providerState,
        count: succeeded + failed,
        recentCount: succeeded,
        latestAt,
        detail:
          jobs.length > 0
            ? `${formatCount(succeeded)} 次成功，${formatCount(failed)} 次失败`
            : '暂无 doubao provider sync job；Coverage 只能标记为 unknown',
        evidence: "provider_sync_jobs.provider='doubao'",
      },
      this.messageContribution(
        'doubao',
        '豆包回流消息',
        'ingest',
        doubaoMessages,
        1,
        true,
      ),
    ];

    const repairActions: MemoryCoverageRepairAction[] =
      jobs.length === 0 || latestFailed
        ? [
            {
              id: 'doubao:provider-sync',
              platformId: 'doubao',
              title: '确认豆包长期记忆推送链路',
              description:
                latestFailed?.latestError ||
                'Coverage Map 没有读到豆包 provider job；需要确认 provider sync 是否创建任务并回写状态。',
              severity: latestFailed ? 'critical' : 'warning',
              source: "provider_sync_jobs.provider='doubao'",
            },
          ]
        : [];

    return this.platform({
      id: 'doubao',
      name: '豆包 Doubao',
      nameEn: 'Stable Memory · Todo · Notice',
      icon: 'DB',
      group: 'active',
      directions: ['push', 'ingest'],
      contributions,
      description: '豆包覆盖主要是 Personal AI 向外部 AI 推送稳定记忆和待办上下文。',
      repairActions,
    });
  }

  private buildWebPlatform(
    messageSource: Map<string, MessageSourceCoverageRow>,
  ): MemoryCoveragePlatform {
    const web = messageSource.get('web');
    const manual = messageSource.get('manual');
    const capsuleCount = this.countWhere(
      'source_memory_capsules',
      "status = 'saved'",
    );
    const recentCapsuleCount = this.countWhere(
      'source_memory_capsules',
      "status = 'saved' AND COALESCE(saved_at, updated_at, created_at) >= ?",
      [recentAfter()],
    );
    const latestCapsule = this.maxColumnWhere(
      'source_memory_capsules',
      'updated_at',
      "status = 'saved'",
    );
    const contributions: MemoryCoverageContribution[] = [
      this.messageContribution('web', '网页捕获', 'ingest', web, 3, true),
      this.messageContribution('manual', '手动收藏 / 导入片段', 'ingest', manual, 3, true),
      {
        id: 'source-memory:capsules',
        label: '记忆捕捉资料胶囊',
        direction: 'ingest',
        state: stateForCount(capsuleCount, latestCapsule, {
          sparseBelow: 3,
          unknownWhenEmpty: true,
        }),
        count: capsuleCount,
        recentCount: recentCapsuleCount,
        latestAt: latestCapsule,
        detail: `${formatCount(capsuleCount)} 个资料记忆胶囊，近 ${STALE_AFTER_DAYS} 天 ${formatCount(recentCapsuleCount)} 个`,
        evidence: "source_memory_capsules.status='saved'",
      },
    ];
    const repairActions: MemoryCoverageRepairAction[] =
      (web?.count ?? 0) === 0
        ? [
            {
              id: 'web:no-web-memory',
              platformId: 'web_browser',
              title: '检查 Chrome 扩展网页记忆捕获',
              description:
                '没有 web source_type 时，Memory Lens 仍可能显示当前页上下文，但长期网页记忆不会沉淀。',
              severity: 'warning' as const,
              source: "messages_raw.source_type='web'",
            },
          ]
        : [];

    return this.platform({
      id: 'web_browser',
      name: 'Web 浏览',
      nameEn: 'Chrome Extension',
      icon: 'WB',
      group: 'active',
      directions: ['ingest'],
      contributions,
      description: '覆盖无法归入 RingCentral/Jira 的普通网页、手动收藏和现场 DOM 上下文。',
      repairActions,
    });
  }

  private buildCorePlatform(
    pressure: PressureCoverageResponse,
  ): MemoryCoveragePlatform {
    const profileStats = this.getProfileStats();
    const latestProfile = this.maxColumn('user_profile_items', 'updated_at');
    const latestReflection = this.maxColumn('reflection_threads', 'updated_at');
    const latestConfirm = this.maxColumn('confirm_requests', 'created_at');
    const latestNotification = this.maxColumn('notification_records', 'created_at');
    const latestAction = this.maxColumn('proposed_actions', 'created_at');
    const pressureState =
      pressure.totalPressureItems > 100
        ? 'pressure'
        : pressure.totalPressureItems > 0
          ? 'partial'
          : 'healthy';
    const contributions: MemoryCoverageContribution[] = [
      {
        id: 'core:profile',
        label: '用户画像',
        direction: 'derive',
        state: stateForCount(profileStats.active, latestProfile, {
          sparseBelow: 10,
          unknownWhenEmpty: true,
        }),
        count: profileStats.active,
        recentCount: profileStats.pending,
        latestAt: latestProfile,
        detail: `${formatCount(profileStats.active)} 条 active，${formatCount(profileStats.confirmed)} 条 confirmed，${formatCount(profileStats.pending)} 条待确认`,
        evidence: 'user_profile_items',
      },
      {
        id: 'core:reflections',
        label: '反思线程',
        direction: 'derive',
        state: pressure.reflectionThreadsActive > 100 ? 'pressure' : 'healthy',
        count: pressure.reflectionThreadsActive,
        latestAt: latestReflection,
        detail: `${formatCount(pressure.reflectionThreadsActive)} 条 active reflection thread`,
        evidence: "reflection_threads.status='active'",
      },
      {
        id: 'core:notifications',
        label: '通知积压',
        direction: 'derive',
        state: pressure.notificationsPending > 100 ? 'pressure' : 'healthy',
        count: pressure.notificationsPending,
        latestAt: latestNotification,
        detail: `${formatCount(pressure.notificationsPending)} 条未发送/未处理通知`,
        evidence: 'notification_records sent/click/dismiss state',
      },
      {
        id: 'core:actions',
        label: '动作队列',
        direction: 'derive',
        state:
          pressure.actionsQueued + pressure.actionsRunning > 30
            ? 'pressure'
            : 'healthy',
        count: pressure.actionsQueued + pressure.actionsRunning,
        latestAt: latestAction,
        detail: `${formatCount(pressure.actionsQueued)} queued，${formatCount(pressure.actionsRunning)} running`,
        evidence: 'proposed_actions.queue_status',
      },
      {
        id: 'core:confirm',
        label: '待确认决策',
        direction: 'derive',
        state: pressure.confirmRequestsPending > 20 ? 'pressure' : 'healthy',
        count: pressure.confirmRequestsPending,
        latestAt: latestConfirm,
        detail: `${formatCount(pressure.confirmRequestsPending)} 条 pending decision confirm request`,
        evidence: "confirm_requests.state='pending'",
      },
    ];

    const repairActions: MemoryCoverageRepairAction[] =
      pressure.totalPressureItems > 100
        ? [
            {
              id: 'core:pressure',
              platformId: 'personal_ai_core',
              title: '降低 Personal AI Core 积压压力',
              description:
                '通知、反思、动作或决策积压过高时，系统可能看起来“覆盖很多”，但真正可用的下一步会被噪声淹没。',
              severity: 'critical' as const,
              source:
                'notification_records + reflection_threads + proposed_actions + confirm_requests',
            },
          ]
        : [];

    return this.platform({
      id: 'personal_ai_core',
      name: 'Personal AI Core',
      nameEn: 'Profile · Reflection · Decisions',
      icon: 'AI',
      group: 'derived',
      directions: ['derive'],
      contributions,
      description: 'Personal AI 内部派生出的画像、反思、决策、通知和动作队列。',
      stateOverride: pressureState,
      repairActions,
    });
  }

  private buildInactiveSkillPlatforms(
    skillSyncByPlatform: Map<string, SkillSyncCoverageRow>,
  ): MemoryCoveragePlatform[] {
    return INACTIVE_SKILL_PLATFORMS.map((item) => {
      const setting = skillSyncByPlatform.get(item.id);
      const enabled = setting?.enabled === true;
      const state: MemoryCoverageState = enabled
        ? setting?.lastError
          ? 'failing'
          : 'sparse'
        : 'blocked';
      const contribution: MemoryCoverageContribution = {
        id: `${item.id}:skill-sync`,
        label: '技能同步通道',
        direction: 'push',
        state,
        count: enabled ? 1 : 0,
        latestAt: setting?.lastProbeAt ?? null,
        detail: setting
          ? `${enabled ? '已启用' : '未启用'} · ${setting.capability} · ${setting.mode}`
          : `未写入 sync setting，默认能力 ${item.capability}`,
        evidence: `skill_platform_sync_settings.platform='${item.id}'`,
      };

      return this.platform({
        id: item.id,
        name: item.name,
        nameEn: item.nameEn,
        icon: item.icon,
        group: 'inactive',
        directions: ['push'],
        contributions: [contribution],
        description: 'P0 只展示是否配置和是否启用，不自动写入外部平台。',
        stateOverride: state,
        repairActions: [
          repairActionForInactiveSkillPlatform({
            id: item.id,
            name: item.name,
            setting,
            enabled,
          }),
        ],
      });
    });
  }

  private buildAppleRemindersPlatform(): MemoryCoveragePlatform {
    return this.inactivePlatform({
      id: 'apple_reminders',
      name: 'Apple Reminders',
      nameEn: 'Ideas · Tasks',
      icon: 'AR',
      description:
        'P1+ 才通过 Desktop App 做只读检查和用户主动导入，P0 不读取系统 Reminder DB。',
    });
  }

  private buildAppleNotesPlatform(): MemoryCoveragePlatform {
    return this.inactivePlatform({
      id: 'apple_notes',
      name: 'Apple Notes',
      nameEn: 'Notes',
      icon: 'AN',
      description:
        'P1+ 才考虑本地 Notes 只读桥接；P0 不自动扫描本机笔记。',
    });
  }

  private buildExternalAiPlatform(): MemoryCoveragePlatform {
    const stats = this.getExternalAiImportStats();
    if (stats.batches > 0) {
      const importedSignalCount =
        stats.importedMessages || stats.conversations || stats.batches;
      const importState: MemoryCoverageState = stats.latestCommittedAt
        ? stateForCount(importedSignalCount, stats.latestCommittedAt, {
            sparseBelow: 1,
          })
        : 'unknown';
      const recentMessages =
        stats.latestCommittedAt && stats.latestCommittedAt >= recentAfter()
          ? stats.importedMessages
          : 0;
      const skippedDetail =
        stats.skippedParts > 0
          ? `，跳过 ${formatCount(stats.skippedParts)} 个非文本附件/部件`
          : '';
      const ignoredArchiveDetail =
        stats.ignoredFiles > 0
          ? `，忽略 ${formatCount(stats.ignoredFiles)} 个归档文件`
          : '';
      const sourcePathDetail = stats.latestSourcePath
        ? `，来源 ${stats.latestSourcePath}`
        : '';

      return this.platform({
        id: 'external_ai_history',
        name: '外部 AI 历史',
        nameEn: 'ChatGPT · Claude · Gemini',
        icon: 'AI',
        group: 'active',
        directions: ['ingest'],
        stateOverride: importState,
        contributions: [
          {
            id: 'external-ai:import-batches',
            label: '主动导入历史',
            direction: 'ingest',
            state: importState,
            count: importedSignalCount,
            recentCount: recentMessages,
            latestAt: stats.latestCommittedAt,
            detail:
              `${formatCount(stats.batches)} 个导入批次，${formatCount(
                stats.conversations,
              )} 个会话，纳入 ${formatCount(
                stats.importedMessages,
              )}/${formatCount(
                stats.totalMessages,
              )} 条文本消息${skippedDetail}${ignoredArchiveDetail}${sourcePathDetail}`,
            evidence:
              "memory_import_batches.detected_kind='external_ai_history'",
          },
        ],
        description:
          '已通过智能导入处理用户主动提供的外部 AI 历史；这仍不是自动抓取通道。',
        repairActions: [
          {
            id: 'external-ai-history:manual-refresh',
            platformId: 'external_ai_history',
            title:
              importState === 'healthy'
                ? '按需补录新的外部 AI 导出'
                : '更新外部 AI 历史导入',
            description:
              importState === 'healthy'
                ? '外部 AI 历史只在用户主动上传时更新；如果最近换了模型或平台，可以再次导入新的 zip。'
                : `最近一次外部 AI 历史导入已超过 ${STALE_AFTER_DAYS} 天；它不会自动同步，需要重新从外部 AI 平台导出 zip 后在录入抽屉导入。`,
            severity: importState === 'healthy' ? 'info' : 'warning',
            source:
              "memory_import_batches.detected_kind='external_ai_history'",
          },
        ],
      });
    }

    return this.inactivePlatform({
      id: 'external_ai_history',
      name: '外部 AI 历史',
      nameEn: 'ChatGPT · Claude · Gemini',
      icon: 'AI',
      description:
        '通过智能导入入口处理用户主动提供的外部 AI 历史，不做自动抓取。',
    });
  }

  private buildImportBackupPlatform(): MemoryCoveragePlatform {
    const importBatches = this.countTable('memory_import_batches');
    return this.platform({
      id: 'smart_import_backup',
      name: '智能导入 / 记忆备份',
      nameEn: 'Import · Backup',
      icon: 'IM',
      group: 'system',
      directions: ['ingest', 'sync'],
      contributions: [
        {
          id: 'import-backup:backup',
          label: '备份导出 / 恢复',
          direction: 'sync',
          state: 'healthy',
          count: 1,
          detail: '复用现有 /export 与 /import；必须由用户主动触发。',
          evidence: 'POST /api/v1/export + POST /api/v1/import',
        },
        {
          id: 'import-backup:smart-import',
          label: '智能分析导入',
          direction: 'ingest',
          state: importBatches > 0 ? 'healthy' : 'partial',
          count: importBatches,
          detail:
            '支持粘贴文本、md/txt/json/csv/log、普通 zip、外部 AI conversations.json 与 best-effort PDF 文本提取。',
          evidence: 'POST /api/v1/import/inspect + POST /api/v1/import/commit',
        },
      ],
      description:
        '当覆盖不足时，用户可以主动导入资料或恢复 Personal AI 备份。',
      repairActions: [
        {
          id: 'import-backup:pdf-ocr',
          platformId: 'smart_import_backup',
          title: 'PDF OCR 仍需接入',
          description:
            '智能导入已支持常见 PDF 文本流的 best-effort 提取；扫描件仍会明确阻塞，后续可接入本地 OCR。',
          severity: 'info',
          source: '/api/v1/import/inspect',
        },
      ],
    });
  }

  private inactivePlatform(input: {
    id: string;
    name: string;
    nameEn: string;
    icon: string;
    description: string;
  }): MemoryCoveragePlatform {
    return this.platform({
      id: input.id,
      name: input.name,
      nameEn: input.nameEn,
      icon: input.icon,
      group: 'inactive',
      directions: ['ingest'],
      stateOverride: 'not_configured',
      contributions: [
        {
          id: `${input.id}:bridge`,
          label: '桥接通道',
          direction: 'ingest',
          state: 'not_configured',
          count: 0,
          detail: input.description,
          evidence: 'not configured in P0',
        },
      ],
      description: input.description,
      repairActions: [
        {
          id: `${input.id}:future`,
          platformId: input.id,
          title: `规划 ${input.name} 导入入口`,
          description: input.description,
          severity: 'info',
          source: 'progressing plan P1+',
        },
      ],
    });
  }

  private platform(input: {
    id: string;
    name: string;
    nameEn?: string;
    icon: string;
    group: MemoryCoveragePlatformGroup;
    directions: MemoryCoverageDirection[];
    contributions: MemoryCoverageContribution[];
    description: string;
    stateOverride?: MemoryCoverageState;
    repairActions?: MemoryCoverageRepairAction[];
  }): MemoryCoveragePlatform {
    const totalCount = input.contributions.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    const recentCount = input.contributions.reduce(
      (sum, item) => sum + (item.recentCount ?? 0),
      0,
    );
    const lastSeenAt = maxTimestamp(
      input.contributions.map((item) => item.latestAt),
    );
    const state =
      input.stateOverride ??
      combineStates(input.contributions.map((item) => item.state));
    const qualityScoreBreakdown = qualityScoreForPlatform(
      state,
      input.contributions,
      totalCount,
      recentCount,
    );
    const explicitRepairActions = input.repairActions ?? [];
    const qualityRepairAction = scoreRepairActionForPlatform({
      id: input.id,
      name: input.name,
      group: input.group,
      contributions: input.contributions,
      repairActions: explicitRepairActions,
      qualityScoreBreakdown,
    });
    return {
      id: input.id,
      name: input.name,
      nameEn: input.nameEn,
      icon: input.icon,
      group: input.group,
      state,
      directions: input.directions,
      headline: this.headlineForPlatform(state, totalCount, recentCount),
      description: input.description,
      lastSeenAt,
      totalCount,
      recentCount,
      qualityScore: qualityScoreBreakdown.finalScore,
      qualityScoreBreakdown,
      contributions: input.contributions,
      repairActions: qualityRepairAction
        ? [qualityRepairAction, ...explicitRepairActions]
        : explicitRepairActions,
    };
  }

  private messageContribution(
    sourceType: string,
    label: string,
    direction: MemoryCoverageDirection,
    row: MessageSourceCoverageRow | undefined,
    sparseBelow: number,
    unknownWhenEmpty = false,
  ): MemoryCoverageContribution {
    const count = row?.count ?? 0;
    const latestAt = row?.latestAt ?? null;
    return {
      id: `messages:${sourceType}`,
      label,
      direction,
      state: stateForCount(count, latestAt, {
        sparseBelow,
        unknownWhenEmpty,
      }),
      count,
      recentCount: row?.recentCount ?? 0,
      latestAt,
      detail: `${formatCount(count)} 条，近 ${STALE_AFTER_DAYS} 天 ${formatCount(row?.recentCount ?? 0)} 条`,
      evidence: `messages_raw.source_type='${sourceType}'`,
    };
  }

  private headlineForPlatform(
    state: MemoryCoverageState,
    totalCount: number,
    recentCount: number,
  ): string {
    switch (state) {
      case 'healthy':
        return `覆盖健康，近 ${STALE_AFTER_DAYS} 天 ${formatCount(recentCount)} 条新信号`;
      case 'partial':
        return `部分可用，仍有来源缺口或陈旧信号`;
      case 'stale':
        return '有历史数据，但最近没有新信号';
      case 'sparse':
        return `数据偏少，目前只有 ${formatCount(totalCount)} 条信号`;
      case 'failing':
        return '最近同步失败，需要检查错误';
      case 'blocked':
        return '通道关闭或缺少绑定';
      case 'pressure':
        return `积压压力偏高，共 ${formatCount(totalCount)} 条相关项`;
      case 'not_configured':
        return '尚未配置';
      case 'unknown':
      default:
        return 'Coverage Map 目前还读不到足够信号';
    }
  }

  private getCalendarStats(): {
    total: number;
    upcoming: number;
    latestSyncedAt: number | null;
  } {
    if (!this.tableExists('calendar_events')) {
      return { total: 0, upcoming: 0, latestSyncedAt: null };
    }
    const total = this.countWhere('calendar_events', 'cancelled = 0');
    const upcoming = this.countWhere(
      'calendar_events',
      'cancelled = 0 AND start_at >= ?',
      [now()],
    );
    const latestSyncedAt = this.maxColumn('calendar_events', 'synced_at');
    return { total, upcoming, latestSyncedAt };
  }

  private countDistinctMeetings(): number {
    if (!this.tableExists('messages_raw')) return 0;
    const row = this.db
      .prepare(
        `SELECT COUNT(DISTINCT group_id) AS count
         FROM messages_raw
         WHERE source_type = 'meeting'
           AND group_id IS NOT NULL
           AND group_id != ''`,
      )
      .get() as CountRow | undefined;
    return asCount(row?.count);
  }

  private getSkillStats(): {
    active: number;
    suggestion: number;
    dismissed: number;
  } {
    return {
      active: this.countWhere('personal_skills', "status = 'active'"),
      suggestion: this.countWhere('personal_skills', "status = 'suggestion'"),
      dismissed: this.countWhere('personal_skills', "status = 'dismissed'"),
    };
  }

  private countOpenClawSkills(): number {
    return this.countWhere(
      'personal_skills',
      "source_kinds_json LIKE '%openclaw%' OR suggested_from = 'openclaw'",
    );
  }

  private countOpenClawActions(): number {
    return this.countWhere(
      'proposed_actions',
      "source_kind = 'openclaw' OR action_type LIKE '%openclaw%'",
    );
  }

  private getProfileStats(): {
    active: number;
    pending: number;
    confirmed: number;
  } {
    return {
      active: this.countWhere('user_profile_items', "status = 'active'"),
      pending: this.countWhere(
        'user_profile_items',
        "status = 'pending_confirm'",
      ),
      confirmed: this.countWhere(
        'user_profile_items',
        "status = 'active' AND user_confirmed = 1",
      ),
    };
  }

  private getExternalAiImportStats(): ExternalAiImportCoverageStats {
    const empty: ExternalAiImportCoverageStats = {
      batches: 0,
      conversations: 0,
      importedMessages: 0,
      totalMessages: 0,
      skippedParts: 0,
      ignoredFiles: 0,
      latestSourcePath: null,
      latestCommittedAt: null,
    };
    if (!this.tableExists('memory_import_batches')) return empty;

    const rows = this.db
      .prepare(
        `SELECT source_name, source_count, summary_json, committed_at
         FROM memory_import_batches
         WHERE detected_kind = 'external_ai_history'
           AND status = 'committed'
         ORDER BY committed_at DESC`,
      )
      .all() as ExternalAiImportBatchRow[];

    if (rows.length === 0) return empty;

    const stats: ExternalAiImportCoverageStats = {
      ...empty,
      batches: rows.length,
      latestCommittedAt: maxTimestamp(rows.map((row) => row.committed_at)),
    };

    for (const row of rows) {
      const summary = parseJsonObject(row.summary_json);
      const conversations = readSummaryNumber(summary, 'externalAiConversations');
      const importedMessages = readSummaryNumber(summary, 'externalAiImportedMessages');
      const totalMessages = readSummaryNumber(summary, 'externalAiTotalMessages');
      const skippedParts = readSummaryNumber(summary, 'externalAiSkippedParts');
      const ignoredFiles = readSummaryNumber(summary, 'externalAiIgnoredFiles');
      const sourcePath =
        readSummaryString(summary, 'externalAiSourcePath') ?? row.source_name ?? null;

      stats.conversations += conversations ?? asCount(row.source_count);
      stats.importedMessages += importedMessages ?? 0;
      stats.totalMessages += totalMessages ?? importedMessages ?? 0;
      stats.skippedParts += skippedParts ?? 0;
      stats.ignoredFiles += ignoredFiles ?? 0;
      if (!stats.latestSourcePath && sourcePath) {
        stats.latestSourcePath = sourcePath;
      }
    }

    return stats;
  }

  private countTable(table: string): number {
    if (!this.tableExists(table)) return 0;
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get() as CountRow | undefined;
    return asCount(row?.count);
  }

  private countWhere(
    table: string,
    whereClause: string,
    params: unknown[] = [],
  ): number {
    if (!this.tableExists(table)) return 0;
    if (!this.whereColumnsExist(table, whereClause)) return 0;
    const row = this.db
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${whereClause}`)
      .get(...params) as CountRow | undefined;
    return asCount(row?.count);
  }

  private maxColumn(table: string, column: string): number | null {
    return this.maxColumnWhere(table, column, '1 = 1');
  }

  private maxColumnWhere(
    table: string,
    column: string,
    whereClause: string,
  ): number | null {
    if (!this.tableExists(table) || !this.columnExists(table, column)) {
      return null;
    }
    if (!this.whereColumnsExist(table, whereClause)) return null;
    const row = this.db
      .prepare(
        `SELECT MAX(${column}) AS count FROM ${table} WHERE ${whereClause}`,
      )
      .get() as CountRow | undefined;
    const value = row?.count;
    return typeof value === 'number' && value > 0 ? value : null;
  }

  private tableExists(table: string): boolean {
    const row = this.db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table' AND name = ?
         LIMIT 1`,
      )
      .get(table) as { name?: string } | undefined;
    return Boolean(row?.name);
  }

  private columnExists(table: string, column: string): boolean {
    if (!this.tableExists(table)) return false;
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as TableColumnRow[];
    return rows.some((row) => row.name === column);
  }

  private whereColumnsExist(table: string, whereClause: string): boolean {
    const optionalColumns = [
      'queue_status',
      'routing',
      'source_kind',
      'action_type',
      'synced_at',
    ];
    return optionalColumns.every(
      (column) =>
        !whereClause.includes(column) || this.columnExists(table, column),
    );
  }
}
