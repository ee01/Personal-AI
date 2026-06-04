import { getIndexedDBData, getIndexedDBDataByIds } from '../storage';
import { formatDate, uniqBy } from '../utils';
import {
  appendAttachmentSummaryToText,
  buildFileItemsMap,
  extractPostFileAttachments,
  type MessageAttachment,
} from './attachments';

export type {
  MessageAttachment,
  MessageAttachmentCategory,
} from './attachments';

/**
 * Thread 结构定义
 */
export interface ThreadStructure {
  rootPostId: string;           // 线程根消息 ID
  rootPost: MessagePost | null; // 根消息内容（可能为 null，表示不在时间窗口内但已获取）
  replies: MessagePost[];       // 所有回复（按时间排序）
}

export interface MessagePost {
  id: number | string;
  parentId?: number | string;   // 父消息 ID（关键字段）
  groupId: number | string;
  groupName: string;
  groupType: string;
  text: string;
  creator: string;
  creatorId?: number | string;
  creatorUsername?: string;
  isSelf: boolean;
  authorRole?: 'owner' | 'external' | 'system';
  time: string;
  type: 'message';
  contentType?: 'message' | 'event';
  attachments?: MessageAttachment[];
  event?: {
    title: string;
    start?: string;
    end?: string;
    startAtMs?: number;
    endAtMs?: number;
    timeRange?: string;
    location?: string;
    description?: string;
    allDay?: boolean;
  };
}

export interface MessageGroupWithThreads {
  id: number | string;
  groupId: number | string;
  groupName: string;
  groupType: string;
  postNum: number;
  time: string;
  type: 'message';
  
  // 原有扁平结构（保持兼容）
  posts: MessagePost[];
  text: string;
  
  // 新增：Thread 结构化视图
  threads: ThreadStructure[];   // 有回复的对话线程
  standalone: MessagePost[];    // 独立消息（无回复）
}

// 缓存 person 和 group 数据，避免重复查询
let cachedPersonsMap: Map<number | string, string> | null = null;
let cachedGroupsMap: Map<number | string, { name: string; is_team: boolean }> | null = null;

interface MessageUserInfo {
  username?: string;
  fullName?: string;
  extensionId?: string | number;
  ownerId?: string | number;
  accountId?: string | number;
  id?: string | number;
  userEmail?: string;
  email?: string;
}

