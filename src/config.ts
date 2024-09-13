import { observable, action } from 'mobx';
import { getCurrentUserInfo, setLocalStorageItem, getLocalStorageItem } from './storage';
import { CONFIG_LOCAL_STORAGE_KEY } from './constants';

const { username, extensionId } = getCurrentUserInfo();

export type IConfig = {
    recentDays: number;
    selectGroupNames: string;
    enableMessage: boolean;
    enableSms: boolean;
    enableVoicemail: boolean;
    enableCallTranscript: boolean;
    enableCalendar: boolean;
    selectFolderGroupIds: string;
    username: string;
    extensionId: string;
    apiKey: string;
    model: string;
}

const DefaultConfig: IConfig = {
    recentDays: 1,
    selectGroupNames: '',
    enableMessage: true,
    enableSms: true,
    enableVoicemail: true,
    enableCallTranscript: true,
    enableCalendar: true,
    selectFolderGroupIds: '',
    username: username,
    extensionId: extensionId,
    apiKey: 'app-CjA00E2dCpUqlpmqhcRp91gq',
    model: '4o',
};

export class RadarPoCConfig {
    @observable
    config: IConfig;

    constructor() {
        this.config = getLocalStorageItem(CONFIG_LOCAL_STORAGE_KEY, DefaultConfig);
    }

    @action
    setConfig(config: IConfig) {
        this.config = config;
    }
    
    @action
    updateConfig(partialConfig: Partial<IConfig>) {
        this.config = { ...this.config, ...partialConfig };
    }

    saveConfig() {
        setLocalStorageItem(CONFIG_LOCAL_STORAGE_KEY, this.config);
    }

}