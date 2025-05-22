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
                      // 假设第5个单元格是assignee
                      const assigneeText = cells[4].textContent?.trim();
                      assignee = assigneeText.match(/^(.+?)\1+$/)[1] || assigneeText;
                      assignee = assignee !== 'Unassigned' ? assignee || '' : '';

                      // 假设第6个单元格是reporter
                      reporter = cells[5].textContent?.trim() || '';
                      reporter = reporter.match(/^(.+?)\1+$/)[1] || reporter;

                      // 假设第7个单元格是priority
                      priority = cells[6].textContent?.trim() || '';

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
                  const ticket = {};
                  const cells = row.querySelectorAll('td');
                  cells.forEach(cell => {
                    if (cell.classList && cell.classList.length > 0) {
                      let propertyName = cell.classList[0]; // Get the first class name
                      const img = cell.querySelector('img[alt]');
                      const value = cell.textContent?.trim() || (img ? img.getAttribute('alt') || '' : '');

                      // If the class name is 'issuekey', the property in our object should be 'key'
                      if (propertyName === 'issuekey') propertyName = 'key';
                      if (propertyName) {
                        // Ensure propertyName is not empty
                        ticket[propertyName] = value;
                      }
                    }
                  });

                  // Ensure essential non-optional fields from JiraTicket are present, even if empty
                  ticket.key = ticket.key || '';
                  ticket.summary = ticket.summary || '';
                  ticket.status = ticket.status || '';
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
/* harmony export */   getDefaultEnvConfig: () => (/* binding */ getDefaultEnvConfig),
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
  ANALYSIS_TYPE: "filter" || 0,
  LLM_TYPE: "dify" || 0,
  ANALYZE_BY_GROUP: "false" === "true",
  OLLAMA_BASE_URL: "http://localhost:11434" || 0,
  OLLAMA_MODEL: "deepseek-r1" || 0,
  OLLAMA_REVIEW_MODEL: "llama3.1" || 0,
  OLLAMA_QUERY_MODEL: "llama3.1" || 0,
  DIFY_API_KEY: "app-EQhkmjfMxIiyWWbMj9vz5vM9" || 0,
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
function getDefaultEnvConfig() {
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
        <textarea id="jql" style="width: 100%; height: 100px; margin-bottom: 10px;" placeholder="filter=xxxx"></textarea>
        <p style="font-size: 12px; color: #666; margin-top: -5px; margin-bottom: 10px;">请在 <a href="https://jira.ringcentral.com/issues/?jql=" target="_blank">filter 查询页面</a> 配置需要展示的 columns 且设为列表模式。</p>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <button id="updateExisting" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">刷新 Sheet 上 tickets 数据</button>
            <div>
                <button id="cancel" style="margin-right: 10px;">取消</button>
                <button id="submit">查询</button>
            </div>
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
        handleFetchJiraTicketsToSheet(jql, url, sheetToken);
      } catch (error) {
        console.error('查询或处理失败: ', error);
        showToast('查询或处理失败: ' + (error instanceof Error ? error.message : error), 'error');
      }
      if (document.body.contains(dialog)) document.body.removeChild(dialog);
    } else {
      showToast('请输入 JQL 查询语句', 'warning');
    }
  });

  // 添加更新现有 tickets 的事件监听器
  document.getElementById('updateExisting')?.addEventListener('click', async () => {
    if (!sheetToken || !url) {
      showToast('缺少表格 URL 或 token', 'error');
      return;
    }
    try {
      showToast('正在读取表格数据...');
      if (document.body.contains(dialog)) document.body.removeChild(dialog);
      const sheet = new _sheet__WEBPACK_IMPORTED_MODULE_1__.Sheet(url, sheetToken);
      await sheet.init();
      const values = await sheet.readSheet();
      const sheetHeaders = await findValidJiraHeaders(sheet);
      if (!values || values.length <= 1) {
        showToast('表格为空或只有表头', 'warning');
        return;
      }

      // 获取所有现有的 Jira keys
      const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
      if (keyColumnIndex === -1) {
        showToast('未找到 Jira Key 列', 'error');
        return;
      }
      const existingKeys = [];
      values.slice(1).forEach(row => {
        const keyCell = row[keyColumnIndex];
        if (keyCell) {
          const match = keyCell.match(/browse\/([A-Z0-9]+-[0-9]+)/i);
          if (match && match[1]) {
            existingKeys.push(match[1]);
          } else if (/^[A-Z0-9]+-[0-9]+$/i.test(keyCell.trim())) {
            existingKeys.push(keyCell.trim());
          }
        }
      });
      if (existingKeys.length === 0) {
        showToast('未找到有效的 Jira tickets', 'warning');
        return;
      }

      // 构建 JQL 查询
      const jql = `key in (${existingKeys.join(',')})`;
      handleFetchJiraTicketsToSheet(jql, url, sheetToken);
    } catch (error) {
      console.error('更新现有 tickets 失败:', error);
      showToast('更新失败: ' + (error instanceof Error ? error.message : error), 'error');
      if (document.body.contains(dialog)) document.body.removeChild(dialog);
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
        const sheetHeaderIndex = configData[0].findIndex(h => h.toLowerCase().includes('sheet column'));
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

// 从 Jira 查询 tickets 并更新到 Google Sheet
async function handleFetchJiraTicketsToSheet(jql, sheetUrl, sheetToken) {
  showToast('正在查询 Jira...');
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_2__.getEnvConfig)();
  const tickets = await (0,_jira__WEBPACK_IMPORTED_MODULE_0__.fetchJiraTickets)(jql);
  console.log('tickets', tickets);
  if (!tickets.length) {
    showToast('没有找到数据', 'warning');
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
    if (!sheetUrl) {
      throw new Error("缺少表格 URL");
    }
    const sheet = new _sheet__WEBPACK_IMPORTED_MODULE_1__.Sheet(sheetUrl, sheetToken);
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
      }
      const updatesData = [];
      const appendData = [];
      const headerValues = Object.values(sheetHeaders).filter(value => typeof value === 'string' && value.length > 0);
      const maxColIndex = getMaxColumnIndex(headerValues);
      confirmedOperations.forEach(operation => {
        const row = new Array(maxColIndex).fill('');
        Object.keys(operation.ticket).forEach(ticketKey => {
          const columnLetter = sheetHeaders[ticketKey];
          if (columnLetter && typeof columnLetter === 'string') {
            try {
              const colIndex = getColumnIndex(columnLetter);
              if (ticketKey === 'key') {
                row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${operation.ticket.key}", "${operation.ticket.key}")`;
              } else {
                row[colIndex] = operation.ticket[ticketKey] || '';
              }
            } catch (error) {
              console.error(`处理列 ${columnLetter} (字段 ${ticketKey}) 时出错:`, error);
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
          const range = `${startColumn}${update.rowIndex + 1}`;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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SyxDQUFDTyxVQUFVLENBQUNzUyxhQUFhLEVBQUV2QixhQUFhLENBQUM7SUFDcEQxUCxPQUFPLENBQUNxQyxHQUFHLENBQUMsT0FBTzBPLGNBQWMsT0FBT0UsYUFBYSxDQUFDMVcsTUFBTSxPQUFPLENBQUM7RUFDeEU7QUFDSixDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvamlyYS50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9zaGVldC50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9zdG9yYWdlLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3V0aWxzLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvY29udGVudFNjcmlwdEdvb2dsZVNoZWV0LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBKaXJhVGlja2V0IH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRFbnZDb25maWcgfSBmcm9tICcuL3V0aWxzJztcblxuLy8g5LuOIEppcmEg6aG16Z2i5oqT5Y+W5pWw5o2uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hKaXJhVGlja2V0cyhqcWw6IHN0cmluZyk6IFByb21pc2U8SmlyYVRpY2tldFtdPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdElkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDcpO1xuICAgICAgICBcbiAgICAgICAgLy8g55uR5ZCs5p2l6IeqIGJhY2tncm91bmQgc2NyaXB0IOeahOa2iOaBr1xuICAgICAgICBjb25zdCBtZXNzYWdlTGlzdGVuZXIgPSAobWVzc2FnZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAobWVzc2FnZS50eXBlID09PSAnSklSQV9USUNLRVRTX1JFU1VMVCcgJiYgbWVzc2FnZS5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCkge1xuICAgICAgICAgICAgICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihtZXNzYWdlTGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIGlmIChtZXNzYWdlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IobWVzc2FnZS5lcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUobWVzc2FnZS50aWNrZXRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihtZXNzYWdlTGlzdGVuZXIpO1xuICAgICAgICBcbiAgICAgICAgLy8g5Y+R6YCB5raI5oGv57uZIGJhY2tncm91bmQgc2NyaXB0IOadpeWIm+W7uuaWsOagh+etvumhtVxuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiAnRkVUQ0hfSklSQV9USUNLRVRTJyxcbiAgICAgICAgICAgIGpxbCxcbiAgICAgICAgICAgIHJlcXVlc3RJZFxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuLy8g54S25ZCO5ZyoIEZFVENIX0pJUkFfVElDS0VUUyDlh73mlbDkuK3kvb/nlKggc291cmNlVGFiSWRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBGRVRDSF9KSVJBX1RJQ0tFVFMoanFsOiBzdHJpbmcsIHJlcXVlc3RJZDogc3RyaW5nLCBzb3VyY2VUYWJJZDogbnVtYmVyKSB7XG4gIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICBjb25zdCB1cmwgPSBgJHtlbnZDb25maWcuSklSQV9CQVNFX1VSTH0vaXNzdWVzLz9qcWw9JHtlbmNvZGVVUklDb21wb25lbnQoanFsKX1gO1xuICAgICAgICBcbiAgLy8g5Yib5bu65paw5qCH562+6aG1XG4gIGNocm9tZS50YWJzLmNyZWF0ZSh7IHVybCwgYWN0aXZlOiBmYWxzZSB9LCAodGFiKSA9PiB7XG4gICAgICBpZiAoIXRhYi5pZCkge1xuICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICBlcnJvcjogJ+aXoOazleWIm+W7uuagh+etvumhtSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIOetieW+hemhtemdouWKoOi9veWujOaIkFxuICAgICAgY29uc3QgY2hlY2tQYWdlTG9hZCA9ICgpID0+IHtcbiAgICAgICAgICBjaHJvbWUudGFicy5nZXQodGFiLmlkISwgKHVwZGF0ZWRUYWIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKHVwZGF0ZWRUYWIuc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgICAgICAgICAgaWYgKHVwZGF0ZWRUYWIudXJsLmluY2x1ZGVzKCdsb2dpbicpIHx8IHVwZGF0ZWRUYWIudXJsLmluY2x1ZGVzKCdva3RhJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiAnamlyYSDpnIDopoHnmbvlvZXvvIzor7fnmbvlvZXlkI7ph43mlrDlsJ3or5UnXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IGNocm9tZS50YWJzLnVwZGF0ZSh0YWIuaWQhLCB7IGFjdGl2ZTogdHJ1ZSB9KSwgMzAwMCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAvLyDms6jlhaXlhoXlrrnohJrmnKxcbiAgICAgICAgICAgICAgICAgIGNocm9tZS5zY3JpcHRpbmcuZXhlY3V0ZVNjcmlwdCh7XG4gICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB7IHRhYklkOiB0YWIuaWQhIH0sXG4gICAgICAgICAgICAgICAgICAgICAgZnVuYzogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5Yik5pat5piv5ZCm5pivSmlyYSBDbG91ZOeJiOacrO+8jOmAmui/h+ajgOafpeeJueWumueahERPTeWFg+e0oOWIpOaWrVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0ppcmFDbG91ZCA9ICEhZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndGFibGVbZGF0YS12Yz1cImlzc3VlLXRhYmxlXCJdJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICEhZG9jdW1lbnQucXVlcnlTZWxlY3RvcigndGFibGVbYXJpYS1sYWJlbD1cIldvcmtcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0ppcmFDbG91ZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSmlyYSBDbG91ZCDniYjmnKznmoTpgInmi6nlmahcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0cltkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS51aS5pc3N1ZS1yb3dcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJvd3MgJiYgcm93cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOiOt+WPlmtleSAtIGFbZGF0YS10ZXN0aWQ9XCJuYXRpdmUtaXNzdWUtdGFibGUuY29tbW9uLnVpLmlzc3VlLWNlbGxzLmlzc3VlLWtleS5pc3N1ZS1rZXktY2VsbFwiXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXlFbGVtZW50ID0gcm93LnF1ZXJ5U2VsZWN0b3IoJ2FbZGF0YS10ZXN0aWQ9XCJuYXRpdmUtaXNzdWUtdGFibGUuY29tbW9uLnVpLmlzc3VlLWNlbGxzLmlzc3VlLWtleS5pc3N1ZS1rZXktY2VsbFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g6I635Y+Wc3VtbWFyeSAtIGFbZGF0YS10ZXN0aWQ9XCJuYXRpdmUtaXNzdWUtdGFibGUuY29tbW9uLnVpLmlzc3VlLWNlbGxzLmlzc3VlLXN1bW1hcnkuaXNzdWUtc3VtbWFyeS1jZWxsXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1bW1hcnlFbGVtZW50ID0gcm93LnF1ZXJ5U2VsZWN0b3IoJ2FbZGF0YS10ZXN0aWQ9XCJuYXRpdmUtaXNzdWUtdGFibGUuY29tbW9uLnVpLmlzc3VlLWNlbGxzLmlzc3VlLXN1bW1hcnkuaXNzdWUtc3VtbWFyeS1jZWxsXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDojrflj5ZzdGF0dXMgLSDnirbmgIHkvY3kuo7mnInnibnlrppjbGFzc+eahHNwYW7kuK1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHVzQ29udGFpbmVyID0gcm93LnF1ZXJ5U2VsZWN0b3IoJ2RpdltkYXRhLXRlc3RpZF49XCJpc3N1ZS5maWVsZHMuc3RhdHVzLmNvbW1vbi51aS5zdGF0dXMtbG96ZW5nZVwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0dXNFbGVtZW50ID0gc3RhdHVzQ29udGFpbmVyID8gc3RhdHVzQ29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2Rpdi5fNGN2cjFoNm8nKSA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDnu4/lip7kurrjgIHmiqXlkYrkurrlkozkvJjlhYjnuqfpgJrluLjkvY3kuo7nm7jlupTnmoTljZXlhYPmoLzkuK1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2VsbHMgPSByb3cucXVlcnlTZWxlY3RvckFsbCgndGQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFzc2lnbmVlID0gJycsIHJlcG9ydGVyID0gJycsIHByaW9yaXR5ID0gJycsIGNyZWF0ZWQgPSAnJywgdXBkYXRlZCA9ICcnLCBkdWVkYXRlID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDpgJrov4fkvY3nva7liKTmlq3lkITkuKrlrZfmrrVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNlbGxzLmxlbmd0aCA+PSAxMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysNeS4quWNleWFg+agvOaYr2Fzc2lnbmVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NpZ25lZVRleHQgPSBjZWxsc1s0XS50ZXh0Q29udGVudD8udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWUgPSBhc3NpZ25lZVRleHQubWF0Y2goL14oLis/KVxcMSskLylbMV0gfHwgYXNzaWduZWVUZXh0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWUgPSBhc3NpZ25lZSAhPT0gJ1VuYXNzaWduZWQnID8gYXNzaWduZWUgfHwgJycgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysNuS4quWNleWFg+agvOaYr3JlcG9ydGVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlciA9IGNlbGxzWzVdLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlciA9IHJlcG9ydGVyLm1hdGNoKC9eKC4rPylcXDErJC8pWzFdIHx8IHJlcG9ydGVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKw35Liq5Y2V5YWD5qC85pivcHJpb3JpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5ID0gY2VsbHNbNl0udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysOeS4quWNleWFg+agvOaYr2NyZWF0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWQgPSBjZWxsc1s4XS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKwxMOS4quWNleWFg+agvOaYr3VwZGF0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQgPSBjZWxsc1s5XS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKwxMeS4quWNleWFg+agvOaYr2R1ZWRhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGR1ZURhdGVUZXh0ID0gY2VsbHNbMTBdLnRleHRDb250ZW50Py50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdWVkYXRlID0gZHVlRGF0ZVRleHQgIT09ICdOb25lJyA/IGR1ZURhdGVUZXh0IHx8ICcnIDogJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleToga2V5RWxlbWVudCA/IGtleUVsZW1lbnQudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyA6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogc3VtbWFyeUVsZW1lbnQgPyBzdW1tYXJ5RWxlbWVudC50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnIDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHN0YXR1c0VsZW1lbnQgPyBzdGF0dXNFbGVtZW50LnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVlZGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnJyAvLyBDbG91ZOinhuWbvuS4remAmuW4uOS4jeaYvuekuuaPj+i/sFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5Y6f5pyJ55qEIEppcmEgT24tUHJlbWlzZSDniYjmnKznmoTpgInmi6nlmahcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3dzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndHIuaXNzdWVyb3cnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3MuZm9yRWFjaChyb3cgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXQ6IGFueSA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjZWxscyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCd0ZCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNlbGxzLmZvckVhY2goY2VsbCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2VsbC5jbGFzc0xpc3QgJiYgY2VsbC5jbGFzc0xpc3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBwcm9wZXJ0eU5hbWUgPSBjZWxsLmNsYXNzTGlzdFswXTsgLy8gR2V0IHRoZSBmaXJzdCBjbGFzcyBuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW1nID0gY2VsbC5xdWVyeVNlbGVjdG9yKCdpbWdbYWx0XScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gY2VsbC50ZXh0Q29udGVudD8udHJpbSgpIHx8IChpbWcgPyBpbWcuZ2V0QXR0cmlidXRlKCdhbHQnKSB8fCAnJyA6ICcnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHRoZSBjbGFzcyBuYW1lIGlzICdpc3N1ZWtleScsIHRoZSBwcm9wZXJ0eSBpbiBvdXIgb2JqZWN0IHNob3VsZCBiZSAna2V5J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eU5hbWUgPT09ICdpc3N1ZWtleScpIHByb3BlcnR5TmFtZSA9ICdrZXknO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eU5hbWUpIHsgLy8gRW5zdXJlIHByb3BlcnR5TmFtZSBpcyBub3QgZW1wdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRbcHJvcGVydHlOYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRW5zdXJlIGVzc2VudGlhbCBub24tb3B0aW9uYWwgZmllbGRzIGZyb20gSmlyYVRpY2tldCBhcmUgcHJlc2VudCwgZXZlbiBpZiBlbXB0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXQua2V5ID0gdGlja2V0LmtleSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0LnN1bW1hcnkgPSB0aWNrZXQuc3VtbWFyeSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0LnN0YXR1cyA9IHRpY2tldC5zdGF0dXMgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRpY2tldHM7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSwgKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5aSE55CG57uT5p6cXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHRzICYmIHJlc3VsdHNbMF0gJiYgcmVzdWx0c1swXS5yZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyDlr7lzdW1tYXJ55a2X5q616L+b6KGM6aKd5aSW5aSE55CG77yM56Gu5L+d5bmy5YeA55qE5paH5pysXG4gICAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1swXS5yZXN1bHQgPSByZXN1bHRzWzBdLnJlc3VsdC5tYXAodGlja2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiB0aWNrZXQuc3VtbWFyeS5zcGxpdCgnXFxuJykubWFwKChzOiBzdHJpbmcpID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbikucG9wKCkgfHwgdGlja2V0LnN1bW1hcnksXG4gICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiByZXN1bHRzWzBdLnJlc3VsdFxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIOWmguaenOayoeaciee7k+aenFxuICAgICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiBbXVxuICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyDlhbPpl60gSmlyYSDmoIfnrb7pobVcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMucmVtb3ZlKHRhYi5pZCEpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrUGFnZUxvYWQsIDEwMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNoZWNrUGFnZUxvYWQoKTtcbiAgfSk7XG59XG4iLCJleHBvcnQgY2xhc3MgU2hlZXQge1xuICBwcml2YXRlIHRva2VuOiBzdHJpbmc7XG4gIHByaXZhdGUgc2hlZXRJZDogc3RyaW5nO1xuICBwcml2YXRlIGdpZDogc3RyaW5nO1xuICBwcml2YXRlIHNoZWV0TmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHVybDogc3RyaW5nLCB0b2tlbjogc3RyaW5nKSB7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMuc2hlZXRJZCA9IHRoaXMuZXh0cmFjdFNoZWV0SWQodXJsKTtcbiAgICB0aGlzLmdpZCA9IHRoaXMuZXh0cmFjdEdpZCh1cmwpO1xuICB9XG4gICAgXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgaWYgKCF0aGlzLnRva2VuKSB0aGlzLnRva2VuID0gYXdhaXQgdGhpcy5nZXRUb2tlbigpO1xuICAgIHRoaXMuc2hlZXROYW1lID0gYXdhaXQgdGhpcy5nZXRTaGVldE5hbWVCeUdpZCh0aGlzLnRva2VuLCB0aGlzLnNoZWV0SWQsIHRoaXMuZ2lkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFRva2VuKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY2hyb21lLmlkZW50aXR5LmdldEF1dGhUb2tlbih7IGludGVyYWN0aXZlOiB0cnVlIH0sICh0b2tlbikgPT4ge1xuICAgICAgICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikgcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgICAgICBlbHNlIHJlc29sdmUodG9rZW4pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGV4dHJhY3RTaGVldElkKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL1xcL2RcXC8oW2EtekEtWjAtOS1fXSspLyk7XG4gICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBudWxsO1xuICB9XG5cbiAgZXh0cmFjdEdpZCh1cmw6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IG1hdGNoID0gdXJsLm1hdGNoKC9bIyZdZ2lkPShbMC05XSspLyk7XG4gICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBudWxsO1xuICB9XG5cbiAgYXN5bmMgZ2V0U2hlZXROYW1lcyh0b2tlbjogc3RyaW5nLCBzaGVldElkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHtzaGVldElkfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgIHJldHVybiBqc29uLnNoZWV0cztcbiAgfVxuXG4gIGFzeW5jIGdldFNoZWV0TmFtZUJ5R2lkKHRva2VuOiBzdHJpbmcsIHNoZWV0SWQ6IHN0cmluZywgZ2lkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHNoZWV0cyA9IGF3YWl0IHRoaXMuZ2V0U2hlZXROYW1lcyh0b2tlbiwgc2hlZXRJZCk7XG4gICAgY29uc3Qgc2hlZXQgPSBzaGVldHMuZmluZCgoczogYW55KSA9PiBzLnByb3BlcnRpZXMuc2hlZXRJZC50b1N0cmluZygpID09PSBnaWQpO1xuICAgIHJldHVybiBzaGVldCA/IHNoZWV0LnByb3BlcnRpZXMudGl0bGUgOiBzaGVldHNbMF0ucHJvcGVydGllcy50aXRsZTsgLy8g5aaC5p6c5om+5LiN5Yiw5a+55bqU55qEZ2lkLOi/lOWbnuesrOS4gOS4qnNoZWV055qE5ZCN56ewXG4gIH1cblxuICBhc3luYyByZWFkU2hlZXQoKTogUHJvbWlzZTxzdHJpbmdbXVtdPiB7XG4gICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHt0aGlzLnNoZWV0TmFtZX1gO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCB9XG4gICAgfSk7XG4gICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgcmV0dXJuIGpzb24udmFsdWVzO1xuICB9XG5cbiAgYXN5bmMgd3JpdGVTaGVldCh2YWx1ZXM6IHN0cmluZ1tdW10sIHBvc2l0aW9uID0gJ0ExJyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHt0aGlzLnNoZWV0TmFtZX0hJHtwb3NpdGlvbn0/dmFsdWVJbnB1dE9wdGlvbj1VU0VSX0VOVEVSRURgO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHZhbHVlcyB9KVxuICAgIH0pO1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9XG5cbiAgLy8g5o+S5YWl6KGM5oiW5YiXXG4gIGFzeW5jIGluc2VydERpbWVuc2lvbihkaW1lbnNpb246ICdST1dTJyB8ICdDT0xVTU5TJywgc3RhcnRJbmRleDogbnVtYmVyLCBlbmRJbmRleDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH06YmF0Y2hVcGRhdGVgO1xuICAgIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgICByZXF1ZXN0czogW3tcbiAgICAgICAgaW5zZXJ0RGltZW5zaW9uOiB7XG4gICAgICAgICAgcmFuZ2U6IHtcbiAgICAgICAgICAgIHNoZWV0SWQ6IHBhcnNlSW50KHRoaXMuZ2lkKSxcbiAgICAgICAgICAgIGRpbWVuc2lvbixcbiAgICAgICAgICAgIHN0YXJ0SW5kZXgsXG4gICAgICAgICAgICBlbmRJbmRleFxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5oZXJpdEZyb21CZWZvcmU6IHRydWVcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgYWRkRGltZW5zaW9uR3JvdXA6IHtcbiAgICAgICAgICByYW5nZToge1xuICAgICAgICAgICAgc2hlZXRJZDogcGFyc2VJbnQodGhpcy5naWQpLFxuICAgICAgICAgICAgZGltZW5zaW9uLFxuICAgICAgICAgICAgc3RhcnRJbmRleCxcbiAgICAgICAgICAgIGVuZEluZGV4XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH07XG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVxdWVzdClcbiAgICB9KTtcblxuICAgIGlmICghcmVzLm9rKSB7XG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOaPkuWFpee7tOW6puWksei0pTogJHtlcnJvci5lcnJvcj8ubWVzc2FnZSB8fCAn5pyq55+l6ZSZ6K+vJ31gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6K+75Y+W6YWN572u6KGo5pWw5o2uXG4gICAqIEBwYXJhbSBzaGVldE5hbWUg6YWN572u6KGo5ZCN56ewXG4gICAqIEByZXR1cm5zIOmFjee9ruihqOaVsOaNrlxuICAgKi9cbiAgYXN5bmMgcmVhZENvbmZpZ1NoZWV0KGNvbmZpZ1NoZWV0TmFtZSA9ICcnKTogUHJvbWlzZTxzdHJpbmdbXVtdPiB7XG4gICAgaWYgKCFjb25maWdTaGVldE5hbWUpIGNvbmZpZ1NoZWV0TmFtZSA9IHRoaXMuc2hlZXROYW1lICsgJ19jb25maWcnO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7Y29uZmlnU2hlZXROYW1lfWA7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICAgIHJldHVybiBqc29uLnZhbHVlcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign6K+75Y+W6YWN572u6KGo5aSx6LSlOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5booajmoLznmoTnrKzkuIDooYzkvZzkuLrooajlpLRcbiAgICogQHJldHVybnMg6KGo5aS05pWw57uEXG4gICAqL1xuICBhc3luYyBnZXRIZWFkZXJzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCB0aGlzLnJlYWRTaGVldCgpO1xuICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign6KGo5qC85Li656m6Jyk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXNbMF07XG4gIH1cblxuICBwdWJsaWMgZ2V0U2hlZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc2hlZXROYW1lO1xuICB9XG59IiwiZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4ZWREQkRhdGEoZGF0YWJhc2VOYW1lOiBzdHJpbmcsIHN0b3JlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oZGF0YWJhc2VOYW1lKTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbihbc3RvcmVOYW1lXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBkYXRhUmVxdWVzdCA9IG9iamVjdFN0b3JlLmdldEFsbCgpO1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgICAgICB9O1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn1cblxuXG5leHBvcnQgY29uc3QgZ2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8IEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IHNldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VXNlckluZm8oKSB7XG4gICAgY29uc3QgeyBleHRlbnNpb246IGV4dGVuc2lvbklkIH0gPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdvd25FeHRlbnNpb24nLCB7fSk7XG4gICAgY29uc3QgdXNlcm5hbWUgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdkaXNwbGF5TmFtZScsICdyYWRhci1wb2MnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBleHRlbnNpb25JZCxcbiAgICAgICAgdXNlcm5hbWVcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rm9sZGVycygpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdwcm9maWxlJykudGhlbigoW2RhdGFdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmYXZvcml0ZV9ncm91cF9pZHMgPSBkYXRhPy5mYXZvcml0ZV9ncm91cF9pZHMgfHwgW107XG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25fc2V0cyA9IGRhdGE/LmNvbnZlcnNhdGlvbl9zZXRzIHx8IFtdO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IFt7dGl0bGU6ICcgJywgaWRzOiBbXX0se3RpdGxlOiAnZmF2b3JpdGUnLCBpZHM6IGZhdm9yaXRlX2dyb3VwX2lkc30sIC4uLmNvbnZlcnNhdGlvbl9zZXRzLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2ZvbGRlcicpXVxuICAgICAgICAgICAgcmV0dXJuIGZvbGRlcnM7XG4gICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0R3JvdXBzTWFwKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ2dyb3VwJykudGhlbigoZ3JvdXBzKSA9PiB7XG4gICAgICAgIGNvbnN0IGdyb3Vwc01hcCA9IGdyb3Vwcy5yZWR1Y2UoKGFjYzogYW55LCBncm91cDogYW55KSA9PiB7XG4gICAgICAgICAgICBhY2NbZ3JvdXAuaWRdID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLnNldF9hYmJyZXZpYXRpb24sXG4gICAgICAgICAgICAgICAgaXNfdGVhbTogZ3JvdXAuaXNfdGVhbVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sIHt9KTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBzTWFwO1xuICAgIH0pO1xufSIsImltcG9ydCB7IGdldEN1cnJlbnRVc2VySW5mbywgZ2V0TG9jYWxTdG9yYWdlSXRlbSB9IGZyb20gXCIuL3N0b3JhZ2VcIjtcblxuLy8g546v5aKD6YWN572u57G75Z6L5a6a5LmJXG5leHBvcnQgaW50ZXJmYWNlIEVudkNvbmZpZ1R5cGUge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IG51bWJlcjtcbiAgQU5BTFlTSVNfVFlQRTogc3RyaW5nO1xuICBBTkFMWVpFX0JZX0dST1VQOiBib29sZWFuO1xuICBMTE1fVFlQRTogc3RyaW5nO1xuICBPTExBTUFfQkFTRV9VUkw6IHN0cmluZztcbiAgT0xMQU1BX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBzdHJpbmc7XG4gIERJRllfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX1JFVklFV19BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfS0VZOiBzdHJpbmc7XG4gIE9QRU5BSV9NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgR1JPUV9BUElfS0VZOiBzdHJpbmc7XG4gIEdST1FfTU9ERUw6IHN0cmluZztcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgQk9UX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBCT1RfVE9LRU46IHN0cmluZztcbiAgQk9UX0lEOiBzdHJpbmc7XG4gIEJPVF9UWVBFOiBzdHJpbmc7XG4gIFRFQU1fSUQ6IHN0cmluZztcbiAgRU5BQkxFX0JPVDogYm9vbGVhbjtcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogYm9vbGVhbjtcbiAgRU5BQkxFX0NIUk9NQTogYm9vbGVhbjtcbiAgQ0hST01BX0FQSV9VUkw6IHN0cmluZztcbiAgQ0hST01BX1BPUlQ6IG51bWJlcjtcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogc3RyaW5nO1xuICAvLyBKSVJB55u45YWz6YWN572uXG4gIEpJUkFfQkFTRV9VUkw/OiBzdHJpbmc7XG4gIEpJUkFfVVNFUk5BTUU/OiBzdHJpbmc7XG4gIEpJUkFfQVBJX1RPS0VOPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gICAgXG4gICAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBob3VycyA9IFN0cmluZyhkYXRlLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICBcbiAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9ICR7aG91cnN9OiR7bWludXRlc306JHtzZWNvbmRzfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnkoYXJyYXk6IGFueVtdLCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgcmV0dXJuIGFycmF5LmZpbHRlcihpdGVtID0+IHtcbiAgICAgIGNvbnN0IGtleVZhbHVlID0gaXRlbVtrZXldO1xuICAgICAgaWYgKHNlZW4uaGFzKGtleVZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLmFkZChrZXlWYWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgb25DbG9zZT86ICgpID0+IHZvaWQpIHtcbiAgLy8g6I635Y+W5oiW5Yib5bu65a655Zmo5YWD57SgXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyYWRhci1wb2MtcmVzdWx0Jyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm5cblxuICAvLyDnp7vpmaTnjrDmnInnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IGV4aXN0aW5nVG9hc3QgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLnJhZGFyLXBvYy10b2FzdCcpO1xuICBpZiAoZXhpc3RpbmdUb2FzdCkge1xuICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChleGlzdGluZ1RvYXN0KTtcbiAgfVxuXG4gIC8vIOWIm+W7uuaWsOeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHJhZGFyLXBvYy10b2FzdCByYWRhci1wb2MtdG9hc3QtJHt0eXBlfWA7XG5cbiAgY29uc3QgdG9hc3RJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdElubmVyLmNsYXNzTmFtZSA9ICdyYWRhci1wb2MtdG9hc3QtaW5uZXInO1xuICB0b2FzdElubmVyLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblxuICB0b2FzdC5hcHBlbmRDaGlsZCh0b2FzdElubmVyKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcblxuICAvLyDorr7nva7lrprml7blmajlnKggMyDnp5LlkI7lhbPpl60gVG9hc3RcbiAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH0sIDMwMDApO1xuXG4gIC8vIOi/lOWbnuS4gOS4quWHveaVsOS7peS+v+aJi+WKqOWFs+mXrSBUb2FzdFxuICByZXR1cm4gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtR3JvdXBMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IGdyb3VwTGlua1BhdHRlcm4gPSAvXFxbZ3JvdXA6KC4rKTooXFxkKylcXF0vZztcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKGdyb3VwTGlua1BhdHRlcm4sIChtYXRjaCwgZ3JvdXBOYW1lLCBncm91cElkKSA9PiB7XG4gICAgcmV0dXJuIGBbJHtncm91cE5hbWV9XSgvbWVzc2FnZXMvJHtncm91cElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtUG9zdExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgcG9zdExpbmtQYXR0ZXJuID0gL1xcW3Bvc3Q6KFxcZCspXFxdL2c7XG4gIGxldCBpbmRleCA9IDE7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShwb3N0TGlua1BhdHRlcm4sIChtYXRjaCwgcG9zdElkKSA9PiB7XG4gICAgcmV0dXJuIGBbWyR7aW5kZXgrK31dXSgvbCR7d2luZG93LmxvY2F0aW9uLnBhdGhuYW1lfS8ke3Bvc3RJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuLy8g6buY6K6k546v5aKD6YWN572uXG5leHBvcnQgY29uc3QgZGVmYXVsdEVudkNvbmZpZzogRW52Q29uZmlnVHlwZSA9IHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBOdW1iZXIocHJvY2Vzcy5lbnYuU0NIRURVTEVEX0lOVEVSVkFMKSB8fCAxMjAsXG4gIEFOQUxZU0lTX1RZUEU6IHByb2Nlc3MuZW52LkFOQUxZU0lTX1RZUEUgfHwgXCJmaWx0ZXJcIixcbiAgTExNX1RZUEU6IHByb2Nlc3MuZW52LkxMTV9UWVBFIHx8IFwiZGlmeVwiLFxuICBBTkFMWVpFX0JZX0dST1VQOiBwcm9jZXNzLmVudi5BTkFMWVpFX0JZX0dST1VQID09PSBcInRydWVcIixcbiAgT0xMQU1BX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PTExBTUFfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjExNDM0XCIsXG4gIE9MTEFNQV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX01PREVMIHx8IFwiZGVlcHNlZWstcjFcIixcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1JFVklFV19NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1FVRVJZX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgRElGWV9BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9SRVZJRVdfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuRElGWV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9LRVk6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZIHx8IFwiXCIsXG4gIE9QRU5BSV9NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBHUk9RX0FQSV9LRVk6IHByb2Nlc3MuZW52LkdST1FfQVBJX0tFWSB8fCBcIlwiLFxuICBHUk9RX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX01PREVMIHx8IFwiXCIsXG4gIEdST1FfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBCT1RfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5CT1RfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9ib3RtYW4uaW50LnJjbGFiZW52LmNvbS92MlwiLFxuICBCT1RfVE9LRU46IHByb2Nlc3MuZW52LkJPVF9UT0tFTiB8fCBcIlwiLFxuICBCT1RfSUQ6IHByb2Nlc3MuZW52LkJPVF9JRCB8fCBcIjQ3MDAzNzIwMjBAMzc0Mzk1MTAuYm90LmdsaXAubmV0XCIsXG4gIEJPVF9UWVBFOiBwcm9jZXNzLmVudi5CT1RfVFlQRSB8fCBcInVzZXJcIixcbiAgVEVBTV9JRDogcHJvY2Vzcy5lbnYuVEVBTV9JRCB8fCBcIlwiLFxuICBFTkFCTEVfQk9UOiBwcm9jZXNzLmVudi5FTkFCTEVfQk9UID09PSBcInRydWVcIixcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogcHJvY2Vzcy5lbnYuTExNX1JFVklFV19CRUZPUkVfU0VORCA9PT0gXCJ0cnVlXCIsXG4gIEVOQUJMRV9DSFJPTUE6IHByb2Nlc3MuZW52LkVOQUJMRV9DSFJPTUEgPT09IFwidHJ1ZVwiLFxuICBDSFJPTUFfQVBJX1VSTDogcHJvY2Vzcy5lbnYuQ0hST01BX0FQSV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgQ0hST01BX1BPUlQ6IE51bWJlcihwcm9jZXNzLmVudi5DSFJPTUFfUE9SVCkgfHwgODAwMCxcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogcHJvY2Vzcy5lbnYuQ0hST01BX0NPTExFQ1RJT05fTkFNRSB8fCBcIlwiLFxuICBKSVJBX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5KSVJBX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9qaXJhLnJpbmdjZW50cmFsLmNvbVwiLFxuICBKSVJBX1VTRVJOQU1FOiBwcm9jZXNzLmVudi5KSVJBX1VTRVJOQU1FIHx8IFwiXCIsXG4gIEpJUkFfQVBJX1RPS0VOOiBwcm9jZXNzLmVudi5KSVJBX0FQSV9UT0tFTiB8fCBcIlwiLFxufTtcblxuLy8g6I635Y+W546v5aKD6YWN572u77yM5aaC5p6c5Y+v6IO955qE6K+d5LuOIHN0b3JhZ2Ug6I635Y+W77yM5ZCm5YiZ5LuOIHByb2Nlc3MuZW52IOiOt+WPllxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEVudkNvbmZpZygpOiBQcm9taXNlPEVudkNvbmZpZ1R5cGU+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGVudkNvbmZpZyB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFsnZW52Q29uZmlnJ10pO1xuICAgIGlmIChlbnZDb25maWcpIHtcbiAgICAgIC8vIOWwhuWtmOWCqOeahOmFjee9ruS4jum7mOiupOmFjee9ruWQiOW5tu+8jOehruS/neaWsOWinueahOmFjee9rumhueS5n+S8muiiq+WMheWQq1xuICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdEVudkNvbmZpZywgLi4uZW52Q29uZmlnIH07XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+iOt+WPlumFjee9ruWksei0pTonLCBlcnJvcik7XG4gIH1cbiAgXG4gIC8vIOWmguaenOiOt+WPluWksei0peaIluayoeacieS/neWtmOeahOmFjee9ru+8jOi/lOWbnum7mOiupOWAvFxuICByZXR1cm4gZGVmYXVsdEVudkNvbmZpZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlZmF1bHRFbnZDb25maWcoKTogRW52Q29uZmlnVHlwZSB7XG4gIHJldHVybiBkZWZhdWx0RW52Q29uZmlnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckluZm8oKSB7XG4gIGNvbnN0IGFjY291bnRVRCA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2dsb2JhbC5hY2NvdW50LlVEJywgJycpO1xuICBjb25zdCBhY2NvdW50SW5mb0xpc3QgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdnbG9iYWwuYWNjb3VudC5BQ0NPVU5UX1NFU1NJT05fREFUQV9MSVNUJywge30pO1xuXG4gIGNvbnN0IGFjY291bnRJbmZvID0gYWNjb3VudFVEID8gYWNjb3VudEluZm9MaXN0W2FjY291bnRVRF0gOiBhY2NvdW50SW5mb0xpc3QuZmluZCgoaXRlbTphbnkpID0+IGl0ZW0uZGlzcGxheU5hbWUgIT0gJycpO1xuICBjb25zb2xlLmxvZygnYWNjb3VudEluZm9MaXN0JywgYWNjb3VudEluZm9MaXN0LCBhY2NvdW50SW5mbyk7XG4gIGlmIChhY2NvdW50SW5mbykgcmV0dXJuIHtcbiAgICBleHRlbnNpb25JZDogYWNjb3VudEluZm8uZXh0ZW5zaW9uSWQsXG4gICAgZW1haWw6IGFjY291bnRJbmZvLmVtYWlsLFxuICAgIGZ1bGxOYW1lOiBhY2NvdW50SW5mby5kaXNwbGF5TmFtZSxcbiAgICB1c2VybmFtZTogYWNjb3VudEluZm8uZW1haWwgPyBhY2NvdW50SW5mby5lbWFpbC50cmltKCkuc3BsaXQoJ0AnKVswXSA6IGFjY291bnRJbmZvLmRpc3BsYXlOYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSxcbiAgfVxuXG4gIGNvbnN0IHVzZXJJbmZvID0gZ2V0Q3VycmVudFVzZXJJbmZvKCk7XG4gIHJldHVybiB7XG4gICAgZXh0ZW5zaW9uSWQ6IHVzZXJJbmZvLmV4dGVuc2lvbklkLFxuICAgIGZ1bGxOYW1lOiB1c2VySW5mby51c2VybmFtZSxcbiAgICB1c2VybmFtZTogdXNlckluZm8udXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpLFxuICAgIGVtYWlsOiB1c2VySW5mby51c2VybmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJykgKyAnQHJpbmdjZW50cmFsLmNvbSdcbiAgfTtcbn1cblxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgeyBmZXRjaEppcmFUaWNrZXRzIH0gZnJvbSAnLi9qaXJhJztcbmltcG9ydCB7IFNoZWV0IH0gZnJvbSAnLi9zaGVldCc7XG5pbXBvcnQgeyBKaXJhVGlja2V0IH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRFbnZDb25maWcgfSBmcm9tICcuL3V0aWxzJztcblxuLy8gTWFpbiBsaXN0ZW5lclxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCfmlLbliLDmtojmga86JywgbWVzc2FnZSwgJ+WPkemAgeiAhTonLCBzZW5kZXIpO1xuXG4gICAgaWYgKCFtZXNzYWdlIHx8ICFtZXNzYWdlLnR5cGUpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCfmlLbliLDml6DmlYjmtojmga/moLzlvI8nKTtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAn5peg5pWI5raI5oGv5qC85byPJyB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgeyB0eXBlIH0gPSBtZXNzYWdlO1xuXG4gICAgaWYgKHR5cGUgPT09ICdPUEVOX0pJUkFfUVVFUllfRElBTE9HJykge1xuICAgICAgICBvcGVuSnFsRGlhbG9nKG1lc3NhZ2UudXJsLCBtZXNzYWdlLnNoZWV0VG9rZW4pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0VYUEFORF9FUElDX1RJQ0tFVFMnKSB7XG4gICAgICAgIGlmICghbWVzc2FnZS51cmwgfHwgIW1lc3NhZ2Uuc2hlZXRUb2tlbikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRVhQQU5EX0VQSUNfVElDS0VUUyDnvLrlsJEgdXJsIOaIliBzaGVldFRva2VuJyk7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeW/heimgeWPguaVsCcsICdlcnJvcicpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAn57y65bCR5b+F6KaB5Y+C5pWwJyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzKG1lc3NhZ2UudXJsLCBtZXNzYWdlLnNoZWV0VG9rZW4pXG4gICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSB9KSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCflpITnkIYgRVhQQU5EX0VQSUNfVElDS0VUUyDml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOWxleW8gCBFcGljIOWksei0pTogJHtlcnJvci5tZXNzYWdlIHx8IGVycm9yfWAsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKSB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfmnKrlpITnkIbnmoTmtojmga/nsbvlnos6JywgdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxuLy8g5Yib5bu6IEpRTCDmn6Xor6Llr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIG9wZW5KcWxEaWFsb2codXJsOiBzdHJpbmcsIHNoZWV0VG9rZW46IHN0cmluZykge1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIHRvcDogNTAlO1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgICAgIHdpZHRoOiA0MDBweDtcbiAgICBgO1xuXG4gICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDtcIj7ovpPlhaUgSlFMIOafpeivojwvaDM+XG4gICAgICAgIDx0ZXh0YXJlYSBpZD1cImpxbFwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwcHg7IG1hcmdpbi1ib3R0b206IDEwcHg7XCIgcGxhY2Vob2xkZXI9XCJmaWx0ZXI9eHh4eFwiPjwvdGV4dGFyZWE+XG4gICAgICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxMnB4OyBjb2xvcjogIzY2NjsgbWFyZ2luLXRvcDogLTVweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj7or7flnKggPGEgaHJlZj1cImh0dHBzOi8vamlyYS5yaW5nY2VudHJhbC5jb20vaXNzdWVzLz9qcWw9XCIgdGFyZ2V0PVwiX2JsYW5rXCI+ZmlsdGVyIOafpeivoumhtemdojwvYT4g6YWN572u6ZyA6KaB5bGV56S655qEIGNvbHVtbnMg5LiU6K6+5Li65YiX6KGo5qih5byP44CCPC9wPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOyBtYXJnaW4tYm90dG9tOiAxMHB4O1wiPlxuICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInVwZGF0ZUV4aXN0aW5nXCIgc3R5bGU9XCJiYWNrZ3JvdW5kOiAjMjhhNzQ1OyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgcGFkZGluZzogNnB4IDEycHg7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuWIt+aWsCBTaGVldCDkuIogdGlja2V0cyDmlbDmja48L2J1dHRvbj5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNhbmNlbFwiIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAxMHB4O1wiPuWPlua2iDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzdWJtaXRcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICBgO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaWFsb2cpO1xuXG4gICAgLy8g5re75Yqg5LqL5Lu255uR5ZCs5ZmoXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbmNlbCcpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnMoZGlhbG9nKSkge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJtaXQnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGpxbCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanFsJykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XG4gICAgICAgIGlmIChqcWwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlRmV0Y2hKaXJhVGlja2V0c1RvU2hlZXQoanFsLCB1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xor6LmiJblpITnkIblpLHotKU6ICcsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+afpeivouaIluWkhOeQhuWksei0pTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+ivt+i+k+WFpSBKUUwg5p+l6K+i6K+t5Y+lJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8g5re75Yqg5pu05paw546w5pyJIHRpY2tldHMg55qE5LqL5Lu255uR5ZCs5ZmoXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwZGF0ZUV4aXN0aW5nJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoIXNoZWV0VG9rZW4gfHwgIXVybCkge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfnvLrlsJHooajmoLwgVVJMIOaIliB0b2tlbicsICdlcnJvcicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5q2j5Zyo6K+75Y+W6KGo5qC85pWw5o2uLi4uJyk7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICBjb25zdCBzaGVldCA9IG5ldyBTaGVldCh1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgICAgICBjb25zdCBzaGVldEhlYWRlcnMgPSBhd2FpdCBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldCk7XG5cbiAgICAgICAgICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn6KGo5qC85Li656m65oiW5Y+q5pyJ6KGo5aS0JywgJ3dhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOiOt+WPluaJgOacieeOsOacieeahCBKaXJhIGtleXNcbiAgICAgICAgICAgIGNvbnN0IGtleUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLmtleSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkpIDogLTE7XG4gICAgICAgICAgICBpZiAoa2V5Q29sdW1uSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrmib7liLAgSmlyYSBLZXkg5YiXJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ0tleXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICB2YWx1ZXMuc2xpY2UoMSkuZm9yRWFjaCgocm93OiBzdHJpbmdbXSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleUNlbGwgPSByb3dba2V5Q29sdW1uSW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmIChrZXlDZWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0ga2V5Q2VsbC5tYXRjaCgvYnJvd3NlXFwvKFtBLVowLTldKy1bMC05XSspL2kpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0aW5nS2V5cy5wdXNoKG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgvXltBLVowLTldKy1bMC05XSskL2kudGVzdChrZXlDZWxsLnRyaW0oKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0aW5nS2V5cy5wdXNoKGtleUNlbGwudHJpbSgpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdLZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5pyq5om+5Yiw5pyJ5pWI55qEIEppcmEgdGlja2V0cycsICd3YXJuaW5nJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDmnoTlu7ogSlFMIOafpeivolxuICAgICAgICAgICAgY29uc3QganFsID0gYGtleSBpbiAoJHtleGlzdGluZ0tleXMuam9pbignLCcpfSlgO1xuICAgICAgICAgICAgaGFuZGxlRmV0Y2hKaXJhVGlja2V0c1RvU2hlZXQoanFsLCB1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcign5pu05paw546w5pyJIHRpY2tldHMg5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pu05paw5aSx6LSlOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogZXJyb3IpLCAnZXJyb3InKTtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5pbnRlcmZhY2UgSmlyYUhlYWRlcnMge1xuICAgIGtleT86IHN0cmluZztcbiAgICBzdW1tYXJ5Pzogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIGlzc3VldHlwZT86IHN0cmluZztcbiAgICBwcmlvcml0eT86IHN0cmluZztcbiAgICBhc3NpZ25lZT86IHN0cmluZztcbiAgICByZXBvcnRlcj86IHN0cmluZztcbiAgICBsYWJlbHM/OiBzdHJpbmc7XG4gICAgY29tcG9uZW50cz86IHN0cmluZztcbiAgICBmaXhWZXJzaW9ucz86IHN0cmluZztcbiAgICBhZmZlY3RzVmVyc2lvbnM/OiBzdHJpbmc7XG4gICAgbGlua2VkSXNzdWVzPzogc3RyaW5nO1xuICAgIGVwaWNMaW5rPzogc3RyaW5nO1xuICAgIHNwcmludD86IHN0cmluZztcbiAgICBzdG9yeVBvaW50cz86IHN0cmluZztcbiAgICBzdGF0dXM/OiBzdHJpbmc7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgVXBkYXRlRGF0YSB7XG4gICAgcm93SW5kZXg6IG51bWJlcjtcbiAgICBkYXRhOiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIFRpY2tldE9wZXJhdGlvbiB7XG4gICAgdGlja2V0OiBKaXJhVGlja2V0O1xuICAgIHR5cGU6ICd1cGRhdGUnIHwgJ2FwcGVuZCc7XG4gICAgcm93SW5kZXg/OiBudW1iZXI7XG59XG5cbi8vIOafpeaJvuacieaViOeahEppcmHlrZfmrrXooajlpLRcbmFzeW5jIGZ1bmN0aW9uIGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0OiBTaGVldCk6IFByb21pc2U8SmlyYUhlYWRlcnM+IHtcbiAgICB0cnkge1xuICAgICAgICBsZXQgaGVhZGVyTWFwcGluZzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgICAgICBjb25zdCBjdXN0b21GaWVsZE1hcHBpbmc6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWdEYXRhID0gYXdhaXQgc2hlZXQucmVhZENvbmZpZ1NoZWV0KCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29uZmlnRGF0YScsIGNvbmZpZ0RhdGEpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZ0RhdGEgJiYgY29uZmlnRGF0YS5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVySW5kZXggPSBjb25maWdEYXRhWzBdLmZpbmRJbmRleCgoaDogc3RyaW5nKSA9PiBoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3NoZWV0IGNvbHVtbicpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBqaXJhRmllbGRJbmRleCA9IGNvbmZpZ0RhdGFbMF0uZmluZEluZGV4KChoOiBzdHJpbmcpID0+IGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnamlyYSBmaWVsZCcpKTtcblxuICAgICAgICAgICAgICAgIGlmIChzaGVldEhlYWRlckluZGV4ID09PSAtMSB8fCBqaXJhRmllbGRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfphY3nva7ooajkuK3mnKrmib7liLAgXCJTaGVldCBIZWFkZXJcIiDmiJYgXCJKaXJhIEZpZWxkXCIg5YiX77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb25maWcgc2hlZXQgaGVhZGVycycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgY29uZmlnRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBjb25maWdEYXRhW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAocm93Lmxlbmd0aCA+IE1hdGgubWF4KHNoZWV0SGVhZGVySW5kZXgsIGppcmFGaWVsZEluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXIgPSByb3dbc2hlZXRIZWFkZXJJbmRleF0/LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGppcmFGaWVsZCA9IHJvd1tqaXJhRmllbGRJbmRleF0/LnRyaW0oKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNoZWV0SGVhZGVyICYmIGppcmFGaWVsZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2ppcmEga2V5JyB8fCBqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgamlyYUZpZWxkID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlck1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdjdXN0b21maWVsZF8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21GaWVsZE1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+S7jumFjee9ruihqOWKoOi9veeahOaYoOWwhDonLCBoZWFkZXJNYXBwaW5nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56Gu77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56GuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+ivu+WPlumFjee9ruihqOWksei0pe+8jOWwhuS9v+eUqOm7mOiupOWtl+auteWIq+WQjTonLCBlcnJvcik7XG4gICAgICAgICAgICBoZWFkZXJNYXBwaW5nID0ge1xuICAgICAgICAgICAgICAgICdrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGtleSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGxpbmsnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpc3N1ZSBrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnc3VtbWFyeSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAndGl0bGUnOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ+amguimgSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAnZGVzY3JpcHRpb24nOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICfmj4/ov7AnOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICd0eXBlJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ2lzc3VlIHR5cGUnOiAnaXNzdWV0eXBlJyxcbiAgICAgICAgICAgICAgICAn57G75Z6LJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ3ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAn5LyY5YWI57qnJzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAnYXNzaWduZWUnOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICfnu4/lip7kuronOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICdyZXBvcnRlcic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ+aKpeWRiuS6uic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICAgICfnirbmgIEnOiAnc3RhdHVzJyxcbiAgICAgICAgICAgICAgICAnbGFiZWxzJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ2xhYmVsJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ+agh+etvic6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnRzJzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnQnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ+aooeWdlyc6ICdjb21wb25lbnRzJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb25zJzogJ2ZpeFZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb24nOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICfkv67lpI3niYjmnKwnOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdhZmZlY3RzIHZlcnNpb25zJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2FmZmVjdCB2ZXJzaW9uJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+W9seWTjeeJiOacrCc6ICdhZmZlY3RzVmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdsaW5rZWQgaXNzdWVzJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ+WFs+iBlOmXrumimCc6ICdsaW5rZWRJc3N1ZXMnLFxuICAgICAgICAgICAgICAgICdlcGljIGxpbmsnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICdlcGljJzogJ2VwaWNMaW5rJyxcbiAgICAgICAgICAgICAgICAnc3ByaW50JzogJ3NwcmludCcsXG4gICAgICAgICAgICAgICAgJ+WGsuWIuic6ICdzcHJpbnQnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludHMnOiAnc3RvcnlQb2ludHMnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludCc6ICdzdG9yeVBvaW50cycsXG4gICAgICAgICAgICAgICAgJ+aVheS6i+eCuSc6ICdzdG9yeVBvaW50cydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoZWFkZXJzID0gYXdhaXQgc2hlZXQuZ2V0SGVhZGVycygpO1xuICAgICAgICBjb25zb2xlLmxvZygnU2hlZXQgSGVhZGVyczonLCBoZWFkZXJzKTtcbiAgICAgICAgY29uc3QgdmFsaWRIZWFkZXJzOiBKaXJhSGVhZGVycyA9IHt9O1xuXG4gICAgICAgIGNvbnN0IGtub3duRmllbGRzID0gW1xuICAgICAgICAgICAgJ2tleScsICdzdW1tYXJ5JywgJ2Rlc2NyaXB0aW9uJywgJ2lzc3VldHlwZScsICdwcmlvcml0eScsIFxuICAgICAgICAgICAgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJywgJ3N0YXR1cycsICdsYWJlbHMnLCAnY29tcG9uZW50cycsIFxuICAgICAgICAgICAgJ2ZpeFZlcnNpb25zJywgJ2FmZmVjdHNWZXJzaW9ucycsICdsaW5rZWRJc3N1ZXMnLCAnZXBpY0xpbmsnLCBcbiAgICAgICAgICAgICdzcHJpbnQnLCAnc3RvcnlQb2ludHMnXG4gICAgICAgIF07XG5cbiAgICAgICAgaGVhZGVycy5mb3JFYWNoKChoZWFkZXI6IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKCFoZWFkZXIpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckxvd2VyID0gaGVhZGVyLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZGV4KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdKSB7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGppcmFGaWVsZCA9IGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdO1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tqaXJhRmllbGRdKSB7XG4gICAgICAgICAgICAgICAgICAgICB2YWxpZEhlYWRlcnNbamlyYUZpZWxkXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDphY3nva4v5Yir5ZCN5Yy56YWNOiBcIiR7aGVhZGVyfVwiIC0+IFwiJHtqaXJhRmllbGR9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDliJcgJHtjb2x1bW5MZXR0ZXJ9IChcIiR7aGVhZGVyfVwiKSDnmoTliKvlkI0gXCIke2hlYWRlckxvd2VyfVwiIOS4juWIlyAke3ZhbGlkSGVhZGVyc1tqaXJhRmllbGRdfSDlhrLnqoHvvIzpg73mjIflkJEgXCIke2ppcmFGaWVsZH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGlyZWN0TWF0Y2ggPSBrbm93bkZpZWxkcy5maW5kKGZpZWxkID0+IGZpZWxkLnRvTG93ZXJDYXNlKCkgPT09IGhlYWRlckxvd2VyKTtcbiAgICAgICAgICAgIGlmIChkaXJlY3RNYXRjaCkge1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tkaXJlY3RNYXRjaF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOebtOaOpeWtl+auteWQjeWMuemFjTogXCIke2hlYWRlcn1cIiAtPiBcIiR7ZGlyZWN0TWF0Y2h9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihg5YiXICR7Y29sdW1uTGV0dGVyfSAoXCIke2hlYWRlcn1cIikg55qE55u05o6l5Yy56YWN5LiO5YiXICR7dmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXX0g5Yay56qB77yM6YO95oyH5ZCRIFwiJHtkaXJlY3RNYXRjaH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCF2YWxpZEhlYWRlcnMua2V5KSB7XG4gICAgICAgICAgICAgY29uc29sZS53YXJuKFwi5pyq6IO96Ieq5Yqo5pig5bCEICdrZXknIOWIl+OAguivt+ajgOafpeihqOWktOaIluWcqOmFjee9ruihqOS4reaYjuehruaMh+WumiAna2V5JyDmiJYgJ0ppcmEgS2V5J+OAglwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCfmnIDnu4jmnInmlYjooajlpLTmmKDlsIQ6JywgdmFsaWRIZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIHZhbGlkSGVhZGVycztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xmib7mnInmlYggSmlyYSDmoIfpopjml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICBzaG93VG9hc3QoJ+afpeaJvuihqOWktOaYoOWwhOaXtuWHuumUmTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJylcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb2x1bW5JbmRleChjb2x1bW46IHN0cmluZyk6IG51bWJlciB7XG4gICAgaWYgKCFjb2x1bW4gfHwgdHlwZW9mIGNvbHVtbiAhPT0gJ3N0cmluZycgfHwgIS9eW0EtWl0rJC8udGVzdChjb2x1bW4udG9VcHBlckNhc2UoKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDml6DmlYjnmoTliJfmoIfor4bnrKY6IFwiJHtjb2x1bW59XCJgKTtcbiAgICB9XG4gICAgY29uc3QgdXBwZXJDb2x1bW4gPSBjb2x1bW4udG9VcHBlckNhc2UoKTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXBwZXJDb2x1bW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaW5kZXggPSBpbmRleCAqIDI2ICsgKHVwcGVyQ29sdW1uLmNoYXJDb2RlQXQoaSkgLSA2NCk7XG4gICAgfVxuICAgIHJldHVybiBpbmRleCAtIDE7XG59XG5cbmZ1bmN0aW9uIGdldE1heENvbHVtbkluZGV4KGNvbHVtbkxldHRlcnM6IHN0cmluZ1tdKTogbnVtYmVyIHtcbiAgICAgaWYgKCFjb2x1bW5MZXR0ZXJzIHx8ICFBcnJheS5pc0FycmF5KGNvbHVtbkxldHRlcnMpIHx8IGNvbHVtbkxldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICByZXR1cm4gMDtcbiAgICAgfVxuICAgICBjb25zdCB2YWxpZExldHRlcnMgPSBjb2x1bW5MZXR0ZXJzLmZpbHRlcihoID0+IHR5cGVvZiBoID09PSAnc3RyaW5nJyAmJiAvXltBLVpdKyQvLnRlc3QoaC50b1VwcGVyQ2FzZSgpKSk7XG4gICAgIGlmICh2YWxpZExldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICAgY29uc3QgaW5kaWNlcyA9IHZhbGlkTGV0dGVycy5tYXAoY29sID0+IGdldENvbHVtbkluZGV4KGNvbCkpO1xuICAgICByZXR1cm4gTWF0aC5tYXgoLi4uaW5kaWNlcykgKyAxO1xufVxuXG4vLyDmmL7npLrnoa7orqTlvLnnqpdcbmFzeW5jIGZ1bmN0aW9uIHNob3dDb25maXJtYXRpb25EaWFsb2coXG4gICAgb3BlcmF0aW9uczogVGlja2V0T3BlcmF0aW9uW10sXG4gICAgZGlzcGxheUhlYWRlcnM6IHN0cmluZ1tdLFxuICAgIHNoZWV0SGVhZGVyczogSmlyYUhlYWRlcnNcbik6IFByb21pc2U8VGlja2V0T3BlcmF0aW9uW10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRpYWxvZy5pZCA9ICdqaXJhQ29uZmlybWF0aW9uRGlhbG9nJztcbiAgICAgICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgICAgIHdpZHRoOiA4MDBweDtcbiAgICAgICAgICAgIG1heC13aWR0aDogOTB2dztcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDgwdmg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgYDtcblxuICAgICAgICBjb25zdCBjb2x1bW5zVG9VcGRhdGUgPSBkaXNwbGF5SGVhZGVyc1xuICAgICAgICAgICAgLmZpbHRlcihmaWVsZCA9PiBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYUhlYWRlcnNdKVxuICAgICAgICAgICAgLm1hcChmaWVsZCA9PiBmaWVsZCk7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ291bnQgPSBvcGVyYXRpb25zLmZpbHRlcihvcCA9PiBvcC50eXBlID09PSAndXBkYXRlJykubGVuZ3RoO1xuICAgICAgICBjb25zdCBhcHBlbmRDb3VudCA9IG9wZXJhdGlvbnMuZmlsdGVyKG9wID0+IG9wLnR5cGUgPT09ICdhcHBlbmQnKS5sZW5ndGg7XG5cbiAgICAgICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZsZXgtc2hyaW5rOiAwO1wiPuehruiupOaVsOaNruaTjeS9nDwvaDM+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTVweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+5bCG6KaB5pON5L2c55qE5YiX77yaPC9zdHJvbmc+IFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPiR7Y29sdW1uc1RvVXBkYXRlLmpvaW4oJywgJyl9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzY2NjtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mm7TmlrDnjrDmnInmlbDmja7vvJoke3VwZGF0ZUNvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mlrDlop7mlbDmja7vvJoke2FwcGVuZENvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cInNlbGVjdEFsbFRpY2tldHNcIiBjaGVja2VkIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiA1cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIOWFqOmAiS/lj5bmtojlhajpgIlcbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXgtZ3JvdzogMTsgb3ZlcmZsb3cteTogYXV0bzsgYm9yZGVyOiAxcHggc29saWQgI2VlZTsgYm9yZGVyLXJhZGl1czogNHB4OyBtYXJnaW4tYm90dG9tOiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1wiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQgc3R5bGU9XCJwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IGJhY2tncm91bmQ6ICNmNWY1ZjU7IHotaW5kZXg6IDE7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyB3aWR0aDogNTBweDtcIj7pgInmi6k8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDgwcHg7XCI+5pON5L2cPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2Rpc3BsYXlIZWFkZXJzLm1hcChoZWFkZXIgPT4gYDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj4ke2hlYWRlcn08L3RoPmApLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICAgICAgJHtvcGVyYXRpb25zLm1hcCgob3AsIGluZGV4KSA9PiBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNlZWU7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cInRpY2tldC1jaGVja2JveFwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiIGNoZWNrZWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICR7b3AudHlwZSA9PT0gJ3VwZGF0ZScgPyAnI2YwYWQ0ZScgOiAnIzVjYjg1Yyd9OyBmb250LXdlaWdodDogYm9sZDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke29wLnR5cGUgPT09ICd1cGRhdGUnID8gJ+abtOaWsCcgOiAn5paw5aKeJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtkaXNwbGF5SGVhZGVycy5tYXAoZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gb3AudGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA+IDEwMCkgdmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMCwgOTcpICsgJy4uLic7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHdoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzOyBtYXgtd2lkdGg6IDIwMHB4O1wiIHRpdGxlPVwiJHtvcC50aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyd9XCI+JHt2YWx1ZX08L3RkPmA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDsgZ2FwOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogI2VlZTsgYm9yZGVyOiAxcHggc29saWQgI2NjYzsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNvbmZpcm1PcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjMDA3YmZmOyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+56Gu6K6kICgke29wZXJhdGlvbnMubGVuZ3RofSk8L2J1dHRvbj4gXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0QWxsQ2hlY2tib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VsZWN0QWxsVGlja2V0cycpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHRpY2tldENoZWNrYm94ZXMgPSBkaWFsb2cuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgndGlja2V0LWNoZWNrYm94JykgYXMgSFRNTENvbGxlY3Rpb25PZjxIVE1MSW5wdXRFbGVtZW50PjtcbiAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtT3BlcmF0aW9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50ID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDb3VudCA9IEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZmlsdGVyKGNiID0+IGNiLmNoZWNrZWQpLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSBg56Gu6K6kICgke3NlbGVjdGVkQ291bnR9KWA7XG4gICAgICAgICAgICBjb25maXJtQnV0dG9uLmRpc2FibGVkID0gc2VsZWN0ZWRDb3VudCA9PT0gMDtcbiAgICAgICAgfTtcblxuICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNoZWNrZWQgPSBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgIGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkID0gQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5ldmVyeShjYiA9PiBjYi5jaGVja2VkKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsT3BlcmF0aW9uJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpcm1CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZE9wZXJhdGlvbnMgPSBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjaGVja2JveCA9PiBjaGVja2JveC5jaGVja2VkKVxuICAgICAgICAgICAgICAgIC5tYXAoY2hlY2tib3ggPT4gb3BlcmF0aW9uc1twYXJzZUludChjaGVja2JveC5kYXRhc2V0LmluZGV4IHx8ICcwJyldKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxlY3RlZE9wZXJhdGlvbnMpO1xuICAgICAgICB9KTtcblxuICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTsgXG4gICAgfSk7XG59XG5cbi8vIOa3u+WKoOaYvuekuiB0b2FzdCDnmoTlh73mlbBcbmZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGUgPSAnaW5mbycpIHtcbiAgICBjb25zdCBleGlzdGluZ1RvYXN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYC5qaXJhLXRvYXN0LSR7dHlwZX1gKTtcbiAgICBleGlzdGluZ1RvYXN0cy5mb3JFYWNoKHQgPT4gdC5yZW1vdmUoKSk7XG5cbiAgICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRvYXN0LmNsYXNzTmFtZSA9IGBqaXJhLXRvYXN0LSR7dHlwZX1gO1xuICAgIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICBsZXQgYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMCwgMCwgMCwgMC43KSc7XG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDIyMCwgNTMsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnc3VjY2VzcycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDQwLCAxNjcsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnd2FybmluZycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDI1NSwgMTkzLCA3LCAwLjkpJztcblxuICAgIHRvYXN0LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogJHtiYWNrZ3JvdW5kQ29sb3J9O1xuICAgICAgICBjb2xvcjogJHt0eXBlID09PSAnd2FybmluZycgPyAnYmxhY2snIDogJ3doaXRlJ307XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCA1cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gICAgYDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgIH0pO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgICAgICB9LCAzMDApO1xuICAgIH0sIDMwMDApO1xufVxuXG4vLyDku44gSmlyYSDmn6Xor6IgdGlja2V0cyDlubbmm7TmlrDliLAgR29vZ2xlIFNoZWV0XG5hc3luYyBmdW5jdGlvbiBoYW5kbGVGZXRjaEppcmFUaWNrZXRzVG9TaGVldChqcWw6IHN0cmluZywgc2hlZXRVcmw6IHN0cmluZywgc2hlZXRUb2tlbjogc3RyaW5nKSB7XG4gICAgc2hvd1RvYXN0KCfmraPlnKjmn6Xor6IgSmlyYS4uLicpO1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IHRpY2tldHMgPSBhd2FpdCBmZXRjaEppcmFUaWNrZXRzKGpxbCk7XG4gICAgY29uc29sZS5sb2coJ3RpY2tldHMnLCB0aWNrZXRzKTtcbiAgICBpZiAoIXRpY2tldHMubGVuZ3RoKSB7XG4gICAgICAgIHNob3dUb2FzdCgn5rKh5pyJ5om+5Yiw5pWw5o2uJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIXNoZWV0VG9rZW4pIHtcbiAgICAgICAgLy8g5Ymq5YiH5p2/5qih5byPXG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICBjb25zdCBmb3JtYXR0ZWREYXRhID0gW2hlYWRlcnMuam9pbignXFx0JyksIC4uLnRpY2tldHMubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAga2V5OiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWBcbiAgICAgICAgICAgIH0pKS5tYXAodGlja2V0ID0+IGhlYWRlcnMubWFwKGZpZWxkID0+IHRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJykuam9pbignXFx0JykpXS5qb2luKCdcXG4nKTtcbiAgICAgICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoZm9ybWF0dGVkRGF0YSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdmb3JtYXR0ZWREYXRhJywgZm9ybWF0dGVkRGF0YSk7XG4gICAgICAgIHNob3dUb2FzdCgnSmlyYSDmlbDmja7lt7LlpI3liLbliLDliarotLTmnb8nLCAnc3VjY2VzcycpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIOaOpeWPo+aooeW8j1xuICAgICAgICBpZiAoIXNoZWV0VXJsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCLnvLrlsJHooajmoLwgVVJMXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2hlZXQgPSBuZXcgU2hlZXQoc2hlZXRVcmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygndmFsdWVzJywgdmFsdWVzKTtcbiAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVycyA9IGF3YWl0IGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0KTtcbiAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlIZWFkZXJzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTsgXG5cbiAgICAgICAgICAgIGNvbnN0IGtleUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLmtleSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkpIDogLTE7XG4gICAgICAgICAgICBpZiAoa2V5Q29sdW1uSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5mZXJyZWRLZXlJbmRleCA9IHZhbHVlc1swXT8uZmluZEluZGV4KChoZWFkZXI6IHN0cmluZykgPT4gaGVhZGVyLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2tleScpIHx8IGhlYWRlci50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdqaXJhJykpO1xuICAgICAgICAgICAgICAgIGlmIChpbmZlcnJlZEtleUluZGV4ICE9PSAtMSAmJiBpbmZlcnJlZEtleUluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hlZXRIZWFkZXJzLmtleSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoNjUgKyBpbmZlcnJlZEtleUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDmnKrlnKjphY3nva7kuK3mib7liLAgS2V5IOWIl++8jOW3suaOqOaWreS4uuWIlyAke3NoZWV0SGVhZGVycy5rZXl9YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfmnKrmib7liLDmiJbml6Dms5Xmjqjmlq0gSmlyYSBLZXkg5YiX77yM6K+35qOA5p+l6KGo5aS05oiW6YWN572uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBrZXlUb1Jvd01hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgICAgICB2YWx1ZXMuc2xpY2UoMSkuZm9yRWFjaCgocm93OiBzdHJpbmdbXSwgaW5kZXg6IG51bWJlcikgPT4geyBcbiAgICAgICAgICAgICAgICBjb25zdCBrZXlDZWxsID0gcm93W2dldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkhKV07XG4gICAgICAgICAgICAgICAgICAgIGxldCBrZXkgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleUNlbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0ga2V5Q2VsbC5tYXRjaCgvYnJvd3NlXFwvKFtBLVowLTldKy1bMC05XSspL2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoICYmIG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0gbWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKC9eW0EtWjAtOV0rLVswLTldKyQvaS50ZXN0KGtleUNlbGwudHJpbSgpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSA9IGtleUNlbGwudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgICAgICBrZXlUb1Jvd01hcC5zZXQoa2V5LCBpbmRleCArIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBvcGVyYXRpb25zOiBUaWNrZXRPcGVyYXRpb25bXSA9IHRpY2tldHMubWFwKHRpY2tldCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdSb3dJbmRleCA9IGtleVRvUm93TWFwLmdldCh0aWNrZXQua2V5KTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB0aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGV4aXN0aW5nUm93SW5kZXggIT09IHVuZGVmaW5lZCA/ICd1cGRhdGUnIDogJ2FwcGVuZCcsXG4gICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBleGlzdGluZ1Jvd0luZGV4XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBjb25maXJtZWRPcGVyYXRpb25zID0gYXdhaXQgc2hvd0NvbmZpcm1hdGlvbkRpYWxvZyhvcGVyYXRpb25zLCBkaXNwbGF5SGVhZGVycywgc2hlZXRIZWFkZXJzKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvbmZpcm1lZE9wZXJhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmk43kvZzlt7Llj5bmtognKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlc0RhdGE6IFVwZGF0ZURhdGFbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgYXBwZW5kRGF0YTogc3RyaW5nW11bXSA9IFtdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlclZhbHVlcyA9IE9iamVjdC52YWx1ZXMoc2hlZXRIZWFkZXJzKS5maWx0ZXIoKHZhbHVlKTogdmFsdWUgaXMgc3RyaW5nID0+IFxuICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1heENvbEluZGV4ID0gZ2V0TWF4Q29sdW1uSW5kZXgoaGVhZGVyVmFsdWVzKTtcblxuICAgICAgICAgICAgY29uZmlybWVkT3BlcmF0aW9ucy5mb3JFYWNoKG9wZXJhdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gbmV3IEFycmF5KG1heENvbEluZGV4KS5maWxsKCcnKTtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhvcGVyYXRpb24udGlja2V0KS5mb3JFYWNoKHRpY2tldEtleSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbHVtbkxldHRlciA9IChzaGVldEhlYWRlcnMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPilbdGlja2V0S2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbHVtbkxldHRlciAmJiB0eXBlb2YgY29sdW1uTGV0dGVyID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xJbmRleCA9IGdldENvbHVtbkluZGV4KGNvbHVtbkxldHRlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRpY2tldEtleSA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IGA9SFlQRVJMSU5LKFwiJHtlbnZDb25maWcuSklSQV9CQVNFX1VSTH0vYnJvd3NlLyR7b3BlcmF0aW9uLnRpY2tldC5rZXl9XCIsIFwiJHtvcGVyYXRpb24udGlja2V0LmtleX1cIilgO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSAob3BlcmF0aW9uLnRpY2tldCBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KVt0aWNrZXRLZXldIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihg5aSE55CG5YiXICR7Y29sdW1uTGV0dGVyfSAo5a2X5q61ICR7dGlja2V0S2V5fSkg5pe25Ye66ZSZOmAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wZXJhdGlvbi50eXBlID09PSAndXBkYXRlJyAmJiBvcGVyYXRpb24ucm93SW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBvcGVyYXRpb24ucm93SW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiByb3dcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwZW5kRGF0YS5wdXNoKHJvdyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCfmm7TmlrDmlbDmja46JywgdXBkYXRlc0RhdGEpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ+i/veWKoOaVsOaNrjonLCBhcHBlbmREYXRhKTtcblxuICAgICAgICAgICAgbGV0IHVwZGF0ZWRDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgYXBwZW5kZWRDb3VudCA9IDA7XG5cbiAgICAgICAgICAgIGlmICh1cGRhdGVzRGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGUgb2YgdXBkYXRlc0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRDb2x1bW4gPSAnQSc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhbmdlID0gYCR7c3RhcnRDb2x1bW59JHt1cGRhdGUucm93SW5kZXgrMX1gOyBcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0aW5nIHJhbmdlOiAke3JhbmdlfWAsIHVwZGF0ZS5kYXRhKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC53cml0ZVNoZWV0KFt1cGRhdGUuZGF0YV0sIHJhbmdlKTtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlZENvdW50Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXBwZW5kRGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRQb3NpdGlvbiA9IGBBJHt2YWx1ZXMubGVuZ3RoICsgMX1gO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBBcHBlbmRpbmcgZGF0YSBzdGFydGluZyBmcm9tOiAke3N0YXJ0UG9zaXRpb259YCwgYXBwZW5kRGF0YSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChhcHBlbmREYXRhLCBzdGFydFBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICBhcHBlbmRlZENvdW50ID0gYXBwZW5kRGF0YS5sZW5ndGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB0b2FzdE1lc3NhZ2UgPSAnJztcbiAgICAgICAgICAgIGlmICh1cGRhdGVkQ291bnQgPiAwKSB0b2FzdE1lc3NhZ2UgKz0gYOW3suabtOaWsCAke3VwZGF0ZWRDb3VudH0g5p2h5pWw5o2u44CCYDtcbiAgICAgICAgICAgIGlmIChhcHBlbmRlZENvdW50ID4gMCkgdG9hc3RNZXNzYWdlICs9IGDlt7Lov73liqAgJHthcHBlbmRlZENvdW50fSDmnaHmlrDmlbDmja7jgIJgO1xuICAgICAgICAgICAgaWYgKHRvYXN0TWVzc2FnZSA9PT0gJycpIHRvYXN0TWVzc2FnZSA9ICfmsqHmnInpnIDopoHmm7TmlrDmiJbov73liqDnmoTmlbDmja7jgIInO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzaG93VG9hc3QodG9hc3RNZXNzYWdlLnRyaW0oKSwgJ3N1Y2Nlc3MnKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignR29vZ2xlIFNoZWV0cyDmk43kvZzlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICAgICAgc2hvd1RvYXN0KCdHb29nbGUgU2hlZXRzIOaTjeS9nOWksei0pTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIOaWsOWinu+8muWkhOeQhuWxleW8gCBFcGljIFRpY2tldHMg55qE5Ye95pWwXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVFeHBhbmRFcGljVGlja2V0cyhzaGVldFVybDogc3RyaW5nLCB0b2tlbjogc3RyaW5nKSB7XG4gICAgc2hvd1RvYXN0KCflvIDlp4vmn6Xmib4gRXBpYyDlubbojrflj5blrZDku7vliqEuLi4nKTtcbiAgICBjb25zdCBlbnZDb25maWcgPSBhd2FpdCBnZXRFbnZDb25maWcoKTtcbiAgICBjb25zdCBzaGVldCA9IG5ldyBTaGVldChzaGVldFVybCwgdG9rZW4pO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNoZWV0LmluaXQoKTtcbiAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn6KGo5qC85Li656m65oiW5peg5rOV6K+75Y+WJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXJzID0gYXdhaXQgZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQpO1xuXG4gICAgICAgIC8vIOaJvuWIsCBrZXkg5YiX55qE57Si5byVXG4gICAgICAgIGNvbnN0IGtleUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLmtleSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkpIDogLTE7XG4gICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign5pyq5om+5YiwIEppcmEgS2V5IOWIl++8jOivt+ajgOafpeihqOWktOaIlumFjee9ricpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdKaXJhIEtleSDliJfntKLlvJU6Jywga2V5Q29sdW1uSW5kZXgpO1xuXG4gICAgICAgIGNvbnN0IGVwaWNzVG9FeHBhbmQ6IHsgZXBpY0tleTogc3RyaW5nOyBlcGljU3VtbWFyeTogc3RyaW5nOyByb3dJbmRleDogbnVtYmVyOyBzdWJUaWNrZXRzOiBKaXJhVGlja2V0W10gfVtdID0gW107XG5cbiAgICAgICAgLy8g6YGN5Y6G6KGo5qC85p+l5om+IEVwaWMgS2V5IOW5tuafpeivouWtkOS7u+WKoVxuICAgICAgICAvLyDku47nrKzkuozooYzlvIDlp4vvvIzot7Pov4fooajlpLRcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJvdyA9IHZhbHVlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGtleUNlbGxDb250ZW50ID0gcm93W2tleUNvbHVtbkluZGV4XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5bCd6K+V5LuOIEhZUEVSTElOSyDmiJbnuq/mlofmnKzkuK3mj5Dlj5Yga2V5XG4gICAgICAgICAgICBsZXQgZXBpY0tleSA9ICcnO1xuICAgICAgICAgICAgaWYgKGtleUNlbGxDb250ZW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBrZXlDZWxsQ29udGVudC5tYXRjaCgvYnJvd3NlXFwvKFtBLVowLTldKy1bMC05XSspL2kpOyAvLyDmj5Dlj5YgYnJvd3NlLyDlkI7pnaLnmoQgS2V5XG4gICAgICAgICAgICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICAgZXBpY0tleSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKC9eW0EtWjAtOV0rLVswLTldKyQvaS50ZXN0KGtleUNlbGxDb250ZW50LnRyaW0oKSkpIHsgLy8g5aaC5p6c5piv57qvIEtleVxuICAgICAgICAgICAgICAgICAgICBlcGljS2V5ID0ga2V5Q2VsbENvbnRlbnQudHJpbSgpO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKGVwaWNLZXkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5om+5YiwIEtleTogJHtlcGljS2V5fSDlnKjooYwgJHtpICsgMX1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCBqcWwgPSBgaXNzdWVGdW5jdGlvbiBpbiBpc3N1ZXNJbkVwaWNzKFwia2V5ID0gJHtlcGljS2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViVGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1YlRpY2tldHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEVwaWMgJHtlcGljS2V5fSDmnIkgJHtzdWJUaWNrZXRzLmxlbmd0aH0g5Liq5a2Q5Lu75YqhYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDlsJ3or5Xojrflj5YgRXBpYyDnmoTmpoLopoHkv6Hmga/vvIjlpoLmnpzlhbbku5bliJflrZjlnKjvvIlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1bW1hcnlDb2x1bW5JbmRleCA9IHNoZWV0SGVhZGVycy5zdW1tYXJ5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLnN1bW1hcnkpIDogLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlcGljU3VtbWFyeSA9IHN1bW1hcnlDb2x1bW5JbmRleCAhPT0gLTEgJiYgcm93W3N1bW1hcnlDb2x1bW5JbmRleF0gPyByb3dbc3VtbWFyeUNvbHVtbkluZGV4XSA6IGVwaWNLZXk7IC8vIERlZmF1bHQgdG8ga2V5IGlmIHN1bW1hcnkgbWlzc2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBlcGljc1RvRXhwYW5kLnB1c2goeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcGljS2V5LCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcGljU3VtbWFyeTogZXBpY1N1bW1hcnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SW5kZXg6IGksIC8vIDAtYmFzZWQgaW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJUaWNrZXRzIFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEVwaWMgJHtlcGljS2V5fSDmsqHmnInlrZDku7vliqHmiJbkuI3mmK8gRXBpY2ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZmV0Y2hFcnJvcjogRXJyb3IgfCBhbnkpIHsgLy8gU3BlY2lmeSB0eXBlIGZvciBmZXRjaEVycm9yXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYOafpeivoiBFcGljICR7ZXBpY0tleX0g55qE5a2Q5Lu75Yqh5aSx6LSlOmAsIGZldGNoRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAvLyDpgInmi6nmgKflnLDpgJrnn6XnlKjmiLfmiJbnu6fnu63lpITnkIbkuIvkuIDkuKpcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDmn6Xor6IgJHtlcGljS2V5fSDlrZDku7vliqHlpLHotKU6ICR7ZmV0Y2hFcnJvci5tZXNzYWdlIHx8IGZldGNoRXJyb3J9YCwgJ2Vycm9yJyk7IC8vIFNob3cgZXJyb3IgbWVzc2FnZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYOihjCAke2kgKyAxfSDmnKrmib7liLDmnInmlYjnmoQgS2V5YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXBpY3NUb0V4cGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pyq5om+5Yiw5Lu75L2V5YyF5ZCr5a2Q5Lu75Yqh55qEIEVwaWMnLCAnaW5mbycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hvd1RvYXN0KGDmib7liLAgJHtlcGljc1RvRXhwYW5kLmxlbmd0aH0g5LiqIEVwaWMg5YyF5ZCr5a2Q5Lu75Yqh77yM5YeG5aSH56Gu6K6k5pON5L2cLi4uYCk7XG5cbiAgICAgICAgLy8gLS0tIOS4i+S4gOatpTog5L+u5pS556Gu6K6k5a+56K+d5qGG5bm25aSE55CG5o+S5YWlL+WIhue7hCAtLS1cbiAgICAgICAgY29uc29sZS5sb2coJ+WHhuWkh+ehruiupOeahCBFcGljczonLCBlcGljc1RvRXhwYW5kKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNvbmZpcm1lZEVwaWNzID0gYXdhaXQgc2hvd0VwaWNDb25maXJtYXRpb25EaWFsb2coZXBpY3NUb0V4cGFuZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY29uZmlybWVkRXBpY3MgJiYgY29uZmlybWVkRXBpY3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgaW5zZXJ0U3ViVGlja2V0cyhzaGVldCwgY29uZmlybWVkRXBpY3MsIHNoZWV0SGVhZGVycywgZW52Q29uZmlnLkpJUkFfQkFTRV9VUkwpO1xuICAgICAgICAgICAgc2hvd1RvYXN0KGDlt7LmiJDlip/lsZXlvIAgJHtjb25maXJtZWRFcGljcy5sZW5ndGh9IOS4qiBFcGljIOeahOWtkOS7u+WKoWAsICdzdWNjZXNzJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+aTjeS9nOW3suWPlua2iCcsICdpbmZvJyk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOS4tOaXtuWNoOS9jeespu+8jOihqOekuua1geeoi+i/m+ihjOWIsOi/memHjFxuICAgICAgICBzaG93VG9hc3QoJ+WtkOS7u+WKoeafpeaJvuWujOaIkO+8jOehruiupOOAgeaPkuWFpeWSjOWIhue7hOWKn+iDveW+heWunueOsCcsICd3YXJuaW5nJyk7XG5cblxuICAgIH0gY2F0Y2ggKGVycm9yOiBFcnJvciB8IGFueSkgeyAvLyBTcGVjaWZ5IHR5cGUgZm9yIGVycm9yXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+WkhOeQhiBFcGljIOWxleW8gOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgIHNob3dUb2FzdCgn5aSE55CGIEVwaWMg5bGV5byA5pe25Ye66ZSZOiAnICsgKGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpLCAnZXJyb3InKTsgLy8gVXNlIGVycm9yLm1lc3NhZ2UgaWYgYXZhaWxhYmxlXG4gICAgICAgIHRocm93IGVycm9yOyAvLyBSZS10aHJvdyBlcnJvciB0byBiZSBjYXVnaHQgYnkgdGhlIGNhbGxlclxuICAgIH1cbn1cblxuLy8gRXBpYyDnoa7orqTlr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIHNob3dFcGljQ29uZmlybWF0aW9uRGlhbG9nKFxuICAgIGVwaWNzOiB7IGVwaWNLZXk6IHN0cmluZzsgZXBpY1N1bW1hcnk6IHN0cmluZzsgcm93SW5kZXg6IG51bWJlcjsgc3ViVGlja2V0czogSmlyYVRpY2tldFtdIH1bXVxuKTogUHJvbWlzZTx0eXBlb2YgZXBpY3M+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICAgICAgei1pbmRleDogMTAwMDE7XG4gICAgICAgICAgICB3aWR0aDogODAwcHg7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDkwdnc7XG4gICAgICAgICAgICBtYXgtaGVpZ2h0OiA4MHZoO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgIGA7XG5cbiAgICAgICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZsZXgtc2hyaW5rOiAwO1wiPuehruiupOWxleW8gCBFcGljPC9oMz5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxNXB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6ICM2NjY7XCI+XG4gICAgICAgICAgICAgICAgICAgIOaJvuWIsCAke2VwaWNzLmxlbmd0aH0g5Liq5YyF5ZCr5a2Q5Lu75Yqh55qEIEVwaWNcbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cInNlbGVjdEFsbEVwaWNzXCIgY2hlY2tlZCBzdHlsZT1cIm1hcmdpbi1yaWdodDogNXB4O1wiPlxuICAgICAgICAgICAgICAgICAgICDlhajpgIkv5Y+W5raI5YWo6YCJXG4gICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXgtZ3JvdzogMTsgb3ZlcmZsb3cteTogYXV0bzsgYm9yZGVyOiAxcHggc29saWQgI2VlZTsgYm9yZGVyLXJhZGl1czogNHB4OyBtYXJnaW4tYm90dG9tOiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1wiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQgc3R5bGU9XCJwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IGJhY2tncm91bmQ6ICNmNWY1ZjU7IHotaW5kZXg6IDE7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyB3aWR0aDogNTBweDtcIj7pgInmi6k8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj5FcGljPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7XCI+5a2Q5Lu75Yqh5pWw6YePPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgICAgICAgICAgICR7ZXBpY3MubWFwKChlcGljLCBpbmRleCkgPT4gYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciBzdHlsZT1cImJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjZWVlO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJlcGljLWNoZWNrYm94XCIgZGF0YS1pbmRleD1cIiR7aW5kZXh9XCIgY2hlY2tlZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtlcGljLmVwaWNLZXl9IC0gJHtlcGljLmVwaWNTdW1tYXJ5fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2VwaWMuc3ViVGlja2V0cy5sZW5ndGh9IOS4quWtkOS7u+WKoVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDsgZ2FwOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogI2VlZTsgYm9yZGVyOiAxcHggc29saWQgI2NjYzsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNvbmZpcm1PcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjMDA3YmZmOyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+56Gu6K6kPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0QWxsQ2hlY2tib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VsZWN0QWxsRXBpY3MnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgICAgICBjb25zdCBlcGljQ2hlY2tib3hlcyA9IGRpYWxvZy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdlcGljLWNoZWNrYm94JykgYXMgSFRNTENvbGxlY3Rpb25PZjxIVE1MSW5wdXRFbGVtZW50PjtcbiAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtT3BlcmF0aW9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgICAgICAgc2VsZWN0QWxsQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcykuZm9yRWFjaChjaGVja2JveCA9PiB7XG4gICAgICAgICAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9IHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcykuZm9yRWFjaChjaGVja2JveCA9PiB7XG4gICAgICAgICAgICBjaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2VsZWN0QWxsQ2hlY2tib3guY2hlY2tlZCA9IEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpLmV2ZXJ5KGNiID0+IGNiLmNoZWNrZWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWxPcGVyYXRpb24nKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICByZXNvbHZlKFtdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uZmlybUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkRXBpY3MgPSBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoY2hlY2tib3ggPT4gY2hlY2tib3guY2hlY2tlZClcbiAgICAgICAgICAgICAgICAubWFwKGNoZWNrYm94ID0+IGVwaWNzW3BhcnNlSW50KGNoZWNrYm94LmRhdGFzZXQuaW5kZXggfHwgJzAnKV0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICByZXNvbHZlKHNlbGVjdGVkRXBpY3MpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuLy8g5o+S5YWl5a2Q5Lu75YqhXG5hc3luYyBmdW5jdGlvbiBpbnNlcnRTdWJUaWNrZXRzKFxuICAgIHNoZWV0OiBTaGVldCxcbiAgICBlcGljczogeyBlcGljS2V5OiBzdHJpbmc7IGVwaWNTdW1tYXJ5OiBzdHJpbmc7IHJvd0luZGV4OiBudW1iZXI7IHN1YlRpY2tldHM6IEppcmFUaWNrZXRbXSB9W10sXG4gICAgc2hlZXRIZWFkZXJzOiBKaXJhSGVhZGVycyxcbiAgICBqaXJhQmFzZVVybDogc3RyaW5nXG4pIHtcbiAgICAvLyDmjInooYzlj7fku47lpKfliLDlsI/mjpLluo/vvIzov5nmoLfmj5LlhaXml7bkuI3kvJrlvbHlk43lkI7nu63nmoTooYzlj7dcbiAgICBjb25zdCBzb3J0ZWRFcGljcyA9IFsuLi5lcGljc10uc29ydCgoYSwgYikgPT4gYi5yb3dJbmRleCAtIGEucm93SW5kZXgpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZXBpYyBvZiBzb3J0ZWRFcGljcykge1xuICAgICAgICBjb25zdCBpbnNlcnRSb3dJbmRleCA9IGVwaWMucm93SW5kZXggKyAyOyAvLyArMiDlm6DkuLogcm93SW5kZXgg5pivIDAtYmFzZWTvvIzkuJTmiJHku6zopoHmj5LlnKggRXBpYyDooYznmoTkuIvmlrlcbiAgICAgICAgY29uc3QgZGlzcGxheUhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICBjb25zdCBtYXhDb2xJbmRleCA9IGdldE1heENvbHVtbkluZGV4KE9iamVjdC52YWx1ZXMoc2hlZXRIZWFkZXJzKS5maWx0ZXIoKHZhbHVlKTogdmFsdWUgaXMgc3RyaW5nID0+IFxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPiAwXG4gICAgICAgICkpO1xuXG4gICAgICAgIC8vIOWFiOaPkuWFpeepuuihjFxuICAgICAgICBjb25zdCByb3dzVG9JbnNlcnQgPSBlcGljLnN1YlRpY2tldHMubGVuZ3RoO1xuICAgICAgICBpZiAocm93c1RvSW5zZXJ0ID4gMCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC5pbnNlcnREaW1lbnNpb24oJ1JPV1MnLCBpbnNlcnRSb3dJbmRleCAtIDEsIGluc2VydFJvd0luZGV4IC0gMSArIHJvd3NUb0luc2VydCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOW3suWcqOihjCAke2luc2VydFJvd0luZGV4fSDmj5LlhaUgJHtyb3dzVG9JbnNlcnR9IOS4quepuuihjGApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmj5LlhaXnqbrooYzlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdChg5o+S5YWl56m66KGM5aSx6LSlOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1YlRpY2tldFJvd3MgPSBlcGljLnN1YlRpY2tldHMubWFwKHRpY2tldCA9PiB7XG4gICAgICAgICAgICBjb25zdCByb3cgPSBuZXcgQXJyYXkobWF4Q29sSW5kZXgpLmZpbGwoJycpO1xuICAgICAgICAgICAgZGlzcGxheUhlYWRlcnMuZm9yRWFjaChmaWVsZCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gc2hlZXRIZWFkZXJzW2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdO1xuICAgICAgICAgICAgICAgIGlmIChjb2x1bW5MZXR0ZXIgJiYgdHlwZW9mIGNvbHVtbkxldHRlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sSW5kZXggPSBnZXRDb2x1bW5JbmRleChjb2x1bW5MZXR0ZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGQgPT09ICdrZXknKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gYD1IWVBFUkxJTksoXCIke2ppcmFCYXNlVXJsfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IHRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8g5YaZ5YWl5a2Q5Lu75Yqh5pWw5o2uXG4gICAgICAgIGNvbnN0IHN0YXJ0UG9zaXRpb24gPSBgQSR7aW5zZXJ0Um93SW5kZXh9YDtcbiAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChzdWJUaWNrZXRSb3dzLCBzdGFydFBvc2l0aW9uKTtcbiAgICAgICAgY29uc29sZS5sb2coYOW3suWcqOihjCAke2luc2VydFJvd0luZGV4fSDlhpnlhaUgJHtzdWJUaWNrZXRSb3dzLmxlbmd0aH0g5Liq5a2Q5Lu75YqhYCk7XG4gICAgfVxufVxuIl0sIm5hbWVzIjpbImdldEVudkNvbmZpZyIsImZldGNoSmlyYVRpY2tldHMiLCJqcWwiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlcXVlc3RJZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInN1YnN0cmluZyIsIm1lc3NhZ2VMaXN0ZW5lciIsIm1lc3NhZ2UiLCJ0eXBlIiwiY2hyb21lIiwicnVudGltZSIsIm9uTWVzc2FnZSIsInJlbW92ZUxpc3RlbmVyIiwiZXJyb3IiLCJFcnJvciIsInRpY2tldHMiLCJhZGRMaXN0ZW5lciIsInNlbmRNZXNzYWdlIiwiRkVUQ0hfSklSQV9USUNLRVRTIiwic291cmNlVGFiSWQiLCJlbnZDb25maWciLCJ1cmwiLCJKSVJBX0JBU0VfVVJMIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwidGFicyIsImNyZWF0ZSIsImFjdGl2ZSIsInRhYiIsImlkIiwiY2hlY2tQYWdlTG9hZCIsImdldCIsInVwZGF0ZWRUYWIiLCJzdGF0dXMiLCJpbmNsdWRlcyIsInNldFRpbWVvdXQiLCJ1cGRhdGUiLCJzY3JpcHRpbmciLCJleGVjdXRlU2NyaXB0IiwidGFyZ2V0IiwidGFiSWQiLCJmdW5jIiwiaXNKaXJhQ2xvdWQiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJyb3dzIiwicXVlcnlTZWxlY3RvckFsbCIsImxlbmd0aCIsImZvckVhY2giLCJyb3ciLCJrZXlFbGVtZW50Iiwic3VtbWFyeUVsZW1lbnQiLCJzdGF0dXNDb250YWluZXIiLCJzdGF0dXNFbGVtZW50IiwiY2VsbHMiLCJhc3NpZ25lZSIsInJlcG9ydGVyIiwicHJpb3JpdHkiLCJjcmVhdGVkIiwidXBkYXRlZCIsImR1ZWRhdGUiLCJhc3NpZ25lZVRleHQiLCJ0ZXh0Q29udGVudCIsInRyaW0iLCJtYXRjaCIsImR1ZURhdGVUZXh0IiwidGlja2V0Iiwia2V5Iiwic3VtbWFyeSIsImRlc2NyaXB0aW9uIiwicHVzaCIsImNlbGwiLCJjbGFzc0xpc3QiLCJwcm9wZXJ0eU5hbWUiLCJpbWciLCJ2YWx1ZSIsImdldEF0dHJpYnV0ZSIsInJlc3VsdHMiLCJyZXN1bHQiLCJtYXAiLCJzcGxpdCIsInMiLCJmaWx0ZXIiLCJCb29sZWFuIiwicG9wIiwicmVtb3ZlIiwiU2hlZXQiLCJjb25zdHJ1Y3RvciIsInRva2VuIiwic2hlZXRJZCIsImV4dHJhY3RTaGVldElkIiwiZ2lkIiwiZXh0cmFjdEdpZCIsImluaXQiLCJnZXRUb2tlbiIsInNoZWV0TmFtZSIsImdldFNoZWV0TmFtZUJ5R2lkIiwiaWRlbnRpdHkiLCJnZXRBdXRoVG9rZW4iLCJpbnRlcmFjdGl2ZSIsImxhc3RFcnJvciIsImdldFNoZWV0TmFtZXMiLCJyZXMiLCJmZXRjaCIsImhlYWRlcnMiLCJBdXRob3JpemF0aW9uIiwianNvbiIsInNoZWV0cyIsInNoZWV0IiwiZmluZCIsInByb3BlcnRpZXMiLCJ0aXRsZSIsInJlYWRTaGVldCIsInNoZWV0VXJsIiwidmFsdWVzIiwid3JpdGVTaGVldCIsInBvc2l0aW9uIiwiYXJndW1lbnRzIiwidW5kZWZpbmVkIiwibWV0aG9kIiwiYm9keSIsIkpTT04iLCJzdHJpbmdpZnkiLCJpbnNlcnREaW1lbnNpb24iLCJkaW1lbnNpb24iLCJzdGFydEluZGV4IiwiZW5kSW5kZXgiLCJyZXF1ZXN0IiwicmVxdWVzdHMiLCJyYW5nZSIsInBhcnNlSW50IiwiaW5oZXJpdEZyb21CZWZvcmUiLCJhZGREaW1lbnNpb25Hcm91cCIsIm9rIiwicmVhZENvbmZpZ1NoZWV0IiwiY29uZmlnU2hlZXROYW1lIiwiY29uc29sZSIsImdldEhlYWRlcnMiLCJnZXRTaGVldE5hbWUiLCJnZXRJbmRleGVkREJEYXRhIiwiZGF0YWJhc2VOYW1lIiwic3RvcmVOYW1lIiwiaW5kZXhlZERCIiwib3BlbiIsIm9uc3VjY2VzcyIsImV2ZW50IiwiZGIiLCJ0cmFuc2FjdGlvbiIsIm9iamVjdFN0b3JlIiwiZGF0YVJlcXVlc3QiLCJnZXRBbGwiLCJvbmVycm9yIiwiZ2V0TG9jYWxTdG9yYWdlSXRlbSIsImRlZmF1bHRWYWx1ZSIsInBhcnNlIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsInNldExvY2FsU3RvcmFnZUl0ZW0iLCJzZXRJdGVtIiwiZ2V0Q3VycmVudFVzZXJJbmZvIiwiZXh0ZW5zaW9uIiwiZXh0ZW5zaW9uSWQiLCJ1c2VybmFtZSIsImdldEZvbGRlcnMiLCJ0aGVuIiwiX3JlZiIsImRhdGEiLCJmYXZvcml0ZV9ncm91cF9pZHMiLCJjb252ZXJzYXRpb25fc2V0cyIsImZvbGRlcnMiLCJpZHMiLCJpdGVtIiwiY2F0Y2giLCJsb2ciLCJnZXRHcm91cHNNYXAiLCJncm91cHMiLCJncm91cHNNYXAiLCJyZWR1Y2UiLCJhY2MiLCJncm91cCIsIm5hbWUiLCJzZXRfYWJicmV2aWF0aW9uIiwiaXNfdGVhbSIsImZvcm1hdERhdGUiLCJkYXRlU3RyaW5nIiwiZGF0ZSIsIkRhdGUiLCJ5ZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsIlN0cmluZyIsImdldE1vbnRoIiwicGFkU3RhcnQiLCJkYXkiLCJnZXREYXRlIiwiaG91cnMiLCJnZXRIb3VycyIsIm1pbnV0ZXMiLCJnZXRNaW51dGVzIiwic2Vjb25kcyIsImdldFNlY29uZHMiLCJ1bmlxQnkiLCJhcnJheSIsInNlZW4iLCJTZXQiLCJrZXlWYWx1ZSIsImhhcyIsImFkZCIsInNob3dUb2FzdCIsIm9uQ2xvc2UiLCJjb250YWluZXIiLCJnZXRFbGVtZW50QnlJZCIsImV4aXN0aW5nVG9hc3QiLCJyZW1vdmVDaGlsZCIsInRvYXN0IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInRvYXN0SW5uZXIiLCJhcHBlbmRDaGlsZCIsInRpbWVyIiwiY29udGFpbnMiLCJjbGVhclRpbWVvdXQiLCJ0cmFuc2Zvcm1Hcm91cExpbmtzIiwiaW5wdXRTdHJpbmciLCJncm91cExpbmtQYXR0ZXJuIiwidHJhbnNmb3JtZWRTdHJpbmciLCJyZXBsYWNlIiwiZ3JvdXBOYW1lIiwiZ3JvdXBJZCIsInRyYW5zZm9ybVBvc3RMaW5rcyIsInBvc3RMaW5rUGF0dGVybiIsImluZGV4IiwicG9zdElkIiwid2luZG93IiwibG9jYXRpb24iLCJwYXRobmFtZSIsImRlZmF1bHRFbnZDb25maWciLCJTQ0hFRFVMRURfSU5URVJWQUwiLCJOdW1iZXIiLCJwcm9jZXNzIiwiZW52IiwiQU5BTFlTSVNfVFlQRSIsIkxMTV9UWVBFIiwiQU5BTFlaRV9CWV9HUk9VUCIsIk9MTEFNQV9CQVNFX1VSTCIsIk9MTEFNQV9NT0RFTCIsIk9MTEFNQV9SRVZJRVdfTU9ERUwiLCJPTExBTUFfUVVFUllfTU9ERUwiLCJESUZZX0FQSV9LRVkiLCJESUZZX1JFVklFV19BUElfS0VZIiwiRElGWV9BUElfQkFTRV9VUkwiLCJPUEVOQUlfQVBJX0tFWSIsIk9QRU5BSV9NT0RFTCIsIk9QRU5BSV9SRVZJRVdfTU9ERUwiLCJPUEVOQUlfQVBJX0JBU0VfVVJMIiwiR1JPUV9BUElfS0VZIiwiR1JPUV9NT0RFTCIsIkdST1FfUkVWSUVXX01PREVMIiwiQk9UX0FQSV9CQVNFX1VSTCIsIkJPVF9UT0tFTiIsIkJPVF9JRCIsIkJPVF9UWVBFIiwiVEVBTV9JRCIsIkVOQUJMRV9CT1QiLCJMTE1fUkVWSUVXX0JFRk9SRV9TRU5EIiwiRU5BQkxFX0NIUk9NQSIsIkNIUk9NQV9BUElfVVJMIiwiQ0hST01BX1BPUlQiLCJDSFJPTUFfQ09MTEVDVElPTl9OQU1FIiwiSklSQV9VU0VSTkFNRSIsIkpJUkFfQVBJX1RPS0VOIiwic3RvcmFnZSIsImxvY2FsIiwiZ2V0RGVmYXVsdEVudkNvbmZpZyIsImdldFVzZXJJbmZvIiwiYWNjb3VudFVEIiwiYWNjb3VudEluZm9MaXN0IiwiYWNjb3VudEluZm8iLCJkaXNwbGF5TmFtZSIsImVtYWlsIiwiZnVsbE5hbWUiLCJqb2luIiwidG9Mb3dlckNhc2UiLCJ1c2VySW5mbyIsInNlbmRlciIsInNlbmRSZXNwb25zZSIsIndhcm4iLCJzdWNjZXNzIiwib3BlbkpxbERpYWxvZyIsInNoZWV0VG9rZW4iLCJoYW5kbGVFeHBhbmRFcGljVGlja2V0cyIsImRpYWxvZyIsInN0eWxlIiwiY3NzVGV4dCIsImlubmVySFRNTCIsImFkZEV2ZW50TGlzdGVuZXIiLCJoYW5kbGVGZXRjaEppcmFUaWNrZXRzVG9TaGVldCIsInNoZWV0SGVhZGVycyIsImZpbmRWYWxpZEppcmFIZWFkZXJzIiwia2V5Q29sdW1uSW5kZXgiLCJnZXRDb2x1bW5JbmRleCIsImV4aXN0aW5nS2V5cyIsInNsaWNlIiwia2V5Q2VsbCIsInRlc3QiLCJoZWFkZXJNYXBwaW5nIiwiY3VzdG9tRmllbGRNYXBwaW5nIiwiY29uZmlnRGF0YSIsInNoZWV0SGVhZGVySW5kZXgiLCJmaW5kSW5kZXgiLCJoIiwiamlyYUZpZWxkSW5kZXgiLCJpIiwibWF4Iiwic2hlZXRIZWFkZXIiLCJqaXJhRmllbGQiLCJzdGFydHNXaXRoIiwidmFsaWRIZWFkZXJzIiwia25vd25GaWVsZHMiLCJoZWFkZXIiLCJoZWFkZXJMb3dlciIsImNvbHVtbkxldHRlciIsImZyb21DaGFyQ29kZSIsImRpcmVjdE1hdGNoIiwiZmllbGQiLCJjb2x1bW4iLCJ0b1VwcGVyQ2FzZSIsInVwcGVyQ29sdW1uIiwiY2hhckNvZGVBdCIsImdldE1heENvbHVtbkluZGV4IiwiY29sdW1uTGV0dGVycyIsIkFycmF5IiwiaXNBcnJheSIsInZhbGlkTGV0dGVycyIsImluZGljZXMiLCJjb2wiLCJzaG93Q29uZmlybWF0aW9uRGlhbG9nIiwib3BlcmF0aW9ucyIsImRpc3BsYXlIZWFkZXJzIiwiY29sdW1uc1RvVXBkYXRlIiwidXBkYXRlQ291bnQiLCJvcCIsImFwcGVuZENvdW50Iiwic2VsZWN0QWxsQ2hlY2tib3giLCJ0aWNrZXRDaGVja2JveGVzIiwiZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSIsImNvbmZpcm1CdXR0b24iLCJ1cGRhdGVDb25maXJtQnV0dG9uQ291bnQiLCJzZWxlY3RlZENvdW50IiwiZnJvbSIsImNiIiwiY2hlY2tlZCIsImRpc2FibGVkIiwiY2hlY2tib3giLCJldmVyeSIsInNlbGVjdGVkT3BlcmF0aW9ucyIsImRhdGFzZXQiLCJleGlzdGluZ1RvYXN0cyIsInQiLCJiYWNrZ3JvdW5kQ29sb3IiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJvcGFjaXR5IiwiZm9ybWF0dGVkRGF0YSIsIm5hdmlnYXRvciIsImNsaXBib2FyZCIsIndyaXRlVGV4dCIsImluZmVycmVkS2V5SW5kZXgiLCJrZXlUb1Jvd01hcCIsIk1hcCIsInNldCIsImV4aXN0aW5nUm93SW5kZXgiLCJyb3dJbmRleCIsImNvbmZpcm1lZE9wZXJhdGlvbnMiLCJ1cGRhdGVzRGF0YSIsImFwcGVuZERhdGEiLCJoZWFkZXJWYWx1ZXMiLCJPYmplY3QiLCJtYXhDb2xJbmRleCIsIm9wZXJhdGlvbiIsImZpbGwiLCJrZXlzIiwidGlja2V0S2V5IiwiY29sSW5kZXgiLCJ1cGRhdGVkQ291bnQiLCJhcHBlbmRlZENvdW50Iiwic3RhcnRDb2x1bW4iLCJzdGFydFBvc2l0aW9uIiwidG9hc3RNZXNzYWdlIiwiZXBpY3NUb0V4cGFuZCIsImtleUNlbGxDb250ZW50IiwiZXBpY0tleSIsInN1YlRpY2tldHMiLCJzdW1tYXJ5Q29sdW1uSW5kZXgiLCJlcGljU3VtbWFyeSIsImZldGNoRXJyb3IiLCJjb25maXJtZWRFcGljcyIsInNob3dFcGljQ29uZmlybWF0aW9uRGlhbG9nIiwiaW5zZXJ0U3ViVGlja2V0cyIsImVwaWNzIiwiZXBpYyIsImVwaWNDaGVja2JveGVzIiwic2VsZWN0ZWRFcGljcyIsImppcmFCYXNlVXJsIiwic29ydGVkRXBpY3MiLCJzb3J0IiwiYSIsImIiLCJpbnNlcnRSb3dJbmRleCIsInJvd3NUb0luc2VydCIsInN1YlRpY2tldFJvd3MiXSwic291cmNlUm9vdCI6IiJ9