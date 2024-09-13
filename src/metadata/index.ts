import { transformMessagePosts } from './message';
import { transformPhone } from './phone';
import { transformCalendar } from './calendar';
import { IConfig } from '../config';

// 主函数
export const fetchUserData = (startTime: any, config: IConfig) => {
    const {
        selectGroupNames,
        enableMessage,
        enableSms,
        enableVoicemail, enableCallTranscript, enableCalendar,
        selectFolderGroupIds,
    } = config;

    const selectGroupNamesArr = selectGroupNames.split(',').map(item => item.trim()).filter(Boolean);
    const folderGroupIdsArr = selectFolderGroupIds.split(',').map(Number).filter(Boolean);

    return Promise.all([
        transformMessagePosts(enableMessage, startTime, selectGroupNamesArr, folderGroupIdsArr),
        transformPhone(startTime, enableSms, enableVoicemail, enableCallTranscript),
        transformCalendar(startTime, enableCalendar)
    ]).then(([message, phone, calendar]) => {
        // @ts-ignore
        return [...message, ...phone, ...calendar].sort((a, b) => new Date(a.time) - new Date(b.time))
    }
    );
};