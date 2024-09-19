import { observable } from 'mobx';
import { increment, indexing, fetchLastIndexTime, genTopics, customQuery, fetchDifyServer, delete_indexing, trendingTopics, globalQuery } from './api';
import { formatDate, showToast, transformGroupLinks, transformPostLinks } from './utils';
import { RadarPoCConfig } from './config';
import { fetchUserData } from './metadata';
import { GET_INIT_TOPICS_QUERY } from './prompt';
import { getFolders, getLocalStorageItem, setLocalStorageItem, getGroupsMap } from './storage';
import { CONFIG_LOCAL_STORAGE_KEY, RADAR_POC_RESULT_LISTS, RADAR_POC_CANDIDATE_QUESTIONS } from './constants';

export class ViewModel {
    @observable
    radarPoCConfig: RadarPoCConfig;

    @observable
    lists: { timestamp: number, text: string }[] = [];

    @observable
    latestTimestamp?: number = undefined;

    @observable
    showConfig = true;

    @observable
    loading = false;

    @observable
    folders: any[] = [];

    @observable
    candidateQuestions: string[] = [];

    @observable
    query = '';

    groupMaps = {};

    constructor() {
        this._init();
    }

    private _init() {
        this.loading = true;
        if (localStorage.getItem(CONFIG_LOCAL_STORAGE_KEY)) {
            this.showConfig = false;
        }
        const lists = getLocalStorageItem(RADAR_POC_RESULT_LISTS, []);
        const candidateQuestions = getLocalStorageItem(RADAR_POC_CANDIDATE_QUESTIONS, []);
        if (lists && lists.length) {
            this.lists = [...lists];
        }
        if (candidateQuestions && candidateQuestions.length) {
            this.candidateQuestions = [...candidateQuestions];
        }

        this.radarPoCConfig = new RadarPoCConfig();

        Promise.all([this.fetchLastIndexTime(), this.getFolders(), this.getGroupsMap()]).finally(() => {
            this.loading = false;
        });
    }

    get config() {
        return this.radarPoCConfig.config;
    }

    handleSetConfigConfig = (status: boolean) => {
        this.showConfig = status;
    };

