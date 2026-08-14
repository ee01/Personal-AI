/**
 * Context Pack — read-only prompt packs for external AI / HTTP integration.
 *
 * Plan contract (Help Center 「记忆外接」):
 *   GET /api/v1/context-pack?scope=identity_preferences|recent_focus|today|projects
 *   GET /api/v1/context-pack?scope=custom&q=…
 *
 * Returns { prompt, sources, generatedAt, redactionReceipt }. Never writes memory.
 * USER_CORE raw markdown is not emitted; identity goes through PersonaProjection.
 */

import type Database from 'better-sqlite3';

import { listFocusProjects } from './FocusProjectSyncService.js';
import { buildFocusParagraphContext } from './FocusProjectContextBuilder.js';
import { DayPilotService } from './DayPilotService.js';
import {
  formatPersonaProjectionForExternalContext,
  PersonaProjectionService,
  validatePersonaProjectionOutput,
} from './PersonaProjectionService.js';
import { buildRecentFocusBlock } from './RecentFocusService.js';
import { RecallEngine } from './RecallEngine.js';
import { getConfig } from '../config.js';
import type { ComposerAssistRequest } from '../types/index.js';
import { formatDateTime, now } from '../utils/time.js';

export type ContextPackScope =
  | 'identity_preferences'
  | 'recent_focus'
  | 'today'
  | 'projects'
  | 'custom';

export const CONTEXT_PACK_SCOPES: ContextPackScope[] = [
  'identity_preferences',
  'recent_focus',
  'today',
  'projects',
  'custom',
];

export interface ContextPackSource {
  kind: string;
  id?: string;
  label?: string;
}

export interface ContextPackRedactionReceipt {
  applied: boolean;
  reasonCodes: string[];
  blockedSlotCount: number;
  voiceMode?: string;
  note?: string;
}

export interface ContextPackResult {
  scope: ContextPackScope;
  prompt: string;
  sources: ContextPackSource[];
  generatedAt: string;
  generatedAtUnix: number;
  redactionReceipt: ContextPackRedactionReceipt;
  experimental?: boolean;
  query?: string;
}

export function isContextPackScope(value: string): value is ContextPackScope {
  return (CONTEXT_PACK_SCOPES as string[]).includes(value);
}

function emptyPrompt(scope: ContextPackScope, reason: string): string {
  return [
    `# Context Pack · ${scope}`,
    '',
    `_(${reason})_`,
    '',
    'This pack is read-only context for an external AI. Do not send messages,',
    'create tasks, or take irreversible actions on the user\'s behalf.',
  ].join('\n');
}

function wrapPrompt(title: string, body: string, extras: string[] = []): string {
  const trimmed = body.trim();
  const lines = [
    `# ${title}`,
    `Generated: ${formatDateTime(now())}`,
    '',
    trimmed || '_(no signal in this window)_',
    '',
    '## Boundary',
    '- Read-only context for an external AI — not permission to execute.',
    '- Do not send messages, create tasks, or take irreversible actions.',
    ...extras,
  ];
  return lines.join('\n');
}

export class ContextPackService {
  private readonly persona: PersonaProjectionService;
  private readonly dayPilot: DayPilotService;
  private readonly recall: RecallEngine;

  constructor(
    private readonly db: Database.Database,
    private readonly userId: string,
  ) {
    this.persona = new PersonaProjectionService(db);
    this.dayPilot = new DayPilotService(db, userId);
    this.recall = new RecallEngine(db);
  }

  async build(options: {
    scope: ContextPackScope;
    query?: string;
    timezone?: string;
  }): Promise<ContextPackResult> {
    switch (options.scope) {
      case 'identity_preferences':
        return this.buildIdentity();
      case 'recent_focus':
        return this.buildRecentFocus();
      case 'today':
        return this.buildToday(options.timezone);
      case 'projects':
        return this.buildProjects();
      case 'custom':
        return this.buildCustom(options.query ?? '');
      default: {
        const never: never = options.scope;
        throw new Error(`unsupported_scope:${never}`);
      }
    }
  }

  private buildIdentity(): ContextPackResult {
    const request: ComposerAssistRequest = {
      surface: 'chatgpt',
      contextType: 'web_agent_prompt',
      scenario: 'compose_to_ai',
      primaryText:
        'Provide a short identity and preference briefing about the user for an external AI assistant.',
      draftText:
        '结合我的身份与偏好，给出可外发的简短 persona context（不包含敏感联系方式）。',
    };
    const projection = this.persona.project({
      request,
      suggestionType: 'context_pack',
    });

    const speakable = formatPersonaProjectionForExternalContext(projection);
    const controlLines = projection.controls
      .filter((slot) => slot.decision === 'generation_control' || slot.decision === 'soft_control')
      .slice(0, 6)
      .map((slot) => `- ${slot.key}: ${slot.value}`);

    const sections: string[] = [];
    if (speakable) sections.push(speakable);
    if (controlLines.length) {
      sections.push(['沟通与生成约束：', ...controlLines].join('\n'));
    }

    let prompt = wrapPrompt(
      'Persona Context',
      sections.join('\n\n') ||
        'No confirmed, speakable identity or preference slots are available yet.',
    );

    const validation = validatePersonaProjectionOutput(prompt, projection);
    if (!validation.valid) {
      prompt = emptyPrompt(
        'identity_preferences',
        `redacted: ${validation.reasonCode}`,
      );
    }

    return {
      scope: 'identity_preferences',
      prompt,
      sources: [
        { kind: 'persona_projection', label: 'PersonaProjectionService' },
        ...projection.speakableContext.map((slot) => ({
          kind: 'profile_slot',
          id: slot.key,
          label: slot.value.slice(0, 80),
        })),
      ],
      generatedAt: new Date().toISOString(),
      generatedAtUnix: now(),
      redactionReceipt: {
        applied:
          projection.summary.blockedCount > 0 ||
          projection.blockedValues.length > 0 ||
          !validation.valid,
        reasonCodes: [
          ...(projection.summary.reasonCodes || []),
          ...(!validation.valid ? [validation.reasonCode] : []),
        ],
        blockedSlotCount:
          projection.summary.blockedCount || projection.blockedValues.length,
        voiceMode: projection.summary.voiceMode,
        note: 'USER_CORE raw markdown is never returned; only speakable projection slots.',
      },
    };
  }

