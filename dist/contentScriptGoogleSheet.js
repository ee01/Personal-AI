/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/jira.ts":
/*!*********************!*\
  !*** ./src/jira.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FETCH_JIRA_TICKETS: () => (/* binding */ FETCH_JIRA_TICKETS),
/* harmony export */   fetchJiraTickets: () => (/* binding */ fetchJiraTickets)
/* harmony export */ });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "./src/utils.ts");


// 默认的 Jira 字段配置
const DEFAULT_JIRA_FIELDS = {
  'Key': 'key',
  'Summary': 'summary',
  'Status': 'status',
  'Assignee': 'assignee',
  'Reporter': 'reporter',
  'Priority': 'priority',
  'Created': 'created',
  'Updated': 'updated',
  'Due Date': 'duedate',
  'Description': 'description'
};

// 从 Jira 页面抓取数据
async function fetchJiraTickets(jql) {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(7);

    // 监听来自 background script 的消息
    const messageListener = message => {
      if (message.type === 'JIRA_TICKETS_RESULT' && message.requestId === requestId) {
        chrome.runtime.onMessage.removeListener(messageListener);
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.tickets);
        }
      }
      return true;
    };
    chrome.runtime.onMessage.addListener(messageListener);

    // 发送消息给 background script 来创建新标签页
    chrome.runtime.sendMessage({
      type: 'FETCH_JIRA_TICKETS',
      jql,
      requestId
    });
  });
}

// 然后在 FETCH_JIRA_TICKETS 函数中使用 sourceTabId
async function FETCH_JIRA_TICKETS(jql, requestId, sourceTabId) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_0__.getEnvConfig)();
  const url = `${envConfig.JIRA_BASE_URL}/issues/?jql=${encodeURIComponent(jql)}`;

  // 创建新标签页
  chrome.tabs.create({
    url,
    active: false
  }, tab => {
    if (!tab.id) {
      chrome.tabs.sendMessage(sourceTabId, {
        type: 'JIRA_TICKETS_RESULT',
        requestId,
        error: '无法创建标签页'
      });
      return;
    }

    // 等待页面加载完成
    const checkPageLoad = () => {
      chrome.tabs.get(tab.id, updatedTab => {
        if (updatedTab.status === 'complete') {
          if (updatedTab.url.includes('login') || updatedTab.url.includes('okta')) {
            chrome.tabs.sendMessage(sourceTabId, {
              type: 'JIRA_TICKETS_RESULT',
              requestId,
              error: 'jira 需要登录，请登录后重新尝试'
            });
            setTimeout(() => chrome.tabs.update(tab.id, {
              active: true
            }), 3000);
            return;
          }
          // 注入内容脚本
          chrome.scripting.executeScript({
            target: {
              tabId: tab.id
            },
            func: () => {
              const tickets = [];

              // 判断是否是Jira Cloud版本，通过检查特定的DOM元素判断
              const isJiraCloud = !!document.querySelector('table[data-vc="issue-table"]') || !!document.querySelector('table[aria-label="Work"]');
              if (isJiraCloud) {
                // Jira Cloud 版本的选择器
                const rows = document.querySelectorAll('tr[data-testid="native-issue-table.ui.issue-row"]');
                if (rows && rows.length > 0) {
                  rows.forEach(row => {
                    // 获取key - a[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]
                    const keyElement = row.querySelector('a[data-testid="native-issue-table.common.ui.issue-cells.issue-key.issue-key-cell"]');

                    // 获取summary - a[data-testid="native-issue-table.common.ui.issue-cells.issue-summary.issue-summary-cell"]
                    const summaryElement = row.querySelector('a[data-testid="native-issue-table.common.ui.issue-cells.issue-summary.issue-summary-cell"]');

                    // 获取status - 状态位于有特定class的span中
                    const statusContainer = row.querySelector('div[data-testid^="issue.fields.status.common.ui.status-lozenge"]');
                    const statusElement = statusContainer ? statusContainer.querySelector('div._4cvr1h6o') : null;

                    // 经办人、报告人和优先级通常位于相应的单元格中
                    const cells = row.querySelectorAll('td');
                    let assignee = '',
                      reporter = '',
                      priority = '',
                      created = '',
                      updated = '',
                      duedate = '';

                    // 通过位置判断各个字段
                    if (cells.length >= 11) {
                      // 优先尝试从特定的span中获取assignee信息，避免获取重复文本
                      const assigneeSpan = cells[4].querySelector('._1reo15vq._18m915vq._o5721q9c._1bto1l2s > span');
                      let assigneeText = '';
                      if (assigneeSpan) {
                        assigneeText = assigneeSpan.textContent?.trim() || '';
                      } else {
                        // 如果找不到特定元素，则获取整个单元格文本并进行处理去重
                        assigneeText = cells[4].textContent?.trim() || '';
                        // 处理可能的重复文本，如"EsoneEsone"
                        if (assigneeText && assigneeText.length > 2) {
                          // 正则表达式寻找连续重复的相同名称并去重
                          const match = assigneeText.match(/^(.+?)\1+$/);
                          if (match) {
                            assigneeText = match[1];
                          } else {
                            // 检查文本是否有"Unassigned"字样
                            if (assigneeText.includes('Unassigned')) {
                              assigneeText = 'Unassigned';
                            }
                          }
                        }
                      }

                      // 如果是"Unassigned"则设为空
                      assignee = assigneeText !== 'Unassigned' ? assigneeText : '';

                      // 优先尝试从特定的span中获取reporter信息
                      const reporterSpan = cells[5].querySelector('._1reo15vq._18m915vq._o5721q9c._1bto1l2s > span');
                      let reporterText = '';
                      if (reporterSpan) {
                        reporterText = reporterSpan.textContent?.trim() || '';
                      } else {
                        // 如果找不到特定元素，则获取整个单元格文本并进行处理去重
                        reporterText = cells[5].textContent?.trim() || '';
                        // 处理可能的重复文本
                        if (reporterText && reporterText.length > 2) {
                          const match = reporterText.match(/^(.+?)\1+$/);
                          if (match) {
                            reporterText = match[1];
                          }
                        }
                      }
                      reporter = reporterText;

                      // 优先尝试从特定的span中获取priority信息
                      const prioritySpan = cells[6].querySelector('._1reo15vq._18m915vq._18u0u2gc._1bto1l2s._o5721q9c');
                      priority = prioritySpan ? prioritySpan.textContent?.trim() || '' : cells[6].textContent?.trim() || '';

                      // 假设第9个单元格是created
                      created = cells[8].textContent?.trim() || '';

                      // 假设第10个单元格是updated
                      updated = cells[9].textContent?.trim() || '';

                      // 假设第11个单元格是duedate
                      const dueDateText = cells[10].textContent?.trim();
                      duedate = dueDateText !== 'None' ? dueDateText || '' : '';
                    }
                    const ticket = {
                      key: keyElement ? keyElement.textContent?.trim() || '' : '',
                      summary: summaryElement ? summaryElement.textContent?.trim() || '' : '',
                      status: statusElement ? statusElement.textContent?.trim() || '' : '',
                      assignee,
                      reporter,
                      priority,
                      created,
                      updated,
                      duedate,
                      description: '' // Cloud视图中通常不显示描述
                    };
                    tickets.push(ticket);
                  });
                }
              } else {
                // 原有的 Jira On-Premise 版本的选择器
                const rows = document.querySelectorAll('tr.issuerow');
                rows.forEach(row => {
                  const ticket = {
                    key: row.querySelector('.issuekey')?.textContent?.trim() || '',
                    summary: row.querySelector('.summary')?.textContent?.trim() || '',
                    status: row.querySelector('.status')?.textContent?.trim() || '',
                    assignee: row.querySelector('.assignee')?.textContent?.trim() || '',
                    reporter: row.querySelector('.reporter')?.textContent?.trim() || '',
                    priority: row.querySelector('.priority')?.textContent?.trim() || '',
                    created: row.querySelector('.created')?.textContent?.trim() || '',
                    updated: row.querySelector('.updated')?.textContent?.trim() || '',
                    duedate: row.querySelector('.duedate')?.textContent?.trim() || '',
                    description: row.querySelector('.description')?.textContent?.trim() || ''
                  };
                  tickets.push(ticket);
                });
              }
              return tickets;
            }
          }, results => {
            // 处理结果
            if (results && results[0] && results[0].result) {
              // 对summary字段进行额外处理，确保干净的文本
              results[0].result = results[0].result.map(ticket => ({
                ...ticket,
                summary: ticket.summary.split('\n').map(s => s.trim()).filter(Boolean).pop() || ticket.summary
              }));
              chrome.tabs.sendMessage(sourceTabId, {
                type: 'JIRA_TICKETS_RESULT',
                requestId,
                tickets: results[0].result
              });
            } else {
              // 如果没有结果
              chrome.tabs.sendMessage(sourceTabId, {
                type: 'JIRA_TICKETS_RESULT',
                requestId,
                tickets: []
              });
            }

            // 关闭 Jira 标签页
            chrome.tabs.remove(tab.id);
          });
        } else {
          setTimeout(checkPageLoad, 100);
        }
      });
    };
    checkPageLoad();
  });
}

/***/ }),

/***/ "./src/sheet.ts":
/*!**********************!*\
  !*** ./src/sheet.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Sheet: () => (/* binding */ Sheet)
/* harmony export */ });
class Sheet {
  constructor(url, token) {
    this.token = token;
    this.sheetId = this.extractSheetId(url);
    this.gid = this.extractGid(url);
  }
  async init() {
    if (!this.token) this.token = await this.getToken();
    this.sheetName = await this.getSheetNameByGid(this.token, this.sheetId, this.gid);
  }
  async getToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({
        interactive: true
      }, token => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);else resolve(token);
      });
    });
  }
  extractSheetId(url) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }
  extractGid(url) {
    const match = url.match(/[#&]gid=([0-9]+)/);
    return match ? match[1] : null;
  }
  async getSheetNames(token, sheetId) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const json = await res.json();
    return json.sheets;
  }
  async getSheetNameByGid(token, sheetId, gid) {
    const sheets = await this.getSheetNames(token, sheetId);
    const sheet = sheets.find(s => s.properties.sheetId.toString() === gid);
    return sheet ? sheet.properties.title : sheets[0].properties.title; // 如果找不到对应的gid,返回第一个sheet的名称
  }
  async readSheet() {
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}`;
    const res = await fetch(sheetUrl, {
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });
    const json = await res.json();
    return json.values;
  }
  async writeSheet(values) {
    let position = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'A1';
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}!${position}?valueInputOption=USER_ENTERED`;
    const res = await fetch(sheetUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values
      })
    });
    return res.json();
  }

  // 插入行或列
  async insertDimension(dimension, startIndex, endIndex) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}:batchUpdate`;
    const request = {
      requests: [{
        insertDimension: {
          range: {
            sheetId: parseInt(this.gid),
            dimension,
            startIndex,
            endIndex
          },
          inheritFromBefore: true
        }
      }, {
        addDimensionGroup: {
          range: {
            sheetId: parseInt(this.gid),
            dimension,
            startIndex,
            endIndex
          }
        }
      }]
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(`插入维度失败: ${error.error?.message || '未知错误'}`);
    }
  }

  /**
   * 读取配置表数据
   * @param sheetName 配置表名称
   * @returns 配置表数据
   */
  async readConfigSheet() {
    let configSheetName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    if (!configSheetName) configSheetName = this.sheetName + '_config';
    try {
      const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${configSheetName}`;
      const res = await fetch(sheetUrl, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      const json = await res.json();
      return json.values;
    } catch (error) {
      console.error('读取配置表失败:', error);
      throw error;
    }
  }

  /**
   * 获取表格的第一行作为表头
   * @returns 表头数组
   */
  async getHeaders() {
    const values = await this.readSheet();
    if (!values || values.length === 0) {
      throw new Error('表格为空');
    }
    return values[0];
  }
  getSheetName() {
    return this.sheetName;
  }
}

/***/ }),

/***/ "./src/storage.ts":
/*!************************!*\
  !*** ./src/storage.ts ***!
  \************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   getCurrentUserInfo: () => (/* binding */ getCurrentUserInfo),
/* harmony export */   getFolders: () => (/* binding */ getFolders),
/* harmony export */   getGroupsMap: () => (/* binding */ getGroupsMap),
/* harmony export */   getIndexedDBData: () => (/* binding */ getIndexedDBData),
/* harmony export */   getLocalStorageItem: () => (/* binding */ getLocalStorageItem),
/* harmony export */   setLocalStorageItem: () => (/* binding */ setLocalStorageItem)
/* harmony export */ });
function getIndexedDBData(databaseName, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction([storeName], 'readonly');
      const objectStore = transaction.objectStore(storeName);
      const dataRequest = objectStore.getAll();
      dataRequest.onsuccess = event => {
        resolve(event.target.result);
      };
      dataRequest.onerror = event => {
        reject(event.target.error);
      };
    };
    request.onerror = event => {
      reject(event.target.error);
    };
  });
}
const getLocalStorageItem = (key, defaultValue) => {
  return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultValue));
};
const setLocalStorageItem = (key, defaultValue) => {
  localStorage.setItem(key, JSON.stringify(defaultValue));
};
function getCurrentUserInfo() {
  const {
    extension: extensionId
  } = getLocalStorageItem('ownExtension', {});
  const username = getLocalStorageItem('displayName', 'radar-poc');
  return {
    extensionId,
    username
  };
}
function getFolders() {
  return getIndexedDBData('Glip', 'profile').then(_ref => {
    let [data] = _ref;
    const favorite_group_ids = data?.favorite_group_ids || [];
    const conversation_sets = data?.conversation_sets || [];
    // @ts-ignore
    const folders = [{
      title: ' ',
      ids: []
    }, {
      title: 'favorite',
      ids: favorite_group_ids
    }, ...conversation_sets.filter(item => item.type === 'folder')];
    return folders;
  }).catch(error => {
    console.log(error);
  });
}
function getGroupsMap() {
  return getIndexedDBData('Glip', 'group').then(groups => {
    const groupsMap = groups.reduce((acc, group) => {
      acc[group.id] = {
        name: group.set_abbreviation,
        is_team: group.is_team
      };
      return acc;
    }, {});
    return groupsMap;
  });
}

/***/ }),

/***/ "./src/utils.ts":
/*!**********************!*\
  !*** ./src/utils.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   defaultEnvConfig: () => (/* binding */ defaultEnvConfig),
/* harmony export */   formatDate: () => (/* binding */ formatDate),
/* harmony export */   getEnvConfig: () => (/* binding */ getEnvConfig),
/* harmony export */   getUserInfo: () => (/* binding */ getUserInfo),
/* harmony export */   showToast: () => (/* binding */ showToast),
/* harmony export */   transformGroupLinks: () => (/* binding */ transformGroupLinks),
/* harmony export */   transformPostLinks: () => (/* binding */ transformPostLinks),
/* harmony export */   uniqBy: () => (/* binding */ uniqBy)
/* harmony export */ });
/* harmony import */ var _storage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./storage */ "./src/storage.ts");


// 环境配置类型定义

function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function uniqBy(array, key) {
  const seen = new Set();
  return array.filter(item => {
    const keyValue = item[key];
    if (seen.has(keyValue)) {
      return false;
    }
    seen.add(keyValue);
    return true;
  });
}
function showToast(message, type, onClose) {
  // 获取或创建容器元素
  const container = document.getElementById('radar-poc-result');
  if (!container) return;

  // 移除现有的 Toast 元素
  const existingToast = container.querySelector('.radar-poc-toast');
  if (existingToast) {
    container.removeChild(existingToast);
  }

  // 创建新的 Toast 元素
  const toast = document.createElement('div');
  toast.className = `radar-poc-toast radar-poc-toast-${type}`;
  const toastInner = document.createElement('div');
  toastInner.className = 'radar-poc-toast-inner';
  toastInner.textContent = message;
  toast.appendChild(toastInner);
  container.appendChild(toast);

  // 设置定时器在 3 秒后关闭 Toast
  const timer = setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  }, 3000);

  // 返回一个函数以便手动关闭 Toast
  return () => {
    clearTimeout(timer);
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
    if (onClose) {
      onClose();
    }
  };
}
function transformGroupLinks(inputString) {
  const groupLinkPattern = /\[group:(.+):(\d+)\]/g;
  const transformedString = inputString.replace(groupLinkPattern, (match, groupName, groupId) => {
    return `[${groupName}](/messages/${groupId})`;
  });
  return transformedString;
}
function transformPostLinks(inputString) {
  const postLinkPattern = /\[post:(\d+)\]/g;
  let index = 1;
  const transformedString = inputString.replace(postLinkPattern, (match, postId) => {
    return `[[${index++}]](/l${window.location.pathname}/${postId})`;
  });
  return transformedString;
}

// 默认环境配置
const defaultEnvConfig = {
  SCHEDULED_INTERVAL: Number("180") || 120,
  ANALYSIS_TYPE: "agentThinking" || 0,
  LLM_TYPE: "dify" || 0,
  ANALYZE_BY_GROUP: "false" === "true",
  OLLAMA_BASE_URL: "http://localhost:11434" || 0,
  OLLAMA_MODEL: "deepseek-r1" || 0,
  OLLAMA_REVIEW_MODEL: "llama3.1" || 0,
  OLLAMA_QUERY_MODEL: "llama3.1" || 0,
  DIFY_API_KEY: "" || 0,
  DIFY_REVIEW_API_KEY: "app-EQhkmjfMxIiyWWbMj9vz5vM9" || 0,
  DIFY_API_BASE_URL: "https://lap2-api-dev.int.rclabenv.com/v1" || 0,
  OPENAI_API_KEY:  false || "",
  OPENAI_MODEL: "deepseek-ai/deepseek-r1" || 0,
  OPENAI_REVIEW_MODEL: "deepseek-ai/deepseek-r1" || 0,
  OPENAI_API_BASE_URL: "https://integrate.api.nvidia.com/v1" || 0,
  GROQ_API_KEY:  false || "",
  GROQ_MODEL: "llama-3.3-70b-versatile" || 0,
  GROQ_REVIEW_MODEL: "llama-3.1" || 0,
  BOT_API_BASE_URL: "https://botman.int.rclabenv.com/v2" || 0,
  BOT_TOKEN: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImVzb25lLnFpdUByaW5nY2VudHJhbC5jb20iLCJzZXJ2aWNlIjoiU01fYm90LnNlcnZpY2UiLCJyb2xlIjoiUk9MRV9VU0VSIiwiaWF0IjoxNzM5OTQyMjUyLCJleHAiOjIwNTUzMDIyNTJ9.ieSb3zGIwVhUTqZpkgJipK8ktH4FVJr3vDF0kyQ-4DI" || 0,
  BOT_ID: "4700372020@37439510.bot.glip.net" || 0,
  BOT_TYPE: "user" || 0,
  TEAM_ID: "1497300893698" || 0,
  ENABLE_BOT: "true" === "true",
  LLM_REVIEW_BEFORE_SEND: "true" === "true",
  ENABLE_CHROMA: "true" === "true",
  CHROMA_API_URL: "http://10.32.56.212:8000" || 0,
  CHROMA_PORT: Number("8000") || 8000,
  CHROMA_COLLECTION_NAME:  false || "",
  JIRA_BASE_URL: "https://jira.ringcentral.com" || 0,
  JIRA_USERNAME: "esone.qiu@ringcentral.com" || 0,
  JIRA_API_TOKEN:  false || ""
};