interface PersonIdentity {
  name: string;
  username?: string;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeUsername(value: unknown): string {
  const raw = normalizeComparable(value);
  return raw.includes('@') ? raw.split('@')[0] : raw;
}

function extractUsernameFromPerson(person: any): string {
  return (
    normalizeUsername(person?.username) ||
    normalizeUsername(person?.email) ||
    normalizeUsername(person?.email_address) ||
    normalizeUsername(person?.emailAddress) ||
    normalizeUsername(person?.user_name) ||
    normalizeUsername(person?.userName) ||
    normalizeUsername(person?.login)
  );
}

function createPersonIdentity(person: any): PersonIdentity {
  const firstName = normalizeText(person?.first_name || person?.firstName);
  const lastName = normalizeText(person?.last_name || person?.lastName);
  const name =
    normalizeText(person?.name) ||
    normalizeText(person?.displayName) ||
    `${firstName} ${lastName}`.trim();

  return {
    name,
    username: extractUsernameFromPerson(person),
  };
}

function resolvePersonIdentity(
  personsMap: Map<any, PersonIdentity>,
  rawId: unknown,
): PersonIdentity | undefined {
  if (rawId === null || rawId === undefined || rawId === '') {
    return undefined;
  }

  return (
    personsMap.get(rawId) ||
    personsMap.get(String(rawId)) ||
    personsMap.get(Number(rawId))
  );
}

function resolvePersonName(
  personsMap: Map<any, string>,
  rawId: unknown,
): string {
  if (rawId === null || rawId === undefined || rawId === '') {
    return '';
  }

  return (
    personsMap.get(rawId) ||
    personsMap.get(String(rawId)) ||
    personsMap.get(Number(rawId)) ||
    ''
  );
}

function extractPostCreatorId(post: any): string | number | undefined {
  const creatorId =
    post.creator_id ??
    post.creatorId ??
    post.from_ ??
    post.from_id ??
    post.fromId ??
    post.user_id ??
    post.userId ??
    post.creator?.id ??
    post.author?.id;

  return creatorId === null || creatorId === undefined || creatorId === ''
    ? undefined
    : creatorId;
}

function extractPostCreatorUsername(
  post: any,
  personIdentitiesMap?: Map<any, PersonIdentity>,
): string {
  const creatorId = extractPostCreatorId(post);
  const fromPerson = personIdentitiesMap
    ? resolvePersonIdentity(personIdentitiesMap, creatorId)?.username
    : '';

  return (
    normalizeUsername(post.creatorUsername) ||
    normalizeUsername(post.creator?.username) ||
    normalizeUsername(post.author?.username) ||
    normalizeUsername(post.user_name) ||
    normalizeUsername(post.userName) ||
    normalizeUsername(post.user_name_snapshot) ||
    normalizeUsername(post.email) ||
    normalizeUsername(post.email_address) ||
    normalizeUsername(post.emailAddress) ||
    fromPerson ||
    ''
  );
}

export function resolveMessageAuthorMetadata(
  post: {
    creator?: string;
    creatorId?: string | number;
    creatorUsername?: string;
    contentType?: string;
  },
  userinfo?: MessageUserInfo | null,
): Pick<MessagePost, 'isSelf' | 'authorRole'> {
  const creatorUsername = normalizeUsername(post.creatorUsername);
  const currentUsername =
    normalizeUsername(userinfo?.username) ||
    normalizeUsername(userinfo?.userEmail) ||
    normalizeUsername(userinfo?.email);
  const creatorName = normalizeComparable(post.creator);
  const currentFullName = normalizeComparable(userinfo?.fullName);
  const creatorId = normalizeComparable(post.creatorId);
  const currentIds = [
    userinfo?.extensionId,
    userinfo?.ownerId,
    userinfo?.accountId,
    userinfo?.id,
  ]
    .map(normalizeComparable)
    .filter(Boolean);

  const isSystem =
    post.contentType === 'event' ||
    creatorName === 'system' ||
    creatorUsername === 'system';
  const isSelf =
    Boolean(
      creatorUsername && currentUsername && creatorUsername === currentUsername,
    ) ||
    Boolean(
      creatorName && currentFullName && creatorName === currentFullName,
    ) ||
    Boolean(creatorId && currentIds.includes(creatorId));

  return {
    isSelf,
    authorRole: isSystem ? 'system' : isSelf ? 'owner' : 'external',
  };
}

async function getStoredMessageUserInfo(): Promise<MessageUserInfo | undefined> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return undefined;
    }

    const { userinfo } = await chrome.storage.local.get('userinfo');
    return userinfo;
  } catch {
    return undefined;
  }
}

function resolvePersonNames(
  personsMap: Map<any, string>,
  rawIds: unknown,
): string[] {
  if (!Array.isArray(rawIds)) {
    return [];
  }

  return rawIds
    .map((id) => resolvePersonName(personsMap, id))
    .filter(Boolean);
}

function isEventPost(post: any): boolean {
  const functionId = normalizeText(post.function_id || post.functionId);
  if (functionId === 'event') {
    return true;
  }

  const hasEventTime =
    post.start !== undefined ||
    post.start_time !== undefined ||
    post.startTime !== undefined ||
    post.end !== undefined ||
    post.end_time !== undefined ||
    post.endTime !== undefined;

  if (!hasEventTime) {
    return false;
  }

  return (
    post.all_day !== undefined ||
    post.allDay !== undefined ||
    post.repeat !== undefined ||
    post.invitee_ids !== undefined ||
    post.inviteeIds !== undefined ||
    post.attachment_ids !== undefined ||
    post.attachmentIds !== undefined ||
    Boolean(normalizeText(post.location)) ||
    Boolean(normalizeText(post.text || post.title || post.subject))
  );
}

