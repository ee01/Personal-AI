import type Database from 'better-sqlite3';

import { RingCentralClient } from '../RingCentralClient.js';
import type { UserDataManager } from '../../storage/UserDataManager.js';
import { TeamMessagingWebhookService } from './TeamMessagingWebhookService.js';
import {
  extractTeamMessagingNotification,
} from './teamMessagingWebhookParse.js';
import { RC_TM_POSTS_EVENT_FILTER } from './teamMessagingWebhookTypes.js';

export interface BackfillResult {
  chatsProcessed: number;
  postsSeen: number;
  postsIngested: number;
  duplicates: number;
}

export class TeamMessagingBackfillService {
  constructor(
    private readonly db: Database.Database,
    private readonly userDataManager: UserDataManager | undefined,
    private readonly userId: string,
    private readonly client: RingCentralClient,
  ) {}

  async run(options?: {
    chatIds?: string[];
    sinceAt?: number;
    maxChats?: number;
  }): Promise<BackfillResult> {
    const webhook = new TeamMessagingWebhookService(
      this.db,
      this.userDataManager,
      this.userId,
    );
    const repo = webhook.getRepository();

    const chats =
      options?.chatIds?.length
        ? options.chatIds.map((id) => ({ id, name: id }))
        : (await this.client.listAllChatsForBackfill()).slice(
            0,
            options?.maxChats ?? 50,
          );

    let postsSeen = 0;
    let postsIngested = 0;
    let duplicates = 0;

    for (const chat of chats) {
      const chatId = typeof chat === 'string' ? chat : chat.id;
      if (!chatId) continue;
      const watermark = repo.getBackfillWatermark(chatId);
      let pageToken: string | undefined;
      let chatIngested = 0;
      let lastPostId: string | undefined;
      let lastCreationTime: string | undefined;

      do {
        const page = await this.client.listPostsPaginated(chatId, {
          sinceAt: options?.sinceAt,
          pageToken,
        });
        for (const post of page.posts) {
          postsSeen += 1;
          lastPostId = post.id;
          lastCreationTime = post.createdAt;
          const synthetic = extractTeamMessagingNotification(
            {
              uuid: `backfill:${chatId}:${post.id}`,
              body: {
                id: post.id,
                groupId: chatId,
                text: post.text,
                creatorId: post.creatorId,
                creationTime: post.createdAt,
                eventType: 'PostAdded',
              },
            },
            {},
          );
          if (!synthetic) continue;
          if (
            watermark?.lastCreationTime &&
            post.createdAt &&
            post.createdAt <= watermark.lastCreationTime
          ) {
            continue;
          }
          const result = await webhook.ingestFromParsedNote(synthetic, 'backfill');
          if (result.kind === 'duplicate') {
            duplicates += 1;
          } else if (result.kind === 'ingested') {
            postsIngested += 1;
            chatIngested += 1;
          }
        }
        pageToken = page.nextPageToken;
      } while (pageToken);

      if (chatIngested > 0 || lastPostId) {
        repo.setBackfillWatermark(chatId, {
          lastPostId,
          lastCreationTime,
          postsIngested: chatIngested,
        });
      }
    }

    return {
      chatsProcessed: chats.length,
      postsSeen,
      postsIngested,
      duplicates,
    };
  }
}

export { RC_TM_POSTS_EVENT_FILTER };
