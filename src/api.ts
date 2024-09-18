import { SERVER_HOST, API_PATH } from './constants';
import { IConfig } from './config';

export function fetchRadarPocServer(path: string, body: any) {
    const url = SERVER_HOST + path;
    return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        return data;
      })
}

export function genTopics(config: IConfig) {
    const { username, extensionId, model  } = config;
    const body = {
        username: username,
        extension_id: extensionId,
        model: model,
    };

    return fetchRadarPocServer(API_PATH.GEN_TOPICS, body);
}

export function trendingTopics(config: IConfig) {
  const { username, extensionId, model  } = config;
  const body = {
      username: username,
      extension_id: extensionId,
      model: model,
  };

  return fetchRadarPocServer(API_PATH.TRENDING_TOPICS, body);
}

export function customQuery(query: string, config: IConfig) {
    const { username, extensionId, model  } = config;

    const body = {
        username: username,
        extension_id: extensionId,
        model: model,
        query: query
    };

    return fetchRadarPocServer(API_PATH.QUERY, body);
}

export function fetchLastIndexTime(config: IConfig) {
    const { username, extensionId  } = config;

    const body = {
        username: username,
        extension_id: extensionId,
    };

    return fetchRadarPocServer(API_PATH.LATEST_INDEX_TIME, body);
}

export function indexing(data: any[], config: IConfig) {
  const { username, extensionId, model  } = config;

  if (!data || data.length === 0) {
      return Promise.reject(new Error('No data provided'));
  }

  const body = {
      username,
      extension_id: extensionId,
      model,
      data
  };

  return fetchRadarPocServer(API_PATH.INDEXING, body);
}

export function increment(data: any[], config: IConfig) {
  const { username, extensionId, model  } = config;

  if (!data || data.length === 0) {
      return Promise.reject(new Error('No data provided'));
  }

  const body = {
      username,
      extension_id: extensionId,
      model,
      data
  };

  return fetchRadarPocServer(API_PATH.INCREMENT, body);
}

export function delete_indexing(config: IConfig) {
  const { username, extensionId  } = config;

  const body = {
      username,
      extension_id: extensionId,
  };

  return fetchRadarPocServer(API_PATH.DELETE, body);
}

export function fetchDifyServer(query: string[], config: IConfig) {
  const url = 'https://lap2-api-dev.int.rclabenv.com/v1/completion-messages';
  const { username, apiKey  } = config;

  const data = {
    inputs: { query: JSON.stringify(query), username: username},
    response_mode: 'blocking',
    user: username
  };

  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(data => {
    return data.answer;
  })
  .catch(error => {
    return error.message || 'Https error'
  });
}