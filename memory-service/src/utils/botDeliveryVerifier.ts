import type { RingCentralPost } from '../integrations/RingCentralClient.js';
import { createHash } from 'node:crypto';

export function groupPostVerifier(
  client: { listPosts(chatId: string, sinceAt?: number): Promise<RingCentralPost[]> },
  botId: string,
) {
  const creatorId = botId.split('@')[0];
  return async (input: { chatId: string; messageId?: string; text?: string; textHash?: string; sinceAt: number }) => {
    const posts = await client.listPosts(input.chatId, Math.floor(input.sinceAt));
    const matches = posts.filter(post => post.chatId === input.chatId && post.creatorId === creatorId &&
      Boolean(post.createdAt) && Date.parse(post.createdAt!) >= input.sinceAt * 1000 - 1000 &&
      (input.messageId ? post.id === input.messageId : input.text !== undefined
        ? post.text.trim().replace(/\r\n/g,'\n') === input.text.trim().replace(/\r\n/g,'\n')
        : Boolean(input.textHash) && createHash('sha256').update(post.text.trim().replace(/\r\n/g,'\n')).digest('hex') === input.textHash));
    return matches.length === 1 ? { messageId: matches[0].id, chatId: matches[0].chatId } : undefined;
  };
}
