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
    options?: { mention?: boolean; targetUserId?: string },
  ): Promise<void> {
    if (!this.isConfigured()) {
      console.warn('[BotSender] Bot not configured, skipping message send');
      return;
    }

    const mention = options?.mention ?? true;
    const targetEmail =
      options?.targetUserId ? userIdToEmail(options.targetUserId) : this.config.botTargetEmail;

    const formattedMessage = `**${title}**\n\n${body}`;
    const url = `${this.config.botApiBaseUrl}/${this.config.botType}/message`;

    const payload = this.config.botType === 'team'
      ? {
          mentionList: mention && targetEmail ? [targetEmail] : [],
          isTeamMention: false,
          teamName: '',
          teamId: this.config.botTeamId,
          message: formattedMessage,
          skipMentionCheck: !mention,
        }
      : {
          mention,
          email: targetEmail,
          emailAutoCorrect: true,
          message: formattedMessage,
        };

    if (this.config.botType === 'user' && !targetEmail) {
      console.warn(
        '[BotSender] No target email: pass targetUserId in options or set BOT_TARGET_EMAIL',
      );
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

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `[BotSender] Bot API error: ${response.status} ${response.statusText}`,
          body ? `\nResponse body: ${body.slice(0, 500)}` : '',
        );
      } else {
        console.log(`[BotSender] Message sent: "${title}"`);
      }
    } catch (err) {
      console.error('[BotSender] Failed to send message:', err instanceof Error ? err.message : String(err));
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