function hasEventSignals(post: any, personsMap?: Map<any, string>): boolean {
  const activity = normalizeText(post.activity || post.activity_type);
  const postType = normalizeText(post.type || post.post_type || post.postType);
  const title = normalizeText(post.title || post.subject);
  const addedIds =
    post.added_person_ids || post.addedPersonsIds || post.addedPersonIds;
  const removedIds =
    post.removed_person_ids || post.removedPersonsIds || post.removedPersonIds;
  const addedNames = personsMap
    ? resolvePersonNames(personsMap, addedIds)
    : Array.isArray(addedIds)
      ? addedIds.filter(Boolean)
      : [];
  const removedNames = personsMap
    ? resolvePersonNames(personsMap, removedIds)
    : Array.isArray(removedIds)
      ? removedIds.filter(Boolean)
      : [];

  return (
    Boolean(activity) ||
    isEventPost(post) ||
    Boolean(postType) ||
    Boolean(title) ||
    addedNames.length > 0 ||
    removedNames.length > 0
  );
}

function normalizeTimestamp(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? undefined : timestamp;
  }

  if (typeof value === 'number') {
    return value < 100000000000 ? value * 1000 : value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const numericValue = Number(value);
    return numericValue < 100000000000 ? numericValue * 1000 : numericValue;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function formatOptionalDateTime(value: unknown): string {
  const timestamp = normalizeTimestamp(value);
  return timestamp ? formatDate(timestamp) : '';
}

function buildEventTimeRange(post: any): string {
  const start = formatOptionalDateTime(
    post.start || post.start_time || post.startTime,
  );
  const end = formatOptionalDateTime(post.end || post.end_time || post.endTime);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end;
}

function buildEventDetails(post: any): MessagePost['event'] {
  const title =
    normalizeText(post.text || post.title || post.subject) || 'Untitled event';
  const startAtMs = normalizeTimestamp(
    post.start || post.start_time || post.startTime,
  );
  const endAtMs = normalizeTimestamp(post.end || post.end_time || post.endTime);
  const start = formatOptionalDateTime(
    post.start || post.start_time || post.startTime,
  );
  const end = formatOptionalDateTime(post.end || post.end_time || post.endTime);
  const timeRange = buildEventTimeRange(post);
  const location = normalizeText(post.location);
  const description = normalizeText(post.description);
  const allDay =
    typeof post.all_day === 'boolean'
      ? post.all_day
      : typeof post.allDay === 'boolean'
        ? post.allDay
        : undefined;

  return {
    title,
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(startAtMs ? { startAtMs } : {}),
    ...(endAtMs ? { endAtMs } : {}),
    ...(timeRange ? { timeRange } : {}),
    ...(location ? { location } : {}),
    ...(description ? { description } : {}),
    ...(allDay !== undefined ? { allDay } : {}),
  };
}

function extractPostCreator(post: any, personsMap: Map<any, string>): string {
  const namedCreator =
    resolvePersonName(personsMap, post.creator_id) ||
    resolvePersonName(personsMap, post.creatorId) ||
    resolvePersonName(personsMap, post.from_) ||
    resolvePersonName(personsMap, post.from_id) ||
    resolvePersonName(personsMap, post.user_id) ||
    resolvePersonName(personsMap, post.userId) ||
    normalizeText(post.creator?.name) ||
    normalizeText(post.creatorName) ||
    normalizeText(post.author?.name) ||
    normalizeText(post.authorName) ||
    normalizeText(post.user_name_snapshot) ||
    normalizeText(post.name_snapshot) ||
    normalizeText(post.from_name) ||
    normalizeText(post.fromName);

  if (namedCreator) {
    return namedCreator;
  }

  return hasEventSignals(post, personsMap) ||
    normalizeText(post.type || post.post_type || post.postType)
    ? 'System'
    : '';
}

function buildEventText(post: any, personsMap: Map<any, string>): string {
  const postType = normalizeText(post.type || post.post_type || post.postType);
  const title = normalizeText(post.text || post.title || post.subject);
  const description = normalizeText(post.description);
  const activity = normalizeText(post.activity || post.activity_type);
  const addedNames = resolvePersonNames(
    personsMap,
    post.added_person_ids || post.addedPersonsIds || post.addedPersonIds,
  );
  const removedNames = resolvePersonNames(
    personsMap,
    post.removed_person_ids || post.removedPersonsIds || post.removedPersonIds,
  );
  const creator = extractPostCreator(post, personsMap) || 'System';
  if (!hasEventSignals(post, personsMap)) {
    return '';
  }

  if (isEventPost(post)) {
    const event = buildEventDetails(post);
    const parts = ['[Event]', event?.title || title || 'Untitled event'];
    if (event?.timeRange) parts.push(`Date and time: ${event.timeRange}`);
    if (event?.allDay) parts.push('All day');
    if (event?.location) parts.push(`Location: ${event.location}`);
    if (description && description !== title) parts.push(description);
    return parts.join(' ').trim();
  }

  switch (postType) {
    case 'PersonJoined':
      return creator === 'System'
        ? 'A member joined the chat'
        : `${creator} joined the chat`;
    case 'PersonsAdded':
      return addedNames.length > 0
        ? `${creator} added ${addedNames.join(', ')}`
        : creator === 'System'
          ? 'Members were added to the chat'
          : `${creator} added members to the chat`;
    case 'PersonsRemoved':
      return removedNames.length > 0
        ? `${creator} removed ${removedNames.join(', ')}`
        : creator === 'System'
          ? 'Members were removed from the chat'
          : `${creator} removed members from the chat`;
    case 'Card':
      return [title, activity].filter(Boolean).join(' - ') || '[Card]';
    default: {
      const parts = [`[${postType || 'Event'}]`];
      if (title) parts.push(title);
      if (activity) parts.push(activity);
      if (addedNames.length > 0) parts.push(`added: ${addedNames.join(', ')}`);
      if (removedNames.length > 0)
        parts.push(`removed: ${removedNames.join(', ')}`);
      return parts.join(' ').trim();
    }
  }
}

function extractPostText(post: any, personsMap: Map<any, string>): string {
  if (isEventPost(post)) {
    return buildEventText(post, personsMap);
  }

  const directText = normalizeText(
    post.text ||
      post.subject ||
      post.title ||
      post.body?.text ||
      post.content ||
      post.message ||
      post.description,
  );

  if (directText) {
    return directText;
  }

  return buildEventText(post, personsMap);
}

function extractPostGroupId(post: any): string | number | undefined {
  const groupId =
    post.group_id ||
    post.groupId ||
    post.from_group_id ||
    post.fromGroupId ||
    post.group?.id;

  if (groupId) {
    return groupId;
  }

  const groupIds = post.group_ids || post.groupIds;
  return Array.isArray(groupIds) && groupIds.length > 0
    ? groupIds[0]
    : undefined;
}

function extractPostCreatedAt(post: any): Date {
  const rawTime =
    post.created_at ||
    post.createdAt ||
    post.modified_at ||
    post.modifiedAt ||
    post.start ||
    post.startTime;

  return rawTime ? new Date(rawTime) : new Date();
}

function resolveGroupInfo(
  groupsMap: Map<any, any>,
  groupId: string | number | undefined,
) {
  if (groupId === null || groupId === undefined || groupId === '') {
    return undefined;
  }

  return (
    groupsMap.get(groupId) ||
    groupsMap.get(String(groupId)) ||
    groupsMap.get(Number(groupId))
  );
}

function fetchIndexedDBStoreNames(databaseName: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);

    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const storeNames = Array.from(db.objectStoreNames) as string[];
      db.close();
      resolve(storeNames);
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

function fetchOptionalIndexedDBData(
  databaseName: string,
  storeName: string,
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);

    request.onsuccess = (event: any) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve([]);
        return;
      }

      try {
        const transaction = db.transaction([storeName], 'readonly');
        const objectStore = transaction.objectStore(storeName);
        const dataRequest = objectStore.getAll();

        dataRequest.onsuccess = (dataEvent: any) => {
          resolve(dataEvent.target.result || []);
          db.close();
        };

        dataRequest.onerror = (dataEvent: any) => {
          reject(dataEvent.target.error);
          db.close();
        };
      } catch (error) {
        db.close();
        reject(error);
      }
    };

    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

