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
                      const value = cell.textContent?.trim() || '';

                      // If the class name is 'issuekey', the property in our object should be 'key'
                      if (propertyName === 'issuekey') propertyName = 'key';
                      if (propertyName === 'issuetype') propertyName = 'type';
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
        <textarea id="jql" style="width: 100%; height: 100px; margin-bottom: 10px;"></textarea>
        <p style="font-size: 12px; color: #666; margin-top: -5px; margin-bottom: 10px;">请在 <a href="https://jira.ringcentral.com/issues/?jql=" target="_blank">filter 查询页面</a> 配置需要展示的 columns 且设为列表模式。</p>
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q08sVUFBVSxDQUFDbVMsYUFBYSxFQUFFdEUsYUFBYSxDQUFDO0lBQ3BEeE0sT0FBTyxDQUFDcUMsR0FBRyxDQUFDLE9BQU91TyxjQUFjLE9BQU9FLGFBQWEsQ0FBQ3JXLE1BQU0sT0FBTyxDQUFDO0VBQ3hFO0FBQ0osQyIsInNvdXJjZXMiOlsid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2ppcmEudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvc2hlZXQudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvc3RvcmFnZS50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy91dGlscy50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2NvbnRlbnRTY3JpcHRHb29nbGVTaGVldC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RW52Q29uZmlnIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIOS7jiBKaXJhIOmhtemdouaKk+WPluaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoSmlyYVRpY2tldHMoanFsOiBzdHJpbmcpOiBQcm9taXNlPEppcmFUaWNrZXRbXT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZyg3KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOebkeWQrOadpeiHqiBiYWNrZ3JvdW5kIHNjcmlwdCDnmoTmtojmga9cbiAgICAgICAgY29uc3QgbWVzc2FnZUxpc3RlbmVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0pJUkFfVElDS0VUU19SRVNVTFQnICYmIG1lc3NhZ2UucmVxdWVzdElkID09PSByZXF1ZXN0SWQpIHtcbiAgICAgICAgICAgICAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIobWVzc2FnZUxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICBpZiAobWVzc2FnZS5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKG1lc3NhZ2UuZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UudGlja2V0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIobWVzc2FnZUxpc3RlbmVyKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWPkemAgea2iOaBr+e7mSBiYWNrZ3JvdW5kIHNjcmlwdCDmnaXliJvlu7rmlrDmoIfnrb7pobVcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ0ZFVENIX0pJUkFfVElDS0VUUycsXG4gICAgICAgICAgICBqcWwsXG4gICAgICAgICAgICByZXF1ZXN0SWRcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbi8vIOeEtuWQjuWcqCBGRVRDSF9KSVJBX1RJQ0tFVFMg5Ye95pWw5Lit5L2/55SoIHNvdXJjZVRhYklkXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gRkVUQ0hfSklSQV9USUNLRVRTKGpxbDogc3RyaW5nLCByZXF1ZXN0SWQ6IHN0cmluZywgc291cmNlVGFiSWQ6IG51bWJlcikge1xuICBjb25zdCBlbnZDb25maWcgPSBhd2FpdCBnZXRFbnZDb25maWcoKTtcbiAgY29uc3QgdXJsID0gYCR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2lzc3Vlcy8/anFsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGpxbCl9YDtcbiAgICAgICAgXG4gIC8vIOWIm+W7uuaWsOagh+etvumhtVxuICBjaHJvbWUudGFicy5jcmVhdGUoeyB1cmwsIGFjdGl2ZTogZmFsc2UgfSwgKHRhYikgPT4ge1xuICAgICAgaWYgKCF0YWIuaWQpIHtcbiAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgZXJyb3I6ICfml6Dms5XliJvlu7rmoIfnrb7pobUnXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyDnrYnlvoXpobXpnaLliqDovb3lrozmiJBcbiAgICAgIGNvbnN0IGNoZWNrUGFnZUxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuZ2V0KHRhYi5pZCEsICh1cGRhdGVkVGFiKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh1cGRhdGVkVGFiLnN0YXR1cyA9PT0gJ2NvbXBsZXRlJykge1xuICAgICAgICAgICAgICAgIGlmICh1cGRhdGVkVGFiLnVybC5pbmNsdWRlcygnbG9naW4nKSB8fCB1cGRhdGVkVGFiLnVybC5pbmNsdWRlcygnb2t0YScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ2ppcmEg6ZyA6KaB55m75b2V77yM6K+355m75b2V5ZCO6YeN5paw5bCd6K+VJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBjaHJvbWUudGFicy51cGRhdGUodGFiLmlkISwgeyBhY3RpdmU6IHRydWUgfSksIDMwMDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgLy8g5rOo5YWl5YaF5a656ISa5pysXG4gICAgICAgICAgICAgICAgICBjaHJvbWUuc2NyaXB0aW5nLmV4ZWN1dGVTY3JpcHQoe1xuICAgICAgICAgICAgICAgICAgICAgIHRhcmdldDogeyB0YWJJZDogdGFiLmlkISB9LFxuICAgICAgICAgICAgICAgICAgICAgIGZ1bmM6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGlja2V0czogYW55W10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWIpOaWreaYr+WQpuaYr0ppcmEgQ2xvdWTniYjmnKzvvIzpgJrov4fmo4Dmn6XnibnlrprnmoRET03lhYPntKDliKTmlq1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNKaXJhQ2xvdWQgPSAhIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3RhYmxlW2RhdGEtdmM9XCJpc3N1ZS10YWJsZVwiXScpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3RhYmxlW2FyaWEtbGFiZWw9XCJXb3JrXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNKaXJhQ2xvdWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEppcmEgQ2xvdWQg54mI5pys55qE6YCJ5oup5ZmoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3dzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndHJbZGF0YS10ZXN0aWQ9XCJuYXRpdmUtaXNzdWUtdGFibGUudWkuaXNzdWUtcm93XCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyb3dzICYmIHJvd3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3MuZm9yRWFjaChyb3cgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDojrflj5ZrZXkgLSBhW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLmNvbW1vbi51aS5pc3N1ZS1jZWxscy5pc3N1ZS1rZXkuaXNzdWUta2V5LWNlbGxcIl1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5RWxlbWVudCA9IHJvdy5xdWVyeVNlbGVjdG9yKCdhW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLmNvbW1vbi51aS5pc3N1ZS1jZWxscy5pc3N1ZS1rZXkuaXNzdWUta2V5LWNlbGxcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOiOt+WPlnN1bW1hcnkgLSBhW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLmNvbW1vbi51aS5pc3N1ZS1jZWxscy5pc3N1ZS1zdW1tYXJ5Lmlzc3VlLXN1bW1hcnktY2VsbFwiXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdW1tYXJ5RWxlbWVudCA9IHJvdy5xdWVyeVNlbGVjdG9yKCdhW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLmNvbW1vbi51aS5pc3N1ZS1jZWxscy5pc3N1ZS1zdW1tYXJ5Lmlzc3VlLXN1bW1hcnktY2VsbFwiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g6I635Y+Wc3RhdHVzIC0g54q25oCB5L2N5LqO5pyJ54m55a6aY2xhc3PnmoRzcGFu5LitXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXR1c0NvbnRhaW5lciA9IHJvdy5xdWVyeVNlbGVjdG9yKCdkaXZbZGF0YS10ZXN0aWRePVwiaXNzdWUuZmllbGRzLnN0YXR1cy5jb21tb24udWkuc3RhdHVzLWxvemVuZ2VcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHVzRWxlbWVudCA9IHN0YXR1c0NvbnRhaW5lciA/IHN0YXR1c0NvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdkaXYuXzRjdnIxaDZvJykgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g57uP5Yqe5Lq644CB5oql5ZGK5Lq65ZKM5LyY5YWI57qn6YCa5bi45L2N5LqO55u45bqU55qE5Y2V5YWD5qC85LitXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNlbGxzID0gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBhc3NpZ25lZSA9ICcnLCByZXBvcnRlciA9ICcnLCBwcmlvcml0eSA9ICcnLCBjcmVhdGVkID0gJycsIHVwZGF0ZWQgPSAnJywgZHVlZGF0ZSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g6YCa6L+H5L2N572u5Yik5pat5ZCE5Liq5a2X5q61XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjZWxscy5sZW5ndGggPj0gMTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDXkuKrljZXlhYPmoLzmmK9hc3NpZ25lZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzaWduZWVUZXh0ID0gY2VsbHNbNF0udGV4dENvbnRlbnQ/LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlID0gYXNzaWduZWVUZXh0Lm1hdGNoKC9eKC4rPylcXDErJC8pWzFdIHx8IGFzc2lnbmVlVGV4dDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlID0gYXNzaWduZWUgIT09ICdVbmFzc2lnbmVkJyA/IGFzc2lnbmVlIHx8ICcnIDogJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDbkuKrljZXlhYPmoLzmmK9yZXBvcnRlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZXIgPSBjZWxsc1s1XS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZXIgPSByZXBvcnRlci5tYXRjaCgvXiguKz8pXFwxKyQvKVsxXSB8fCByZXBvcnRlcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysN+S4quWNleWFg+agvOaYr3ByaW9yaXR5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eSA9IGNlbGxzWzZdLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDnkuKrljZXlhYPmoLzmmK9jcmVhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkID0gY2VsbHNbOF0udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysMTDkuKrljZXlhYPmoLzmmK91cGRhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkID0gY2VsbHNbOV0udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YGH6K6+56ysMTHkuKrljZXlhYPmoLzmmK9kdWVkYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkdWVEYXRlVGV4dCA9IGNlbGxzWzEwXS50ZXh0Q29udGVudD8udHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVlZGF0ZSA9IGR1ZURhdGVUZXh0ICE9PSAnTm9uZScgPyBkdWVEYXRlVGV4dCB8fCAnJyA6ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IGtleUVsZW1lbnQgPyBrZXlFbGVtZW50LnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHN1bW1hcnlFbGVtZW50ID8gc3VtbWFyeUVsZW1lbnQudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyA6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiBzdGF0dXNFbGVtZW50ID8gc3RhdHVzRWxlbWVudC50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnIDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJycgLy8gQ2xvdWTop4blm77kuK3pgJrluLjkuI3mmL7npLrmj4/ov7BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWOn+acieeahCBKaXJhIE9uLVByZW1pc2Ug54mI5pys55qE6YCJ5oup5ZmoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyLmlzc3Vlcm93Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dzLmZvckVhY2gocm93ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGlja2V0OiBhbnkgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2VsbHMgPSByb3cucXVlcnlTZWxlY3RvckFsbCgndGQnKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjZWxscy5mb3JFYWNoKGNlbGwgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNlbGwuY2xhc3NMaXN0ICYmIGNlbGwuY2xhc3NMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgcHJvcGVydHlOYW1lID0gY2VsbC5jbGFzc0xpc3RbMF07IC8vIEdldCB0aGUgZmlyc3QgY2xhc3MgbmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gY2VsbC50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlIGNsYXNzIG5hbWUgaXMgJ2lzc3Vla2V5JywgdGhlIHByb3BlcnR5IGluIG91ciBvYmplY3Qgc2hvdWxkIGJlICdrZXknXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5TmFtZSA9PT0gJ2lzc3Vla2V5JykgcHJvcGVydHlOYW1lID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5TmFtZSA9PT0gJ2lzc3VldHlwZScpIHByb3BlcnR5TmFtZSA9ICd0eXBlJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydHlOYW1lKSB7IC8vIEVuc3VyZSBwcm9wZXJ0eU5hbWUgaXMgbm90IGVtcHR5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0W3Byb3BlcnR5TmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVuc3VyZSBlc3NlbnRpYWwgbm9uLW9wdGlvbmFsIGZpZWxkcyBmcm9tIEppcmFUaWNrZXQgYXJlIHByZXNlbnQsIGV2ZW4gaWYgZW1wdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0LmtleSA9IHRpY2tldC5rZXkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldC5zdW1tYXJ5ID0gdGlja2V0LnN1bW1hcnkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldC5zdGF0dXMgPSB0aWNrZXQuc3RhdHVzIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aWNrZXRzO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0sIChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIOWkhOeQhue7k+aenFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0cyAmJiByZXN1bHRzWzBdICYmIHJlc3VsdHNbMF0ucmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8g5a+5c3VtbWFyeeWtl+autei/m+ihjOmineWkluWkhOeQhu+8jOehruS/neW5suWHgOeahOaWh+acrFxuICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbMF0ucmVzdWx0ID0gcmVzdWx0c1swXS5yZXN1bHQubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogdGlja2V0LnN1bW1hcnkuc3BsaXQoJ1xcbicpLm1hcCgoczogc3RyaW5nKSA9PiBzLnRyaW0oKSkuZmlsdGVyKEJvb2xlYW4pLnBvcCgpIHx8IHRpY2tldC5zdW1tYXJ5LFxuICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0czogcmVzdWx0c1swXS5yZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAvLyDlpoLmnpzmsqHmnInnu5PmnpxcbiAgICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0czogW11cbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8g5YWz6ZetIEppcmEg5qCH562+6aG1XG4gICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnJlbW92ZSh0YWIuaWQhKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChjaGVja1BhZ2VMb2FkLCAxMDApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICBjaGVja1BhZ2VMb2FkKCk7XG4gIH0pO1xufVxuIiwiZXhwb3J0IGNsYXNzIFNoZWV0IHtcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nO1xuICBwcml2YXRlIHNoZWV0SWQ6IHN0cmluZztcbiAgcHJpdmF0ZSBnaWQ6IHN0cmluZztcbiAgcHJpdmF0ZSBzaGVldE5hbWU6IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZywgdG9rZW46IHN0cmluZykge1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnNoZWV0SWQgPSB0aGlzLmV4dHJhY3RTaGVldElkKHVybCk7XG4gICAgdGhpcy5naWQgPSB0aGlzLmV4dHJhY3RHaWQodXJsKTtcbiAgfVxuICAgIFxuICBhc3luYyBpbml0KCkge1xuICAgIGlmICghdGhpcy50b2tlbikgdGhpcy50b2tlbiA9IGF3YWl0IHRoaXMuZ2V0VG9rZW4oKTtcbiAgICB0aGlzLnNoZWV0TmFtZSA9IGF3YWl0IHRoaXMuZ2V0U2hlZXROYW1lQnlHaWQodGhpcy50b2tlbiwgdGhpcy5zaGVldElkLCB0aGlzLmdpZCk7XG4gIH1cblxuICBhc3luYyBnZXRUb2tlbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNocm9tZS5pZGVudGl0eS5nZXRBdXRoVG9rZW4oeyBpbnRlcmFjdGl2ZTogdHJ1ZSB9LCAodG9rZW4pID0+IHtcbiAgICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICAgICAgZWxzZSByZXNvbHZlKHRva2VuKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBleHRyYWN0U2hlZXRJZCh1cmw6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IG1hdGNoID0gdXJsLm1hdGNoKC9cXC9kXFwvKFthLXpBLVowLTktX10rKS8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogbnVsbDtcbiAgfVxuXG4gIGV4dHJhY3RHaWQodXJsOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvWyMmXWdpZD0oWzAtOV0rKS8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogbnVsbDtcbiAgfVxuXG4gIGFzeW5jIGdldFNoZWV0TmFtZXModG9rZW46IHN0cmluZywgc2hlZXRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7c2hlZXRJZH1gO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gIH1cbiAgICB9KTtcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICByZXR1cm4ganNvbi5zaGVldHM7XG4gIH1cblxuICBhc3luYyBnZXRTaGVldE5hbWVCeUdpZCh0b2tlbjogc3RyaW5nLCBzaGVldElkOiBzdHJpbmcsIGdpZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBzaGVldHMgPSBhd2FpdCB0aGlzLmdldFNoZWV0TmFtZXModG9rZW4sIHNoZWV0SWQpO1xuICAgIGNvbnN0IHNoZWV0ID0gc2hlZXRzLmZpbmQoKHM6IGFueSkgPT4gcy5wcm9wZXJ0aWVzLnNoZWV0SWQudG9TdHJpbmcoKSA9PT0gZ2lkKTtcbiAgICByZXR1cm4gc2hlZXQgPyBzaGVldC5wcm9wZXJ0aWVzLnRpdGxlIDogc2hlZXRzWzBdLnByb3BlcnRpZXMudGl0bGU7IC8vIOWmguaenOaJvuS4jeWIsOWvueW6lOeahGdpZCzov5Tlm57nrKzkuIDkuKpzaGVldOeahOWQjeensFxuICB9XG5cbiAgYXN5bmMgcmVhZFNoZWV0KCk6IFByb21pc2U8c3RyaW5nW11bXT4ge1xuICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7dGhpcy5zaGVldE5hbWV9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChzaGVldFVybCwge1xuICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgIHJldHVybiBqc29uLnZhbHVlcztcbiAgfVxuXG4gIGFzeW5jIHdyaXRlU2hlZXQodmFsdWVzOiBzdHJpbmdbXVtdLCBwb3NpdGlvbiA9ICdBMScpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7dGhpcy5zaGVldE5hbWV9ISR7cG9zaXRpb259P3ZhbHVlSW5wdXRPcHRpb249VVNFUl9FTlRFUkVEYDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChzaGVldFVybCwge1xuICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyB2YWx1ZXMgfSlcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzLmpzb24oKTtcbiAgfVxuXG4gIC8vIOaPkuWFpeihjOaIluWIl1xuICBhc3luYyBpbnNlcnREaW1lbnNpb24oZGltZW5zaW9uOiAnUk9XUycgfCAnQ09MVU1OUycsIHN0YXJ0SW5kZXg6IG51bWJlciwgZW5kSW5kZXg6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9OmJhdGNoVXBkYXRlYDtcbiAgICBjb25zdCByZXF1ZXN0ID0ge1xuICAgICAgcmVxdWVzdHM6IFt7XG4gICAgICAgIGluc2VydERpbWVuc2lvbjoge1xuICAgICAgICAgIHJhbmdlOiB7XG4gICAgICAgICAgICBzaGVldElkOiBwYXJzZUludCh0aGlzLmdpZCksXG4gICAgICAgICAgICBkaW1lbnNpb24sXG4gICAgICAgICAgICBzdGFydEluZGV4LFxuICAgICAgICAgICAgZW5kSW5kZXhcbiAgICAgICAgICB9LFxuICAgICAgICAgIGluaGVyaXRGcm9tQmVmb3JlOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGFkZERpbWVuc2lvbkdyb3VwOiB7XG4gICAgICAgICAgcmFuZ2U6IHtcbiAgICAgICAgICAgIHNoZWV0SWQ6IHBhcnNlSW50KHRoaXMuZ2lkKSxcbiAgICAgICAgICAgIGRpbWVuc2lvbixcbiAgICAgICAgICAgIHN0YXJ0SW5kZXgsXG4gICAgICAgICAgICBlbmRJbmRleFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9O1xuXG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXMuanNvbigpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDmj5LlhaXnu7TluqblpLHotKU6ICR7ZXJyb3IuZXJyb3I/Lm1lc3NhZ2UgfHwgJ+acquefpemUmeivryd9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOivu+WPlumFjee9ruihqOaVsOaNrlxuICAgKiBAcGFyYW0gc2hlZXROYW1lIOmFjee9ruihqOWQjeensFxuICAgKiBAcmV0dXJucyDphY3nva7ooajmlbDmja5cbiAgICovXG4gIGFzeW5jIHJlYWRDb25maWdTaGVldChjb25maWdTaGVldE5hbWUgPSAnJyk6IFByb21pc2U8c3RyaW5nW11bXT4ge1xuICAgIGlmICghY29uZmlnU2hlZXROYW1lKSBjb25maWdTaGVldE5hbWUgPSB0aGlzLnNoZWV0TmFtZSArICdfY29uZmlnJztcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke2NvbmZpZ1NoZWV0TmFtZX1gO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChzaGVldFVybCwge1xuICAgICAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgICAgICByZXR1cm4ganNvbi52YWx1ZXM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+ivu+WPlumFjee9ruihqOWksei0pTonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W6KGo5qC855qE56ys5LiA6KGM5L2c5Li66KGo5aS0XG4gICAqIEByZXR1cm5zIOihqOWktOaVsOe7hFxuICAgKi9cbiAgYXN5bmMgZ2V0SGVhZGVycygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgdmFsdWVzID0gYXdhaXQgdGhpcy5yZWFkU2hlZXQoKTtcbiAgICBpZiAoIXZhbHVlcyB8fCB2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ihqOagvOS4uuepuicpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzWzBdO1xuICB9XG5cbiAgcHVibGljIGdldFNoZWV0TmFtZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnNoZWV0TmFtZTtcbiAgfVxufSIsImV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleGVkREJEYXRhKGRhdGFiYXNlTmFtZTogc3RyaW5nLCBzdG9yZU5hbWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKGRhdGFiYXNlTmFtZSk7XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRiID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gZGIudHJhbnNhY3Rpb24oW3N0b3JlTmFtZV0sICdyZWFkb25seScpO1xuICAgICAgICAgICAgY29uc3Qgb2JqZWN0U3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZShzdG9yZU5hbWUpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVJlcXVlc3QgPSBvYmplY3RTdG9yZS5nZXRBbGwoKTtcbiAgICBcbiAgICAgICAgICAgIGRhdGFSZXF1ZXN0Lm9uc3VjY2VzcyA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKGV2ZW50LnRhcmdldC5yZXN1bHQpO1xuICAgICAgICAgICAgfTtcbiAgICBcbiAgICAgICAgICAgIGRhdGFSZXF1ZXN0Lm9uZXJyb3IgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGV2ZW50LnRhcmdldC5lcnJvcik7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgIFxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGV2ZW50LnRhcmdldC5lcnJvcik7XG4gICAgICAgIH07XG4gICAgfSk7XG59XG5cblxuZXhwb3J0IGNvbnN0IGdldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KSB8fCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZXRMb2NhbFN0b3JhZ2VJdGVtID0gKGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IGFueSkgPT4ge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdFZhbHVlKSk7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFVzZXJJbmZvKCkge1xuICAgIGNvbnN0IHsgZXh0ZW5zaW9uOiBleHRlbnNpb25JZCB9ID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnb3duRXh0ZW5zaW9uJywge30pO1xuICAgIGNvbnN0IHVzZXJuYW1lID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZGlzcGxheU5hbWUnLCAncmFkYXItcG9jJyk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXh0ZW5zaW9uSWQsXG4gICAgICAgIHVzZXJuYW1lXG4gICAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZvbGRlcnMoKSB7XG4gICAgcmV0dXJuIGdldEluZGV4ZWREQkRhdGEoJ0dsaXAnLCAncHJvZmlsZScpLnRoZW4oKFtkYXRhXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmF2b3JpdGVfZ3JvdXBfaWRzID0gZGF0YT8uZmF2b3JpdGVfZ3JvdXBfaWRzIHx8IFtdO1xuICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9uX3NldHMgPSBkYXRhPy5jb252ZXJzYXRpb25fc2V0cyB8fCBbXTtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSBbe3RpdGxlOiAnICcsIGlkczogW119LHt0aXRsZTogJ2Zhdm9yaXRlJywgaWRzOiBmYXZvcml0ZV9ncm91cF9pZHN9LCAuLi5jb252ZXJzYXRpb25fc2V0cy5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdmb2xkZXInKV1cbiAgICAgICAgICAgIHJldHVybiBmb2xkZXJzO1xuICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEdyb3Vwc01hcCgpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdncm91cCcpLnRoZW4oKGdyb3VwcykgPT4ge1xuICAgICAgICBjb25zdCBncm91cHNNYXAgPSBncm91cHMucmVkdWNlKChhY2M6IGFueSwgZ3JvdXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgYWNjW2dyb3VwLmlkXSA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBncm91cC5zZXRfYWJicmV2aWF0aW9uLFxuICAgICAgICAgICAgICAgIGlzX3RlYW06IGdyb3VwLmlzX3RlYW1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICB9LCB7fSk7XG5cbiAgICAgICAgcmV0dXJuIGdyb3Vwc01hcDtcbiAgICB9KTtcbn0iLCJpbXBvcnQgeyBnZXRDdXJyZW50VXNlckluZm8sIGdldExvY2FsU3RvcmFnZUl0ZW0gfSBmcm9tIFwiLi9zdG9yYWdlXCI7XG5cbi8vIOeOr+Wig+mFjee9ruexu+Wei+WumuS5iVxuZXhwb3J0IGludGVyZmFjZSBFbnZDb25maWdUeXBlIHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBudW1iZXI7XG4gIEFOQUxZU0lTX1RZUEU6IHN0cmluZztcbiAgQU5BTFlaRV9CWV9HUk9VUDogYm9vbGVhbjtcbiAgTExNX1RZUEU6IHN0cmluZztcbiAgT0xMQU1BX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9MTEFNQV9NT0RFTDogc3RyaW5nO1xuICBPTExBTUFfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogc3RyaW5nO1xuICBESUZZX0FQSV9LRVk6IHN0cmluZztcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBPUEVOQUlfQVBJX0tFWTogc3RyaW5nO1xuICBPUEVOQUlfTU9ERUw6IHN0cmluZztcbiAgT1BFTkFJX1JFVklFV19NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIEdST1FfQVBJX0tFWTogc3RyaW5nO1xuICBHUk9RX01PREVMOiBzdHJpbmc7XG4gIEdST1FfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIEJPVF9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgQk9UX1RPS0VOOiBzdHJpbmc7XG4gIEJPVF9JRDogc3RyaW5nO1xuICBCT1RfVFlQRTogc3RyaW5nO1xuICBURUFNX0lEOiBzdHJpbmc7XG4gIEVOQUJMRV9CT1Q6IGJvb2xlYW47XG4gIExMTV9SRVZJRVdfQkVGT1JFX1NFTkQ6IGJvb2xlYW47XG4gIEVOQUJMRV9DSFJPTUE6IGJvb2xlYW47XG4gIENIUk9NQV9BUElfVVJMOiBzdHJpbmc7XG4gIENIUk9NQV9QT1JUOiBudW1iZXI7XG4gIENIUk9NQV9DT0xMRUNUSU9OX05BTUU6IHN0cmluZztcbiAgLy8gSklSQeebuOWFs+mFjee9rlxuICBKSVJBX0JBU0VfVVJMPzogc3RyaW5nO1xuICBKSVJBX1VTRVJOQU1FPzogc3RyaW5nO1xuICBKSVJBX0FQSV9UT0tFTj86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdERhdGUoZGF0ZVN0cmluZzogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGRhdGVTdHJpbmcpO1xuICAgIFxuICAgIGNvbnN0IHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgY29uc3QgbW9udGggPSBTdHJpbmcoZGF0ZS5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgaG91cnMgPSBTdHJpbmcoZGF0ZS5nZXRIb3VycygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IG1pbnV0ZXMgPSBTdHJpbmcoZGF0ZS5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3Qgc2Vjb25kcyA9IFN0cmluZyhkYXRlLmdldFNlY29uZHMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgXG4gICAgcmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fSAke2hvdXJzfToke21pbnV0ZXN9OiR7c2Vjb25kc31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5pcUJ5KGFycmF5OiBhbnlbXSwga2V5OiBzdHJpbmcpIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xuICAgIHJldHVybiBhcnJheS5maWx0ZXIoaXRlbSA9PiB7XG4gICAgICBjb25zdCBrZXlWYWx1ZSA9IGl0ZW1ba2V5XTtcbiAgICAgIGlmIChzZWVuLmhhcyhrZXlWYWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgc2Vlbi5hZGQoa2V5VmFsdWUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIG9uQ2xvc2U/OiAoKSA9PiB2b2lkKSB7XG4gIC8vIOiOt+WPluaIluWIm+W7uuWuueWZqOWFg+e0oFxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmFkYXItcG9jLXJlc3VsdCcpO1xuICBpZiAoIWNvbnRhaW5lcikgcmV0dXJuXG5cbiAgLy8g56e76Zmk546w5pyJ55qEIFRvYXN0IOWFg+e0oFxuICBjb25zdCBleGlzdGluZ1RvYXN0ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5yYWRhci1wb2MtdG9hc3QnKTtcbiAgaWYgKGV4aXN0aW5nVG9hc3QpIHtcbiAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQoZXhpc3RpbmdUb2FzdCk7XG4gIH1cblxuICAvLyDliJvlu7rmlrDnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9IGByYWRhci1wb2MtdG9hc3QgcmFkYXItcG9jLXRvYXN0LSR7dHlwZX1gO1xuXG4gIGNvbnN0IHRvYXN0SW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3RJbm5lci5jbGFzc05hbWUgPSAncmFkYXItcG9jLXRvYXN0LWlubmVyJztcbiAgdG9hc3RJbm5lci50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cbiAgdG9hc3QuYXBwZW5kQ2hpbGQodG9hc3RJbm5lcik7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2FzdCk7XG5cbiAgLy8g6K6+572u5a6a5pe25Zmo5ZyoIDMg56eS5ZCO5YWz6ZetIFRvYXN0XG4gIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9LCAzMDAwKTtcblxuICAvLyDov5Tlm57kuIDkuKrlh73mlbDku6Xkvr/miYvliqjlhbPpl60gVG9hc3RcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgIGlmIChjb250YWluZXIuY29udGFpbnModG9hc3QpKSB7XG4gICAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgIH1cbiAgICBpZiAob25DbG9zZSkge1xuICAgICAgb25DbG9zZSgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUdyb3VwTGlua3MoaW5wdXRTdHJpbmc6IHN0cmluZykge1xuICBjb25zdCBncm91cExpbmtQYXR0ZXJuID0gL1xcW2dyb3VwOiguKyk6KFxcZCspXFxdL2c7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShncm91cExpbmtQYXR0ZXJuLCAobWF0Y2gsIGdyb3VwTmFtZSwgZ3JvdXBJZCkgPT4ge1xuICAgIHJldHVybiBgWyR7Z3JvdXBOYW1lfV0oL21lc3NhZ2VzLyR7Z3JvdXBJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybVBvc3RMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IHBvc3RMaW5rUGF0dGVybiA9IC9cXFtwb3N0OihcXGQrKVxcXS9nO1xuICBsZXQgaW5kZXggPSAxO1xuICBjb25zdCB0cmFuc2Zvcm1lZFN0cmluZyA9IGlucHV0U3RyaW5nLnJlcGxhY2UocG9zdExpbmtQYXR0ZXJuLCAobWF0Y2gsIHBvc3RJZCkgPT4ge1xuICAgIHJldHVybiBgW1ske2luZGV4Kyt9XV0oL2wke3dpbmRvdy5sb2NhdGlvbi5wYXRobmFtZX0vJHtwb3N0SWR9KWA7XG4gIH0pO1xuICByZXR1cm4gdHJhbnNmb3JtZWRTdHJpbmc7XG59XG5cbi8vIOm7mOiupOeOr+Wig+mFjee9rlxuZXhwb3J0IGNvbnN0IGRlZmF1bHRFbnZDb25maWc6IEVudkNvbmZpZ1R5cGUgPSB7XG4gIFNDSEVEVUxFRF9JTlRFUlZBTDogTnVtYmVyKHByb2Nlc3MuZW52LlNDSEVEVUxFRF9JTlRFUlZBTCkgfHwgMTIwLFxuICBBTkFMWVNJU19UWVBFOiBwcm9jZXNzLmVudi5BTkFMWVNJU19UWVBFIHx8IFwiZmlsdGVyXCIsXG4gIExMTV9UWVBFOiBwcm9jZXNzLmVudi5MTE1fVFlQRSB8fCBcImRpZnlcIixcbiAgQU5BTFlaRV9CWV9HUk9VUDogcHJvY2Vzcy5lbnYuQU5BTFlaRV9CWV9HUk9VUCA9PT0gXCJ0cnVlXCIsXG4gIE9MTEFNQV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT0xMQU1BX0JBU0VfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDoxMTQzNFwiLFxuICBPTExBTUFfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9NT0RFTCB8fCBcImRlZXBzZWVrLXIxXCIsXG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9SRVZJRVdfTU9ERUwgfHwgXCJsbGFtYTMuMVwiLFxuICBPTExBTUFfUVVFUllfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9RVUVSWV9NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIERJRllfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9BUElfS0VZIHx8IFwiXCIsXG4gIERJRllfUkVWSUVXX0FQSV9LRVk6IHByb2Nlc3MuZW52LkRJRllfUkVWSUVXX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52LkRJRllfQVBJX0JBU0VfVVJMIHx8IFwiXCIsXG4gIE9QRU5BSV9BUElfS0VZOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSB8fCBcIlwiLFxuICBPUEVOQUlfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9NT0RFTCB8fCBcIlwiLFxuICBPUEVOQUlfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5PUEVOQUlfUkVWSUVXX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgR1JPUV9BUElfS0VZOiBwcm9jZXNzLmVudi5HUk9RX0FQSV9LRVkgfHwgXCJcIixcbiAgR1JPUV9NT0RFTDogcHJvY2Vzcy5lbnYuR1JPUV9NT0RFTCB8fCBcIlwiLFxuICBHUk9RX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuR1JPUV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgQk9UX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuQk9UX0FQSV9CQVNFX1VSTCB8fCBcImh0dHBzOi8vYm90bWFuLmludC5yY2xhYmVudi5jb20vdjJcIixcbiAgQk9UX1RPS0VOOiBwcm9jZXNzLmVudi5CT1RfVE9LRU4gfHwgXCJcIixcbiAgQk9UX0lEOiBwcm9jZXNzLmVudi5CT1RfSUQgfHwgXCI0NzAwMzcyMDIwQDM3NDM5NTEwLmJvdC5nbGlwLm5ldFwiLFxuICBCT1RfVFlQRTogcHJvY2Vzcy5lbnYuQk9UX1RZUEUgfHwgXCJ1c2VyXCIsXG4gIFRFQU1fSUQ6IHByb2Nlc3MuZW52LlRFQU1fSUQgfHwgXCJcIixcbiAgRU5BQkxFX0JPVDogcHJvY2Vzcy5lbnYuRU5BQkxFX0JPVCA9PT0gXCJ0cnVlXCIsXG4gIExMTV9SRVZJRVdfQkVGT1JFX1NFTkQ6IHByb2Nlc3MuZW52LkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQgPT09IFwidHJ1ZVwiLFxuICBFTkFCTEVfQ0hST01BOiBwcm9jZXNzLmVudi5FTkFCTEVfQ0hST01BID09PSBcInRydWVcIixcbiAgQ0hST01BX0FQSV9VUkw6IHByb2Nlc3MuZW52LkNIUk9NQV9BUElfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDo4MDAwXCIsXG4gIENIUk9NQV9QT1JUOiBOdW1iZXIocHJvY2Vzcy5lbnYuQ0hST01BX1BPUlQpIHx8IDgwMDAsXG4gIENIUk9NQV9DT0xMRUNUSU9OX05BTUU6IHByb2Nlc3MuZW52LkNIUk9NQV9DT0xMRUNUSU9OX05BTUUgfHwgXCJcIixcbiAgSklSQV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuSklSQV9CQVNFX1VSTCB8fCBcImh0dHBzOi8vamlyYS5yaW5nY2VudHJhbC5jb21cIixcbiAgSklSQV9VU0VSTkFNRTogcHJvY2Vzcy5lbnYuSklSQV9VU0VSTkFNRSB8fCBcIlwiLFxuICBKSVJBX0FQSV9UT0tFTjogcHJvY2Vzcy5lbnYuSklSQV9BUElfVE9LRU4gfHwgXCJcIixcbn07XG5cbi8vIOiOt+WPlueOr+Wig+mFjee9ru+8jOWmguaenOWPr+iDveeahOivneS7jiBzdG9yYWdlIOiOt+WPlu+8jOWQpuWImeS7jiBwcm9jZXNzLmVudiDojrflj5ZcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRFbnZDb25maWcoKTogUHJvbWlzZTxFbnZDb25maWdUeXBlPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBlbnZDb25maWcgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2VudkNvbmZpZyddKTtcbiAgICBpZiAoZW52Q29uZmlnKSB7XG4gICAgICAvLyDlsIblrZjlgqjnmoTphY3nva7kuI7pu5jorqTphY3nva7lkIjlubbvvIznoa7kv53mlrDlop7nmoTphY3nva7pobnkuZ/kvJrooqvljIXlkKtcbiAgICAgIHJldHVybiB7IC4uLmRlZmF1bHRFbnZDb25maWcsIC4uLmVudkNvbmZpZyB9O1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfojrflj5bphY3nva7lpLHotKU6JywgZXJyb3IpO1xuICB9XG4gIFxuICAvLyDlpoLmnpzojrflj5blpLHotKXmiJbmsqHmnInkv53lrZjnmoTphY3nva7vvIzov5Tlm57pu5jorqTlgLxcbiAgcmV0dXJuIGRlZmF1bHRFbnZDb25maWc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VySW5mbygpIHtcbiAgY29uc3QgYWNjb3VudFVEID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuVUQnLCAnJyk7XG4gIGNvbnN0IGFjY291bnRJbmZvTGlzdCA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2dsb2JhbC5hY2NvdW50LkFDQ09VTlRfU0VTU0lPTl9EQVRBX0xJU1QnLCB7fSk7XG5cbiAgY29uc3QgYWNjb3VudEluZm8gPSBhY2NvdW50VUQgPyBhY2NvdW50SW5mb0xpc3RbYWNjb3VudFVEXSA6IGFjY291bnRJbmZvTGlzdC5maW5kKChpdGVtOmFueSkgPT4gaXRlbS5kaXNwbGF5TmFtZSAhPSAnJyk7XG4gIGNvbnNvbGUubG9nKCdhY2NvdW50SW5mb0xpc3QnLCBhY2NvdW50SW5mb0xpc3QsIGFjY291bnRJbmZvKTtcbiAgaWYgKGFjY291bnRJbmZvKSByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiBhY2NvdW50SW5mby5leHRlbnNpb25JZCxcbiAgICBlbWFpbDogYWNjb3VudEluZm8uZW1haWwsXG4gICAgZnVsbE5hbWU6IGFjY291bnRJbmZvLmRpc3BsYXlOYW1lLFxuICAgIHVzZXJuYW1lOiBhY2NvdW50SW5mby5lbWFpbCA/IGFjY291bnRJbmZvLmVtYWlsLnRyaW0oKS5zcGxpdCgnQCcpWzBdIDogYWNjb3VudEluZm8uZGlzcGxheU5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpLFxuICB9XG5cbiAgY29uc3QgdXNlckluZm8gPSBnZXRDdXJyZW50VXNlckluZm8oKTtcbiAgcmV0dXJuIHtcbiAgICBleHRlbnNpb25JZDogdXNlckluZm8uZXh0ZW5zaW9uSWQsXG4gICAgZnVsbE5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLFxuICAgIHVzZXJuYW1lOiB1c2VySW5mby51c2VybmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gICAgZW1haWw6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSArICdAcmluZ2NlbnRyYWwuY29tJ1xuICB9O1xufVxuXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCB7IGZldGNoSmlyYVRpY2tldHMgfSBmcm9tICcuL2ppcmEnO1xuaW1wb3J0IHsgU2hlZXQgfSBmcm9tICcuL3NoZWV0JztcbmltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyBNYWluIGxpc3RlbmVyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ+aUtuWIsOa2iOaBrzonLCBtZXNzYWdlLCAn5Y+R6YCB6ICFOicsIHNlbmRlcik7XG5cbiAgICBpZiAoIW1lc3NhZ2UgfHwgIW1lc3NhZ2UudHlwZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+aUtuWIsOaXoOaViOa2iOaBr+agvOW8jycpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICfml6DmlYjmtojmga/moLzlvI8nIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHR5cGUgfSA9IG1lc3NhZ2U7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09QRU5fSklSQV9RVUVSWV9ESUFMT0cnKSB7XG4gICAgICAgIG9wZW5KcWxEaWFsb2cobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbik7XG4gICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnRVhQQU5EX0VQSUNfVElDS0VUUycpIHtcbiAgICAgICAgaWYgKCFtZXNzYWdlLnVybCB8fCAhbWVzc2FnZS5zaGVldFRva2VuKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFWFBBTkRfRVBJQ19USUNLRVRTIOe8uuWwkSB1cmwg5oiWIHNoZWV0VG9rZW4nKTtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn57y65bCR5b+F6KaB5Y+C5pWwJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICfnvLrlsJHlv4XopoHlj4LmlbAnIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFuZGxlRXhwYW5kRXBpY1RpY2tldHMobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbilcbiAgICAgICAgICAgICAgICAudGhlbigoKSA9PiBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pKVxuICAgICAgICAgICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+WkhOeQhiBFWFBBTkRfRVBJQ19USUNLRVRTIOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg5bGV5byAIEVwaWMg5aSx6LSlOiAke2Vycm9yLm1lc3NhZ2UgfHwgZXJyb3J9YCwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCBTdHJpbmcoZXJyb3IpIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+acquWkhOeQhueahOa2iOaBr+exu+WeizonLCB0eXBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG4vLyDliJvlu7ogSlFMIOafpeivouWvueivneahhlxuYXN5bmMgZnVuY3Rpb24gb3BlbkpxbERpYWxvZyh1cmw6IHN0cmluZywgc2hlZXRUb2tlbjogc3RyaW5nKSB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgIGA7XG5cbiAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwO1wiPui+k+WFpSBKUUwg5p+l6K+iPC9oMz5cbiAgICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj48L3RleHRhcmVhPlxuICAgICAgICA8cCBzdHlsZT1cImZvbnQtc2l6ZTogMTJweDsgY29sb3I6ICM2NjY7IG1hcmdpbi10b3A6IC01cHg7IG1hcmdpbi1ib3R0b206IDEwcHg7XCI+6K+35ZyoIDxhIGhyZWY9XCJodHRwczovL2ppcmEucmluZ2NlbnRyYWwuY29tL2lzc3Vlcy8/anFsPVwiIHRhcmdldD1cIl9ibGFua1wiPmZpbHRlciDmn6Xor6LpobXpnaI8L2E+IOmFjee9rumcgOimgeWxleekuueahCBjb2x1bW5zIOS4lOiuvuS4uuWIl+ihqOaooeW8j+OAgjwvcD5cbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XCI+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsXCIgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDEwcHg7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwic3VibWl0XCI+5p+l6K+iPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAvLyDmt7vliqDkuovku7bnm5HlkKzlmahcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1Ym1pdCcpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QganFsID0gKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqcWwnKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50KS52YWx1ZTtcbiAgICAgICAgaWYgKGpxbCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+ato+WcqOafpeivoiBKaXJhLi4uJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGlja2V0cycsIHRpY2tldHMpO1xuICAgICAgICAgICAgICAgIGlmICghdGlja2V0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmsqHmnInmib7liLDmlbDmja4nLCAnd2FybmluZycpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFzaGVldFRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIOWJquWIh+adv+aooeW8j1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkRGF0YSA9IFtoZWFkZXJzLmpvaW4oJ1xcdCcpLCAuLi50aWNrZXRzLm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgXG4gICAgICAgICAgICAgICAgICAgICAgfSkpLm1hcCh0aWNrZXQgPT4gaGVhZGVycy5tYXAoZmllbGQgPT4gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnKS5qb2luKCdcXHQnKSldLmpvaW4oJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2Zvcm1hdHRlZERhdGEnLCBmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCdKaXJhIOaVsOaNruW3suWkjeWItuWIsOWJqui0tOadvycsICdzdWNjZXNzJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5o6l5Y+j5qih5byPXG4gICAgICAgICAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeihqOagvCBVUkwnLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0ID0gbmV3IFNoZWV0KHVybCwgc2hlZXRUb2tlbik7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC5pbml0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCBzaGVldC5yZWFkU2hlZXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd2YWx1ZXMnLCB2YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXJzID0gYXdhaXQgZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheUhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddOyBcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZlcnJlZEtleUluZGV4ID0gdmFsdWVzWzBdPy5maW5kSW5kZXgoKGhlYWRlcjogc3RyaW5nKSA9PiBoZWFkZXIudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygna2V5JykgfHwgaGVhZGVyLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2ppcmEnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluZmVycmVkS2V5SW5kZXggIT09IC0xICYmIGluZmVycmVkS2V5SW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGVldEhlYWRlcnMua2V5ID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZmVycmVkS2V5SW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYOacquWcqOmFjee9ruS4reaJvuWIsCBLZXkg5YiX77yM5bey5o6o5pat5Li65YiXICR7c2hlZXRIZWFkZXJzLmtleX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+acquaJvuWIsOaIluaXoOazleaOqOaWrSBKaXJhIEtleSDliJfvvIzor7fmo4Dmn6XooajlpLTmiJbphY3nva4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleVRvUm93TWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5zbGljZSgxKS5mb3JFYWNoKChyb3c6IHN0cmluZ1tdLCBpbmRleDogbnVtYmVyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleUNlbGwgPSByb3dbZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSEpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGtleSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2V5Q2VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBrZXlDZWxsLm1hdGNoKC9icm93c2VcXC8oW0EtWjAtOV0rLVswLTldKykvaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL15bQS1aMC05XSstWzAtOV0rJC9pLnRlc3Qoa2V5Q2VsbC50cmltKCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5Q2VsbC50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleVRvUm93TWFwLnNldChrZXksIGluZGV4ICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wZXJhdGlvbnM6IFRpY2tldE9wZXJhdGlvbltdID0gdGlja2V0cy5tYXAodGlja2V0ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1Jvd0luZGV4ID0ga2V5VG9Sb3dNYXAuZ2V0KHRpY2tldC5rZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogZXhpc3RpbmdSb3dJbmRleCAhPT0gdW5kZWZpbmVkID8gJ3VwZGF0ZScgOiAnYXBwZW5kJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SW5kZXg6IGV4aXN0aW5nUm93SW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpcm1lZE9wZXJhdGlvbnMgPSBhd2FpdCBzaG93Q29uZmlybWF0aW9uRGlhbG9nKG9wZXJhdGlvbnMsIGRpc3BsYXlIZWFkZXJzLCBzaGVldEhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlybWVkT3BlcmF0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+aTjeS9nOW3suWPlua2iCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZXNEYXRhOiBVcGRhdGVEYXRhW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFwcGVuZERhdGE6IHN0cmluZ1tdW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJWYWx1ZXMgPSBPYmplY3QudmFsdWVzKHNoZWV0SGVhZGVycykuZmlsdGVyKCh2YWx1ZSk6IHZhbHVlIGlzIHN0cmluZyA9PiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXhDb2xJbmRleCA9IGdldE1heENvbHVtbkluZGV4KGhlYWRlclZhbHVlcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpcm1lZE9wZXJhdGlvbnMuZm9yRWFjaChvcGVyYXRpb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IG5ldyBBcnJheShtYXhDb2xJbmRleCkuZmlsbCgnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMob3BlcmF0aW9uLnRpY2tldCkuZm9yRWFjaCh0aWNrZXRLZXkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2x1bW5MZXR0ZXIgPSAoc2hlZXRIZWFkZXJzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pW3RpY2tldEtleV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2x1bW5MZXR0ZXIgJiYgdHlwZW9mIGNvbHVtbkxldHRlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sSW5kZXggPSBnZXRDb2x1bW5JbmRleChjb2x1bW5MZXR0ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aWNrZXRLZXkgPT09ICdrZXknKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke29wZXJhdGlvbi50aWNrZXQua2V5fVwiLCBcIiR7b3BlcmF0aW9uLnRpY2tldC5rZXl9XCIpYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gKG9wZXJhdGlvbi50aWNrZXQgYXMgUmVjb3JkPHN0cmluZywgYW55PilbdGlja2V0S2V5XSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYOWkhOeQhuWIlyAke2NvbHVtbkxldHRlcn0gKOWtl+autSAke3RpY2tldEtleX0pIOaXtuWHuumUmTpgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcGVyYXRpb24udHlwZSA9PT0gJ3VwZGF0ZScgJiYgb3BlcmF0aW9uLnJvd0luZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlc0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dJbmRleDogb3BlcmF0aW9uLnJvd0luZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogcm93XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcGVuZERhdGEucHVzaChyb3cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn5pu05paw5pWw5o2uOicsIHVwZGF0ZXNEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfov73liqDmlbDmja46JywgYXBwZW5kRGF0YSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB1cGRhdGVkQ291bnQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFwcGVuZGVkQ291bnQgPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlc0RhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdXBkYXRlIG9mIHVwZGF0ZXNEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0Q29sdW1uID0gJ0EnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByYW5nZSA9IGAke3N0YXJ0Q29sdW1ufSR7dXBkYXRlLnJvd0luZGV4KzF9YDsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGluZyByYW5nZTogJHtyYW5nZX1gLCB1cGRhdGUuZGF0YSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChbdXBkYXRlLmRhdGFdLCByYW5nZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWRDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFwcGVuZERhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0UG9zaXRpb24gPSBgQSR7dmFsdWVzLmxlbmd0aCArIDF9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQXBwZW5kaW5nIGRhdGEgc3RhcnRpbmcgZnJvbTogJHtzdGFydFBvc2l0aW9ufWAsIGFwcGVuZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0LndyaXRlU2hlZXQoYXBwZW5kRGF0YSwgc3RhcnRQb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwZW5kZWRDb3VudCA9IGFwcGVuZERhdGEubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgdG9hc3RNZXNzYWdlID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlZENvdW50ID4gMCkgdG9hc3RNZXNzYWdlICs9IGDlt7Lmm7TmlrAgJHt1cGRhdGVkQ291bnR9IOadoeaVsOaNruOAgmA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXBwZW5kZWRDb3VudCA+IDApIHRvYXN0TWVzc2FnZSArPSBg5bey6L+95YqgICR7YXBwZW5kZWRDb3VudH0g5p2h5paw5pWw5o2u44CCYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0b2FzdE1lc3NhZ2UgPT09ICcnKSB0b2FzdE1lc3NhZ2UgPSAn5rKh5pyJ6ZyA6KaB5pu05paw5oiW6L+95Yqg55qE5pWw5o2u44CCJztcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KHRvYXN0TWVzc2FnZS50cmltKCksICdzdWNjZXNzJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0dvb2dsZSBTaGVldHMg5pON5L2c5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgnR29vZ2xlIFNoZWV0cyDmk43kvZzlpLHotKU6ICcgKyAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvciksICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xor6LmiJblpITnkIblpLHotKU6ICcsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmn6Xor6LmiJblpITnkIblpLHotKU6ICcgKyAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvciksICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+ivt+i+k+WFpSBKUUwg5p+l6K+i6K+t5Y+lJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5pbnRlcmZhY2UgSmlyYUhlYWRlcnMge1xuICAgIGtleT86IHN0cmluZztcbiAgICBzdW1tYXJ5Pzogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIGlzc3VldHlwZT86IHN0cmluZztcbiAgICBwcmlvcml0eT86IHN0cmluZztcbiAgICBhc3NpZ25lZT86IHN0cmluZztcbiAgICByZXBvcnRlcj86IHN0cmluZztcbiAgICBsYWJlbHM/OiBzdHJpbmc7XG4gICAgY29tcG9uZW50cz86IHN0cmluZztcbiAgICBmaXhWZXJzaW9ucz86IHN0cmluZztcbiAgICBhZmZlY3RzVmVyc2lvbnM/OiBzdHJpbmc7XG4gICAgbGlua2VkSXNzdWVzPzogc3RyaW5nO1xuICAgIGVwaWNMaW5rPzogc3RyaW5nO1xuICAgIHNwcmludD86IHN0cmluZztcbiAgICBzdG9yeVBvaW50cz86IHN0cmluZztcbiAgICBzdGF0dXM/OiBzdHJpbmc7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgVXBkYXRlRGF0YSB7XG4gICAgcm93SW5kZXg6IG51bWJlcjtcbiAgICBkYXRhOiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIFRpY2tldE9wZXJhdGlvbiB7XG4gICAgdGlja2V0OiBKaXJhVGlja2V0O1xuICAgIHR5cGU6ICd1cGRhdGUnIHwgJ2FwcGVuZCc7XG4gICAgcm93SW5kZXg/OiBudW1iZXI7XG59XG5cbi8vIOafpeaJvuacieaViOeahEppcmHlrZfmrrXooajlpLRcbmFzeW5jIGZ1bmN0aW9uIGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0OiBTaGVldCk6IFByb21pc2U8SmlyYUhlYWRlcnM+IHtcbiAgICB0cnkge1xuICAgICAgICBsZXQgaGVhZGVyTWFwcGluZzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgICAgICBjb25zdCBjdXN0b21GaWVsZE1hcHBpbmc6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWdEYXRhID0gYXdhaXQgc2hlZXQucmVhZENvbmZpZ1NoZWV0KCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29uZmlnRGF0YScsIGNvbmZpZ0RhdGEpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZ0RhdGEgJiYgY29uZmlnRGF0YS5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVySW5kZXggPSBjb25maWdEYXRhWzBdLmZpbmRJbmRleCgoaDogc3RyaW5nKSA9PiBoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3NoZWV0IGNvbHVtbicpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBqaXJhRmllbGRJbmRleCA9IGNvbmZpZ0RhdGFbMF0uZmluZEluZGV4KChoOiBzdHJpbmcpID0+IGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnamlyYSBmaWVsZCcpKTtcblxuICAgICAgICAgICAgICAgIGlmIChzaGVldEhlYWRlckluZGV4ID09PSAtMSB8fCBqaXJhRmllbGRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfphY3nva7ooajkuK3mnKrmib7liLAgXCJTaGVldCBIZWFkZXJcIiDmiJYgXCJKaXJhIEZpZWxkXCIg5YiX77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb25maWcgc2hlZXQgaGVhZGVycycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgY29uZmlnRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBjb25maWdEYXRhW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAocm93Lmxlbmd0aCA+IE1hdGgubWF4KHNoZWV0SGVhZGVySW5kZXgsIGppcmFGaWVsZEluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXIgPSByb3dbc2hlZXRIZWFkZXJJbmRleF0/LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGppcmFGaWVsZCA9IHJvd1tqaXJhRmllbGRJbmRleF0/LnRyaW0oKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNoZWV0SGVhZGVyICYmIGppcmFGaWVsZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2ppcmEga2V5JyB8fCBqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgamlyYUZpZWxkID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlck1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdjdXN0b21maWVsZF8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21GaWVsZE1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+S7jumFjee9ruihqOWKoOi9veeahOaYoOWwhDonLCBoZWFkZXJNYXBwaW5nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56Gu77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56GuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+ivu+WPlumFjee9ruihqOWksei0pe+8jOWwhuS9v+eUqOm7mOiupOWtl+auteWIq+WQjTonLCBlcnJvcik7XG4gICAgICAgICAgICBoZWFkZXJNYXBwaW5nID0ge1xuICAgICAgICAgICAgICAgICdrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGtleSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGxpbmsnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpc3N1ZSBrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnc3VtbWFyeSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAndGl0bGUnOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ+amguimgSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAnZGVzY3JpcHRpb24nOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICfmj4/ov7AnOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICd0eXBlJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ2lzc3VlIHR5cGUnOiAnaXNzdWV0eXBlJyxcbiAgICAgICAgICAgICAgICAn57G75Z6LJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ3ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAn5LyY5YWI57qnJzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAnYXNzaWduZWUnOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICfnu4/lip7kuronOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICdyZXBvcnRlcic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ+aKpeWRiuS6uic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICAgICfnirbmgIEnOiAnc3RhdHVzJyxcbiAgICAgICAgICAgICAgICAnbGFiZWxzJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ2xhYmVsJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ+agh+etvic6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnRzJzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnQnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ+aooeWdlyc6ICdjb21wb25lbnRzJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb25zJzogJ2ZpeFZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb24nOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICfkv67lpI3niYjmnKwnOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdhZmZlY3RzIHZlcnNpb25zJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2FmZmVjdCB2ZXJzaW9uJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+W9seWTjeeJiOacrCc6ICdhZmZlY3RzVmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdsaW5rZWQgaXNzdWVzJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ+WFs+iBlOmXrumimCc6ICdsaW5rZWRJc3N1ZXMnLFxuICAgICAgICAgICAgICAgICdlcGljIGxpbmsnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICdlcGljJzogJ2VwaWNMaW5rJyxcbiAgICAgICAgICAgICAgICAnc3ByaW50JzogJ3NwcmludCcsXG4gICAgICAgICAgICAgICAgJ+WGsuWIuic6ICdzcHJpbnQnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludHMnOiAnc3RvcnlQb2ludHMnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludCc6ICdzdG9yeVBvaW50cycsXG4gICAgICAgICAgICAgICAgJ+aVheS6i+eCuSc6ICdzdG9yeVBvaW50cydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoZWFkZXJzID0gYXdhaXQgc2hlZXQuZ2V0SGVhZGVycygpO1xuICAgICAgICBjb25zb2xlLmxvZygnU2hlZXQgSGVhZGVyczonLCBoZWFkZXJzKTtcbiAgICAgICAgY29uc3QgdmFsaWRIZWFkZXJzOiBKaXJhSGVhZGVycyA9IHt9O1xuXG4gICAgICAgIGNvbnN0IGtub3duRmllbGRzID0gW1xuICAgICAgICAgICAgJ2tleScsICdzdW1tYXJ5JywgJ2Rlc2NyaXB0aW9uJywgJ2lzc3VldHlwZScsICdwcmlvcml0eScsIFxuICAgICAgICAgICAgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJywgJ3N0YXR1cycsICdsYWJlbHMnLCAnY29tcG9uZW50cycsIFxuICAgICAgICAgICAgJ2ZpeFZlcnNpb25zJywgJ2FmZmVjdHNWZXJzaW9ucycsICdsaW5rZWRJc3N1ZXMnLCAnZXBpY0xpbmsnLCBcbiAgICAgICAgICAgICdzcHJpbnQnLCAnc3RvcnlQb2ludHMnXG4gICAgICAgIF07XG5cbiAgICAgICAgaGVhZGVycy5mb3JFYWNoKChoZWFkZXI6IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKCFoZWFkZXIpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckxvd2VyID0gaGVhZGVyLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZGV4KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdKSB7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGppcmFGaWVsZCA9IGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdO1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tqaXJhRmllbGRdKSB7XG4gICAgICAgICAgICAgICAgICAgICB2YWxpZEhlYWRlcnNbamlyYUZpZWxkXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDphY3nva4v5Yir5ZCN5Yy56YWNOiBcIiR7aGVhZGVyfVwiIC0+IFwiJHtqaXJhRmllbGR9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDliJcgJHtjb2x1bW5MZXR0ZXJ9IChcIiR7aGVhZGVyfVwiKSDnmoTliKvlkI0gXCIke2hlYWRlckxvd2VyfVwiIOS4juWIlyAke3ZhbGlkSGVhZGVyc1tqaXJhRmllbGRdfSDlhrLnqoHvvIzpg73mjIflkJEgXCIke2ppcmFGaWVsZH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGlyZWN0TWF0Y2ggPSBrbm93bkZpZWxkcy5maW5kKGZpZWxkID0+IGZpZWxkLnRvTG93ZXJDYXNlKCkgPT09IGhlYWRlckxvd2VyKTtcbiAgICAgICAgICAgIGlmIChkaXJlY3RNYXRjaCkge1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tkaXJlY3RNYXRjaF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOebtOaOpeWtl+auteWQjeWMuemFjTogXCIke2hlYWRlcn1cIiAtPiBcIiR7ZGlyZWN0TWF0Y2h9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihg5YiXICR7Y29sdW1uTGV0dGVyfSAoXCIke2hlYWRlcn1cIikg55qE55u05o6l5Yy56YWN5LiO5YiXICR7dmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXX0g5Yay56qB77yM6YO95oyH5ZCRIFwiJHtkaXJlY3RNYXRjaH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCF2YWxpZEhlYWRlcnMua2V5KSB7XG4gICAgICAgICAgICAgY29uc29sZS53YXJuKFwi5pyq6IO96Ieq5Yqo5pig5bCEICdrZXknIOWIl+OAguivt+ajgOafpeihqOWktOaIluWcqOmFjee9ruihqOS4reaYjuehruaMh+WumiAna2V5JyDmiJYgJ0ppcmEgS2V5J+OAglwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCfmnIDnu4jmnInmlYjooajlpLTmmKDlsIQ6JywgdmFsaWRIZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIHZhbGlkSGVhZGVycztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xmib7mnInmlYggSmlyYSDmoIfpopjml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICBzaG93VG9hc3QoJ+afpeaJvuihqOWktOaYoOWwhOaXtuWHuumUmTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJylcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb2x1bW5JbmRleChjb2x1bW46IHN0cmluZyk6IG51bWJlciB7XG4gICAgaWYgKCFjb2x1bW4gfHwgdHlwZW9mIGNvbHVtbiAhPT0gJ3N0cmluZycgfHwgIS9eW0EtWl0rJC8udGVzdChjb2x1bW4udG9VcHBlckNhc2UoKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDml6DmlYjnmoTliJfmoIfor4bnrKY6IFwiJHtjb2x1bW59XCJgKTtcbiAgICB9XG4gICAgY29uc3QgdXBwZXJDb2x1bW4gPSBjb2x1bW4udG9VcHBlckNhc2UoKTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXBwZXJDb2x1bW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaW5kZXggPSBpbmRleCAqIDI2ICsgKHVwcGVyQ29sdW1uLmNoYXJDb2RlQXQoaSkgLSA2NCk7XG4gICAgfVxuICAgIHJldHVybiBpbmRleCAtIDE7XG59XG5cbmZ1bmN0aW9uIGdldE1heENvbHVtbkluZGV4KGNvbHVtbkxldHRlcnM6IHN0cmluZ1tdKTogbnVtYmVyIHtcbiAgICAgaWYgKCFjb2x1bW5MZXR0ZXJzIHx8ICFBcnJheS5pc0FycmF5KGNvbHVtbkxldHRlcnMpIHx8IGNvbHVtbkxldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICByZXR1cm4gMDtcbiAgICAgfVxuICAgICBjb25zdCB2YWxpZExldHRlcnMgPSBjb2x1bW5MZXR0ZXJzLmZpbHRlcihoID0+IHR5cGVvZiBoID09PSAnc3RyaW5nJyAmJiAvXltBLVpdKyQvLnRlc3QoaC50b1VwcGVyQ2FzZSgpKSk7XG4gICAgIGlmICh2YWxpZExldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICAgY29uc3QgaW5kaWNlcyA9IHZhbGlkTGV0dGVycy5tYXAoY29sID0+IGdldENvbHVtbkluZGV4KGNvbCkpO1xuICAgICByZXR1cm4gTWF0aC5tYXgoLi4uaW5kaWNlcykgKyAxO1xufVxuXG4vLyDmmL7npLrnoa7orqTlvLnnqpdcbmFzeW5jIGZ1bmN0aW9uIHNob3dDb25maXJtYXRpb25EaWFsb2coXG4gICAgb3BlcmF0aW9uczogVGlja2V0T3BlcmF0aW9uW10sXG4gICAgZGlzcGxheUhlYWRlcnM6IHN0cmluZ1tdLFxuICAgIHNoZWV0SGVhZGVyczogSmlyYUhlYWRlcnNcbik6IFByb21pc2U8VGlja2V0T3BlcmF0aW9uW10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRpYWxvZy5pZCA9ICdqaXJhQ29uZmlybWF0aW9uRGlhbG9nJztcbiAgICAgICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgICAgIHdpZHRoOiA4MDBweDtcbiAgICAgICAgICAgIG1heC13aWR0aDogOTB2dztcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDgwdmg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgYDtcblxuICAgICAgICBjb25zdCBjb2x1bW5zVG9VcGRhdGUgPSBkaXNwbGF5SGVhZGVyc1xuICAgICAgICAgICAgLmZpbHRlcihmaWVsZCA9PiBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYUhlYWRlcnNdKVxuICAgICAgICAgICAgLm1hcChmaWVsZCA9PiBmaWVsZCk7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ291bnQgPSBvcGVyYXRpb25zLmZpbHRlcihvcCA9PiBvcC50eXBlID09PSAndXBkYXRlJykubGVuZ3RoO1xuICAgICAgICBjb25zdCBhcHBlbmRDb3VudCA9IG9wZXJhdGlvbnMuZmlsdGVyKG9wID0+IG9wLnR5cGUgPT09ICdhcHBlbmQnKS5sZW5ndGg7XG5cbiAgICAgICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZsZXgtc2hyaW5rOiAwO1wiPuehruiupOaVsOaNruaTjeS9nDwvaDM+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTVweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+5bCG6KaB5pON5L2c55qE5YiX77yaPC9zdHJvbmc+IFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPiR7Y29sdW1uc1RvVXBkYXRlLmpvaW4oJywgJyl9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzY2NjtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mm7TmlrDnjrDmnInmlbDmja7vvJoke3VwZGF0ZUNvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mlrDlop7mlbDmja7vvJoke2FwcGVuZENvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cInNlbGVjdEFsbFRpY2tldHNcIiBjaGVja2VkIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiA1cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIOWFqOmAiS/lj5bmtojlhajpgIlcbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXgtZ3JvdzogMTsgb3ZlcmZsb3cteTogYXV0bzsgYm9yZGVyOiAxcHggc29saWQgI2VlZTsgYm9yZGVyLXJhZGl1czogNHB4OyBtYXJnaW4tYm90dG9tOiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1wiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQgc3R5bGU9XCJwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IGJhY2tncm91bmQ6ICNmNWY1ZjU7IHotaW5kZXg6IDE7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyB3aWR0aDogNTBweDtcIj7pgInmi6k8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDgwcHg7XCI+5pON5L2cPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2Rpc3BsYXlIZWFkZXJzLm1hcChoZWFkZXIgPT4gYDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj4ke2hlYWRlcn08L3RoPmApLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICAgICAgJHtvcGVyYXRpb25zLm1hcCgob3AsIGluZGV4KSA9PiBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNlZWU7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cInRpY2tldC1jaGVja2JveFwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiIGNoZWNrZWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICR7b3AudHlwZSA9PT0gJ3VwZGF0ZScgPyAnI2YwYWQ0ZScgOiAnIzVjYjg1Yyd9OyBmb250LXdlaWdodDogYm9sZDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke29wLnR5cGUgPT09ICd1cGRhdGUnID8gJ+abtOaWsCcgOiAn5paw5aKeJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtkaXNwbGF5SGVhZGVycy5tYXAoZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gb3AudGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA+IDEwMCkgdmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMCwgOTcpICsgJy4uLic7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHdoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzOyBtYXgtd2lkdGg6IDIwMHB4O1wiIHRpdGxlPVwiJHtvcC50aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyd9XCI+JHt2YWx1ZX08L3RkPmA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDsgZ2FwOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogI2VlZTsgYm9yZGVyOiAxcHggc29saWQgI2NjYzsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNvbmZpcm1PcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjMDA3YmZmOyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+56Gu6K6kICgke29wZXJhdGlvbnMubGVuZ3RofSk8L2J1dHRvbj4gXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0QWxsQ2hlY2tib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VsZWN0QWxsVGlja2V0cycpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHRpY2tldENoZWNrYm94ZXMgPSBkaWFsb2cuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgndGlja2V0LWNoZWNrYm94JykgYXMgSFRNTENvbGxlY3Rpb25PZjxIVE1MSW5wdXRFbGVtZW50PjtcbiAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtT3BlcmF0aW9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50ID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDb3VudCA9IEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZmlsdGVyKGNiID0+IGNiLmNoZWNrZWQpLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSBg56Gu6K6kICgke3NlbGVjdGVkQ291bnR9KWA7XG4gICAgICAgICAgICBjb25maXJtQnV0dG9uLmRpc2FibGVkID0gc2VsZWN0ZWRDb3VudCA9PT0gMDtcbiAgICAgICAgfTtcblxuICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNoZWNrZWQgPSBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgIGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkID0gQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5ldmVyeShjYiA9PiBjYi5jaGVja2VkKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsT3BlcmF0aW9uJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpcm1CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZE9wZXJhdGlvbnMgPSBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjaGVja2JveCA9PiBjaGVja2JveC5jaGVja2VkKVxuICAgICAgICAgICAgICAgIC5tYXAoY2hlY2tib3ggPT4gb3BlcmF0aW9uc1twYXJzZUludChjaGVja2JveC5kYXRhc2V0LmluZGV4IHx8ICcwJyldKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxlY3RlZE9wZXJhdGlvbnMpO1xuICAgICAgICB9KTtcblxuICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTsgXG4gICAgfSk7XG59XG5cbi8vIOa3u+WKoOaYvuekuiB0b2FzdCDnmoTlh73mlbBcbmZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGUgPSAnaW5mbycpIHtcbiAgICBjb25zdCBleGlzdGluZ1RvYXN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYC5qaXJhLXRvYXN0LSR7dHlwZX1gKTtcbiAgICBleGlzdGluZ1RvYXN0cy5mb3JFYWNoKHQgPT4gdC5yZW1vdmUoKSk7XG5cbiAgICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRvYXN0LmNsYXNzTmFtZSA9IGBqaXJhLXRvYXN0LSR7dHlwZX1gO1xuICAgIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICBsZXQgYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMCwgMCwgMCwgMC43KSc7XG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDIyMCwgNTMsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnc3VjY2VzcycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDQwLCAxNjcsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnd2FybmluZycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDI1NSwgMTkzLCA3LCAwLjkpJztcblxuICAgIHRvYXN0LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogJHtiYWNrZ3JvdW5kQ29sb3J9O1xuICAgICAgICBjb2xvcjogJHt0eXBlID09PSAnd2FybmluZycgPyAnYmxhY2snIDogJ3doaXRlJ307XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCA1cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gICAgYDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgIH0pO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgICAgICB9LCAzMDApO1xuICAgIH0sIDMwMDApO1xufVxuXG4vLyDmlrDlop7vvJrlpITnkIblsZXlvIAgRXBpYyBUaWNrZXRzIOeahOWHveaVsFxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlRXhwYW5kRXBpY1RpY2tldHMoc2hlZXRVcmw6IHN0cmluZywgdG9rZW46IHN0cmluZykge1xuICAgIHNob3dUb2FzdCgn5byA5aeL5p+l5om+IEVwaWMg5bm26I635Y+W5a2Q5Lu75YqhLi4uJyk7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3Qgc2hlZXQgPSBuZXcgU2hlZXQoc2hlZXRVcmwsIHRva2VuKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBzaGVldC5pbml0KCk7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IGF3YWl0IHNoZWV0LnJlYWRTaGVldCgpO1xuICAgICAgICBpZiAoIXZhbHVlcyB8fCB2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+ihqOagvOS4uuepuuaIluaXoOazleivu+WPlicsICdlcnJvcicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNoZWV0SGVhZGVycyA9IGF3YWl0IGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0KTtcblxuICAgICAgICAvLyDmib7liLAga2V5IOWIl+eahOe0ouW8lVxuICAgICAgICBjb25zdCBrZXlDb2x1bW5JbmRleCA9IHNoZWV0SGVhZGVycy5rZXkgPyBnZXRDb2x1bW5JbmRleChzaGVldEhlYWRlcnMua2V5KSA6IC0xO1xuICAgICAgICBpZiAoa2V5Q29sdW1uSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+acquaJvuWIsCBKaXJhIEtleSDliJfvvIzor7fmo4Dmn6XooajlpLTmiJbphY3nva4nKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZygnSmlyYSBLZXkg5YiX57Si5byVOicsIGtleUNvbHVtbkluZGV4KTtcblxuICAgICAgICBjb25zdCBlcGljc1RvRXhwYW5kOiB7IGVwaWNLZXk6IHN0cmluZzsgZXBpY1N1bW1hcnk6IHN0cmluZzsgcm93SW5kZXg6IG51bWJlcjsgc3ViVGlja2V0czogSmlyYVRpY2tldFtdIH1bXSA9IFtdO1xuXG4gICAgICAgIC8vIOmBjeWOhuihqOagvOafpeaJviBFcGljIEtleSDlubbmn6Xor6LlrZDku7vliqFcbiAgICAgICAgLy8g5LuO56ys5LqM6KGM5byA5aeL77yM6Lez6L+H6KGo5aS0XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByb3cgPSB2YWx1ZXNbaV07XG4gICAgICAgICAgICBjb25zdCBrZXlDZWxsQ29udGVudCA9IHJvd1trZXlDb2x1bW5JbmRleF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOWwneivleS7jiBIWVBFUkxJTksg5oiW57qv5paH5pys5Lit5o+Q5Y+WIGtleVxuICAgICAgICAgICAgbGV0IGVwaWNLZXkgPSAnJztcbiAgICAgICAgICAgIGlmIChrZXlDZWxsQ29udGVudCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0ga2V5Q2VsbENvbnRlbnQubWF0Y2goL2Jyb3dzZVxcLyhbQS1aMC05XSstWzAtOV0rKS9pKTsgLy8g5o+Q5Y+WIGJyb3dzZS8g5ZCO6Z2i55qEIEtleVxuICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgIGVwaWNLZXkgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgvXltBLVowLTldKy1bMC05XSskL2kudGVzdChrZXlDZWxsQ29udGVudC50cmltKCkpKSB7IC8vIOWmguaenOaYr+e6ryBLZXlcbiAgICAgICAgICAgICAgICAgICAgZXBpY0tleSA9IGtleUNlbGxDb250ZW50LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIGlmIChlcGljS2V5KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOaJvuWIsCBLZXk6ICR7ZXBpY0tleX0g5Zyo6KGMICR7aSArIDF9YCk7XG4gICAgICAgICAgICAgICAgY29uc3QganFsID0gYGlzc3VlRnVuY3Rpb24gaW4gaXNzdWVzSW5FcGljcyhcImtleSA9ICR7ZXBpY0tleX1cIilgO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YlRpY2tldHMgPSBhd2FpdCBmZXRjaEppcmFUaWNrZXRzKGpxbCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWJUaWNrZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBFcGljICR7ZXBpY0tleX0g5pyJICR7c3ViVGlja2V0cy5sZW5ndGh9IOS4quWtkOS7u+WKoWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5bCd6K+V6I635Y+WIEVwaWMg55qE5qaC6KaB5L+h5oGv77yI5aaC5p6c5YW25LuW5YiX5a2Y5Zyo77yJXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdW1tYXJ5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMuc3VtbWFyeSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5zdW1tYXJ5KSA6IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXBpY1N1bW1hcnkgPSBzdW1tYXJ5Q29sdW1uSW5kZXggIT09IC0xICYmIHJvd1tzdW1tYXJ5Q29sdW1uSW5kZXhdID8gcm93W3N1bW1hcnlDb2x1bW5JbmRleF0gOiBlcGljS2V5OyAvLyBEZWZhdWx0IHRvIGtleSBpZiBzdW1tYXJ5IG1pc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgZXBpY3NUb0V4cGFuZC5wdXNoKHsgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXBpY0tleSwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXBpY1N1bW1hcnk6IGVwaWNTdW1tYXJ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBpLCAvLyAwLWJhc2VkIGluZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViVGlja2V0cyBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBFcGljICR7ZXBpY0tleX0g5rKh5pyJ5a2Q5Lu75Yqh5oiW5LiN5pivIEVwaWNgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGZldGNoRXJyb3I6IEVycm9yIHwgYW55KSB7IC8vIFNwZWNpZnkgdHlwZSBmb3IgZmV0Y2hFcnJvclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGDmn6Xor6IgRXBpYyAke2VwaWNLZXl9IOeahOWtkOS7u+WKoeWksei0pTpgLCBmZXRjaEVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgLy8g6YCJ5oup5oCn5Zyw6YCa55+l55So5oi35oiW57un57ut5aSE55CG5LiL5LiA5LiqXG4gICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdChg5p+l6K+iICR7ZXBpY0tleX0g5a2Q5Lu75Yqh5aSx6LSlOiAke2ZldGNoRXJyb3IubWVzc2FnZSB8fCBmZXRjaEVycm9yfWAsICdlcnJvcicpOyAvLyBTaG93IGVycm9yIG1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGDooYwgJHtpICsgMX0g5pyq5om+5Yiw5pyJ5pWI55qEIEtleWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVwaWNzVG9FeHBhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+acquaJvuWIsOS7u+S9leWMheWQq+WtkOS7u+WKoeeahCBFcGljJywgJ2luZm8nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNob3dUb2FzdChg5om+5YiwICR7ZXBpY3NUb0V4cGFuZC5sZW5ndGh9IOS4qiBFcGljIOWMheWQq+WtkOS7u+WKoe+8jOWHhuWkh+ehruiupOaTjeS9nC4uLmApO1xuXG4gICAgICAgIC8vIC0tLSDkuIvkuIDmraU6IOS/ruaUueehruiupOWvueivneahhuW5tuWkhOeQhuaPkuWFpS/liIbnu4QgLS0tXG4gICAgICAgIGNvbnNvbGUubG9nKCflh4blpIfnoa7orqTnmoQgRXBpY3M6JywgZXBpY3NUb0V4cGFuZCk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjb25maXJtZWRFcGljcyA9IGF3YWl0IHNob3dFcGljQ29uZmlybWF0aW9uRGlhbG9nKGVwaWNzVG9FeHBhbmQpO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNvbmZpcm1lZEVwaWNzICYmIGNvbmZpcm1lZEVwaWNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGF3YWl0IGluc2VydFN1YlRpY2tldHMoc2hlZXQsIGNvbmZpcm1lZEVwaWNzLCBzaGVldEhlYWRlcnMsIGVudkNvbmZpZy5KSVJBX0JBU0VfVVJMKTtcbiAgICAgICAgICAgIHNob3dUb2FzdChg5bey5oiQ5Yqf5bGV5byAICR7Y29uZmlybWVkRXBpY3MubGVuZ3RofSDkuKogRXBpYyDnmoTlrZDku7vliqFgLCAnc3VjY2VzcycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfmk43kvZzlt7Llj5bmtognLCAnaW5mbycpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDkuLTml7bljaDkvY3nrKbvvIzooajnpLrmtYHnqIvov5vooYzliLDov5nph4xcbiAgICAgICAgc2hvd1RvYXN0KCflrZDku7vliqHmn6Xmib7lrozmiJDvvIznoa7orqTjgIHmj5LlhaXlkozliIbnu4Tlip/og73lvoXlrp7njrAnLCAnd2FybmluZycpO1xuXG5cbiAgICB9IGNhdGNoIChlcnJvcjogRXJyb3IgfCBhbnkpIHsgLy8gU3BlY2lmeSB0eXBlIGZvciBlcnJvclxuICAgICAgICBjb25zb2xlLmVycm9yKCflpITnkIYgRXBpYyDlsZXlvIDml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICBzaG93VG9hc3QoJ+WkhOeQhiBFcGljIOWxleW8gOaXtuWHuumUmTogJyArIChlcnJvci5tZXNzYWdlIHx8IGVycm9yKSwgJ2Vycm9yJyk7IC8vIFVzZSBlcnJvci5tZXNzYWdlIGlmIGF2YWlsYWJsZVxuICAgICAgICB0aHJvdyBlcnJvcjsgLy8gUmUtdGhyb3cgZXJyb3IgdG8gYmUgY2F1Z2h0IGJ5IHRoZSBjYWxsZXJcbiAgICB9XG59XG5cbi8vIEVwaWMg56Gu6K6k5a+56K+d5qGGXG5hc3luYyBmdW5jdGlvbiBzaG93RXBpY0NvbmZpcm1hdGlvbkRpYWxvZyhcbiAgICBlcGljczogeyBlcGljS2V5OiBzdHJpbmc7IGVwaWNTdW1tYXJ5OiBzdHJpbmc7IHJvd0luZGV4OiBudW1iZXI7IHN1YlRpY2tldHM6IEppcmFUaWNrZXRbXSB9W11cbik6IFByb21pc2U8dHlwZW9mIGVwaWNzPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBkaWFsb2cuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICAgIHRvcDogNTAlO1xuICAgICAgICAgICAgbGVmdDogNTAlO1xuICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwMDAxO1xuICAgICAgICAgICAgd2lkdGg6IDgwMHB4O1xuICAgICAgICAgICAgbWF4LXdpZHRoOiA5MHZ3O1xuICAgICAgICAgICAgbWF4LWhlaWdodDogODB2aDtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xuICAgICAgICBgO1xuXG4gICAgICAgIGRpYWxvZy5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmbGV4LXNocmluazogMDtcIj7noa7orqTlsZXlvIAgRXBpYzwvaDM+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTVweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPlxuICAgICAgICAgICAgICAgICAgICDmib7liLAgJHtlcGljcy5sZW5ndGh9IOS4quWMheWQq+WtkOS7u+WKoeeahCBFcGljXG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyO1wiPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJzZWxlY3RBbGxFcGljc1wiIGNoZWNrZWQgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDVweDtcIj5cbiAgICAgICAgICAgICAgICAgICAg5YWo6YCJL+WPlua2iOWFqOmAiVxuICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJmbGV4LWdyb3c6IDE7IG92ZXJmbG93LXk6IGF1dG87IGJvcmRlcjogMXB4IHNvbGlkICNlZWU7IGJvcmRlci1yYWRpdXM6IDRweDsgbWFyZ2luLWJvdHRvbTogMTVweDtcIj5cbiAgICAgICAgICAgICAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTtcIj5cbiAgICAgICAgICAgICAgICAgICAgPHRoZWFkIHN0eWxlPVwicG9zaXRpb246IHN0aWNreTsgdG9wOiAwOyBiYWNrZ3JvdW5kOiAjZjVmNWY1OyB6LWluZGV4OiAxO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDUwcHg7XCI+6YCJ5oupPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7XCI+RXBpYzwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0O1wiPuWtkOS7u+WKoeaVsOmHjzwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgICAgICAgICAgICAke2VwaWNzLm1hcCgoZXBpYywgaW5kZXgpID0+IGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIgc3R5bGU9XCJib3JkZXItYm90dG9tOiAxcHggc29saWQgI2VlZTtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwiZXBpYy1jaGVja2JveFwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiIGNoZWNrZWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZXBpYy5lcGljS2V5fSAtICR7ZXBpYy5lcGljU3VtbWFyeX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtlcGljLnN1YlRpY2tldHMubGVuZ3RofSDkuKrlrZDku7vliqFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgYCkuam9pbignJyl9XG4gICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7IGdhcDogMTBweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNhbmNlbE9wZXJhdGlvblwiIHN0eWxlPVwicGFkZGluZzogNnB4IDEycHg7IGJhY2tncm91bmQ6ICNlZWU7IGJvcmRlcjogMXB4IHNvbGlkICNjY2M7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuWPlua2iDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjb25maXJtT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogIzAwN2JmZjsgY29sb3I6IHdoaXRlOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuehruiupDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG5cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaWFsb2cpO1xuXG4gICAgICAgIGNvbnN0IHNlbGVjdEFsbENoZWNrYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlbGVjdEFsbEVwaWNzJykgYXMgSFRNTElucHV0RWxlbWVudDtcbiAgICAgICAgY29uc3QgZXBpY0NoZWNrYm94ZXMgPSBkaWFsb2cuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnZXBpYy1jaGVja2JveCcpIGFzIEhUTUxDb2xsZWN0aW9uT2Y8SFRNTElucHV0RWxlbWVudD47XG4gICAgICAgIGNvbnN0IGNvbmZpcm1CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybU9wZXJhdGlvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG4gICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgIEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNoZWNrZWQgPSBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQgPSBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKS5ldmVyeShjYiA9PiBjYi5jaGVja2VkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsT3BlcmF0aW9uJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpcm1CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZEVwaWNzID0gQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcylcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGNoZWNrYm94ID0+IGNoZWNrYm94LmNoZWNrZWQpXG4gICAgICAgICAgICAgICAgLm1hcChjaGVja2JveCA9PiBlcGljc1twYXJzZUludChjaGVja2JveC5kYXRhc2V0LmluZGV4IHx8ICcwJyldKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxlY3RlZEVwaWNzKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbi8vIOaPkuWFpeWtkOS7u+WKoVxuYXN5bmMgZnVuY3Rpb24gaW5zZXJ0U3ViVGlja2V0cyhcbiAgICBzaGVldDogU2hlZXQsXG4gICAgZXBpY3M6IHsgZXBpY0tleTogc3RyaW5nOyBlcGljU3VtbWFyeTogc3RyaW5nOyByb3dJbmRleDogbnVtYmVyOyBzdWJUaWNrZXRzOiBKaXJhVGlja2V0W10gfVtdLFxuICAgIHNoZWV0SGVhZGVyczogSmlyYUhlYWRlcnMsXG4gICAgamlyYUJhc2VVcmw6IHN0cmluZ1xuKSB7XG4gICAgLy8g5oyJ6KGM5Y+35LuO5aSn5Yiw5bCP5o6S5bqP77yM6L+Z5qC35o+S5YWl5pe25LiN5Lya5b2x5ZON5ZCO57ut55qE6KGM5Y+3XG4gICAgY29uc3Qgc29ydGVkRXBpY3MgPSBbLi4uZXBpY3NdLnNvcnQoKGEsIGIpID0+IGIucm93SW5kZXggLSBhLnJvd0luZGV4KTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGVwaWMgb2Ygc29ydGVkRXBpY3MpIHtcbiAgICAgICAgY29uc3QgaW5zZXJ0Um93SW5kZXggPSBlcGljLnJvd0luZGV4ICsgMjsgLy8gKzIg5Zug5Li6IHJvd0luZGV4IOaYryAwLWJhc2Vk77yM5LiU5oiR5Lus6KaB5o+S5ZyoIEVwaWMg6KGM55qE5LiL5pa5XG4gICAgICAgIGNvbnN0IGRpc3BsYXlIZWFkZXJzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTtcbiAgICAgICAgY29uc3QgbWF4Q29sSW5kZXggPSBnZXRNYXhDb2x1bW5JbmRleChPYmplY3QudmFsdWVzKHNoZWV0SGVhZGVycykuZmlsdGVyKCh2YWx1ZSk6IHZhbHVlIGlzIHN0cmluZyA9PiBcbiAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUubGVuZ3RoID4gMFxuICAgICAgICApKTtcblxuICAgICAgICAvLyDlhYjmj5LlhaXnqbrooYxcbiAgICAgICAgY29uc3Qgcm93c1RvSW5zZXJ0ID0gZXBpYy5zdWJUaWNrZXRzLmxlbmd0aDtcbiAgICAgICAgaWYgKHJvd3NUb0luc2VydCA+IDApIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5zZXJ0RGltZW5zaW9uKCdST1dTJywgaW5zZXJ0Um93SW5kZXggLSAxLCBpbnNlcnRSb3dJbmRleCAtIDEgKyByb3dzVG9JbnNlcnQpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDlt7LlnKjooYwgJHtpbnNlcnRSb3dJbmRleH0g5o+S5YWlICR7cm93c1RvSW5zZXJ0fSDkuKrnqbrooYxgKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign5o+S5YWl56m66KGM5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOaPkuWFpeepuuihjOWksei0pTogJHtlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcil9YCwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdWJUaWNrZXRSb3dzID0gZXBpYy5zdWJUaWNrZXRzLm1hcCh0aWNrZXQgPT4ge1xuICAgICAgICAgICAgY29uc3Qgcm93ID0gbmV3IEFycmF5KG1heENvbEluZGV4KS5maWxsKCcnKTtcbiAgICAgICAgICAgIGRpc3BsYXlIZWFkZXJzLmZvckVhY2goZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbHVtbkxldHRlciA9IHNoZWV0SGVhZGVyc1tmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XTtcbiAgICAgICAgICAgICAgICBpZiAoY29sdW1uTGV0dGVyICYmIHR5cGVvZiBjb2x1bW5MZXR0ZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbEluZGV4ID0gZ2V0Q29sdW1uSW5kZXgoY29sdW1uTGV0dGVyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkID09PSAna2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IGA9SFlQRVJMSU5LKFwiJHtqaXJhQmFzZVVybH0vYnJvd3NlLyR7dGlja2V0LmtleX1cIiwgXCIke3RpY2tldC5rZXl9XCIpYDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByb3c7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIOWGmeWFpeWtkOS7u+WKoeaVsOaNrlxuICAgICAgICBjb25zdCBzdGFydFBvc2l0aW9uID0gYEEke2luc2VydFJvd0luZGV4fWA7XG4gICAgICAgIGF3YWl0IHNoZWV0LndyaXRlU2hlZXQoc3ViVGlja2V0Um93cywgc3RhcnRQb3NpdGlvbik7XG4gICAgICAgIGNvbnNvbGUubG9nKGDlt7LlnKjooYwgJHtpbnNlcnRSb3dJbmRleH0g5YaZ5YWlICR7c3ViVGlja2V0Um93cy5sZW5ndGh9IOS4quWtkOS7u+WKoWApO1xuICAgIH1cbn1cbiJdLCJuYW1lcyI6WyJnZXRFbnZDb25maWciLCJmZXRjaEppcmFUaWNrZXRzIiwianFsIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZXF1ZXN0SWQiLCJNYXRoIiwicmFuZG9tIiwidG9TdHJpbmciLCJzdWJzdHJpbmciLCJtZXNzYWdlTGlzdGVuZXIiLCJtZXNzYWdlIiwidHlwZSIsImNocm9tZSIsInJ1bnRpbWUiLCJvbk1lc3NhZ2UiLCJyZW1vdmVMaXN0ZW5lciIsImVycm9yIiwiRXJyb3IiLCJ0aWNrZXRzIiwiYWRkTGlzdGVuZXIiLCJzZW5kTWVzc2FnZSIsIkZFVENIX0pJUkFfVElDS0VUUyIsInNvdXJjZVRhYklkIiwiZW52Q29uZmlnIiwidXJsIiwiSklSQV9CQVNFX1VSTCIsImVuY29kZVVSSUNvbXBvbmVudCIsInRhYnMiLCJjcmVhdGUiLCJhY3RpdmUiLCJ0YWIiLCJpZCIsImNoZWNrUGFnZUxvYWQiLCJnZXQiLCJ1cGRhdGVkVGFiIiwic3RhdHVzIiwiaW5jbHVkZXMiLCJzZXRUaW1lb3V0IiwidXBkYXRlIiwic2NyaXB0aW5nIiwiZXhlY3V0ZVNjcmlwdCIsInRhcmdldCIsInRhYklkIiwiZnVuYyIsImlzSmlyYUNsb3VkIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwicm93cyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJsZW5ndGgiLCJmb3JFYWNoIiwicm93Iiwia2V5RWxlbWVudCIsInN1bW1hcnlFbGVtZW50Iiwic3RhdHVzQ29udGFpbmVyIiwic3RhdHVzRWxlbWVudCIsImNlbGxzIiwiYXNzaWduZWUiLCJyZXBvcnRlciIsInByaW9yaXR5IiwiY3JlYXRlZCIsInVwZGF0ZWQiLCJkdWVkYXRlIiwiYXNzaWduZWVUZXh0IiwidGV4dENvbnRlbnQiLCJ0cmltIiwibWF0Y2giLCJkdWVEYXRlVGV4dCIsInRpY2tldCIsImtleSIsInN1bW1hcnkiLCJkZXNjcmlwdGlvbiIsInB1c2giLCJjZWxsIiwiY2xhc3NMaXN0IiwicHJvcGVydHlOYW1lIiwidmFsdWUiLCJyZXN1bHRzIiwicmVzdWx0IiwibWFwIiwic3BsaXQiLCJzIiwiZmlsdGVyIiwiQm9vbGVhbiIsInBvcCIsInJlbW92ZSIsIlNoZWV0IiwiY29uc3RydWN0b3IiLCJ0b2tlbiIsInNoZWV0SWQiLCJleHRyYWN0U2hlZXRJZCIsImdpZCIsImV4dHJhY3RHaWQiLCJpbml0IiwiZ2V0VG9rZW4iLCJzaGVldE5hbWUiLCJnZXRTaGVldE5hbWVCeUdpZCIsImlkZW50aXR5IiwiZ2V0QXV0aFRva2VuIiwiaW50ZXJhY3RpdmUiLCJsYXN0RXJyb3IiLCJnZXRTaGVldE5hbWVzIiwicmVzIiwiZmV0Y2giLCJoZWFkZXJzIiwiQXV0aG9yaXphdGlvbiIsImpzb24iLCJzaGVldHMiLCJzaGVldCIsImZpbmQiLCJwcm9wZXJ0aWVzIiwidGl0bGUiLCJyZWFkU2hlZXQiLCJzaGVldFVybCIsInZhbHVlcyIsIndyaXRlU2hlZXQiLCJwb3NpdGlvbiIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsIm1ldGhvZCIsImJvZHkiLCJKU09OIiwic3RyaW5naWZ5IiwiaW5zZXJ0RGltZW5zaW9uIiwiZGltZW5zaW9uIiwic3RhcnRJbmRleCIsImVuZEluZGV4IiwicmVxdWVzdCIsInJlcXVlc3RzIiwicmFuZ2UiLCJwYXJzZUludCIsImluaGVyaXRGcm9tQmVmb3JlIiwiYWRkRGltZW5zaW9uR3JvdXAiLCJvayIsInJlYWRDb25maWdTaGVldCIsImNvbmZpZ1NoZWV0TmFtZSIsImNvbnNvbGUiLCJnZXRIZWFkZXJzIiwiZ2V0U2hlZXROYW1lIiwiZ2V0SW5kZXhlZERCRGF0YSIsImRhdGFiYXNlTmFtZSIsInN0b3JlTmFtZSIsImluZGV4ZWREQiIsIm9wZW4iLCJvbnN1Y2Nlc3MiLCJldmVudCIsImRiIiwidHJhbnNhY3Rpb24iLCJvYmplY3RTdG9yZSIsImRhdGFSZXF1ZXN0IiwiZ2V0QWxsIiwib25lcnJvciIsImdldExvY2FsU3RvcmFnZUl0ZW0iLCJkZWZhdWx0VmFsdWUiLCJwYXJzZSIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJzZXRMb2NhbFN0b3JhZ2VJdGVtIiwic2V0SXRlbSIsImdldEN1cnJlbnRVc2VySW5mbyIsImV4dGVuc2lvbiIsImV4dGVuc2lvbklkIiwidXNlcm5hbWUiLCJnZXRGb2xkZXJzIiwidGhlbiIsIl9yZWYiLCJkYXRhIiwiZmF2b3JpdGVfZ3JvdXBfaWRzIiwiY29udmVyc2F0aW9uX3NldHMiLCJmb2xkZXJzIiwiaWRzIiwiaXRlbSIsImNhdGNoIiwibG9nIiwiZ2V0R3JvdXBzTWFwIiwiZ3JvdXBzIiwiZ3JvdXBzTWFwIiwicmVkdWNlIiwiYWNjIiwiZ3JvdXAiLCJuYW1lIiwic2V0X2FiYnJldmlhdGlvbiIsImlzX3RlYW0iLCJmb3JtYXREYXRlIiwiZGF0ZVN0cmluZyIsImRhdGUiLCJEYXRlIiwieWVhciIsImdldEZ1bGxZZWFyIiwibW9udGgiLCJTdHJpbmciLCJnZXRNb250aCIsInBhZFN0YXJ0IiwiZGF5IiwiZ2V0RGF0ZSIsImhvdXJzIiwiZ2V0SG91cnMiLCJtaW51dGVzIiwiZ2V0TWludXRlcyIsInNlY29uZHMiLCJnZXRTZWNvbmRzIiwidW5pcUJ5IiwiYXJyYXkiLCJzZWVuIiwiU2V0Iiwia2V5VmFsdWUiLCJoYXMiLCJhZGQiLCJzaG93VG9hc3QiLCJvbkNsb3NlIiwiY29udGFpbmVyIiwiZ2V0RWxlbWVudEJ5SWQiLCJleGlzdGluZ1RvYXN0IiwicmVtb3ZlQ2hpbGQiLCJ0b2FzdCIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJ0b2FzdElubmVyIiwiYXBwZW5kQ2hpbGQiLCJ0aW1lciIsImNvbnRhaW5zIiwiY2xlYXJUaW1lb3V0IiwidHJhbnNmb3JtR3JvdXBMaW5rcyIsImlucHV0U3RyaW5nIiwiZ3JvdXBMaW5rUGF0dGVybiIsInRyYW5zZm9ybWVkU3RyaW5nIiwicmVwbGFjZSIsImdyb3VwTmFtZSIsImdyb3VwSWQiLCJ0cmFuc2Zvcm1Qb3N0TGlua3MiLCJwb3N0TGlua1BhdHRlcm4iLCJpbmRleCIsInBvc3RJZCIsIndpbmRvdyIsImxvY2F0aW9uIiwicGF0aG5hbWUiLCJkZWZhdWx0RW52Q29uZmlnIiwiU0NIRURVTEVEX0lOVEVSVkFMIiwiTnVtYmVyIiwicHJvY2VzcyIsImVudiIsIkFOQUxZU0lTX1RZUEUiLCJMTE1fVFlQRSIsIkFOQUxZWkVfQllfR1JPVVAiLCJPTExBTUFfQkFTRV9VUkwiLCJPTExBTUFfTU9ERUwiLCJPTExBTUFfUkVWSUVXX01PREVMIiwiT0xMQU1BX1FVRVJZX01PREVMIiwiRElGWV9BUElfS0VZIiwiRElGWV9SRVZJRVdfQVBJX0tFWSIsIkRJRllfQVBJX0JBU0VfVVJMIiwiT1BFTkFJX0FQSV9LRVkiLCJPUEVOQUlfTU9ERUwiLCJPUEVOQUlfUkVWSUVXX01PREVMIiwiT1BFTkFJX0FQSV9CQVNFX1VSTCIsIkdST1FfQVBJX0tFWSIsIkdST1FfTU9ERUwiLCJHUk9RX1JFVklFV19NT0RFTCIsIkJPVF9BUElfQkFTRV9VUkwiLCJCT1RfVE9LRU4iLCJCT1RfSUQiLCJCT1RfVFlQRSIsIlRFQU1fSUQiLCJFTkFCTEVfQk9UIiwiTExNX1JFVklFV19CRUZPUkVfU0VORCIsIkVOQUJMRV9DSFJPTUEiLCJDSFJPTUFfQVBJX1VSTCIsIkNIUk9NQV9QT1JUIiwiQ0hST01BX0NPTExFQ1RJT05fTkFNRSIsIkpJUkFfVVNFUk5BTUUiLCJKSVJBX0FQSV9UT0tFTiIsInN0b3JhZ2UiLCJsb2NhbCIsImdldFVzZXJJbmZvIiwiYWNjb3VudFVEIiwiYWNjb3VudEluZm9MaXN0IiwiYWNjb3VudEluZm8iLCJkaXNwbGF5TmFtZSIsImVtYWlsIiwiZnVsbE5hbWUiLCJqb2luIiwidG9Mb3dlckNhc2UiLCJ1c2VySW5mbyIsInNlbmRlciIsInNlbmRSZXNwb25zZSIsIndhcm4iLCJzdWNjZXNzIiwib3BlbkpxbERpYWxvZyIsInNoZWV0VG9rZW4iLCJoYW5kbGVFeHBhbmRFcGljVGlja2V0cyIsImRpYWxvZyIsInN0eWxlIiwiY3NzVGV4dCIsImlubmVySFRNTCIsImFkZEV2ZW50TGlzdGVuZXIiLCJmb3JtYXR0ZWREYXRhIiwiZmllbGQiLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJzaGVldEhlYWRlcnMiLCJmaW5kVmFsaWRKaXJhSGVhZGVycyIsImRpc3BsYXlIZWFkZXJzIiwia2V5Q29sdW1uSW5kZXgiLCJnZXRDb2x1bW5JbmRleCIsImluZmVycmVkS2V5SW5kZXgiLCJmaW5kSW5kZXgiLCJoZWFkZXIiLCJmcm9tQ2hhckNvZGUiLCJrZXlUb1Jvd01hcCIsIk1hcCIsInNsaWNlIiwia2V5Q2VsbCIsInRlc3QiLCJzZXQiLCJvcGVyYXRpb25zIiwiZXhpc3RpbmdSb3dJbmRleCIsInJvd0luZGV4IiwiY29uZmlybWVkT3BlcmF0aW9ucyIsInNob3dDb25maXJtYXRpb25EaWFsb2ciLCJ1cGRhdGVzRGF0YSIsImFwcGVuZERhdGEiLCJoZWFkZXJWYWx1ZXMiLCJPYmplY3QiLCJtYXhDb2xJbmRleCIsImdldE1heENvbHVtbkluZGV4Iiwib3BlcmF0aW9uIiwiQXJyYXkiLCJmaWxsIiwia2V5cyIsInRpY2tldEtleSIsImNvbHVtbkxldHRlciIsImNvbEluZGV4IiwidXBkYXRlZENvdW50IiwiYXBwZW5kZWRDb3VudCIsInN0YXJ0Q29sdW1uIiwic3RhcnRQb3NpdGlvbiIsInRvYXN0TWVzc2FnZSIsImhlYWRlck1hcHBpbmciLCJjdXN0b21GaWVsZE1hcHBpbmciLCJjb25maWdEYXRhIiwic2hlZXRIZWFkZXJJbmRleCIsImgiLCJqaXJhRmllbGRJbmRleCIsImkiLCJtYXgiLCJzaGVldEhlYWRlciIsImppcmFGaWVsZCIsInN0YXJ0c1dpdGgiLCJ2YWxpZEhlYWRlcnMiLCJrbm93bkZpZWxkcyIsImhlYWRlckxvd2VyIiwiZGlyZWN0TWF0Y2giLCJjb2x1bW4iLCJ0b1VwcGVyQ2FzZSIsInVwcGVyQ29sdW1uIiwiY2hhckNvZGVBdCIsImNvbHVtbkxldHRlcnMiLCJpc0FycmF5IiwidmFsaWRMZXR0ZXJzIiwiaW5kaWNlcyIsImNvbCIsImNvbHVtbnNUb1VwZGF0ZSIsInVwZGF0ZUNvdW50Iiwib3AiLCJhcHBlbmRDb3VudCIsInNlbGVjdEFsbENoZWNrYm94IiwidGlja2V0Q2hlY2tib3hlcyIsImdldEVsZW1lbnRzQnlDbGFzc05hbWUiLCJjb25maXJtQnV0dG9uIiwidXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50Iiwic2VsZWN0ZWRDb3VudCIsImZyb20iLCJjYiIsImNoZWNrZWQiLCJkaXNhYmxlZCIsImNoZWNrYm94IiwiZXZlcnkiLCJzZWxlY3RlZE9wZXJhdGlvbnMiLCJkYXRhc2V0IiwiZXhpc3RpbmdUb2FzdHMiLCJ0IiwiYmFja2dyb3VuZENvbG9yIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwib3BhY2l0eSIsImVwaWNzVG9FeHBhbmQiLCJrZXlDZWxsQ29udGVudCIsImVwaWNLZXkiLCJzdWJUaWNrZXRzIiwic3VtbWFyeUNvbHVtbkluZGV4IiwiZXBpY1N1bW1hcnkiLCJmZXRjaEVycm9yIiwiY29uZmlybWVkRXBpY3MiLCJzaG93RXBpY0NvbmZpcm1hdGlvbkRpYWxvZyIsImluc2VydFN1YlRpY2tldHMiLCJlcGljcyIsImVwaWMiLCJlcGljQ2hlY2tib3hlcyIsInNlbGVjdGVkRXBpY3MiLCJqaXJhQmFzZVVybCIsInNvcnRlZEVwaWNzIiwic29ydCIsImEiLCJiIiwiaW5zZXJ0Um93SW5kZXgiLCJyb3dzVG9JbnNlcnQiLCJzdWJUaWNrZXRSb3dzIl0sInNvdXJjZVJvb3QiOiIifQ==