// 获取环境配置，如果可能的话从 storage 获取，否则从 process.env 获取
async function getEnvConfig() {
  try {
    const {
      envConfig
    } = await chrome.storage.local.get(['envConfig']);
    if (envConfig) {
      // 将存储的配置与默认配置合并，确保新增的配置项也会被包含
      return {
        ...defaultEnvConfig,
        ...envConfig
      };
    }
  } catch (error) {
    console.error('获取配置失败:', error);
  }

  // 如果获取失败或没有保存的配置，返回默认值
  return defaultEnvConfig;
}
function getUserInfo() {
  const accountUD = (0,_storage__WEBPACK_IMPORTED_MODULE_0__.getLocalStorageItem)('global.account.UD', '');
  const accountInfoList = (0,_storage__WEBPACK_IMPORTED_MODULE_0__.getLocalStorageItem)('global.account.ACCOUNT_SESSION_DATA_LIST', {});
  const accountInfo = accountUD ? accountInfoList[accountUD] : accountInfoList.find(item => item.displayName != '');
  console.log('accountInfoList', accountInfoList, accountInfo);
  if (accountInfo) return {
    extensionId: accountInfo.extensionId,
    email: accountInfo.email,
    fullName: accountInfo.displayName,
    username: accountInfo.email ? accountInfo.email.trim().split('@')[0] : accountInfo.displayName.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '')
  };
  const userInfo = (0,_storage__WEBPACK_IMPORTED_MODULE_0__.getCurrentUserInfo)();
  return {
    extensionId: userInfo.extensionId,
    fullName: userInfo.username,
    username: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
    email: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '') + '@ringcentral.com'
  };
}

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
/*!******************************************!*\
  !*** ./src/contentScriptGoogleSheet.tsx ***!
  \******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _jira__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./jira */ "./src/jira.ts");
/* harmony import */ var _sheet__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./sheet */ "./src/sheet.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils */ "./src/utils.ts");




// 全局变量
let url = null;
let sheetToken = null;

// Main listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message, '发送者:', sender);
  if (!message || !message.type) {
    console.warn('收到无效消息格式');
    sendResponse({
      success: false,
      error: '无效消息格式'
    });
    return true;
  }
  const {
    type
  } = message;
  if (type === 'OPEN_JIRA_QUERY_DIALOG') {
    openJqlDialog(message.url, message.sheetToken);
    url = message.url;
    sheetToken = message.sheetToken;
    sendResponse({
      success: true
    });
  } else if (type === 'EXPAND_EPIC_TICKETS') {
    if (!message.url || !message.sheetToken) {
      console.error('EXPAND_EPIC_TICKETS 缺少 url 或 sheetToken');
      showToast('缺少必要参数', 'error');
      sendResponse({
        success: false,
        error: '缺少必要参数'
      });
    } else {
      handleExpandEpicTickets(message.url, message.sheetToken).then(() => sendResponse({
        success: true
      })).catch(error => {
        console.error('处理 EXPAND_EPIC_TICKETS 时出错:', error);
        showToast(`展开 Epic 失败: ${error.message || error}`, 'error');
        sendResponse({
          success: false,
          error: error.message || String(error)
        });
      });
    }
  } else {
    console.log('未处理的消息类型:', type);
  }
  return true;
});

// 创建 JQL 查询对话框
async function openJqlDialog(url, sheetToken) {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  const dialog = document.createElement('div');
  dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 10000;
        width: 400px;
    `;
  dialog.innerHTML = `
        <h3 style="margin-top: 0;">输入 JQL 查询</h3>
        <textarea id="jql" style="width: 100%; height: 100px; margin-bottom: 10px;"></textarea>
        <div style="display: flex; justify-content: flex-end;">
            <button id="cancel" style="margin-right: 10px;">取消</button>
            <button id="submit">查询</button>
        </div>
    `;
  document.body.appendChild(dialog);

  // 添加事件监听器
  document.getElementById('cancel')?.addEventListener('click', () => {
    if (document.body.contains(dialog)) {
      document.body.removeChild(dialog);
    }
  });
  document.getElementById('submit')?.addEventListener('click', async () => {
    const jql = document.getElementById('jql').value;
    if (jql) {
      try {
        showToast('正在查询 Jira...');
        const tickets = await (0,_jira__WEBPACK_IMPORTED_MODULE_0__.fetchJiraTickets)(jql);
        console.log('tickets', tickets);
        if (!tickets.length) {
          showToast('没有找到数据', 'warning');
          if (document.body.contains(dialog)) document.body.removeChild(dialog);
          return;
        }
        if (!sheetToken) {
          // 剪切板模式
          const headers = ['key', 'summary', 'status', 'assignee', 'reporter'];
          const formattedData = [headers.join('\t'), ...tickets.map(ticket => ({
            ...ticket,
            key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
          })).map(ticket => headers.map(field => ticket[field] || '').join('\t'))].join('\n');
          await navigator.clipboard.writeText(formattedData);
          console.log('formattedData', formattedData);
          showToast('Jira 数据已复制到剪贴板', 'success');
        } else {
          // 接口模式
          if (!url) {
            showToast('缺少表格 URL', 'error');
            return;
          }
          const sheet = new _sheet__WEBPACK_IMPORTED_MODULE_1__.Sheet(url, sheetToken);
          try {
            await sheet.init();
            const values = await sheet.readSheet();
            console.log('values', values);
            const sheetHeaders = await findValidJiraHeaders(sheet);
            const displayHeaders = ['key', 'summary', 'status', 'assignee', 'reporter'];
            const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
            if (keyColumnIndex === -1) {
              const inferredKeyIndex = values[0]?.findIndex(header => header.toLowerCase().includes('key') || header.toLowerCase().includes('jira'));
              if (inferredKeyIndex !== -1 && inferredKeyIndex !== undefined) {
                sheetHeaders.key = String.fromCharCode(65 + inferredKeyIndex);
                console.warn(`未在配置中找到 Key 列，已推断为列 ${sheetHeaders.key}`);
              } else {
                throw new Error('未找到或无法推断 Jira Key 列，请检查表头或配置');
              }
            }
            const keyToRowMap = new Map();
            values.slice(1).forEach((row, index) => {
              const keyCell = row[getColumnIndex(sheetHeaders.key)];
              let key = '';
              if (keyCell) {
                const match = keyCell.match(/browse\/([A-Z0-9]+-[0-9]+)/i);
                if (match && match[1]) {
                  key = match[1];
                } else if (/^[A-Z0-9]+-[0-9]+$/i.test(keyCell.trim())) {
                  key = keyCell.trim();
                }
              }
              if (key) {
                keyToRowMap.set(key, index + 1);
              }
            });
            const operations = tickets.map(ticket => {
              const existingRowIndex = keyToRowMap.get(ticket.key);
              return {
                ticket,
                type: existingRowIndex !== undefined ? 'update' : 'append',
                rowIndex: existingRowIndex
              };
            });
            const confirmedOperations = await showConfirmationDialog(operations, displayHeaders, sheetHeaders);
            if (confirmedOperations.length === 0) {
              showToast('操作已取消');
              if (document.body.contains(dialog)) document.body.removeChild(dialog);
              return;
            }
            const updatesData = [];
            const appendData = [];
            const headerValues = Object.values(sheetHeaders).filter(value => typeof value === 'string' && value.length > 0);
            const maxColIndex = getMaxColumnIndex(headerValues);
            confirmedOperations.forEach(operation => {
              const row = new Array(maxColIndex).fill('');
              displayHeaders.forEach(field => {
                const columnLetter = sheetHeaders[field];
                if (columnLetter && typeof columnLetter === 'string') {
                  try {
                    const colIndex = getColumnIndex(columnLetter);
                    if (field === 'key') {
                      row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${operation.ticket.key}", "${operation.ticket.key}")`;
                    } else {
                      row[colIndex] = operation.ticket[field] || '';
                    }
                  } catch (error) {
                    console.error(`处理列 ${columnLetter} (字段 ${field}) 时出错:`, error);
                  }
                }
              });
              if (operation.type === 'update' && operation.rowIndex !== undefined) {
                updatesData.push({
                  rowIndex: operation.rowIndex,
                  data: row
                });
              } else {
                appendData.push(row);
              }
            });
            console.log('更新数据:', updatesData);
            console.log('追加数据:', appendData);
            let updatedCount = 0;
            let appendedCount = 0;
            if (updatesData.length > 0) {
              for (const update of updatesData) {
                const startColumn = 'A';
                const range = `${startColumn}${update.rowIndex}`;
                console.log(`Updating range: ${range}`, update.data);
                await sheet.writeSheet([update.data], range);
                updatedCount++;
              }
            }
            if (appendData.length > 0) {
              const startPosition = `A${values.length + 1}`;
              console.log(`Appending data starting from: ${startPosition}`, appendData);
              await sheet.writeSheet(appendData, startPosition);
              appendedCount = appendData.length;
            }
            let toastMessage = '';
            if (updatedCount > 0) toastMessage += `已更新 ${updatedCount} 条数据。`;
            if (appendedCount > 0) toastMessage += `已追加 ${appendedCount} 条新数据。`;
            if (toastMessage === '') toastMessage = '没有需要更新或追加的数据。';
            showToast(toastMessage.trim(), 'success');
          } catch (error) {
            console.error('Google Sheets 操作失败:', error);
            showToast('Google Sheets 操作失败: ' + (error instanceof Error ? error.message : error), 'error');
          }
        }
        if (document.body.contains(dialog)) {
          document.body.removeChild(dialog);
        }
      } catch (error) {
        console.error('查询或处理失败: ', error);
        showToast('查询或处理失败: ' + (error instanceof Error ? error.message : error), 'error');
        if (document.body.contains(dialog)) document.body.removeChild(dialog);
      }
    } else {
      showToast('请输入 JQL 查询语句', 'warning');
    }
  });
}
// 查找有效的Jira字段表头
async function findValidJiraHeaders(sheet) {
  try {
    let headerMapping = {};
    const customFieldMapping = {};
    try {
      const configData = await sheet.readConfigSheet();
      console.log('configData', configData);
      if (configData && configData.length >= 2) {
        const sheetHeaderIndex = configData[0].findIndex(h => h.toLowerCase().includes('sheet header'));
        const jiraFieldIndex = configData[0].findIndex(h => h.toLowerCase().includes('jira field'));
        if (sheetHeaderIndex === -1 || jiraFieldIndex === -1) {
          console.warn('配置表中未找到 "Sheet Header" 或 "Jira Field" 列，将使用默认别名');
          throw new Error('Invalid config sheet headers');
        }
        for (let i = 1; i < configData.length; i++) {
          const row = configData[i];
          if (row.length > Math.max(sheetHeaderIndex, jiraFieldIndex)) {
            const sheetHeader = row[sheetHeaderIndex]?.trim().toLowerCase();
            let jiraField = row[jiraFieldIndex]?.trim();
            if (sheetHeader && jiraField) {
              if (jiraField.toLowerCase() === 'jira key' || jiraField.toLowerCase() === 'key') {
                jiraField = 'key';
              }
              headerMapping[sheetHeader] = jiraField;
              if (jiraField.toLowerCase().startsWith('customfield_')) {
                customFieldMapping[sheetHeader] = jiraField;
              }
            }
          }
        }
        console.log('从配置表加载的映射:', headerMapping);
      } else {
        console.warn('配置表数据为空或格式不正确，将使用默认别名');
        throw new Error('配置表数据为空或格式不正确');
      }
    } catch (error) {
      console.warn('读取配置表失败，将使用默认字段别名:', error);
      headerMapping = {
        'key': 'key',
        'jira': 'key',
        'jira key': 'key',
        'jira link': 'key',
        'jira id': 'key',
        'id': 'key',
        'issue key': 'key',
        'summary': 'summary',
        'title': 'summary',
        '概要': 'summary',
        'description': 'description',
        '描述': 'description',
        'type': 'issuetype',
        'issue type': 'issuetype',
        '类型': 'issuetype',
        'priority': 'priority',
        '优先级': 'priority',
        'assignee': 'assignee',
        '经办人': 'assignee',
        'reporter': 'reporter',
        '报告人': 'reporter',
        'status': 'status',
        '状态': 'status',
        'labels': 'labels',
        'label': 'labels',
        '标签': 'labels',
        'components': 'components',
        'component': 'components',
        '模块': 'components',
        'fix versions': 'fixVersions',
        'fix version': 'fixVersions',
        '修复版本': 'fixVersions',
        'affects versions': 'affectsVersions',
        'affect version': 'affectsVersions',
        '影响版本': 'affectsVersions',
        'linked issues': 'linkedIssues',
        '关联问题': 'linkedIssues',
        'epic link': 'epicLink',
        'epic': 'epicLink',
        'sprint': 'sprint',
        '冲刺': 'sprint',
        'story points': 'storyPoints',
        'story point': 'storyPoints',
        '故事点': 'storyPoints'
      };
    }
    const headers = await sheet.getHeaders();
    console.log('Sheet Headers:', headers);
    const validHeaders = {};
    const knownFields = ['key', 'summary', 'description', 'issuetype', 'priority', 'assignee', 'reporter', 'status', 'labels', 'components', 'fixVersions', 'affectsVersions', 'linkedIssues', 'epicLink', 'sprint', 'storyPoints'];
    headers.forEach((header, index) => {
      if (!header) return;
      const headerLower = header.trim().toLowerCase();
      const columnLetter = String.fromCharCode(65 + index);
      if (headerMapping[headerLower]) {
        const jiraField = headerMapping[headerLower];
        if (!validHeaders[jiraField]) {
          validHeaders[jiraField] = columnLetter;
          console.log(`配置/别名匹配: "${header}" -> "${jiraField}" (列 ${columnLetter})`);
        } else {
          console.warn(`列 ${columnLetter} ("${header}") 的别名 "${headerLower}" 与列 ${validHeaders[jiraField]} 冲突，都指向 "${jiraField}"。将使用第一个匹配。`);
        }
        return;
      }
      const directMatch = knownFields.find(field => field.toLowerCase() === headerLower);
      if (directMatch) {
        if (!validHeaders[directMatch]) {
          validHeaders[directMatch] = columnLetter;
          console.log(`直接字段名匹配: "${header}" -> "${directMatch}" (列 ${columnLetter})`);
        } else {
          console.warn(`列 ${columnLetter} ("${header}") 的直接匹配与列 ${validHeaders[directMatch]} 冲突，都指向 "${directMatch}"。将使用第一个匹配。`);
        }
        return;
      }
    });
    if (!validHeaders.key) {
      console.warn("未能自动映射 'key' 列。请检查表头或在配置表中明确指定 'key' 或 'Jira Key'。");
    }
    console.log('最终有效表头映射:', validHeaders);
    return validHeaders;
  } catch (error) {
    console.error('查找有效 Jira 标题时出错:', error);
    showToast('查找表头映射时出错: ' + (error instanceof Error ? error.message : error), 'error');
    throw error;
  }
}
function getColumnIndex(column) {
  if (!column || typeof column !== 'string' || !/^[A-Z]+$/.test(column.toUpperCase())) {
    throw new Error(`无效的列标识符: "${column}"`);
  }
  const upperColumn = column.toUpperCase();
  let index = 0;
  for (let i = 0; i < upperColumn.length; i++) {
    index = index * 26 + (upperColumn.charCodeAt(i) - 64);
  }
  return index - 1;
}
function getMaxColumnIndex(columnLetters) {
  if (!columnLetters || !Array.isArray(columnLetters) || columnLetters.length === 0) {
    return 0;
  }
  const validLetters = columnLetters.filter(h => typeof h === 'string' && /^[A-Z]+$/.test(h.toUpperCase()));
  if (validLetters.length === 0) {
    return 0;
  }
  const indices = validLetters.map(col => getColumnIndex(col));
  return Math.max(...indices) + 1;
}