function mergeEventContext(eventRecord: any, nestedPost: any) {
  return {
    ...nestedPost,
    group_id: extractPostGroupId(nestedPost) || extractPostGroupId(eventRecord),
    created_at:
      nestedPost.created_at ||
      nestedPost.createdAt ||
      eventRecord.created_at ||
      eventRecord.createdAt,
    creator_id:
      nestedPost.creator_id || nestedPost.creatorId || eventRecord.creator_id,
    function_id: nestedPost.function_id || eventRecord.function_id || 'event',
    text: nestedPost.text || eventRecord.text || eventRecord.title,
    title: nestedPost.title || eventRecord.title,
    description: nestedPost.description || eventRecord.description,
    start: nestedPost.start || eventRecord.start,
    end: nestedPost.end || eventRecord.end,
  };
}

function flattenEventRecords(eventRecords: any[]): any[] {
  return eventRecords.flatMap((eventRecord) => {
    const nestedPosts = Array.isArray(eventRecord?.posts)
      ? eventRecord.posts.filter((post: any) => post && typeof post === 'object')
      : [];

    if (nestedPosts.length === 0) {
      return eventRecord ? [eventRecord] : [];
    }

    return [
      eventRecord,
      ...nestedPosts.map((nestedPost: any) =>
        mergeEventContext(eventRecord, nestedPost),
      ),
    ];
  });
}

