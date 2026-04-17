/**
 * BotSender — server-side RingCentral Bot message sender.
 * Reference: src/bot.ts (Chrome Extension version, uses chrome.storage)
 * This backend version uses native fetch (Node 18+).
 *
 * For BOT_TYPE=user, target email is derived from userId (e.g. esone.qiu -> esone.qiu@ringcentral.com).
 * Pass targetUserId in options when calling sendMarkdown.
 */
import { getConfig, type Config } from '../config.js';

type BotConfig = Pick<Config, 'botApiBaseUrl' | 'botToken' | 'botId' | 'botType' | 'botTeamId' | 'botTargetEmail'>;

export interface BotSendResult {
  sent: boolean;
  status?: number;
  statusText?: string;
  messageId?: string;
  responseBody?: string;
  error?: string;
}

/** Derive RingCentral email from userId (e.g. esone.qiu -> esone.qiu@ringcentral.com). */
export function userIdToEmail(userId: string): string {
  return `${userId}@ringcentral.com`;
}

export class BotSender {
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
  }

  /** Check if all required Bot env vars are configured. */
  isConfigured(): boolean {
    return !!(this.config.botApiBaseUrl && this.config.botToken && this.config.botId);
  }

  /** Send a formatted markdown message via the Bot API. Never throws. */
  async sendMarkdown(
    title: string,
    body: string,
    options?: {
      mention?: boolean;
      targetUserId?: string;
      targetGroupId?: string;
    },
  ): Promise<BotSendResult> {
    if (!this.isConfigured()) {
      console.warn('[BotSender] Bot not configured, skipping message send');
      return {
        sent: false,
        error: 'Bot not configured',
      };
    }

    const mention = options?.mention ?? true;
    const targetEmail =
      options?.targetUserId ? userIdToEmail(options.targetUserId) : this.config.botTargetEmail;
    const explicitTargetGroupId = options?.targetGroupId?.trim();
    const useTeamTarget = Boolean(explicitTargetGroupId) || this.config.botType === 'team';
    const targetTeamId = explicitTargetGroupId || this.config.botTeamId;

    const formattedMessage = `**${title}**\n\n${body}`;
    const url = `${this.config.botApiBaseUrl}/${useTeamTarget ? 'team' : 'user'}/message`;

    const payload = useTeamTarget
      ? {
          mentionList: mention && targetEmail ? [targetEmail] : [],
          isTeamMention: false,
          teamName: '',
          teamId: targetTeamId,
          message: formattedMessage,
          skipMentionCheck: !mention,
        }
      : {
          mention,
          email: targetEmail,
          emailAutoCorrect: true,
          message: formattedMessage,
        };

    if (useTeamTarget && !targetTeamId) {
      console.warn(
        '[BotSender] No target team id: pass targetGroupId in options or set BOT_TEAM_ID',
      );
      return {
        sent: false,
        error: 'No target team id configured',
      };
    }

    if (!useTeamTarget && !targetEmail) {
      console.warn(
        '[BotSender] No target email: pass targetUserId in options or set BOT_TARGET_EMAIL',
      );
      return {
        sent: false,
        error: 'No target email configured',
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.botToken}`,
          'bot': this.config.botId,
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();
      if (!response.ok) {
        console.error(
          `[BotSender] Bot API error: ${response.status} ${response.statusText}`,
          responseBody ? `\nResponse body: ${responseBody.slice(0, 500)}` : '',
        );
        return {
          sent: false,
          status: response.status,
          statusText: response.statusText,
          responseBody,
          error: `Bot API error: ${response.status} ${response.statusText}`,
        };
      } else {
        console.log(`[BotSender] Message sent: "${title}"`);
        let messageId: string | undefined;
        try {
          const parsed = responseBody ? JSON.parse(responseBody) as Record<string, unknown> : null;
          if (parsed && typeof parsed.id === 'string') {
            messageId = parsed.id;
          } else if (parsed && typeof parsed.messageId === 'string') {
            messageId = parsed.messageId;
          }
        } catch {
          // ignore parse failures, keep raw body only
        }
        return {
          sent: true,
          status: response.status,
          statusText: response.statusText,
          messageId,
          responseBody,
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[BotSender] Failed to send message:', message);
      return {
        sent: false,
        error: message,
      };
    }
  }
}

let _instance: BotSender | null = null;

/** Get or create the singleton BotSender instance. */
export function getBotSender(): BotSender {
  if (!_instance) {
    _instance = new BotSender(getConfig());
  }
  return _instance;
}
