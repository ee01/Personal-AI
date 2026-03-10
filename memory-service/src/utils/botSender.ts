/**
 * BotSender — server-side RingCentral Bot message sender.
 * Reference: src/bot.ts (Chrome Extension version, uses chrome.storage)
 * This backend version uses native fetch (Node 18+).
 */
import { getConfig, type Config } from '../config.js';

type BotConfig = Pick<Config, 'botApiBaseUrl' | 'botToken' | 'botId' | 'botType' | 'botTeamId' | 'botTargetEmail'>;

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
  async sendMarkdown(title: string, body: string, options?: { mention?: boolean }): Promise<void> {
    if (!this.isConfigured()) {
      console.warn('[BotSender] Bot not configured, skipping message send');
      return;
    }

    const mention = options?.mention ?? true;
    const formattedMessage = `**${title}**\n\n${body}`;
    const url = `${this.config.botApiBaseUrl}/${this.config.botType}/message`;

    const payload = this.config.botType === 'team'
      ? {
          mentionList: mention && this.config.botTargetEmail ? [this.config.botTargetEmail] : [],
          isTeamMention: false,
          teamName: '',
          teamId: this.config.botTeamId,
          message: formattedMessage,
          skipMentionCheck: !mention,
        }
      : {
          mention,
          email: this.config.botTargetEmail,
          emailAutoCorrect: true,
          message: formattedMessage,
        };

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
        console.error(`[BotSender] Bot API error: ${response.status} ${response.statusText}`);
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
