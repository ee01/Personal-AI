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
  SCHEDULED_INTERVAL: Number("120") || 120,
  ANALYSIS_TYPE: "filter" || 0,
  LLM_TYPE: "dify" || 0,
  ANALYZE_BY_GROUP: "true" === "true",
  OLLAMA_BASE_URL: "http://localhost:11434" || 0,
  OLLAMA_MODEL: "deepseek-r1" || 0,
  OLLAMA_REVIEW_MODEL: "llama3.1" || 0,
  OLLAMA_QUERY_MODEL: "llama3.1" || 0,
  DIFY_API_KEY: "app-C3RyUFz6RCMjfMoB4CB0i2eS" || 0,
  DIFY_REVIEW_API_KEY: "app-C3RyUFz6RCMjfMoB4CB0i2eS" || 0,
  DIFY_API_BASE_URL: "http://lap-aex43-a301-rio-lab01.ai.mvp.rclabenv.com/v1" || 0,
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
  JIRA_BASE_URL:  false || "https://jira.ringcentral.com",
  JIRA_USERNAME:  false || "",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LENBQUNPLFVBQVUsQ0FBQ3NTLGFBQWEsRUFBRXZCLGFBQWEsQ0FBQztJQUNwRDFQLE9BQU8sQ0FBQ3FDLEdBQUcsQ0FBQyxPQUFPME8sY0FBYyxPQUFPRSxhQUFhLENBQUMxVyxNQUFNLE9BQU8sQ0FBQztFQUN4RTtBQUNKLEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9qaXJhLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3NoZWV0LnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3N0b3JhZ2UudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvdXRpbHMudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9jb250ZW50U2NyaXB0R29vZ2xlU2hlZXQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyDku44gSmlyYSDpobXpnaLmipPlj5bmlbDmja5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaEppcmFUaWNrZXRzKGpxbDogc3RyaW5nKTogUHJvbWlzZTxKaXJhVGlja2V0W10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0SWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoNyk7XG4gICAgICAgIFxuICAgICAgICAvLyDnm5HlkKzmnaXoh6ogYmFja2dyb3VuZCBzY3JpcHQg55qE5raI5oGvXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VMaXN0ZW5lciA9IChtZXNzYWdlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyAmJiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gcmVxdWVzdElkKSB7XG4gICAgICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlLmVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLnRpY2tldHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgIFxuICAgICAgICAvLyDlj5HpgIHmtojmga/nu5kgYmFja2dyb3VuZCBzY3JpcHQg5p2l5Yib5bu65paw5qCH562+6aG1XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdGRVRDSF9KSVJBX1RJQ0tFVFMnLFxuICAgICAgICAgICAganFsLFxuICAgICAgICAgICAgcmVxdWVzdElkXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDnhLblkI7lnKggRkVUQ0hfSklSQV9USUNLRVRTIOWHveaVsOS4reS9v+eUqCBzb3VyY2VUYWJJZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEZFVENIX0pJUkFfVElDS0VUUyhqcWw6IHN0cmluZywgcmVxdWVzdElkOiBzdHJpbmcsIHNvdXJjZVRhYklkOiBudW1iZXIpIHtcbiAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gIGNvbnN0IHVybCA9IGAke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9pc3N1ZXMvP2pxbD0ke2VuY29kZVVSSUNvbXBvbmVudChqcWwpfWA7XG4gICAgICAgIFxuICAvLyDliJvlu7rmlrDmoIfnrb7pobVcbiAgY2hyb21lLnRhYnMuY3JlYXRlKHsgdXJsLCBhY3RpdmU6IGZhbHNlIH0sICh0YWIpID0+IHtcbiAgICAgIGlmICghdGFiLmlkKSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgIGVycm9yOiAn5peg5rOV5Yib5bu65qCH562+6aG1J1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICBjb25zdCBjaGVja1BhZ2VMb2FkID0gKCkgPT4ge1xuICAgICAgICAgIGNocm9tZS50YWJzLmdldCh0YWIuaWQhLCAodXBkYXRlZFRhYikgPT4ge1xuICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi5zdGF0dXMgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi51cmwuaW5jbHVkZXMoJ2xvZ2luJykgfHwgdXBkYXRlZFRhYi51cmwuaW5jbHVkZXMoJ29rdGEnKSkge1xuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdqaXJhIOmcgOimgeeZu+W9le+8jOivt+eZu+W9leWQjumHjeaWsOWwneivlSdcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gY2hyb21lLnRhYnMudXBkYXRlKHRhYi5pZCEsIHsgYWN0aXZlOiB0cnVlIH0pLCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIC8vIOazqOWFpeWGheWuueiEmuacrFxuICAgICAgICAgICAgICAgICAgY2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdGFiSWQ6IHRhYi5pZCEgfSxcbiAgICAgICAgICAgICAgICAgICAgICBmdW5jOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDliKTmlq3mmK/lkKbmmK9KaXJhIENsb3Vk54mI5pys77yM6YCa6L+H5qOA5p+l54m55a6a55qERE9N5YWD57Sg5Yik5patXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzSmlyYUNsb3VkID0gISFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd0YWJsZVtkYXRhLXZjPVwiaXNzdWUtdGFibGVcIl0nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgISFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd0YWJsZVthcmlhLWxhYmVsPVwiV29ya1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzSmlyYUNsb3VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBKaXJhIENsb3VkIOeJiOacrOeahOmAieaLqeWZqFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLnVpLmlzc3VlLXJvd1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocm93cyAmJiByb3dzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dzLmZvckVhY2gocm93ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g6I635Y+Wa2V5IC0gYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUta2V5Lmlzc3VlLWtleS1jZWxsXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleUVsZW1lbnQgPSByb3cucXVlcnlTZWxlY3RvcignYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUta2V5Lmlzc3VlLWtleS1jZWxsXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDojrflj5ZzdW1tYXJ5IC0gYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUtc3VtbWFyeS5pc3N1ZS1zdW1tYXJ5LWNlbGxcIl1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeUVsZW1lbnQgPSByb3cucXVlcnlTZWxlY3RvcignYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUtc3VtbWFyeS5pc3N1ZS1zdW1tYXJ5LWNlbGxcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOiOt+WPlnN0YXR1cyAtIOeKtuaAgeS9jeS6juacieeJueWummNsYXNz55qEc3BhbuS4rVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0dXNDb250YWluZXIgPSByb3cucXVlcnlTZWxlY3RvcignZGl2W2RhdGEtdGVzdGlkXj1cImlzc3VlLmZpZWxkcy5zdGF0dXMuY29tbW9uLnVpLnN0YXR1cy1sb3plbmdlXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXR1c0VsZW1lbnQgPSBzdGF0dXNDb250YWluZXIgPyBzdGF0dXNDb250YWluZXIucXVlcnlTZWxlY3RvcignZGl2Ll80Y3ZyMWg2bycpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOe7j+WKnuS6uuOAgeaKpeWRiuS6uuWSjOS8mOWFiOe6p+mAmuW4uOS9jeS6juebuOW6lOeahOWNleWFg+agvOS4rVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjZWxscyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCd0ZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYXNzaWduZWUgPSAnJywgcmVwb3J0ZXIgPSAnJywgcHJpb3JpdHkgPSAnJywgY3JlYXRlZCA9ICcnLCB1cGRhdGVkID0gJycsIGR1ZWRhdGUgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOmAmui/h+S9jee9ruWIpOaWreWQhOS4quWtl+autVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2VsbHMubGVuZ3RoID49IDExKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKw15Liq5Y2V5YWD5qC85pivYXNzaWduZWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2lnbmVlVGV4dCA9IGNlbGxzWzRdLnRleHRDb250ZW50Py50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZSA9IGFzc2lnbmVlVGV4dC5tYXRjaCgvXiguKz8pXFwxKyQvKVsxXSB8fCBhc3NpZ25lZVRleHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZSA9IGFzc2lnbmVlICE9PSAnVW5hc3NpZ25lZCcgPyBhc3NpZ25lZSB8fCAnJyA6ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKw25Liq5Y2V5YWD5qC85pivcmVwb3J0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyID0gY2VsbHNbNV0udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyID0gcmVwb3J0ZXIubWF0Y2goL14oLis/KVxcMSskLylbMV0gfHwgcmVwb3J0ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDfkuKrljZXlhYPmoLzmmK9wcmlvcml0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHkgPSBjZWxsc1s2XS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKw55Liq5Y2V5YWD5qC85pivY3JlYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZCA9IGNlbGxzWzhdLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDEw5Liq5Y2V5YWD5qC85pivdXBkYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZCA9IGNlbGxzWzldLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDEx5Liq5Y2V5YWD5qC85pivZHVlZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHVlRGF0ZVRleHQgPSBjZWxsc1sxMF0udGV4dENvbnRlbnQ/LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGUgPSBkdWVEYXRlVGV4dCAhPT0gJ05vbmUnID8gZHVlRGF0ZVRleHQgfHwgJycgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGlja2V0ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrZXlFbGVtZW50ID8ga2V5RWxlbWVudC50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnIDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBzdW1tYXJ5RWxlbWVudCA/IHN1bW1hcnlFbGVtZW50LnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogc3RhdHVzRWxlbWVudCA/IHN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyA6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdWVkYXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICcnIC8vIENsb3Vk6KeG5Zu+5Lit6YCa5bi45LiN5pi+56S65o+P6L+wXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDljp/mnInnmoQgSmlyYSBPbi1QcmVtaXNlIOeJiOacrOeahOmAieaLqeWZqFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ci5pc3N1ZXJvdycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldDogYW55ID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNlbGxzID0gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RkJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2VsbHMuZm9yRWFjaChjZWxsID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjZWxsLmNsYXNzTGlzdCAmJiBjZWxsLmNsYXNzTGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHByb3BlcnR5TmFtZSA9IGNlbGwuY2xhc3NMaXN0WzBdOyAvLyBHZXQgdGhlIGZpcnN0IGNsYXNzIG5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbWcgPSBjZWxsLnF1ZXJ5U2VsZWN0b3IoJ2ltZ1thbHRdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBjZWxsLnRleHRDb250ZW50Py50cmltKCkgfHwgKGltZyA/IGltZy5nZXRBdHRyaWJ1dGUoJ2FsdCcpIHx8ICcnIDogJycpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlIGNsYXNzIG5hbWUgaXMgJ2lzc3Vla2V5JywgdGhlIHByb3BlcnR5IGluIG91ciBvYmplY3Qgc2hvdWxkIGJlICdrZXknXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5TmFtZSA9PT0gJ2lzc3Vla2V5JykgcHJvcGVydHlOYW1lID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5TmFtZSkgeyAvLyBFbnN1cmUgcHJvcGVydHlOYW1lIGlzIG5vdCBlbXB0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldFtwcm9wZXJ0eU5hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgZXNzZW50aWFsIG5vbi1vcHRpb25hbCBmaWVsZHMgZnJvbSBKaXJhVGlja2V0IGFyZSBwcmVzZW50LCBldmVuIGlmIGVtcHR5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldC5rZXkgPSB0aWNrZXQua2V5IHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXQuc3VtbWFyeSA9IHRpY2tldC5zdW1tYXJ5IHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXQuc3RhdHVzID0gdGlja2V0LnN0YXR1cyB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGlja2V0cztcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9LCAocmVzdWx0cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyDlpITnkIbnu5PmnpxcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdHMgJiYgcmVzdWx0c1swXSAmJiByZXN1bHRzWzBdLnJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIOWvuXN1bW1hcnnlrZfmrrXov5vooYzpop3lpJblpITnkIbvvIznoa7kv53lubLlh4DnmoTmlofmnKxcbiAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzWzBdLnJlc3VsdCA9IHJlc3VsdHNbMF0ucmVzdWx0Lm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHRpY2tldC5zdW1tYXJ5LnNwbGl0KCdcXG4nKS5tYXAoKHM6IHN0cmluZykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKS5wb3AoKSB8fCB0aWNrZXQuc3VtbWFyeSxcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHM6IHJlc3VsdHNbMF0ucmVzdWx0XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8g5aaC5p6c5rKh5pyJ57uT5p6cXG4gICAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHM6IFtdXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIOWFs+mXrSBKaXJhIOagh+etvumhtVxuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5yZW1vdmUodGFiLmlkISk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoY2hlY2tQYWdlTG9hZCwgMTAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgY2hlY2tQYWdlTG9hZCgpO1xuICB9KTtcbn1cbiIsImV4cG9ydCBjbGFzcyBTaGVldCB7XG4gIHByaXZhdGUgdG9rZW46IHN0cmluZztcbiAgcHJpdmF0ZSBzaGVldElkOiBzdHJpbmc7XG4gIHByaXZhdGUgZ2lkOiBzdHJpbmc7XG4gIHByaXZhdGUgc2hlZXROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcsIHRva2VuOiBzdHJpbmcpIHtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5zaGVldElkID0gdGhpcy5leHRyYWN0U2hlZXRJZCh1cmwpO1xuICAgIHRoaXMuZ2lkID0gdGhpcy5leHRyYWN0R2lkKHVybCk7XG4gIH1cbiAgICBcbiAgYXN5bmMgaW5pdCgpIHtcbiAgICBpZiAoIXRoaXMudG9rZW4pIHRoaXMudG9rZW4gPSBhd2FpdCB0aGlzLmdldFRva2VuKCk7XG4gICAgdGhpcy5zaGVldE5hbWUgPSBhd2FpdCB0aGlzLmdldFNoZWV0TmFtZUJ5R2lkKHRoaXMudG9rZW4sIHRoaXMuc2hlZXRJZCwgdGhpcy5naWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjaHJvbWUuaWRlbnRpdHkuZ2V0QXV0aFRva2VuKHsgaW50ZXJhY3RpdmU6IHRydWUgfSwgKHRva2VuKSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgICAgIGVsc2UgcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZXh0cmFjdFNoZWV0SWQodXJsOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvXFwvZFxcLyhbYS16QS1aMC05LV9dKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBleHRyYWN0R2lkKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL1sjJl1naWQ9KFswLTldKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBhc3luYyBnZXRTaGVldE5hbWVzKHRva2VuOiBzdHJpbmcsIHNoZWV0SWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3NoZWV0SWR9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9XG4gICAgfSk7XG4gICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgcmV0dXJuIGpzb24uc2hlZXRzO1xuICB9XG5cbiAgYXN5bmMgZ2V0U2hlZXROYW1lQnlHaWQodG9rZW46IHN0cmluZywgc2hlZXRJZDogc3RyaW5nLCBnaWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qgc2hlZXRzID0gYXdhaXQgdGhpcy5nZXRTaGVldE5hbWVzKHRva2VuLCBzaGVldElkKTtcbiAgICBjb25zdCBzaGVldCA9IHNoZWV0cy5maW5kKChzOiBhbnkpID0+IHMucHJvcGVydGllcy5zaGVldElkLnRvU3RyaW5nKCkgPT09IGdpZCk7XG4gICAgcmV0dXJuIHNoZWV0ID8gc2hlZXQucHJvcGVydGllcy50aXRsZSA6IHNoZWV0c1swXS5wcm9wZXJ0aWVzLnRpdGxlOyAvLyDlpoLmnpzmib7kuI3liLDlr7nlupTnmoRnaWQs6L+U5Zue56ys5LiA5Liqc2hlZXTnmoTlkI3np7BcbiAgfVxuXG4gIGFzeW5jIHJlYWRTaGVldCgpOiBQcm9taXNlPHN0cmluZ1tdW10+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gIH1cbiAgICB9KTtcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICByZXR1cm4ganNvbi52YWx1ZXM7XG4gIH1cblxuICBhc3luYyB3cml0ZVNoZWV0KHZhbHVlczogc3RyaW5nW11bXSwgcG9zaXRpb24gPSAnQTEnKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfSEke3Bvc2l0aW9ufT92YWx1ZUlucHV0T3B0aW9uPVVTRVJfRU5URVJFRGA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgdmFsdWVzIH0pXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gIH1cblxuICAvLyDmj5LlhaXooYzmiJbliJdcbiAgYXN5bmMgaW5zZXJ0RGltZW5zaW9uKGRpbWVuc2lvbjogJ1JPV1MnIHwgJ0NPTFVNTlMnLCBzdGFydEluZGV4OiBudW1iZXIsIGVuZEluZGV4OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfTpiYXRjaFVwZGF0ZWA7XG4gICAgY29uc3QgcmVxdWVzdCA9IHtcbiAgICAgIHJlcXVlc3RzOiBbe1xuICAgICAgICBpbnNlcnREaW1lbnNpb246IHtcbiAgICAgICAgICByYW5nZToge1xuICAgICAgICAgICAgc2hlZXRJZDogcGFyc2VJbnQodGhpcy5naWQpLFxuICAgICAgICAgICAgZGltZW5zaW9uLFxuICAgICAgICAgICAgc3RhcnRJbmRleCxcbiAgICAgICAgICAgIGVuZEluZGV4XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmhlcml0RnJvbUJlZm9yZTogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBhZGREaW1lbnNpb25Hcm91cDoge1xuICAgICAgICAgIHJhbmdlOiB7XG4gICAgICAgICAgICBzaGVldElkOiBwYXJzZUludCh0aGlzLmdpZCksXG4gICAgICAgICAgICBkaW1lbnNpb24sXG4gICAgICAgICAgICBzdGFydEluZGV4LFxuICAgICAgICAgICAgZW5kSW5kZXhcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfTtcblxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KVxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg5o+S5YWl57u05bqm5aSx6LSlOiAke2Vycm9yLmVycm9yPy5tZXNzYWdlIHx8ICfmnKrnn6XplJnor68nfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDor7vlj5bphY3nva7ooajmlbDmja5cbiAgICogQHBhcmFtIHNoZWV0TmFtZSDphY3nva7ooajlkI3np7BcbiAgICogQHJldHVybnMg6YWN572u6KGo5pWw5o2uXG4gICAqL1xuICBhc3luYyByZWFkQ29uZmlnU2hlZXQoY29uZmlnU2hlZXROYW1lID0gJycpOiBQcm9taXNlPHN0cmluZ1tdW10+IHtcbiAgICBpZiAoIWNvbmZpZ1NoZWV0TmFtZSkgY29uZmlnU2hlZXROYW1lID0gdGhpcy5zaGVldE5hbWUgKyAnX2NvbmZpZyc7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHtjb25maWdTaGVldE5hbWV9YDtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCB9XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIGpzb24udmFsdWVzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfor7vlj5bphY3nva7ooajlpLHotKU6JywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOiOt+WPluihqOagvOeahOesrOS4gOihjOS9nOS4uuihqOWktFxuICAgKiBAcmV0dXJucyDooajlpLTmlbDnu4RcbiAgICovXG4gIGFzeW5jIGdldEhlYWRlcnMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHZhbHVlcyA9IGF3YWl0IHRoaXMucmVhZFNoZWV0KCk7XG4gICAgaWYgKCF2YWx1ZXMgfHwgdmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfooajmoLzkuLrnqbonKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlc1swXTtcbiAgfVxuXG4gIHB1YmxpYyBnZXRTaGVldE5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5zaGVldE5hbWU7XG4gIH1cbn0iLCJleHBvcnQgZnVuY3Rpb24gZ2V0SW5kZXhlZERCRGF0YShkYXRhYmFzZU5hbWU6IHN0cmluZywgc3RvcmVOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBpbmRleGVkREIub3BlbihkYXRhYmFzZU5hbWUpO1xuICAgIFxuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYiA9IGV2ZW50LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IGRiLnRyYW5zYWN0aW9uKFtzdG9yZU5hbWVdLCAncmVhZG9ubHknKTtcbiAgICAgICAgICAgIGNvbnN0IG9iamVjdFN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUoc3RvcmVOYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGFSZXF1ZXN0ID0gb2JqZWN0U3RvcmUuZ2V0QWxsKCk7XG4gICAgXG4gICAgICAgICAgICBkYXRhUmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZShldmVudC50YXJnZXQucmVzdWx0KTtcbiAgICAgICAgICAgIH07XG4gICAgXG4gICAgICAgICAgICBkYXRhUmVxdWVzdC5vbmVycm9yID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlamVjdChldmVudC50YXJnZXQuZXJyb3IpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlamVjdChldmVudC50YXJnZXQuZXJyb3IpO1xuICAgICAgICB9O1xuICAgIH0pO1xufVxuXG5cbmV4cG9ydCBjb25zdCBnZXRMb2NhbFN0b3JhZ2VJdGVtID0gKGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IGFueSkgPT4ge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgfHwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdFZhbHVlKSk7XG59O1xuXG5leHBvcnQgY29uc3Qgc2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEN1cnJlbnRVc2VySW5mbygpIHtcbiAgICBjb25zdCB7IGV4dGVuc2lvbjogZXh0ZW5zaW9uSWQgfSA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ293bkV4dGVuc2lvbicsIHt9KTtcbiAgICBjb25zdCB1c2VybmFtZSA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2Rpc3BsYXlOYW1lJywgJ3JhZGFyLXBvYycpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIGV4dGVuc2lvbklkLFxuICAgICAgICB1c2VybmFtZVxuICAgIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGb2xkZXJzKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ3Byb2ZpbGUnKS50aGVuKChbZGF0YV0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZhdm9yaXRlX2dyb3VwX2lkcyA9IGRhdGE/LmZhdm9yaXRlX2dyb3VwX2lkcyB8fCBbXTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbl9zZXRzID0gZGF0YT8uY29udmVyc2F0aW9uX3NldHMgfHwgW107XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjb25zdCBmb2xkZXJzID0gW3t0aXRsZTogJyAnLCBpZHM6IFtdfSx7dGl0bGU6ICdmYXZvcml0ZScsIGlkczogZmF2b3JpdGVfZ3JvdXBfaWRzfSwgLi4uY29udmVyc2F0aW9uX3NldHMuZmlsdGVyKGl0ZW0gPT4gaXRlbS50eXBlID09PSAnZm9sZGVyJyldXG4gICAgICAgICAgICByZXR1cm4gZm9sZGVycztcbiAgICAgICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRHcm91cHNNYXAoKSB7XG4gICAgcmV0dXJuIGdldEluZGV4ZWREQkRhdGEoJ0dsaXAnLCAnZ3JvdXAnKS50aGVuKChncm91cHMpID0+IHtcbiAgICAgICAgY29uc3QgZ3JvdXBzTWFwID0gZ3JvdXBzLnJlZHVjZSgoYWNjOiBhbnksIGdyb3VwOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGFjY1tncm91cC5pZF0gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogZ3JvdXAuc2V0X2FiYnJldmlhdGlvbixcbiAgICAgICAgICAgICAgICBpc190ZWFtOiBncm91cC5pc190ZWFtXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgfSwge30pO1xuXG4gICAgICAgIHJldHVybiBncm91cHNNYXA7XG4gICAgfSk7XG59IiwiaW1wb3J0IHsgZ2V0Q3VycmVudFVzZXJJbmZvLCBnZXRMb2NhbFN0b3JhZ2VJdGVtIH0gZnJvbSBcIi4vc3RvcmFnZVwiO1xuXG4vLyDnjq/looPphY3nva7nsbvlnovlrprkuYlcbmV4cG9ydCBpbnRlcmZhY2UgRW52Q29uZmlnVHlwZSB7XG4gIFNDSEVEVUxFRF9JTlRFUlZBTDogbnVtYmVyO1xuICBBTkFMWVNJU19UWVBFOiBzdHJpbmc7XG4gIEFOQUxZWkVfQllfR1JPVVA6IGJvb2xlYW47XG4gIExMTV9UWVBFOiBzdHJpbmc7XG4gIE9MTEFNQV9CQVNFX1VSTDogc3RyaW5nO1xuICBPTExBTUFfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogc3RyaW5nO1xuICBPTExBTUFfUVVFUllfTU9ERUw6IHN0cmluZztcbiAgRElGWV9BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfUkVWSUVXX0FQSV9LRVk6IHN0cmluZztcbiAgRElGWV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgT1BFTkFJX0FQSV9LRVk6IHN0cmluZztcbiAgT1BFTkFJX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBHUk9RX0FQSV9LRVk6IHN0cmluZztcbiAgR1JPUV9NT0RFTDogc3RyaW5nO1xuICBHUk9RX1JFVklFV19NT0RFTDogc3RyaW5nO1xuICBCT1RfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIEJPVF9UT0tFTjogc3RyaW5nO1xuICBCT1RfSUQ6IHN0cmluZztcbiAgQk9UX1RZUEU6IHN0cmluZztcbiAgVEVBTV9JRDogc3RyaW5nO1xuICBFTkFCTEVfQk9UOiBib29sZWFuO1xuICBMTE1fUkVWSUVXX0JFRk9SRV9TRU5EOiBib29sZWFuO1xuICBFTkFCTEVfQ0hST01BOiBib29sZWFuO1xuICBDSFJPTUFfQVBJX1VSTDogc3RyaW5nO1xuICBDSFJPTUFfUE9SVDogbnVtYmVyO1xuICBDSFJPTUFfQ09MTEVDVElPTl9OQU1FOiBzdHJpbmc7XG4gIC8vIEpJUkHnm7jlhbPphY3nva5cbiAgSklSQV9CQVNFX1VSTD86IHN0cmluZztcbiAgSklSQV9VU0VSTkFNRT86IHN0cmluZztcbiAgSklSQV9BUElfVE9LRU4/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXREYXRlKGRhdGVTdHJpbmc6IHN0cmluZyB8IG51bWJlcikge1xuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShkYXRlU3RyaW5nKTtcbiAgICBcbiAgICBjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgIGNvbnN0IG1vbnRoID0gU3RyaW5nKGRhdGUuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgZGF5ID0gU3RyaW5nKGRhdGUuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGhvdXJzID0gU3RyaW5nKGRhdGUuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBtaW51dGVzID0gU3RyaW5nKGRhdGUuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IHNlY29uZHMgPSBTdHJpbmcoZGF0ZS5nZXRTZWNvbmRzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIFxuICAgIHJldHVybiBgJHt5ZWFyfS0ke21vbnRofS0ke2RheX0gJHtob3Vyc306JHttaW51dGVzfToke3NlY29uZHN9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVuaXFCeShhcnJheTogYW55W10sIGtleTogc3RyaW5nKSB7XG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcbiAgICByZXR1cm4gYXJyYXkuZmlsdGVyKGl0ZW0gPT4ge1xuICAgICAgY29uc3Qga2V5VmFsdWUgPSBpdGVtW2tleV07XG4gICAgICBpZiAoc2Vlbi5oYXMoa2V5VmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHNlZW4uYWRkKGtleVZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2U6IHN0cmluZywgdHlwZTogc3RyaW5nLCBvbkNsb3NlPzogKCkgPT4gdm9pZCkge1xuICAvLyDojrflj5bmiJbliJvlu7rlrrnlmajlhYPntKBcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JhZGFyLXBvYy1yZXN1bHQnKTtcbiAgaWYgKCFjb250YWluZXIpIHJldHVyblxuXG4gIC8vIOenu+mZpOeOsOacieeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgZXhpc3RpbmdUb2FzdCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcucmFkYXItcG9jLXRvYXN0Jyk7XG4gIGlmIChleGlzdGluZ1RvYXN0KSB7XG4gICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKGV4aXN0aW5nVG9hc3QpO1xuICB9XG5cbiAgLy8g5Yib5bu65paw55qEIFRvYXN0IOWFg+e0oFxuICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdC5jbGFzc05hbWUgPSBgcmFkYXItcG9jLXRvYXN0IHJhZGFyLXBvYy10b2FzdC0ke3R5cGV9YDtcblxuICBjb25zdCB0b2FzdElubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0SW5uZXIuY2xhc3NOYW1lID0gJ3JhZGFyLXBvYy10b2FzdC1pbm5lcic7XG4gIHRvYXN0SW5uZXIudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXG4gIHRvYXN0LmFwcGVuZENoaWxkKHRvYXN0SW5uZXIpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xuXG4gIC8vIOiuvue9ruWumuaXtuWZqOWcqCAzIOenkuWQjuWFs+mXrSBUb2FzdFxuICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChjb250YWluZXIuY29udGFpbnModG9hc3QpKSB7XG4gICAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgIH1cbiAgICBpZiAob25DbG9zZSkge1xuICAgICAgb25DbG9zZSgpO1xuICAgIH1cbiAgfSwgMzAwMCk7XG5cbiAgLy8g6L+U5Zue5LiA5Liq5Ye95pWw5Lul5L6/5omL5Yqo5YWz6ZetIFRvYXN0XG4gIHJldHVybiAoKSA9PiB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1Hcm91cExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgZ3JvdXBMaW5rUGF0dGVybiA9IC9cXFtncm91cDooLispOihcXGQrKVxcXS9nO1xuICBjb25zdCB0cmFuc2Zvcm1lZFN0cmluZyA9IGlucHV0U3RyaW5nLnJlcGxhY2UoZ3JvdXBMaW5rUGF0dGVybiwgKG1hdGNoLCBncm91cE5hbWUsIGdyb3VwSWQpID0+IHtcbiAgICByZXR1cm4gYFske2dyb3VwTmFtZX1dKC9tZXNzYWdlcy8ke2dyb3VwSWR9KWA7XG4gIH0pO1xuICByZXR1cm4gdHJhbnNmb3JtZWRTdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1Qb3N0TGlua3MoaW5wdXRTdHJpbmc6IHN0cmluZykge1xuICBjb25zdCBwb3N0TGlua1BhdHRlcm4gPSAvXFxbcG9zdDooXFxkKylcXF0vZztcbiAgbGV0IGluZGV4ID0gMTtcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKHBvc3RMaW5rUGF0dGVybiwgKG1hdGNoLCBwb3N0SWQpID0+IHtcbiAgICByZXR1cm4gYFtbJHtpbmRleCsrfV1dKC9sJHt3aW5kb3cubG9jYXRpb24ucGF0aG5hbWV9LyR7cG9zdElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG4vLyDpu5jorqTnjq/looPphY3nva5cbmV4cG9ydCBjb25zdCBkZWZhdWx0RW52Q29uZmlnOiBFbnZDb25maWdUeXBlID0ge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IE51bWJlcihwcm9jZXNzLmVudi5TQ0hFRFVMRURfSU5URVJWQUwpIHx8IDEyMCxcbiAgQU5BTFlTSVNfVFlQRTogcHJvY2Vzcy5lbnYuQU5BTFlTSVNfVFlQRSB8fCBcImZpbHRlclwiLFxuICBMTE1fVFlQRTogcHJvY2Vzcy5lbnYuTExNX1RZUEUgfHwgXCJkaWZ5XCIsXG4gIEFOQUxZWkVfQllfR1JPVVA6IHByb2Nlc3MuZW52LkFOQUxZWkVfQllfR1JPVVAgPT09IFwidHJ1ZVwiLFxuICBPTExBTUFfQkFTRV9VUkw6IHByb2Nlc3MuZW52Lk9MTEFNQV9CQVNFX1VSTCB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6MTE0MzRcIixcbiAgT0xMQU1BX01PREVMOiBwcm9jZXNzLmVudi5PTExBTUFfTU9ERUwgfHwgXCJkZWVwc2Vlay1yMVwiLFxuICBPTExBTUFfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5PTExBTUFfUkVWSUVXX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBwcm9jZXNzLmVudi5PTExBTUFfUVVFUllfTU9ERUwgfHwgXCJsbGFtYTMuMVwiLFxuICBESUZZX0FQSV9LRVk6IHByb2Nlc3MuZW52LkRJRllfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX1JFVklFV19BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX1JFVklFV19BUElfS0VZIHx8IFwiXCIsXG4gIERJRllfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBPUEVOQUlfQVBJX0tFWTogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVkgfHwgXCJcIixcbiAgT1BFTkFJX01PREVMOiBwcm9jZXNzLmVudi5PUEVOQUlfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBPUEVOQUlfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0JBU0VfVVJMIHx8IFwiXCIsXG4gIEdST1FfQVBJX0tFWTogcHJvY2Vzcy5lbnYuR1JPUV9BUElfS0VZIHx8IFwiXCIsXG4gIEdST1FfTU9ERUw6IHByb2Nlc3MuZW52LkdST1FfTU9ERUwgfHwgXCJcIixcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52LkdST1FfUkVWSUVXX01PREVMIHx8IFwiXCIsXG4gIEJPVF9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52LkJPVF9BUElfQkFTRV9VUkwgfHwgXCJodHRwczovL2JvdG1hbi5pbnQucmNsYWJlbnYuY29tL3YyXCIsXG4gIEJPVF9UT0tFTjogcHJvY2Vzcy5lbnYuQk9UX1RPS0VOIHx8IFwiXCIsXG4gIEJPVF9JRDogcHJvY2Vzcy5lbnYuQk9UX0lEIHx8IFwiNDcwMDM3MjAyMEAzNzQzOTUxMC5ib3QuZ2xpcC5uZXRcIixcbiAgQk9UX1RZUEU6IHByb2Nlc3MuZW52LkJPVF9UWVBFIHx8IFwidXNlclwiLFxuICBURUFNX0lEOiBwcm9jZXNzLmVudi5URUFNX0lEIHx8IFwiXCIsXG4gIEVOQUJMRV9CT1Q6IHByb2Nlc3MuZW52LkVOQUJMRV9CT1QgPT09IFwidHJ1ZVwiLFxuICBMTE1fUkVWSUVXX0JFRk9SRV9TRU5EOiBwcm9jZXNzLmVudi5MTE1fUkVWSUVXX0JFRk9SRV9TRU5EID09PSBcInRydWVcIixcbiAgRU5BQkxFX0NIUk9NQTogcHJvY2Vzcy5lbnYuRU5BQkxFX0NIUk9NQSA9PT0gXCJ0cnVlXCIsXG4gIENIUk9NQV9BUElfVVJMOiBwcm9jZXNzLmVudi5DSFJPTUFfQVBJX1VSTCB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6ODAwMFwiLFxuICBDSFJPTUFfUE9SVDogTnVtYmVyKHByb2Nlc3MuZW52LkNIUk9NQV9QT1JUKSB8fCA4MDAwLFxuICBDSFJPTUFfQ09MTEVDVElPTl9OQU1FOiBwcm9jZXNzLmVudi5DSFJPTUFfQ09MTEVDVElPTl9OQU1FIHx8IFwiXCIsXG4gIEpJUkFfQkFTRV9VUkw6IHByb2Nlc3MuZW52LkpJUkFfQkFTRV9VUkwgfHwgXCJodHRwczovL2ppcmEucmluZ2NlbnRyYWwuY29tXCIsXG4gIEpJUkFfVVNFUk5BTUU6IHByb2Nlc3MuZW52LkpJUkFfVVNFUk5BTUUgfHwgXCJcIixcbiAgSklSQV9BUElfVE9LRU46IHByb2Nlc3MuZW52LkpJUkFfQVBJX1RPS0VOIHx8IFwiXCIsXG59O1xuXG4vLyDojrflj5bnjq/looPphY3nva7vvIzlpoLmnpzlj6/og73nmoTor53ku44gc3RvcmFnZSDojrflj5bvvIzlkKbliJnku44gcHJvY2Vzcy5lbnYg6I635Y+WXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RW52Q29uZmlnKCk6IFByb21pc2U8RW52Q29uZmlnVHlwZT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgZW52Q29uZmlnIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydlbnZDb25maWcnXSk7XG4gICAgaWYgKGVudkNvbmZpZykge1xuICAgICAgLy8g5bCG5a2Y5YKo55qE6YWN572u5LiO6buY6K6k6YWN572u5ZCI5bm277yM56Gu5L+d5paw5aKe55qE6YWN572u6aG55Lmf5Lya6KKr5YyF5ZCrXG4gICAgICByZXR1cm4geyAuLi5kZWZhdWx0RW52Q29uZmlnLCAuLi5lbnZDb25maWcgfTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign6I635Y+W6YWN572u5aSx6LSlOicsIGVycm9yKTtcbiAgfVxuICBcbiAgLy8g5aaC5p6c6I635Y+W5aSx6LSl5oiW5rKh5pyJ5L+d5a2Y55qE6YWN572u77yM6L+U5Zue6buY6K6k5YC8XG4gIHJldHVybiBkZWZhdWx0RW52Q29uZmlnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVmYXVsdEVudkNvbmZpZygpOiBFbnZDb25maWdUeXBlIHtcbiAgcmV0dXJuIGRlZmF1bHRFbnZDb25maWc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VySW5mbygpIHtcbiAgY29uc3QgYWNjb3VudFVEID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuVUQnLCAnJyk7XG4gIGNvbnN0IGFjY291bnRJbmZvTGlzdCA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2dsb2JhbC5hY2NvdW50LkFDQ09VTlRfU0VTU0lPTl9EQVRBX0xJU1QnLCB7fSk7XG5cbiAgY29uc3QgYWNjb3VudEluZm8gPSBhY2NvdW50VUQgPyBhY2NvdW50SW5mb0xpc3RbYWNjb3VudFVEXSA6IGFjY291bnRJbmZvTGlzdC5maW5kKChpdGVtOmFueSkgPT4gaXRlbS5kaXNwbGF5TmFtZSAhPSAnJyk7XG4gIGNvbnNvbGUubG9nKCdhY2NvdW50SW5mb0xpc3QnLCBhY2NvdW50SW5mb0xpc3QsIGFjY291bnRJbmZvKTtcbiAgaWYgKGFjY291bnRJbmZvKSByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiBhY2NvdW50SW5mby5leHRlbnNpb25JZCxcbiAgICBlbWFpbDogYWNjb3VudEluZm8uZW1haWwsXG4gICAgZnVsbE5hbWU6IGFjY291bnRJbmZvLmRpc3BsYXlOYW1lLFxuICAgIHVzZXJuYW1lOiBhY2NvdW50SW5mby5lbWFpbCA/IGFjY291bnRJbmZvLmVtYWlsLnRyaW0oKS5zcGxpdCgnQCcpWzBdIDogYWNjb3VudEluZm8uZGlzcGxheU5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpLFxuICB9XG5cbiAgY29uc3QgdXNlckluZm8gPSBnZXRDdXJyZW50VXNlckluZm8oKTtcbiAgcmV0dXJuIHtcbiAgICBleHRlbnNpb25JZDogdXNlckluZm8uZXh0ZW5zaW9uSWQsXG4gICAgZnVsbE5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLFxuICAgIHVzZXJuYW1lOiB1c2VySW5mby51c2VybmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gICAgZW1haWw6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSArICdAcmluZ2NlbnRyYWwuY29tJ1xuICB9O1xufVxuXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCB7IGZldGNoSmlyYVRpY2tldHMgfSBmcm9tICcuL2ppcmEnO1xuaW1wb3J0IHsgU2hlZXQgfSBmcm9tICcuL3NoZWV0JztcbmltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyBNYWluIGxpc3RlbmVyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ+aUtuWIsOa2iOaBrzonLCBtZXNzYWdlLCAn5Y+R6YCB6ICFOicsIHNlbmRlcik7XG5cbiAgICBpZiAoIW1lc3NhZ2UgfHwgIW1lc3NhZ2UudHlwZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+aUtuWIsOaXoOaViOa2iOaBr+agvOW8jycpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICfml6DmlYjmtojmga/moLzlvI8nIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHR5cGUgfSA9IG1lc3NhZ2U7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09QRU5fSklSQV9RVUVSWV9ESUFMT0cnKSB7XG4gICAgICAgIG9wZW5KcWxEaWFsb2cobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbik7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnRVhQQU5EX0VQSUNfVElDS0VUUycpIHtcbiAgICAgICAgaWYgKCFtZXNzYWdlLnVybCB8fCAhbWVzc2FnZS5zaGVldFRva2VuKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFWFBBTkRfRVBJQ19USUNLRVRTIOe8uuWwkSB1cmwg5oiWIHNoZWV0VG9rZW4nKTtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn57y65bCR5b+F6KaB5Y+C5pWwJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICfnvLrlsJHlv4XopoHlj4LmlbAnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlRXhwYW5kRXBpY1RpY2tldHMobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbilcbiAgICAgICAgICAgICAgICAudGhlbigoKSA9PiBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+WkhOeQhiBFWFBBTkRfRVBJQ19USUNLRVRTIOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg5bGV5byAIEVwaWMg5aSx6LSlOiAke2Vycm9yLm1lc3NhZ2UgfHwgZXJyb3J9YCwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCBTdHJpbmcoZXJyb3IpIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+acquWkhOeQhueahOa2iOaBr+exu+WeizonLCB0eXBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG4vLyDliJvlu7ogSlFMIOafpeivouWvueivneahhlxuYXN5bmMgZnVuY3Rpb24gb3BlbkpxbERpYWxvZyh1cmw6IHN0cmluZywgc2hlZXRUb2tlbjogc3RyaW5nKSB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgIGA7XG5cbiAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwO1wiPui+k+WFpSBKUUwg5p+l6K+iPC9oMz5cbiAgICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIiBwbGFjZWhvbGRlcj1cImZpbHRlcj14eHh4XCI+PC90ZXh0YXJlYT5cbiAgICAgICAgPHAgc3R5bGU9XCJmb250LXNpemU6IDEycHg7IGNvbG9yOiAjNjY2OyBtYXJnaW4tdG9wOiAtNXB4OyBtYXJnaW4tYm90dG9tOiAxMHB4O1wiPuivt+WcqCA8YSBocmVmPVwiaHR0cHM6Ly9qaXJhLnJpbmdjZW50cmFsLmNvbS9pc3N1ZXMvP2pxbD1cIiB0YXJnZXQ9XCJfYmxhbmtcIj5maWx0ZXIg5p+l6K+i6aG16Z2iPC9hPiDphY3nva7pnIDopoHlsZXnpLrnmoQgY29sdW1ucyDkuJTorr7kuLrliJfooajmqKHlvI/jgII8L3A+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IG1hcmdpbi1ib3R0b206IDEwcHg7XCI+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwidXBkYXRlRXhpc3RpbmdcIiBzdHlsZT1cImJhY2tncm91bmQ6ICMyOGE3NDU7IGNvbG9yOiB3aGl0ZTsgYm9yZGVyOiBub25lOyBwYWRkaW5nOiA2cHggMTJweDsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+5Yi35pawIFNoZWV0IOS4iiB0aWNrZXRzIOaVsOaNrjwvYnV0dG9uPlxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsXCIgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDEwcHg7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInN1Ym1pdFwiPuafpeivojwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAvLyDmt7vliqDkuovku7bnm5HlkKzlmahcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1Ym1pdCcpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QganFsID0gKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqcWwnKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50KS52YWx1ZTtcbiAgICAgICAgaWYgKGpxbCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBoYW5kbGVGZXRjaEppcmFUaWNrZXRzVG9TaGVldChqcWwsIHVybCwgc2hlZXRUb2tlbik7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+afpeivouaIluWkhOeQhuWksei0pTogJywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5p+l6K+i5oiW5aSE55CG5aSx6LSlOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogZXJyb3IpLCAnZXJyb3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn6K+36L6T5YWlIEpRTCDmn6Xor6Lor63lj6UnLCAnd2FybmluZycpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyDmt7vliqDmm7TmlrDnjrDmnIkgdGlja2V0cyDnmoTkuovku7bnm5HlkKzlmahcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndXBkYXRlRXhpc3RpbmcnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGlmICghc2hlZXRUb2tlbiB8fCAhdXJsKSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeihqOagvCBVUkwg5oiWIHRva2VuJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfmraPlnKjor7vlj5booajmoLzmlbDmja4uLi4nKTtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIGNvbnN0IHNoZWV0ID0gbmV3IFNoZWV0KHVybCwgc2hlZXRUb2tlbik7XG4gICAgICAgICAgICBhd2FpdCBzaGVldC5pbml0KCk7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCBzaGVldC5yZWFkU2hlZXQoKTtcbiAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVycyA9IGF3YWl0IGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0KTtcblxuICAgICAgICAgICAgaWYgKCF2YWx1ZXMgfHwgdmFsdWVzLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfooajmoLzkuLrnqbrmiJblj6rmnInooajlpLQnLCAnd2FybmluZycpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8g6I635Y+W5omA5pyJ546w5pyJ55qEIEppcmEga2V5c1xuICAgICAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+acquaJvuWIsCBKaXJhIEtleSDliJcnLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nS2V5czogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIHZhbHVlcy5zbGljZSgxKS5mb3JFYWNoKChyb3c6IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5Q2VsbCA9IHJvd1trZXlDb2x1bW5JbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGtleUNlbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBrZXlDZWxsLm1hdGNoKC9icm93c2VcXC8oW0EtWjAtOV0rLVswLTldKykvaSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhpc3RpbmdLZXlzLnB1c2gobWF0Y2hbMV0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKC9eW0EtWjAtOV0rLVswLTldKyQvaS50ZXN0KGtleUNlbGwudHJpbSgpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhpc3RpbmdLZXlzLnB1c2goa2V5Q2VsbC50cmltKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChleGlzdGluZ0tleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrmib7liLDmnInmlYjnmoQgSmlyYSB0aWNrZXRzJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOaehOW7uiBKUUwg5p+l6K+iXG4gICAgICAgICAgICBjb25zdCBqcWwgPSBga2V5IGluICgke2V4aXN0aW5nS2V5cy5qb2luKCcsJyl9KWA7XG4gICAgICAgICAgICBoYW5kbGVGZXRjaEppcmFUaWNrZXRzVG9TaGVldChqcWwsIHVybCwgc2hlZXRUb2tlbik7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmm7TmlrDnjrDmnIkgdGlja2V0cyDlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfmm7TmlrDlpLHotKU6ICcgKyAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvciksICdlcnJvcicpO1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnMoZGlhbG9nKSkgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmludGVyZmFjZSBKaXJhSGVhZGVycyB7XG4gICAga2V5Pzogc3RyaW5nO1xuICAgIHN1bW1hcnk/OiBzdHJpbmc7XG4gICAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gICAgaXNzdWV0eXBlPzogc3RyaW5nO1xuICAgIHByaW9yaXR5Pzogc3RyaW5nO1xuICAgIGFzc2lnbmVlPzogc3RyaW5nO1xuICAgIHJlcG9ydGVyPzogc3RyaW5nO1xuICAgIGxhYmVscz86IHN0cmluZztcbiAgICBjb21wb25lbnRzPzogc3RyaW5nO1xuICAgIGZpeFZlcnNpb25zPzogc3RyaW5nO1xuICAgIGFmZmVjdHNWZXJzaW9ucz86IHN0cmluZztcbiAgICBsaW5rZWRJc3N1ZXM/OiBzdHJpbmc7XG4gICAgZXBpY0xpbms/OiBzdHJpbmc7XG4gICAgc3ByaW50Pzogc3RyaW5nO1xuICAgIHN0b3J5UG9pbnRzPzogc3RyaW5nO1xuICAgIHN0YXR1cz86IHN0cmluZztcbiAgICBba2V5OiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG59XG5cbmludGVyZmFjZSBVcGRhdGVEYXRhIHtcbiAgICByb3dJbmRleDogbnVtYmVyO1xuICAgIGRhdGE6IHN0cmluZ1tdO1xufVxuXG5pbnRlcmZhY2UgVGlja2V0T3BlcmF0aW9uIHtcbiAgICB0aWNrZXQ6IEppcmFUaWNrZXQ7XG4gICAgdHlwZTogJ3VwZGF0ZScgfCAnYXBwZW5kJztcbiAgICByb3dJbmRleD86IG51bWJlcjtcbn1cblxuLy8g5p+l5om+5pyJ5pWI55qESmlyYeWtl+auteihqOWktFxuYXN5bmMgZnVuY3Rpb24gZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQ6IFNoZWV0KTogUHJvbWlzZTxKaXJhSGVhZGVycz4ge1xuICAgIHRyeSB7XG4gICAgICAgIGxldCBoZWFkZXJNYXBwaW5nOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG4gICAgICAgIGNvbnN0IGN1c3RvbUZpZWxkTWFwcGluZzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0RhdGEgPSBhd2FpdCBzaGVldC5yZWFkQ29uZmlnU2hlZXQoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjb25maWdEYXRhJywgY29uZmlnRGF0YSk7XG4gICAgICAgICAgICBpZiAoY29uZmlnRGF0YSAmJiBjb25maWdEYXRhLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXJJbmRleCA9IGNvbmZpZ0RhdGFbMF0uZmluZEluZGV4KChoOiBzdHJpbmcpID0+IGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnc2hlZXQgY29sdW1uJykpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGppcmFGaWVsZEluZGV4ID0gY29uZmlnRGF0YVswXS5maW5kSW5kZXgoKGg6IHN0cmluZykgPT4gaC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdqaXJhIGZpZWxkJykpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNoZWV0SGVhZGVySW5kZXggPT09IC0xIHx8IGppcmFGaWVsZEluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ+mFjee9ruihqOS4reacquaJvuWIsCBcIlNoZWV0IEhlYWRlclwiIOaIliBcIkppcmEgRmllbGRcIiDliJfvvIzlsIbkvb/nlKjpu5jorqTliKvlkI0nKTtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbmZpZyBzaGVldCBoZWFkZXJzJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBjb25maWdEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IGNvbmZpZ0RhdGFbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChyb3cubGVuZ3RoID4gTWF0aC5tYXgoc2hlZXRIZWFkZXJJbmRleCwgamlyYUZpZWxkSW5kZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGVldEhlYWRlciA9IHJvd1tzaGVldEhlYWRlckluZGV4XT8udHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgamlyYUZpZWxkID0gcm93W2ppcmFGaWVsZEluZGV4XT8udHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2hlZXRIZWFkZXIgJiYgamlyYUZpZWxkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGppcmFGaWVsZC50b0xvd2VyQ2FzZSgpID09PSAnamlyYSBrZXknIHx8IGppcmFGaWVsZC50b0xvd2VyQ2FzZSgpID09PSAna2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBqaXJhRmllbGQgPSAna2V5JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVyTWFwcGluZ1tzaGVldEhlYWRlcl0gPSBqaXJhRmllbGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGppcmFGaWVsZC50b0xvd2VyQ2FzZSgpLnN0YXJ0c1dpdGgoJ2N1c3RvbWZpZWxkXycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1c3RvbUZpZWxkTWFwcGluZ1tzaGVldEhlYWRlcl0gPSBqaXJhRmllbGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn5LuO6YWN572u6KGo5Yqg6L2955qE5pig5bCEOicsIGhlYWRlck1hcHBpbmcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfphY3nva7ooajmlbDmja7kuLrnqbrmiJbmoLzlvI/kuI3mraPnoa7vvIzlsIbkvb/nlKjpu5jorqTliKvlkI0nKTtcbiAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfphY3nva7ooajmlbDmja7kuLrnqbrmiJbmoLzlvI/kuI3mraPnoa4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybign6K+75Y+W6YWN572u6KGo5aSx6LSl77yM5bCG5L2/55So6buY6K6k5a2X5q615Yir5ZCNOicsIGVycm9yKTtcbiAgICAgICAgICAgIGhlYWRlck1hcHBpbmcgPSB7XG4gICAgICAgICAgICAgICAgJ2tleSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhJzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2ppcmEga2V5JzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2ppcmEgbGluayc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGlkJzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2lkJzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2lzc3VlIGtleSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdzdW1tYXJ5JzogJ3N1bW1hcnknLFxuICAgICAgICAgICAgICAgICd0aXRsZSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAn5qaC6KaBJzogJ3N1bW1hcnknLFxuICAgICAgICAgICAgICAgICdkZXNjcmlwdGlvbic6ICdkZXNjcmlwdGlvbicsXG4gICAgICAgICAgICAgICAgJ+aPj+i/sCc6ICdkZXNjcmlwdGlvbicsXG4gICAgICAgICAgICAgICAgJ3R5cGUnOiAnaXNzdWV0eXBlJyxcbiAgICAgICAgICAgICAgICAnaXNzdWUgdHlwZSc6ICdpc3N1ZXR5cGUnLFxuICAgICAgICAgICAgICAgICfnsbvlnosnOiAnaXNzdWV0eXBlJyxcbiAgICAgICAgICAgICAgICAncHJpb3JpdHknOiAncHJpb3JpdHknLFxuICAgICAgICAgICAgICAgICfkvJjlhYjnuqcnOiAncHJpb3JpdHknLFxuICAgICAgICAgICAgICAgICdhc3NpZ25lZSc6ICdhc3NpZ25lZScsXG4gICAgICAgICAgICAgICAgJ+e7j+WKnuS6uic6ICdhc3NpZ25lZScsXG4gICAgICAgICAgICAgICAgJ3JlcG9ydGVyJzogJ3JlcG9ydGVyJyxcbiAgICAgICAgICAgICAgICAn5oql5ZGK5Lq6JzogJ3JlcG9ydGVyJyxcbiAgICAgICAgICAgICAgICAnc3RhdHVzJzogJ3N0YXR1cycsXG4gICAgICAgICAgICAgICAgJ+eKtuaAgSc6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICAgICdsYWJlbHMnOiAnbGFiZWxzJyxcbiAgICAgICAgICAgICAgICAnbGFiZWwnOiAnbGFiZWxzJyxcbiAgICAgICAgICAgICAgICAn5qCH562+JzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ2NvbXBvbmVudHMnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ2NvbXBvbmVudCc6ICdjb21wb25lbnRzJyxcbiAgICAgICAgICAgICAgICAn5qih5Z2XJzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICdmaXggdmVyc2lvbnMnOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdmaXggdmVyc2lvbic6ICdmaXhWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+S/ruWkjeeJiOacrCc6ICdmaXhWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2FmZmVjdHMgdmVyc2lvbnMnOiAnYWZmZWN0c1ZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAnYWZmZWN0IHZlcnNpb24nOiAnYWZmZWN0c1ZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAn5b2x5ZON54mI5pysJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2xpbmtlZCBpc3N1ZXMnOiAnbGlua2VkSXNzdWVzJyxcbiAgICAgICAgICAgICAgICAn5YWz6IGU6Zeu6aKYJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ2VwaWMgbGluayc6ICdlcGljTGluaycsXG4gICAgICAgICAgICAgICAgJ2VwaWMnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICdzcHJpbnQnOiAnc3ByaW50JyxcbiAgICAgICAgICAgICAgICAn5Yay5Yi6JzogJ3NwcmludCcsXG4gICAgICAgICAgICAgICAgJ3N0b3J5IHBvaW50cyc6ICdzdG9yeVBvaW50cycsXG4gICAgICAgICAgICAgICAgJ3N0b3J5IHBvaW50JzogJ3N0b3J5UG9pbnRzJyxcbiAgICAgICAgICAgICAgICAn5pWF5LqL54K5JzogJ3N0b3J5UG9pbnRzJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBhd2FpdCBzaGVldC5nZXRIZWFkZXJzKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTaGVldCBIZWFkZXJzOicsIGhlYWRlcnMpO1xuICAgICAgICBjb25zdCB2YWxpZEhlYWRlcnM6IEppcmFIZWFkZXJzID0ge307XG5cbiAgICAgICAgY29uc3Qga25vd25GaWVsZHMgPSBbXG4gICAgICAgICAgICAna2V5JywgJ3N1bW1hcnknLCAnZGVzY3JpcHRpb24nLCAnaXNzdWV0eXBlJywgJ3ByaW9yaXR5JywgXG4gICAgICAgICAgICAnYXNzaWduZWUnLCAncmVwb3J0ZXInLCAnc3RhdHVzJywgJ2xhYmVscycsICdjb21wb25lbnRzJywgXG4gICAgICAgICAgICAnZml4VmVyc2lvbnMnLCAnYWZmZWN0c1ZlcnNpb25zJywgJ2xpbmtlZElzc3VlcycsICdlcGljTGluaycsIFxuICAgICAgICAgICAgJ3NwcmludCcsICdzdG9yeVBvaW50cydcbiAgICAgICAgXTtcblxuICAgICAgICBoZWFkZXJzLmZvckVhY2goKGhlYWRlcjogc3RyaW5nLCBpbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBpZiAoIWhlYWRlcikgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgaGVhZGVyTG93ZXIgPSBoZWFkZXIudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBjb25zdCBjb2x1bW5MZXR0ZXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDY1ICsgaW5kZXgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoaGVhZGVyTWFwcGluZ1toZWFkZXJMb3dlcl0pIHtcbiAgICAgICAgICAgICAgICAgY29uc3QgamlyYUZpZWxkID0gaGVhZGVyTWFwcGluZ1toZWFkZXJMb3dlcl07XG4gICAgICAgICAgICAgICAgIGlmICghdmFsaWRIZWFkZXJzW2ppcmFGaWVsZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgIHZhbGlkSGVhZGVyc1tqaXJhRmllbGRdID0gY29sdW1uTGV0dGVyO1xuICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOmFjee9ri/liKvlkI3ljLnphY06IFwiJHtoZWFkZXJ9XCIgLT4gXCIke2ppcmFGaWVsZH1cIiAo5YiXICR7Y29sdW1uTGV0dGVyfSlgKTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYOWIlyAke2NvbHVtbkxldHRlcn0gKFwiJHtoZWFkZXJ9XCIpIOeahOWIq+WQjSBcIiR7aGVhZGVyTG93ZXJ9XCIg5LiO5YiXICR7dmFsaWRIZWFkZXJzW2ppcmFGaWVsZF19IOWGsueqge+8jOmDveaMh+WQkSBcIiR7amlyYUZpZWxkfVwi44CC5bCG5L2/55So56ys5LiA5Liq5Yy56YWN44CCYCk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBkaXJlY3RNYXRjaCA9IGtub3duRmllbGRzLmZpbmQoZmllbGQgPT4gZmllbGQudG9Mb3dlckNhc2UoKSA9PT0gaGVhZGVyTG93ZXIpO1xuICAgICAgICAgICAgaWYgKGRpcmVjdE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgIGlmICghdmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXSkge1xuICAgICAgICAgICAgICAgICAgICB2YWxpZEhlYWRlcnNbZGlyZWN0TWF0Y2hdID0gY29sdW1uTGV0dGVyO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg55u05o6l5a2X5q615ZCN5Yy56YWNOiBcIiR7aGVhZGVyfVwiIC0+IFwiJHtkaXJlY3RNYXRjaH1cIiAo5YiXICR7Y29sdW1uTGV0dGVyfSlgKTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDliJcgJHtjb2x1bW5MZXR0ZXJ9IChcIiR7aGVhZGVyfVwiKSDnmoTnm7TmjqXljLnphY3kuI7liJcgJHt2YWxpZEhlYWRlcnNbZGlyZWN0TWF0Y2hdfSDlhrLnqoHvvIzpg73mjIflkJEgXCIke2RpcmVjdE1hdGNofVwi44CC5bCG5L2/55So56ys5LiA5Liq5Yy56YWN44CCYCk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgcmV0dXJuOyBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXZhbGlkSGVhZGVycy5rZXkpIHtcbiAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCLmnKrog73oh6rliqjmmKDlsIQgJ2tleScg5YiX44CC6K+35qOA5p+l6KGo5aS05oiW5Zyo6YWN572u6KGo5Lit5piO56Gu5oyH5a6aICdrZXknIOaIliAnSmlyYSBLZXkn44CCXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+acgOe7iOacieaViOihqOWktOaYoOWwhDonLCB2YWxpZEhlYWRlcnMpO1xuICAgICAgICByZXR1cm4gdmFsaWRIZWFkZXJzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+afpeaJvuacieaViCBKaXJhIOagh+mimOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgIHNob3dUb2FzdCgn5p+l5om+6KGo5aS05pig5bCE5pe25Ye66ZSZOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogZXJyb3IpLCAnZXJyb3InKVxuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldENvbHVtbkluZGV4KGNvbHVtbjogc3RyaW5nKTogbnVtYmVyIHtcbiAgICBpZiAoIWNvbHVtbiB8fCB0eXBlb2YgY29sdW1uICE9PSAnc3RyaW5nJyB8fCAhL15bQS1aXSskLy50ZXN0KGNvbHVtbi50b1VwcGVyQ2FzZSgpKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYOaXoOaViOeahOWIl+agh+ivhuespjogXCIke2NvbHVtbn1cImApO1xuICAgIH1cbiAgICBjb25zdCB1cHBlckNvbHVtbiA9IGNvbHVtbi50b1VwcGVyQ2FzZSgpO1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB1cHBlckNvbHVtbi5sZW5ndGg7IGkrKykge1xuICAgICAgICBpbmRleCA9IGluZGV4ICogMjYgKyAodXBwZXJDb2x1bW4uY2hhckNvZGVBdChpKSAtIDY0KTtcbiAgICB9XG4gICAgcmV0dXJuIGluZGV4IC0gMTtcbn1cblxuZnVuY3Rpb24gZ2V0TWF4Q29sdW1uSW5kZXgoY29sdW1uTGV0dGVyczogc3RyaW5nW10pOiBudW1iZXIge1xuICAgICBpZiAoIWNvbHVtbkxldHRlcnMgfHwgIUFycmF5LmlzQXJyYXkoY29sdW1uTGV0dGVycykgfHwgY29sdW1uTGV0dGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgIHJldHVybiAwO1xuICAgICB9XG4gICAgIGNvbnN0IHZhbGlkTGV0dGVycyA9IGNvbHVtbkxldHRlcnMuZmlsdGVyKGggPT4gdHlwZW9mIGggPT09ICdzdHJpbmcnICYmIC9eW0EtWl0rJC8udGVzdChoLnRvVXBwZXJDYXNlKCkpKTtcbiAgICAgaWYgKHZhbGlkTGV0dGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICAgICBjb25zdCBpbmRpY2VzID0gdmFsaWRMZXR0ZXJzLm1hcChjb2wgPT4gZ2V0Q29sdW1uSW5kZXgoY29sKSk7XG4gICAgIHJldHVybiBNYXRoLm1heCguLi5pbmRpY2VzKSArIDE7XG59XG5cbi8vIOaYvuekuuehruiupOW8ueeql1xuYXN5bmMgZnVuY3Rpb24gc2hvd0NvbmZpcm1hdGlvbkRpYWxvZyhcbiAgICBvcGVyYXRpb25zOiBUaWNrZXRPcGVyYXRpb25bXSxcbiAgICBkaXNwbGF5SGVhZGVyczogc3RyaW5nW10sXG4gICAgc2hlZXRIZWFkZXJzOiBKaXJhSGVhZGVyc1xuKTogUHJvbWlzZTxUaWNrZXRPcGVyYXRpb25bXT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBkaWFsb2cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZGlhbG9nLmlkID0gJ2ppcmFDb25maXJtYXRpb25EaWFsb2cnO1xuICAgICAgICBkaWFsb2cuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICAgIHRvcDogNTAlO1xuICAgICAgICAgICAgbGVmdDogNTAlO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwMDAxO1xuICAgICAgICAgICAgd2lkdGg6IDgwMHB4O1xuICAgICAgICAgICAgbWF4LXdpZHRoOiA5MHZ3O1xuICAgICAgICAgICAgbWF4LWhlaWdodDogODB2aDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICBgO1xuXG4gICAgICAgIGNvbnN0IGNvbHVtbnNUb1VwZGF0ZSA9IGRpc3BsYXlIZWFkZXJzXG4gICAgICAgICAgICAuZmlsdGVyKGZpZWxkID0+IHNoZWV0SGVhZGVyc1tmaWVsZCBhcyBrZXlvZiBKaXJhSGVhZGVyc10pXG4gICAgICAgICAgICAubWFwKGZpZWxkID0+IGZpZWxkKTtcblxuICAgICAgICBjb25zdCB1cGRhdGVDb3VudCA9IG9wZXJhdGlvbnMuZmlsdGVyKG9wID0+IG9wLnR5cGUgPT09ICd1cGRhdGUnKS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGFwcGVuZENvdW50ID0gb3BlcmF0aW9ucy5maWx0ZXIob3AgPT4gb3AudHlwZSA9PT0gJ2FwcGVuZCcpLmxlbmd0aDtcblxuICAgICAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZmxleC1zaHJpbms6IDA7XCI+56Gu6K6k5pWw5o2u5pON5L2cPC9oMz5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxNXB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTBweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgPHN0cm9uZz7lsIbopoHmk43kvZznmoTliJfvvJo8L3N0cm9uZz4gXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICM2NjY7XCI+JHtjb2x1bW5zVG9VcGRhdGUuam9pbignLCAnKX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2PuabtOaWsOeOsOacieaVsOaNru+8miR7dXBkYXRlQ291bnR9IOadoTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2PuaWsOWinuaVsOaNru+8miR7YXBwZW5kQ291bnR9IOadoTwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTBweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGlkPVwic2VsZWN0QWxsVGlja2V0c1wiIGNoZWNrZWQgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDVweDtcIj5cbiAgICAgICAgICAgICAgICAgICAg5YWo6YCJL+WPlua2iOWFqOmAiVxuICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZmxleC1ncm93OiAxOyBvdmVyZmxvdy15OiBhdXRvOyBib3JkZXI6IDFweCBzb2xpZCAjZWVlOyBib3JkZXItcmFkaXVzOiA0cHg7IG1hcmdpbi1ib3R0b206IDE1cHg7XCI+XG4gICAgICAgICAgICAgICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XCI+XG4gICAgICAgICAgICAgICAgICAgIDx0aGVhZCBzdHlsZT1cInBvc2l0aW9uOiBzdGlja3k7IHRvcDogMDsgYmFja2dyb3VuZDogI2Y1ZjVmNTsgei1pbmRleDogMTtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7IHdpZHRoOiA1MHB4O1wiPumAieaLqTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyB3aWR0aDogODBweDtcIj7mk43kvZw8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZGlzcGxheUhlYWRlcnMubWFwKGhlYWRlciA9PiBgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0O1wiPiR7aGVhZGVyfTwvdGg+YCkuam9pbignJyl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgICAgICAgICAgICAke29wZXJhdGlvbnMubWFwKChvcCwgaW5kZXgpID0+IGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIgc3R5bGU9XCJib3JkZXItYm90dG9tOiAxcHggc29saWQgI2VlZTtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwidGlja2V0LWNoZWNrYm94XCIgZGF0YS1pbmRleD1cIiR7aW5kZXh9XCIgY2hlY2tlZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjogJHtvcC50eXBlID09PSAndXBkYXRlJyA/ICcjZjBhZDRlJyA6ICcjNWNiODVjJ307IGZvbnQtd2VpZ2h0OiBib2xkO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7b3AudHlwZSA9PT0gJ3VwZGF0ZScgPyAn5pu05pawJyA6ICfmlrDlop4nfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2Rpc3BsYXlIZWFkZXJzLm1hcChmaWVsZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgdmFsdWUgPSBvcC50aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUubGVuZ3RoID4gMTAwKSB2YWx1ZSA9IHZhbHVlLnN1YnN0cmluZygwLCA5NykgKyAnLi4uJzsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDsgd2hpdGUtc3BhY2U6IG5vd3JhcDsgb3ZlcmZsb3c6IGhpZGRlbjsgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7IG1heC13aWR0aDogMjAwcHg7XCIgdGl0bGU9XCIke29wLnRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJ31cIj4ke3ZhbHVlfTwvdGQ+YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuam9pbignJyl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgICAgIGApLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kOyBnYXA6IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxPcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjZWVlOyBib3JkZXI6IDFweCBzb2xpZCAjY2NjOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY29uZmlybU9wZXJhdGlvblwiIHN0eWxlPVwicGFkZGluZzogNnB4IDEycHg7IGJhY2tncm91bmQ6ICMwMDdiZmY7IGNvbG9yOiB3aGl0ZTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjtcIj7noa7orqQgKCR7b3BlcmF0aW9ucy5sZW5ndGh9KTwvYnV0dG9uPiBcbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgICAgICBjb25zdCBzZWxlY3RBbGxDaGVja2JveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWxlY3RBbGxUaWNrZXRzJykgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICAgICAgY29uc3QgdGlja2V0Q2hlY2tib3hlcyA9IGRpYWxvZy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCd0aWNrZXQtY2hlY2tib3gnKSBhcyBIVE1MQ29sbGVjdGlvbk9mPEhUTUxJbnB1dEVsZW1lbnQ+O1xuICAgICAgICBjb25zdCBjb25maXJtQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm1PcGVyYXRpb24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblxuICAgICAgICBjb25zdCB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQgPSAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZENvdW50ID0gQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5maWx0ZXIoY2IgPT4gY2IuY2hlY2tlZCkubGVuZ3RoO1xuICAgICAgICAgICAgY29uZmlybUJ1dHRvbi50ZXh0Q29udGVudCA9IGDnoa7orqQgKCR7c2VsZWN0ZWRDb3VudH0pYDtcbiAgICAgICAgICAgIGNvbmZpcm1CdXR0b24uZGlzYWJsZWQgPSBzZWxlY3RlZENvdW50ID09PSAwO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgIEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZm9yRWFjaChjaGVja2JveCA9PiB7XG4gICAgICAgICAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9IHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHVwZGF0ZUNvbmZpcm1CdXR0b25Db3VudCgpO1xuICAgICAgICB9KTtcblxuICAgICAgICBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQgPSBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmV2ZXJ5KGNiID0+IGNiLmNoZWNrZWQpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZUNvbmZpcm1CdXR0b25Db3VudCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWxPcGVyYXRpb24nKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICByZXNvbHZlKFtdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uZmlybUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkT3BlcmF0aW9ucyA9IEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcylcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGNoZWNrYm94ID0+IGNoZWNrYm94LmNoZWNrZWQpXG4gICAgICAgICAgICAgICAgLm1hcChjaGVja2JveCA9PiBvcGVyYXRpb25zW3BhcnNlSW50KGNoZWNrYm94LmRhdGFzZXQuaW5kZXggfHwgJzAnKV0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICByZXNvbHZlKHNlbGVjdGVkT3BlcmF0aW9ucyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHVwZGF0ZUNvbmZpcm1CdXR0b25Db3VudCgpOyBcbiAgICB9KTtcbn1cblxuLy8g5re75Yqg5pi+56S6IHRvYXN0IOeahOWHveaVsFxuZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2U6IHN0cmluZywgdHlwZSA9ICdpbmZvJykge1xuICAgIGNvbnN0IGV4aXN0aW5nVG9hc3RzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChgLmppcmEtdG9hc3QtJHt0eXBlfWApO1xuICAgIGV4aXN0aW5nVG9hc3RzLmZvckVhY2godCA9PiB0LnJlbW92ZSgpKTtcblxuICAgIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdG9hc3QuY2xhc3NOYW1lID0gYGppcmEtdG9hc3QtJHt0eXBlfWA7XG4gICAgdG9hc3QudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIGxldCBiYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgwLCAwLCAwLCAwLjcpJztcbiAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJykgYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMjIwLCA1MywgNjksIDAuOSknO1xuICAgIGVsc2UgaWYgKHR5cGUgPT09ICdzdWNjZXNzJykgYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoNDAsIDE2NywgNjksIDAuOSknO1xuICAgIGVsc2UgaWYgKHR5cGUgPT09ICd3YXJuaW5nJykgYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMjU1LCAxOTMsIDcsIDAuOSknO1xuXG4gICAgdG9hc3Quc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICBib3R0b206IDIwcHg7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiAke2JhY2tncm91bmRDb2xvcn07XG4gICAgICAgIGNvbG9yOiAke3R5cGUgPT09ICd3YXJuaW5nJyA/ICdibGFjaycgOiAnd2hpdGUnfTtcbiAgICAgICAgcGFkZGluZzogMTBweCAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDVweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgICAgIHotaW5kZXg6IDEwMDAxO1xuICAgICAgICBvcGFjaXR5OiAwO1xuICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuM3MgZWFzZTtcbiAgICBgO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgIHRvYXN0LnN0eWxlLm9wYWNpdHkgPSAnMSc7XG4gICAgfSk7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRvYXN0LnN0eWxlLm9wYWNpdHkgPSAnMCc7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgICAgIH0sIDMwMCk7XG4gICAgfSwgMzAwMCk7XG59XG5cbi8vIOS7jiBKaXJhIOafpeivoiB0aWNrZXRzIOW5tuabtOaWsOWIsCBHb29nbGUgU2hlZXRcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUZldGNoSmlyYVRpY2tldHNUb1NoZWV0KGpxbDogc3RyaW5nLCBzaGVldFVybDogc3RyaW5nLCBzaGVldFRva2VuOiBzdHJpbmcpIHtcbiAgICBzaG93VG9hc3QoJ+ato+WcqOafpeivoiBKaXJhLi4uJyk7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICBjb25zb2xlLmxvZygndGlja2V0cycsIHRpY2tldHMpO1xuICAgIGlmICghdGlja2V0cy5sZW5ndGgpIHtcbiAgICAgICAgc2hvd1RvYXN0KCfmsqHmnInmib7liLDmlbDmja4nLCAnd2FybmluZycpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghc2hlZXRUb2tlbikge1xuICAgICAgICAvLyDliarliIfmnb/mqKHlvI9cbiAgICAgICAgY29uc3QgaGVhZGVycyA9IFsna2V5JywgJ3N1bW1hcnknLCAnc3RhdHVzJywgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJ107XG4gICAgICAgIGNvbnN0IGZvcm1hdHRlZERhdGEgPSBbaGVhZGVycy5qb2luKCdcXHQnKSwgLi4udGlja2V0cy5tYXAodGlja2V0ID0+ICh7XG4gICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICBrZXk6IGA9SFlQRVJMSU5LKFwiJHtlbnZDb25maWcuSklSQV9CQVNFX1VSTH0vYnJvd3NlLyR7dGlja2V0LmtleX1cIiwgXCIke3RpY2tldC5rZXl9XCIpYFxuICAgICAgICAgICAgfSkpLm1hcCh0aWNrZXQgPT4gaGVhZGVycy5tYXAoZmllbGQgPT4gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnKS5qb2luKCdcXHQnKSldLmpvaW4oJ1xcbicpO1xuICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgY29uc29sZS5sb2coJ2Zvcm1hdHRlZERhdGEnLCBmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgc2hvd1RvYXN0KCdKaXJhIOaVsOaNruW3suWkjeWItuWIsOWJqui0tOadvycsICdzdWNjZXNzJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8g5o6l5Y+j5qih5byPXG4gICAgICAgIGlmICghc2hlZXRVcmwpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIue8uuWwkeihqOagvCBVUkxcIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzaGVldCA9IG5ldyBTaGVldChzaGVldFVybCwgc2hlZXRUb2tlbik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBzaGVldC5pbml0KCk7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCBzaGVldC5yZWFkU2hlZXQoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCd2YWx1ZXMnLCB2YWx1ZXMpO1xuICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXJzID0gYXdhaXQgZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQpO1xuICAgICAgICAgICAgY29uc3QgZGlzcGxheUhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddOyBcblxuICAgICAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmZlcnJlZEtleUluZGV4ID0gdmFsdWVzWzBdPy5maW5kSW5kZXgoKGhlYWRlcjogc3RyaW5nKSA9PiBoZWFkZXIudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygna2V5JykgfHwgaGVhZGVyLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2ppcmEnKSk7XG4gICAgICAgICAgICAgICAgaWYgKGluZmVycmVkS2V5SW5kZXggIT09IC0xICYmIGluZmVycmVkS2V5SW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBzaGVldEhlYWRlcnMua2V5ID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZmVycmVkS2V5SW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYOacquWcqOmFjee9ruS4reaJvuWIsCBLZXkg5YiX77yM5bey5o6o5pat5Li65YiXICR7c2hlZXRIZWFkZXJzLmtleX1gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+acquaJvuWIsOaIluaXoOazleaOqOaWrSBKaXJhIEtleSDliJfvvIzor7fmo4Dmn6XooajlpLTmiJbphY3nva4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGtleVRvUm93TWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICAgICAgICAgIHZhbHVlcy5zbGljZSgxKS5mb3JFYWNoKChyb3c6IHN0cmluZ1tdLCBpbmRleDogbnVtYmVyKSA9PiB7IFxuICAgICAgICAgICAgICAgIGNvbnN0IGtleUNlbGwgPSByb3dbZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSEpXTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGtleSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5Q2VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBrZXlDZWxsLm1hdGNoKC9icm93c2VcXC8oW0EtWjAtOV0rLVswLTldKykvaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL15bQS1aMC05XSstWzAtOV0rJC9pLnRlc3Qoa2V5Q2VsbC50cmltKCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5Q2VsbC50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGtleVRvUm93TWFwLnNldChrZXksIGluZGV4ICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG9wZXJhdGlvbnM6IFRpY2tldE9wZXJhdGlvbltdID0gdGlja2V0cy5tYXAodGlja2V0ID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1Jvd0luZGV4ID0ga2V5VG9Sb3dNYXAuZ2V0KHRpY2tldC5rZXkpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogZXhpc3RpbmdSb3dJbmRleCAhPT0gdW5kZWZpbmVkID8gJ3VwZGF0ZScgOiAnYXBwZW5kJyxcbiAgICAgICAgICAgICAgICAgICAgcm93SW5kZXg6IGV4aXN0aW5nUm93SW5kZXhcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbmZpcm1lZE9wZXJhdGlvbnMgPSBhd2FpdCBzaG93Q29uZmlybWF0aW9uRGlhbG9nKG9wZXJhdGlvbnMsIGRpc3BsYXlIZWFkZXJzLCBzaGVldEhlYWRlcnMpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoY29uZmlybWVkT3BlcmF0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+aTjeS9nOW3suWPlua2iCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVzRGF0YTogVXBkYXRlRGF0YVtdID0gW107XG4gICAgICAgICAgICBjb25zdCBhcHBlbmREYXRhOiBzdHJpbmdbXVtdID0gW107XG4gICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyVmFsdWVzID0gT2JqZWN0LnZhbHVlcyhzaGVldEhlYWRlcnMpLmZpbHRlcigodmFsdWUpOiB2YWx1ZSBpcyBzdHJpbmcgPT4gXG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF4Q29sSW5kZXggPSBnZXRNYXhDb2x1bW5JbmRleChoZWFkZXJWYWx1ZXMpO1xuXG4gICAgICAgICAgICBjb25maXJtZWRPcGVyYXRpb25zLmZvckVhY2gob3BlcmF0aW9uID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBuZXcgQXJyYXkobWF4Q29sSW5kZXgpLmZpbGwoJycpO1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKG9wZXJhdGlvbi50aWNrZXQpLmZvckVhY2godGlja2V0S2V5ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gKHNoZWV0SGVhZGVycyBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KVt0aWNrZXRLZXldO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29sdW1uTGV0dGVyICYmIHR5cGVvZiBjb2x1bW5MZXR0ZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbEluZGV4ID0gZ2V0Q29sdW1uSW5kZXgoY29sdW1uTGV0dGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGlja2V0S2V5ID09PSAna2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHtvcGVyYXRpb24udGlja2V0LmtleX1cIiwgXCIke29wZXJhdGlvbi50aWNrZXQua2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IChvcGVyYXRpb24udGlja2V0IGFzIFJlY29yZDxzdHJpbmcsIGFueT4pW3RpY2tldEtleV0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGDlpITnkIbliJcgJHtjb2x1bW5MZXR0ZXJ9ICjlrZfmrrUgJHt0aWNrZXRLZXl9KSDml7blh7rplJk6YCwgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAob3BlcmF0aW9uLnR5cGUgPT09ICd1cGRhdGUnICYmIG9wZXJhdGlvbi5yb3dJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZXNEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgcm93SW5kZXg6IG9wZXJhdGlvbi5yb3dJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHJvd1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBhcHBlbmREYXRhLnB1c2gocm93KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ+abtOaWsOaVsOaNrjonLCB1cGRhdGVzRGF0YSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygn6L+95Yqg5pWw5o2uOicsIGFwcGVuZERhdGEpO1xuXG4gICAgICAgICAgICBsZXQgdXBkYXRlZENvdW50ID0gMDtcbiAgICAgICAgICAgIGxldCBhcHBlbmRlZENvdW50ID0gMDtcblxuICAgICAgICAgICAgaWYgKHVwZGF0ZXNEYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHVwZGF0ZSBvZiB1cGRhdGVzRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGFydENvbHVtbiA9ICdBJztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmFuZ2UgPSBgJHtzdGFydENvbHVtbn0ke3VwZGF0ZS5yb3dJbmRleCsxfWA7IFxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgVXBkYXRpbmcgcmFuZ2U6ICR7cmFuZ2V9YCwgdXBkYXRlLmRhdGEpXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0LndyaXRlU2hlZXQoW3VwZGF0ZS5kYXRhXSwgcmFuZ2UpO1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVkQ291bnQrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhcHBlbmREYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdGFydFBvc2l0aW9uID0gYEEke3ZhbHVlcy5sZW5ndGggKyAxfWA7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEFwcGVuZGluZyBkYXRhIHN0YXJ0aW5nIGZyb206ICR7c3RhcnRQb3NpdGlvbn1gLCBhcHBlbmREYXRhKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC53cml0ZVNoZWV0KGFwcGVuZERhdGEsIHN0YXJ0UG9zaXRpb24pO1xuICAgICAgICAgICAgICAgIGFwcGVuZGVkQ291bnQgPSBhcHBlbmREYXRhLmxlbmd0aDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHRvYXN0TWVzc2FnZSA9ICcnO1xuICAgICAgICAgICAgaWYgKHVwZGF0ZWRDb3VudCA+IDApIHRvYXN0TWVzc2FnZSArPSBg5bey5pu05pawICR7dXBkYXRlZENvdW50fSDmnaHmlbDmja7jgIJgO1xuICAgICAgICAgICAgaWYgKGFwcGVuZGVkQ291bnQgPiAwKSB0b2FzdE1lc3NhZ2UgKz0gYOW3sui/veWKoCAke2FwcGVuZGVkQ291bnR9IOadoeaWsOaVsOaNruOAgmA7XG4gICAgICAgICAgICBpZiAodG9hc3RNZXNzYWdlID09PSAnJykgdG9hc3RNZXNzYWdlID0gJ+ayoeaciemcgOimgeabtOaWsOaIlui/veWKoOeahOaVsOaNruOAgic7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNob3dUb2FzdCh0b2FzdE1lc3NhZ2UudHJpbSgpLCAnc3VjY2VzcycpO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdHb29nbGUgU2hlZXRzIOaTjeS9nOWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ0dvb2dsZSBTaGVldHMg5pON5L2c5aSx6LSlOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogZXJyb3IpLCAnZXJyb3InKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLy8g5paw5aKe77ya5aSE55CG5bGV5byAIEVwaWMgVGlja2V0cyDnmoTlh73mlbBcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzKHNoZWV0VXJsOiBzdHJpbmcsIHRva2VuOiBzdHJpbmcpIHtcbiAgICBzaG93VG9hc3QoJ+W8gOWni+afpeaJviBFcGljIOW5tuiOt+WPluWtkOS7u+WKoS4uLicpO1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IHNoZWV0ID0gbmV3IFNoZWV0KHNoZWV0VXJsLCB0b2tlbik7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCBzaGVldC5yZWFkU2hlZXQoKTtcbiAgICAgICAgaWYgKCF2YWx1ZXMgfHwgdmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfooajmoLzkuLrnqbrmiJbml6Dms5Xor7vlj5YnLCAnZXJyb3InKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzaGVldEhlYWRlcnMgPSBhd2FpdCBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldCk7XG5cbiAgICAgICAgLy8g5om+5YiwIGtleSDliJfnmoTntKLlvJVcbiAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgaWYgKGtleUNvbHVtbkluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfmnKrmib7liLAgSmlyYSBLZXkg5YiX77yM6K+35qOA5p+l6KGo5aS05oiW6YWN572uJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ0ppcmEgS2V5IOWIl+e0ouW8lTonLCBrZXlDb2x1bW5JbmRleCk7XG5cbiAgICAgICAgY29uc3QgZXBpY3NUb0V4cGFuZDogeyBlcGljS2V5OiBzdHJpbmc7IGVwaWNTdW1tYXJ5OiBzdHJpbmc7IHJvd0luZGV4OiBudW1iZXI7IHN1YlRpY2tldHM6IEppcmFUaWNrZXRbXSB9W10gPSBbXTtcblxuICAgICAgICAvLyDpgY3ljobooajmoLzmn6Xmib4gRXBpYyBLZXkg5bm25p+l6K+i5a2Q5Lu75YqhXG4gICAgICAgIC8vIOS7juesrOS6jOihjOW8gOWni++8jOi3s+i/h+ihqOWktFxuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgcm93ID0gdmFsdWVzW2ldO1xuICAgICAgICAgICAgY29uc3Qga2V5Q2VsbENvbnRlbnQgPSByb3dba2V5Q29sdW1uSW5kZXhdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDlsJ3or5Xku44gSFlQRVJMSU5LIOaIlue6r+aWh+acrOS4reaPkOWPliBrZXlcbiAgICAgICAgICAgIGxldCBlcGljS2V5ID0gJyc7XG4gICAgICAgICAgICBpZiAoa2V5Q2VsbENvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGtleUNlbGxDb250ZW50Lm1hdGNoKC9icm93c2VcXC8oW0EtWjAtOV0rLVswLTldKykvaSk7IC8vIOaPkOWPliBicm93c2UvIOWQjumdoueahCBLZXlcbiAgICAgICAgICAgICAgICAgaWYgKG1hdGNoICYmIG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgICBlcGljS2V5ID0gbWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL15bQS1aMC05XSstWzAtOV0rJC9pLnRlc3Qoa2V5Q2VsbENvbnRlbnQudHJpbSgpKSkgeyAvLyDlpoLmnpzmmK/nuq8gS2V5XG4gICAgICAgICAgICAgICAgICAgIGVwaWNLZXkgPSBrZXlDZWxsQ29udGVudC50cmltKCk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoZXBpY0tleSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDmib7liLAgS2V5OiAke2VwaWNLZXl9IOWcqOihjCAke2kgKyAxfWApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGpxbCA9IGBpc3N1ZUZ1bmN0aW9uIGluIGlzc3Vlc0luRXBpY3MoXCJrZXkgPSAke2VwaWNLZXl9XCIpYDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJUaWNrZXRzID0gYXdhaXQgZmV0Y2hKaXJhVGlja2V0cyhqcWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViVGlja2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXBpYyAke2VwaWNLZXl9IOaciSAke3N1YlRpY2tldHMubGVuZ3RofSDkuKrlrZDku7vliqFgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWwneivleiOt+WPliBFcGljIOeahOamguimgeS/oeaBr++8iOWmguaenOWFtuS7luWIl+WtmOWcqO+8iVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLnN1bW1hcnkgPyBnZXRDb2x1bW5JbmRleChzaGVldEhlYWRlcnMuc3VtbWFyeSkgOiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVwaWNTdW1tYXJ5ID0gc3VtbWFyeUNvbHVtbkluZGV4ICE9PSAtMSAmJiByb3dbc3VtbWFyeUNvbHVtbkluZGV4XSA/IHJvd1tzdW1tYXJ5Q29sdW1uSW5kZXhdIDogZXBpY0tleTsgLy8gRGVmYXVsdCB0byBrZXkgaWYgc3VtbWFyeSBtaXNzaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVwaWNzVG9FeHBhbmQucHVzaCh7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVwaWNLZXksIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVwaWNTdW1tYXJ5OiBlcGljU3VtbWFyeSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dJbmRleDogaSwgLy8gMC1iYXNlZCBpbmRleFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YlRpY2tldHMgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXBpYyAke2VwaWNLZXl9IOayoeacieWtkOS7u+WKoeaIluS4jeaYryBFcGljYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChmZXRjaEVycm9yOiBFcnJvciB8IGFueSkgeyAvLyBTcGVjaWZ5IHR5cGUgZm9yIGZldGNoRXJyb3JcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihg5p+l6K+iIEVwaWMgJHtlcGljS2V5fSDnmoTlrZDku7vliqHlpLHotKU6YCwgZmV0Y2hFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIC8vIOmAieaLqeaAp+WcsOmAmuefpeeUqOaIt+aIlue7p+e7reWkhOeQhuS4i+S4gOS4qlxuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOafpeivoiAke2VwaWNLZXl9IOWtkOS7u+WKoeWksei0pTogJHtmZXRjaEVycm9yLm1lc3NhZ2UgfHwgZmV0Y2hFcnJvcn1gLCAnZXJyb3InKTsgLy8gU2hvdyBlcnJvciBtZXNzYWdlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhg6KGMICR7aSArIDF9IOacquaJvuWIsOacieaViOeahCBLZXlgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcGljc1RvRXhwYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrmib7liLDku7vkvZXljIXlkKvlrZDku7vliqHnmoQgRXBpYycsICdpbmZvJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzaG93VG9hc3QoYOaJvuWIsCAke2VwaWNzVG9FeHBhbmQubGVuZ3RofSDkuKogRXBpYyDljIXlkKvlrZDku7vliqHvvIzlh4blpIfnoa7orqTmk43kvZwuLi5gKTtcblxuICAgICAgICAvLyAtLS0g5LiL5LiA5q2lOiDkv67mlLnnoa7orqTlr7nor53moYblubblpITnkIbmj5LlhaUv5YiG57uEIC0tLVxuICAgICAgICBjb25zb2xlLmxvZygn5YeG5aSH56Gu6K6k55qEIEVwaWNzOicsIGVwaWNzVG9FeHBhbmQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY29uZmlybWVkRXBpY3MgPSBhd2FpdCBzaG93RXBpY0NvbmZpcm1hdGlvbkRpYWxvZyhlcGljc1RvRXhwYW5kKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjb25maXJtZWRFcGljcyAmJiBjb25maXJtZWRFcGljcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBhd2FpdCBpbnNlcnRTdWJUaWNrZXRzKHNoZWV0LCBjb25maXJtZWRFcGljcywgc2hlZXRIZWFkZXJzLCBlbnZDb25maWcuSklSQV9CQVNFX1VSTCk7XG4gICAgICAgICAgICBzaG93VG9hc3QoYOW3suaIkOWKn+WxleW8gCAke2NvbmZpcm1lZEVwaWNzLmxlbmd0aH0g5LiqIEVwaWMg55qE5a2Q5Lu75YqhYCwgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pON5L2c5bey5Y+W5raIJywgJ2luZm8nKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5Li05pe25Y2g5L2N56ym77yM6KGo56S65rWB56iL6L+b6KGM5Yiw6L+Z6YeMXG4gICAgICAgIHNob3dUb2FzdCgn5a2Q5Lu75Yqh5p+l5om+5a6M5oiQ77yM56Gu6K6k44CB5o+S5YWl5ZKM5YiG57uE5Yqf6IO95b6F5a6e546wJywgJ3dhcm5pbmcnKTtcblxuXG4gICAgfSBjYXRjaCAoZXJyb3I6IEVycm9yIHwgYW55KSB7IC8vIFNwZWNpZnkgdHlwZSBmb3IgZXJyb3JcbiAgICAgICAgY29uc29sZS5lcnJvcign5aSE55CGIEVwaWMg5bGV5byA5pe25Ye66ZSZOicsIGVycm9yKTtcbiAgICAgICAgc2hvd1RvYXN0KCflpITnkIYgRXBpYyDlsZXlvIDml7blh7rplJk6ICcgKyAoZXJyb3IubWVzc2FnZSB8fCBlcnJvciksICdlcnJvcicpOyAvLyBVc2UgZXJyb3IubWVzc2FnZSBpZiBhdmFpbGFibGVcbiAgICAgICAgdGhyb3cgZXJyb3I7IC8vIFJlLXRocm93IGVycm9yIHRvIGJlIGNhdWdodCBieSB0aGUgY2FsbGVyXG4gICAgfVxufVxuXG4vLyBFcGljIOehruiupOWvueivneahhlxuYXN5bmMgZnVuY3Rpb24gc2hvd0VwaWNDb25maXJtYXRpb25EaWFsb2coXG4gICAgZXBpY3M6IHsgZXBpY0tleTogc3RyaW5nOyBlcGljU3VtbWFyeTogc3RyaW5nOyByb3dJbmRleDogbnVtYmVyOyBzdWJUaWNrZXRzOiBKaXJhVGlja2V0W10gfVtdXG4pOiBQcm9taXNlPHR5cGVvZiBlcGljcz4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBkaWFsb2cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgICAgIHdpZHRoOiA4MDBweDtcbiAgICAgICAgICAgIG1heC13aWR0aDogOTB2dztcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDgwdmg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgYDtcblxuICAgICAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZmxleC1zaHJpbms6IDA7XCI+56Gu6K6k5bGV5byAIEVwaWM8L2gzPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDE1cHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzY2NjtcIj5cbiAgICAgICAgICAgICAgICAgICAg5om+5YiwICR7ZXBpY3MubGVuZ3RofSDkuKrljIXlkKvlrZDku7vliqHnmoQgRXBpY1xuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTBweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGlkPVwic2VsZWN0QWxsRXBpY3NcIiBjaGVja2VkIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiA1cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIOWFqOmAiS/lj5bmtojlhajpgIlcbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZmxleC1ncm93OiAxOyBvdmVyZmxvdy15OiBhdXRvOyBib3JkZXI6IDFweCBzb2xpZCAjZWVlOyBib3JkZXItcmFkaXVzOiA0cHg7IG1hcmdpbi1ib3R0b206IDE1cHg7XCI+XG4gICAgICAgICAgICAgICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XCI+XG4gICAgICAgICAgICAgICAgICAgIDx0aGVhZCBzdHlsZT1cInBvc2l0aW9uOiBzdGlja3k7IHRvcDogMDsgYmFja2dyb3VuZDogI2Y1ZjVmNTsgei1pbmRleDogMTtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7IHdpZHRoOiA1MHB4O1wiPumAieaLqTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0O1wiPkVwaWM8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj7lrZDku7vliqHmlbDph488L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICAgICAgJHtlcGljcy5tYXAoKGVwaWMsIGluZGV4KSA9PiBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNlZWU7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cImVwaWMtY2hlY2tib3hcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIiBjaGVja2VkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2VwaWMuZXBpY0tleX0gLSAke2VwaWMuZXBpY1N1bW1hcnl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZXBpYy5zdWJUaWNrZXRzLmxlbmd0aH0g5Liq5a2Q5Lu75YqhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgICAgIGApLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kOyBnYXA6IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxPcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjZWVlOyBib3JkZXI6IDFweCBzb2xpZCAjY2NjOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY29uZmlybU9wZXJhdGlvblwiIHN0eWxlPVwicGFkZGluZzogNnB4IDEycHg7IGJhY2tncm91bmQ6ICMwMDdiZmY7IGNvbG9yOiB3aGl0ZTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjtcIj7noa7orqQ8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgICAgICBjb25zdCBzZWxlY3RBbGxDaGVja2JveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWxlY3RBbGxFcGljcycpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IGVwaWNDaGVja2JveGVzID0gZGlhbG9nLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2VwaWMtY2hlY2tib3gnKSBhcyBIVE1MQ29sbGVjdGlvbk9mPEhUTUxJbnB1dEVsZW1lbnQ+O1xuICAgICAgICBjb25zdCBjb25maXJtQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm1PcGVyYXRpb24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblxuICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgICAgICBjaGVja2JveC5jaGVja2VkID0gc2VsZWN0QWxsQ2hlY2tib3guY2hlY2tlZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgIGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkID0gQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcykuZXZlcnkoY2IgPT4gY2IuY2hlY2tlZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbmNlbE9wZXJhdGlvbicpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIHJlc29sdmUoW10pO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25maXJtQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRFcGljcyA9IEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjaGVja2JveCA9PiBjaGVja2JveC5jaGVja2VkKVxuICAgICAgICAgICAgICAgIC5tYXAoY2hlY2tib3ggPT4gZXBpY3NbcGFyc2VJbnQoY2hlY2tib3guZGF0YXNldC5pbmRleCB8fCAnMCcpXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIHJlc29sdmUoc2VsZWN0ZWRFcGljcyk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDmj5LlhaXlrZDku7vliqFcbmFzeW5jIGZ1bmN0aW9uIGluc2VydFN1YlRpY2tldHMoXG4gICAgc2hlZXQ6IFNoZWV0LFxuICAgIGVwaWNzOiB7IGVwaWNLZXk6IHN0cmluZzsgZXBpY1N1bW1hcnk6IHN0cmluZzsgcm93SW5kZXg6IG51bWJlcjsgc3ViVGlja2V0czogSmlyYVRpY2tldFtdIH1bXSxcbiAgICBzaGVldEhlYWRlcnM6IEppcmFIZWFkZXJzLFxuICAgIGppcmFCYXNlVXJsOiBzdHJpbmdcbikge1xuICAgIC8vIOaMieihjOWPt+S7juWkp+WIsOWwj+aOkuW6j++8jOi/meagt+aPkuWFpeaXtuS4jeS8muW9seWTjeWQjue7reeahOihjOWPt1xuICAgIGNvbnN0IHNvcnRlZEVwaWNzID0gWy4uLmVwaWNzXS5zb3J0KChhLCBiKSA9PiBiLnJvd0luZGV4IC0gYS5yb3dJbmRleCk7XG4gICAgXG4gICAgZm9yIChjb25zdCBlcGljIG9mIHNvcnRlZEVwaWNzKSB7XG4gICAgICAgIGNvbnN0IGluc2VydFJvd0luZGV4ID0gZXBpYy5yb3dJbmRleCArIDI7IC8vICsyIOWboOS4uiByb3dJbmRleCDmmK8gMC1iYXNlZO+8jOS4lOaIkeS7rOimgeaPkuWcqCBFcGljIOihjOeahOS4i+aWuVxuICAgICAgICBjb25zdCBkaXNwbGF5SGVhZGVycyA9IFsna2V5JywgJ3N1bW1hcnknLCAnc3RhdHVzJywgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJ107XG4gICAgICAgIGNvbnN0IG1heENvbEluZGV4ID0gZ2V0TWF4Q29sdW1uSW5kZXgoT2JqZWN0LnZhbHVlcyhzaGVldEhlYWRlcnMpLmZpbHRlcigodmFsdWUpOiB2YWx1ZSBpcyBzdHJpbmcgPT4gXG4gICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmxlbmd0aCA+IDBcbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8g5YWI5o+S5YWl56m66KGMXG4gICAgICAgIGNvbnN0IHJvd3NUb0luc2VydCA9IGVwaWMuc3ViVGlja2V0cy5sZW5ndGg7XG4gICAgICAgIGlmIChyb3dzVG9JbnNlcnQgPiAwKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0Lmluc2VydERpbWVuc2lvbignUk9XUycsIGluc2VydFJvd0luZGV4IC0gMSwgaW5zZXJ0Um93SW5kZXggLSAxICsgcm93c1RvSW5zZXJ0KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5bey5Zyo6KGMICR7aW5zZXJ0Um93SW5kZXh9IOaPkuWFpSAke3Jvd3NUb0luc2VydH0g5Liq56m66KGMYCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+aPkuWFpeepuuihjOWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDmj5LlhaXnqbrooYzlpLHotKU6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3ViVGlja2V0Um93cyA9IGVwaWMuc3ViVGlja2V0cy5tYXAodGlja2V0ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJvdyA9IG5ldyBBcnJheShtYXhDb2xJbmRleCkuZmlsbCgnJyk7XG4gICAgICAgICAgICBkaXNwbGF5SGVhZGVycy5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2x1bW5MZXR0ZXIgPSBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF07XG4gICAgICAgICAgICAgICAgaWYgKGNvbHVtbkxldHRlciAmJiB0eXBlb2YgY29sdW1uTGV0dGVyID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xJbmRleCA9IGdldENvbHVtbkluZGV4KGNvbHVtbkxldHRlcik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZCA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSBgPUhZUEVSTElOSyhcIiR7amlyYUJhc2VVcmx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcm93O1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyDlhpnlhaXlrZDku7vliqHmlbDmja5cbiAgICAgICAgY29uc3Qgc3RhcnRQb3NpdGlvbiA9IGBBJHtpbnNlcnRSb3dJbmRleH1gO1xuICAgICAgICBhd2FpdCBzaGVldC53cml0ZVNoZWV0KHN1YlRpY2tldFJvd3MsIHN0YXJ0UG9zaXRpb24pO1xuICAgICAgICBjb25zb2xlLmxvZyhg5bey5Zyo6KGMICR7aW5zZXJ0Um93SW5kZXh9IOWGmeWFpSAke3N1YlRpY2tldFJvd3MubGVuZ3RofSDkuKrlrZDku7vliqFgKTtcbiAgICB9XG59XG4iXSwibmFtZXMiOlsiZ2V0RW52Q29uZmlnIiwiZmV0Y2hKaXJhVGlja2V0cyIsImpxbCIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwicmVxdWVzdElkIiwiTWF0aCIsInJhbmRvbSIsInRvU3RyaW5nIiwic3Vic3RyaW5nIiwibWVzc2FnZUxpc3RlbmVyIiwibWVzc2FnZSIsInR5cGUiLCJjaHJvbWUiLCJydW50aW1lIiwib25NZXNzYWdlIiwicmVtb3ZlTGlzdGVuZXIiLCJlcnJvciIsIkVycm9yIiwidGlja2V0cyIsImFkZExpc3RlbmVyIiwic2VuZE1lc3NhZ2UiLCJGRVRDSF9KSVJBX1RJQ0tFVFMiLCJzb3VyY2VUYWJJZCIsImVudkNvbmZpZyIsInVybCIsIkpJUkFfQkFTRV9VUkwiLCJlbmNvZGVVUklDb21wb25lbnQiLCJ0YWJzIiwiY3JlYXRlIiwiYWN0aXZlIiwidGFiIiwiaWQiLCJjaGVja1BhZ2VMb2FkIiwiZ2V0IiwidXBkYXRlZFRhYiIsInN0YXR1cyIsImluY2x1ZGVzIiwic2V0VGltZW91dCIsInVwZGF0ZSIsInNjcmlwdGluZyIsImV4ZWN1dGVTY3JpcHQiLCJ0YXJnZXQiLCJ0YWJJZCIsImZ1bmMiLCJpc0ppcmFDbG91ZCIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsInJvd3MiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGVuZ3RoIiwiZm9yRWFjaCIsInJvdyIsImtleUVsZW1lbnQiLCJzdW1tYXJ5RWxlbWVudCIsInN0YXR1c0NvbnRhaW5lciIsInN0YXR1c0VsZW1lbnQiLCJjZWxscyIsImFzc2lnbmVlIiwicmVwb3J0ZXIiLCJwcmlvcml0eSIsImNyZWF0ZWQiLCJ1cGRhdGVkIiwiZHVlZGF0ZSIsImFzc2lnbmVlVGV4dCIsInRleHRDb250ZW50IiwidHJpbSIsIm1hdGNoIiwiZHVlRGF0ZVRleHQiLCJ0aWNrZXQiLCJrZXkiLCJzdW1tYXJ5IiwiZGVzY3JpcHRpb24iLCJwdXNoIiwiY2VsbCIsImNsYXNzTGlzdCIsInByb3BlcnR5TmFtZSIsImltZyIsInZhbHVlIiwiZ2V0QXR0cmlidXRlIiwicmVzdWx0cyIsInJlc3VsdCIsIm1hcCIsInNwbGl0IiwicyIsImZpbHRlciIsIkJvb2xlYW4iLCJwb3AiLCJyZW1vdmUiLCJTaGVldCIsImNvbnN0cnVjdG9yIiwidG9rZW4iLCJzaGVldElkIiwiZXh0cmFjdFNoZWV0SWQiLCJnaWQiLCJleHRyYWN0R2lkIiwiaW5pdCIsImdldFRva2VuIiwic2hlZXROYW1lIiwiZ2V0U2hlZXROYW1lQnlHaWQiLCJpZGVudGl0eSIsImdldEF1dGhUb2tlbiIsImludGVyYWN0aXZlIiwibGFzdEVycm9yIiwiZ2V0U2hlZXROYW1lcyIsInJlcyIsImZldGNoIiwiaGVhZGVycyIsIkF1dGhvcml6YXRpb24iLCJqc29uIiwic2hlZXRzIiwic2hlZXQiLCJmaW5kIiwicHJvcGVydGllcyIsInRpdGxlIiwicmVhZFNoZWV0Iiwic2hlZXRVcmwiLCJ2YWx1ZXMiLCJ3cml0ZVNoZWV0IiwicG9zaXRpb24iLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJtZXRob2QiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsImluc2VydERpbWVuc2lvbiIsImRpbWVuc2lvbiIsInN0YXJ0SW5kZXgiLCJlbmRJbmRleCIsInJlcXVlc3QiLCJyZXF1ZXN0cyIsInJhbmdlIiwicGFyc2VJbnQiLCJpbmhlcml0RnJvbUJlZm9yZSIsImFkZERpbWVuc2lvbkdyb3VwIiwib2siLCJyZWFkQ29uZmlnU2hlZXQiLCJjb25maWdTaGVldE5hbWUiLCJjb25zb2xlIiwiZ2V0SGVhZGVycyIsImdldFNoZWV0TmFtZSIsImdldEluZGV4ZWREQkRhdGEiLCJkYXRhYmFzZU5hbWUiLCJzdG9yZU5hbWUiLCJpbmRleGVkREIiLCJvcGVuIiwib25zdWNjZXNzIiwiZXZlbnQiLCJkYiIsInRyYW5zYWN0aW9uIiwib2JqZWN0U3RvcmUiLCJkYXRhUmVxdWVzdCIsImdldEFsbCIsIm9uZXJyb3IiLCJnZXRMb2NhbFN0b3JhZ2VJdGVtIiwiZGVmYXVsdFZhbHVlIiwicGFyc2UiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwic2V0TG9jYWxTdG9yYWdlSXRlbSIsInNldEl0ZW0iLCJnZXRDdXJyZW50VXNlckluZm8iLCJleHRlbnNpb24iLCJleHRlbnNpb25JZCIsInVzZXJuYW1lIiwiZ2V0Rm9sZGVycyIsInRoZW4iLCJfcmVmIiwiZGF0YSIsImZhdm9yaXRlX2dyb3VwX2lkcyIsImNvbnZlcnNhdGlvbl9zZXRzIiwiZm9sZGVycyIsImlkcyIsIml0ZW0iLCJjYXRjaCIsImxvZyIsImdldEdyb3Vwc01hcCIsImdyb3VwcyIsImdyb3Vwc01hcCIsInJlZHVjZSIsImFjYyIsImdyb3VwIiwibmFtZSIsInNldF9hYmJyZXZpYXRpb24iLCJpc190ZWFtIiwiZm9ybWF0RGF0ZSIsImRhdGVTdHJpbmciLCJkYXRlIiwiRGF0ZSIsInllYXIiLCJnZXRGdWxsWWVhciIsIm1vbnRoIiwiU3RyaW5nIiwiZ2V0TW9udGgiLCJwYWRTdGFydCIsImRheSIsImdldERhdGUiLCJob3VycyIsImdldEhvdXJzIiwibWludXRlcyIsImdldE1pbnV0ZXMiLCJzZWNvbmRzIiwiZ2V0U2Vjb25kcyIsInVuaXFCeSIsImFycmF5Iiwic2VlbiIsIlNldCIsImtleVZhbHVlIiwiaGFzIiwiYWRkIiwic2hvd1RvYXN0Iiwib25DbG9zZSIsImNvbnRhaW5lciIsImdldEVsZW1lbnRCeUlkIiwiZXhpc3RpbmdUb2FzdCIsInJlbW92ZUNoaWxkIiwidG9hc3QiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwidG9hc3RJbm5lciIsImFwcGVuZENoaWxkIiwidGltZXIiLCJjb250YWlucyIsImNsZWFyVGltZW91dCIsInRyYW5zZm9ybUdyb3VwTGlua3MiLCJpbnB1dFN0cmluZyIsImdyb3VwTGlua1BhdHRlcm4iLCJ0cmFuc2Zvcm1lZFN0cmluZyIsInJlcGxhY2UiLCJncm91cE5hbWUiLCJncm91cElkIiwidHJhbnNmb3JtUG9zdExpbmtzIiwicG9zdExpbmtQYXR0ZXJuIiwiaW5kZXgiLCJwb3N0SWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwiZGVmYXVsdEVudkNvbmZpZyIsIlNDSEVEVUxFRF9JTlRFUlZBTCIsIk51bWJlciIsInByb2Nlc3MiLCJlbnYiLCJBTkFMWVNJU19UWVBFIiwiTExNX1RZUEUiLCJBTkFMWVpFX0JZX0dST1VQIiwiT0xMQU1BX0JBU0VfVVJMIiwiT0xMQU1BX01PREVMIiwiT0xMQU1BX1JFVklFV19NT0RFTCIsIk9MTEFNQV9RVUVSWV9NT0RFTCIsIkRJRllfQVBJX0tFWSIsIkRJRllfUkVWSUVXX0FQSV9LRVkiLCJESUZZX0FQSV9CQVNFX1VSTCIsIk9QRU5BSV9BUElfS0VZIiwiT1BFTkFJX01PREVMIiwiT1BFTkFJX1JFVklFV19NT0RFTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJHUk9RX0FQSV9LRVkiLCJHUk9RX01PREVMIiwiR1JPUV9SRVZJRVdfTU9ERUwiLCJCT1RfQVBJX0JBU0VfVVJMIiwiQk9UX1RPS0VOIiwiQk9UX0lEIiwiQk9UX1RZUEUiLCJURUFNX0lEIiwiRU5BQkxFX0JPVCIsIkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQiLCJFTkFCTEVfQ0hST01BIiwiQ0hST01BX0FQSV9VUkwiLCJDSFJPTUFfUE9SVCIsIkNIUk9NQV9DT0xMRUNUSU9OX05BTUUiLCJKSVJBX1VTRVJOQU1FIiwiSklSQV9BUElfVE9LRU4iLCJzdG9yYWdlIiwibG9jYWwiLCJnZXREZWZhdWx0RW52Q29uZmlnIiwiZ2V0VXNlckluZm8iLCJhY2NvdW50VUQiLCJhY2NvdW50SW5mb0xpc3QiLCJhY2NvdW50SW5mbyIsImRpc3BsYXlOYW1lIiwiZW1haWwiLCJmdWxsTmFtZSIsImpvaW4iLCJ0b0xvd2VyQ2FzZSIsInVzZXJJbmZvIiwic2VuZGVyIiwic2VuZFJlc3BvbnNlIiwid2FybiIsInN1Y2Nlc3MiLCJvcGVuSnFsRGlhbG9nIiwic2hlZXRUb2tlbiIsImhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzIiwiZGlhbG9nIiwic3R5bGUiLCJjc3NUZXh0IiwiaW5uZXJIVE1MIiwiYWRkRXZlbnRMaXN0ZW5lciIsImhhbmRsZUZldGNoSmlyYVRpY2tldHNUb1NoZWV0Iiwic2hlZXRIZWFkZXJzIiwiZmluZFZhbGlkSmlyYUhlYWRlcnMiLCJrZXlDb2x1bW5JbmRleCIsImdldENvbHVtbkluZGV4IiwiZXhpc3RpbmdLZXlzIiwic2xpY2UiLCJrZXlDZWxsIiwidGVzdCIsImhlYWRlck1hcHBpbmciLCJjdXN0b21GaWVsZE1hcHBpbmciLCJjb25maWdEYXRhIiwic2hlZXRIZWFkZXJJbmRleCIsImZpbmRJbmRleCIsImgiLCJqaXJhRmllbGRJbmRleCIsImkiLCJtYXgiLCJzaGVldEhlYWRlciIsImppcmFGaWVsZCIsInN0YXJ0c1dpdGgiLCJ2YWxpZEhlYWRlcnMiLCJrbm93bkZpZWxkcyIsImhlYWRlciIsImhlYWRlckxvd2VyIiwiY29sdW1uTGV0dGVyIiwiZnJvbUNoYXJDb2RlIiwiZGlyZWN0TWF0Y2giLCJmaWVsZCIsImNvbHVtbiIsInRvVXBwZXJDYXNlIiwidXBwZXJDb2x1bW4iLCJjaGFyQ29kZUF0IiwiZ2V0TWF4Q29sdW1uSW5kZXgiLCJjb2x1bW5MZXR0ZXJzIiwiQXJyYXkiLCJpc0FycmF5IiwidmFsaWRMZXR0ZXJzIiwiaW5kaWNlcyIsImNvbCIsInNob3dDb25maXJtYXRpb25EaWFsb2ciLCJvcGVyYXRpb25zIiwiZGlzcGxheUhlYWRlcnMiLCJjb2x1bW5zVG9VcGRhdGUiLCJ1cGRhdGVDb3VudCIsIm9wIiwiYXBwZW5kQ291bnQiLCJzZWxlY3RBbGxDaGVja2JveCIsInRpY2tldENoZWNrYm94ZXMiLCJnZXRFbGVtZW50c0J5Q2xhc3NOYW1lIiwiY29uZmlybUJ1dHRvbiIsInVwZGF0ZUNvbmZpcm1CdXR0b25Db3VudCIsInNlbGVjdGVkQ291bnQiLCJmcm9tIiwiY2IiLCJjaGVja2VkIiwiZGlzYWJsZWQiLCJjaGVja2JveCIsImV2ZXJ5Iiwic2VsZWN0ZWRPcGVyYXRpb25zIiwiZGF0YXNldCIsImV4aXN0aW5nVG9hc3RzIiwidCIsImJhY2tncm91bmRDb2xvciIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm9wYWNpdHkiLCJmb3JtYXR0ZWREYXRhIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0IiwiaW5mZXJyZWRLZXlJbmRleCIsImtleVRvUm93TWFwIiwiTWFwIiwic2V0IiwiZXhpc3RpbmdSb3dJbmRleCIsInJvd0luZGV4IiwiY29uZmlybWVkT3BlcmF0aW9ucyIsInVwZGF0ZXNEYXRhIiwiYXBwZW5kRGF0YSIsImhlYWRlclZhbHVlcyIsIk9iamVjdCIsIm1heENvbEluZGV4Iiwib3BlcmF0aW9uIiwiZmlsbCIsImtleXMiLCJ0aWNrZXRLZXkiLCJjb2xJbmRleCIsInVwZGF0ZWRDb3VudCIsImFwcGVuZGVkQ291bnQiLCJzdGFydENvbHVtbiIsInN0YXJ0UG9zaXRpb24iLCJ0b2FzdE1lc3NhZ2UiLCJlcGljc1RvRXhwYW5kIiwia2V5Q2VsbENvbnRlbnQiLCJlcGljS2V5Iiwic3ViVGlja2V0cyIsInN1bW1hcnlDb2x1bW5JbmRleCIsImVwaWNTdW1tYXJ5IiwiZmV0Y2hFcnJvciIsImNvbmZpcm1lZEVwaWNzIiwic2hvd0VwaWNDb25maXJtYXRpb25EaWFsb2ciLCJpbnNlcnRTdWJUaWNrZXRzIiwiZXBpY3MiLCJlcGljIiwiZXBpY0NoZWNrYm94ZXMiLCJzZWxlY3RlZEVwaWNzIiwiamlyYUJhc2VVcmwiLCJzb3J0ZWRFcGljcyIsInNvcnQiLCJhIiwiYiIsImluc2VydFJvd0luZGV4Iiwicm93c1RvSW5zZXJ0Iiwic3ViVGlja2V0Um93cyJdLCJzb3VyY2VSb290IjoiIn0=