async function fetchGlipEventData(): Promise<any[]> {
  const storeNames = await fetchIndexedDBStoreNames('Glip');
  const eventStoreNames = storeNames.filter((storeName) =>
    /event/i.test(storeName),
  );

  if (eventStoreNames.length === 0) {
    console.warn('Glip IndexedDB 未发现 event store:', storeNames);
    return [];
  }

  const eventStoreData = await Promise.all(
    eventStoreNames.map(async (storeName) => {
      try {
        const rows = await fetchOptionalIndexedDBData('Glip', storeName);
        return { storeName, rows };
      } catch (error) {
        console.warn(`读取 Glip/${storeName} 失败:`, error);
        return { storeName, rows: [] as any[] };
      }
    }),
  );

  console.log(
    'Glip event stores loaded:',
    eventStoreData.map(({ storeName, rows }) => ({
      storeName,
      count: rows.length,
    })),
  );

  return flattenEventRecords(
    eventStoreData.flatMap(({ rows }) => rows),
  );
}

function fetchAllMessageData() {
    return Promise.all([
      getIndexedDBData('Glip', 'group'),
      getIndexedDBData('Glip', 'person'),
      getIndexedDBData('Glip', 'post'),
      getIndexedDBData('Glip', 'replyPost'),
      fetchOptionalIndexedDBData('Glip', 'fileItem'),
      fetchOptionalIndexedDBData('Glip', 'item'),
      fetchGlipEventData()
    ])
    .then(([groupData, personData, postData, replyPostData, fileItemData, itemData, eventData]) => {
      // 缓存 person 和 group 数据
      cachedPersonsMap = new Map();
      personData.forEach((person: any) => {
        cachedPersonsMap!.set(person.id, `${person.first_name} ${person.last_name}`.trim());
      });
      
      cachedGroupsMap = new Map();
      groupData.forEach((group: any) => {
        const groupInfo = {
          name: group.set_abbreviation,
          is_team: group.is_team
        };

        cachedGroupsMap!.set(group.id, groupInfo);
        cachedGroupsMap!.set(String(group.id), groupInfo);
      });
      
      return {
        group: groupData,
        person: personData,
        post: postData,
        replyPost: replyPostData,
        fileItem: fileItemData.concat(itemData),
        event: eventData
      };
    })
    .catch(error => {
      console.log("Error fetchAllMessageData:", error);
      throw error;
    });
}

/**
 * 根据 post ID 获取父消息（用于获取不在时间窗口内的消息）
 */