// 显示确认弹窗
async function showConfirmationDialog(operations, displayHeaders, sheetHeaders) {
  return new Promise(resolve => {
    const dialog = document.createElement('div');
    dialog.id = 'jiraConfirmationDialog';
    dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10001;
            width: 800px;
            max-width: 90vw;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;
    const columnsToUpdate = displayHeaders.filter(field => sheetHeaders[field]).map(field => field);
    const updateCount = operations.filter(op => op.type === 'update').length;
    const appendCount = operations.filter(op => op.type === 'append').length;
    dialog.innerHTML = `
            <h3 style="margin-top: 0; flex-shrink: 0;">确认数据操作</h3>
            <div style="margin-bottom: 15px; flex-shrink: 0;">
                <div style="margin-bottom: 10px;">
                    <strong>将要操作的列：</strong> 
                    <span style="color: #666;">${columnsToUpdate.join(', ')}</span>
                </div>
                <div style="color: #666;">
                    <div>更新现有数据：${updateCount} 条</div>
                    <div>新增数据：${appendCount} 条</div>
                </div>
            </div>
            <div style="margin-bottom: 10px; flex-shrink: 0;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="selectAllTickets" checked style="margin-right: 5px;">
                    全选/取消全选
                </label>
            </div>
             <div style="flex-grow: 1; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; margin-bottom: 15px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
                        <tr>
                            <th style="padding: 8px; text-align: left; width: 50px;">选择</th>
                            <th style="padding: 8px; text-align: left; width: 80px;">操作</th>
                            ${displayHeaders.map(header => `<th style="padding: 8px; text-align: left;">${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${operations.map((op, index) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 8px;">
                                    <input type="checkbox" class="ticket-checkbox" data-index="${index}" checked>
                                </td>
                                <td style="padding: 8px;">
                                    <span style="color: ${op.type === 'update' ? '#f0ad4e' : '#5cb85c'}; font-weight: bold;">
                                        ${op.type === 'update' ? '更新' : '新增'}
                                    </span>
                                </td>
                                ${displayHeaders.map(field => {
      let value = op.ticket[field] || '';
      if (value.length > 100) value = value.substring(0, 97) + '...';
      return `<td style="padding: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${op.ticket[field] || ''}">${value}</td>`;
    }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                <button id="cancelOperation" style="padding: 6px 12px; background: #eee; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">取消</button>
                <button id="confirmOperation" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">确认 (${operations.length})</button> 
            </div>
        `;
    document.body.appendChild(dialog);
    const selectAllCheckbox = document.getElementById('selectAllTickets');
    const ticketCheckboxes = dialog.getElementsByClassName('ticket-checkbox');
    const confirmButton = document.getElementById('confirmOperation');
    const updateConfirmButtonCount = () => {
      const selectedCount = Array.from(ticketCheckboxes).filter(cb => cb.checked).length;
      confirmButton.textContent = `确认 (${selectedCount})`;
      confirmButton.disabled = selectedCount === 0;
    };
    selectAllCheckbox.addEventListener('change', () => {
      Array.from(ticketCheckboxes).forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
      });
      updateConfirmButtonCount();
    });
    Array.from(ticketCheckboxes).forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        selectAllCheckbox.checked = Array.from(ticketCheckboxes).every(cb => cb.checked);
        updateConfirmButtonCount();
      });
    });
    document.getElementById('cancelOperation')?.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve([]);
    });
    confirmButton.addEventListener('click', () => {
      const selectedOperations = Array.from(ticketCheckboxes).filter(checkbox => checkbox.checked).map(checkbox => operations[parseInt(checkbox.dataset.index || '0')]);
      document.body.removeChild(dialog);
      resolve(selectedOperations);
    });
    updateConfirmButtonCount();
  });
}

// 添加显示 toast 的函数
function showToast(message) {
  let type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'info';
  const existingToasts = document.querySelectorAll(`.jira-toast-${type}`);
  existingToasts.forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `jira-toast-${type}`;
  toast.textContent = message;
  let backgroundColor = 'rgba(0, 0, 0, 0.7)';
  if (type === 'error') backgroundColor = 'rgba(220, 53, 69, 0.9)';else if (type === 'success') backgroundColor = 'rgba(40, 167, 69, 0.9)';else if (type === 'warning') backgroundColor = 'rgba(255, 193, 7, 0.9)';
  toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${backgroundColor};
        color: ${type === 'warning' ? 'black' : 'white'};
        padding: 10px 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        z-index: 10001;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// 新增：处理展开 Epic Tickets 的函数
async function handleExpandEpicTickets(sheetUrl, token) {
  showToast('开始查找 Epic 并获取子任务...');
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  const sheet = new _sheet__WEBPACK_IMPORTED_MODULE_1__.Sheet(sheetUrl, token);
  try {
    await sheet.init();
    const values = await sheet.readSheet();
    if (!values || values.length === 0) {
      showToast('表格为空或无法读取', 'error');
      return;
    }
    const sheetHeaders = await findValidJiraHeaders(sheet);

    // 找到 key 列的索引
    const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
    if (keyColumnIndex === -1) {
      throw new Error('未找到 Jira Key 列，请检查表头或配置');
    }
    console.log('Jira Key 列索引:', keyColumnIndex);
    const epicsToExpand = [];

    // 遍历表格查找 Epic Key 并查询子任务
    // 从第二行开始，跳过表头
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const keyCellContent = row[keyColumnIndex];

      // 尝试从 HYPERLINK 或纯文本中提取 key
      let epicKey = '';
      if (keyCellContent) {
        const match = keyCellContent.match(/browse\/([A-Z0-9]+-[0-9]+)/i); // 提取 browse/ 后面的 Key
        if (match && match[1]) {
          epicKey = match[1];
        } else if (/^[A-Z0-9]+-[0-9]+$/i.test(keyCellContent.trim())) {
          // 如果是纯 Key
          epicKey = keyCellContent.trim();
        }
      }
      if (epicKey) {
        console.log(`找到 Key: ${epicKey} 在行 ${i + 1}`);
        const jql = `issueFunction in issuesInEpics("key = ${epicKey}")`;
        try {
          const subTickets = await (0,_jira__WEBPACK_IMPORTED_MODULE_0__.fetchJiraTickets)(jql);
          if (subTickets.length > 0) {
            console.log(`Epic ${epicKey} 有 ${subTickets.length} 个子任务`);
            // 尝试获取 Epic 的概要信息（如果其他列存在）
            const summaryColumnIndex = sheetHeaders.summary ? getColumnIndex(sheetHeaders.summary) : -1;
            const epicSummary = summaryColumnIndex !== -1 && row[summaryColumnIndex] ? row[summaryColumnIndex] : epicKey; // Default to key if summary missing

            epicsToExpand.push({
              epicKey,
              epicSummary: epicSummary,
              rowIndex: i,
              // 0-based index
              subTickets
            });
          } else {
            console.log(`Epic ${epicKey} 没有子任务或不是 Epic`);
          }
        } catch (fetchError) {
          // Specify type for fetchError
          console.error(`查询 Epic ${epicKey} 的子任务失败:`, fetchError);
          // 选择性地通知用户或继续处理下一个
          showToast(`查询 ${epicKey} 子任务失败: ${fetchError.message || fetchError}`, 'error'); // Show error message
        }
      } else {
        // console.log(`行 ${i + 1} 未找到有效的 Key`);
      }
    }
    if (epicsToExpand.length === 0) {
      showToast('未找到任何包含子任务的 Epic', 'info');
      return;
    }
    showToast(`找到 ${epicsToExpand.length} 个 Epic 包含子任务，准备确认操作...`);

    // --- 下一步: 修改确认对话框并处理插入/分组 ---
    console.log('准备确认的 Epics:', epicsToExpand);
    const confirmedEpics = await showEpicConfirmationDialog(epicsToExpand);
    if (confirmedEpics && confirmedEpics.length > 0) {
      await insertSubTickets(sheet, confirmedEpics, sheetHeaders, envConfig.JIRA_BASE_URL);
      showToast(`已成功展开 ${confirmedEpics.length} 个 Epic 的子任务`, 'success');
    } else {
      showToast('操作已取消', 'info');
    }

    // 临时占位符，表示流程进行到这里
    showToast('子任务查找完成，确认、插入和分组功能待实现', 'warning');
  } catch (error) {
    // Specify type for error
    console.error('处理 Epic 展开时出错:', error);
    showToast('处理 Epic 展开时出错: ' + (error.message || error), 'error'); // Use error.message if available
    throw error; // Re-throw error to be caught by the caller
  }
}

// Epic 确认对话框
async function showEpicConfirmationDialog(epics) {
  return new Promise(resolve => {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10001;
            width: 800px;
            max-width: 90vw;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;
    dialog.innerHTML = `
            <h3 style="margin-top: 0; flex-shrink: 0;">确认展开 Epic</h3>
            <div style="margin-bottom: 15px; flex-shrink: 0;">
                <div style="color: #666;">
                    找到 ${epics.length} 个包含子任务的 Epic
                </div>
            </div>
            <div style="margin-bottom: 10px; flex-shrink: 0;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="selectAllEpics" checked style="margin-right: 5px;">
                    全选/取消全选
                </label>
            </div>
            <div style="flex-grow: 1; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; margin-bottom: 15px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
                        <tr>
                            <th style="padding: 8px; text-align: left; width: 50px;">选择</th>
                            <th style="padding: 8px; text-align: left;">Epic</th>
                            <th style="padding: 8px; text-align: left;">子任务数量</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${epics.map((epic, index) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 8px;">
                                    <input type="checkbox" class="epic-checkbox" data-index="${index}" checked>
                                </td>
                                <td style="padding: 8px;">
                                    ${epic.epicKey} - ${epic.epicSummary}
                                </td>
                                <td style="padding: 8px;">
                                    ${epic.subTickets.length} 个子任务
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                <button id="cancelOperation" style="padding: 6px 12px; background: #eee; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">取消</button>
                <button id="confirmOperation" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">确认</button>
            </div>
        `;
    document.body.appendChild(dialog);
    const selectAllCheckbox = document.getElementById('selectAllEpics');
    const epicCheckboxes = dialog.getElementsByClassName('epic-checkbox');
    const confirmButton = document.getElementById('confirmOperation');
    selectAllCheckbox.addEventListener('change', () => {
      Array.from(epicCheckboxes).forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
      });
    });
    Array.from(epicCheckboxes).forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        selectAllCheckbox.checked = Array.from(epicCheckboxes).every(cb => cb.checked);
      });
    });
    document.getElementById('cancelOperation')?.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve([]);
    });
    confirmButton.addEventListener('click', () => {
      const selectedEpics = Array.from(epicCheckboxes).filter(checkbox => checkbox.checked).map(checkbox => epics[parseInt(checkbox.dataset.index || '0')]);
      document.body.removeChild(dialog);
      resolve(selectedEpics);
    });
  });
}

// 插入子任务
async function insertSubTickets(sheet, epics, sheetHeaders, jiraBaseUrl) {
  // 按行号从大到小排序，这样插入时不会影响后续的行号
  const sortedEpics = [...epics].sort((a, b) => b.rowIndex - a.rowIndex);
  for (const epic of sortedEpics) {
    const insertRowIndex = epic.rowIndex + 2; // +2 因为 rowIndex 是 0-based，且我们要插在 Epic 行的下方
    const displayHeaders = ['key', 'summary', 'status', 'assignee', 'reporter'];
    const maxColIndex = getMaxColumnIndex(Object.values(sheetHeaders).filter(value => typeof value === 'string' && value.length > 0));

    // 先插入空行
    const rowsToInsert = epic.subTickets.length;
    if (rowsToInsert > 0) {
      try {
        await sheet.insertDimension('ROWS', insertRowIndex - 1, insertRowIndex - 1 + rowsToInsert);
        console.log(`已在行 ${insertRowIndex} 插入 ${rowsToInsert} 个空行`);
      } catch (error) {
        console.error('插入空行失败:', error);
        showToast(`插入空行失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
        continue;
      }
    }
    const subTicketRows = epic.subTickets.map(ticket => {
      const row = new Array(maxColIndex).fill('');
      displayHeaders.forEach(field => {
        const columnLetter = sheetHeaders[field];
        if (columnLetter && typeof columnLetter === 'string') {
          const colIndex = getColumnIndex(columnLetter);
          if (field === 'key') {
            row[colIndex] = `=HYPERLINK("${jiraBaseUrl}/browse/${ticket.key}", "${ticket.key}")`;
          } else {
            row[colIndex] = ticket[field] || '';
          }
        }
      });
      return row;
    });

    // 写入子任务数据
    const startPosition = `A${insertRowIndex}`;
    await sheet.writeSheet(subTicketRows, startPosition);
    console.log(`已在行 ${insertRowIndex} 写入 ${subTicketRows.length} 个子任务`);
  }
}
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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aEQsTUFBTXJCLEdBQUcsR0FBRyxJQUFJcVIsS0FBSyxDQUFDSCxXQUFXLENBQUMsQ0FBQ0ksSUFBSSxDQUFDLEVBQUUsQ0FBQztNQUMzQzFCLGNBQWMsQ0FBQzdQLE9BQU8sQ0FBQ3VQLEtBQUssSUFBSTtRQUM1QixNQUFNaUMsWUFBWSxHQUFHN0IsWUFBWSxDQUFDSixLQUFLLENBQXFCO1FBQzVELElBQUlpQyxZQUFZLElBQUksT0FBT0EsWUFBWSxLQUFLLFFBQVEsRUFBRTtVQUNsRCxNQUFNQyxRQUFRLEdBQUcxQixjQUFjLENBQUN5QixZQUFZLENBQUM7VUFDN0MsSUFBSWpDLEtBQUssS0FBSyxLQUFLLEVBQUU7WUFDakJ0UCxHQUFHLENBQUN3UixRQUFRLENBQUMsR0FBRyxlQUFlbUUsV0FBVyxXQUFXdFUsTUFBTSxDQUFDQyxHQUFHLE9BQU9ELE1BQU0sQ0FBQ0MsR0FBRyxJQUFJO1VBQ3hGLENBQUMsTUFBTTtZQUNIdEIsR0FBRyxDQUFDd1IsUUFBUSxDQUFDLEdBQUduUSxNQUFNLENBQUNpTyxLQUFLLENBQXFCLElBQUksRUFBRTtVQUMzRDtRQUNKO01BQ0osQ0FBQyxDQUFDO01BQ0YsT0FBT3RQLEdBQUc7SUFDZCxDQUFDLENBQUM7O0lBRUY7SUFDQSxNQUFNNFIsYUFBYSxHQUFHLElBQUlvRSxjQUFjLEVBQUU7SUFDMUMsTUFBTXZTLEtBQUssQ0FBQ08sVUFBVSxDQUFDa1MsYUFBYSxFQUFFdEUsYUFBYSxDQUFDO0lBQ3BEdk0sT0FBTyxDQUFDcUMsR0FBRyxDQUFDLE9BQU9zTyxjQUFjLE9BQU9FLGFBQWEsQ0FBQ3BXLE1BQU0sT0FBTyxDQUFDO0VBQ3hFO0FBQ0osQyIsInNvdXJjZXMiOlsid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2ppcmEudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvc2hlZXQudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvc3RvcmFnZS50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy91dGlscy50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2NvbnRlbnRTY3JpcHRHb29nbGVTaGVldC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RW52Q29uZmlnIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIOm7mOiupOeahCBKaXJhIOWtl+autemFjee9rlxuY29uc3QgREVGQVVMVF9KSVJBX0ZJRUxEUyA9IHtcbiAgJ0tleSc6ICdrZXknLFxuICAnU3VtbWFyeSc6ICdzdW1tYXJ5JyxcbiAgJ1N0YXR1cyc6ICdzdGF0dXMnLFxuICAnQXNzaWduZWUnOiAnYXNzaWduZWUnLFxuICAnUmVwb3J0ZXInOiAncmVwb3J0ZXInLFxuICAnUHJpb3JpdHknOiAncHJpb3JpdHknLFxuICAnQ3JlYXRlZCc6ICdjcmVhdGVkJyxcbiAgJ1VwZGF0ZWQnOiAndXBkYXRlZCcsXG4gICdEdWUgRGF0ZSc6ICdkdWVkYXRlJyxcbiAgJ0Rlc2NyaXB0aW9uJzogJ2Rlc2NyaXB0aW9uJ1xufTtcblxuLy8g5LuOIEppcmEg6aG16Z2i5oqT5Y+W5pWw5o2uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hKaXJhVGlja2V0cyhqcWw6IHN0cmluZyk6IFByb21pc2U8SmlyYVRpY2tldFtdPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdElkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDcpO1xuICAgICAgICBcbiAgICAgICAgLy8g55uR5ZCs5p2l6IeqIGJhY2tncm91bmQgc2NyaXB0IOeahOa2iOaBr1xuICAgICAgICBjb25zdCBtZXNzYWdlTGlzdGVuZXIgPSAobWVzc2FnZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAobWVzc2FnZS50eXBlID09PSAnSklSQV9USUNLRVRTX1JFU1VMVCcgJiYgbWVzc2FnZS5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCkge1xuICAgICAgICAgICAgICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihtZXNzYWdlTGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIGlmIChtZXNzYWdlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IobWVzc2FnZS5lcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUobWVzc2FnZS50aWNrZXRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihtZXNzYWdlTGlzdGVuZXIpO1xuICAgICAgICBcbiAgICAgICAgLy8g5Y+R6YCB5raI5oGv57uZIGJhY2tncm91bmQgc2NyaXB0IOadpeWIm+W7uuaWsOagh+etvumhtVxuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiAnRkVUQ0hfSklSQV9USUNLRVRTJyxcbiAgICAgICAgICAgIGpxbCxcbiAgICAgICAgICAgIHJlcXVlc3RJZFxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuLy8g54S25ZCO5ZyoIEZFVENIX0pJUkFfVElDS0VUUyDlh73mlbDkuK3kvb/nlKggc291cmNlVGFiSWRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBGRVRDSF9KSVJBX1RJQ0tFVFMoanFsOiBzdHJpbmcsIHJlcXVlc3RJZDogc3RyaW5nLCBzb3VyY2VUYWJJZDogbnVtYmVyKSB7XG4gIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICBjb25zdCB1cmwgPSBgJHtlbnZDb25maWcuSklSQV9CQVNFX1VSTH0vaXNzdWVzLz9qcWw9JHtlbmNvZGVVUklDb21wb25lbnQoanFsKX1gO1xuICAgICAgICBcbiAgLy8g5Yib5bu65paw5qCH562+6aG1XG4gIGNocm9tZS50YWJzLmNyZWF0ZSh7IHVybCwgYWN0aXZlOiBmYWxzZSB9LCAodGFiKSA9PiB7XG4gICAgICBpZiAoIXRhYi5pZCkge1xuICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICBlcnJvcjogJ+aXoOazleWIm+W7uuagh+etvumhtSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIOetieW+hemhtemdouWKoOi9veWujOaIkFxuICAgICAgY29uc3QgY2hlY2tQYWdlTG9hZCA9ICgpID0+IHtcbiAgICAgICAgICBjaHJvbWUudGFicy5nZXQodGFiLmlkISwgKHVwZGF0ZWRUYWIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKHVwZGF0ZWRUYWIuc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgICAgICAgICAgaWYgKHVwZGF0ZWRUYWIudXJsLmluY2x1ZGVzKCdsb2dpbicpIHx8IHVwZGF0ZWRUYWIudXJsLmluY2x1ZGVzKCdva3RhJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiAnamlyYSDpnIDopoHnmbvlvZXvvIzor7fnmbvlvZXlkI7ph43mlrDlsJ3or5UnXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IGNocm9tZS50YWJzLnVwZGF0ZSh0YWIuaWQhLCB7IGFjdGl2ZTogdHJ1ZSB9KSwgMzAwMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAvLyDms6jlhaXlhoXlrrnohJrmnKxcbiAgICAgICAgICAgICAgICAgIGNocm9tZS5zY3JpcHRpbmcuZXhlY3V0ZVNjcmlwdCh7XG4gICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB7IHRhYklkOiB0YWIuaWQhIH0sXG4gICAgICAgICAgICAgICAgICAgICAgZnVuYzogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5Yik5pat5piv5ZCm5pivSmlyYSBDbG91ZOeJiOacrO+8jOmAmui/h+ajgOafpeeJueWumueahERPTeWFg+e0oOWIpOaWrVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0ppcmFDbG91ZCA9ICEhZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndGFibGVbZGF0YS12Yz1cImlzc3VlLXRhYmxlXCJdJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICEhZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndGFibGVbYXJpYS1sYWJlbD1cIldvcmtcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0ppcmFDbG91ZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEppcmEgQ2xvdWQg54mI5pys55qE6YCJ5oup5ZmoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLnVpLmlzc3VlLXJvd1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyb3dzICYmIHJvd3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dzLmZvckVhY2gocm93ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOiOt+WPlmtleSAtIGFbZGF0YS10ZXN0aWQ9XCJuYXRpdmUtaXNzdWUtdGFibGUuY29tbW9uLnVpLmlzc3VlLWNlbGxzLmlzc3VlLWtleS5pc3N1ZS1rZXktY2VsbFwiXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5RWxlbWVudCA9IHJvdy5xdWVyeVNlbGVjdG9yKCdhW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLmNvbW1vbi51aS5pc3N1ZS1jZWxscy5pc3N1ZS1rZXkuaXNzdWUta2V5LWNlbGxcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g6I635Y+Wc3VtbWFyeSAtIGFbZGF0YS10ZXN0aWQ9XCJuYXRpdmUtaXNzdWUtdGFibGUuY29tbW9uLnVpLmlzc3VlLWNlbGxzLmlzc3VlLXN1bW1hcnkuaXNzdWUtc3VtbWFyeS1jZWxsXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdW1tYXJ5RWxlbWVudCA9IHJvdy5xdWVyeVNlbGVjdG9yKCdhW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLmNvbW1vbi51aS5pc3N1ZS1jZWxscy5pc3N1ZS1zdW1tYXJ5Lmlzc3VlLXN1bW1hcnktY2VsbFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDojrflj5ZzdGF0dXMgLSDnirbmgIHkvY3kuo7mnInnibnlrppjbGFzc+eahHNwYW7kuK1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXR1c0NvbnRhaW5lciA9IHJvdy5xdWVyeVNlbGVjdG9yKCdkaXZbZGF0YS10ZXN0aWRePVwiaXNzdWUuZmllbGRzLnN0YXR1cy5jb21tb24udWkuc3RhdHVzLWxvemVuZ2VcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXR1c0VsZW1lbnQgPSBzdGF0dXNDb250YWluZXIgPyBzdGF0dXNDb250YWluZXIucXVlcnlTZWxlY3RvcignZGl2Ll80Y3ZyMWg2bycpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g57uP5Yqe5Lq644CB5oql5ZGK5Lq65ZKM5LyY5YWI57qn6YCa5bi45L2N5LqO55u45bqU55qE5Y2V5YWD5qC85LitXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjZWxscyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCd0ZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFzc2lnbmVlID0gJycsIHJlcG9ydGVyID0gJycsIHByaW9yaXR5ID0gJycsIGNyZWF0ZWQgPSAnJywgdXBkYXRlZCA9ICcnLCBkdWVkYXRlID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOmAmui/h+S9jee9ruWIpOaWreWQhOS4quWtl+autVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNlbGxzLmxlbmd0aCA+PSAxMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOS8mOWFiOWwneivleS7jueJueWumueahHNwYW7kuK3ojrflj5Zhc3NpZ25lZeS/oeaBr++8jOmBv+WFjeiOt+WPlumHjeWkjeaWh+acrFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2lnbmVlU3BhbiA9IGNlbGxzWzRdLnF1ZXJ5U2VsZWN0b3IoJy5fMXJlbzE1dnEuXzE4bTkxNXZxLl9vNTcyMXE5Yy5fMWJ0bzFsMnMgPiBzcGFuJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFzc2lnbmVlVGV4dCA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NpZ25lZVNwYW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWVUZXh0ID0gYXNzaWduZWVTcGFuLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5aaC5p6c5om+5LiN5Yiw54m55a6a5YWD57Sg77yM5YiZ6I635Y+W5pW05Liq5Y2V5YWD5qC85paH5pys5bm26L+b6KGM5aSE55CG5Y676YeNXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlVGV4dCA9IGNlbGxzWzRdLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWkhOeQhuWPr+iDveeahOmHjeWkjeaWh+acrO+8jOWmglwiRXNvbmVFc29uZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NpZ25lZVRleHQgJiYgYXNzaWduZWVUZXh0Lmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOato+WImeihqOi+vuW8j+Wvu+aJvui/nue7remHjeWkjeeahOebuOWQjOWQjeensOW5tuWOu+mHjVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBhc3NpZ25lZVRleHQubWF0Y2goL14oLis/KVxcMSskLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZVRleHQgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5qOA5p+l5paH5pys5piv5ZCm5pyJXCJVbmFzc2lnbmVkXCLlrZfmoLdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXNzaWduZWVUZXh0LmluY2x1ZGVzKCdVbmFzc2lnbmVkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWVUZXh0ID0gJ1VuYXNzaWduZWQnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlpoLmnpzmmK9cIlVuYXNzaWduZWRcIuWImeiuvuS4uuepulxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlID0gYXNzaWduZWVUZXh0ICE9PSAnVW5hc3NpZ25lZCcgPyBhc3NpZ25lZVRleHQgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDkvJjlhYjlsJ3or5Xku47nibnlrprnmoRzcGFu5Lit6I635Y+WcmVwb3J0ZXLkv6Hmga9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXBvcnRlclNwYW4gPSBjZWxsc1s1XS5xdWVyeVNlbGVjdG9yKCcuXzFyZW8xNXZxLl8xOG05MTV2cS5fbzU3MjFxOWMuXzFidG8xbDJzID4gc3BhbicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCByZXBvcnRlclRleHQgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVwb3J0ZXJTcGFuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyVGV4dCA9IHJlcG9ydGVyU3Bhbi50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWmguaenOaJvuS4jeWIsOeJueWumuWFg+e0oO+8jOWImeiOt+WPluaVtOS4quWNleWFg+agvOaWh+acrOW5tui/m+ihjOWkhOeQhuWOu+mHjVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlclRleHQgPSBjZWxsc1s1XS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlpITnkIblj6/og73nmoTph43lpI3mlofmnKxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlcG9ydGVyVGV4dCAmJiByZXBvcnRlclRleHQubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSByZXBvcnRlclRleHQubWF0Y2goL14oLis/KVxcMSskLyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlclRleHQgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlciA9IHJlcG9ydGVyVGV4dDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDkvJjlhYjlsJ3or5Xku47nibnlrprnmoRzcGFu5Lit6I635Y+WcHJpb3JpdHnkv6Hmga9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmlvcml0eVNwYW4gPSBjZWxsc1s2XS5xdWVyeVNlbGVjdG9yKCcuXzFyZW8xNXZxLl8xOG05MTV2cS5fMTh1MHUyZ2MuXzFidG8xbDJzLl9vNTcyMXE5YycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5ID0gcHJpb3JpdHlTcGFuID8gcHJpb3JpdHlTcGFuLnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiBjZWxsc1s2XS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDnkuKrljZXlhYPmoLzmmK9jcmVhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZCA9IGNlbGxzWzhdLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysMTDkuKrljZXlhYPmoLzmmK91cGRhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZCA9IGNlbGxzWzldLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysMTHkuKrljZXlhYPmoLzmmK9kdWVkYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHVlRGF0ZVRleHQgPSBjZWxsc1sxMF0udGV4dENvbnRlbnQ/LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdWVkYXRlID0gZHVlRGF0ZVRleHQgIT09ICdOb25lJyA/IGR1ZURhdGVUZXh0IHx8ICcnIDogJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGtleUVsZW1lbnQgPyBrZXlFbGVtZW50LnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBzdW1tYXJ5RWxlbWVudCA/IHN1bW1hcnlFbGVtZW50LnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHN0YXR1c0VsZW1lbnQgPyBzdGF0dXNFbGVtZW50LnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVlZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJycgLy8gQ2xvdWTop4blm77kuK3pgJrluLjkuI3mmL7npLrmj4/ov7BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5Y6f5pyJ55qEIEppcmEgT24tUHJlbWlzZSDniYjmnKznmoTpgInmi6nlmahcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3dzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndHIuaXNzdWVyb3cnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3MuZm9yRWFjaChyb3cgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IHJvdy5xdWVyeVNlbGVjdG9yKCcuaXNzdWVrZXknKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHJvdy5xdWVyeVNlbGVjdG9yKCcuc3VtbWFyeScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiByb3cucXVlcnlTZWxlY3RvcignLnN0YXR1cycpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWU6IHJvdy5xdWVyeVNlbGVjdG9yKCcuYXNzaWduZWUnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyOiByb3cucXVlcnlTZWxlY3RvcignLnJlcG9ydGVyJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5wcmlvcml0eScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZDogcm93LnF1ZXJ5U2VsZWN0b3IoJy5jcmVhdGVkJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkOiByb3cucXVlcnlTZWxlY3RvcignLnVwZGF0ZWQnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGU6IHJvdy5xdWVyeVNlbGVjdG9yKCcuZHVlZGF0ZScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHJvdy5xdWVyeVNlbGVjdG9yKCcuZGVzY3JpcHRpb24nKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRpY2tldHM7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSwgKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5aSE55CG57uT5p6cXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHRzICYmIHJlc3VsdHNbMF0gJiYgcmVzdWx0c1swXS5yZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyDlr7lzdW1tYXJ55a2X5q616L+b6KGM6aKd5aSW5aSE55CG77yM56Gu5L+d5bmy5YeA55qE5paH5pysXG4gICAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1swXS5yZXN1bHQgPSByZXN1bHRzWzBdLnJlc3VsdC5tYXAodGlja2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiB0aWNrZXQuc3VtbWFyeS5zcGxpdCgnXFxuJykubWFwKChzOiBzdHJpbmcpID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikucG9wKCkgfHwgdGlja2V0LnN1bW1hcnksXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiByZXN1bHRzWzBdLnJlc3VsdFxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIOWmguaenOayoeaciee7k+aenFxuICAgICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiBbXVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyDlhbPpl60gSmlyYSDmoIfnrb7pobVcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMucmVtb3ZlKHRhYi5pZCEpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrUGFnZUxvYWQsIDEwMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNoZWNrUGFnZUxvYWQoKTtcbiAgfSk7XG59XG4iLCJleHBvcnQgY2xhc3MgU2hlZXQge1xuICBwcml2YXRlIHRva2VuOiBzdHJpbmc7XG4gIHByaXZhdGUgc2hlZXRJZDogc3RyaW5nO1xuICBwcml2YXRlIGdpZDogc3RyaW5nO1xuICBwcml2YXRlIHNoZWV0TmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHVybDogc3RyaW5nLCB0b2tlbjogc3RyaW5nKSB7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMuc2hlZXRJZCA9IHRoaXMuZXh0cmFjdFNoZWV0SWQodXJsKTtcbiAgICB0aGlzLmdpZCA9IHRoaXMuZXh0cmFjdEdpZCh1cmwpO1xuICB9XG4gICAgXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgaWYgKCF0aGlzLnRva2VuKSB0aGlzLnRva2VuID0gYXdhaXQgdGhpcy5nZXRUb2tlbigpO1xuICAgIHRoaXMuc2hlZXROYW1lID0gYXdhaXQgdGhpcy5nZXRTaGVldE5hbWVCeUdpZCh0aGlzLnRva2VuLCB0aGlzLnNoZWV0SWQsIHRoaXMuZ2lkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFRva2VuKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY2hyb21lLmlkZW50aXR5LmdldEF1dGhUb2tlbih7IGludGVyYWN0aXZlOiB0cnVlIH0sICh0b2tlbikgPT4ge1xuICAgICAgICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikgcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgICAgICBlbHNlIHJlc29sdmUodG9rZW4pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGV4dHJhY3RTaGVldElkKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL1xcL2RcXC8oW2EtekEtWjAtOS1fXSspLyk7XG4gICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBudWxsO1xuICB9XG5cbiAgZXh0cmFjdEdpZCh1cmw6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IG1hdGNoID0gdXJsLm1hdGNoKC9bIyZdZ2lkPShbMC05XSspLyk7XG4gICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBudWxsO1xuICB9XG5cbiAgYXN5bmMgZ2V0U2hlZXROYW1lcyh0b2tlbjogc3RyaW5nLCBzaGVldElkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHtzaGVldElkfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgIHJldHVybiBqc29uLnNoZWV0cztcbiAgfVxuXG4gIGFzeW5jIGdldFNoZWV0TmFtZUJ5R2lkKHRva2VuOiBzdHJpbmcsIHNoZWV0SWQ6IHN0cmluZywgZ2lkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHNoZWV0cyA9IGF3YWl0IHRoaXMuZ2V0U2hlZXROYW1lcyh0b2tlbiwgc2hlZXRJZCk7XG4gICAgY29uc3Qgc2hlZXQgPSBzaGVldHMuZmluZCgoczogYW55KSA9PiBzLnByb3BlcnRpZXMuc2hlZXRJZC50b1N0cmluZygpID09PSBnaWQpO1xuICAgIHJldHVybiBzaGVldCA/IHNoZWV0LnByb3BlcnRpZXMudGl0bGUgOiBzaGVldHNbMF0ucHJvcGVydGllcy50aXRsZTsgLy8g5aaC5p6c5om+5LiN5Yiw5a+55bqU55qEZ2lkLOi/lOWbnuesrOS4gOS4qnNoZWV055qE5ZCN56ewXG4gIH1cblxuICBhc3luYyByZWFkU2hlZXQoKTogUHJvbWlzZTxzdHJpbmdbXVtdPiB7XG4gICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHt0aGlzLnNoZWV0TmFtZX1gO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCB9XG4gICAgfSk7XG4gICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgcmV0dXJuIGpzb24udmFsdWVzO1xuICB9XG5cbiAgYXN5bmMgd3JpdGVTaGVldCh2YWx1ZXM6IHN0cmluZ1tdW10sIHBvc2l0aW9uID0gJ0ExJyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHt0aGlzLnNoZWV0TmFtZX0hJHtwb3NpdGlvbn0/dmFsdWVJbnB1dE9wdGlvbj1VU0VSX0VOVEVSRURgO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHZhbHVlcyB9KVxuICAgIH0pO1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9XG5cbiAgLy8g5o+S5YWl6KGM5oiW5YiXXG4gIGFzeW5jIGluc2VydERpbWVuc2lvbihkaW1lbnNpb246ICdST1dTJyB8ICdDT0xVTU5TJywgc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH06YmF0Y2hVcGRhdGVgO1xuICAgIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgICByZXF1ZXN0czogW3tcbiAgICAgICAgaW5zZXJ0RGltZW5zaW9uOiB7XG4gICAgICAgICAgcmFuZ2U6IHtcbiAgICAgICAgICAgIHNoZWV0SWQ6IHBhcnNlSW50KHRoaXMuZ2lkKSxcbiAgICAgICAgICAgIGRpbWVuc2lvbixcbiAgICAgICAgICAgIHN0YXJ0SW5kZXgsXG4gICAgICAgICAgICBlbmRJbmRleFxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5oZXJpdEZyb21CZWZvcmU6IHRydWVcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgYWRkRGltZW5zaW9uR3JvdXA6IHtcbiAgICAgICAgICByYW5nZToge1xuICAgICAgICAgICAgc2hlZXRJZDogcGFyc2VJbnQodGhpcy5naWQpLFxuICAgICAgICAgICAgZGltZW5zaW9uLFxuICAgICAgICAgICAgc3RhcnRJbmRleCxcbiAgICAgICAgICAgIGVuZEluZGV4XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH07XG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdClcbiAgICB9KTtcblxuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOaPkuWFpee7tOW6puWksei0pTogJHtlcnJvci5lcnJvcj8ubWVzc2FnZSB8fCAn5pyq55+l6ZSZ6K+vJ31gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6K+75Y+W6YWN572u6KGo5pWw5o2uXG4gICAqIEBwYXJhbSBzaGVldE5hbWUg6YWN572u6KGo5ZCN56ewXG4gICAqIEByZXR1cm5zIOmFjee9ruihqOaVsOaNrlxuICAgKi9cbiAgYXN5bmMgcmVhZENvbmZpZ1NoZWV0KGNvbmZpZ1NoZWV0TmFtZSA9ICcnKTogUHJvbWlzZTxzdHJpbmdbXVtdPiB7XG4gICAgaWYgKCFjb25maWdTaGVldE5hbWUpIGNvbmZpZ1NoZWV0TmFtZSA9IHRoaXMuc2hlZXROYW1lICsgJ19jb25maWcnO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7Y29uZmlnU2hlZXROYW1lfWA7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICAgIHJldHVybiBqc29uLnZhbHVlcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign6K+75Y+W6YWN572u6KGo5aSx6LSlOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5booajmoLznmoTnrKzkuIDooYzkvZzkuLrooajlpLRcbiAgICogQHJldHVybnMg6KGo5aS05pWw57uEXG4gICAqL1xuICBhc3luYyBnZXRIZWFkZXJzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCB0aGlzLnJlYWRTaGVldCgpO1xuICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign6KGo5qC85Li656m6Jyk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXNbMF07XG4gIH1cblxuICBwdWJsaWMgZ2V0U2hlZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc2hlZXROYW1lO1xuICB9XG59IiwiZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4ZWREQkRhdGEoZGF0YWJhc2VOYW1lOiBzdHJpbmcsIHN0b3JlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oZGF0YWJhc2VOYW1lKTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbihbc3RvcmVOYW1lXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBkYXRhUmVxdWVzdCA9IG9iamVjdFN0b3JlLmdldEFsbCgpO1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgICAgICB9O1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn1cblxuXG5leHBvcnQgY29uc3QgZ2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8IEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IHNldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VXNlckluZm8oKSB7XG4gICAgY29uc3QgeyBleHRlbnNpb246IGV4dGVuc2lvbklkIH0gPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdvd25FeHRlbnNpb24nLCB7fSk7XG4gICAgY29uc3QgdXNlcm5hbWUgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdkaXNwbGF5TmFtZScsICdyYWRhci1wb2MnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBleHRlbnNpb25JZCxcbiAgICAgICAgdXNlcm5hbWVcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rm9sZGVycygpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdwcm9maWxlJykudGhlbigoW2RhdGFdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmYXZvcml0ZV9ncm91cF9pZHMgPSBkYXRhPy5mYXZvcml0ZV9ncm91cF9pZHMgfHwgW107XG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25fc2V0cyA9IGRhdGE/LmNvbnZlcnNhdGlvbl9zZXRzIHx8IFtdO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IFt7dGl0bGU6ICcgJywgaWRzOiBbXX0se3RpdGxlOiAnZmF2b3JpdGUnLCBpZHM6IGZhdm9yaXRlX2dyb3VwX2lkc30sIC4uLmNvbnZlcnNhdGlvbl9zZXRzLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2ZvbGRlcicpXVxuICAgICAgICAgICAgcmV0dXJuIGZvbGRlcnM7XG4gICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0R3JvdXBzTWFwKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ2dyb3VwJykudGhlbigoZ3JvdXBzKSA9PiB7XG4gICAgICAgIGNvbnN0IGdyb3Vwc01hcCA9IGdyb3Vwcy5yZWR1Y2UoKGFjYzogYW55LCBncm91cDogYW55KSA9PiB7XG4gICAgICAgICAgICBhY2NbZ3JvdXAuaWRdID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLnNldF9hYmJyZXZpYXRpb24sXG4gICAgICAgICAgICAgICAgaXNfdGVhbTogZ3JvdXAuaXNfdGVhbVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sIHt9KTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBzTWFwO1xuICAgIH0pO1xufSIsImltcG9ydCB7IGdldEN1cnJlbnRVc2VySW5mbywgZ2V0TG9jYWxTdG9yYWdlSXRlbSB9IGZyb20gXCIuL3N0b3JhZ2VcIjtcblxuLy8g546v5aKD6YWN572u57G75Z6L5a6a5LmJXG5leHBvcnQgaW50ZXJmYWNlIEVudkNvbmZpZ1R5cGUge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IG51bWJlcjtcbiAgQU5BTFlTSVNfVFlQRTogc3RyaW5nO1xuICBBTkFMWVpFX0JZX0dST1VQOiBib29sZWFuO1xuICBMTE1fVFlQRTogc3RyaW5nO1xuICBPTExBTUFfQkFTRV9VUkw6IHN0cmluZztcbiAgT0xMQU1BX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBzdHJpbmc7XG4gIERJRllfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX1JFVklFV19BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfS0VZOiBzdHJpbmc7XG4gIE9QRU5BSV9NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgR1JPUV9BUElfS0VZOiBzdHJpbmc7XG4gIEdST1FfTU9ERUw6IHN0cmluZztcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgQk9UX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBCT1RfVE9LRU46IHN0cmluZztcbiAgQk9UX0lEOiBzdHJpbmc7XG4gIEJPVF9UWVBFOiBzdHJpbmc7XG4gIFRFQU1fSUQ6IHN0cmluZztcbiAgRU5BQkxFX0JPVDogYm9vbGVhbjtcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogYm9vbGVhbjtcbiAgRU5BQkxFX0NIUk9NQTogYm9vbGVhbjtcbiAgQ0hST01BX0FQSV9VUkw6IHN0cmluZztcbiAgQ0hST01BX1BPUlQ6IG51bWJlcjtcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogc3RyaW5nO1xuICAvLyBKSVJB55u45YWz6YWN572uXG4gIEpJUkFfQkFTRV9VUkw/OiBzdHJpbmc7XG4gIEpJUkFfVVNFUk5BTUU/OiBzdHJpbmc7XG4gIEpJUkFfQVBJX1RPS0VOPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gICAgXG4gICAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBob3VycyA9IFN0cmluZyhkYXRlLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICBcbiAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9ICR7aG91cnN9OiR7bWludXRlc306JHtzZWNvbmRzfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnkoYXJyYXk6IGFueVtdLCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgcmV0dXJuIGFycmF5LmZpbHRlcihpdGVtID0+IHtcbiAgICAgIGNvbnN0IGtleVZhbHVlID0gaXRlbVtrZXldO1xuICAgICAgaWYgKHNlZW4uaGFzKGtleVZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLmFkZChrZXlWYWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgb25DbG9zZT86ICgpID0+IHZvaWQpIHtcbiAgLy8g6I635Y+W5oiW5Yib5bu65a655Zmo5YWD57SgXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyYWRhci1wb2MtcmVzdWx0Jyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm5cblxuICAvLyDnp7vpmaTnjrDmnInnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IGV4aXN0aW5nVG9hc3QgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLnJhZGFyLXBvYy10b2FzdCcpO1xuICBpZiAoZXhpc3RpbmdUb2FzdCkge1xuICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChleGlzdGluZ1RvYXN0KTtcbiAgfVxuXG4gIC8vIOWIm+W7uuaWsOeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHJhZGFyLXBvYy10b2FzdCByYWRhci1wb2MtdG9hc3QtJHt0eXBlfWA7XG5cbiAgY29uc3QgdG9hc3RJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdElubmVyLmNsYXNzTmFtZSA9ICdyYWRhci1wb2MtdG9hc3QtaW5uZXInO1xuICB0b2FzdElubmVyLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblxuICB0b2FzdC5hcHBlbmRDaGlsZCh0b2FzdElubmVyKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcblxuICAvLyDorr7nva7lrprml7blmajlnKggMyDnp5LlkI7lhbPpl60gVG9hc3RcbiAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH0sIDMwMDApO1xuXG4gIC8vIOi/lOWbnuS4gOS4quWHveaVsOS7peS+v+aJi+WKqOWFs+mXrSBUb2FzdFxuICByZXR1cm4gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtR3JvdXBMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IGdyb3VwTGlua1BhdHRlcm4gPSAvXFxbZ3JvdXA6KC4rKTooXFxkKylcXF0vZztcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKGdyb3VwTGlua1BhdHRlcm4sIChtYXRjaCwgZ3JvdXBOYW1lLCBncm91cElkKSA9PiB7XG4gICAgcmV0dXJuIGBbJHtncm91cE5hbWV9XSgvbWVzc2FnZXMvJHtncm91cElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtUG9zdExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgcG9zdExpbmtQYXR0ZXJuID0gL1xcW3Bvc3Q6KFxcZCspXFxdL2c7XG4gIGxldCBpbmRleCA9IDE7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShwb3N0TGlua1BhdHRlcm4sIChtYXRjaCwgcG9zdElkKSA9PiB7XG4gICAgcmV0dXJuIGBbWyR7aW5kZXgrK31dXSgvbCR7d2luZG93LmxvY2F0aW9uLnBhdGhuYW1lfS8ke3Bvc3RJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuLy8g6buY6K6k546v5aKD6YWN572uXG5leHBvcnQgY29uc3QgZGVmYXVsdEVudkNvbmZpZzogRW52Q29uZmlnVHlwZSA9IHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBOdW1iZXIocHJvY2Vzcy5lbnYuU0NIRURVTEVEX0lOVEVSVkFMKSB8fCAxMjAsXG4gIEFOQUxZU0lTX1RZUEU6IHByb2Nlc3MuZW52LkFOQUxZU0lTX1RZUEUgfHwgXCJmaWx0ZXJcIixcbiAgTExNX1RZUEU6IHByb2Nlc3MuZW52LkxMTV9UWVBFIHx8IFwiZGlmeVwiLFxuICBBTkFMWVpFX0JZX0dST1VQOiBwcm9jZXNzLmVudi5BTkFMWVpFX0JZX0dST1VQID09PSBcInRydWVcIixcbiAgT0xMQU1BX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PTExBTUFfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjExNDM0XCIsXG4gIE9MTEFNQV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX01PREVMIHx8IFwiZGVlcHNlZWstcjFcIixcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1JFVklFV19NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1FVRVJZX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgRElGWV9BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9SRVZJRVdfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuRElGWV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9LRVk6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZIHx8IFwiXCIsXG4gIE9QRU5BSV9NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBHUk9RX0FQSV9LRVk6IHByb2Nlc3MuZW52LkdST1FfQVBJX0tFWSB8fCBcIlwiLFxuICBHUk9RX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX01PREVMIHx8IFwiXCIsXG4gIEdST1FfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBCT1RfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5CT1RfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9ib3RtYW4uaW50LnJjbGFiZW52LmNvbS92MlwiLFxuICBCT1RfVE9LRU46IHByb2Nlc3MuZW52LkJPVF9UT0tFTiB8fCBcIlwiLFxuICBCT1RfSUQ6IHByb2Nlc3MuZW52LkJPVF9JRCB8fCBcIjQ3MDAzNzIwMjBAMzc0Mzk1MTAuYm90LmdsaXAubmV0XCIsXG4gIEJPVF9UWVBFOiBwcm9jZXNzLmVudi5CT1RfVFlQRSB8fCBcInVzZXJcIixcbiAgVEVBTV9JRDogcHJvY2Vzcy5lbnYuVEVBTV9JRCB8fCBcIlwiLFxuICBFTkFCTEVfQk9UOiBwcm9jZXNzLmVudi5FTkFCTEVfQk9UID09PSBcInRydWVcIixcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogcHJvY2Vzcy5lbnYuTExNX1JFVklFV19CRUZPUkVfU0VORCA9PT0gXCJ0cnVlXCIsXG4gIEVOQUJMRV9DSFJPTUE6IHByb2Nlc3MuZW52LkVOQUJMRV9DSFJPTUEgPT09IFwidHJ1ZVwiLFxuICBDSFJPTUFfQVBJX1VSTDogcHJvY2Vzcy5lbnYuQ0hST01BX0FQSV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgQ0hST01BX1BPUlQ6IE51bWJlcihwcm9jZXNzLmVudi5DSFJPTUFfUE9SVCkgfHwgODAwMCxcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogcHJvY2Vzcy5lbnYuQ0hST01BX0NPTExFQ1RJT05fTkFNRSB8fCBcIlwiLFxuICBKSVJBX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5KSVJBX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9qaXJhLnJpbmdjZW50cmFsLmNvbVwiLFxuICBKSVJBX1VTRVJOQU1FOiBwcm9jZXNzLmVudi5KSVJBX1VTRVJOQU1FIHx8IFwiXCIsXG4gIEpJUkFfQVBJX1RPS0VOOiBwcm9jZXNzLmVudi5KSVJBX0FQSV9UT0tFTiB8fCBcIlwiLFxufTtcblxuLy8g6I635Y+W546v5aKD6YWN572u77yM5aaC5p6c5Y+v6IO955qE6K+d5LuOIHN0b3JhZ2Ug6I635Y+W77yM5ZCm5YiZ5LuOIHByb2Nlc3MuZW52IOiOt+WPllxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEVudkNvbmZpZygpOiBQcm9taXNlPEVudkNvbmZpZ1R5cGU+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGVudkNvbmZpZyB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFsnZW52Q29uZmlnJ10pO1xuICAgIGlmIChlbnZDb25maWcpIHtcbiAgICAgIC8vIOWwhuWtmOWCqOeahOmFjee9ruS4jum7mOiupOmFjee9ruWQiOW5tu+8jOehruS/neaWsOWinueahOmFjee9rumhueS5n+S8muiiq+WMheWQq1xuICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdEVudkNvbmZpZywgLi4uZW52Q29uZmlnIH07XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+iOt+WPlumFjee9ruWksei0pTonLCBlcnJvcik7XG4gIH1cbiAgXG4gIC8vIOWmguaenOiOt+WPluWksei0peaIluayoeacieS/neWtmOeahOmFjee9ru+8jOi/lOWbnum7mOiupOWAvFxuICByZXR1cm4gZGVmYXVsdEVudkNvbmZpZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJJbmZvKCkge1xuICBjb25zdCBhY2NvdW50VUQgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdnbG9iYWwuYWNjb3VudC5VRCcsICcnKTtcbiAgY29uc3QgYWNjb3VudEluZm9MaXN0ID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuQUNDT1VOVF9TRVNTSU9OX0RBVEFfTElTVCcsIHt9KTtcblxuICBjb25zdCBhY2NvdW50SW5mbyA9IGFjY291bnRVRCA/IGFjY291bnRJbmZvTGlzdFthY2NvdW50VURdIDogYWNjb3VudEluZm9MaXN0LmZpbmQoKGl0ZW06YW55KSA9PiBpdGVtLmRpc3BsYXlOYW1lICE9ICcnKTtcbiAgY29uc29sZS5sb2coJ2FjY291bnRJbmZvTGlzdCcsIGFjY291bnRJbmZvTGlzdCwgYWNjb3VudEluZm8pO1xuICBpZiAoYWNjb3VudEluZm8pIHJldHVybiB7XG4gICAgZXh0ZW5zaW9uSWQ6IGFjY291bnRJbmZvLmV4dGVuc2lvbklkLFxuICAgIGVtYWlsOiBhY2NvdW50SW5mby5lbWFpbCxcbiAgICBmdWxsTmFtZTogYWNjb3VudEluZm8uZGlzcGxheU5hbWUsXG4gICAgdXNlcm5hbWU6IGFjY291bnRJbmZvLmVtYWlsID8gYWNjb3VudEluZm8uZW1haWwudHJpbSgpLnNwbGl0KCdAJylbMF0gOiBhY2NvdW50SW5mby5kaXNwbGF5TmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gIH1cblxuICBjb25zdCB1c2VySW5mbyA9IGdldEN1cnJlbnRVc2VySW5mbygpO1xuICByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiB1c2VySW5mby5leHRlbnNpb25JZCxcbiAgICBmdWxsTmFtZTogdXNlckluZm8udXNlcm5hbWUsXG4gICAgdXNlcm5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSxcbiAgICBlbWFpbDogdXNlckluZm8udXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpICsgJ0ByaW5nY2VudHJhbC5jb20nXG4gIH07XG59XG5cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IHsgZmV0Y2hKaXJhVGlja2V0cyB9IGZyb20gJy4vamlyYSc7XG5pbXBvcnQgeyBTaGVldCB9IGZyb20gJy4vc2hlZXQnO1xuaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RW52Q29uZmlnIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIOWFqOWxgOWPmOmHj1xubGV0IHVybDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5sZXQgc2hlZXRUb2tlbjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbi8vIE1haW4gbGlzdGVuZXJcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBjb25zb2xlLmxvZygn5pS25Yiw5raI5oGvOicsIG1lc3NhZ2UsICflj5HpgIHogIU6Jywgc2VuZGVyKTtcblxuICAgIGlmICghbWVzc2FnZSB8fCAhbWVzc2FnZS50eXBlKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign5pS25Yiw5peg5pWI5raI5oGv5qC85byPJyk7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ+aXoOaViOa2iOaBr+agvOW8jycgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHsgdHlwZSB9ID0gbWVzc2FnZTtcblxuICAgIGlmICh0eXBlID09PSAnT1BFTl9KSVJBX1FVRVJZX0RJQUxPRycpIHtcbiAgICAgICAgb3BlbkpxbERpYWxvZyhtZXNzYWdlLnVybCwgbWVzc2FnZS5zaGVldFRva2VuKTtcbiAgICAgICAgdXJsID0gbWVzc2FnZS51cmw7XG4gICAgICAgIHNoZWV0VG9rZW4gPSBtZXNzYWdlLnNoZWV0VG9rZW47XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnRVhQQU5EX0VQSUNfVElDS0VUUycpIHtcbiAgICAgICAgaWYgKCFtZXNzYWdlLnVybCB8fCAhbWVzc2FnZS5zaGVldFRva2VuKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFWFBBTkRfRVBJQ19USUNLRVRTIOe8uuWwkSB1cmwg5oiWIHNoZWV0VG9rZW4nKTtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn57y65bCR5b+F6KaB5Y+C5pWwJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICfnvLrlsJHlv4XopoHlj4LmlbAnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlRXhwYW5kRXBpY1RpY2tldHMobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbilcbiAgICAgICAgICAgICAgICAudGhlbigoKSA9PiBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+WkhOeQhiBFWFBBTkRfRVBJQ19USUNLRVRTIOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg5bGV5byAIEVwaWMg5aSx6LSlOiAke2Vycm9yLm1lc3NhZ2UgfHwgZXJyb3J9YCwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCBTdHJpbmcoZXJyb3IpIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+acquWkhOeQhueahOa2iOaBr+exu+WeizonLCB0eXBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG4vLyDliJvlu7ogSlFMIOafpeivouWvueivneahhlxuYXN5bmMgZnVuY3Rpb24gb3BlbkpxbERpYWxvZyh1cmw6IHN0cmluZywgc2hlZXRUb2tlbjogc3RyaW5nKSB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgIGA7XG5cbiAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwO1wiPui+k+WFpSBKUUwg5p+l6K+iPC9oMz5cbiAgICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj48L3RleHRhcmVhPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcIj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxcIiBzdHlsZT1cIm1hcmdpbi1yaWdodDogMTBweDtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzdWJtaXRcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgYDtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgIC8vIOa3u+WKoOS6i+S7tuebkeWQrOWZqFxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWwnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3VibWl0Jyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBqcWwgPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pxbCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQpLnZhbHVlO1xuICAgICAgICBpZiAoanFsKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5q2j5Zyo5p+l6K+iIEppcmEuLi4nKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXRzID0gYXdhaXQgZmV0Y2hKaXJhVGlja2V0cyhqcWwpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd0aWNrZXRzJywgdGlja2V0cyk7XG4gICAgICAgICAgICAgICAgaWYgKCF0aWNrZXRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+ayoeacieaJvuWIsOaVsOaNricsICd3YXJuaW5nJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXNoZWV0VG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5Ymq5YiH5p2/5qih5byPXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXR0ZWREYXRhID0gW2hlYWRlcnMuam9pbignXFx0JyksIC4uLnRpY2tldHMubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWBcbiAgICAgICAgICAgICAgICAgICAgICB9KSkubWFwKHRpY2tldCA9PiBoZWFkZXJzLm1hcChmaWVsZCA9PiB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJycpLmpvaW4oJ1xcdCcpKV0uam9pbignXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkRGF0YScsIGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0ppcmEg5pWw5o2u5bey5aSN5Yi25Yiw5Ymq6LS05p2/JywgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyDmjqXlj6PmqKHlvI9cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF1cmwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn57y65bCR6KGo5qC8IFVSTCcsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXQgPSBuZXcgU2hlZXQodXJsLCBzaGVldFRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0LmluaXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlcyA9IGF3YWl0IHNoZWV0LnJlYWRTaGVldCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3ZhbHVlcycsIHZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGVldEhlYWRlcnMgPSBhd2FpdCBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkaXNwbGF5SGVhZGVycyA9IFsna2V5JywgJ3N1bW1hcnknLCAnc3RhdHVzJywgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJ107IFxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXlDb2x1bW5JbmRleCA9IHNoZWV0SGVhZGVycy5rZXkgPyBnZXRDb2x1bW5JbmRleChzaGVldEhlYWRlcnMua2V5KSA6IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGtleUNvbHVtbkluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZmVycmVkS2V5SW5kZXggPSB2YWx1ZXNbMF0/LmZpbmRJbmRleCgoaGVhZGVyOiBzdHJpbmcpID0+IGhlYWRlci50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdrZXknKSB8fCBoZWFkZXIudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnamlyYScpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5mZXJyZWRLZXlJbmRleCAhPT0gLTEgJiYgaW5mZXJyZWRLZXlJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoZWV0SGVhZGVycy5rZXkgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDY1ICsgaW5mZXJyZWRLZXlJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihg5pyq5Zyo6YWN572u5Lit5om+5YiwIEtleSDliJfvvIzlt7Lmjqjmlq3kuLrliJcgJHtzaGVldEhlYWRlcnMua2V5fWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign5pyq5om+5Yiw5oiW5peg5rOV5o6o5patIEppcmEgS2V5IOWIl++8jOivt+ajgOafpeihqOWktOaIlumFjee9ricpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5VG9Sb3dNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVzLnNsaWNlKDEpLmZvckVhY2goKHJvdzogc3RyaW5nW10sIGluZGV4OiBudW1iZXIpID0+IHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5Q2VsbCA9IHJvd1tnZXRDb2x1bW5JbmRleChzaGVldEhlYWRlcnMua2V5ISldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQga2V5ID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXlDZWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGtleUNlbGwubWF0Y2goL2Jyb3dzZVxcLyhbQS1aMC05XSstWzAtOV0rKS9pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgvXltBLVowLTldKy1bMC05XSskL2kudGVzdChrZXlDZWxsLnRyaW0oKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBrZXlDZWxsLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5VG9Sb3dNYXAuc2V0KGtleSwgaW5kZXggKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3BlcmF0aW9uczogVGlja2V0T3BlcmF0aW9uW10gPSB0aWNrZXRzLm1hcCh0aWNrZXQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nUm93SW5kZXggPSBrZXlUb1Jvd01hcC5nZXQodGlja2V0LmtleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBleGlzdGluZ1Jvd0luZGV4ICE9PSB1bmRlZmluZWQgPyAndXBkYXRlJyA6ICdhcHBlbmQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dJbmRleDogZXhpc3RpbmdSb3dJbmRleFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29uZmlybWVkT3BlcmF0aW9ucyA9IGF3YWl0IHNob3dDb25maXJtYXRpb25EaWFsb2cob3BlcmF0aW9ucywgZGlzcGxheUhlYWRlcnMsIHNoZWV0SGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25maXJtZWRPcGVyYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5pON5L2c5bey5Y+W5raIJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnMoZGlhbG9nKSkgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlc0RhdGE6IFVwZGF0ZURhdGFbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXBwZW5kRGF0YTogc3RyaW5nW11bXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlclZhbHVlcyA9IE9iamVjdC52YWx1ZXMoc2hlZXRIZWFkZXJzKS5maWx0ZXIoKHZhbHVlKTogdmFsdWUgaXMgc3RyaW5nID0+IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1heENvbEluZGV4ID0gZ2V0TWF4Q29sdW1uSW5kZXgoaGVhZGVyVmFsdWVzKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlybWVkT3BlcmF0aW9ucy5mb3JFYWNoKG9wZXJhdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gbmV3IEFycmF5KG1heENvbEluZGV4KS5maWxsKCcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5SGVhZGVycy5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gc2hlZXRIZWFkZXJzW2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29sdW1uTGV0dGVyICYmIHR5cGVvZiBjb2x1bW5MZXR0ZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbEluZGV4ID0gZ2V0Q29sdW1uSW5kZXgoY29sdW1uTGV0dGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGQgPT09ICdrZXknKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke29wZXJhdGlvbi50aWNrZXQua2V5fVwiLCBcIiR7b3BlcmF0aW9uLnRpY2tldC5rZXl9XCIpYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gb3BlcmF0aW9uLnRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYOWkhOeQhuWIlyAke2NvbHVtbkxldHRlcn0gKOWtl+autSAke2ZpZWxkfSkg5pe25Ye66ZSZOmAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wZXJhdGlvbi50eXBlID09PSAndXBkYXRlJyAmJiBvcGVyYXRpb24ucm93SW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBvcGVyYXRpb24ucm93SW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiByb3dcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwZW5kRGF0YS5wdXNoKHJvdyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfmm7TmlrDmlbDmja46JywgdXBkYXRlc0RhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+i/veWKoOaVsOaNrjonLCBhcHBlbmREYXRhKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHVwZGF0ZWRDb3VudCA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgYXBwZW5kZWRDb3VudCA9IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cGRhdGVzRGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGUgb2YgdXBkYXRlc0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRDb2x1bW4gPSAnQSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhbmdlID0gYCR7c3RhcnRDb2x1bW59JHt1cGRhdGUucm93SW5kZXh9YDsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGluZyByYW5nZTogJHtyYW5nZX1gLCB1cGRhdGUuZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChbdXBkYXRlLmRhdGFdLCByYW5nZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWRDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFwcGVuZERhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0UG9zaXRpb24gPSBgQSR7dmFsdWVzLmxlbmd0aCArIDF9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQXBwZW5kaW5nIGRhdGEgc3RhcnRpbmcgZnJvbTogJHtzdGFydFBvc2l0aW9ufWAsIGFwcGVuZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0LndyaXRlU2hlZXQoYXBwZW5kRGF0YSwgc3RhcnRQb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwZW5kZWRDb3VudCA9IGFwcGVuZERhdGEubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG9hc3RNZXNzYWdlID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlZENvdW50ID4gMCkgdG9hc3RNZXNzYWdlICs9IGDlt7Lmm7TmlrAgJHt1cGRhdGVkQ291bnR9IOadoeaVsOaNruOAgmA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXBwZW5kZWRDb3VudCA+IDApIHRvYXN0TWVzc2FnZSArPSBg5bey6L+95YqgICR7YXBwZW5kZWRDb3VudH0g5p2h5paw5pWw5o2u44CCYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0b2FzdE1lc3NhZ2UgPT09ICcnKSB0b2FzdE1lc3NhZ2UgPSAn5rKh5pyJ6ZyA6KaB5pu05paw5oiW6L+95Yqg55qE5pWw5o2u44CCJztcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KHRvYXN0TWVzc2FnZS50cmltKCksICdzdWNjZXNzJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0dvb2dsZSBTaGVldHMg5pON5L2c5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgnR29vZ2xlIFNoZWV0cyDmk43kvZzlpLHotKU6ICcgKyAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvciksICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xor6LmiJblpITnkIblpLHotKU6ICcsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmn6Xor6LmiJblpITnkIblpLHotKU6ICcgKyAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvciksICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+ivt+i+k+WFpSBKUUwg5p+l6K+i6K+t5Y+lJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5pbnRlcmZhY2UgSmlyYUhlYWRlcnMge1xuICAgIGtleT86IHN0cmluZztcbiAgICBzdW1tYXJ5Pzogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIGlzc3VldHlwZT86IHN0cmluZztcbiAgICBwcmlvcml0eT86IHN0cmluZztcbiAgICBhc3NpZ25lZT86IHN0cmluZztcbiAgICByZXBvcnRlcj86IHN0cmluZztcbiAgICBsYWJlbHM/OiBzdHJpbmc7XG4gICAgY29tcG9uZW50cz86IHN0cmluZztcbiAgICBmaXhWZXJzaW9ucz86IHN0cmluZztcbiAgICBhZmZlY3RzVmVyc2lvbnM/OiBzdHJpbmc7XG4gICAgbGlua2VkSXNzdWVzPzogc3RyaW5nO1xuICAgIGVwaWNMaW5rPzogc3RyaW5nO1xuICAgIHNwcmludD86IHN0cmluZztcbiAgICBzdG9yeVBvaW50cz86IHN0cmluZztcbiAgICBzdGF0dXM/OiBzdHJpbmc7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgVXBkYXRlRGF0YSB7XG4gICAgcm93SW5kZXg6IG51bWJlcjtcbiAgICBkYXRhOiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIFRpY2tldE9wZXJhdGlvbiB7XG4gICAgdGlja2V0OiBKaXJhVGlja2V0O1xuICAgIHR5cGU6ICd1cGRhdGUnIHwgJ2FwcGVuZCc7XG4gICAgcm93SW5kZXg/OiBudW1iZXI7XG59XG5cbi8vIOafpeaJvuacieaViOeahEppcmHlrZfmrrXooajlpLRcbmFzeW5jIGZ1bmN0aW9uIGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0OiBTaGVldCk6IFByb21pc2U8SmlyYUhlYWRlcnM+IHtcbiAgICB0cnkge1xuICAgICAgICBsZXQgaGVhZGVyTWFwcGluZzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgICAgICBjb25zdCBjdXN0b21GaWVsZE1hcHBpbmc6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWdEYXRhID0gYXdhaXQgc2hlZXQucmVhZENvbmZpZ1NoZWV0KCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29uZmlnRGF0YScsIGNvbmZpZ0RhdGEpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZ0RhdGEgJiYgY29uZmlnRGF0YS5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVySW5kZXggPSBjb25maWdEYXRhWzBdLmZpbmRJbmRleCgoaDogc3RyaW5nKSA9PiBoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3NoZWV0IGhlYWRlcicpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBqaXJhRmllbGRJbmRleCA9IGNvbmZpZ0RhdGFbMF0uZmluZEluZGV4KChoOiBzdHJpbmcpID0+IGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnamlyYSBmaWVsZCcpKTtcblxuICAgICAgICAgICAgICAgIGlmIChzaGVldEhlYWRlckluZGV4ID09PSAtMSB8fCBqaXJhRmllbGRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfphY3nva7ooajkuK3mnKrmib7liLAgXCJTaGVldCBIZWFkZXJcIiDmiJYgXCJKaXJhIEZpZWxkXCIg5YiX77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb25maWcgc2hlZXQgaGVhZGVycycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgY29uZmlnRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBjb25maWdEYXRhW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAocm93Lmxlbmd0aCA+IE1hdGgubWF4KHNoZWV0SGVhZGVySW5kZXgsIGppcmFGaWVsZEluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXIgPSByb3dbc2hlZXRIZWFkZXJJbmRleF0/LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGppcmFGaWVsZCA9IHJvd1tqaXJhRmllbGRJbmRleF0/LnRyaW0oKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNoZWV0SGVhZGVyICYmIGppcmFGaWVsZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2ppcmEga2V5JyB8fCBqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgamlyYUZpZWxkID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlck1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdjdXN0b21maWVsZF8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21GaWVsZE1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+S7jumFjee9ruihqOWKoOi9veeahOaYoOWwhDonLCBoZWFkZXJNYXBwaW5nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56Gu77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56GuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+ivu+WPlumFjee9ruihqOWksei0pe+8jOWwhuS9v+eUqOm7mOiupOWtl+auteWIq+WQjTonLCBlcnJvcik7XG4gICAgICAgICAgICBoZWFkZXJNYXBwaW5nID0ge1xuICAgICAgICAgICAgICAgICdrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGtleSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGxpbmsnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpc3N1ZSBrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnc3VtbWFyeSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAndGl0bGUnOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ+amguimgSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAnZGVzY3JpcHRpb24nOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICfmj4/ov7AnOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICd0eXBlJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ2lzc3VlIHR5cGUnOiAnaXNzdWV0eXBlJyxcbiAgICAgICAgICAgICAgICAn57G75Z6LJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ3ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAn5LyY5YWI57qnJzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAnYXNzaWduZWUnOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICfnu4/lip7kuronOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICdyZXBvcnRlcic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ+aKpeWRiuS6uic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICAgICfnirbmgIEnOiAnc3RhdHVzJyxcbiAgICAgICAgICAgICAgICAnbGFiZWxzJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ2xhYmVsJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ+agh+etvic6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnRzJzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnQnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ+aooeWdlyc6ICdjb21wb25lbnRzJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb25zJzogJ2ZpeFZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb24nOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICfkv67lpI3niYjmnKwnOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdhZmZlY3RzIHZlcnNpb25zJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2FmZmVjdCB2ZXJzaW9uJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+W9seWTjeeJiOacrCc6ICdhZmZlY3RzVmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdsaW5rZWQgaXNzdWVzJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ+WFs+iBlOmXrumimCc6ICdsaW5rZWRJc3N1ZXMnLFxuICAgICAgICAgICAgICAgICdlcGljIGxpbmsnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICdlcGljJzogJ2VwaWNMaW5rJyxcbiAgICAgICAgICAgICAgICAnc3ByaW50JzogJ3NwcmludCcsXG4gICAgICAgICAgICAgICAgJ+WGsuWIuic6ICdzcHJpbnQnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludHMnOiAnc3RvcnlQb2ludHMnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludCc6ICdzdG9yeVBvaW50cycsXG4gICAgICAgICAgICAgICAgJ+aVheS6i+eCuSc6ICdzdG9yeVBvaW50cydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoZWFkZXJzID0gYXdhaXQgc2hlZXQuZ2V0SGVhZGVycygpO1xuICAgICAgICBjb25zb2xlLmxvZygnU2hlZXQgSGVhZGVyczonLCBoZWFkZXJzKTtcbiAgICAgICAgY29uc3QgdmFsaWRIZWFkZXJzOiBKaXJhSGVhZGVycyA9IHt9O1xuXG4gICAgICAgIGNvbnN0IGtub3duRmllbGRzID0gW1xuICAgICAgICAgICAgJ2tleScsICdzdW1tYXJ5JywgJ2Rlc2NyaXB0aW9uJywgJ2lzc3VldHlwZScsICdwcmlvcml0eScsIFxuICAgICAgICAgICAgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJywgJ3N0YXR1cycsICdsYWJlbHMnLCAnY29tcG9uZW50cycsIFxuICAgICAgICAgICAgJ2ZpeFZlcnNpb25zJywgJ2FmZmVjdHNWZXJzaW9ucycsICdsaW5rZWRJc3N1ZXMnLCAnZXBpY0xpbmsnLCBcbiAgICAgICAgICAgICdzcHJpbnQnLCAnc3RvcnlQb2ludHMnXG4gICAgICAgIF07XG5cbiAgICAgICAgaGVhZGVycy5mb3JFYWNoKChoZWFkZXI6IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKCFoZWFkZXIpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckxvd2VyID0gaGVhZGVyLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZGV4KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdKSB7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGppcmFGaWVsZCA9IGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdO1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tqaXJhRmllbGRdKSB7XG4gICAgICAgICAgICAgICAgICAgICB2YWxpZEhlYWRlcnNbamlyYUZpZWxkXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDphY3nva4v5Yir5ZCN5Yy56YWNOiBcIiR7aGVhZGVyfVwiIC0+IFwiJHtqaXJhRmllbGR9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDliJcgJHtjb2x1bW5MZXR0ZXJ9IChcIiR7aGVhZGVyfVwiKSDnmoTliKvlkI0gXCIke2hlYWRlckxvd2VyfVwiIOS4juWIlyAke3ZhbGlkSGVhZGVyc1tqaXJhRmllbGRdfSDlhrLnqoHvvIzpg73mjIflkJEgXCIke2ppcmFGaWVsZH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGlyZWN0TWF0Y2ggPSBrbm93bkZpZWxkcy5maW5kKGZpZWxkID0+IGZpZWxkLnRvTG93ZXJDYXNlKCkgPT09IGhlYWRlckxvd2VyKTtcbiAgICAgICAgICAgIGlmIChkaXJlY3RNYXRjaCkge1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tkaXJlY3RNYXRjaF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOebtOaOpeWtl+auteWQjeWMuemFjTogXCIke2hlYWRlcn1cIiAtPiBcIiR7ZGlyZWN0TWF0Y2h9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihg5YiXICR7Y29sdW1uTGV0dGVyfSAoXCIke2hlYWRlcn1cIikg55qE55u05o6l5Yy56YWN5LiO5YiXICR7dmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXX0g5Yay56qB77yM6YO95oyH5ZCRIFwiJHtkaXJlY3RNYXRjaH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCF2YWxpZEhlYWRlcnMua2V5KSB7XG4gICAgICAgICAgICAgY29uc29sZS53YXJuKFwi5pyq6IO96Ieq5Yqo5pig5bCEICdrZXknIOWIl+OAguivt+ajgOafpeihqOWktOaIluWcqOmFjee9ruihqOS4reaYjuehruaMh+WumiAna2V5JyDmiJYgJ0ppcmEgS2V5J+OAglwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCfmnIDnu4jmnInmlYjooajlpLTmmKDlsIQ6JywgdmFsaWRIZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIHZhbGlkSGVhZGVycztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xmib7mnInmlYggSmlyYSDmoIfpopjml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICBzaG93VG9hc3QoJ+afpeaJvuihqOWktOaYoOWwhOaXtuWHuumUmTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJylcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb2x1bW5JbmRleChjb2x1bW46IHN0cmluZyk6IG51bWJlciB7XG4gICAgaWYgKCFjb2x1bW4gfHwgdHlwZW9mIGNvbHVtbiAhPT0gJ3N0cmluZycgfHwgIS9eW0EtWl0rJC8udGVzdChjb2x1bW4udG9VcHBlckNhc2UoKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDml6DmlYjnmoTliJfmoIfor4bnrKY6IFwiJHtjb2x1bW59XCJgKTtcbiAgICB9XG4gICAgY29uc3QgdXBwZXJDb2x1bW4gPSBjb2x1bW4udG9VcHBlckNhc2UoKTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXBwZXJDb2x1bW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaW5kZXggPSBpbmRleCAqIDI2ICsgKHVwcGVyQ29sdW1uLmNoYXJDb2RlQXQoaSkgLSA2NCk7XG4gICAgfVxuICAgIHJldHVybiBpbmRleCAtIDE7XG59XG5cbmZ1bmN0aW9uIGdldE1heENvbHVtbkluZGV4KGNvbHVtbkxldHRlcnM6IHN0cmluZ1tdKTogbnVtYmVyIHtcbiAgICAgaWYgKCFjb2x1bW5MZXR0ZXJzIHx8ICFBcnJheS5pc0FycmF5KGNvbHVtbkxldHRlcnMpIHx8IGNvbHVtbkxldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICByZXR1cm4gMDtcbiAgICAgfVxuICAgICBjb25zdCB2YWxpZExldHRlcnMgPSBjb2x1bW5MZXR0ZXJzLmZpbHRlcihoID0+IHR5cGVvZiBoID09PSAnc3RyaW5nJyAmJiAvXltBLVpdKyQvLnRlc3QoaC50b1VwcGVyQ2FzZSgpKSk7XG4gICAgIGlmICh2YWxpZExldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICAgY29uc3QgaW5kaWNlcyA9IHZhbGlkTGV0dGVycy5tYXAoY29sID0+IGdldENvbHVtbkluZGV4KGNvbCkpO1xuICAgICByZXR1cm4gTWF0aC5tYXgoLi4uaW5kaWNlcykgKyAxO1xufVxuXG4vLyDmmL7npLrnoa7orqTlvLnnqpdcbmFzeW5jIGZ1bmN0aW9uIHNob3dDb25maXJtYXRpb25EaWFsb2coXG4gICAgb3BlcmF0aW9uczogVGlja2V0T3BlcmF0aW9uW10sXG4gICAgZGlzcGxheUhlYWRlcnM6IHN0cmluZ1tdLFxuICAgIHNoZWV0SGVhZGVyczogSmlyYUhlYWRlcnNcbik6IFByb21pc2U8VGlja2V0T3BlcmF0aW9uW10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRpYWxvZy5pZCA9ICdqaXJhQ29uZmlybWF0aW9uRGlhbG9nJztcbiAgICAgICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgICAgIHdpZHRoOiA4MDBweDtcbiAgICAgICAgICAgIG1heC13aWR0aDogOTB2dztcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDgwdmg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgYDtcblxuICAgICAgICBjb25zdCBjb2x1bW5zVG9VcGRhdGUgPSBkaXNwbGF5SGVhZGVyc1xuICAgICAgICAgICAgLmZpbHRlcihmaWVsZCA9PiBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYUhlYWRlcnNdKVxuICAgICAgICAgICAgLm1hcChmaWVsZCA9PiBmaWVsZCk7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ291bnQgPSBvcGVyYXRpb25zLmZpbHRlcihvcCA9PiBvcC50eXBlID09PSAndXBkYXRlJykubGVuZ3RoO1xuICAgICAgICBjb25zdCBhcHBlbmRDb3VudCA9IG9wZXJhdGlvbnMuZmlsdGVyKG9wID0+IG9wLnR5cGUgPT09ICdhcHBlbmQnKS5sZW5ndGg7XG5cbiAgICAgICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZsZXgtc2hyaW5rOiAwO1wiPuehruiupOaVsOaNruaTjeS9nDwvaDM+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTVweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+5bCG6KaB5pON5L2c55qE5YiX77yaPC9zdHJvbmc+IFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPiR7Y29sdW1uc1RvVXBkYXRlLmpvaW4oJywgJyl9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzY2NjtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mm7TmlrDnjrDmnInmlbDmja7vvJoke3VwZGF0ZUNvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mlrDlop7mlbDmja7vvJoke2FwcGVuZENvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cInNlbGVjdEFsbFRpY2tldHNcIiBjaGVja2VkIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiA1cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIOWFqOmAiS/lj5bmtojlhajpgIlcbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXgtZ3JvdzogMTsgb3ZlcmZsb3cteTogYXV0bzsgYm9yZGVyOiAxcHggc29saWQgI2VlZTsgYm9yZGVyLXJhZGl1czogNHB4OyBtYXJnaW4tYm90dG9tOiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1wiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQgc3R5bGU9XCJwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IGJhY2tncm91bmQ6ICNmNWY1ZjU7IHotaW5kZXg6IDE7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyB3aWR0aDogNTBweDtcIj7pgInmi6k8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDgwcHg7XCI+5pON5L2cPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2Rpc3BsYXlIZWFkZXJzLm1hcChoZWFkZXIgPT4gYDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj4ke2hlYWRlcn08L3RoPmApLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICAgICAgJHtvcGVyYXRpb25zLm1hcCgob3AsIGluZGV4KSA9PiBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNlZWU7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cInRpY2tldC1jaGVja2JveFwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiIGNoZWNrZWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICR7b3AudHlwZSA9PT0gJ3VwZGF0ZScgPyAnI2YwYWQ0ZScgOiAnIzVjYjg1Yyd9OyBmb250LXdlaWdodDogYm9sZDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke29wLnR5cGUgPT09ICd1cGRhdGUnID8gJ+abtOaWsCcgOiAn5paw5aKeJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtkaXNwbGF5SGVhZGVycy5tYXAoZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gb3AudGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA+IDEwMCkgdmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMCwgOTcpICsgJy4uLic7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHdoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzOyBtYXgtd2lkdGg6IDIwMHB4O1wiIHRpdGxlPVwiJHtvcC50aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyd9XCI+JHt2YWx1ZX08L3RkPmA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDsgZ2FwOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogI2VlZTsgYm9yZGVyOiAxcHggc29saWQgI2NjYzsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNvbmZpcm1PcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjMDA3YmZmOyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+56Gu6K6kICgke29wZXJhdGlvbnMubGVuZ3RofSk8L2J1dHRvbj4gXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0QWxsQ2hlY2tib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VsZWN0QWxsVGlja2V0cycpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHRpY2tldENoZWNrYm94ZXMgPSBkaWFsb2cuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgndGlja2V0LWNoZWNrYm94JykgYXMgSFRNTENvbGxlY3Rpb25PZjxIVE1MSW5wdXRFbGVtZW50PjtcbiAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtT3BlcmF0aW9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50ID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDb3VudCA9IEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZmlsdGVyKGNiID0+IGNiLmNoZWNrZWQpLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSBg56Gu6K6kICgke3NlbGVjdGVkQ291bnR9KWA7XG4gICAgICAgICAgICBjb25maXJtQnV0dG9uLmRpc2FibGVkID0gc2VsZWN0ZWRDb3VudCA9PT0gMDtcbiAgICAgICAgfTtcblxuICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNoZWNrZWQgPSBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgIGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkID0gQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5ldmVyeShjYiA9PiBjYi5jaGVja2VkKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsT3BlcmF0aW9uJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpcm1CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZE9wZXJhdGlvbnMgPSBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjaGVja2JveCA9PiBjaGVja2JveC5jaGVja2VkKVxuICAgICAgICAgICAgICAgIC5tYXAoY2hlY2tib3ggPT4gb3BlcmF0aW9uc1twYXJzZUludChjaGVja2JveC5kYXRhc2V0LmluZGV4IHx8ICcwJyldKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxlY3RlZE9wZXJhdGlvbnMpO1xuICAgICAgICB9KTtcblxuICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTsgXG4gICAgfSk7XG59XG5cbi8vIOa3u+WKoOaYvuekuiB0b2FzdCDnmoTlh73mlbBcbmZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGUgPSAnaW5mbycpIHtcbiAgICBjb25zdCBleGlzdGluZ1RvYXN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYC5qaXJhLXRvYXN0LSR7dHlwZX1gKTtcbiAgICBleGlzdGluZ1RvYXN0cy5mb3JFYWNoKHQgPT4gdC5yZW1vdmUoKSk7XG5cbiAgICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRvYXN0LmNsYXNzTmFtZSA9IGBqaXJhLXRvYXN0LSR7dHlwZX1gO1xuICAgIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICBsZXQgYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMCwgMCwgMCwgMC43KSc7XG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDIyMCwgNTMsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnc3VjY2VzcycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDQwLCAxNjcsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnd2FybmluZycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDI1NSwgMTkzLCA3LCAwLjkpJztcblxuICAgIHRvYXN0LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogJHtiYWNrZ3JvdW5kQ29sb3J9O1xuICAgICAgICBjb2xvcjogJHt0eXBlID09PSAnd2FybmluZycgPyAnYmxhY2snIDogJ3doaXRlJ307XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCA1cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gICAgYDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgIH0pO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgICAgICB9LCAzMDApO1xuICAgIH0sIDMwMDApO1xufVxuXG4vLyDmlrDlop7vvJrlpITnkIblsZXlvIAgRXBpYyBUaWNrZXRzIOeahOWHveaVsFxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlRXhwYW5kRXBpY1RpY2tldHMoc2hlZXRVcmw6IHN0cmluZywgdG9rZW46IHN0cmluZykge1xuICAgIHNob3dUb2FzdCgn5byA5aeL5p+l5om+IEVwaWMg5bm26I635Y+W5a2Q5Lu75YqhLi4uJyk7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3Qgc2hlZXQgPSBuZXcgU2hlZXQoc2hlZXRVcmwsIHRva2VuKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBzaGVldC5pbml0KCk7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IGF3YWl0IHNoZWV0LnJlYWRTaGVldCgpO1xuICAgICAgICBpZiAoIXZhbHVlcyB8fCB2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+ihqOagvOS4uuepuuaIluaXoOazleivu+WPlicsICdlcnJvcicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNoZWV0SGVhZGVycyA9IGF3YWl0IGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0KTtcblxuICAgICAgICAvLyDmib7liLAga2V5IOWIl+eahOe0ouW8lVxuICAgICAgICBjb25zdCBrZXlDb2x1bW5JbmRleCA9IHNoZWV0SGVhZGVycy5rZXkgPyBnZXRDb2x1bW5JbmRleChzaGVldEhlYWRlcnMua2V5KSA6IC0xO1xuICAgICAgICBpZiAoa2V5Q29sdW1uSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+acquaJvuWIsCBKaXJhIEtleSDliJfvvIzor7fmo4Dmn6XooajlpLTmiJbphY3nva4nKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZygnSmlyYSBLZXkg5YiX57Si5byVOicsIGtleUNvbHVtbkluZGV4KTtcblxuICAgICAgICBjb25zdCBlcGljc1RvRXhwYW5kOiB7IGVwaWNLZXk6IHN0cmluZzsgZXBpY1N1bW1hcnk6IHN0cmluZzsgcm93SW5kZXg6IG51bWJlcjsgc3ViVGlja2V0czogSmlyYVRpY2tldFtdIH1bXSA9IFtdO1xuXG4gICAgICAgIC8vIOmBjeWOhuihqOagvOafpeaJviBFcGljIEtleSDlubbmn6Xor6LlrZDku7vliqFcbiAgICAgICAgLy8g5LuO56ys5LqM6KGM5byA5aeL77yM6Lez6L+H6KGo5aS0XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByb3cgPSB2YWx1ZXNbaV07XG4gICAgICAgICAgICBjb25zdCBrZXlDZWxsQ29udGVudCA9IHJvd1trZXlDb2x1bW5JbmRleF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOWwneivleS7jiBIWVBFUkxJTksg5oiW57qv5paH5pys5Lit5o+Q5Y+WIGtleVxuICAgICAgICAgICAgbGV0IGVwaWNLZXkgPSAnJztcbiAgICAgICAgICAgIGlmIChrZXlDZWxsQ29udGVudCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0ga2V5Q2VsbENvbnRlbnQubWF0Y2goL2Jyb3dzZVxcLyhbQS1aMC05XSstWzAtOV0rKS9pKTsgLy8g5o+Q5Y+WIGJyb3dzZS8g5ZCO6Z2i55qEIEtleVxuICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgIGVwaWNLZXkgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgvXltBLVowLTldKy1bMC05XSskL2kudGVzdChrZXlDZWxsQ29udGVudC50cmltKCkpKSB7IC8vIOWmguaenOaYr+e6ryBLZXlcbiAgICAgICAgICAgICAgICAgICAgZXBpY0tleSA9IGtleUNlbGxDb250ZW50LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIGlmIChlcGljS2V5KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOaJvuWIsCBLZXk6ICR7ZXBpY0tleX0g5Zyo6KGMICR7aSArIDF9YCk7XG4gICAgICAgICAgICAgICAgY29uc3QganFsID0gYGlzc3VlRnVuY3Rpb24gaW4gaXNzdWVzSW5FcGljcyhcImtleSA9ICR7ZXBpY0tleX1cIilgO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YlRpY2tldHMgPSBhd2FpdCBmZXRjaEppcmFUaWNrZXRzKGpxbCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWJUaWNrZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBFcGljICR7ZXBpY0tleX0g5pyJICR7c3ViVGlja2V0cy5sZW5ndGh9IOS4quWtkOS7u+WKoWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5bCd6K+V6I635Y+WIEVwaWMg55qE5qaC6KaB5L+h5oGv77yI5aaC5p6c5YW25LuW5YiX5a2Y5Zyo77yJXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdW1tYXJ5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMuc3VtbWFyeSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5zdW1tYXJ5KSA6IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXBpY1N1bW1hcnkgPSBzdW1tYXJ5Q29sdW1uSW5kZXggIT09IC0xICYmIHJvd1tzdW1tYXJ5Q29sdW1uSW5kZXhdID8gcm93W3N1bW1hcnlDb2x1bW5JbmRleF0gOiBlcGljS2V5OyAvLyBEZWZhdWx0IHRvIGtleSBpZiBzdW1tYXJ5IG1pc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgZXBpY3NUb0V4cGFuZC5wdXNoKHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXBpY0tleSwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXBpY1N1bW1hcnk6IGVwaWNTdW1tYXJ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBpLCAvLyAwLWJhc2VkIGluZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViVGlja2V0cyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBFcGljICR7ZXBpY0tleX0g5rKh5pyJ5a2Q5Lu75Yqh5oiW5LiN5pivIEVwaWNgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGZldGNoRXJyb3I6IEVycm9yIHwgYW55KSB7IC8vIFNwZWNpZnkgdHlwZSBmb3IgZmV0Y2hFcnJvclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGDmn6Xor6IgRXBpYyAke2VwaWNLZXl9IOeahOWtkOS7u+WKoeWksei0pTpgLCBmZXRjaEVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgLy8g6YCJ5oup5oCn5Zyw6YCa55+l55So5oi35oiW57un57ut5aSE55CG5LiL5LiA5LiqXG4gICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg5p+l6K+iICR7ZXBpY0tleX0g5a2Q5Lu75Yqh5aSx6LSlOiAke2ZldGNoRXJyb3IubWVzc2FnZSB8fCBmZXRjaEVycm9yfWAsICdlcnJvcicpOyAvLyBTaG93IGVycm9yIG1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGDooYwgJHtpICsgMX0g5pyq5om+5Yiw5pyJ5pWI55qEIEtleWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVwaWNzVG9FeHBhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+acquaJvuWIsOS7u+S9leWMheWQq+WtkOS7u+WKoeeahCBFcGljJywgJ2luZm8nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNob3dUb2FzdChg5om+5YiwICR7ZXBpY3NUb0V4cGFuZC5sZW5ndGh9IOS4qiBFcGljIOWMheWQq+WtkOS7u+WKoe+8jOWHhuWkh+ehruiupOaTjeS9nC4uLmApO1xuXG4gICAgICAgIC8vIC0tLSDkuIvkuIDmraU6IOS/ruaUueehruiupOWvueivneahhuW5tuWkhOeQhuaPkuWFpS/liIbnu4QgLS0tXG4gICAgICAgIGNvbnNvbGUubG9nKCflh4blpIfnoa7orqTnmoQgRXBpY3M6JywgZXBpY3NUb0V4cGFuZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjb25maXJtZWRFcGljcyA9IGF3YWl0IHNob3dFcGljQ29uZmlybWF0aW9uRGlhbG9nKGVwaWNzVG9FeHBhbmQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNvbmZpcm1lZEVwaWNzICYmIGNvbmZpcm1lZEVwaWNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGF3YWl0IGluc2VydFN1YlRpY2tldHMoc2hlZXQsIGNvbmZpcm1lZEVwaWNzLCBzaGVldEhlYWRlcnMsIGVudkNvbmZpZy5KSVJBX0JBU0VfVVJMKTtcbiAgICAgICAgICAgIHNob3dUb2FzdChg5bey5oiQ5Yqf5bGV5byAICR7Y29uZmlybWVkRXBpY3MubGVuZ3RofSDkuKogRXBpYyDnmoTlrZDku7vliqFgLCAnc3VjY2VzcycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfmk43kvZzlt7Llj5bmtognLCAnaW5mbycpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDkuLTml7bljaDkvY3nrKbvvIzooajnpLrmtYHnqIvov5vooYzliLDov5nph4xcbiAgICAgICAgc2hvd1RvYXN0KCflrZDku7vliqHmn6Xmib7lrozmiJDvvIznoa7orqTjgIHmj5LlhaXlkozliIbnu4Tlip/og73lvoXlrp7njrAnLCAnd2FybmluZycpO1xuXG5cbiAgICB9IGNhdGNoIChlcnJvcjogRXJyb3IgfCBhbnkpIHsgLy8gU3BlY2lmeSB0eXBlIGZvciBlcnJvclxuICAgICAgICBjb25zb2xlLmVycm9yKCflpITnkIYgRXBpYyDlsZXlvIDml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICBzaG93VG9hc3QoJ+WkhOeQhiBFcGljIOWxleW8gOaXtuWHuumUmTogJyArIChlcnJvci5tZXNzYWdlIHx8IGVycm9yKSwgJ2Vycm9yJyk7IC8vIFVzZSBlcnJvci5tZXNzYWdlIGlmIGF2YWlsYWJsZVxuICAgICAgICB0aHJvdyBlcnJvcjsgLy8gUmUtdGhyb3cgZXJyb3IgdG8gYmUgY2F1Z2h0IGJ5IHRoZSBjYWxsZXJcbiAgICB9XG59XG5cbi8vIEVwaWMg56Gu6K6k5a+56K+d5qGGXG5hc3luYyBmdW5jdGlvbiBzaG93RXBpY0NvbmZpcm1hdGlvbkRpYWxvZyhcbiAgICBlcGljczogeyBlcGljS2V5OiBzdHJpbmc7IGVwaWNTdW1tYXJ5OiBzdHJpbmc7IHJvd0luZGV4OiBudW1iZXI7IHN1YlRpY2tldHM6IEppcmFUaWNrZXRbXSB9W11cbik6IFByb21pc2U8dHlwZW9mIGVwaWNzPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBkaWFsb2cuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICAgIHRvcDogNTAlO1xuICAgICAgICAgICAgbGVmdDogNTAlO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwMDAxO1xuICAgICAgICAgICAgd2lkdGg6IDgwMHB4O1xuICAgICAgICAgICAgbWF4LXdpZHRoOiA5MHZ3O1xuICAgICAgICAgICAgbWF4LWhlaWdodDogODB2aDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICBgO1xuXG4gICAgICAgIGRpYWxvZy5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmbGV4LXNocmluazogMDtcIj7noa7orqTlsZXlvIAgRXBpYzwvaDM+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTVweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPlxuICAgICAgICAgICAgICAgICAgICDmib7liLAgJHtlcGljcy5sZW5ndGh9IOS4quWMheWQq+WtkOS7u+WKoeeahCBFcGljXG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyO1wiPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJzZWxlY3RBbGxFcGljc1wiIGNoZWNrZWQgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDVweDtcIj5cbiAgICAgICAgICAgICAgICAgICAg5YWo6YCJL+WPlua2iOWFqOmAiVxuICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJmbGV4LWdyb3c6IDE7IG92ZXJmbG93LXk6IGF1dG87IGJvcmRlcjogMXB4IHNvbGlkICNlZWU7IGJvcmRlci1yYWRpdXM6IDRweDsgbWFyZ2luLWJvdHRvbTogMTVweDtcIj5cbiAgICAgICAgICAgICAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTtcIj5cbiAgICAgICAgICAgICAgICAgICAgPHRoZWFkIHN0eWxlPVwicG9zaXRpb246IHN0aWNreTsgdG9wOiAwOyBiYWNrZ3JvdW5kOiAjZjVmNWY1OyB6LWluZGV4OiAxO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDUwcHg7XCI+6YCJ5oupPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7XCI+RXBpYzwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0O1wiPuWtkOS7u+WKoeaVsOmHjzwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgICAgICAgICAgICAke2VwaWNzLm1hcCgoZXBpYywgaW5kZXgpID0+IGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIgc3R5bGU9XCJib3JkZXItYm90dG9tOiAxcHggc29saWQgI2VlZTtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwiZXBpYy1jaGVja2JveFwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiIGNoZWNrZWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZXBpYy5lcGljS2V5fSAtICR7ZXBpYy5lcGljU3VtbWFyeX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtlcGljLnN1YlRpY2tldHMubGVuZ3RofSDkuKrlrZDku7vliqFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgYCkuam9pbignJyl9XG4gICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7IGdhcDogMTBweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNhbmNlbE9wZXJhdGlvblwiIHN0eWxlPVwicGFkZGluZzogNnB4IDEycHg7IGJhY2tncm91bmQ6ICNlZWU7IGJvcmRlcjogMXB4IHNvbGlkICNjY2M7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuWPlua2iDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjb25maXJtT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogIzAwN2JmZjsgY29sb3I6IHdoaXRlOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuehruiupDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG5cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaWFsb2cpO1xuXG4gICAgICAgIGNvbnN0IHNlbGVjdEFsbENoZWNrYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlbGVjdEFsbEVwaWNzJykgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICAgICAgY29uc3QgZXBpY0NoZWNrYm94ZXMgPSBkaWFsb2cuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnZXBpYy1jaGVja2JveCcpIGFzIEhUTUxDb2xsZWN0aW9uT2Y8SFRNTElucHV0RWxlbWVudD47XG4gICAgICAgIGNvbnN0IGNvbmZpcm1CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybU9wZXJhdGlvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG4gICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgIEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNoZWNrZWQgPSBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQgPSBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKS5ldmVyeShjYiA9PiBjYi5jaGVja2VkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsT3BlcmF0aW9uJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpcm1CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZEVwaWNzID0gQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcylcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGNoZWNrYm94ID0+IGNoZWNrYm94LmNoZWNrZWQpXG4gICAgICAgICAgICAgICAgLm1hcChjaGVja2JveCA9PiBlcGljc1twYXJzZUludChjaGVja2JveC5kYXRhc2V0LmluZGV4IHx8ICcwJyldKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxlY3RlZEVwaWNzKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbi8vIOaPkuWFpeWtkOS7u+WKoVxuYXN5bmMgZnVuY3Rpb24gaW5zZXJ0U3ViVGlja2V0cyhcbiAgICBzaGVldDogU2hlZXQsXG4gICAgZXBpY3M6IHsgZXBpY0tleTogc3RyaW5nOyBlcGljU3VtbWFyeTogc3RyaW5nOyByb3dJbmRleDogbnVtYmVyOyBzdWJUaWNrZXRzOiBKaXJhVGlja2V0W10gfVtdLFxuICAgIHNoZWV0SGVhZGVyczogSmlyYUhlYWRlcnMsXG4gICAgamlyYUJhc2VVcmw6IHN0cmluZ1xuKSB7XG4gICAgLy8g5oyJ6KGM5Y+35LuO5aSn5Yiw5bCP5o6S5bqP77yM6L+Z5qC35o+S5YWl5pe25LiN5Lya5b2x5ZON5ZCO57ut55qE6KGM5Y+3XG4gICAgY29uc3Qgc29ydGVkRXBpY3MgPSBbLi4uZXBpY3NdLnNvcnQoKGEsIGIpID0+IGIucm93SW5kZXggLSBhLnJvd0luZGV4KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVwaWMgb2Ygc29ydGVkRXBpY3MpIHtcbiAgICAgICAgY29uc3QgaW5zZXJ0Um93SW5kZXggPSBlcGljLnJvd0luZGV4ICsgMjsgLy8gKzIg5Zug5Li6IHJvd0luZGV4IOaYryAwLWJhc2Vk77yM5LiU5oiR5Lus6KaB5o+S5ZyoIEVwaWMg6KGM55qE5LiL5pa5XG4gICAgICAgIGNvbnN0IGRpc3BsYXlIZWFkZXJzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTtcbiAgICAgICAgY29uc3QgbWF4Q29sSW5kZXggPSBnZXRNYXhDb2x1bW5JbmRleChPYmplY3QudmFsdWVzKHNoZWV0SGVhZGVycykuZmlsdGVyKCh2YWx1ZSk6IHZhbHVlIGlzIHN0cmluZyA9PiBcbiAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUubGVuZ3RoID4gMFxuICAgICAgICApKTtcblxuICAgICAgICAvLyDlhYjmj5LlhaXnqbrooYxcbiAgICAgICAgY29uc3Qgcm93c1RvSW5zZXJ0ID0gZXBpYy5zdWJUaWNrZXRzLmxlbmd0aDtcbiAgICAgICAgaWYgKHJvd3NUb0luc2VydCA+IDApIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5zZXJ0RGltZW5zaW9uKCdST1dTJywgaW5zZXJ0Um93SW5kZXggLSAxLCBpbnNlcnRSb3dJbmRleCAtIDEgKyByb3dzVG9JbnNlcnQpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDlt7LlnKjooYwgJHtpbnNlcnRSb3dJbmRleH0g5o+S5YWlICR7cm93c1RvSW5zZXJ0fSDkuKrnqbrooYxgKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign5o+S5YWl56m66KGM5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOaPkuWFpeepuuihjOWksei0pTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdWJUaWNrZXRSb3dzID0gZXBpYy5zdWJUaWNrZXRzLm1hcCh0aWNrZXQgPT4ge1xuICAgICAgICAgICAgY29uc3Qgcm93ID0gbmV3IEFycmF5KG1heENvbEluZGV4KS5maWxsKCcnKTtcbiAgICAgICAgICAgIGRpc3BsYXlIZWFkZXJzLmZvckVhY2goZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbHVtbkxldHRlciA9IHNoZWV0SGVhZGVyc1tmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XTtcbiAgICAgICAgICAgICAgICBpZiAoY29sdW1uTGV0dGVyICYmIHR5cGVvZiBjb2x1bW5MZXR0ZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbEluZGV4ID0gZ2V0Q29sdW1uSW5kZXgoY29sdW1uTGV0dGVyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkID09PSAna2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IGA9SFlQRVJMSU5LKFwiJHtqaXJhQmFzZVVybH0vYnJvd3NlLyR7dGlja2V0LmtleX1cIiwgXCIke3RpY2tldC5rZXl9XCIpYDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByb3c7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIOWGmeWFpeWtkOS7u+WKoeaVsOaNrlxuICAgICAgICBjb25zdCBzdGFydFBvc2l0aW9uID0gYEEke2luc2VydFJvd0luZGV4fWA7XG4gICAgICAgIGF3YWl0IHNoZWV0LndyaXRlU2hlZXQoc3ViVGlja2V0Um93cywgc3RhcnRQb3NpdGlvbik7XG4gICAgICAgIGNvbnNvbGUubG9nKGDlt7LlnKjooYwgJHtpbnNlcnRSb3dJbmRleH0g5YaZ5YWlICR7c3ViVGlja2V0Um93cy5sZW5ndGh9IOS4quWtkOS7u+WKoWApO1xuICAgIH1cbn1cbiJdLCJuYW1lcyI6WyJnZXRFbnZDb25maWciLCJERUZBVUxUX0pJUkFfRklFTERTIiwiZmV0Y2hKaXJhVGlja2V0cyIsImpxbCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVxdWVzdElkIiwiTWF0aCIsInJhbmRvbSIsInRvU3RyaW5nIiwic3Vic3RyaW5nIiwibWVzc2FnZUxpc3RlbmVyIiwibWVzc2FnZSIsInR5cGUiLCJjaHJvbWUiLCJydW50aW1lIiwib25NZXNzYWdlIiwicmVtb3ZlTGlzdGVuZXIiLCJlcnJvciIsIkVycm9yIiwidGlja2V0cyIsImFkZExpc3RlbmVyIiwic2VuZE1lc3NhZ2UiLCJGRVRDSF9KSVJBX1RJQ0tFVFMiLCJzb3VyY2VUYWJJZCIsImVudkNvbmZpZyIsInVybCIsIkpJUkFfQkFTRV9VUkwiLCJlbmNvZGVVUklDb21wb25lbnQiLCJ0YWJzIiwiY3JlYXRlIiwiYWN0aXZlIiwidGFiIiwiaWQiLCJjaGVja1BhZ2VMb2FkIiwiZ2V0IiwidXBkYXRlZFRhYiIsInN0YXR1cyIsImluY2x1ZGVzIiwic2V0VGltZW91dCIsInVwZGF0ZSIsInNjcmlwdGluZyIsImV4ZWN1dGVTY3JpcHQiLCJ0YXJnZXQiLCJ0YWJJZCIsImZ1bmMiLCJpc0ppcmFDbG91ZCIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsInJvd3MiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGVuZ3RoIiwiZm9yRWFjaCIsInJvdyIsImtleUVsZW1lbnQiLCJzdW1tYXJ5RWxlbWVudCIsInN0YXR1c0NvbnRhaW5lciIsInN0YXR1c0VsZW1lbnQiLCJjZWxscyIsImFzc2lnbmVlIiwicmVwb3J0ZXIiLCJwcmlvcml0eSIsImNyZWF0ZWQiLCJ1cGRhdGVkIiwiZHVlZGF0ZSIsImFzc2lnbmVlU3BhbiIsImFzc2lnbmVlVGV4dCIsInRleHRDb250ZW50IiwidHJpbSIsIm1hdGNoIiwicmVwb3J0ZXJTcGFuIiwicmVwb3J0ZXJUZXh0IiwicHJpb3JpdHlTcGFuIiwiZHVlRGF0ZVRleHQiLCJ0aWNrZXQiLCJrZXkiLCJzdW1tYXJ5IiwiZGVzY3JpcHRpb24iLCJwdXNoIiwicmVzdWx0cyIsInJlc3VsdCIsIm1hcCIsInNwbGl0IiwicyIsImZpbHRlciIsIkJvb2xlYW4iLCJwb3AiLCJyZW1vdmUiLCJTaGVldCIsImNvbnN0cnVjdG9yIiwidG9rZW4iLCJzaGVldElkIiwiZXh0cmFjdFNoZWV0SWQiLCJnaWQiLCJleHRyYWN0R2lkIiwiaW5pdCIsImdldFRva2VuIiwic2hlZXROYW1lIiwiZ2V0U2hlZXROYW1lQnlHaWQiLCJpZGVudGl0eSIsImdldEF1dGhUb2tlbiIsImludGVyYWN0aXZlIiwibGFzdEVycm9yIiwiZ2V0U2hlZXROYW1lcyIsInJlcyIsImZldGNoIiwiaGVhZGVycyIsIkF1dGhvcml6YXRpb24iLCJqc29uIiwic2hlZXRzIiwic2hlZXQiLCJmaW5kIiwicHJvcGVydGllcyIsInRpdGxlIiwicmVhZFNoZWV0Iiwic2hlZXRVcmwiLCJ2YWx1ZXMiLCJ3cml0ZVNoZWV0IiwicG9zaXRpb24iLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJtZXRob2QiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsImluc2VydERpbWVuc2lvbiIsImRpbWVuc2lvbiIsInN0YXJ0SW5kZXgiLCJlbmRJbmRleCIsInJlcXVlc3QiLCJyZXF1ZXN0cyIsInJhbmdlIiwicGFyc2VJbnQiLCJpbmhlcml0RnJvbUJlZm9yZSIsImFkZERpbWVuc2lvbkdyb3VwIiwib2siLCJyZWFkQ29uZmlnU2hlZXQiLCJjb25maWdTaGVldE5hbWUiLCJjb25zb2xlIiwiZ2V0SGVhZGVycyIsImdldFNoZWV0TmFtZSIsImdldEluZGV4ZWREQkRhdGEiLCJkYXRhYmFzZU5hbWUiLCJzdG9yZU5hbWUiLCJpbmRleGVkREIiLCJvcGVuIiwib25zdWNjZXNzIiwiZXZlbnQiLCJkYiIsInRyYW5zYWN0aW9uIiwib2JqZWN0U3RvcmUiLCJkYXRhUmVxdWVzdCIsImdldEFsbCIsIm9uZXJyb3IiLCJnZXRMb2NhbFN0b3JhZ2VJdGVtIiwiZGVmYXVsdFZhbHVlIiwicGFyc2UiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwic2V0TG9jYWxTdG9yYWdlSXRlbSIsInNldEl0ZW0iLCJnZXRDdXJyZW50VXNlckluZm8iLCJleHRlbnNpb24iLCJleHRlbnNpb25JZCIsInVzZXJuYW1lIiwiZ2V0Rm9sZGVycyIsInRoZW4iLCJfcmVmIiwiZGF0YSIsImZhdm9yaXRlX2dyb3VwX2lkcyIsImNvbnZlcnNhdGlvbl9zZXRzIiwiZm9sZGVycyIsImlkcyIsIml0ZW0iLCJjYXRjaCIsImxvZyIsImdldEdyb3Vwc01hcCIsImdyb3VwcyIsImdyb3Vwc01hcCIsInJlZHVjZSIsImFjYyIsImdyb3VwIiwibmFtZSIsInNldF9hYmJyZXZpYXRpb24iLCJpc190ZWFtIiwiZm9ybWF0RGF0ZSIsImRhdGVTdHJpbmciLCJkYXRlIiwiRGF0ZSIsInllYXIiLCJnZXRGdWxsWWVhciIsIm1vbnRoIiwiU3RyaW5nIiwiZ2V0TW9udGgiLCJwYWRTdGFydCIsImRheSIsImdldERhdGUiLCJob3VycyIsImdldEhvdXJzIiwibWludXRlcyIsImdldE1pbnV0ZXMiLCJzZWNvbmRzIiwiZ2V0U2Vjb25kcyIsInVuaXFCeSIsImFycmF5Iiwic2VlbiIsIlNldCIsImtleVZhbHVlIiwiaGFzIiwiYWRkIiwic2hvd1RvYXN0Iiwib25DbG9zZSIsImNvbnRhaW5lciIsImdldEVsZW1lbnRCeUlkIiwiZXhpc3RpbmdUb2FzdCIsInJlbW92ZUNoaWxkIiwidG9hc3QiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwidG9hc3RJbm5lciIsImFwcGVuZENoaWxkIiwidGltZXIiLCJjb250YWlucyIsImNsZWFyVGltZW91dCIsInRyYW5zZm9ybUdyb3VwTGlua3MiLCJpbnB1dFN0cmluZyIsImdyb3VwTGlua1BhdHRlcm4iLCJ0cmFuc2Zvcm1lZFN0cmluZyIsInJlcGxhY2UiLCJncm91cE5hbWUiLCJncm91cElkIiwidHJhbnNmb3JtUG9zdExpbmtzIiwicG9zdExpbmtQYXR0ZXJuIiwiaW5kZXgiLCJwb3N0SWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwiZGVmYXVsdEVudkNvbmZpZyIsIlNDSEVEVUxFRF9JTlRFUlZBTCIsIk51bWJlciIsInByb2Nlc3MiLCJlbnYiLCJBTkFMWVNJU19UWVBFIiwiTExNX1RZUEUiLCJBTkFMWVpFX0JZX0dST1VQIiwiT0xMQU1BX0JBU0VfVVJMIiwiT0xMQU1BX01PREVMIiwiT0xMQU1BX1JFVklFV19NT0RFTCIsIk9MTEFNQV9RVUVSWV9NT0RFTCIsIkRJRllfQVBJX0tFWSIsIkRJRllfUkVWSUVXX0FQSV9LRVkiLCJESUZZX0FQSV9CQVNFX1VSTCIsIk9QRU5BSV9BUElfS0VZIiwiT1BFTkFJX01PREVMIiwiT1BFTkFJX1JFVklFV19NT0RFTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJHUk9RX0FQSV9LRVkiLCJHUk9RX01PREVMIiwiR1JPUV9SRVZJRVdfTU9ERUwiLCJCT1RfQVBJX0JBU0VfVVJMIiwiQk9UX1RPS0VOIiwiQk9UX0lEIiwiQk9UX1RZUEUiLCJURUFNX0lEIiwiRU5BQkxFX0JPVCIsIkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQiLCJFTkFCTEVfQ0hST01BIiwiQ0hST01BX0FQSV9VUkwiLCJDSFJPTUFfUE9SVCIsIkNIUk9NQV9DT0xMRUNUSU9OX05BTUUiLCJKSVJBX1VTRVJOQU1FIiwiSklSQV9BUElfVE9LRU4iLCJzdG9yYWdlIiwibG9jYWwiLCJnZXRVc2VySW5mbyIsImFjY291bnRVRCIsImFjY291bnRJbmZvTGlzdCIsImFjY291bnRJbmZvIiwiZGlzcGxheU5hbWUiLCJlbWFpbCIsImZ1bGxOYW1lIiwiam9pbiIsInRvTG93ZXJDYXNlIiwidXNlckluZm8iLCJzaGVldFRva2VuIiwic2VuZGVyIiwic2VuZFJlc3BvbnNlIiwid2FybiIsInN1Y2Nlc3MiLCJvcGVuSnFsRGlhbG9nIiwiaGFuZGxlRXhwYW5kRXBpY1RpY2tldHMiLCJkaWFsb2ciLCJzdHlsZSIsImNzc1RleHQiLCJpbm5lckhUTUwiLCJhZGRFdmVudExpc3RlbmVyIiwidmFsdWUiLCJmb3JtYXR0ZWREYXRhIiwiZmllbGQiLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJzaGVldEhlYWRlcnMiLCJmaW5kVmFsaWRKaXJhSGVhZGVycyIsImRpc3BsYXlIZWFkZXJzIiwia2V5Q29sdW1uSW5kZXgiLCJnZXRDb2x1bW5JbmRleCIsImluZmVycmVkS2V5SW5kZXgiLCJmaW5kSW5kZXgiLCJoZWFkZXIiLCJmcm9tQ2hhckNvZGUiLCJrZXlUb1Jvd01hcCIsIk1hcCIsInNsaWNlIiwia2V5Q2VsbCIsInRlc3QiLCJzZXQiLCJvcGVyYXRpb25zIiwiZXhpc3RpbmdSb3dJbmRleCIsInJvd0luZGV4IiwiY29uZmlybWVkT3BlcmF0aW9ucyIsInNob3dDb25maXJtYXRpb25EaWFsb2ciLCJ1cGRhdGVzRGF0YSIsImFwcGVuZERhdGEiLCJoZWFkZXJWYWx1ZXMiLCJPYmplY3QiLCJtYXhDb2xJbmRleCIsImdldE1heENvbHVtbkluZGV4Iiwib3BlcmF0aW9uIiwiQXJyYXkiLCJmaWxsIiwiY29sdW1uTGV0dGVyIiwiY29sSW5kZXgiLCJ1cGRhdGVkQ291bnQiLCJhcHBlbmRlZENvdW50Iiwic3RhcnRDb2x1bW4iLCJzdGFydFBvc2l0aW9uIiwidG9hc3RNZXNzYWdlIiwiaGVhZGVyTWFwcGluZyIsImN1c3RvbUZpZWxkTWFwcGluZyIsImNvbmZpZ0RhdGEiLCJzaGVldEhlYWRlckluZGV4IiwiaCIsImppcmFGaWVsZEluZGV4IiwiaSIsIm1heCIsInNoZWV0SGVhZGVyIiwiamlyYUZpZWxkIiwic3RhcnRzV2l0aCIsInZhbGlkSGVhZGVycyIsImtub3duRmllbGRzIiwiaGVhZGVyTG93ZXIiLCJkaXJlY3RNYXRjaCIsImNvbHVtbiIsInRvVXBwZXJDYXNlIiwidXBwZXJDb2x1bW4iLCJjaGFyQ29kZUF0IiwiY29sdW1uTGV0dGVycyIsImlzQXJyYXkiLCJ2YWxpZExldHRlcnMiLCJpbmRpY2VzIiwiY29sIiwiY29sdW1uc1RvVXBkYXRlIiwidXBkYXRlQ291bnQiLCJvcCIsImFwcGVuZENvdW50Iiwic2VsZWN0QWxsQ2hlY2tib3giLCJ0aWNrZXRDaGVja2JveGVzIiwiZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSIsImNvbmZpcm1CdXR0b24iLCJ1cGRhdGVDb25maXJtQnV0dG9uQ291bnQiLCJzZWxlY3RlZENvdW50IiwiZnJvbSIsImNiIiwiY2hlY2tlZCIsImRpc2FibGVkIiwiY2hlY2tib3giLCJldmVyeSIsInNlbGVjdGVkT3BlcmF0aW9ucyIsImRhdGFzZXQiLCJleGlzdGluZ1RvYXN0cyIsInQiLCJiYWNrZ3JvdW5kQ29sb3IiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJvcGFjaXR5IiwiZXBpY3NUb0V4cGFuZCIsImtleUNlbGxDb250ZW50IiwiZXBpY0tleSIsInN1YlRpY2tldHMiLCJzdW1tYXJ5Q29sdW1uSW5kZXgiLCJlcGljU3VtbWFyeSIsImZldGNoRXJyb3IiLCJjb25maXJtZWRFcGljcyIsInNob3dFcGljQ29uZmlybWF0aW9uRGlhbG9nIiwiaW5zZXJ0U3ViVGlja2V0cyIsImVwaWNzIiwiZXBpYyIsImVwaWNDaGVja2JveGVzIiwic2VsZWN0ZWRFcGljcyIsImppcmFCYXNlVXJsIiwic29ydGVkRXBpY3MiLCJzb3J0IiwiYSIsImIiLCJpbnNlcnRSb3dJbmRleCIsInJvd3NUb0luc2VydCIsInN1YlRpY2tldFJvd3MiXSwic291cmNlUm9vdCI6IiJ9