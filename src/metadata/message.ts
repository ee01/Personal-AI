import { getIndexedDBData, getIndexedDBDataByIds } from '../storage';
import { formatDate, uniqBy } from '../utils';

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
  time: string;
  type: 'message';
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

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
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
    Boolean(postType) ||
    Boolean(title) ||
    addedNames.length > 0 ||
    removedNames.length > 0
  );
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
  const title = normalizeText(post.title || post.subject);
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
  const directText = normalizeText(
    post.text ||
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

function fetchAllMessageData() {
    return Promise.all([
      getIndexedDBData('Glip', 'group'),
      getIndexedDBData('Glip', 'person'),
      getIndexedDBData('Glip', 'post'),
      getIndexedDBData('Glip', 'replyPost')
    ])
    .then(([groupData, personData, postData, replyPostData]) => {
      // 缓存 person 和 group 数据
      cachedPersonsMap = new Map();
      personData.forEach((person: any) => {
        cachedPersonsMap!.set(person.id, `${person.first_name} ${person.last_name}`.trim());
      });
      
      cachedGroupsMap = new Map();
      groupData.forEach((group: any) => {
        cachedGroupsMap!.set(group.id, {
          name: group.set_abbreviation,
          is_team: group.is_team
        });
      });
      
      return {
        group: groupData,
        person: personData,
        post: postData,
        replyPost: replyPostData
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
async function fetchMissingParentPosts(parentIds: (string | number)[], personsMap: Map<any, string>, groupsMap: Map<any, any>): Promise<Map<string | number, MessagePost>> {
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
      const text = post ? extractPostText(post, personsMap) : '';
      if (post && text) {
        const groupInfo = groupsMap.get(post.group_id);
        missingPosts.set(post.id, {
          id: post.id,
          parentId: post.parent_post_id,
          groupId: post.group_id,
          groupName: groupInfo?.name || 'Unknown Team',
          groupType: groupInfo?.is_team ? 'team' : 'direct message',
          text,
          creator: extractPostCreator(post, personsMap) || 'Unknown',
          time: formatDate(new Date(post.created_at)),
          type: 'message'
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
  groupsMap: Map<any, any>
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
  const missingParentPosts = await fetchMissingParentPosts(missingParentIds, personsMap, groupsMap);
  
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
  groupsMap: Map<any, any>
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
    const { threads, standalone } = await buildThreadStructure(group.posts, personsMap, groupsMap);
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
  selectFolderGroupIds: number[]
): Promise<MessageGroupWithThreads[]> {
    if (!enableMessage) {
      return [];
    }
  
    const transformPosts = (input: any[], persons: any[], groups: any[]): { 
      posts: MessagePost[]; 
      personsMap: Map<any, string>; 
      groupsMap: Map<any, any>;
    } => {
      const personsMap = new Map<any, string>();
      persons.forEach(person => {
        personsMap.set(person.id, `${person.first_name} ${person.last_name}`.trim());
      });
      
      const groupsMap = new Map<any, any>();
      groups.forEach(group => {
        groupsMap.set(group.id, {
          id: group.id,
          name: group.set_abbreviation,
          is_team: group.is_team
        });
      });
  
      const filteredPosts = input
        .map(post => ({
          raw: post,
          text: extractPostText(post, personsMap),
          creator: extractPostCreator(post, personsMap)
        }))
        .filter(item => item.text !== '');

      // 转换数据结构
      const transformedData: MessagePost[] = filteredPosts.map(({ raw: post, text, creator }) => {
        const groupInfo = groupsMap.get(post.group_id);
        return {
          id: post.id,
          parentId: post.parent_post_id || undefined,
          groupName: groupInfo?.name || 'Unknown Team',
          groupType: groupInfo?.is_team ? 'team' : 'direct message',
          groupId: post.group_id,
          type: 'message' as const,
          text,
          creator,
          time: formatDate(new Date(post.created_at))
        };
      }).filter(item => item.text !== '' && item.creator !== '');
  
      // 按时间排序
      transformedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  
      return { posts: transformedData, personsMap, groupsMap };
    };
  
    try {
      const glipData = await fetchAllMessageData();
      const post = glipData.post.concat(glipData.replyPost);
      const { posts, personsMap, groupsMap } = transformPosts(post, glipData.person, glipData.group);
      
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
      const result = await transformData2GroupWithThreads(uniquePosts, personsMap, groupsMap);
      
      return result;
    } catch (error) {
      console.log('Error processing files:', error);
      return [];
    }
}
  