async function fetchMissingParentPosts(
  parentIds: (string | number)[],
  personsMap: Map<any, string>,
  groupsMap: Map<any, any>,
  fileItemsMap: Map<any, any>,
): Promise<Map<string | number, MessagePost>> {
  const missingPosts = new Map<string | number, MessagePost>();
  
  if (parentIds.length === 0) return missingPosts;
  
  try {
    // 尝试从 post 表获取
    const postsFromMain = await getIndexedDBDataByIds('Glip', 'post', parentIds);
    
    // 尝试从 replyPost 表获取（父消息可能也是回复）
    const remainingIds = parentIds.filter(id => !postsFromMain.find((p: any) => p.id === id));
    const postsFromReply = remainingIds.length > 0 
      ? await getIndexedDBDataByIds('Glip', 'replyPost', remainingIds)
      : [];
    
    const allPosts = [...postsFromMain, ...postsFromReply];
    
    for (const post of allPosts) {
      const attachments = post
        ? extractPostFileAttachments(post, fileItemsMap)
        : [];
      const text = post
        ? appendAttachmentSummaryToText(
            extractPostText(post, personsMap),
            attachments,
          )
        : '';
      if (post && text) {
        const groupId = extractPostGroupId(post);
        const groupInfo = resolveGroupInfo(groupsMap, groupId);
        const isEvent = isEventPost(post);
        const contentType: MessagePost['contentType'] = isEvent
          ? 'event'
          : 'message';
        const creatorId = extractPostCreatorId(post);
        const creatorUsername = extractPostCreatorUsername(post);
        const creator = extractPostCreator(post, personsMap) || 'Unknown';
        const authorMetadata = resolveMessageAuthorMetadata({
          creator,
          creatorId,
          creatorUsername,
          contentType,
        });
        missingPosts.set(post.id, {
          id: post.id,
          parentId: post.parent_post_id,
          groupId: groupId || 'unknown',
          groupName: groupInfo?.name || 'Unknown Team',
          groupType: groupInfo?.is_team ? 'team' : 'direct message',
          text,
          creator,
          creatorId,
          creatorUsername,
          ...authorMetadata,
          time: formatDate(extractPostCreatedAt(post).getTime()),
          type: 'message',
          contentType,
          ...(attachments.length > 0 ? { attachments } : {}),
          ...(isEvent ? { event: buildEventDetails(post) } : {})
        });
      }
    }
  } catch (error) {
    console.warn('获取父消息失败:', error);
  }
  
  return missingPosts;
}

/**
 * 构建 Thread 结构
 * @param posts 当前时间窗口内的消息
 * @param personsMap 用户映射
 * @param groupsMap 群组映射
 */
async function buildThreadStructure(
  posts: MessagePost[],
  personsMap: Map<any, string>,
  groupsMap: Map<any, any>,
  fileItemsMap: Map<any, any>,
): Promise<{ threads: ThreadStructure[]; standalone: MessagePost[] }> {
  const postsMap = new Map(posts.map(p => [String(p.id), p]));
  const repliesMap = new Map<string, MessagePost[]>(); // parentId -> replies[]
  const rootPosts: MessagePost[] = [];
  const orphanReplies: MessagePost[] = []; // 父消息不在当前数据中的回复
  
  // 第一步：分类消息
  for (const post of posts) {
    if (post.parentId) {
      // 这是一个回复
      const parentIdStr = String(post.parentId);
      if (!repliesMap.has(parentIdStr)) {
        repliesMap.set(parentIdStr, []);
      }
      repliesMap.get(parentIdStr)!.push(post);
      
      // 检查父消息是否在当前数据中
      if (!postsMap.has(parentIdStr)) {
        orphanReplies.push(post);
      }
    } else {
      // 这是根消息或独立消息
      rootPosts.push(post);
    }
  }
  
  // 第二步：获取不在时间窗口内的父消息
  const missingParentIds = [...new Set(orphanReplies.map(p => p.parentId!))];
  const missingParentPosts = await fetchMissingParentPosts(
    missingParentIds,
    personsMap,
    groupsMap,
    fileItemsMap,
  );
  
  // 将获取到的父消息添加到 postsMap
  missingParentPosts.forEach((post, id) => {
    postsMap.set(String(id), post);
  });
  
  // 第三步：构建线程
  const threads: ThreadStructure[] = [];
  const standalone: MessagePost[] = [];
  const usedRootIds = new Set<string>();
  
  // 处理有回复的根消息
  for (const rootPost of rootPosts) {
    const rootId = String(rootPost.id);
    const replies = repliesMap.get(rootId) || [];
    
    if (replies.length > 0) {
      // 有回复，构建线程
      threads.push({
        rootPostId: rootId,
        rootPost,
        replies: replies.sort((a, b) => 
          new Date(a.time).getTime() - new Date(b.time).getTime()
        )
      });
      usedRootIds.add(rootId);
    } else {
      // 独立消息
      standalone.push(rootPost);
    }
  }
  
  // 处理"孤儿"回复（原消息不在当前时间窗口内）
  for (const [parentId, replies] of repliesMap.entries()) {
    if (!usedRootIds.has(parentId)) {
      // 尝试从获取到的父消息中找到根消息
      const rootPost = missingParentPosts.get(parentId) || missingParentPosts.get(Number(parentId)) || null;
      
      threads.push({
        rootPostId: parentId,
        rootPost,
        replies: replies.sort((a, b) => 
          new Date(a.time).getTime() - new Date(b.time).getTime()
        )
      });
    }
  }
  
  // 按时间排序线程（使用最新回复时间或根消息时间）
  threads.sort((a, b) => {
    const aTime = a.replies.length > 0 
      ? new Date(a.replies[a.replies.length - 1].time).getTime()
      : (a.rootPost ? new Date(a.rootPost.time).getTime() : 0);
    const bTime = b.replies.length > 0 
      ? new Date(b.replies[b.replies.length - 1].time).getTime()
      : (b.rootPost ? new Date(b.rootPost.time).getTime() : 0);
    return aTime - bTime;
  });
  
  return { threads, standalone };
}

