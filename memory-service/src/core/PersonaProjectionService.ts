import type Database from 'better-sqlite3';

import { ComposerAudienceResolver } from './ComposerAudienceResolver.js';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
  ComposerAudienceSource,
  ComposerAudienceType,
  PersonaProjectionScene,
  PersonaProjectionSlotKind,
  PersonaProjectionSummary,
} from '../types/index.js';

type PersonaSlotDecision =
  | 'generation_control'
  | 'speakable_context'
  | 'soft_control'
  | 'blocked';

interface ProfileCandidateRow {
  item_type: string;
  item_key: string;
  item_value: string;
  source_kind: string;
  confidence: number;
  user_confirmed: number;
  status: string;
  salience_score: number;
  valid_to: number | null;
  updated_at: number;
}

export interface PersonaProjectionSlot {
  kind: PersonaProjectionSlotKind;
  key: string;
  value: string;
  decision: PersonaSlotDecision;
  reasonCode: string;
}

export interface PersonaProjection {
  summary: PersonaProjectionSummary;
  controls: PersonaProjectionSlot[];
  speakableContext: PersonaProjectionSlot[];
  softControls: PersonaProjectionSlot[];
  blockedValues: string[];
}

export interface PersonaProjectionInput {
  request: ComposerAssistRequest;
  suggestionType: ComposerAssistResponse['suggestionType'];
  timestamp?: number;
}

const MAX_PROFILE_CANDIDATES = 80;
const MAX_PROJECTED_SLOTS = 8;

const SECRET_KEY_PATTERN =
  /password|passcode|secret|api[_\s.-]?key|access[_\s.-]?token|credential|bearer|jwt|private[_\s.-]?key|密码|密钥|令牌|凭证/i;
