import { observable } from 'mobx';
import { increment, indexing, fetchLastIndexTime, genTopics, customQuery, fetchDifyServer } from './api';
import { formatDate, showToast, transformGroupLinks, transformPostLinks } from './utils';
import { RadarPoCConfig } from './config';
import { fetchUserData } from './metadata';
import { getFolders, getLocalStorageItem, setLocalStorageItem } from './storage';
import { CONFIG_LOCAL_STORAGE_KEY, RADAR_POC_RESULT_LISTS, RADAR_POC_CANDIDATE_QUESTIONS } from './constants';

export class ViewModel {
    @observable
    radarPoCConfig: RadarPoCConfig;

    @observable
    lists: { timestamp: number, text: string }[] = [];

    @observable
    latestTimestamp = 0;

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

    constructor() {
        this._init();
    }

    private _init() {
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
        this.fetchLastIndexTime();
        this.getFolders();
    }

    get config() {
        return this.radarPoCConfig.config;
    }

    handleSetConfigConfig = (status: boolean) => {
        this.showConfig = status;
    };

    fetchLastIndexTime = async () => {
        this.loading = true;
        try {
            const data = await fetchLastIndexTime(this.config);
            const latest_timestamp = data?.latest_timestamp;
            if (latest_timestamp) {
                this.latestTimestamp = +latest_timestamp * 1000;
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            this.loading = false;
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
        this.lists.push({
            timestamp: Date.now(),
            text
        });
        const lists = this.lists.slice(-5);
        setLocalStorageItem(RADAR_POC_RESULT_LISTS, lists);
    }
}