/**
 * 将消息按群组分组，并构建 Thread 结构
 */
async function transformData2GroupWithThreads(
  data: MessagePost[],
  personsMap: Map<any, string>,
  groupsMap: Map<any, any>,
  fileItemsMap: Map<any, any>,
): Promise<MessageGroupWithThreads[]> {
  // 第一步：按群组分组
  const groupedData: Record<string, MessageGroupWithThreads> = {};
  
  for (const item of data) {
    const groupIdStr = String(item.groupId);
    
    if (!groupedData[groupIdStr]) {
      groupedData[groupIdStr] = {
        id: item.groupId,
        groupId: item.groupId,
        groupName: item.groupName,
        text: '',
        posts: [],
        threads: [],
        standalone: [],
        groupType: item.groupType,
        postNum: 0,
        time: '',
        type: 'message'
      };
    }
    
    // 构建 text 字段（保持兼容）
    groupedData[groupIdStr].text += item.parentId 
      ? `[id:${item.id}][threadId:${item.parentId}][${item.time}][${item.creator}]: ${item.text}\n` 
      : `[id:${item.id}][${item.time}][${item.creator}]: ${item.text}\n`;
    
    groupedData[groupIdStr].posts.push(item);
    groupedData[groupIdStr].postNum += 1;
    groupedData[groupIdStr].time = item.time;
  }
  
  // 第二步：为每个群组构建 Thread 结构
  const groups = Object.values(groupedData);
  
  for (const group of groups) {
    const { threads, standalone } = await buildThreadStructure(
      group.posts,
      personsMap,
      groupsMap,
      fileItemsMap,
    );
    group.threads = threads;
    group.standalone = standalone;
  }
  
  return groups;
}

/**
 * 原有的同步版本（保持兼容，但不包含 thread 结构）
 */
function _transformData2Group(data: any[]) {
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.groupId]) {
      acc[item.groupId] = {
        id: item.groupId,
        groupId: item.groupId,
        groupName: item.groupName,
        text: '',
        posts: [],
        threads: [],
        standalone: [],
        groupType: 'team',
        postNum: 0,
        time: ''
      };
    }
    acc[item.groupId].text += item.parentId ? `[id:${item.id}][threadId:${item.parentId}][${item.time}][${item.creator}]: ${item.text}\n` : `[id:${item.id}][${item.time}][${item.creator}]: ${item.text}\n`;
    acc[item.groupId].posts.push(item);
    acc[item.groupId].postNum += 1;
    acc[item.groupId].time = item.time;
    acc[item.groupId].groupType = item.groupType;
    acc[item.groupId].type = 'message';
    return acc;
  }, {});

  return Object.values(groupedData);
}