  private buildRecentFocus(): ContextPackResult {
    const config = getConfig();
    const block = buildRecentFocusBlock(this.db, {
      windowDays: config.recentFocusWindowDays,
      tokenBudget: Math.min(config.recentFocusTokenBudget || 800, 1200),
    });
    return {
      scope: 'recent_focus',
      prompt: wrapPrompt(
        'Recent Focus',
        block.itemCount > 0
          ? block.bodyMd
          : 'No high-signal recent focus items in the current window.',
        ['- Treat this as rolling context, not a durable fact layer.'],
      ),
      sources: block.sourceRefs.map((ref) => {
        const [kind, id] = ref.split(':', 2);
        return { kind: kind || 'memory', id };
      }),
      generatedAt: new Date().toISOString(),
      generatedAtUnix: now(),
      redactionReceipt: {
        applied: false,
        reasonCodes: [],
        blockedSlotCount: 0,
        note: 'Recent focus is assembled from high-signal memories already stored for this user.',
      },
    };
  }

  private buildToday(timezone?: string): ContextPackResult {
    const tz = timezone || 'Asia/Shanghai';
    const { brief } = this.dayPilot.getToday({
      timezone: tz,
      autoGenerate: false,
    });
    const cards = [...(brief.cards || [])]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 5);

    const lines: string[] = [];
    if (brief.summary) lines.push(brief.summary, '');
    if (!cards.length) {
      lines.push('No Day Pilot missions are ready for today yet.');
    } else {
      lines.push('Top missions:');
      for (const card of cards) {
        const due = card.dueAt ? ` · due ${formatDateTime(card.dueAt)}` : '';
        const action = card.nextBestAction
          ? `\n  next: ${card.nextBestAction}`
          : '';
        lines.push(
          `- [${card.priority || 'medium'}/${card.state || 'now'}] ${card.title}${due}${action}`,
        );
      }
    }

    return {
      scope: 'today',
      prompt: wrapPrompt('Today', lines.join('\n')),
      sources: [
        { kind: 'day_pilot_brief', id: brief.id },
        ...cards.map((card) => ({
          kind: 'day_pilot_card',
          id: card.id,
          label: card.title,
        })),
      ],
      generatedAt: new Date().toISOString(),
      generatedAtUnix: now(),
      redactionReceipt: {
        applied: false,
        reasonCodes: [],
        blockedSlotCount: 0,
        note: 'Uses the existing Today Pilot brief without forcing a regenerate.',
      },
    };
  }

  private buildProjects(): ContextPackResult {
    const projects = listFocusProjects(this.db);
    const body = buildFocusParagraphContext(projects) ||
      'No focus / watched projects are active.';
    return {
      scope: 'projects',
      prompt: wrapPrompt('Focus Project Updates', body),
      sources: projects.slice(0, 12).map((project) => ({
        kind: 'focus_project',
        id: project.id,
        label: project.displayName || project.name || project.id,
      })),
      generatedAt: new Date().toISOString(),
      generatedAtUnix: now(),
      redactionReceipt: {
        applied: false,
        reasonCodes: [],
        blockedSlotCount: 0,
      },
    };
  }

  private async buildCustom(query: string): Promise<ContextPackResult> {
    const q = query.trim();
    if (!q) {
      return {
        scope: 'custom',
        prompt: emptyPrompt('custom', 'missing q parameter'),
        sources: [],
        generatedAt: new Date().toISOString(),
        generatedAtUnix: now(),
        experimental: true,
        query: q,
        redactionReceipt: {
          applied: false,
          reasonCodes: ['missing_query'],
          blockedSlotCount: 0,
        },
      };
    }

    const result = await this.recall.recall(
      {
        query: q,
        scope: 'work',
        topK: 8,
        channels: ['fts', 'time'],
      },
      { allowEmbeddingColdStart: false },
    );

    const lines: string[] = [];
    const sources: ContextPackSource[] = [];
    for (const item of result.items.slice(0, 8)) {
      const text = (item.previewText || item.content || '').trim();
      if (!text) continue;
      const clipped = text.length > 280 ? `${text.slice(0, 280)}…` : text;
      lines.push(`- (${item.source || item.type || 'memory'}) ${clipped}`);
      sources.push({
        kind: String(item.type || 'memory'),
        id: item.id,
        label: item.sourceTitle || item.displayTitle,
      });
    }

    return {
      scope: 'custom',
      prompt: wrapPrompt(
        `Custom · ${q}`,
        lines.length ? lines.join('\n') : 'No matching memories for this query.',
        ['- Experimental scope: quality is not guaranteed.'],
      ),
      sources,
      generatedAt: new Date().toISOString(),
      generatedAtUnix: now(),
      experimental: true,
      query: q,
      redactionReceipt: {
        applied: false,
        reasonCodes: [],
        blockedSlotCount: 0,
        note: 'Custom packs use FTS/time recall only (no vector cold-start).',
      },
    };
  }
}
