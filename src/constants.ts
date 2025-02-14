// export const SERVER_HOST = 'https://radar-poc.int.rclabenv.com:8443';
export const SERVER_HOST = 'http://localhost:6333';

export const API_PATH = {
    GEN_TOPICS: '/v1/gen/topics',
    QUERY: '/v1/query',
    GLOBAL_QUERY: '/v1/global_query',
    LATEST_INDEX_TIME: '/v1/fetch_latest_index_time',
    INDEXING: '/v1/indexing',
    INCREMENT: '/v1/update_indexing',
    DELETE: '/v1/delete',
    TRENDING_TOPICS: '/v1/trending/topics',
}

export const CONFIG_LOCAL_STORAGE_KEY = 'RADAR_POC_CONFIG';

export const RADAR_POC_RESULT_LISTS = 'RADAR_POC_RESULT_LISTS';

export const RADAR_POC_CANDIDATE_QUESTIONS = 'RADAR_POC_CANDIDATE_QUESTIONS';