const SECRET_VALUE_PATTERN =
  /\b(?:sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9_]{12,}|bearer\s+[A-Za-z0-9._-]{16,}|(?:api[_\s-]?key|password|passcode|secret|(?:access[_\s-]?)?token|credential)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{8,})\b|(?:密码|密钥|令牌|凭证)\s*[:=：]\s*["']?[A-Za-z0-9_./+=-]{8,}/i;
const SENSITIVE_PROFILE_PATTERN =
  /email|e-mail|phone|mobile|address|birthday|birth_date|ssn|passport|salary|compensation|medical|health|diagnos|therapy|child|family|邮箱|邮件|电话|手机号|地址|生日|护照|身份证|薪资|工资|医疗|健康|诊断|治疗|孩子|宝宝|家庭/i;
const WRITING_STYLE_PATTERN =
  /^(?:writing_style(?:\.|$)|response_style$|communication_style$)/i;
const CONTROL_KEY_PATTERN =
  /^(?:language_preference|preferred_language|communication_style|response_style|reporting_format|format_preference|tone_preference|work_constraint|communication_constraint|response_constraint)$/i;
const WORK_IDENTITY_KEY_PATTERN =
  /^(?:job_title|title|role|work_role|team|department|organization|organisation|company)$/i;
const PERSONAL_CONTEXT_KEY_PATTERN =
  /^(?:personal_preference|personal_background|experience|interest|goal|dietary_preference|accessibility_preference)$/i;
const PERSONALIZATION_INTENT_PATTERN =
  /结合(?:我|我的|个人)|根据(?:我|我的|个人)|我的(?:偏好|经历|背景|习惯|目标)|个性化|我家|for\s+me|based\s+on\s+my|my\s+(?:preference|experience|background|history|goal)|personal(?:ize|ized|ization|\s+preference|\s+context)/i;

export class PersonaProjectionService {
  private readonly audienceResolver: ComposerAudienceResolver;

  constructor(private readonly db: Database.Database) {
    this.audienceResolver = new ComposerAudienceResolver(db);
  }

  project(input: PersonaProjectionInput): PersonaProjection {
    const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
    const scene = resolveProjectionScene(input.request, input.suggestionType);
    const reasons = new Set<string>(['raw_user_core_excluded']);
    let degraded = false;
    let audience = neutralAudience();
    let candidates: ProfileCandidateRow[] = [];

    try {
      audience = this.audienceResolver.resolve(input.request, timestamp);
      reasons.add(`audience_${audience.source}`);
    } catch {
      degraded = true;
      reasons.add('audience_resolution_failed');
    }

    try {
      candidates = this.loadCandidates();
    } catch {
      degraded = true;
      reasons.add('profile_candidate_load_failed');
    }

    const controls: PersonaProjectionSlot[] = [];
    const speakableContext: PersonaProjectionSlot[] = [];
    const softControls: PersonaProjectionSlot[] = [];
    const blocked: PersonaProjectionSlot[] = [];
    const contextText = collectProjectionContext(input.request);

    for (const candidate of candidates) {
      const slot = decideCandidate({
        candidate,
        request: input.request,
        suggestionType: input.suggestionType,
        scene,
        audienceType: audience.type,
        contextText,
        timestamp,
      });
      if (!slot) continue;
      reasons.add(slot.reasonCode);
      if (slot.decision === 'generation_control') controls.push(slot);
      else if (slot.decision === 'speakable_context') {
        speakableContext.push(slot);
      } else if (slot.decision === 'soft_control') softControls.push(slot);
      else blocked.push(slot);
    }

    const limitedControls = rankSlots(controls);
    const limitedSpeakable = rankSlots(speakableContext);
    const limitedSoft = rankSlots(softControls);
    const mode = resolveRepresentationMode(
      scene,
      audience.type,
      limitedSpeakable.length > 0,
      input.suggestionType,
    );
    const voiceMode = resolveVoiceMode(scene);
    const requiresPreview =
      mode === 'draft_preview_required' || mode === 'context_pack_copyable';
    const usedSlots = [...limitedControls, ...limitedSpeakable, ...limitedSoft];

    return {
      summary: {
        version: 1,
        scene,
        audienceType: audience.type,
        audienceSource: audience.source,
        audienceConfidence: audience.confidence,
        representationMode: mode,
        voiceMode,
        usedSlotKinds: Array.from(new Set(usedSlots.map((slot) => slot.kind))),
        usedCount: usedSlots.length,
        blockedCount: blocked.length,
        reasonCodes: Array.from(reasons).sort(),
        requiresPreview,
        ...(degraded ? { degraded: true } : {}),
      },
      controls: limitedControls,
      speakableContext: limitedSpeakable,
      softControls: limitedSoft,
      blockedValues: blocked
        .map((slot) => normalizeBlockedValue(slot.value))
        .filter((value) => value.length >= 4),
    };
  }

  private loadCandidates(): ProfileCandidateRow[] {
    return this.db
      .prepare(
        `SELECT item_type, item_key, item_value, source_kind, confidence,
                user_confirmed, status, salience_score, valid_to, updated_at
           FROM user_profile_items
          WHERE status IN ('active', 'pending_confirm')
          ORDER BY salience_score DESC, updated_at DESC
          LIMIT ?`,
      )
      .all(MAX_PROFILE_CANDIDATES) as ProfileCandidateRow[];
  }
}

export function formatPersonaProjectionForGeneration(
  projection: PersonaProjection,
): string {
  const sections: string[] = [
    '场景与对象控制（解析结果优先于调用方 hint，禁止在正文中复述这些分类）：',
    JSON.stringify({
      scene: projection.summary.scene,
      audienceType: projection.summary.audienceType,
      voiceMode: projection.summary.voiceMode,
    }),
    getAudienceGenerationPolicy(projection.summary),
  ];
  if (projection.controls.length) {
    sections.push(
      '表达控制（只控制写法，禁止在正文中复述这些配置）：',
      JSON.stringify(
        projection.controls.map((slot) => ({
          key: slot.key,
          value: slot.value,
        })),
      ),
    );
  }
  if (projection.softControls.length) {
    sections.push(
      '柔性表达提示（未确认，只能轻度影响写法，不能当作事实）：',
      JSON.stringify(
        projection.softControls.map((slot) => ({
          key: slot.key,
          value: slot.value,
        })),
      ),
    );
  }
  if (projection.speakableContext.length) {
    sections.push(
      '可陈述身份事实（仅在当前问题确实需要时使用）：',
      JSON.stringify(
        projection.speakableContext.map((slot) => ({
          key: slot.key,
          value: slot.value,
        })),
      ),
    );
  }
  return sections.join('\n');
}

export function formatPersonaProjectionForExternalContext(
  projection: PersonaProjection,
): string {
  const slots = projection.speakableContext;
  if (!slots.length) return '';
  return [
    '已确认的用户约束（仅用于当前提问，不代表外部事实）：',
    ...slots.map((slot) => `- ${slot.key}: ${slot.value}`),
  ].join('\n');
}

export function validatePersonaProjectionOutput(
  text: string,
  projection: PersonaProjection,
): { valid: true } | { valid: false; reasonCode: string } {
  if (SECRET_VALUE_PATTERN.test(text)) {
    return { valid: false, reasonCode: 'projection_output_secret' };
  }
  const normalized = normalizeBlockedValue(text);
  if (
    projection.blockedValues.some(
      (value) => value.length >= 4 && normalized.includes(value),
    )
  ) {
    return { valid: false, reasonCode: 'projection_output_blocked_slot' };
  }
  return { valid: true };
}

export function blockPersonaProjection(
  projection: PersonaProjection,
  reasonCode: string,
): PersonaProjection {
  return {
    ...projection,
    summary: {
      ...projection.summary,
      representationMode: 'blocked',
      requiresPreview: false,
      reasonCodes: Array.from(
        new Set([...projection.summary.reasonCodes, reasonCode]),
      ).sort(),
    },
  };
}

function decideCandidate(input: {
  candidate: ProfileCandidateRow;
  request: ComposerAssistRequest;
  suggestionType: ComposerAssistResponse['suggestionType'];
  scene: PersonaProjectionScene;
  audienceType: ComposerAudienceType;
  contextText: string;
  timestamp: number;
}): PersonaProjectionSlot | null {
  const { candidate } = input;
  const key = candidate.item_key.trim();
  const value = candidate.item_value.trim();
  if (!key || !value) return null;
  const kind = classifySlotKind(candidate);
  const base = { kind, key, value };

  if (isSecretCandidate(key, value)) {
    return {
      ...base,
      decision: 'blocked',
      reasonCode: 'blocked_secret',
    };
  }
  if (candidate.valid_to !== null && candidate.valid_to < input.timestamp) {
    return {
      ...base,
      decision: 'blocked',
      reasonCode: 'blocked_expired',
    };
  }

  const confirmed =
    candidate.user_confirmed === 1 && candidate.status === 'active';
  const writingStyle = WRITING_STYLE_PATTERN.test(key);
  const webScene = input.request.contextType === 'web_agent_prompt';

  if (input.suggestionType === 'prompt_patch') {
    return {
      ...base,
      decision: 'blocked',
      reasonCode: 'prompt_patch_profile_excluded',
    };
  }

  if (writingStyle) {
    if (webScene) {
      return {
        ...base,
        decision: 'blocked',
        reasonCode: 'web_ai_style_excluded',
      };
    }
    if (!styleMatchesScene(key, input.request, input.audienceType)) {
      return {
        ...base,
        decision: 'blocked',
        reasonCode: 'blocked_style_scope_mismatch',
      };
    }
    if (confirmed) {
      return {
        ...base,
        decision: 'generation_control',
        reasonCode: 'confirmed_style_control',
      };
    }
    if (
      candidate.status === 'pending_confirm' &&
      allowsPendingStyle(input.request, input.audienceType)
    ) {
      return {
        ...base,
        decision: 'soft_control',
        reasonCode: 'pending_style_soft_control',
      };
    }
    return {
      ...base,
      decision: 'blocked',
      reasonCode: 'blocked_pending_style_high_responsibility',
    };
  }

  if (!confirmed) {
    return {
      ...base,
      decision: 'blocked',
      reasonCode: 'blocked_unconfirmed_profile',
    };
  }
  if (SENSITIVE_PROFILE_PATTERN.test(`${key} ${value}`)) {
    return {
      ...base,
      decision: 'blocked',
      reasonCode: 'blocked_sensitive_profile',
    };
  }

  if (webScene) {
    const personalized = PERSONALIZATION_INTENT_PATTERN.test(input.contextText);
    if (
      !personalized ||
      !candidateMatchesContext(candidate, input.contextText)
    ) {
      return {
        ...base,
        decision: 'blocked',
        reasonCode: personalized
          ? 'blocked_profile_not_relevant'
          : 'web_personalization_not_requested',
      };
    }
    if (
      candidate.item_type === 'preference' ||
      candidate.item_type === 'constraint' ||
      PERSONAL_CONTEXT_KEY_PATTERN.test(key)
    ) {
      return {
        ...base,
        decision: 'speakable_context',
        reasonCode: 'confirmed_external_context',
      };
    }
    return {
      ...base,
      decision: 'blocked',
      reasonCode: 'blocked_unknown_scope',
    };
  }

  if (CONTROL_KEY_PATTERN.test(key)) {
    return {
      ...base,
      decision: 'generation_control',
      reasonCode: 'confirmed_expression_control',
    };
  }
  if (WORK_IDENTITY_KEY_PATTERN.test(key)) {
    if (!candidateMatchesContext(candidate, input.contextText)) {
      return {
        ...base,
        decision: 'blocked',
        reasonCode: 'blocked_profile_not_relevant',
      };
    }
    return {
      ...base,
      decision: 'speakable_context',
      reasonCode: 'confirmed_relevant_work_identity',
    };
  }

  return {
    ...base,
    decision: 'blocked',
    reasonCode: 'blocked_unknown_scope',
  };
}

function resolveProjectionScene(
  request: ComposerAssistRequest,
  suggestionType: ComposerAssistResponse['suggestionType'],
): PersonaProjectionScene {
  if (request.contextType === 'web_agent_prompt') {
    if (suggestionType === 'prompt_patch') return 'web_ai_prompt_patch';
    if (
      suggestionType === 'rewrite_prompt' ||
      suggestionType === 'prompt_draft'
    ) {
      return 'web_ai_rewrite_prompt';
    }
    return 'web_ai_context_pack';
  }
  if (request.contextType === 'jira_issue') return 'jira_comment';
  return request.surface === 'ringcentral_thread'
    ? 'ringcentral_thread'
    : 'ringcentral_message';
}

function resolveRepresentationMode(
  scene: PersonaProjectionScene,
  audienceType: ComposerAudienceType,
  usesSpeakableFacts: boolean,
  suggestionType?: ComposerAssistResponse['suggestionType'],
): PersonaProjectionSummary['representationMode'] {
  if (suggestionType === 'reply_refine') return 'draft_preview_required';
  if (scene.startsWith('web_ai_')) return 'context_pack_copyable';
  if (scene === 'jira_comment' && usesSpeakableFacts) {
    return 'draft_preview_required';
  }
  if (
    scene.startsWith('ringcentral_') &&
    ['manager', 'external', 'mixed'].includes(audienceType)
  ) {
    return 'draft_preview_required';
  }
  return 'draft_only';
}

function resolveVoiceMode(
  scene: PersonaProjectionScene,
): PersonaProjectionSummary['voiceMode'] {
  if (scene === 'web_ai_prompt_patch') return 'never_speak_as_user';
  if (scene.startsWith('web_ai_')) return 'speak_about_user';
  return 'write_as_user';
}

function classifySlotKind(
  candidate: ProfileCandidateRow,
): PersonaProjectionSlotKind {
  if (WRITING_STYLE_PATTERN.test(candidate.item_key)) return 'writing_style';
  if (WORK_IDENTITY_KEY_PATTERN.test(candidate.item_key)) {
    return 'work_identity';
  }
  if (PERSONAL_CONTEXT_KEY_PATTERN.test(candidate.item_key)) {
    return 'personal_context';
  }
  return candidate.item_type === 'constraint' ? 'constraint' : 'preference';
}

function styleMatchesScene(
  key: string,
  request: ComposerAssistRequest,
  audienceType: ComposerAudienceType,
): boolean {
  const normalized = key.toLowerCase();
  const scenario = resolveComposerScenarioForProjection(request);
  if (
    normalized.includes('ringcentral') &&
    request.contextType !== 'message_thread'
  ) {
    return false;
  }
  if (normalized.includes('jira') && request.contextType !== 'jira_issue') {
    return false;
  }
  if (normalized.includes('thread_reply') && scenario !== 'thread_reply') {
    return false;
  }
  if (
    normalized.includes('casual_reply') &&
    scenario !== 'instant_message_reply'
  ) {
    return false;
  }
  if (
    normalized.includes('peer') &&
    !['peer', 'direct_report'].includes(audienceType)
  ) {
    return false;
  }
  if (normalized.includes('manager') && audienceType !== 'manager')
    return false;
  if (normalized.includes('external') && audienceType !== 'external')
    return false;
  const context = collectProjectionContext(request);
  if (normalized.includes('.zh') && !/[\u3400-\u9fff]/.test(context)) {
    return false;
  }
  if (normalized.includes('.en') && !/[a-z]{3,}/i.test(context)) return false;
  return true;
}

function resolveComposerScenarioForProjection(
  request: ComposerAssistRequest,
): NonNullable<ComposerAssistRequest['scenario']> {
  if (request.scenario) return request.scenario;
  if (request.contextType === 'jira_issue') return 'jira_comment';
  return request.surface === 'ringcentral_thread'
    ? 'thread_reply'
    : 'instant_message_reply';
}

function allowsPendingStyle(
  request: ComposerAssistRequest,
  audienceType: ComposerAudienceType,
): boolean {
  return (
    request.contextType === 'message_thread' &&
    ['peer', 'direct_report', 'unknown'].includes(audienceType)
  );
}

function candidateMatchesContext(
  candidate: ProfileCandidateRow,
  contextText: string,
): boolean {
  const contextTokens = tokenize(candidate.item_key.replace(/[._-]+/g, ' '));
  for (const token of tokenize(candidate.item_value)) contextTokens.add(token);
  const sceneTokens = tokenize(contextText);
  for (const token of contextTokens) {
    if (sceneTokens.has(token)) return true;
  }
  if (/team|department|organization|company/i.test(candidate.item_key)) {
    return /(?:\bteam\b|\bdepartment\b|\borganization\b|\bcompany\b|\bowner\b|团队|部门|组织|负责人)/i.test(
      contextText,
    );
  }
  if (/role|job_title|title/i.test(candidate.item_key)) {
    return /(?:\brole\b|\btitle\b|\bowner\b|\bresponsibilit|\bwho\b|角色|职位|职责|负责人|谁)/i.test(
      contextText,
    );
  }
  return false;
}

function collectProjectionContext(request: ComposerAssistRequest): string {
  return [
    request.title,
    request.draftText,
    request.primaryText,
    ...(request.secondaryTexts ?? []),
    ...(request.keywords ?? []),
    request.threadRoot?.text,
    ...(request.visibleMessages ?? []).flatMap((item) => [
      item.sender,
      item.text,
    ]),
    ...(request.visibleFields ?? []).flatMap((item) => [
      item.name,
      item.value,
      item.rawText,
    ]),
    ...(request.contextItems ?? []).flatMap((item) => [
      item.sender,
      item.title,
      item.text,
    ]),
  ]
    .filter(Boolean)
    .join('\n');
}

function tokenize(value: string): Set<string> {
  const tokens = new Set<string>();
  for (const part of value
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^a-z0-9\u3400-\u9fff]+/)
    .filter(Boolean)) {
    if (/^[\u3400-\u9fff]+$/.test(part)) {
      if (part.length <= 4) tokens.add(part);
      for (let index = 0; index < part.length - 1; index += 1) {
        tokens.add(part.slice(index, index + 2));
      }
    } else if (part.length >= 3) {
      tokens.add(part);
    }
  }
  return tokens;
}

