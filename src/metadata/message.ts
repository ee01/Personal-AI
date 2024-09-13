import { getIndexedDBData } from '../storage';
import { formatDate, uniqBy } from '../utils';

function fetchAllMessageData() {
    return Promise.all([
      getIndexedDBData('Glip', 'group'),
      getIndexedDBData('Glip', 'person'),
      getIndexedDBData('Glip', 'post'),
      getIndexedDBData('Glip', 'replyPost')
    ])
    .then(([groupData, personData, postData, replyPostData]) => ({
      group: groupData,
      person: personData,
      post: postData,
      replyPost: replyPostData
    }))
    .catch(error => {
      console.log("Error fetchAllMessageData:", error);
      throw error;
    });
}


function transformData2Group(data: any[]) {
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.groupId]) {
      acc[item.groupId] = {
        id: item.groupId,
        groupId: item.groupId,
        groupName: item.groupName,
        text: '',
        groupType: 'team',
        postNum: 0,
        time: '' // 初始化 time 字段
      };
    }
    acc[item.groupId].text += item.parentId ? `[id:${item.id}][threadId:${item.parentId}][${item.time}][${item.creator}]: ${item.text}\n` : `[id:${item.id}][${item.time}][${item.creator}]: ${item.text}\n`;
    acc[item.groupId].postNum += 1;
    acc[item.groupId].time = item.time; // 更新 time 为当前项的时间
    acc[item.groupId].groupType = item.groupType;
    return acc;
  }, {});


  return Object.values(groupedData);
};

export function transformMessagePosts(enableMessage: boolean, startTime: number, selectGroupNames: string[], selectFolderGroupIds: number[]) {
    if (!enableMessage) {
      return Promise.resolve([]);
    }
  
    const transformMessagePosts = (input: any[], persons: any[], groups: any[]) => {
      const personsMap = persons.reduce((acc, person) => {
          acc[person.id] = `${person.first_name} ${person.last_name}`;
          return acc;
      }, {});
      const groupsMap = groups.reduce((acc, group) => {
          acc[group.id] = {
              id: group.id,
              name: group.set_abbreviation,
              is_team: group.is_team
          };
          return acc;
      }, {});
  
      const filteredPosts = input.filter(post => !!post.text);
  
      // 转换数据结构
      const transformedData = filteredPosts.map(post => ({
          id: post.id, // 使用 unique_id 作为 id
          parentId: post.parent_post_id, // 使用 parent_id 作为 parentId
          groupName: groupsMap[post.group_id].name, // 使用 group_id 作为 group_name
          groupType: groupsMap[post.group_id].is_team ? 'team' : 'direct message', // 使用 group_id 作为 group_type
          groupId: post.group_id, // 使用 group_id 作为 group_id
          type: 'message', // 固定为 message
          text: post.text, // 使用原始文本
          creator: personsMap[post.creator_id] || '',
          // @ts-ignore
          time: formatDate(new Date(post.created_at))
      })).filter(item => item.text !== '' && item.creator !== '');
  
      // 按时间排序
      // @ts-ignore
      transformedData.sort((a, b) => new Date(a.time) - new Date(b.time));
  
      return transformedData;
    };
  
    return fetchAllMessageData()
    .then((glipData) => {
        const post = glipData.post.concat(glipData.replyPost);
        const transformedData = transformMessagePosts(post, glipData.person, glipData.group)
        .filter(item => new Date(item.time) >= new Date(startTime))
        .filter(item => {
          const groupName = item.groupName;
  
          // @ts-ignore
          const isGroupSelected = selectGroupNames.length === 0 || selectGroupNames.includes(groupName);
  
          // @ts-ignore
          const isSelectedGroupOfFolder = selectFolderGroupIds.length === 0 || selectFolderGroupIds.includes(item.groupId);
  
          return isGroupSelected && isSelectedGroupOfFolder;
        });
  
        return transformData2Group(uniqBy(transformedData, 'id'));
    })
    .catch((error) => {
        console.log('Error processing files:', error);
    });
}
  