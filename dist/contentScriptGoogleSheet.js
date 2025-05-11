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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Q3FDLEdBQUcsQ0FBQyxPQUFPeU8sY0FBYyxPQUFPRSxhQUFhLENBQUN6VyxNQUFNLE9BQU8sQ0FBQztFQUN4RTtBQUNKLEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9qaXJhLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3NoZWV0LnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3N0b3JhZ2UudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvdXRpbHMudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9jb250ZW50U2NyaXB0R29vZ2xlU2hlZXQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyDku44gSmlyYSDpobXpnaLmipPlj5bmlbDmja5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaEppcmFUaWNrZXRzKGpxbDogc3RyaW5nKTogUHJvbWlzZTxKaXJhVGlja2V0W10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0SWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoNyk7XG4gICAgICAgIFxuICAgICAgICAvLyDnm5HlkKzmnaXoh6ogYmFja2dyb3VuZCBzY3JpcHQg55qE5raI5oGvXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VMaXN0ZW5lciA9IChtZXNzYWdlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyAmJiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gcmVxdWVzdElkKSB7XG4gICAgICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlLmVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLnRpY2tldHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgIFxuICAgICAgICAvLyDlj5HpgIHmtojmga/nu5kgYmFja2dyb3VuZCBzY3JpcHQg5p2l5Yib5bu65paw5qCH562+6aG1XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdGRVRDSF9KSVJBX1RJQ0tFVFMnLFxuICAgICAgICAgICAganFsLFxuICAgICAgICAgICAgcmVxdWVzdElkXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDnhLblkI7lnKggRkVUQ0hfSklSQV9USUNLRVRTIOWHveaVsOS4reS9v+eUqCBzb3VyY2VUYWJJZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEZFVENIX0pJUkFfVElDS0VUUyhqcWw6IHN0cmluZywgcmVxdWVzdElkOiBzdHJpbmcsIHNvdXJjZVRhYklkOiBudW1iZXIpIHtcbiAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gIGNvbnN0IHVybCA9IGAke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9pc3N1ZXMvP2pxbD0ke2VuY29kZVVSSUNvbXBvbmVudChqcWwpfWA7XG4gICAgICAgIFxuICAvLyDliJvlu7rmlrDmoIfnrb7pobVcbiAgY2hyb21lLnRhYnMuY3JlYXRlKHsgdXJsLCBhY3RpdmU6IGZhbHNlIH0sICh0YWIpID0+IHtcbiAgICAgIGlmICghdGFiLmlkKSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgIGVycm9yOiAn5peg5rOV5Yib5bu65qCH562+6aG1J1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICBjb25zdCBjaGVja1BhZ2VMb2FkID0gKCkgPT4ge1xuICAgICAgICAgIGNocm9tZS50YWJzLmdldCh0YWIuaWQhLCAodXBkYXRlZFRhYikgPT4ge1xuICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi5zdGF0dXMgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi51cmwuaW5jbHVkZXMoJ2xvZ2luJykgfHwgdXBkYXRlZFRhYi51cmwuaW5jbHVkZXMoJ29rdGEnKSkge1xuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdqaXJhIOmcgOimgeeZu+W9le+8jOivt+eZu+W9leWQjumHjeaWsOWwneivlSdcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gY2hyb21lLnRhYnMudXBkYXRlKHRhYi5pZCEsIHsgYWN0aXZlOiB0cnVlIH0pLCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIC8vIOazqOWFpeWGheWuueiEmuacrFxuICAgICAgICAgICAgICAgICAgY2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdGFiSWQ6IHRhYi5pZCEgfSxcbiAgICAgICAgICAgICAgICAgICAgICBmdW5jOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDliKTmlq3mmK/lkKbmmK9KaXJhIENsb3Vk54mI5pys77yM6YCa6L+H5qOA5p+l54m55a6a55qERE9N5YWD57Sg5Yik5patXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzSmlyYUNsb3VkID0gISFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd0YWJsZVtkYXRhLXZjPVwiaXNzdWUtdGFibGVcIl0nKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgISFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCd0YWJsZVthcmlhLWxhYmVsPVwiV29ya1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzSmlyYUNsb3VkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBKaXJhIENsb3VkIOeJiOacrOeahOmAieaLqeWZqFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyW2RhdGEtdGVzdGlkPVwibmF0aXZlLWlzc3VlLXRhYmxlLnVpLmlzc3VlLXJvd1wiXScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocm93cyAmJiByb3dzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dzLmZvckVhY2gocm93ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g6I635Y+Wa2V5IC0gYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUta2V5Lmlzc3VlLWtleS1jZWxsXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleUVsZW1lbnQgPSByb3cucXVlcnlTZWxlY3RvcignYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUta2V5Lmlzc3VlLWtleS1jZWxsXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDojrflj5ZzdW1tYXJ5IC0gYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUtc3VtbWFyeS5pc3N1ZS1zdW1tYXJ5LWNlbGxcIl1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeUVsZW1lbnQgPSByb3cucXVlcnlTZWxlY3RvcignYVtkYXRhLXRlc3RpZD1cIm5hdGl2ZS1pc3N1ZS10YWJsZS5jb21tb24udWkuaXNzdWUtY2VsbHMuaXNzdWUtc3VtbWFyeS5pc3N1ZS1zdW1tYXJ5LWNlbGxcIl0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOiOt+WPlnN0YXR1cyAtIOeKtuaAgeS9jeS6juacieeJueWummNsYXNz55qEc3BhbuS4rVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0dXNDb250YWluZXIgPSByb3cucXVlcnlTZWxlY3RvcignZGl2W2RhdGEtdGVzdGlkXj1cImlzc3VlLmZpZWxkcy5zdGF0dXMuY29tbW9uLnVpLnN0YXR1cy1sb3plbmdlXCJdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXR1c0VsZW1lbnQgPSBzdGF0dXNDb250YWluZXIgPyBzdGF0dXNDb250YWluZXIucXVlcnlTZWxlY3RvcignZGl2Ll80Y3ZyMWg2bycpIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOe7j+WKnuS6uuOAgeaKpeWRiuS6uuWSjOS8mOWFiOe6p+mAmuW4uOS9jeS6juebuOW6lOeahOWNleWFg+agvOS4rVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjZWxscyA9IHJvdy5xdWVyeVNlbGVjdG9yQWxsKCd0ZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXQgYXNzaWduZWUgPSAnJywgcmVwb3J0ZXIgPSAnJywgcHJpb3JpdHkgPSAnJywgY3JlYXRlZCA9ICcnLCB1cGRhdGVkID0gJycsIGR1ZWRhdGUgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOmAmui/h+S9jee9ruWIpOaWreWQhOS4quWtl+autVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2VsbHMubGVuZ3RoID49IDExKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKw15Liq5Y2V5YWD5qC85pivYXNzaWduZWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2lnbmVlVGV4dCA9IGNlbGxzWzRdLnRleHRDb250ZW50Py50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZSA9IGFzc2lnbmVlVGV4dC5tYXRjaCgvXiguKz8pXFwxKyQvKVsxXSB8fCBhc3NpZ25lZVRleHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZSA9IGFzc2lnbmVlICE9PSAnVW5hc3NpZ25lZCcgPyBhc3NpZ25lZSB8fCAnJyA6ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKw25Liq5Y2V5YWD5qC85pivcmVwb3J0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyID0gY2VsbHNbNV0udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyID0gcmVwb3J0ZXIubWF0Y2goL14oLis/KVxcMSskLylbMV0gfHwgcmVwb3J0ZXI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDfkuKrljZXlhYPmoLzmmK9wcmlvcml0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHkgPSBjZWxsc1s2XS50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7nrKw55Liq5Y2V5YWD5qC85pivY3JlYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZCA9IGNlbGxzWzhdLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDEw5Liq5Y2V5YWD5qC85pivdXBkYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZCA9IGNlbGxzWzldLnRleHRDb250ZW50Py50cmltKCkgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWBh+iuvuesrDEx5Liq5Y2V5YWD5qC85pivZHVlZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHVlRGF0ZVRleHQgPSBjZWxsc1sxMF0udGV4dENvbnRlbnQ/LnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGUgPSBkdWVEYXRlVGV4dCAhPT0gJ05vbmUnID8gZHVlRGF0ZVRleHQgfHwgJycgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGlja2V0ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBrZXlFbGVtZW50ID8ga2V5RWxlbWVudC50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnIDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiBzdW1tYXJ5RWxlbWVudCA/IHN1bW1hcnlFbGVtZW50LnRleHRDb250ZW50Py50cmltKCkgfHwgJycgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogc3RhdHVzRWxlbWVudCA/IHN0YXR1c0VsZW1lbnQudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyA6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdWVkYXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICcnIC8vIENsb3Vk6KeG5Zu+5Lit6YCa5bi45LiN5pi+56S65o+P6L+wXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDljp/mnInnmoQgSmlyYSBPbi1QcmVtaXNlIOeJiOacrOeahOmAieaLqeWZqFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ci5pc3N1ZXJvdycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldDogYW55ID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNlbGxzID0gcm93LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RkJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2VsbHMuZm9yRWFjaChjZWxsID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjZWxsLmNsYXNzTGlzdCAmJiBjZWxsLmNsYXNzTGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHByb3BlcnR5TmFtZSA9IGNlbGwuY2xhc3NMaXN0WzBdOyAvLyBHZXQgdGhlIGZpcnN0IGNsYXNzIG5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbWcgPSBjZWxsLnF1ZXJ5U2VsZWN0b3IoJ2ltZ1thbHRdJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBjZWxsLnRleHRDb250ZW50Py50cmltKCkgfHwgKGltZyA/IGltZy5nZXRBdHRyaWJ1dGUoJ2FsdCcpIHx8ICcnIDogJycpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlIGNsYXNzIG5hbWUgaXMgJ2lzc3Vla2V5JywgdGhlIHByb3BlcnR5IGluIG91ciBvYmplY3Qgc2hvdWxkIGJlICdrZXknXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5TmFtZSA9PT0gJ2lzc3Vla2V5JykgcHJvcGVydHlOYW1lID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BlcnR5TmFtZSkgeyAvLyBFbnN1cmUgcHJvcGVydHlOYW1lIGlzIG5vdCBlbXB0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldFtwcm9wZXJ0eU5hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBFbnN1cmUgZXNzZW50aWFsIG5vbi1vcHRpb25hbCBmaWVsZHMgZnJvbSBKaXJhVGlja2V0IGFyZSBwcmVzZW50LCBldmVuIGlmIGVtcHR5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldC5rZXkgPSB0aWNrZXQua2V5IHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXQuc3VtbWFyeSA9IHRpY2tldC5zdW1tYXJ5IHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXQuc3RhdHVzID0gdGlja2V0LnN0YXR1cyB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGlja2V0cztcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9LCAocmVzdWx0cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyDlpITnkIbnu5PmnpxcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdHMgJiYgcmVzdWx0c1swXSAmJiByZXN1bHRzWzBdLnJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIOWvuXN1bW1hcnnlrZfmrrXov5vooYzpop3lpJblpITnkIbvvIznoa7kv53lubLlh4DnmoTmlofmnKxcbiAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzWzBdLnJlc3VsdCA9IHJlc3VsdHNbMF0ucmVzdWx0Lm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHRpY2tldC5zdW1tYXJ5LnNwbGl0KCdcXG4nKS5tYXAoKHM6IHN0cmluZykgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKS5wb3AoKSB8fCB0aWNrZXQuc3VtbWFyeSxcbiAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHM6IHJlc3VsdHNbMF0ucmVzdWx0XG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8g5aaC5p6c5rKh5pyJ57uT5p6cXG4gICAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHM6IFtdXG4gICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIOWFs+mXrSBKaXJhIOagh+etvumhtVxuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5yZW1vdmUodGFiLmlkISk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoY2hlY2tQYWdlTG9hZCwgMTAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgY2hlY2tQYWdlTG9hZCgpO1xuICB9KTtcbn1cbiIsImV4cG9ydCBjbGFzcyBTaGVldCB7XG4gIHByaXZhdGUgdG9rZW46IHN0cmluZztcbiAgcHJpdmF0ZSBzaGVldElkOiBzdHJpbmc7XG4gIHByaXZhdGUgZ2lkOiBzdHJpbmc7XG4gIHByaXZhdGUgc2hlZXROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcsIHRva2VuOiBzdHJpbmcpIHtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5zaGVldElkID0gdGhpcy5leHRyYWN0U2hlZXRJZCh1cmwpO1xuICAgIHRoaXMuZ2lkID0gdGhpcy5leHRyYWN0R2lkKHVybCk7XG4gIH1cbiAgICBcbiAgYXN5bmMgaW5pdCgpIHtcbiAgICBpZiAoIXRoaXMudG9rZW4pIHRoaXMudG9rZW4gPSBhd2FpdCB0aGlzLmdldFRva2VuKCk7XG4gICAgdGhpcy5zaGVldE5hbWUgPSBhd2FpdCB0aGlzLmdldFNoZWV0TmFtZUJ5R2lkKHRoaXMudG9rZW4sIHRoaXMuc2hlZXRJZCwgdGhpcy5naWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjaHJvbWUuaWRlbnRpdHkuZ2V0QXV0aFRva2VuKHsgaW50ZXJhY3RpdmU6IHRydWUgfSwgKHRva2VuKSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgICAgIGVsc2UgcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZXh0cmFjdFNoZWV0SWQodXJsOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvXFwvZFxcLyhbYS16QS1aMC05LV9dKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBleHRyYWN0R2lkKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL1sjJl1naWQ9KFswLTldKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBhc3luYyBnZXRTaGVldE5hbWVzKHRva2VuOiBzdHJpbmcsIHNoZWV0SWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3NoZWV0SWR9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9XG4gICAgfSk7XG4gICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgcmV0dXJuIGpzb24uc2hlZXRzO1xuICB9XG5cbiAgYXN5bmMgZ2V0U2hlZXROYW1lQnlHaWQodG9rZW46IHN0cmluZywgc2hlZXRJZDogc3RyaW5nLCBnaWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qgc2hlZXRzID0gYXdhaXQgdGhpcy5nZXRTaGVldE5hbWVzKHRva2VuLCBzaGVldElkKTtcbiAgICBjb25zdCBzaGVldCA9IHNoZWV0cy5maW5kKChzOiBhbnkpID0+IHMucHJvcGVydGllcy5zaGVldElkLnRvU3RyaW5nKCkgPT09IGdpZCk7XG4gICAgcmV0dXJuIHNoZWV0ID8gc2hlZXQucHJvcGVydGllcy50aXRsZSA6IHNoZWV0c1swXS5wcm9wZXJ0aWVzLnRpdGxlOyAvLyDlpoLmnpzmib7kuI3liLDlr7nlupTnmoRnaWQs6L+U5Zue56ys5LiA5Liqc2hlZXTnmoTlkI3np7BcbiAgfVxuXG4gIGFzeW5jIHJlYWRTaGVldCgpOiBQcm9taXNlPHN0cmluZ1tdW10+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gIH1cbiAgICB9KTtcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICByZXR1cm4ganNvbi52YWx1ZXM7XG4gIH1cblxuICBhc3luYyB3cml0ZVNoZWV0KHZhbHVlczogc3RyaW5nW11bXSwgcG9zaXRpb24gPSAnQTEnKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfSEke3Bvc2l0aW9ufT92YWx1ZUlucHV0T3B0aW9uPVVTRVJfRU5URVJFRGA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgdmFsdWVzIH0pXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gIH1cblxuICAvLyDmj5LlhaXooYzmiJbliJdcbiAgYXN5bmMgaW5zZXJ0RGltZW5zaW9uKGRpbWVuc2lvbjogJ1JPV1MnIHwgJ0NPTFVNTlMnLCBzdGFydEluZGV4OiBudW1iZXIsIGVuZEluZGV4OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfTpiYXRjaFVwZGF0ZWA7XG4gICAgY29uc3QgcmVxdWVzdCA9IHtcbiAgICAgIHJlcXVlc3RzOiBbe1xuICAgICAgICBpbnNlcnREaW1lbnNpb246IHtcbiAgICAgICAgICByYW5nZToge1xuICAgICAgICAgICAgc2hlZXRJZDogcGFyc2VJbnQodGhpcy5naWQpLFxuICAgICAgICAgICAgZGltZW5zaW9uLFxuICAgICAgICAgICAgc3RhcnRJbmRleCxcbiAgICAgICAgICAgIGVuZEluZGV4XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmhlcml0RnJvbUJlZm9yZTogdHJ1ZVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBhZGREaW1lbnNpb25Hcm91cDoge1xuICAgICAgICAgIHJhbmdlOiB7XG4gICAgICAgICAgICBzaGVldElkOiBwYXJzZUludCh0aGlzLmdpZCksXG4gICAgICAgICAgICBkaW1lbnNpb24sXG4gICAgICAgICAgICBzdGFydEluZGV4LFxuICAgICAgICAgICAgZW5kSW5kZXhcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfTtcblxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0KVxuICAgIH0pO1xuXG4gICAgaWYgKCFyZXMub2spIHtcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg5o+S5YWl57u05bqm5aSx6LSlOiAke2Vycm9yLmVycm9yPy5tZXNzYWdlIHx8ICfmnKrnn6XplJnor68nfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDor7vlj5bphY3nva7ooajmlbDmja5cbiAgICogQHBhcmFtIHNoZWV0TmFtZSDphY3nva7ooajlkI3np7BcbiAgICogQHJldHVybnMg6YWN572u6KGo5pWw5o2uXG4gICAqL1xuICBhc3luYyByZWFkQ29uZmlnU2hlZXQoY29uZmlnU2hlZXROYW1lID0gJycpOiBQcm9taXNlPHN0cmluZ1tdW10+IHtcbiAgICBpZiAoIWNvbmZpZ1NoZWV0TmFtZSkgY29uZmlnU2hlZXROYW1lID0gdGhpcy5zaGVldE5hbWUgKyAnX2NvbmZpZyc7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHtjb25maWdTaGVldE5hbWV9YDtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCB9XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICAgICAgcmV0dXJuIGpzb24udmFsdWVzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfor7vlj5bphY3nva7ooajlpLHotKU6JywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOiOt+WPluihqOagvOeahOesrOS4gOihjOS9nOS4uuihqOWktFxuICAgKiBAcmV0dXJucyDooajlpLTmlbDnu4RcbiAgICovXG4gIGFzeW5jIGdldEhlYWRlcnMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHZhbHVlcyA9IGF3YWl0IHRoaXMucmVhZFNoZWV0KCk7XG4gICAgaWYgKCF2YWx1ZXMgfHwgdmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfooajmoLzkuLrnqbonKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlc1swXTtcbiAgfVxuXG4gIHB1YmxpYyBnZXRTaGVldE5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5zaGVldE5hbWU7XG4gIH1cbn0iLCJleHBvcnQgZnVuY3Rpb24gZ2V0SW5kZXhlZERCRGF0YShkYXRhYmFzZU5hbWU6IHN0cmluZywgc3RvcmVOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBpbmRleGVkREIub3BlbihkYXRhYmFzZU5hbWUpO1xuICAgIFxuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYiA9IGV2ZW50LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IGRiLnRyYW5zYWN0aW9uKFtzdG9yZU5hbWVdLCAncmVhZG9ubHknKTtcbiAgICAgICAgICAgIGNvbnN0IG9iamVjdFN0b3JlID0gdHJhbnNhY3Rpb24ub2JqZWN0U3RvcmUoc3RvcmVOYW1lKTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGFSZXF1ZXN0ID0gb2JqZWN0U3RvcmUuZ2V0QWxsKCk7XG4gICAgXG4gICAgICAgICAgICBkYXRhUmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVzb2x2ZShldmVudC50YXJnZXQucmVzdWx0KTtcbiAgICAgICAgICAgIH07XG4gICAgXG4gICAgICAgICAgICBkYXRhUmVxdWVzdC5vbmVycm9yID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlamVjdChldmVudC50YXJnZXQuZXJyb3IpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlamVjdChldmVudC50YXJnZXQuZXJyb3IpO1xuICAgICAgICB9O1xuICAgIH0pO1xufVxuXG5cbmV4cG9ydCBjb25zdCBnZXRMb2NhbFN0b3JhZ2VJdGVtID0gKGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IGFueSkgPT4ge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKGtleSkgfHwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdFZhbHVlKSk7XG59O1xuXG5leHBvcnQgY29uc3Qgc2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEN1cnJlbnRVc2VySW5mbygpIHtcbiAgICBjb25zdCB7IGV4dGVuc2lvbjogZXh0ZW5zaW9uSWQgfSA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ293bkV4dGVuc2lvbicsIHt9KTtcbiAgICBjb25zdCB1c2VybmFtZSA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2Rpc3BsYXlOYW1lJywgJ3JhZGFyLXBvYycpO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIGV4dGVuc2lvbklkLFxuICAgICAgICB1c2VybmFtZVxuICAgIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGb2xkZXJzKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ3Byb2ZpbGUnKS50aGVuKChbZGF0YV0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZhdm9yaXRlX2dyb3VwX2lkcyA9IGRhdGE/LmZhdm9yaXRlX2dyb3VwX2lkcyB8fCBbXTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbl9zZXRzID0gZGF0YT8uY29udmVyc2F0aW9uX3NldHMgfHwgW107XG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBjb25zdCBmb2xkZXJzID0gW3t0aXRsZTogJyAnLCBpZHM6IFtdfSx7dGl0bGU6ICdmYXZvcml0ZScsIGlkczogZmF2b3JpdGVfZ3JvdXBfaWRzfSwgLi4uY29udmVyc2F0aW9uX3NldHMuZmlsdGVyKGl0ZW0gPT4gaXRlbS50eXBlID09PSAnZm9sZGVyJyldXG4gICAgICAgICAgICByZXR1cm4gZm9sZGVycztcbiAgICAgICAgfSkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcbiAgICAgICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRHcm91cHNNYXAoKSB7XG4gICAgcmV0dXJuIGdldEluZGV4ZWREQkRhdGEoJ0dsaXAnLCAnZ3JvdXAnKS50aGVuKChncm91cHMpID0+IHtcbiAgICAgICAgY29uc3QgZ3JvdXBzTWFwID0gZ3JvdXBzLnJlZHVjZSgoYWNjOiBhbnksIGdyb3VwOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGFjY1tncm91cC5pZF0gPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogZ3JvdXAuc2V0X2FiYnJldmlhdGlvbixcbiAgICAgICAgICAgICAgICBpc190ZWFtOiBncm91cC5pc190ZWFtXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgfSwge30pO1xuXG4gICAgICAgIHJldHVybiBncm91cHNNYXA7XG4gICAgfSk7XG59IiwiaW1wb3J0IHsgZ2V0Q3VycmVudFVzZXJJbmZvLCBnZXRMb2NhbFN0b3JhZ2VJdGVtIH0gZnJvbSBcIi4vc3RvcmFnZVwiO1xuXG4vLyDnjq/looPphY3nva7nsbvlnovlrprkuYlcbmV4cG9ydCBpbnRlcmZhY2UgRW52Q29uZmlnVHlwZSB7XG4gIFNDSEVEVUxFRF9JTlRFUlZBTDogbnVtYmVyO1xuICBBTkFMWVNJU19UWVBFOiBzdHJpbmc7XG4gIEFOQUxZWkVfQllfR1JPVVA6IGJvb2xlYW47XG4gIExMTV9UWVBFOiBzdHJpbmc7XG4gIE9MTEFNQV9CQVNFX1VSTDogc3RyaW5nO1xuICBPTExBTUFfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogc3RyaW5nO1xuICBPTExBTUFfUVVFUllfTU9ERUw6IHN0cmluZztcbiAgRElGWV9BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfUkVWSUVXX0FQSV9LRVk6IHN0cmluZztcbiAgRElGWV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgT1BFTkFJX0FQSV9LRVk6IHN0cmluZztcbiAgT1BFTkFJX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBHUk9RX0FQSV9LRVk6IHN0cmluZztcbiAgR1JPUV9NT0RFTDogc3RyaW5nO1xuICBHUk9RX1JFVklFV19NT0RFTDogc3RyaW5nO1xuICBCT1RfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIEJPVF9UT0tFTjogc3RyaW5nO1xuICBCT1RfSUQ6IHN0cmluZztcbiAgQk9UX1RZUEU6IHN0cmluZztcbiAgVEVBTV9JRDogc3RyaW5nO1xuICBFTkFCTEVfQk9UOiBib29sZWFuO1xuICBMTE1fUkVWSUVXX0JFRk9SRV9TRU5EOiBib29sZWFuO1xuICBFTkFCTEVfQ0hST01BOiBib29sZWFuO1xuICBDSFJPTUFfQVBJX1VSTDogc3RyaW5nO1xuICBDSFJPTUFfUE9SVDogbnVtYmVyO1xuICBDSFJPTUFfQ09MTEVDVElPTl9OQU1FOiBzdHJpbmc7XG4gIC8vIEpJUkHnm7jlhbPphY3nva5cbiAgSklSQV9CQVNFX1VSTD86IHN0cmluZztcbiAgSklSQV9VU0VSTkFNRT86IHN0cmluZztcbiAgSklSQV9BUElfVE9LRU4/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXREYXRlKGRhdGVTdHJpbmc6IHN0cmluZyB8IG51bWJlcikge1xuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShkYXRlU3RyaW5nKTtcbiAgICBcbiAgICBjb25zdCB5ZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgIGNvbnN0IG1vbnRoID0gU3RyaW5nKGRhdGUuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgZGF5ID0gU3RyaW5nKGRhdGUuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGhvdXJzID0gU3RyaW5nKGRhdGUuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBtaW51dGVzID0gU3RyaW5nKGRhdGUuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IHNlY29uZHMgPSBTdHJpbmcoZGF0ZS5nZXRTZWNvbmRzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gIFxuICAgIHJldHVybiBgJHt5ZWFyfS0ke21vbnRofS0ke2RheX0gJHtob3Vyc306JHttaW51dGVzfToke3NlY29uZHN9YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVuaXFCeShhcnJheTogYW55W10sIGtleTogc3RyaW5nKSB7XG4gICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcbiAgICByZXR1cm4gYXJyYXkuZmlsdGVyKGl0ZW0gPT4ge1xuICAgICAgY29uc3Qga2V5VmFsdWUgPSBpdGVtW2tleV07XG4gICAgICBpZiAoc2Vlbi5oYXMoa2V5VmFsdWUpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHNlZW4uYWRkKGtleVZhbHVlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2U6IHN0cmluZywgdHlwZTogc3RyaW5nLCBvbkNsb3NlPzogKCkgPT4gdm9pZCkge1xuICAvLyDojrflj5bmiJbliJvlu7rlrrnlmajlhYPntKBcbiAgY29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JhZGFyLXBvYy1yZXN1bHQnKTtcbiAgaWYgKCFjb250YWluZXIpIHJldHVyblxuXG4gIC8vIOenu+mZpOeOsOacieeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgZXhpc3RpbmdUb2FzdCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcucmFkYXItcG9jLXRvYXN0Jyk7XG4gIGlmIChleGlzdGluZ1RvYXN0KSB7XG4gICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKGV4aXN0aW5nVG9hc3QpO1xuICB9XG5cbiAgLy8g5Yib5bu65paw55qEIFRvYXN0IOWFg+e0oFxuICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdC5jbGFzc05hbWUgPSBgcmFkYXItcG9jLXRvYXN0IHJhZGFyLXBvYy10b2FzdC0ke3R5cGV9YDtcblxuICBjb25zdCB0b2FzdElubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0SW5uZXIuY2xhc3NOYW1lID0gJ3JhZGFyLXBvYy10b2FzdC1pbm5lcic7XG4gIHRvYXN0SW5uZXIudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXG4gIHRvYXN0LmFwcGVuZENoaWxkKHRvYXN0SW5uZXIpO1xuICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9hc3QpO1xuXG4gIC8vIOiuvue9ruWumuaXtuWZqOWcqCAzIOenkuWQjuWFs+mXrSBUb2FzdFxuICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGlmIChjb250YWluZXIuY29udGFpbnModG9hc3QpKSB7XG4gICAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgIH1cbiAgICBpZiAob25DbG9zZSkge1xuICAgICAgb25DbG9zZSgpO1xuICAgIH1cbiAgfSwgMzAwMCk7XG5cbiAgLy8g6L+U5Zue5LiA5Liq5Ye95pWw5Lul5L6/5omL5Yqo5YWz6ZetIFRvYXN0XG4gIHJldHVybiAoKSA9PiB7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1Hcm91cExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgZ3JvdXBMaW5rUGF0dGVybiA9IC9cXFtncm91cDooLispOihcXGQrKVxcXS9nO1xuICBjb25zdCB0cmFuc2Zvcm1lZFN0cmluZyA9IGlucHV0U3RyaW5nLnJlcGxhY2UoZ3JvdXBMaW5rUGF0dGVybiwgKG1hdGNoLCBncm91cE5hbWUsIGdyb3VwSWQpID0+IHtcbiAgICByZXR1cm4gYFske2dyb3VwTmFtZX1dKC9tZXNzYWdlcy8ke2dyb3VwSWR9KWA7XG4gIH0pO1xuICByZXR1cm4gdHJhbnNmb3JtZWRTdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0cmFuc2Zvcm1Qb3N0TGlua3MoaW5wdXRTdHJpbmc6IHN0cmluZykge1xuICBjb25zdCBwb3N0TGlua1BhdHRlcm4gPSAvXFxbcG9zdDooXFxkKylcXF0vZztcbiAgbGV0IGluZGV4ID0gMTtcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKHBvc3RMaW5rUGF0dGVybiwgKG1hdGNoLCBwb3N0SWQpID0+IHtcbiAgICByZXR1cm4gYFtbJHtpbmRleCsrfV1dKC9sJHt3aW5kb3cubG9jYXRpb24ucGF0aG5hbWV9LyR7cG9zdElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG4vLyDpu5jorqTnjq/looPphY3nva5cbmV4cG9ydCBjb25zdCBkZWZhdWx0RW52Q29uZmlnOiBFbnZDb25maWdUeXBlID0ge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IE51bWJlcihwcm9jZXNzLmVudi5TQ0hFRFVMRURfSU5URVJWQUwpIHx8IDEyMCxcbiAgQU5BTFlTSVNfVFlQRTogcHJvY2Vzcy5lbnYuQU5BTFlTSVNfVFlQRSB8fCBcImZpbHRlclwiLFxuICBMTE1fVFlQRTogcHJvY2Vzcy5lbnYuTExNX1RZUEUgfHwgXCJkaWZ5XCIsXG4gIEFOQUxZWkVfQllfR1JPVVA6IHByb2Nlc3MuZW52LkFOQUxZWkVfQllfR1JPVVAgPT09IFwidHJ1ZVwiLFxuICBPTExBTUFfQkFTRV9VUkw6IHByb2Nlc3MuZW52Lk9MTEFNQV9CQVNFX1VSTCB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6MTE0MzRcIixcbiAgT0xMQU1BX01PREVMOiBwcm9jZXNzLmVudi5PTExBTUFfTU9ERUwgfHwgXCJkZWVwc2Vlay1yMVwiLFxuICBPTExBTUFfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5PTExBTUFfUkVWSUVXX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBwcm9jZXNzLmVudi5PTExBTUFfUVVFUllfTU9ERUwgfHwgXCJsbGFtYTMuMVwiLFxuICBESUZZX0FQSV9LRVk6IHByb2Nlc3MuZW52LkRJRllfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX1JFVklFV19BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX1JFVklFV19BUElfS0VZIHx8IFwiXCIsXG4gIERJRllfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBPUEVOQUlfQVBJX0tFWTogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVkgfHwgXCJcIixcbiAgT1BFTkFJX01PREVMOiBwcm9jZXNzLmVudi5PUEVOQUlfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBPUEVOQUlfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0JBU0VfVVJMIHx8IFwiXCIsXG4gIEdST1FfQVBJX0tFWTogcHJvY2Vzcy5lbnYuR1JPUV9BUElfS0VZIHx8IFwiXCIsXG4gIEdST1FfTU9ERUw6IHByb2Nlc3MuZW52LkdST1FfTU9ERUwgfHwgXCJcIixcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52LkdST1FfUkVWSUVXX01PREVMIHx8IFwiXCIsXG4gIEJPVF9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52LkJPVF9BUElfQkFTRV9VUkwgfHwgXCJodHRwczovL2JvdG1hbi5pbnQucmNsYWJlbnYuY29tL3YyXCIsXG4gIEJPVF9UT0tFTjogcHJvY2Vzcy5lbnYuQk9UX1RPS0VOIHx8IFwiXCIsXG4gIEJPVF9JRDogcHJvY2Vzcy5lbnYuQk9UX0lEIHx8IFwiNDcwMDM3MjAyMEAzNzQzOTUxMC5ib3QuZ2xpcC5uZXRcIixcbiAgQk9UX1RZUEU6IHByb2Nlc3MuZW52LkJPVF9UWVBFIHx8IFwidXNlclwiLFxuICBURUFNX0lEOiBwcm9jZXNzLmVudi5URUFNX0lEIHx8IFwiXCIsXG4gIEVOQUJMRV9CT1Q6IHByb2Nlc3MuZW52LkVOQUJMRV9CT1QgPT09IFwidHJ1ZVwiLFxuICBMTE1fUkVWSUVXX0JFRk9SRV9TRU5EOiBwcm9jZXNzLmVudi5MTE1fUkVWSUVXX0JFRk9SRV9TRU5EID09PSBcInRydWVcIixcbiAgRU5BQkxFX0NIUk9NQTogcHJvY2Vzcy5lbnYuRU5BQkxFX0NIUk9NQSA9PT0gXCJ0cnVlXCIsXG4gIENIUk9NQV9BUElfVVJMOiBwcm9jZXNzLmVudi5DSFJPTUFfQVBJX1VSTCB8fCBcImh0dHA6Ly9sb2NhbGhvc3Q6ODAwMFwiLFxuICBDSFJPTUFfUE9SVDogTnVtYmVyKHByb2Nlc3MuZW52LkNIUk9NQV9QT1JUKSB8fCA4MDAwLFxuICBDSFJPTUFfQ09MTEVDVElPTl9OQU1FOiBwcm9jZXNzLmVudi5DSFJPTUFfQ09MTEVDVElPTl9OQU1FIHx8IFwiXCIsXG4gIEpJUkFfQkFTRV9VUkw6IHByb2Nlc3MuZW52LkpJUkFfQkFTRV9VUkwgfHwgXCJodHRwczovL2ppcmEucmluZ2NlbnRyYWwuY29tXCIsXG4gIEpJUkFfVVNFUk5BTUU6IHByb2Nlc3MuZW52LkpJUkFfVVNFUk5BTUUgfHwgXCJcIixcbiAgSklSQV9BUElfVE9LRU46IHByb2Nlc3MuZW52LkpJUkFfQVBJX1RPS0VOIHx8IFwiXCIsXG59O1xuXG4vLyDojrflj5bnjq/looPphY3nva7vvIzlpoLmnpzlj6/og73nmoTor53ku44gc3RvcmFnZSDojrflj5bvvIzlkKbliJnku44gcHJvY2Vzcy5lbnYg6I635Y+WXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RW52Q29uZmlnKCk6IFByb21pc2U8RW52Q29uZmlnVHlwZT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgZW52Q29uZmlnIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydlbnZDb25maWcnXSk7XG4gICAgaWYgKGVudkNvbmZpZykge1xuICAgICAgLy8g5bCG5a2Y5YKo55qE6YWN572u5LiO6buY6K6k6YWN572u5ZCI5bm277yM56Gu5L+d5paw5aKe55qE6YWN572u6aG55Lmf5Lya6KKr5YyF5ZCrXG4gICAgICByZXR1cm4geyAuLi5kZWZhdWx0RW52Q29uZmlnLCAuLi5lbnZDb25maWcgfTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign6I635Y+W6YWN572u5aSx6LSlOicsIGVycm9yKTtcbiAgfVxuICBcbiAgLy8g5aaC5p6c6I635Y+W5aSx6LSl5oiW5rKh5pyJ5L+d5a2Y55qE6YWN572u77yM6L+U5Zue6buY6K6k5YC8XG4gIHJldHVybiBkZWZhdWx0RW52Q29uZmlnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckluZm8oKSB7XG4gIGNvbnN0IGFjY291bnRVRCA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2dsb2JhbC5hY2NvdW50LlVEJywgJycpO1xuICBjb25zdCBhY2NvdW50SW5mb0xpc3QgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdnbG9iYWwuYWNjb3VudC5BQ0NPVU5UX1NFU1NJT05fREFUQV9MSVNUJywge30pO1xuXG4gIGNvbnN0IGFjY291bnRJbmZvID0gYWNjb3VudFVEID8gYWNjb3VudEluZm9MaXN0W2FjY291bnRVRF0gOiBhY2NvdW50SW5mb0xpc3QuZmluZCgoaXRlbTphbnkpID0+IGl0ZW0uZGlzcGxheU5hbWUgIT0gJycpO1xuICBjb25zb2xlLmxvZygnYWNjb3VudEluZm9MaXN0JywgYWNjb3VudEluZm9MaXN0LCBhY2NvdW50SW5mbyk7XG4gIGlmIChhY2NvdW50SW5mbykgcmV0dXJuIHtcbiAgICBleHRlbnNpb25JZDogYWNjb3VudEluZm8uZXh0ZW5zaW9uSWQsXG4gICAgZW1haWw6IGFjY291bnRJbmZvLmVtYWlsLFxuICAgIGZ1bGxOYW1lOiBhY2NvdW50SW5mby5kaXNwbGF5TmFtZSxcbiAgICB1c2VybmFtZTogYWNjb3VudEluZm8uZW1haWwgPyBhY2NvdW50SW5mby5lbWFpbC50cmltKCkuc3BsaXQoJ0AnKVswXSA6IGFjY291bnRJbmZvLmRpc3BsYXlOYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSxcbiAgfVxuXG4gIGNvbnN0IHVzZXJJbmZvID0gZ2V0Q3VycmVudFVzZXJJbmZvKCk7XG4gIHJldHVybiB7XG4gICAgZXh0ZW5zaW9uSWQ6IHVzZXJJbmZvLmV4dGVuc2lvbklkLFxuICAgIGZ1bGxOYW1lOiB1c2VySW5mby51c2VybmFtZSxcbiAgICB1c2VybmFtZTogdXNlckluZm8udXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpLFxuICAgIGVtYWlsOiB1c2VySW5mby51c2VybmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJykgKyAnQHJpbmdjZW50cmFsLmNvbSdcbiAgfTtcbn1cblxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgeyBmZXRjaEppcmFUaWNrZXRzIH0gZnJvbSAnLi9qaXJhJztcbmltcG9ydCB7IFNoZWV0IH0gZnJvbSAnLi9zaGVldCc7XG5pbXBvcnQgeyBKaXJhVGlja2V0IH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRFbnZDb25maWcgfSBmcm9tICcuL3V0aWxzJztcblxuLy8gTWFpbiBsaXN0ZW5lclxuY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCfmlLbliLDmtojmga86JywgbWVzc2FnZSwgJ+WPkemAgeiAhTonLCBzZW5kZXIpO1xuXG4gICAgaWYgKCFtZXNzYWdlIHx8ICFtZXNzYWdlLnR5cGUpIHtcbiAgICAgICAgY29uc29sZS53YXJuKCfmlLbliLDml6DmlYjmtojmga/moLzlvI8nKTtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAn5peg5pWI5raI5oGv5qC85byPJyB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgeyB0eXBlIH0gPSBtZXNzYWdlO1xuXG4gICAgaWYgKHR5cGUgPT09ICdPUEVOX0pJUkFfUVVFUllfRElBTE9HJykge1xuICAgICAgICBvcGVuSnFsRGlhbG9nKG1lc3NhZ2UudXJsLCBtZXNzYWdlLnNoZWV0VG9rZW4pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0VYUEFORF9FUElDX1RJQ0tFVFMnKSB7XG4gICAgICAgIGlmICghbWVzc2FnZS51cmwgfHwgIW1lc3NhZ2Uuc2hlZXRUb2tlbikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRVhQQU5EX0VQSUNfVElDS0VUUyDnvLrlsJEgdXJsIOaIliBzaGVldFRva2VuJyk7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeW/heimgeWPguaVsCcsICdlcnJvcicpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAn57y65bCR5b+F6KaB5Y+C5pWwJyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzKG1lc3NhZ2UudXJsLCBtZXNzYWdlLnNoZWV0VG9rZW4pXG4gICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSB9KSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCflpITnkIYgRVhQQU5EX0VQSUNfVElDS0VUUyDml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOWxleW8gCBFcGljIOWksei0pTogJHtlcnJvci5tZXNzYWdlIHx8IGVycm9yfWAsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKSB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfmnKrlpITnkIbnmoTmtojmga/nsbvlnos6JywgdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxuLy8g5Yib5bu6IEpRTCDmn6Xor6Llr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIG9wZW5KcWxEaWFsb2codXJsOiBzdHJpbmcsIHNoZWV0VG9rZW46IHN0cmluZykge1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIHRvcDogNTAlO1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgICAgIHdpZHRoOiA0MDBweDtcbiAgICBgO1xuXG4gICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDtcIj7ovpPlhaUgSlFMIOafpeivojwvaDM+XG4gICAgICAgIDx0ZXh0YXJlYSBpZD1cImpxbFwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwcHg7IG1hcmdpbi1ib3R0b206IDEwcHg7XCIgcGxhY2Vob2xkZXI9XCJmaWx0ZXI9eHh4eFwiPjwvdGV4dGFyZWE+XG4gICAgICAgIDxwIHN0eWxlPVwiZm9udC1zaXplOiAxMnB4OyBjb2xvcjogIzY2NjsgbWFyZ2luLXRvcDogLTVweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj7or7flnKggPGEgaHJlZj1cImh0dHBzOi8vamlyYS5yaW5nY2VudHJhbC5jb20vaXNzdWVzLz9qcWw9XCIgdGFyZ2V0PVwiX2JsYW5rXCI+ZmlsdGVyIOafpeivoumhtemdojwvYT4g6YWN572u6ZyA6KaB5bGV56S655qEIGNvbHVtbnMg5LiU6K6+5Li65YiX6KGo5qih5byP44CCPC9wPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBzcGFjZS1iZXR3ZWVuOyBtYXJnaW4tYm90dG9tOiAxMHB4O1wiPlxuICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInVwZGF0ZUV4aXN0aW5nXCIgc3R5bGU9XCJiYWNrZ3JvdW5kOiAjMjhhNzQ1OyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgcGFkZGluZzogNnB4IDEycHg7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuWIt+aWsCBTaGVldCDkuIogdGlja2V0cyDmlbDmja48L2J1dHRvbj5cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNhbmNlbFwiIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAxMHB4O1wiPuWPlua2iDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzdWJtaXRcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICBgO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaWFsb2cpO1xuXG4gICAgLy8g5re75Yqg5LqL5Lu255uR5ZCs5ZmoXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbmNlbCcpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnMoZGlhbG9nKSkge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJtaXQnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGpxbCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanFsJykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XG4gICAgICAgIGlmIChqcWwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaGFuZGxlRmV0Y2hKaXJhVGlja2V0c1RvU2hlZXQoanFsLCB1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xor6LmiJblpITnkIblpLHotKU6ICcsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+afpeivouaIluWkhOeQhuWksei0pTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+ivt+i+k+WFpSBKUUwg5p+l6K+i6K+t5Y+lJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8g5re75Yqg5pu05paw546w5pyJIHRpY2tldHMg55qE5LqL5Lu255uR5ZCs5ZmoXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VwZGF0ZUV4aXN0aW5nJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoIXNoZWV0VG9rZW4gfHwgIXVybCkge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfnvLrlsJHooajmoLwgVVJMIOaIliB0b2tlbicsICdlcnJvcicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5q2j5Zyo6K+75Y+W6KGo5qC85pWw5o2uLi4uJyk7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICBjb25zdCBzaGVldCA9IG5ldyBTaGVldCh1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgICAgICBjb25zdCBzaGVldEhlYWRlcnMgPSBhd2FpdCBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldCk7XG5cbiAgICAgICAgICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPD0gMSkge1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn6KGo5qC85Li656m65oiW5Y+q5pyJ6KGo5aS0JywgJ3dhcm5pbmcnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOiOt+WPluaJgOacieeOsOacieeahCBKaXJhIGtleXNcbiAgICAgICAgICAgIGNvbnN0IGtleUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLmtleSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkpIDogLTE7XG4gICAgICAgICAgICBpZiAoa2V5Q29sdW1uSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrmib7liLAgSmlyYSBLZXkg5YiXJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ0tleXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICB2YWx1ZXMuc2xpY2UoMSkuZm9yRWFjaCgocm93OiBzdHJpbmdbXSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleUNlbGwgPSByb3dba2V5Q29sdW1uSW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmIChrZXlDZWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0ga2V5Q2VsbC5tYXRjaCgvYnJvd3NlXFwvKFtBLVowLTldKy1bMC05XSspL2kpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0aW5nS2V5cy5wdXNoKG1hdGNoWzFdKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICgvXltBLVowLTldKy1bMC05XSskL2kudGVzdChrZXlDZWxsLnRyaW0oKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0aW5nS2V5cy5wdXNoKGtleUNlbGwudHJpbSgpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdLZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5pyq5om+5Yiw5pyJ5pWI55qEIEppcmEgdGlja2V0cycsICd3YXJuaW5nJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDmnoTlu7ogSlFMIOafpeivolxuICAgICAgICAgICAgY29uc3QganFsID0gYGtleSBpbiAoJHtleGlzdGluZ0tleXMuam9pbignLCcpfSlgO1xuICAgICAgICAgICAgaGFuZGxlRmV0Y2hKaXJhVGlja2V0c1RvU2hlZXQoanFsLCB1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcign5pu05paw546w5pyJIHRpY2tldHMg5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pu05paw5aSx6LSlOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogZXJyb3IpLCAnZXJyb3InKTtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5pbnRlcmZhY2UgSmlyYUhlYWRlcnMge1xuICAgIGtleT86IHN0cmluZztcbiAgICBzdW1tYXJ5Pzogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIGlzc3VldHlwZT86IHN0cmluZztcbiAgICBwcmlvcml0eT86IHN0cmluZztcbiAgICBhc3NpZ25lZT86IHN0cmluZztcbiAgICByZXBvcnRlcj86IHN0cmluZztcbiAgICBsYWJlbHM/OiBzdHJpbmc7XG4gICAgY29tcG9uZW50cz86IHN0cmluZztcbiAgICBmaXhWZXJzaW9ucz86IHN0cmluZztcbiAgICBhZmZlY3RzVmVyc2lvbnM/OiBzdHJpbmc7XG4gICAgbGlua2VkSXNzdWVzPzogc3RyaW5nO1xuICAgIGVwaWNMaW5rPzogc3RyaW5nO1xuICAgIHNwcmludD86IHN0cmluZztcbiAgICBzdG9yeVBvaW50cz86IHN0cmluZztcbiAgICBzdGF0dXM/OiBzdHJpbmc7XG4gICAgW2tleTogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgVXBkYXRlRGF0YSB7XG4gICAgcm93SW5kZXg6IG51bWJlcjtcbiAgICBkYXRhOiBzdHJpbmdbXTtcbn1cblxuaW50ZXJmYWNlIFRpY2tldE9wZXJhdGlvbiB7XG4gICAgdGlja2V0OiBKaXJhVGlja2V0O1xuICAgIHR5cGU6ICd1cGRhdGUnIHwgJ2FwcGVuZCc7XG4gICAgcm93SW5kZXg/OiBudW1iZXI7XG59XG5cbi8vIOafpeaJvuacieaViOeahEppcmHlrZfmrrXooajlpLRcbmFzeW5jIGZ1bmN0aW9uIGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0OiBTaGVldCk6IFByb21pc2U8SmlyYUhlYWRlcnM+IHtcbiAgICB0cnkge1xuICAgICAgICBsZXQgaGVhZGVyTWFwcGluZzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgICAgICBjb25zdCBjdXN0b21GaWVsZE1hcHBpbmc6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWdEYXRhID0gYXdhaXQgc2hlZXQucmVhZENvbmZpZ1NoZWV0KCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29uZmlnRGF0YScsIGNvbmZpZ0RhdGEpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZ0RhdGEgJiYgY29uZmlnRGF0YS5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVySW5kZXggPSBjb25maWdEYXRhWzBdLmZpbmRJbmRleCgoaDogc3RyaW5nKSA9PiBoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3NoZWV0IGNvbHVtbicpKTtcbiAgICAgICAgICAgICAgICBjb25zdCBqaXJhRmllbGRJbmRleCA9IGNvbmZpZ0RhdGFbMF0uZmluZEluZGV4KChoOiBzdHJpbmcpID0+IGgudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnamlyYSBmaWVsZCcpKTtcblxuICAgICAgICAgICAgICAgIGlmIChzaGVldEhlYWRlckluZGV4ID09PSAtMSB8fCBqaXJhRmllbGRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfphY3nva7ooajkuK3mnKrmib7liLAgXCJTaGVldCBIZWFkZXJcIiDmiJYgXCJKaXJhIEZpZWxkXCIg5YiX77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb25maWcgc2hlZXQgaGVhZGVycycpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgY29uZmlnRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBjb25maWdEYXRhW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZiAocm93Lmxlbmd0aCA+IE1hdGgubWF4KHNoZWV0SGVhZGVySW5kZXgsIGppcmFGaWVsZEluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXIgPSByb3dbc2hlZXRIZWFkZXJJbmRleF0/LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGppcmFGaWVsZCA9IHJvd1tqaXJhRmllbGRJbmRleF0/LnRyaW0oKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNoZWV0SGVhZGVyICYmIGppcmFGaWVsZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2ppcmEga2V5JyB8fCBqaXJhRmllbGQudG9Mb3dlckNhc2UoKSA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgamlyYUZpZWxkID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlck1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChqaXJhRmllbGQudG9Mb3dlckNhc2UoKS5zdGFydHNXaXRoKCdjdXN0b21maWVsZF8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21GaWVsZE1hcHBpbmdbc2hlZXRIZWFkZXJdID0gamlyYUZpZWxkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+S7jumFjee9ruihqOWKoOi9veeahOaYoOWwhDonLCBoZWFkZXJNYXBwaW5nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56Gu77yM5bCG5L2/55So6buY6K6k5Yir5ZCNJyk7XG4gICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign6YWN572u6KGo5pWw5o2u5Li656m65oiW5qC85byP5LiN5q2j56GuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+ivu+WPlumFjee9ruihqOWksei0pe+8jOWwhuS9v+eUqOm7mOiupOWtl+auteWIq+WQjTonLCBlcnJvcik7XG4gICAgICAgICAgICBoZWFkZXJNYXBwaW5nID0ge1xuICAgICAgICAgICAgICAgICdrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGtleSc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGxpbmsnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpZCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdpc3N1ZSBrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnc3VtbWFyeSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAndGl0bGUnOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ+amguimgSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAnZGVzY3JpcHRpb24nOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICfmj4/ov7AnOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICd0eXBlJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ2lzc3VlIHR5cGUnOiAnaXNzdWV0eXBlJyxcbiAgICAgICAgICAgICAgICAn57G75Z6LJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ3ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAn5LyY5YWI57qnJzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAnYXNzaWduZWUnOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICfnu4/lip7kuronOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICdyZXBvcnRlcic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ+aKpeWRiuS6uic6ICdyZXBvcnRlcicsXG4gICAgICAgICAgICAgICAgJ3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAgICAgICAgICfnirbmgIEnOiAnc3RhdHVzJyxcbiAgICAgICAgICAgICAgICAnbGFiZWxzJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ2xhYmVsJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ+agh+etvic6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnRzJzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnQnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ+aooeWdlyc6ICdjb21wb25lbnRzJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb25zJzogJ2ZpeFZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAnZml4IHZlcnNpb24nOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICfkv67lpI3niYjmnKwnOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdhZmZlY3RzIHZlcnNpb25zJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2FmZmVjdCB2ZXJzaW9uJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+W9seWTjeeJiOacrCc6ICdhZmZlY3RzVmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdsaW5rZWQgaXNzdWVzJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ+WFs+iBlOmXrumimCc6ICdsaW5rZWRJc3N1ZXMnLFxuICAgICAgICAgICAgICAgICdlcGljIGxpbmsnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICdlcGljJzogJ2VwaWNMaW5rJyxcbiAgICAgICAgICAgICAgICAnc3ByaW50JzogJ3NwcmludCcsXG4gICAgICAgICAgICAgICAgJ+WGsuWIuic6ICdzcHJpbnQnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludHMnOiAnc3RvcnlQb2ludHMnLFxuICAgICAgICAgICAgICAgICdzdG9yeSBwb2ludCc6ICdzdG9yeVBvaW50cycsXG4gICAgICAgICAgICAgICAgJ+aVheS6i+eCuSc6ICdzdG9yeVBvaW50cydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoZWFkZXJzID0gYXdhaXQgc2hlZXQuZ2V0SGVhZGVycygpO1xuICAgICAgICBjb25zb2xlLmxvZygnU2hlZXQgSGVhZGVyczonLCBoZWFkZXJzKTtcbiAgICAgICAgY29uc3QgdmFsaWRIZWFkZXJzOiBKaXJhSGVhZGVycyA9IHt9O1xuXG4gICAgICAgIGNvbnN0IGtub3duRmllbGRzID0gW1xuICAgICAgICAgICAgJ2tleScsICdzdW1tYXJ5JywgJ2Rlc2NyaXB0aW9uJywgJ2lzc3VldHlwZScsICdwcmlvcml0eScsIFxuICAgICAgICAgICAgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJywgJ3N0YXR1cycsICdsYWJlbHMnLCAnY29tcG9uZW50cycsIFxuICAgICAgICAgICAgJ2ZpeFZlcnNpb25zJywgJ2FmZmVjdHNWZXJzaW9ucycsICdsaW5rZWRJc3N1ZXMnLCAnZXBpY0xpbmsnLCBcbiAgICAgICAgICAgICdzcHJpbnQnLCAnc3RvcnlQb2ludHMnXG4gICAgICAgIF07XG5cbiAgICAgICAgaGVhZGVycy5mb3JFYWNoKChoZWFkZXI6IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKCFoZWFkZXIpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckxvd2VyID0gaGVhZGVyLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZGV4KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdKSB7XG4gICAgICAgICAgICAgICAgIGNvbnN0IGppcmFGaWVsZCA9IGhlYWRlck1hcHBpbmdbaGVhZGVyTG93ZXJdO1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tqaXJhRmllbGRdKSB7XG4gICAgICAgICAgICAgICAgICAgICB2YWxpZEhlYWRlcnNbamlyYUZpZWxkXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDphY3nva4v5Yir5ZCN5Yy56YWNOiBcIiR7aGVhZGVyfVwiIC0+IFwiJHtqaXJhRmllbGR9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDliJcgJHtjb2x1bW5MZXR0ZXJ9IChcIiR7aGVhZGVyfVwiKSDnmoTliKvlkI0gXCIke2hlYWRlckxvd2VyfVwiIOS4juWIlyAke3ZhbGlkSGVhZGVyc1tqaXJhRmllbGRdfSDlhrLnqoHvvIzpg73mjIflkJEgXCIke2ppcmFGaWVsZH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGlyZWN0TWF0Y2ggPSBrbm93bkZpZWxkcy5maW5kKGZpZWxkID0+IGZpZWxkLnRvTG93ZXJDYXNlKCkgPT09IGhlYWRlckxvd2VyKTtcbiAgICAgICAgICAgIGlmIChkaXJlY3RNYXRjaCkge1xuICAgICAgICAgICAgICAgICBpZiAoIXZhbGlkSGVhZGVyc1tkaXJlY3RNYXRjaF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOebtOaOpeWtl+auteWQjeWMuemFjTogXCIke2hlYWRlcn1cIiAtPiBcIiR7ZGlyZWN0TWF0Y2h9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihg5YiXICR7Y29sdW1uTGV0dGVyfSAoXCIke2hlYWRlcn1cIikg55qE55u05o6l5Yy56YWN5LiO5YiXICR7dmFsaWRIZWFkZXJzW2RpcmVjdE1hdGNoXX0g5Yay56qB77yM6YO95oyH5ZCRIFwiJHtkaXJlY3RNYXRjaH1cIuOAguWwhuS9v+eUqOesrOS4gOS4quWMuemFjeOAgmApO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCF2YWxpZEhlYWRlcnMua2V5KSB7XG4gICAgICAgICAgICAgY29uc29sZS53YXJuKFwi5pyq6IO96Ieq5Yqo5pig5bCEICdrZXknIOWIl+OAguivt+ajgOafpeihqOWktOaIluWcqOmFjee9ruihqOS4reaYjuehruaMh+WumiAna2V5JyDmiJYgJ0ppcmEgS2V5J+OAglwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKCfmnIDnu4jmnInmlYjooajlpLTmmKDlsIQ6JywgdmFsaWRIZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIHZhbGlkSGVhZGVycztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xmib7mnInmlYggSmlyYSDmoIfpopjml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICBzaG93VG9hc3QoJ+afpeaJvuihqOWktOaYoOWwhOaXtuWHuumUmTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJylcbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb2x1bW5JbmRleChjb2x1bW46IHN0cmluZyk6IG51bWJlciB7XG4gICAgaWYgKCFjb2x1bW4gfHwgdHlwZW9mIGNvbHVtbiAhPT0gJ3N0cmluZycgfHwgIS9eW0EtWl0rJC8udGVzdChjb2x1bW4udG9VcHBlckNhc2UoKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDml6DmlYjnmoTliJfmoIfor4bnrKY6IFwiJHtjb2x1bW59XCJgKTtcbiAgICB9XG4gICAgY29uc3QgdXBwZXJDb2x1bW4gPSBjb2x1bW4udG9VcHBlckNhc2UoKTtcbiAgICBsZXQgaW5kZXggPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXBwZXJDb2x1bW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaW5kZXggPSBpbmRleCAqIDI2ICsgKHVwcGVyQ29sdW1uLmNoYXJDb2RlQXQoaSkgLSA2NCk7XG4gICAgfVxuICAgIHJldHVybiBpbmRleCAtIDE7XG59XG5cbmZ1bmN0aW9uIGdldE1heENvbHVtbkluZGV4KGNvbHVtbkxldHRlcnM6IHN0cmluZ1tdKTogbnVtYmVyIHtcbiAgICAgaWYgKCFjb2x1bW5MZXR0ZXJzIHx8ICFBcnJheS5pc0FycmF5KGNvbHVtbkxldHRlcnMpIHx8IGNvbHVtbkxldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICByZXR1cm4gMDtcbiAgICAgfVxuICAgICBjb25zdCB2YWxpZExldHRlcnMgPSBjb2x1bW5MZXR0ZXJzLmZpbHRlcihoID0+IHR5cGVvZiBoID09PSAnc3RyaW5nJyAmJiAvXltBLVpdKyQvLnRlc3QoaC50b1VwcGVyQ2FzZSgpKSk7XG4gICAgIGlmICh2YWxpZExldHRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICAgY29uc3QgaW5kaWNlcyA9IHZhbGlkTGV0dGVycy5tYXAoY29sID0+IGdldENvbHVtbkluZGV4KGNvbCkpO1xuICAgICByZXR1cm4gTWF0aC5tYXgoLi4uaW5kaWNlcykgKyAxO1xufVxuXG4vLyDmmL7npLrnoa7orqTlvLnnqpdcbmFzeW5jIGZ1bmN0aW9uIHNob3dDb25maXJtYXRpb25EaWFsb2coXG4gICAgb3BlcmF0aW9uczogVGlja2V0T3BlcmF0aW9uW10sXG4gICAgZGlzcGxheUhlYWRlcnM6IHN0cmluZ1tdLFxuICAgIHNoZWV0SGVhZGVyczogSmlyYUhlYWRlcnNcbik6IFByb21pc2U8VGlja2V0T3BlcmF0aW9uW10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRpYWxvZy5pZCA9ICdqaXJhQ29uZmlybWF0aW9uRGlhbG9nJztcbiAgICAgICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgICAgIHdpZHRoOiA4MDBweDtcbiAgICAgICAgICAgIG1heC13aWR0aDogOTB2dztcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDgwdmg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgYDtcblxuICAgICAgICBjb25zdCBjb2x1bW5zVG9VcGRhdGUgPSBkaXNwbGF5SGVhZGVyc1xuICAgICAgICAgICAgLmZpbHRlcihmaWVsZCA9PiBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYUhlYWRlcnNdKVxuICAgICAgICAgICAgLm1hcChmaWVsZCA9PiBmaWVsZCk7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ291bnQgPSBvcGVyYXRpb25zLmZpbHRlcihvcCA9PiBvcC50eXBlID09PSAndXBkYXRlJykubGVuZ3RoO1xuICAgICAgICBjb25zdCBhcHBlbmRDb3VudCA9IG9wZXJhdGlvbnMuZmlsdGVyKG9wID0+IG9wLnR5cGUgPT09ICdhcHBlbmQnKS5sZW5ndGg7XG5cbiAgICAgICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZsZXgtc2hyaW5rOiAwO1wiPuehruiupOaVsOaNruaTjeS9nDwvaDM+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTVweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+5bCG6KaB5pON5L2c55qE5YiX77yaPC9zdHJvbmc+IFxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPiR7Y29sdW1uc1RvVXBkYXRlLmpvaW4oJywgJyl9PC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzY2NjtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mm7TmlrDnjrDmnInmlbDmja7vvJoke3VwZGF0ZUNvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj7mlrDlop7mlbDmja7vvJoke2FwcGVuZENvdW50fSDmnaE8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cInNlbGVjdEFsbFRpY2tldHNcIiBjaGVja2VkIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiA1cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIOWFqOmAiS/lj5bmtojlhajpgIlcbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXgtZ3JvdzogMTsgb3ZlcmZsb3cteTogYXV0bzsgYm9yZGVyOiAxcHggc29saWQgI2VlZTsgYm9yZGVyLXJhZGl1czogNHB4OyBtYXJnaW4tYm90dG9tOiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1wiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQgc3R5bGU9XCJwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IGJhY2tncm91bmQ6ICNmNWY1ZjU7IHotaW5kZXg6IDE7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyB3aWR0aDogNTBweDtcIj7pgInmi6k8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDgwcHg7XCI+5pON5L2cPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2Rpc3BsYXlIZWFkZXJzLm1hcChoZWFkZXIgPT4gYDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj4ke2hlYWRlcn08L3RoPmApLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICAgICAgJHtvcGVyYXRpb25zLm1hcCgob3AsIGluZGV4KSA9PiBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNlZWU7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cInRpY2tldC1jaGVja2JveFwiIGRhdGEtaW5kZXg9XCIke2luZGV4fVwiIGNoZWNrZWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICR7b3AudHlwZSA9PT0gJ3VwZGF0ZScgPyAnI2YwYWQ0ZScgOiAnIzVjYjg1Yyd9OyBmb250LXdlaWdodDogYm9sZDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke29wLnR5cGUgPT09ICd1cGRhdGUnID8gJ+abtOaWsCcgOiAn5paw5aKeJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtkaXNwbGF5SGVhZGVycy5tYXAoZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHZhbHVlID0gb3AudGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA+IDEwMCkgdmFsdWUgPSB2YWx1ZS5zdWJzdHJpbmcoMCwgOTcpICsgJy4uLic7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHdoaXRlLXNwYWNlOiBub3dyYXA7IG92ZXJmbG93OiBoaWRkZW47IHRleHQtb3ZlcmZsb3c6IGVsbGlwc2lzOyBtYXgtd2lkdGg6IDIwMHB4O1wiIHRpdGxlPVwiJHtvcC50aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyd9XCI+JHt2YWx1ZX08L3RkPmA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDsgZ2FwOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogI2VlZTsgYm9yZGVyOiAxcHggc29saWQgI2NjYzsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNvbmZpcm1PcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjMDA3YmZmOyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+56Gu6K6kICgke29wZXJhdGlvbnMubGVuZ3RofSk8L2J1dHRvbj4gXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0QWxsQ2hlY2tib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VsZWN0QWxsVGlja2V0cycpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHRpY2tldENoZWNrYm94ZXMgPSBkaWFsb2cuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgndGlja2V0LWNoZWNrYm94JykgYXMgSFRNTENvbGxlY3Rpb25PZjxIVE1MSW5wdXRFbGVtZW50PjtcbiAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtT3BlcmF0aW9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50ID0gKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRDb3VudCA9IEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZmlsdGVyKGNiID0+IGNiLmNoZWNrZWQpLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSBg56Gu6K6kICgke3NlbGVjdGVkQ291bnR9KWA7XG4gICAgICAgICAgICBjb25maXJtQnV0dG9uLmRpc2FibGVkID0gc2VsZWN0ZWRDb3VudCA9PT0gMDtcbiAgICAgICAgfTtcblxuICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNoZWNrZWQgPSBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgIGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkID0gQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5ldmVyeShjYiA9PiBjYi5jaGVja2VkKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsT3BlcmF0aW9uJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbmZpcm1CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZE9wZXJhdGlvbnMgPSBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjaGVja2JveCA9PiBjaGVja2JveC5jaGVja2VkKVxuICAgICAgICAgICAgICAgIC5tYXAoY2hlY2tib3ggPT4gb3BlcmF0aW9uc1twYXJzZUludChjaGVja2JveC5kYXRhc2V0LmluZGV4IHx8ICcwJyldKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShzZWxlY3RlZE9wZXJhdGlvbnMpO1xuICAgICAgICB9KTtcblxuICAgICAgICB1cGRhdGVDb25maXJtQnV0dG9uQ291bnQoKTsgXG4gICAgfSk7XG59XG5cbi8vIOa3u+WKoOaYvuekuiB0b2FzdCDnmoTlh73mlbBcbmZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGUgPSAnaW5mbycpIHtcbiAgICBjb25zdCBleGlzdGluZ1RvYXN0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYC5qaXJhLXRvYXN0LSR7dHlwZX1gKTtcbiAgICBleGlzdGluZ1RvYXN0cy5mb3JFYWNoKHQgPT4gdC5yZW1vdmUoKSk7XG5cbiAgICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRvYXN0LmNsYXNzTmFtZSA9IGBqaXJhLXRvYXN0LSR7dHlwZX1gO1xuICAgIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICBsZXQgYmFja2dyb3VuZENvbG9yID0gJ3JnYmEoMCwgMCwgMCwgMC43KSc7XG4gICAgaWYgKHR5cGUgPT09ICdlcnJvcicpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDIyMCwgNTMsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnc3VjY2VzcycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDQwLCAxNjcsIDY5LCAwLjkpJztcbiAgICBlbHNlIGlmICh0eXBlID09PSAnd2FybmluZycpIGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDI1NSwgMTkzLCA3LCAwLjkpJztcblxuICAgIHRvYXN0LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogJHtiYWNrZ3JvdW5kQ29sb3J9O1xuICAgICAgICBjb2xvcjogJHt0eXBlID09PSAnd2FybmluZycgPyAnYmxhY2snIDogJ3doaXRlJ307XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCA1cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gICAgYDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgIH0pO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgICAgICB9LCAzMDApO1xuICAgIH0sIDMwMDApO1xufVxuXG4vLyDku44gSmlyYSDmn6Xor6IgdGlja2V0cyDlubbmm7TmlrDliLAgR29vZ2xlIFNoZWV0XG5hc3luYyBmdW5jdGlvbiBoYW5kbGVGZXRjaEppcmFUaWNrZXRzVG9TaGVldChqcWw6IHN0cmluZywgc2hlZXRVcmw6IHN0cmluZywgc2hlZXRUb2tlbjogc3RyaW5nKSB7XG4gICAgc2hvd1RvYXN0KCfmraPlnKjmn6Xor6IgSmlyYS4uLicpO1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IHRpY2tldHMgPSBhd2FpdCBmZXRjaEppcmFUaWNrZXRzKGpxbCk7XG4gICAgY29uc29sZS5sb2coJ3RpY2tldHMnLCB0aWNrZXRzKTtcbiAgICBpZiAoIXRpY2tldHMubGVuZ3RoKSB7XG4gICAgICAgIHNob3dUb2FzdCgn5rKh5pyJ5om+5Yiw5pWw5o2uJywgJ3dhcm5pbmcnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIXNoZWV0VG9rZW4pIHtcbiAgICAgICAgLy8g5Ymq5YiH5p2/5qih5byPXG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICBjb25zdCBmb3JtYXR0ZWREYXRhID0gW2hlYWRlcnMuam9pbignXFx0JyksIC4uLnRpY2tldHMubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAga2V5OiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWBcbiAgICAgICAgICAgIH0pKS5tYXAodGlja2V0ID0+IGhlYWRlcnMubWFwKGZpZWxkID0+IHRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJykuam9pbignXFx0JykpXS5qb2luKCdcXG4nKTtcbiAgICAgICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoZm9ybWF0dGVkRGF0YSk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdmb3JtYXR0ZWREYXRhJywgZm9ybWF0dGVkRGF0YSk7XG4gICAgICAgIHNob3dUb2FzdCgnSmlyYSDmlbDmja7lt7LlpI3liLbliLDliarotLTmnb8nLCAnc3VjY2VzcycpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIOaOpeWPo+aooeW8j1xuICAgICAgICBpZiAoIXNoZWV0VXJsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCLnvLrlsJHooajmoLwgVVJMXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2hlZXQgPSBuZXcgU2hlZXQoc2hlZXRVcmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygndmFsdWVzJywgdmFsdWVzKTtcbiAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVycyA9IGF3YWl0IGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0KTtcbiAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlIZWFkZXJzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTsgXG5cbiAgICAgICAgICAgIGNvbnN0IGtleUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLmtleSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkpIDogLTE7XG4gICAgICAgICAgICBpZiAoa2V5Q29sdW1uSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5mZXJyZWRLZXlJbmRleCA9IHZhbHVlc1swXT8uZmluZEluZGV4KChoZWFkZXI6IHN0cmluZykgPT4gaGVhZGVyLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2tleScpIHx8IGhlYWRlci50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdqaXJhJykpO1xuICAgICAgICAgICAgICAgIGlmIChpbmZlcnJlZEtleUluZGV4ICE9PSAtMSAmJiBpbmZlcnJlZEtleUluZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hlZXRIZWFkZXJzLmtleSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoNjUgKyBpbmZlcnJlZEtleUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGDmnKrlnKjphY3nva7kuK3mib7liLAgS2V5IOWIl++8jOW3suaOqOaWreS4uuWIlyAke3NoZWV0SGVhZGVycy5rZXl9YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfmnKrmib7liLDmiJbml6Dms5Xmjqjmlq0gSmlyYSBLZXkg5YiX77yM6K+35qOA5p+l6KGo5aS05oiW6YWN572uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBrZXlUb1Jvd01hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgICAgICB2YWx1ZXMuc2xpY2UoMSkuZm9yRWFjaCgocm93OiBzdHJpbmdbXSwgaW5kZXg6IG51bWJlcikgPT4geyBcbiAgICAgICAgICAgICAgICBjb25zdCBrZXlDZWxsID0gcm93W2dldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkhKV07XG4gICAgICAgICAgICAgICAgICAgIGxldCBrZXkgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGtleUNlbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoID0ga2V5Q2VsbC5tYXRjaCgvYnJvd3NlXFwvKFtBLVowLTldKy1bMC05XSspL2kpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoICYmIG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0gbWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKC9eW0EtWjAtOV0rLVswLTldKyQvaS50ZXN0KGtleUNlbGwudHJpbSgpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleSA9IGtleUNlbGwudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGtleSkge1xuICAgICAgICAgICAgICAgICAgICBrZXlUb1Jvd01hcC5zZXQoa2V5LCBpbmRleCArIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBvcGVyYXRpb25zOiBUaWNrZXRPcGVyYXRpb25bXSA9IHRpY2tldHMubWFwKHRpY2tldCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdSb3dJbmRleCA9IGtleVRvUm93TWFwLmdldCh0aWNrZXQua2V5KTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICB0aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGV4aXN0aW5nUm93SW5kZXggIT09IHVuZGVmaW5lZCA/ICd1cGRhdGUnIDogJ2FwcGVuZCcsXG4gICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBleGlzdGluZ1Jvd0luZGV4XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBjb25maXJtZWRPcGVyYXRpb25zID0gYXdhaXQgc2hvd0NvbmZpcm1hdGlvbkRpYWxvZyhvcGVyYXRpb25zLCBkaXNwbGF5SGVhZGVycywgc2hlZXRIZWFkZXJzKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvbmZpcm1lZE9wZXJhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmk43kvZzlt7Llj5bmtognKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlc0RhdGE6IFVwZGF0ZURhdGFbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgYXBwZW5kRGF0YTogc3RyaW5nW11bXSA9IFtdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlclZhbHVlcyA9IE9iamVjdC52YWx1ZXMoc2hlZXRIZWFkZXJzKS5maWx0ZXIoKHZhbHVlKTogdmFsdWUgaXMgc3RyaW5nID0+IFxuICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1heENvbEluZGV4ID0gZ2V0TWF4Q29sdW1uSW5kZXgoaGVhZGVyVmFsdWVzKTtcblxuICAgICAgICAgICAgY29uZmlybWVkT3BlcmF0aW9ucy5mb3JFYWNoKG9wZXJhdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gbmV3IEFycmF5KG1heENvbEluZGV4KS5maWxsKCcnKTtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhvcGVyYXRpb24udGlja2V0KS5mb3JFYWNoKHRpY2tldEtleSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbHVtbkxldHRlciA9IChzaGVldEhlYWRlcnMgYXMgUmVjb3JkPHN0cmluZywgc3RyaW5nPilbdGlja2V0S2V5XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbHVtbkxldHRlciAmJiB0eXBlb2YgY29sdW1uTGV0dGVyID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xJbmRleCA9IGdldENvbHVtbkluZGV4KGNvbHVtbkxldHRlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRpY2tldEtleSA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IGA9SFlQRVJMSU5LKFwiJHtlbnZDb25maWcuSklSQV9CQVNFX1VSTH0vYnJvd3NlLyR7b3BlcmF0aW9uLnRpY2tldC5rZXl9XCIsIFwiJHtvcGVyYXRpb24udGlja2V0LmtleX1cIilgO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSAob3BlcmF0aW9uLnRpY2tldCBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KVt0aWNrZXRLZXldIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihg5aSE55CG5YiXICR7Y29sdW1uTGV0dGVyfSAo5a2X5q61ICR7dGlja2V0S2V5fSkg5pe25Ye66ZSZOmAsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9wZXJhdGlvbi50eXBlID09PSAndXBkYXRlJyAmJiBvcGVyYXRpb24ucm93SW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBvcGVyYXRpb24ucm93SW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiByb3dcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXBwZW5kRGF0YS5wdXNoKHJvdyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCfmm7TmlrDmlbDmja46JywgdXBkYXRlc0RhdGEpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ+i/veWKoOaVsOaNrjonLCBhcHBlbmREYXRhKTtcblxuICAgICAgICAgICAgbGV0IHVwZGF0ZWRDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgYXBwZW5kZWRDb3VudCA9IDA7XG5cbiAgICAgICAgICAgIGlmICh1cGRhdGVzRGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGUgb2YgdXBkYXRlc0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRDb2x1bW4gPSAnQSc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhbmdlID0gYCR7c3RhcnRDb2x1bW59JHt1cGRhdGUucm93SW5kZXgrMX1gOyBcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0aW5nIHJhbmdlOiAke3JhbmdlfWAsIHVwZGF0ZS5kYXRhKVxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC53cml0ZVNoZWV0KFt1cGRhdGUuZGF0YV0sIHJhbmdlKTtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlZENvdW50Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXBwZW5kRGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhcnRQb3NpdGlvbiA9IGBBJHt2YWx1ZXMubGVuZ3RoICsgMX1gO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBBcHBlbmRpbmcgZGF0YSBzdGFydGluZyBmcm9tOiAke3N0YXJ0UG9zaXRpb259YCwgYXBwZW5kRGF0YSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChhcHBlbmREYXRhLCBzdGFydFBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICBhcHBlbmRlZENvdW50ID0gYXBwZW5kRGF0YS5sZW5ndGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB0b2FzdE1lc3NhZ2UgPSAnJztcbiAgICAgICAgICAgIGlmICh1cGRhdGVkQ291bnQgPiAwKSB0b2FzdE1lc3NhZ2UgKz0gYOW3suabtOaWsCAke3VwZGF0ZWRDb3VudH0g5p2h5pWw5o2u44CCYDtcbiAgICAgICAgICAgIGlmIChhcHBlbmRlZENvdW50ID4gMCkgdG9hc3RNZXNzYWdlICs9IGDlt7Lov73liqAgJHthcHBlbmRlZENvdW50fSDmnaHmlrDmlbDmja7jgIJgO1xuICAgICAgICAgICAgaWYgKHRvYXN0TWVzc2FnZSA9PT0gJycpIHRvYXN0TWVzc2FnZSA9ICfmsqHmnInpnIDopoHmm7TmlrDmiJbov73liqDnmoTmlbDmja7jgIInO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBzaG93VG9hc3QodG9hc3RNZXNzYWdlLnRyaW0oKSwgJ3N1Y2Nlc3MnKTtcblxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignR29vZ2xlIFNoZWV0cyDmk43kvZzlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICAgICAgc2hvd1RvYXN0KCdHb29nbGUgU2hlZXRzIOaTjeS9nOWksei0pTogJyArIChlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGVycm9yKSwgJ2Vycm9yJyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8vIOaWsOWinu+8muWkhOeQhuWxleW8gCBFcGljIFRpY2tldHMg55qE5Ye95pWwXG5hc3luYyBmdW5jdGlvbiBoYW5kbGVFeHBhbmRFcGljVGlja2V0cyhzaGVldFVybDogc3RyaW5nLCB0b2tlbjogc3RyaW5nKSB7XG4gICAgc2hvd1RvYXN0KCflvIDlp4vmn6Xmib4gRXBpYyDlubbojrflj5blrZDku7vliqEuLi4nKTtcbiAgICBjb25zdCBlbnZDb25maWcgPSBhd2FpdCBnZXRFbnZDb25maWcoKTtcbiAgICBjb25zdCBzaGVldCA9IG5ldyBTaGVldChzaGVldFVybCwgdG9rZW4pO1xuICAgIFxuICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNoZWV0LmluaXQoKTtcbiAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn6KGo5qC85Li656m65oiW5peg5rOV6K+75Y+WJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXJzID0gYXdhaXQgZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQpO1xuXG4gICAgICAgIC8vIOaJvuWIsCBrZXkg5YiX55qE57Si5byVXG4gICAgICAgIGNvbnN0IGtleUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLmtleSA/IGdldENvbHVtbkluZGV4KHNoZWV0SGVhZGVycy5rZXkpIDogLTE7XG4gICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcign5pyq5om+5YiwIEppcmEgS2V5IOWIl++8jOivt+ajgOafpeihqOWktOaIlumFjee9ricpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnNvbGUubG9nKCdKaXJhIEtleSDliJfntKLlvJU6Jywga2V5Q29sdW1uSW5kZXgpO1xuXG4gICAgICAgIGNvbnN0IGVwaWNzVG9FeHBhbmQ6IHsgZXBpY0tleTogc3RyaW5nOyBlcGljU3VtbWFyeTogc3RyaW5nOyByb3dJbmRleDogbnVtYmVyOyBzdWJUaWNrZXRzOiBKaXJhVGlja2V0W10gfVtdID0gW107XG5cbiAgICAgICAgLy8g6YGN5Y6G6KGo5qC85p+l5om+IEVwaWMgS2V5IOW5tuafpeivouWtkOS7u+WKoVxuICAgICAgICAvLyDku47nrKzkuozooYzlvIDlp4vvvIzot7Pov4fooajlpLRcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJvdyA9IHZhbHVlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGtleUNlbGxDb250ZW50ID0gcm93W2tleUNvbHVtbkluZGV4XTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5bCd6K+V5LuOIEhZUEVSTElOSyDmiJbnuq/mlofmnKzkuK3mj5Dlj5Yga2V5XG4gICAgICAgICAgICBsZXQgZXBpY0tleSA9ICcnO1xuICAgICAgICAgICAgaWYgKGtleUNlbGxDb250ZW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBrZXlDZWxsQ29udGVudC5tYXRjaCgvYnJvd3NlXFwvKFtBLVowLTldKy1bMC05XSspL2kpOyAvLyDmj5Dlj5YgYnJvd3NlLyDlkI7pnaLnmoQgS2V5XG4gICAgICAgICAgICAgICAgIGlmIChtYXRjaCAmJiBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICAgZXBpY0tleSA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKC9eW0EtWjAtOV0rLVswLTldKyQvaS50ZXN0KGtleUNlbGxDb250ZW50LnRyaW0oKSkpIHsgLy8g5aaC5p6c5piv57qvIEtleVxuICAgICAgICAgICAgICAgICAgICBlcGljS2V5ID0ga2V5Q2VsbENvbnRlbnQudHJpbSgpO1xuICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgaWYgKGVwaWNLZXkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5om+5YiwIEtleTogJHtlcGljS2V5fSDlnKjooYwgJHtpICsgMX1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCBqcWwgPSBgaXNzdWVGdW5jdGlvbiBpbiBpc3N1ZXNJbkVwaWNzKFwia2V5ID0gJHtlcGljS2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViVGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1YlRpY2tldHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEVwaWMgJHtlcGljS2V5fSDmnIkgJHtzdWJUaWNrZXRzLmxlbmd0aH0g5Liq5a2Q5Lu75YqhYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDlsJ3or5Xojrflj5YgRXBpYyDnmoTmpoLopoHkv6Hmga/vvIjlpoLmnpzlhbbku5bliJflrZjlnKjvvIlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1bW1hcnlDb2x1bW5JbmRleCA9IHNoZWV0SGVhZGVycy5zdW1tYXJ5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLnN1bW1hcnkpIDogLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlcGljU3VtbWFyeSA9IHN1bW1hcnlDb2x1bW5JbmRleCAhPT0gLTEgJiYgcm93W3N1bW1hcnlDb2x1bW5JbmRleF0gPyByb3dbc3VtbWFyeUNvbHVtbkluZGV4XSA6IGVwaWNLZXk7IC8vIERlZmF1bHQgdG8ga2V5IGlmIHN1bW1hcnkgbWlzc2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBlcGljc1RvRXhwYW5kLnB1c2goeyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcGljS2V5LCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcGljU3VtbWFyeTogZXBpY1N1bW1hcnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SW5kZXg6IGksIC8vIDAtYmFzZWQgaW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJUaWNrZXRzIFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEVwaWMgJHtlcGljS2V5fSDmsqHmnInlrZDku7vliqHmiJbkuI3mmK8gRXBpY2ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZmV0Y2hFcnJvcjogRXJyb3IgfCBhbnkpIHsgLy8gU3BlY2lmeSB0eXBlIGZvciBmZXRjaEVycm9yXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYOafpeivoiBFcGljICR7ZXBpY0tleX0g55qE5a2Q5Lu75Yqh5aSx6LSlOmAsIGZldGNoRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAvLyDpgInmi6nmgKflnLDpgJrnn6XnlKjmiLfmiJbnu6fnu63lpITnkIbkuIvkuIDkuKpcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDmn6Xor6IgJHtlcGljS2V5fSDlrZDku7vliqHlpLHotKU6ICR7ZmV0Y2hFcnJvci5tZXNzYWdlIHx8IGZldGNoRXJyb3J9YCwgJ2Vycm9yJyk7IC8vIFNob3cgZXJyb3IgbWVzc2FnZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYOihjCAke2kgKyAxfSDmnKrmib7liLDmnInmlYjnmoQgS2V5YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXBpY3NUb0V4cGFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pyq5om+5Yiw5Lu75L2V5YyF5ZCr5a2Q5Lu75Yqh55qEIEVwaWMnLCAnaW5mbycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2hvd1RvYXN0KGDmib7liLAgJHtlcGljc1RvRXhwYW5kLmxlbmd0aH0g5LiqIEVwaWMg5YyF5ZCr5a2Q5Lu75Yqh77yM5YeG5aSH56Gu6K6k5pON5L2cLi4uYCk7XG5cbiAgICAgICAgLy8gLS0tIOS4i+S4gOatpTog5L+u5pS556Gu6K6k5a+56K+d5qGG5bm25aSE55CG5o+S5YWlL+WIhue7hCAtLS1cbiAgICAgICAgY29uc29sZS5sb2coJ+WHhuWkh+ehruiupOeahCBFcGljczonLCBlcGljc1RvRXhwYW5kKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNvbmZpcm1lZEVwaWNzID0gYXdhaXQgc2hvd0VwaWNDb25maXJtYXRpb25EaWFsb2coZXBpY3NUb0V4cGFuZCk7XG4gICAgICAgIFxuICAgICAgICBpZiAoY29uZmlybWVkRXBpY3MgJiYgY29uZmlybWVkRXBpY3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgaW5zZXJ0U3ViVGlja2V0cyhzaGVldCwgY29uZmlybWVkRXBpY3MsIHNoZWV0SGVhZGVycywgZW52Q29uZmlnLkpJUkFfQkFTRV9VUkwpO1xuICAgICAgICAgICAgc2hvd1RvYXN0KGDlt7LmiJDlip/lsZXlvIAgJHtjb25maXJtZWRFcGljcy5sZW5ndGh9IOS4qiBFcGljIOeahOWtkOS7u+WKoWAsICdzdWNjZXNzJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+aTjeS9nOW3suWPlua2iCcsICdpbmZvJyk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOS4tOaXtuWNoOS9jeespu+8jOihqOekuua1geeoi+i/m+ihjOWIsOi/memHjFxuICAgICAgICBzaG93VG9hc3QoJ+WtkOS7u+WKoeafpeaJvuWujOaIkO+8jOehruiupOOAgeaPkuWFpeWSjOWIhue7hOWKn+iDveW+heWunueOsCcsICd3YXJuaW5nJyk7XG5cblxuICAgIH0gY2F0Y2ggKGVycm9yOiBFcnJvciB8IGFueSkgeyAvLyBTcGVjaWZ5IHR5cGUgZm9yIGVycm9yXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+WkhOeQhiBFcGljIOWxleW8gOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgIHNob3dUb2FzdCgn5aSE55CGIEVwaWMg5bGV5byA5pe25Ye66ZSZOiAnICsgKGVycm9yLm1lc3NhZ2UgfHwgZXJyb3IpLCAnZXJyb3InKTsgLy8gVXNlIGVycm9yLm1lc3NhZ2UgaWYgYXZhaWxhYmxlXG4gICAgICAgIHRocm93IGVycm9yOyAvLyBSZS10aHJvdyBlcnJvciB0byBiZSBjYXVnaHQgYnkgdGhlIGNhbGxlclxuICAgIH1cbn1cblxuLy8gRXBpYyDnoa7orqTlr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIHNob3dFcGljQ29uZmlybWF0aW9uRGlhbG9nKFxuICAgIGVwaWNzOiB7IGVwaWNLZXk6IHN0cmluZzsgZXBpY1N1bW1hcnk6IHN0cmluZzsgcm93SW5kZXg6IG51bWJlcjsgc3ViVGlja2V0czogSmlyYVRpY2tldFtdIH1bXVxuKTogUHJvbWlzZTx0eXBlb2YgZXBpY3M+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICAgICAgei1pbmRleDogMTAwMDE7XG4gICAgICAgICAgICB3aWR0aDogODAwcHg7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDkwdnc7XG4gICAgICAgICAgICBtYXgtaGVpZ2h0OiA4MHZoO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgIGA7XG5cbiAgICAgICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IGZsZXgtc2hyaW5rOiAwO1wiPuehruiupOWxleW8gCBFcGljPC9oMz5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxNXB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6ICM2NjY7XCI+XG4gICAgICAgICAgICAgICAgICAgIOaJvuWIsCAke2VwaWNzLmxlbmd0aH0g5Liq5YyF5ZCr5a2Q5Lu75Yqh55qEIEVwaWNcbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBjZW50ZXI7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cInNlbGVjdEFsbEVwaWNzXCIgY2hlY2tlZCBzdHlsZT1cIm1hcmdpbi1yaWdodDogNXB4O1wiPlxuICAgICAgICAgICAgICAgICAgICDlhajpgIkv5Y+W5raI5YWo6YCJXG4gICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImZsZXgtZ3JvdzogMTsgb3ZlcmZsb3cteTogYXV0bzsgYm9yZGVyOiAxcHggc29saWQgI2VlZTsgYm9yZGVyLXJhZGl1czogNHB4OyBtYXJnaW4tYm90dG9tOiAxNXB4O1wiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1wiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQgc3R5bGU9XCJwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IGJhY2tncm91bmQ6ICNmNWY1ZjU7IHotaW5kZXg6IDE7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyB3aWR0aDogNTBweDtcIj7pgInmi6k8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj5FcGljPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7XCI+5a2Q5Lu75Yqh5pWw6YePPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgICAgICAgICAgICR7ZXBpY3MubWFwKChlcGljLCBpbmRleCkgPT4gYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciBzdHlsZT1cImJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjZWVlO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJlcGljLWNoZWNrYm94XCIgZGF0YS1pbmRleD1cIiR7aW5kZXh9XCIgY2hlY2tlZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtlcGljLmVwaWNLZXl9IC0gJHtlcGljLmVwaWNTdW1tYXJ5fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2VwaWMuc3ViVGlja2V0cy5sZW5ndGh9IOS4quWtkOS7u+WKoVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDsgZ2FwOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogI2VlZTsgYm9yZGVyOiAxcHggc29saWQgI2NjYzsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNvbmZpcm1PcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjMDA3YmZmOyBjb2xvcjogd2hpdGU7IGJvcmRlcjogbm9uZTsgYm9yZGVyLXJhZGl1czogNHB4OyBjdXJzb3I6IHBvaW50ZXI7XCI+56Gu6K6kPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcblxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZWN0QWxsQ2hlY2tib3ggPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2VsZWN0QWxsRXBpY3MnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgICAgICBjb25zdCBlcGljQ2hlY2tib3hlcyA9IGRpYWxvZy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdlcGljLWNoZWNrYm94JykgYXMgSFRNTENvbGxlY3Rpb25PZjxIVE1MSW5wdXRFbGVtZW50PjtcbiAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb25maXJtT3BlcmF0aW9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cbiAgICAgICAgc2VsZWN0QWxsQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcykuZm9yRWFjaChjaGVja2JveCA9PiB7XG4gICAgICAgICAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9IHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcykuZm9yRWFjaChjaGVja2JveCA9PiB7XG4gICAgICAgICAgICBjaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2VsZWN0QWxsQ2hlY2tib3guY2hlY2tlZCA9IEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpLmV2ZXJ5KGNiID0+IGNiLmNoZWNrZWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWxPcGVyYXRpb24nKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICByZXNvbHZlKFtdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uZmlybUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkRXBpY3MgPSBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoY2hlY2tib3ggPT4gY2hlY2tib3guY2hlY2tlZClcbiAgICAgICAgICAgICAgICAubWFwKGNoZWNrYm94ID0+IGVwaWNzW3BhcnNlSW50KGNoZWNrYm94LmRhdGFzZXQuaW5kZXggfHwgJzAnKV0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICByZXNvbHZlKHNlbGVjdGVkRXBpY3MpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuLy8g5o+S5YWl5a2Q5Lu75YqhXG5hc3luYyBmdW5jdGlvbiBpbnNlcnRTdWJUaWNrZXRzKFxuICAgIHNoZWV0OiBTaGVldCxcbiAgICBlcGljczogeyBlcGljS2V5OiBzdHJpbmc7IGVwaWNTdW1tYXJ5OiBzdHJpbmc7IHJvd0luZGV4OiBudW1iZXI7IHN1YlRpY2tldHM6IEppcmFUaWNrZXRbXSB9W10sXG4gICAgc2hlZXRIZWFkZXJzOiBKaXJhSGVhZGVycyxcbiAgICBqaXJhQmFzZVVybDogc3RyaW5nXG4pIHtcbiAgICAvLyDmjInooYzlj7fku47lpKfliLDlsI/mjpLluo/vvIzov5nmoLfmj5LlhaXml7bkuI3kvJrlvbHlk43lkI7nu63nmoTooYzlj7dcbiAgICBjb25zdCBzb3J0ZWRFcGljcyA9IFsuLi5lcGljc10uc29ydCgoYSwgYikgPT4gYi5yb3dJbmRleCAtIGEucm93SW5kZXgpO1xuICAgIFxuICAgIGZvciAoY29uc3QgZXBpYyBvZiBzb3J0ZWRFcGljcykge1xuICAgICAgICBjb25zdCBpbnNlcnRSb3dJbmRleCA9IGVwaWMucm93SW5kZXggKyAyOyAvLyArMiDlm6DkuLogcm93SW5kZXgg5pivIDAtYmFzZWTvvIzkuJTmiJHku6zopoHmj5LlnKggRXBpYyDooYznmoTkuIvmlrlcbiAgICAgICAgY29uc3QgZGlzcGxheUhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICBjb25zdCBtYXhDb2xJbmRleCA9IGdldE1heENvbHVtbkluZGV4KE9iamVjdC52YWx1ZXMoc2hlZXRIZWFkZXJzKS5maWx0ZXIoKHZhbHVlKTogdmFsdWUgaXMgc3RyaW5nID0+IFxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPiAwXG4gICAgICAgICkpO1xuXG4gICAgICAgIC8vIOWFiOaPkuWFpeepuuihjFxuICAgICAgICBjb25zdCByb3dzVG9JbnNlcnQgPSBlcGljLnN1YlRpY2tldHMubGVuZ3RoO1xuICAgICAgICBpZiAocm93c1RvSW5zZXJ0ID4gMCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC5pbnNlcnREaW1lbnNpb24oJ1JPV1MnLCBpbnNlcnRSb3dJbmRleCAtIDEsIGluc2VydFJvd0luZGV4IC0gMSArIHJvd3NUb0luc2VydCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOW3suWcqOihjCAke2luc2VydFJvd0luZGV4fSDmj5LlhaUgJHtyb3dzVG9JbnNlcnR9IOS4quepuuihjGApO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmj5LlhaXnqbrooYzlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHNob3dUb2FzdChg5o+S5YWl56m66KGM5aSx6LSlOiAke2Vycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKX1gLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1YlRpY2tldFJvd3MgPSBlcGljLnN1YlRpY2tldHMubWFwKHRpY2tldCA9PiB7XG4gICAgICAgICAgICBjb25zdCByb3cgPSBuZXcgQXJyYXkobWF4Q29sSW5kZXgpLmZpbGwoJycpO1xuICAgICAgICAgICAgZGlzcGxheUhlYWRlcnMuZm9yRWFjaChmaWVsZCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gc2hlZXRIZWFkZXJzW2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdO1xuICAgICAgICAgICAgICAgIGlmIChjb2x1bW5MZXR0ZXIgJiYgdHlwZW9mIGNvbHVtbkxldHRlciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sSW5kZXggPSBnZXRDb2x1bW5JbmRleChjb2x1bW5MZXR0ZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGQgPT09ICdrZXknKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gYD1IWVBFUkxJTksoXCIke2ppcmFCYXNlVXJsfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IHRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8g5YaZ5YWl5a2Q5Lu75Yqh5pWw5o2uXG4gICAgICAgIGNvbnN0IHN0YXJ0UG9zaXRpb24gPSBgQSR7aW5zZXJ0Um93SW5kZXh9YDtcbiAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChzdWJUaWNrZXRSb3dzLCBzdGFydFBvc2l0aW9uKTtcbiAgICAgICAgY29uc29sZS5sb2coYOW3suWcqOihjCAke2luc2VydFJvd0luZGV4fSDlhpnlhaUgJHtzdWJUaWNrZXRSb3dzLmxlbmd0aH0g5Liq5a2Q5Lu75YqhYCk7XG4gICAgfVxufVxuIl0sIm5hbWVzIjpbImdldEVudkNvbmZpZyIsImZldGNoSmlyYVRpY2tldHMiLCJqcWwiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlcXVlc3RJZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInN1YnN0cmluZyIsIm1lc3NhZ2VMaXN0ZW5lciIsIm1lc3NhZ2UiLCJ0eXBlIiwiY2hyb21lIiwicnVudGltZSIsIm9uTWVzc2FnZSIsInJlbW92ZUxpc3RlbmVyIiwiZXJyb3IiLCJFcnJvciIsInRpY2tldHMiLCJhZGRMaXN0ZW5lciIsInNlbmRNZXNzYWdlIiwiRkVUQ0hfSklSQV9USUNLRVRTIiwic291cmNlVGFiSWQiLCJlbnZDb25maWciLCJ1cmwiLCJKSVJBX0JBU0VfVVJMIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwidGFicyIsImNyZWF0ZSIsImFjdGl2ZSIsInRhYiIsImlkIiwiY2hlY2tQYWdlTG9hZCIsImdldCIsInVwZGF0ZWRUYWIiLCJzdGF0dXMiLCJpbmNsdWRlcyIsInNldFRpbWVvdXQiLCJ1cGRhdGUiLCJzY3JpcHRpbmciLCJleGVjdXRlU2NyaXB0IiwidGFyZ2V0IiwidGFiSWQiLCJmdW5jIiwiaXNKaXJhQ2xvdWQiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJyb3dzIiwicXVlcnlTZWxlY3RvckFsbCIsImxlbmd0aCIsImZvckVhY2giLCJyb3ciLCJrZXlFbGVtZW50Iiwic3VtbWFyeUVsZW1lbnQiLCJzdGF0dXNDb250YWluZXIiLCJzdGF0dXNFbGVtZW50IiwiY2VsbHMiLCJhc3NpZ25lZSIsInJlcG9ydGVyIiwicHJpb3JpdHkiLCJjcmVhdGVkIiwidXBkYXRlZCIsImR1ZWRhdGUiLCJhc3NpZ25lZVRleHQiLCJ0ZXh0Q29udGVudCIsInRyaW0iLCJtYXRjaCIsImR1ZURhdGVUZXh0IiwidGlja2V0Iiwia2V5Iiwic3VtbWFyeSIsImRlc2NyaXB0aW9uIiwicHVzaCIsImNlbGwiLCJjbGFzc0xpc3QiLCJwcm9wZXJ0eU5hbWUiLCJpbWciLCJ2YWx1ZSIsImdldEF0dHJpYnV0ZSIsInJlc3VsdHMiLCJyZXN1bHQiLCJtYXAiLCJzcGxpdCIsInMiLCJmaWx0ZXIiLCJCb29sZWFuIiwicG9wIiwicmVtb3ZlIiwiU2hlZXQiLCJjb25zdHJ1Y3RvciIsInRva2VuIiwic2hlZXRJZCIsImV4dHJhY3RTaGVldElkIiwiZ2lkIiwiZXh0cmFjdEdpZCIsImluaXQiLCJnZXRUb2tlbiIsInNoZWV0TmFtZSIsImdldFNoZWV0TmFtZUJ5R2lkIiwiaWRlbnRpdHkiLCJnZXRBdXRoVG9rZW4iLCJpbnRlcmFjdGl2ZSIsImxhc3RFcnJvciIsImdldFNoZWV0TmFtZXMiLCJyZXMiLCJmZXRjaCIsImhlYWRlcnMiLCJBdXRob3JpemF0aW9uIiwianNvbiIsInNoZWV0cyIsInNoZWV0IiwiZmluZCIsInByb3BlcnRpZXMiLCJ0aXRsZSIsInJlYWRTaGVldCIsInNoZWV0VXJsIiwidmFsdWVzIiwid3JpdGVTaGVldCIsInBvc2l0aW9uIiwiYXJndW1lbnRzIiwidW5kZWZpbmVkIiwibWV0aG9kIiwiYm9keSIsIkpTT04iLCJzdHJpbmdpZnkiLCJpbnNlcnREaW1lbnNpb24iLCJkaW1lbnNpb24iLCJzdGFydEluZGV4IiwiZW5kSW5kZXgiLCJyZXF1ZXN0IiwicmVxdWVzdHMiLCJyYW5nZSIsInBhcnNlSW50IiwiaW5oZXJpdEZyb21CZWZvcmUiLCJhZGREaW1lbnNpb25Hcm91cCIsIm9rIiwicmVhZENvbmZpZ1NoZWV0IiwiY29uZmlnU2hlZXROYW1lIiwiY29uc29sZSIsImdldEhlYWRlcnMiLCJnZXRTaGVldE5hbWUiLCJnZXRJbmRleGVkREJEYXRhIiwiZGF0YWJhc2VOYW1lIiwic3RvcmVOYW1lIiwiaW5kZXhlZERCIiwib3BlbiIsIm9uc3VjY2VzcyIsImV2ZW50IiwiZGIiLCJ0cmFuc2FjdGlvbiIsIm9iamVjdFN0b3JlIiwiZGF0YVJlcXVlc3QiLCJnZXRBbGwiLCJvbmVycm9yIiwiZ2V0TG9jYWxTdG9yYWdlSXRlbSIsImRlZmF1bHRWYWx1ZSIsInBhcnNlIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsInNldExvY2FsU3RvcmFnZUl0ZW0iLCJzZXRJdGVtIiwiZ2V0Q3VycmVudFVzZXJJbmZvIiwiZXh0ZW5zaW9uIiwiZXh0ZW5zaW9uSWQiLCJ1c2VybmFtZSIsImdldEZvbGRlcnMiLCJ0aGVuIiwiX3JlZiIsImRhdGEiLCJmYXZvcml0ZV9ncm91cF9pZHMiLCJjb252ZXJzYXRpb25fc2V0cyIsImZvbGRlcnMiLCJpZHMiLCJpdGVtIiwiY2F0Y2giLCJsb2ciLCJnZXRHcm91cHNNYXAiLCJncm91cHMiLCJncm91cHNNYXAiLCJyZWR1Y2UiLCJhY2MiLCJncm91cCIsIm5hbWUiLCJzZXRfYWJicmV2aWF0aW9uIiwiaXNfdGVhbSIsImZvcm1hdERhdGUiLCJkYXRlU3RyaW5nIiwiZGF0ZSIsIkRhdGUiLCJ5ZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsIlN0cmluZyIsImdldE1vbnRoIiwicGFkU3RhcnQiLCJkYXkiLCJnZXREYXRlIiwiaG91cnMiLCJnZXRIb3VycyIsIm1pbnV0ZXMiLCJnZXRNaW51dGVzIiwic2Vjb25kcyIsImdldFNlY29uZHMiLCJ1bmlxQnkiLCJhcnJheSIsInNlZW4iLCJTZXQiLCJrZXlWYWx1ZSIsImhhcyIsImFkZCIsInNob3dUb2FzdCIsIm9uQ2xvc2UiLCJjb250YWluZXIiLCJnZXRFbGVtZW50QnlJZCIsImV4aXN0aW5nVG9hc3QiLCJyZW1vdmVDaGlsZCIsInRvYXN0IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInRvYXN0SW5uZXIiLCJhcHBlbmRDaGlsZCIsInRpbWVyIiwiY29udGFpbnMiLCJjbGVhclRpbWVvdXQiLCJ0cmFuc2Zvcm1Hcm91cExpbmtzIiwiaW5wdXRTdHJpbmciLCJncm91cExpbmtQYXR0ZXJuIiwidHJhbnNmb3JtZWRTdHJpbmciLCJyZXBsYWNlIiwiZ3JvdXBOYW1lIiwiZ3JvdXBJZCIsInRyYW5zZm9ybVBvc3RMaW5rcyIsInBvc3RMaW5rUGF0dGVybiIsImluZGV4IiwicG9zdElkIiwid2luZG93IiwibG9jYXRpb24iLCJwYXRobmFtZSIsImRlZmF1bHRFbnZDb25maWciLCJTQ0hFRFVMRURfSU5URVJWQUwiLCJOdW1iZXIiLCJwcm9jZXNzIiwiZW52IiwiQU5BTFlTSVNfVFlQRSIsIkxMTV9UWVBFIiwiQU5BTFlaRV9CWV9HUk9VUCIsIk9MTEFNQV9CQVNFX1VSTCIsIk9MTEFNQV9NT0RFTCIsIk9MTEFNQV9SRVZJRVdfTU9ERUwiLCJPTExBTUFfUVVFUllfTU9ERUwiLCJESUZZX0FQSV9LRVkiLCJESUZZX1JFVklFV19BUElfS0VZIiwiRElGWV9BUElfQkFTRV9VUkwiLCJPUEVOQUlfQVBJX0tFWSIsIk9QRU5BSV9NT0RFTCIsIk9QRU5BSV9SRVZJRVdfTU9ERUwiLCJPUEVOQUlfQVBJX0JBU0VfVVJMIiwiR1JPUV9BUElfS0VZIiwiR1JPUV9NT0RFTCIsIkdST1FfUkVWSUVXX01PREVMIiwiQk9UX0FQSV9CQVNFX1VSTCIsIkJPVF9UT0tFTiIsIkJPVF9JRCIsIkJPVF9UWVBFIiwiVEVBTV9JRCIsIkVOQUJMRV9CT1QiLCJMTE1fUkVWSUVXX0JFRk9SRV9TRU5EIiwiRU5BQkxFX0NIUk9NQSIsIkNIUk9NQV9BUElfVVJMIiwiQ0hST01BX1BPUlQiLCJDSFJPTUFfQ09MTEVDVElPTl9OQU1FIiwiSklSQV9VU0VSTkFNRSIsIkpJUkFfQVBJX1RPS0VOIiwic3RvcmFnZSIsImxvY2FsIiwiZ2V0VXNlckluZm8iLCJhY2NvdW50VUQiLCJhY2NvdW50SW5mb0xpc3QiLCJhY2NvdW50SW5mbyIsImRpc3BsYXlOYW1lIiwiZW1haWwiLCJmdWxsTmFtZSIsImpvaW4iLCJ0b0xvd2VyQ2FzZSIsInVzZXJJbmZvIiwic2VuZGVyIiwic2VuZFJlc3BvbnNlIiwid2FybiIsInN1Y2Nlc3MiLCJvcGVuSnFsRGlhbG9nIiwic2hlZXRUb2tlbiIsImhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzIiwiZGlhbG9nIiwic3R5bGUiLCJjc3NUZXh0IiwiaW5uZXJIVE1MIiwiYWRkRXZlbnRMaXN0ZW5lciIsImhhbmRsZUZldGNoSmlyYVRpY2tldHNUb1NoZWV0Iiwic2hlZXRIZWFkZXJzIiwiZmluZFZhbGlkSmlyYUhlYWRlcnMiLCJrZXlDb2x1bW5JbmRleCIsImdldENvbHVtbkluZGV4IiwiZXhpc3RpbmdLZXlzIiwic2xpY2UiLCJrZXlDZWxsIiwidGVzdCIsImhlYWRlck1hcHBpbmciLCJjdXN0b21GaWVsZE1hcHBpbmciLCJjb25maWdEYXRhIiwic2hlZXRIZWFkZXJJbmRleCIsImZpbmRJbmRleCIsImgiLCJqaXJhRmllbGRJbmRleCIsImkiLCJtYXgiLCJzaGVldEhlYWRlciIsImppcmFGaWVsZCIsInN0YXJ0c1dpdGgiLCJ2YWxpZEhlYWRlcnMiLCJrbm93bkZpZWxkcyIsImhlYWRlciIsImhlYWRlckxvd2VyIiwiY29sdW1uTGV0dGVyIiwiZnJvbUNoYXJDb2RlIiwiZGlyZWN0TWF0Y2giLCJmaWVsZCIsImNvbHVtbiIsInRvVXBwZXJDYXNlIiwidXBwZXJDb2x1bW4iLCJjaGFyQ29kZUF0IiwiZ2V0TWF4Q29sdW1uSW5kZXgiLCJjb2x1bW5MZXR0ZXJzIiwiQXJyYXkiLCJpc0FycmF5IiwidmFsaWRMZXR0ZXJzIiwiaW5kaWNlcyIsImNvbCIsInNob3dDb25maXJtYXRpb25EaWFsb2ciLCJvcGVyYXRpb25zIiwiZGlzcGxheUhlYWRlcnMiLCJjb2x1bW5zVG9VcGRhdGUiLCJ1cGRhdGVDb3VudCIsIm9wIiwiYXBwZW5kQ291bnQiLCJzZWxlY3RBbGxDaGVja2JveCIsInRpY2tldENoZWNrYm94ZXMiLCJnZXRFbGVtZW50c0J5Q2xhc3NOYW1lIiwiY29uZmlybUJ1dHRvbiIsInVwZGF0ZUNvbmZpcm1CdXR0b25Db3VudCIsInNlbGVjdGVkQ291bnQiLCJmcm9tIiwiY2IiLCJjaGVja2VkIiwiZGlzYWJsZWQiLCJjaGVja2JveCIsImV2ZXJ5Iiwic2VsZWN0ZWRPcGVyYXRpb25zIiwiZGF0YXNldCIsImV4aXN0aW5nVG9hc3RzIiwidCIsImJhY2tncm91bmRDb2xvciIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm9wYWNpdHkiLCJmb3JtYXR0ZWREYXRhIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0IiwiaW5mZXJyZWRLZXlJbmRleCIsImtleVRvUm93TWFwIiwiTWFwIiwic2V0IiwiZXhpc3RpbmdSb3dJbmRleCIsInJvd0luZGV4IiwiY29uZmlybWVkT3BlcmF0aW9ucyIsInVwZGF0ZXNEYXRhIiwiYXBwZW5kRGF0YSIsImhlYWRlclZhbHVlcyIsIk9iamVjdCIsIm1heENvbEluZGV4Iiwib3BlcmF0aW9uIiwiZmlsbCIsImtleXMiLCJ0aWNrZXRLZXkiLCJjb2xJbmRleCIsInVwZGF0ZWRDb3VudCIsImFwcGVuZGVkQ291bnQiLCJzdGFydENvbHVtbiIsInN0YXJ0UG9zaXRpb24iLCJ0b2FzdE1lc3NhZ2UiLCJlcGljc1RvRXhwYW5kIiwia2V5Q2VsbENvbnRlbnQiLCJlcGljS2V5Iiwic3ViVGlja2V0cyIsInN1bW1hcnlDb2x1bW5JbmRleCIsImVwaWNTdW1tYXJ5IiwiZmV0Y2hFcnJvciIsImNvbmZpcm1lZEVwaWNzIiwic2hvd0VwaWNDb25maXJtYXRpb25EaWFsb2ciLCJpbnNlcnRTdWJUaWNrZXRzIiwiZXBpY3MiLCJlcGljIiwiZXBpY0NoZWNrYm94ZXMiLCJzZWxlY3RlZEVwaWNzIiwiamlyYUJhc2VVcmwiLCJzb3J0ZWRFcGljcyIsInNvcnQiLCJhIiwiYiIsImluc2VydFJvd0luZGV4Iiwicm93c1RvSW5zZXJ0Iiwic3ViVGlja2V0Um93cyJdLCJzb3VyY2VSb290IjoiIn0=