export async function transformMessagePosts(
  enableMessage: boolean, 
  startTime: number, 
  selectGroupNames: string[], 
  selectFolderGroupIds: number[],
  userinfo?: MessageUserInfo | null
): Promise<MessageGroupWithThreads[]> {
    if (!enableMessage) {
      return [];
    }
  
    const transformPosts = (
      input: any[],
      persons: any[],
      groups: any[],
      fileItems: any[] = [],
    ): {
      posts: MessagePost[];
      personsMap: Map<any, string>;
      groupsMap: Map<any, any>;
      fileItemsMap: Map<any, any>;
    } => {
      const personsMap = new Map<any, string>();
      const personIdentitiesMap = new Map<any, PersonIdentity>();
      persons.forEach(person => {
        const identity = createPersonIdentity(person);
        personsMap.set(person.id, identity.name);
        personIdentitiesMap.set(person.id, identity);
        personIdentitiesMap.set(String(person.id), identity);
      });
      
      const groupsMap = new Map<any, any>();
      groups.forEach(group => {
        const groupInfo = {
          id: group.id,
          name: group.set_abbreviation,
          is_team: group.is_team
        };

        groupsMap.set(group.id, groupInfo);
        groupsMap.set(String(group.id), groupInfo);
      });
      const fileItemsMap = buildFileItemsMap(fileItems);
  
      const filteredPosts = input
        .map(post => {
          const attachments = extractPostFileAttachments(post, fileItemsMap);
          return {
            raw: post,
            text: appendAttachmentSummaryToText(
              extractPostText(post, personsMap),
              attachments,
            ),
            attachments,
            creator: extractPostCreator(post, personsMap),
            creatorId: extractPostCreatorId(post),
            creatorUsername: extractPostCreatorUsername(
              post,
              personIdentitiesMap,
            )
          };
        })
        .filter(item => item.text !== '');

      // 转换数据结构
      const transformedData: MessagePost[] = filteredPosts.map(({
        raw: post,
        text,
        creator,
        creatorId,
        creatorUsername,
        attachments,
      }) => {
        const groupId = extractPostGroupId(post);
        const groupInfo = resolveGroupInfo(groupsMap, groupId);
        const isEvent = isEventPost(post);
        const contentType: MessagePost['contentType'] = isEvent
          ? 'event'
          : 'message';
        const authorMetadata = resolveMessageAuthorMetadata(
          {
            creator,
            creatorId,
            creatorUsername,
            contentType,
          },
          userinfo,
        );
        return {
          id: post.id,
          parentId: post.parent_post_id || undefined,
          groupName: groupInfo?.name || 'Unknown Team',
          groupType: groupInfo?.is_team ? 'team' : 'direct message',
          groupId: groupId || 'unknown',
          type: 'message' as const,
          text,
          creator,
          creatorId,
          creatorUsername,
          ...authorMetadata,
          time: formatDate(extractPostCreatedAt(post).getTime()),
          contentType,
          ...(attachments.length > 0 ? { attachments } : {}),
          ...(isEvent ? { event: buildEventDetails(post) } : {})
        };
      }).filter(item => item.text !== '' && item.creator !== '' && item.groupId !== 'unknown');
  
      // 按时间排序
      transformedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
      return { posts: transformedData, personsMap, groupsMap, fileItemsMap };
    };
  
    try {
      const resolvedUserinfo = userinfo || (await getStoredMessageUserInfo());
      const glipData = await fetchAllMessageData();
      const post = glipData.post.concat(glipData.replyPost, glipData.event);
      userinfo = resolvedUserinfo;
      const { posts, personsMap, groupsMap, fileItemsMap } = transformPosts(
        post,
        glipData.person,
        glipData.group,
        glipData.fileItem,
      );
      
      // 按时间和群组过滤
      const filteredPosts = posts
        .filter(item => new Date(item.time) >= new Date(startTime))
        .filter(item => {
          const groupName = item.groupName;
          const isGroupSelected = selectGroupNames.length === 0 || selectGroupNames.includes(groupName);
          const isSelectedGroupOfFolder = selectFolderGroupIds.length === 0 || selectFolderGroupIds.includes(Number(item.groupId));
          return isGroupSelected && isSelectedGroupOfFolder;
        });
      
      // 去重
      const uniquePosts = uniqBy(filteredPosts, 'id') as MessagePost[];
      
      // 使用新的异步版本构建 Thread 结构
      const result = await transformData2GroupWithThreads(
        uniquePosts,
        personsMap,
        groupsMap,
        fileItemsMap,
      );
      
      return result;
    } catch (error) {
      console.log('Error processing files:', error);
      return [];
    }
}
  
