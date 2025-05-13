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
//# sourceMappingURL=contentScriptGoogleSheet.js.map