function isSecretCandidate(key: string, value: string): boolean {
  return SECRET_KEY_PATTERN.test(key) || SECRET_VALUE_PATTERN.test(value);
}

function rankSlots(slots: PersonaProjectionSlot[]): PersonaProjectionSlot[] {
  return slots.slice(0, MAX_PROJECTED_SLOTS);
}

function normalizeBlockedValue(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getAudienceGenerationPolicy(
  summary: PersonaProjectionSummary,
): string {
  if (summary.scene === 'jira_comment') {
    return '使用正式、结构化的工作表达；只写有依据的状态、风险、责任边界和下一步。';
  }
  if (summary.scene.startsWith('web_ai_')) {
    return summary.voiceMode === 'never_speak_as_user'
      ? '只补任务结构和边界，禁止代表用户陈述身份、经历或偏好。'
      : '只以第三人称提供当前任务明确需要的用户约束，禁止替用户发言。';
  }
  if (['manager', 'external', 'mixed'].includes(summary.audienceType)) {
    return '使用中性正式且责任清晰的表达；明确状态、风险和下一步，避免随意承诺或套用同事口吻。';
  }
  if (['peer', 'direct_report'].includes(summary.audienceType)) {
    return '使用简短自然的内部协作表达；清楚说明下一步，不增加无依据的承诺。';
  }
  return '关系未知：使用中性专业表达，不猜测对象身份，不套用 peer、manager 或 external 专属口吻。';
}

function neutralAudience(): {
  type: ComposerAudienceType;
  source: ComposerAudienceSource;
  confidence: number;
} {
  return {
    type: 'unknown',
    source: 'unresolved',
    confidence: 0,
  };
}