    fetchLastIndexTime = async () => {
        try {
            const data = await fetchLastIndexTime(this.config);
            const latest_timestamp = data?.latest_timestamp;
            if (latest_timestamp) {
                this.latestTimestamp = +latest_timestamp * 1000;
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    private _handleDataProcessing = async (fetchStartTime: any, processFunction: any, successMessage: string) => {
        this.loading = true;
        this.showConfig = false;

        try {
            const startTime = formatDate(fetchStartTime);
            const data = await fetchUserData(startTime, this.config);
            if (data.length >= 500) {
                showToast('Sorry, the data volume is too large, please reduce the data volume and try again.', 'error');
                return;
            }

            showToast('This is a time-consuming operation, please be patient.', 'info');
            const result = await processFunction(data, this.config);
            showToast(successMessage, 'success');
            
            if (result) {
                this.latestTimestamp = +result * 1000;
            }
            return result;
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
        }
    }

    // 优化后的handleInitialize函数
    handleInitialize = async () => {
        const recentDays = this.config.recentDays;
        const startTime = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000);

        await this._handleDataProcessing(
            startTime,
            indexing,
            'Initialization successful. You can use GraphRAG to generate a report or perform a custom query.'
        );
    }

    // 优化后的handleIncrement函数
    handleIncrement = async () => {
        await this._handleDataProcessing(
            this.latestTimestamp,
            increment,
            'Increment successful. You can use GraphRAG to generate a report or perform a custom query.'
        );
    }

    getFolders = async() => {
        try {
            this.folders = await getFolders() as [];
        } catch(err) {
            console.error('getFolders error', err.message);
            showToast(err.message, 'error');
        }
    }

    getGroupsMap = async() => {
        try {
            this.groupMaps = await getGroupsMap() as any;
        } catch(err) {
            console.error('getGroupsMap error', err.message);
            showToast(err.message, 'error');
        }
    }

    handleSaveConfig = () => {
        this.radarPoCConfig.saveConfig();
        showToast('Configuration saved successfully', 'success');
    };

    handleGenerateReport = async () => {
        this.loading = true;
        this.showConfig = false;

        try {
            const query = 'Important Topics I am Participated In';
            const [topics, questions] = await Promise.all([genTopics(this.config), customQuery(query, this.config)]);
            this._updateLists(topics);
            this.candidateQuestions = questions.candidate_questions.slice(0, 3);
            setLocalStorageItem(RADAR_POC_CANDIDATE_QUESTIONS, this.candidateQuestions);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
        }
    }

    handleGenerateGlobalSearchReport = async () => {
        this.loading = true;
        this.showConfig = false;

        try {
            const query = GET_INIT_TOPICS_QUERY(this.config.username);
            const { result, candidate_questions } = await globalQuery(query, this.config);
            this._updateLists(result);
            this.candidateQuestions = candidate_questions.slice(0, 3);
            setLocalStorageItem(RADAR_POC_CANDIDATE_QUESTIONS, this.candidateQuestions);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
        }
    }

    handleGenerateDisposeReport = async () => {
        this.loading = true;
        this.candidateQuestions = [];
        this.showConfig = false;

        try {
            // @ts-ignore
            const startTime = formatDate(new Date(Date.now() - this.config.recentDays * 24 * 60 * 60 * 1000))
            const data = await fetchUserData(startTime, this.config);
            const result = await fetchDifyServer(data, this.config);
            const answer = transformGroupLinks(transformPostLinks(result || 'LLM answer error'));
            this._updateLists(answer);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
        }
    }

    handleTrendingTopics = async () => {
        this.loading = true;
        this.showConfig = false;

        try {
            const query = 'trending topics';
            const [topics, questions] = await Promise.all([trendingTopics(this.config), customQuery(query, this.config)]);
            this._updateLists(topics);
            this.candidateQuestions = questions.candidate_questions.slice(0, 3);
            setLocalStorageItem(RADAR_POC_CANDIDATE_QUESTIONS, this.candidateQuestions);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
        }
    }

    private _executeQuery = async(query: string) => {
        this.loading = true;
        try {
            const data = await customQuery(query.trim(), this.config);
            const { result, candidate_questions } = data;
            this._updateLists(result);
            this.candidateQuestions = candidate_questions.slice(0, 3);
            setLocalStorageItem(RADAR_POC_CANDIDATE_QUESTIONS, this.candidateQuestions);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleSubmitQuery = async() => {
        await this._executeQuery(this.query);
        this.query = '';
    }

    handleDelete = async() => {
        const res = window.confirm('Once deleted, it cannot be recovered and can only be reinitialized. Are you sure you want to delete the Graph Indexing data?');
        if (!res) {
            return;
        }

        this.loading = true;
        try {
            await delete_indexing(this.config);
            this.latestTimestamp = undefined;
            showToast('Delete success.', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
        }
    }
    
    handleCandidateQuestions = async(query: string) => {
        await this._executeQuery(query);
    }

    handleClear = () => {
        this.lists = [];
        setLocalStorageItem(RADAR_POC_RESULT_LISTS, []);
        this.candidateQuestions = [];
        setLocalStorageItem(RADAR_POC_CANDIDATE_QUESTIONS, []);
    }

    private _updateLists = (text: string) => {
        if (this.groupMaps) {
            text = text.replace(/\[message:(\d+)\]/g, (match, id) => {
                // @ts-ignore
                const group = this.groupMaps[String(id)];
                if (group && group.name) {
                    return `[group:${group.name}](https://app.ringcentral.com/messages/${id})`;
                }
                return match; // 如果没有找到对应的组，保持原样
            });
        }

        this.lists.push({
            timestamp: Date.now(),
            text
        });
        const lists = this.lists.slice(-5);
        setLocalStorageItem(RADAR_POC_RESULT_LISTS, lists);
    }
}