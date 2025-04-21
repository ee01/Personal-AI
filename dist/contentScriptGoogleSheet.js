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
              return tickets;
            }
          }, results => {
            results[0].result = results[0].result.map(ticket => ({
              ...ticket,
              summary: ticket.summary.split('\n').slice(-1)[0].trim()
            }));
            chrome.tabs.sendMessage(sourceTabId, {
              // 发送结果回源标签页
              type: 'JIRA_TICKETS_RESULT',
              requestId,
              tickets: results[0].result
            });

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
  DIFY_API_KEY:  false || "",
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUFPRSxhQUFhLENBQUNoUyxNQUFNLE9BQU8sQ0FBQztFQUN4RTtBQUNKLEMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9qaXJhLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3NoZWV0LnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3N0b3JhZ2UudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvdXRpbHMudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9jb250ZW50U2NyaXB0R29vZ2xlU2hlZXQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyDpu5jorqTnmoQgSmlyYSDlrZfmrrXphY3nva5cbmNvbnN0IERFRkFVTFRfSklSQV9GSUVMRFMgPSB7XG4gICdLZXknOiAna2V5JyxcbiAgJ1N1bW1hcnknOiAnc3VtbWFyeScsXG4gICdTdGF0dXMnOiAnc3RhdHVzJyxcbiAgJ0Fzc2lnbmVlJzogJ2Fzc2lnbmVlJyxcbiAgJ1JlcG9ydGVyJzogJ3JlcG9ydGVyJyxcbiAgJ1ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgJ0NyZWF0ZWQnOiAnY3JlYXRlZCcsXG4gICdVcGRhdGVkJzogJ3VwZGF0ZWQnLFxuICAnRHVlIERhdGUnOiAnZHVlZGF0ZScsXG4gICdEZXNjcmlwdGlvbic6ICdkZXNjcmlwdGlvbidcbn07XG5cbi8vIOS7jiBKaXJhIOmhtemdouaKk+WPluaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoSmlyYVRpY2tldHMoanFsOiBzdHJpbmcpOiBQcm9taXNlPEppcmFUaWNrZXRbXT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZyg3KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOebkeWQrOadpeiHqiBiYWNrZ3JvdW5kIHNjcmlwdCDnmoTmtojmga9cbiAgICAgICAgY29uc3QgbWVzc2FnZUxpc3RlbmVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0pJUkFfVElDS0VUU19SRVNVTFQnICYmIG1lc3NhZ2UucmVxdWVzdElkID09PSByZXF1ZXN0SWQpIHtcbiAgICAgICAgICAgICAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIobWVzc2FnZUxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICBpZiAobWVzc2FnZS5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKG1lc3NhZ2UuZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UudGlja2V0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIobWVzc2FnZUxpc3RlbmVyKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWPkemAgea2iOaBr+e7mSBiYWNrZ3JvdW5kIHNjcmlwdCDmnaXliJvlu7rmlrDmoIfnrb7pobVcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgdHlwZTogJ0ZFVENIX0pJUkFfVElDS0VUUycsXG4gICAgICAgICAgICBqcWwsXG4gICAgICAgICAgICByZXF1ZXN0SWRcbiAgICAgICAgfSk7XG4gICAgfSk7XG59XG5cbi8vIOeEtuWQjuWcqCBGRVRDSF9KSVJBX1RJQ0tFVFMg5Ye95pWw5Lit5L2/55SoIHNvdXJjZVRhYklkXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gRkVUQ0hfSklSQV9USUNLRVRTKGpxbDogc3RyaW5nLCByZXF1ZXN0SWQ6IHN0cmluZywgc291cmNlVGFiSWQ6IG51bWJlcikge1xuICBjb25zdCBlbnZDb25maWcgPSBhd2FpdCBnZXRFbnZDb25maWcoKTtcbiAgY29uc3QgdXJsID0gYCR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2lzc3Vlcy8/anFsPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGpxbCl9YDtcbiAgICAgICAgXG4gIC8vIOWIm+W7uuaWsOagh+etvumhtVxuICBjaHJvbWUudGFicy5jcmVhdGUoeyB1cmwsIGFjdGl2ZTogZmFsc2UgfSwgKHRhYikgPT4ge1xuICAgICAgaWYgKCF0YWIuaWQpIHtcbiAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgZXJyb3I6ICfml6Dms5XliJvlu7rmoIfnrb7pobUnXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyDnrYnlvoXpobXpnaLliqDovb3lrozmiJBcbiAgICAgIGNvbnN0IGNoZWNrUGFnZUxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuZ2V0KHRhYi5pZCEsICh1cGRhdGVkVGFiKSA9PiB7XG4gICAgICAgICAgICAgIGlmICh1cGRhdGVkVGFiLnN0YXR1cyA9PT0gJ2NvbXBsZXRlJykge1xuICAgICAgICAgICAgICAgIGlmICh1cGRhdGVkVGFiLnVybC5pbmNsdWRlcygnbG9naW4nKSB8fCB1cGRhdGVkVGFiLnVybC5pbmNsdWRlcygnb2t0YScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ2ppcmEg6ZyA6KaB55m75b2V77yM6K+355m75b2V5ZCO6YeN5paw5bCd6K+VJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBjaHJvbWUudGFicy51cGRhdGUodGFiLmlkISwgeyBhY3RpdmU6IHRydWUgfSksIDMwMDApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgLy8g5rOo5YWl5YaF5a656ISa5pysXG4gICAgICAgICAgICAgICAgICBjaHJvbWUuc2NyaXB0aW5nLmV4ZWN1dGVTY3JpcHQoe1xuICAgICAgICAgICAgICAgICAgICAgIHRhcmdldDogeyB0YWJJZDogdGFiLmlkISB9LFxuICAgICAgICAgICAgICAgICAgICAgIGZ1bmM6ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGlja2V0czogYW55W10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RyLmlzc3Vlcm93Jyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb3dzLmZvckVhY2gocm93ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk6IHJvdy5xdWVyeVNlbGVjdG9yKCcuaXNzdWVrZXknKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiByb3cucXVlcnlTZWxlY3RvcignLnN1bW1hcnknKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHJvdy5xdWVyeVNlbGVjdG9yKCcuc3RhdHVzJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzaWduZWU6IHJvdy5xdWVyeVNlbGVjdG9yKCcuYXNzaWduZWUnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvcnRlcjogcm93LnF1ZXJ5U2VsZWN0b3IoJy5yZXBvcnRlcicpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiByb3cucXVlcnlTZWxlY3RvcignLnByaW9yaXR5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZDogcm93LnF1ZXJ5U2VsZWN0b3IoJy5jcmVhdGVkJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlZDogcm93LnF1ZXJ5U2VsZWN0b3IoJy51cGRhdGVkJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVlZGF0ZTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5kdWVkYXRlJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHJvdy5xdWVyeVNlbGVjdG9yKCcuZGVzY3JpcHRpb24nKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aWNrZXRzO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0sIChyZXN1bHRzKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHNbMF0ucmVzdWx0ID0gcmVzdWx0c1swXS5yZXN1bHQubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICBzdW1tYXJ5OiB0aWNrZXQuc3VtbWFyeS5zcGxpdCgnXFxuJykuc2xpY2UoLTEpWzBdLnRyaW0oKSxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICAgICAgICAvLyDlj5HpgIHnu5Pmnpzlm57mupDmoIfnrb7pobVcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHM6IHJlc3VsdHNbMF0ucmVzdWx0XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8g5YWz6ZetIEppcmEg5qCH562+6aG1XG4gICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnJlbW92ZSh0YWIuaWQhKTtcbiAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChjaGVja1BhZ2VMb2FkLCAxMDApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgXG4gICAgICBjaGVja1BhZ2VMb2FkKCk7XG4gIH0pO1xufVxuIiwiZXhwb3J0IGNsYXNzIFNoZWV0IHtcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nO1xuICBwcml2YXRlIHNoZWV0SWQ6IHN0cmluZztcbiAgcHJpdmF0ZSBnaWQ6IHN0cmluZztcbiAgcHJpdmF0ZSBzaGVldE5hbWU6IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcih1cmw6IHN0cmluZywgdG9rZW46IHN0cmluZykge1xuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcbiAgICB0aGlzLnNoZWV0SWQgPSB0aGlzLmV4dHJhY3RTaGVldElkKHVybCk7XG4gICAgdGhpcy5naWQgPSB0aGlzLmV4dHJhY3RHaWQodXJsKTtcbiAgfVxuICAgIFxuICBhc3luYyBpbml0KCkge1xuICAgIGlmICghdGhpcy50b2tlbikgdGhpcy50b2tlbiA9IGF3YWl0IHRoaXMuZ2V0VG9rZW4oKTtcbiAgICB0aGlzLnNoZWV0TmFtZSA9IGF3YWl0IHRoaXMuZ2V0U2hlZXROYW1lQnlHaWQodGhpcy50b2tlbiwgdGhpcy5zaGVldElkLCB0aGlzLmdpZCk7XG4gIH1cblxuICBhc3luYyBnZXRUb2tlbigpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNocm9tZS5pZGVudGl0eS5nZXRBdXRoVG9rZW4oeyBpbnRlcmFjdGl2ZTogdHJ1ZSB9LCAodG9rZW4pID0+IHtcbiAgICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICAgICAgZWxzZSByZXNvbHZlKHRva2VuKTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBleHRyYWN0U2hlZXRJZCh1cmw6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IG1hdGNoID0gdXJsLm1hdGNoKC9cXC9kXFwvKFthLXpBLVowLTktX10rKS8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogbnVsbDtcbiAgfVxuXG4gIGV4dHJhY3RHaWQodXJsOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvWyMmXWdpZD0oWzAtOV0rKS8pO1xuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogbnVsbDtcbiAgfVxuXG4gIGFzeW5jIGdldFNoZWV0TmFtZXModG9rZW46IHN0cmluZywgc2hlZXRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7c2hlZXRJZH1gO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gIH1cbiAgICB9KTtcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICByZXR1cm4ganNvbi5zaGVldHM7XG4gIH1cblxuICBhc3luYyBnZXRTaGVldE5hbWVCeUdpZCh0b2tlbjogc3RyaW5nLCBzaGVldElkOiBzdHJpbmcsIGdpZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBzaGVldHMgPSBhd2FpdCB0aGlzLmdldFNoZWV0TmFtZXModG9rZW4sIHNoZWV0SWQpO1xuICAgIGNvbnN0IHNoZWV0ID0gc2hlZXRzLmZpbmQoKHM6IGFueSkgPT4gcy5wcm9wZXJ0aWVzLnNoZWV0SWQudG9TdHJpbmcoKSA9PT0gZ2lkKTtcbiAgICByZXR1cm4gc2hlZXQgPyBzaGVldC5wcm9wZXJ0aWVzLnRpdGxlIDogc2hlZXRzWzBdLnByb3BlcnRpZXMudGl0bGU7IC8vIOWmguaenOaJvuS4jeWIsOWvueW6lOeahGdpZCzov5Tlm57nrKzkuIDkuKpzaGVldOeahOWQjeensFxuICB9XG5cbiAgYXN5bmMgcmVhZFNoZWV0KCk6IFByb21pc2U8c3RyaW5nW11bXT4ge1xuICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7dGhpcy5zaGVldE5hbWV9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChzaGVldFVybCwge1xuICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgIHJldHVybiBqc29uLnZhbHVlcztcbiAgfVxuXG4gIGFzeW5jIHdyaXRlU2hlZXQodmFsdWVzOiBzdHJpbmdbXVtdLCBwb3NpdGlvbiA9ICdBMScpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7dGhpcy5zaGVldE5hbWV9ISR7cG9zaXRpb259P3ZhbHVlSW5wdXRPcHRpb249VVNFUl9FTlRFUkVEYDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChzaGVldFVybCwge1xuICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAsXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyB2YWx1ZXMgfSlcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzLmpzb24oKTtcbiAgfVxuXG4gIC8vIOaPkuWFpeihjOaIluWIl1xuICBhc3luYyBpbnNlcnREaW1lbnNpb24oZGltZW5zaW9uOiAnUk9XUycgfCAnQ09MVU1OUycsIHN0YXJ0SW5kZXg6IG51bWJlciwgZW5kSW5kZXg6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9OmJhdGNoVXBkYXRlYDtcbiAgICBjb25zdCByZXF1ZXN0ID0ge1xuICAgICAgcmVxdWVzdHM6IFt7XG4gICAgICAgIGluc2VydERpbWVuc2lvbjoge1xuICAgICAgICAgIHJhbmdlOiB7XG4gICAgICAgICAgICBzaGVldElkOiBwYXJzZUludCh0aGlzLmdpZCksXG4gICAgICAgICAgICBkaW1lbnNpb24sXG4gICAgICAgICAgICBzdGFydEluZGV4LFxuICAgICAgICAgICAgZW5kSW5kZXhcbiAgICAgICAgICB9LFxuICAgICAgICAgIGluaGVyaXRGcm9tQmVmb3JlOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGFkZERpbWVuc2lvbkdyb3VwOiB7XG4gICAgICAgICAgcmFuZ2U6IHtcbiAgICAgICAgICAgIHNoZWV0SWQ6IHBhcnNlSW50KHRoaXMuZ2lkKSxcbiAgICAgICAgICAgIGRpbWVuc2lvbixcbiAgICAgICAgICAgIHN0YXJ0SW5kZXgsXG4gICAgICAgICAgICBlbmRJbmRleFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfV1cbiAgICB9O1xuXG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QpXG4gICAgfSk7XG5cbiAgICBpZiAoIXJlcy5vaykge1xuICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXMuanNvbigpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDmj5LlhaXnu7TluqblpLHotKU6ICR7ZXJyb3IuZXJyb3I/Lm1lc3NhZ2UgfHwgJ+acquefpemUmeivryd9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOivu+WPlumFjee9ruihqOaVsOaNrlxuICAgKiBAcGFyYW0gc2hlZXROYW1lIOmFjee9ruihqOWQjeensFxuICAgKiBAcmV0dXJucyDphY3nva7ooajmlbDmja5cbiAgICovXG4gIGFzeW5jIHJlYWRDb25maWdTaGVldChjb25maWdTaGVldE5hbWUgPSAnJyk6IFByb21pc2U8c3RyaW5nW11bXT4ge1xuICAgIGlmICghY29uZmlnU2hlZXROYW1lKSBjb25maWdTaGVldE5hbWUgPSB0aGlzLnNoZWV0TmFtZSArICdfY29uZmlnJztcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke2NvbmZpZ1NoZWV0TmFtZX1gO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChzaGVldFVybCwge1xuICAgICAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgICAgICByZXR1cm4ganNvbi52YWx1ZXM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+ivu+WPlumFjee9ruihqOWksei0pTonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W6KGo5qC855qE56ys5LiA6KGM5L2c5Li66KGo5aS0XG4gICAqIEByZXR1cm5zIOihqOWktOaVsOe7hFxuICAgKi9cbiAgYXN5bmMgZ2V0SGVhZGVycygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgdmFsdWVzID0gYXdhaXQgdGhpcy5yZWFkU2hlZXQoKTtcbiAgICBpZiAoIXZhbHVlcyB8fCB2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ihqOagvOS4uuepuicpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzWzBdO1xuICB9XG5cbiAgcHVibGljIGdldFNoZWV0TmFtZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnNoZWV0TmFtZTtcbiAgfVxufSIsImV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleGVkREJEYXRhKGRhdGFiYXNlTmFtZTogc3RyaW5nLCBzdG9yZU5hbWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKGRhdGFiYXNlTmFtZSk7XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRiID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gZGIudHJhbnNhY3Rpb24oW3N0b3JlTmFtZV0sICdyZWFkb25seScpO1xuICAgICAgICAgICAgY29uc3Qgb2JqZWN0U3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZShzdG9yZU5hbWUpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVJlcXVlc3QgPSBvYmplY3RTdG9yZS5nZXRBbGwoKTtcbiAgICBcbiAgICAgICAgICAgIGRhdGFSZXF1ZXN0Lm9uc3VjY2VzcyA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKGV2ZW50LnRhcmdldC5yZXN1bHQpO1xuICAgICAgICAgICAgfTtcbiAgICBcbiAgICAgICAgICAgIGRhdGFSZXF1ZXN0Lm9uZXJyb3IgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGV2ZW50LnRhcmdldC5lcnJvcik7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgIFxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGV2ZW50LnRhcmdldC5lcnJvcik7XG4gICAgICAgIH07XG4gICAgfSk7XG59XG5cblxuZXhwb3J0IGNvbnN0IGdldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KSB8fCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZXRMb2NhbFN0b3JhZ2VJdGVtID0gKGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IGFueSkgPT4ge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdFZhbHVlKSk7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFVzZXJJbmZvKCkge1xuICAgIGNvbnN0IHsgZXh0ZW5zaW9uOiBleHRlbnNpb25JZCB9ID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnb3duRXh0ZW5zaW9uJywge30pO1xuICAgIGNvbnN0IHVzZXJuYW1lID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZGlzcGxheU5hbWUnLCAncmFkYXItcG9jJyk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXh0ZW5zaW9uSWQsXG4gICAgICAgIHVzZXJuYW1lXG4gICAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZvbGRlcnMoKSB7XG4gICAgcmV0dXJuIGdldEluZGV4ZWREQkRhdGEoJ0dsaXAnLCAncHJvZmlsZScpLnRoZW4oKFtkYXRhXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmF2b3JpdGVfZ3JvdXBfaWRzID0gZGF0YT8uZmF2b3JpdGVfZ3JvdXBfaWRzIHx8IFtdO1xuICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9uX3NldHMgPSBkYXRhPy5jb252ZXJzYXRpb25fc2V0cyB8fCBbXTtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSBbe3RpdGxlOiAnICcsIGlkczogW119LHt0aXRsZTogJ2Zhdm9yaXRlJywgaWRzOiBmYXZvcml0ZV9ncm91cF9pZHN9LCAuLi5jb252ZXJzYXRpb25fc2V0cy5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdmb2xkZXInKV1cbiAgICAgICAgICAgIHJldHVybiBmb2xkZXJzO1xuICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEdyb3Vwc01hcCgpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdncm91cCcpLnRoZW4oKGdyb3VwcykgPT4ge1xuICAgICAgICBjb25zdCBncm91cHNNYXAgPSBncm91cHMucmVkdWNlKChhY2M6IGFueSwgZ3JvdXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgYWNjW2dyb3VwLmlkXSA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBncm91cC5zZXRfYWJicmV2aWF0aW9uLFxuICAgICAgICAgICAgICAgIGlzX3RlYW06IGdyb3VwLmlzX3RlYW1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICB9LCB7fSk7XG5cbiAgICAgICAgcmV0dXJuIGdyb3Vwc01hcDtcbiAgICB9KTtcbn0iLCJpbXBvcnQgeyBnZXRDdXJyZW50VXNlckluZm8sIGdldExvY2FsU3RvcmFnZUl0ZW0gfSBmcm9tIFwiLi9zdG9yYWdlXCI7XG5cbi8vIOeOr+Wig+mFjee9ruexu+Wei+WumuS5iVxuZXhwb3J0IGludGVyZmFjZSBFbnZDb25maWdUeXBlIHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBudW1iZXI7XG4gIEFOQUxZU0lTX1RZUEU6IHN0cmluZztcbiAgQU5BTFlaRV9CWV9HUk9VUDogYm9vbGVhbjtcbiAgTExNX1RZUEU6IHN0cmluZztcbiAgT0xMQU1BX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9MTEFNQV9NT0RFTDogc3RyaW5nO1xuICBPTExBTUFfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogc3RyaW5nO1xuICBESUZZX0FQSV9LRVk6IHN0cmluZztcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBPUEVOQUlfQVBJX0tFWTogc3RyaW5nO1xuICBPUEVOQUlfTU9ERUw6IHN0cmluZztcbiAgT1BFTkFJX1JFVklFV19NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIEdST1FfQVBJX0tFWTogc3RyaW5nO1xuICBHUk9RX01PREVMOiBzdHJpbmc7XG4gIEdST1FfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIEJPVF9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgQk9UX1RPS0VOOiBzdHJpbmc7XG4gIEJPVF9JRDogc3RyaW5nO1xuICBCT1RfVFlQRTogc3RyaW5nO1xuICBURUFNX0lEOiBzdHJpbmc7XG4gIEVOQUJMRV9CT1Q6IGJvb2xlYW47XG4gIExMTV9SRVZJRVdfQkVGT1JFX1NFTkQ6IGJvb2xlYW47XG4gIEVOQUJMRV9DSFJPTUE6IGJvb2xlYW47XG4gIENIUk9NQV9BUElfVVJMOiBzdHJpbmc7XG4gIENIUk9NQV9QT1JUOiBudW1iZXI7XG4gIENIUk9NQV9DT0xMRUNUSU9OX05BTUU6IHN0cmluZztcbiAgLy8gSklSQeebuOWFs+mFjee9rlxuICBKSVJBX0JBU0VfVVJMPzogc3RyaW5nO1xuICBKSVJBX1VTRVJOQU1FPzogc3RyaW5nO1xuICBKSVJBX0FQSV9UT0tFTj86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdERhdGUoZGF0ZVN0cmluZzogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGRhdGVTdHJpbmcpO1xuICAgIFxuICAgIGNvbnN0IHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgY29uc3QgbW9udGggPSBTdHJpbmcoZGF0ZS5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgaG91cnMgPSBTdHJpbmcoZGF0ZS5nZXRIb3VycygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IG1pbnV0ZXMgPSBTdHJpbmcoZGF0ZS5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3Qgc2Vjb25kcyA9IFN0cmluZyhkYXRlLmdldFNlY29uZHMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgXG4gICAgcmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fSAke2hvdXJzfToke21pbnV0ZXN9OiR7c2Vjb25kc31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5pcUJ5KGFycmF5OiBhbnlbXSwga2V5OiBzdHJpbmcpIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xuICAgIHJldHVybiBhcnJheS5maWx0ZXIoaXRlbSA9PiB7XG4gICAgICBjb25zdCBrZXlWYWx1ZSA9IGl0ZW1ba2V5XTtcbiAgICAgIGlmIChzZWVuLmhhcyhrZXlWYWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgc2Vlbi5hZGQoa2V5VmFsdWUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIG9uQ2xvc2U/OiAoKSA9PiB2b2lkKSB7XG4gIC8vIOiOt+WPluaIluWIm+W7uuWuueWZqOWFg+e0oFxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmFkYXItcG9jLXJlc3VsdCcpO1xuICBpZiAoIWNvbnRhaW5lcikgcmV0dXJuXG5cbiAgLy8g56e76Zmk546w5pyJ55qEIFRvYXN0IOWFg+e0oFxuICBjb25zdCBleGlzdGluZ1RvYXN0ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5yYWRhci1wb2MtdG9hc3QnKTtcbiAgaWYgKGV4aXN0aW5nVG9hc3QpIHtcbiAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQoZXhpc3RpbmdUb2FzdCk7XG4gIH1cblxuICAvLyDliJvlu7rmlrDnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9IGByYWRhci1wb2MtdG9hc3QgcmFkYXItcG9jLXRvYXN0LSR7dHlwZX1gO1xuXG4gIGNvbnN0IHRvYXN0SW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3RJbm5lci5jbGFzc05hbWUgPSAncmFkYXItcG9jLXRvYXN0LWlubmVyJztcbiAgdG9hc3RJbm5lci50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cbiAgdG9hc3QuYXBwZW5kQ2hpbGQodG9hc3RJbm5lcik7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2FzdCk7XG5cbiAgLy8g6K6+572u5a6a5pe25Zmo5ZyoIDMg56eS5ZCO5YWz6ZetIFRvYXN0XG4gIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9LCAzMDAwKTtcblxuICAvLyDov5Tlm57kuIDkuKrlh73mlbDku6Xkvr/miYvliqjlhbPpl60gVG9hc3RcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgIGlmIChjb250YWluZXIuY29udGFpbnModG9hc3QpKSB7XG4gICAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgIH1cbiAgICBpZiAob25DbG9zZSkge1xuICAgICAgb25DbG9zZSgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUdyb3VwTGlua3MoaW5wdXRTdHJpbmc6IHN0cmluZykge1xuICBjb25zdCBncm91cExpbmtQYXR0ZXJuID0gL1xcW2dyb3VwOiguKyk6KFxcZCspXFxdL2c7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShncm91cExpbmtQYXR0ZXJuLCAobWF0Y2gsIGdyb3VwTmFtZSwgZ3JvdXBJZCkgPT4ge1xuICAgIHJldHVybiBgWyR7Z3JvdXBOYW1lfV0oL21lc3NhZ2VzLyR7Z3JvdXBJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybVBvc3RMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IHBvc3RMaW5rUGF0dGVybiA9IC9cXFtwb3N0OihcXGQrKVxcXS9nO1xuICBsZXQgaW5kZXggPSAxO1xuICBjb25zdCB0cmFuc2Zvcm1lZFN0cmluZyA9IGlucHV0U3RyaW5nLnJlcGxhY2UocG9zdExpbmtQYXR0ZXJuLCAobWF0Y2gsIHBvc3RJZCkgPT4ge1xuICAgIHJldHVybiBgW1ske2luZGV4Kyt9XV0oL2wke3dpbmRvdy5sb2NhdGlvbi5wYXRobmFtZX0vJHtwb3N0SWR9KWA7XG4gIH0pO1xuICByZXR1cm4gdHJhbnNmb3JtZWRTdHJpbmc7XG59XG5cbi8vIOm7mOiupOeOr+Wig+mFjee9rlxuZXhwb3J0IGNvbnN0IGRlZmF1bHRFbnZDb25maWc6IEVudkNvbmZpZ1R5cGUgPSB7XG4gIFNDSEVEVUxFRF9JTlRFUlZBTDogTnVtYmVyKHByb2Nlc3MuZW52LlNDSEVEVUxFRF9JTlRFUlZBTCkgfHwgMTIwLFxuICBBTkFMWVNJU19UWVBFOiBwcm9jZXNzLmVudi5BTkFMWVNJU19UWVBFIHx8IFwiZmlsdGVyXCIsXG4gIExMTV9UWVBFOiBwcm9jZXNzLmVudi5MTE1fVFlQRSB8fCBcImRpZnlcIixcbiAgQU5BTFlaRV9CWV9HUk9VUDogcHJvY2Vzcy5lbnYuQU5BTFlaRV9CWV9HUk9VUCA9PT0gXCJ0cnVlXCIsXG4gIE9MTEFNQV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT0xMQU1BX0JBU0VfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDoxMTQzNFwiLFxuICBPTExBTUFfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9NT0RFTCB8fCBcImRlZXBzZWVrLXIxXCIsXG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9SRVZJRVdfTU9ERUwgfHwgXCJsbGFtYTMuMVwiLFxuICBPTExBTUFfUVVFUllfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9RVUVSWV9NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIERJRllfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9BUElfS0VZIHx8IFwiXCIsXG4gIERJRllfUkVWSUVXX0FQSV9LRVk6IHByb2Nlc3MuZW52LkRJRllfUkVWSUVXX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52LkRJRllfQVBJX0JBU0VfVVJMIHx8IFwiXCIsXG4gIE9QRU5BSV9BUElfS0VZOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSB8fCBcIlwiLFxuICBPUEVOQUlfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9NT0RFTCB8fCBcIlwiLFxuICBPUEVOQUlfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5PUEVOQUlfUkVWSUVXX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgR1JPUV9BUElfS0VZOiBwcm9jZXNzLmVudi5HUk9RX0FQSV9LRVkgfHwgXCJcIixcbiAgR1JPUV9NT0RFTDogcHJvY2Vzcy5lbnYuR1JPUV9NT0RFTCB8fCBcIlwiLFxuICBHUk9RX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuR1JPUV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgQk9UX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuQk9UX0FQSV9CQVNFX1VSTCB8fCBcImh0dHBzOi8vYm90bWFuLmludC5yY2xhYmVudi5jb20vdjJcIixcbiAgQk9UX1RPS0VOOiBwcm9jZXNzLmVudi5CT1RfVE9LRU4gfHwgXCJcIixcbiAgQk9UX0lEOiBwcm9jZXNzLmVudi5CT1RfSUQgfHwgXCI0NzAwMzcyMDIwQDM3NDM5NTEwLmJvdC5nbGlwLm5ldFwiLFxuICBCT1RfVFlQRTogcHJvY2Vzcy5lbnYuQk9UX1RZUEUgfHwgXCJ1c2VyXCIsXG4gIFRFQU1fSUQ6IHByb2Nlc3MuZW52LlRFQU1fSUQgfHwgXCJcIixcbiAgRU5BQkxFX0JPVDogcHJvY2Vzcy5lbnYuRU5BQkxFX0JPVCA9PT0gXCJ0cnVlXCIsXG4gIExMTV9SRVZJRVdfQkVGT1JFX1NFTkQ6IHByb2Nlc3MuZW52LkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQgPT09IFwidHJ1ZVwiLFxuICBFTkFCTEVfQ0hST01BOiBwcm9jZXNzLmVudi5FTkFCTEVfQ0hST01BID09PSBcInRydWVcIixcbiAgQ0hST01BX0FQSV9VUkw6IHByb2Nlc3MuZW52LkNIUk9NQV9BUElfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDo4MDAwXCIsXG4gIENIUk9NQV9QT1JUOiBOdW1iZXIocHJvY2Vzcy5lbnYuQ0hST01BX1BPUlQpIHx8IDgwMDAsXG4gIENIUk9NQV9DT0xMRUNUSU9OX05BTUU6IHByb2Nlc3MuZW52LkNIUk9NQV9DT0xMRUNUSU9OX05BTUUgfHwgXCJcIixcbiAgSklSQV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuSklSQV9CQVNFX1VSTCB8fCBcImh0dHBzOi8vamlyYS5yaW5nY2VudHJhbC5jb21cIixcbiAgSklSQV9VU0VSTkFNRTogcHJvY2Vzcy5lbnYuSklSQV9VU0VSTkFNRSB8fCBcIlwiLFxuICBKSVJBX0FQSV9UT0tFTjogcHJvY2Vzcy5lbnYuSklSQV9BUElfVE9LRU4gfHwgXCJcIixcbn07XG5cbi8vIOiOt+WPlueOr+Wig+mFjee9ru+8jOWmguaenOWPr+iDveeahOivneS7jiBzdG9yYWdlIOiOt+WPlu+8jOWQpuWImeS7jiBwcm9jZXNzLmVudiDojrflj5ZcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRFbnZDb25maWcoKTogUHJvbWlzZTxFbnZDb25maWdUeXBlPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBlbnZDb25maWcgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2VudkNvbmZpZyddKTtcbiAgICBpZiAoZW52Q29uZmlnKSB7XG4gICAgICAvLyDlsIblrZjlgqjnmoTphY3nva7kuI7pu5jorqTphY3nva7lkIjlubbvvIznoa7kv53mlrDlop7nmoTphY3nva7pobnkuZ/kvJrooqvljIXlkKtcbiAgICAgIHJldHVybiB7IC4uLmRlZmF1bHRFbnZDb25maWcsIC4uLmVudkNvbmZpZyB9O1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfojrflj5bphY3nva7lpLHotKU6JywgZXJyb3IpO1xuICB9XG4gIFxuICAvLyDlpoLmnpzojrflj5blpLHotKXmiJbmsqHmnInkv53lrZjnmoTphY3nva7vvIzov5Tlm57pu5jorqTlgLxcbiAgcmV0dXJuIGRlZmF1bHRFbnZDb25maWc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VySW5mbygpIHtcbiAgY29uc3QgYWNjb3VudFVEID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuVUQnLCAnJyk7XG4gIGNvbnN0IGFjY291bnRJbmZvTGlzdCA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2dsb2JhbC5hY2NvdW50LkFDQ09VTlRfU0VTU0lPTl9EQVRBX0xJU1QnLCB7fSk7XG5cbiAgY29uc3QgYWNjb3VudEluZm8gPSBhY2NvdW50VUQgPyBhY2NvdW50SW5mb0xpc3RbYWNjb3VudFVEXSA6IGFjY291bnRJbmZvTGlzdC5maW5kKChpdGVtOmFueSkgPT4gaXRlbS5kaXNwbGF5TmFtZSAhPSAnJyk7XG4gIGNvbnNvbGUubG9nKCdhY2NvdW50SW5mb0xpc3QnLCBhY2NvdW50SW5mb0xpc3QsIGFjY291bnRJbmZvKTtcbiAgaWYgKGFjY291bnRJbmZvKSByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiBhY2NvdW50SW5mby5leHRlbnNpb25JZCxcbiAgICBlbWFpbDogYWNjb3VudEluZm8uZW1haWwsXG4gICAgZnVsbE5hbWU6IGFjY291bnRJbmZvLmRpc3BsYXlOYW1lLFxuICAgIHVzZXJuYW1lOiBhY2NvdW50SW5mby5lbWFpbCA/IGFjY291bnRJbmZvLmVtYWlsLnRyaW0oKS5zcGxpdCgnQCcpWzBdIDogYWNjb3VudEluZm8uZGlzcGxheU5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpLFxuICB9XG5cbiAgY29uc3QgdXNlckluZm8gPSBnZXRDdXJyZW50VXNlckluZm8oKTtcbiAgcmV0dXJuIHtcbiAgICBleHRlbnNpb25JZDogdXNlckluZm8uZXh0ZW5zaW9uSWQsXG4gICAgZnVsbE5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLFxuICAgIHVzZXJuYW1lOiB1c2VySW5mby51c2VybmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gICAgZW1haWw6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSArICdAcmluZ2NlbnRyYWwuY29tJ1xuICB9O1xufVxuXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCB7IGZldGNoSmlyYVRpY2tldHMgfSBmcm9tICcuL2ppcmEnO1xuaW1wb3J0IHsgU2hlZXQgfSBmcm9tICcuL3NoZWV0JztcbmltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyDlhajlsYDlj5jph49cbmxldCB1cmw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xubGV0IHNoZWV0VG9rZW46IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4vLyBNYWluIGxpc3RlbmVyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ+aUtuWIsOa2iOaBrzonLCBtZXNzYWdlLCAn5Y+R6YCB6ICFOicsIHNlbmRlcik7XG5cbiAgICBpZiAoIW1lc3NhZ2UgfHwgIW1lc3NhZ2UudHlwZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+aUtuWIsOaXoOaViOa2iOaBr+agvOW8jycpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICfml6DmlYjmtojmga/moLzlvI8nIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHR5cGUgfSA9IG1lc3NhZ2U7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09QRU5fSklSQV9RVUVSWV9ESUFMT0cnKSB7XG4gICAgICAgIG9wZW5KcWxEaWFsb2cobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbik7XG4gICAgICAgIHVybCA9IG1lc3NhZ2UudXJsO1xuICAgICAgICBzaGVldFRva2VuID0gbWVzc2FnZS5zaGVldFRva2VuO1xuICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0VYUEFORF9FUElDX1RJQ0tFVFMnKSB7XG4gICAgICAgIGlmICghbWVzc2FnZS51cmwgfHwgIW1lc3NhZ2Uuc2hlZXRUb2tlbikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRVhQQU5EX0VQSUNfVElDS0VUUyDnvLrlsJEgdXJsIOaIliBzaGVldFRva2VuJyk7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeW/heimgeWPguaVsCcsICdlcnJvcicpO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAn57y65bCR5b+F6KaB5Y+C5pWwJyB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzKG1lc3NhZ2UudXJsLCBtZXNzYWdlLnNoZWV0VG9rZW4pXG4gICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gc2VuZFJlc3BvbnNlKHsgc3VjY2VzczogdHJ1ZSB9KSlcbiAgICAgICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCflpITnkIYgRVhQQU5EX0VQSUNfVElDS0VUUyDml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOWxleW8gCBFcGljIOWksei0pTogJHtlcnJvci5tZXNzYWdlIHx8IGVycm9yfWAsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgU3RyaW5nKGVycm9yKSB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfmnKrlpITnkIbnmoTmtojmga/nsbvlnos6JywgdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxuLy8g5Yib5bu6IEpRTCDmn6Xor6Llr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIG9wZW5KcWxEaWFsb2codXJsOiBzdHJpbmcsIHNoZWV0VG9rZW46IHN0cmluZykge1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIHRvcDogNTAlO1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgICAgIHdpZHRoOiA0MDBweDtcbiAgICBgO1xuXG4gICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDtcIj7ovpPlhaUgSlFMIOafpeivojwvaDM+XG4gICAgICAgIDx0ZXh0YXJlYSBpZD1cImpxbFwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwcHg7IG1hcmdpbi1ib3R0b206IDEwcHg7XCI+PC90ZXh0YXJlYT5cbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XCI+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsXCIgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDEwcHg7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwic3VibWl0XCI+5p+l6K+iPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAvLyDmt7vliqDkuovku7bnm5HlkKzlmahcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3N1Ym1pdCcpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QganFsID0gKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdqcWwnKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50KS52YWx1ZTtcbiAgICAgICAgaWYgKGpxbCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+ato+WcqOafpeivoiBKaXJhLi4uJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGlja2V0cycsIHRpY2tldHMpO1xuICAgICAgICAgICAgICAgIGlmICghdGlja2V0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmsqHmnInmib7liLDmlbDmja4nLCAnd2FybmluZycpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFzaGVldFRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIOWJquWIh+adv+aooeW8j1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkRGF0YSA9IFtoZWFkZXJzLmpvaW4oJ1xcdCcpLCAuLi50aWNrZXRzLm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgXG4gICAgICAgICAgICAgICAgICAgICAgfSkpLm1hcCh0aWNrZXQgPT4gaGVhZGVycy5tYXAoZmllbGQgPT4gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnKS5qb2luKCdcXHQnKSldLmpvaW4oJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2Zvcm1hdHRlZERhdGEnLCBmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCdKaXJhIOaVsOaNruW3suWkjeWItuWIsOWJqui0tOadvycsICdzdWNjZXNzJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5o6l5Y+j5qih5byPXG4gICAgICAgICAgICAgICAgICAgIGlmICghdXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeihqOagvCBVUkwnLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0ID0gbmV3IFNoZWV0KHVybCwgc2hlZXRUb2tlbik7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC5pbml0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCBzaGVldC5yZWFkU2hlZXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd2YWx1ZXMnLCB2YWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXRIZWFkZXJzID0gYXdhaXQgZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheUhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddOyBcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZlcnJlZEtleUluZGV4ID0gdmFsdWVzWzBdPy5maW5kSW5kZXgoKGhlYWRlcjogc3RyaW5nKSA9PiBoZWFkZXIudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygna2V5JykgfHwgaGVhZGVyLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2ppcmEnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGluZmVycmVkS2V5SW5kZXggIT09IC0xICYmIGluZmVycmVkS2V5SW5kZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGVldEhlYWRlcnMua2V5ID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZmVycmVkS2V5SW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYOacquWcqOmFjee9ruS4reaJvuWIsCBLZXkg5YiX77yM5bey5o6o5pat5Li65YiXICR7c2hlZXRIZWFkZXJzLmtleX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+acquaJvuWIsOaIluaXoOazleaOqOaWrSBKaXJhIEtleSDliJfvvIzor7fmo4Dmn6XooajlpLTmiJbphY3nva4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleVRvUm93TWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlcy5zbGljZSgxKS5mb3JFYWNoKChyb3c6IHN0cmluZ1tdLCBpbmRleDogbnVtYmVyKSA9PiB7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleUNlbGwgPSByb3dbZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSEpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGtleSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2V5Q2VsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBrZXlDZWxsLm1hdGNoKC9icm93c2VcXC8oW0EtWjAtOV0rLVswLTldKykvaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXkgPSBtYXRjaFsxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL15bQS1aMC05XSstWzAtOV0rJC9pLnRlc3Qoa2V5Q2VsbC50cmltKCkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5ID0ga2V5Q2VsbC50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleVRvUm93TWFwLnNldChrZXksIGluZGV4ICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wZXJhdGlvbnM6IFRpY2tldE9wZXJhdGlvbltdID0gdGlja2V0cy5tYXAodGlja2V0ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1Jvd0luZGV4ID0ga2V5VG9Sb3dNYXAuZ2V0KHRpY2tldC5rZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogZXhpc3RpbmdSb3dJbmRleCAhPT0gdW5kZWZpbmVkID8gJ3VwZGF0ZScgOiAnYXBwZW5kJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SW5kZXg6IGV4aXN0aW5nUm93SW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpcm1lZE9wZXJhdGlvbnMgPSBhd2FpdCBzaG93Q29uZmlybWF0aW9uRGlhbG9nKG9wZXJhdGlvbnMsIGRpc3BsYXlIZWFkZXJzLCBzaGVldEhlYWRlcnMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlybWVkT3BlcmF0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+aTjeS9nOW3suWPlua2iCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZXNEYXRhOiBVcGRhdGVEYXRhW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFwcGVuZERhdGE6IHN0cmluZ1tdW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJWYWx1ZXMgPSBPYmplY3QudmFsdWVzKHNoZWV0SGVhZGVycykuZmlsdGVyKCh2YWx1ZSk6IHZhbHVlIGlzIHN0cmluZyA9PiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXhDb2xJbmRleCA9IGdldE1heENvbHVtbkluZGV4KGhlYWRlclZhbHVlcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpcm1lZE9wZXJhdGlvbnMuZm9yRWFjaChvcGVyYXRpb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IG5ldyBBcnJheShtYXhDb2xJbmRleCkuZmlsbCgnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheUhlYWRlcnMuZm9yRWFjaChmaWVsZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbHVtbkxldHRlciA9IHNoZWV0SGVhZGVyc1tmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbHVtbkxldHRlciAmJiB0eXBlb2YgY29sdW1uTGV0dGVyID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xJbmRleCA9IGdldENvbHVtbkluZGV4KGNvbHVtbkxldHRlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkID09PSAna2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHtvcGVyYXRpb24udGlja2V0LmtleX1cIiwgXCIke29wZXJhdGlvbi50aWNrZXQua2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IG9wZXJhdGlvbi50aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGDlpITnkIbliJcgJHtjb2x1bW5MZXR0ZXJ9ICjlrZfmrrUgJHtmaWVsZH0pIOaXtuWHuumUmTpgLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcGVyYXRpb24udHlwZSA9PT0gJ3VwZGF0ZScgJiYgb3BlcmF0aW9uLnJvd0luZGV4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlc0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dJbmRleDogb3BlcmF0aW9uLnJvd0luZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogcm93XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcGVuZERhdGEucHVzaChyb3cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn5pu05paw5pWw5o2uOicsIHVwZGF0ZXNEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfov73liqDmlbDmja46JywgYXBwZW5kRGF0YSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB1cGRhdGVkQ291bnQgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGFwcGVuZGVkQ291bnQgPSAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlc0RhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdXBkYXRlIG9mIHVwZGF0ZXNEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXJ0Q29sdW1uID0gJ0EnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByYW5nZSA9IGAke3N0YXJ0Q29sdW1ufSR7dXBkYXRlLnJvd0luZGV4fWA7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgVXBkYXRpbmcgcmFuZ2U6ICR7cmFuZ2V9YCwgdXBkYXRlLmRhdGEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0LndyaXRlU2hlZXQoW3VwZGF0ZS5kYXRhXSwgcmFuZ2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcHBlbmREYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGFydFBvc2l0aW9uID0gYEEke3ZhbHVlcy5sZW5ndGggKyAxfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEFwcGVuZGluZyBkYXRhIHN0YXJ0aW5nIGZyb206ICR7c3RhcnRQb3NpdGlvbn1gLCBhcHBlbmREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC53cml0ZVNoZWV0KGFwcGVuZERhdGEsIHN0YXJ0UG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcGVuZGVkQ291bnQgPSBhcHBlbmREYXRhLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHRvYXN0TWVzc2FnZSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVwZGF0ZWRDb3VudCA+IDApIHRvYXN0TWVzc2FnZSArPSBg5bey5pu05pawICR7dXBkYXRlZENvdW50fSDmnaHmlbDmja7jgIJgO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFwcGVuZGVkQ291bnQgPiAwKSB0b2FzdE1lc3NhZ2UgKz0gYOW3sui/veWKoCAke2FwcGVuZGVkQ291bnR9IOadoeaWsOaVsOaNruOAgmA7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodG9hc3RNZXNzYWdlID09PSAnJykgdG9hc3RNZXNzYWdlID0gJ+ayoeaciemcgOimgeabtOaWsOaIlui/veWKoOeahOaVsOaNruOAgic7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCh0b2FzdE1lc3NhZ2UudHJpbSgpLCAnc3VjY2VzcycpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdHb29nbGUgU2hlZXRzIOaTjeS9nOWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0dvb2dsZSBTaGVldHMg5pON5L2c5aSx6LSlOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogZXJyb3IpLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign5p+l6K+i5oiW5aSE55CG5aSx6LSlOiAnLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5p+l6K+i5oiW5aSE55CG5aSx6LSlOiAnICsgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogZXJyb3IpLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnMoZGlhbG9nKSkgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfor7fovpPlhaUgSlFMIOafpeivouivreWPpScsICd3YXJuaW5nJyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuaW50ZXJmYWNlIEppcmFIZWFkZXJzIHtcbiAgICBrZXk/OiBzdHJpbmc7XG4gICAgc3VtbWFyeT86IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgICBpc3N1ZXR5cGU/OiBzdHJpbmc7XG4gICAgcHJpb3JpdHk/OiBzdHJpbmc7XG4gICAgYXNzaWduZWU/OiBzdHJpbmc7XG4gICAgcmVwb3J0ZXI/OiBzdHJpbmc7XG4gICAgbGFiZWxzPzogc3RyaW5nO1xuICAgIGNvbXBvbmVudHM/OiBzdHJpbmc7XG4gICAgZml4VmVyc2lvbnM/OiBzdHJpbmc7XG4gICAgYWZmZWN0c1ZlcnNpb25zPzogc3RyaW5nO1xuICAgIGxpbmtlZElzc3Vlcz86IHN0cmluZztcbiAgICBlcGljTGluaz86IHN0cmluZztcbiAgICBzcHJpbnQ/OiBzdHJpbmc7XG4gICAgc3RvcnlQb2ludHM/OiBzdHJpbmc7XG4gICAgc3RhdHVzPzogc3RyaW5nO1xuICAgIFtrZXk6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIFVwZGF0ZURhdGEge1xuICAgIHJvd0luZGV4OiBudW1iZXI7XG4gICAgZGF0YTogc3RyaW5nW107XG59XG5cbmludGVyZmFjZSBUaWNrZXRPcGVyYXRpb24ge1xuICAgIHRpY2tldDogSmlyYVRpY2tldDtcbiAgICB0eXBlOiAndXBkYXRlJyB8ICdhcHBlbmQnO1xuICAgIHJvd0luZGV4PzogbnVtYmVyO1xufVxuXG4vLyDmn6Xmib7mnInmlYjnmoRKaXJh5a2X5q616KGo5aS0XG5hc3luYyBmdW5jdGlvbiBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldDogU2hlZXQpOiBQcm9taXNlPEppcmFIZWFkZXJzPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgbGV0IGhlYWRlck1hcHBpbmc6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgY29uc3QgY3VzdG9tRmllbGRNYXBwaW5nOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG4gICAgICAgIFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnRGF0YSA9IGF3YWl0IHNoZWV0LnJlYWRDb25maWdTaGVldCgpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2NvbmZpZ0RhdGEnLCBjb25maWdEYXRhKTtcbiAgICAgICAgICAgIGlmIChjb25maWdEYXRhICYmIGNvbmZpZ0RhdGEubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzaGVldEhlYWRlckluZGV4ID0gY29uZmlnRGF0YVswXS5maW5kSW5kZXgoKGg6IHN0cmluZykgPT4gaC50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzaGVldCBoZWFkZXInKSk7XG4gICAgICAgICAgICAgICAgY29uc3QgamlyYUZpZWxkSW5kZXggPSBjb25maWdEYXRhWzBdLmZpbmRJbmRleCgoaDogc3RyaW5nKSA9PiBoLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2ppcmEgZmllbGQnKSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2hlZXRIZWFkZXJJbmRleCA9PT0gLTEgfHwgamlyYUZpZWxkSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign6YWN572u6KGo5Lit5pyq5om+5YiwIFwiU2hlZXQgSGVhZGVyXCIg5oiWIFwiSmlyYSBGaWVsZFwiIOWIl++8jOWwhuS9v+eUqOm7mOiupOWIq+WQjScpO1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29uZmlnIHNoZWV0IGhlYWRlcnMnKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IGNvbmZpZ0RhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gY29uZmlnRGF0YVtpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJvdy5sZW5ndGggPiBNYXRoLm1heChzaGVldEhlYWRlckluZGV4LCBqaXJhRmllbGRJbmRleCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVyID0gcm93W3NoZWV0SGVhZGVySW5kZXhdPy50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBqaXJhRmllbGQgPSByb3dbamlyYUZpZWxkSW5kZXhdPy50cmltKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaGVldEhlYWRlciAmJiBqaXJhRmllbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoamlyYUZpZWxkLnRvTG93ZXJDYXNlKCkgPT09ICdqaXJhIGtleScgfHwgamlyYUZpZWxkLnRvTG93ZXJDYXNlKCkgPT09ICdrZXknKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGppcmFGaWVsZCA9ICdrZXknO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJNYXBwaW5nW3NoZWV0SGVhZGVyXSA9IGppcmFGaWVsZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoamlyYUZpZWxkLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aCgnY3VzdG9tZmllbGRfJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VzdG9tRmllbGRNYXBwaW5nW3NoZWV0SGVhZGVyXSA9IGppcmFGaWVsZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfku47phY3nva7ooajliqDovb3nmoTmmKDlsIQ6JywgaGVhZGVyTWFwcGluZyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ+mFjee9ruihqOaVsOaNruS4uuepuuaIluagvOW8j+S4jeato+ehru+8jOWwhuS9v+eUqOm7mOiupOWIq+WQjScpO1xuICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+mFjee9ruihqOaVsOaNruS4uuepuuaIluagvOW8j+S4jeato+ehricpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfor7vlj5bphY3nva7ooajlpLHotKXvvIzlsIbkvb/nlKjpu5jorqTlrZfmrrXliKvlkI06JywgZXJyb3IpO1xuICAgICAgICAgICAgaGVhZGVyTWFwcGluZyA9IHtcbiAgICAgICAgICAgICAgICAna2V5JzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2ppcmEnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBsaW5rJzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2ppcmEgaWQnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnaWQnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnaXNzdWUga2V5JzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ3N1bW1hcnknOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ3RpdGxlJzogJ3N1bW1hcnknLFxuICAgICAgICAgICAgICAgICfmpoLopoEnOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ2Rlc2NyaXB0aW9uJzogJ2Rlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgICAgICAn5o+P6L+wJzogJ2Rlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgICAgICAndHlwZSc6ICdpc3N1ZXR5cGUnLFxuICAgICAgICAgICAgICAgICdpc3N1ZSB0eXBlJzogJ2lzc3VldHlwZScsXG4gICAgICAgICAgICAgICAgJ+exu+Weiyc6ICdpc3N1ZXR5cGUnLFxuICAgICAgICAgICAgICAgICdwcmlvcml0eSc6ICdwcmlvcml0eScsXG4gICAgICAgICAgICAgICAgJ+S8mOWFiOe6pyc6ICdwcmlvcml0eScsXG4gICAgICAgICAgICAgICAgJ2Fzc2lnbmVlJzogJ2Fzc2lnbmVlJyxcbiAgICAgICAgICAgICAgICAn57uP5Yqe5Lq6JzogJ2Fzc2lnbmVlJyxcbiAgICAgICAgICAgICAgICAncmVwb3J0ZXInOiAncmVwb3J0ZXInLFxuICAgICAgICAgICAgICAgICfmiqXlkYrkuronOiAncmVwb3J0ZXInLFxuICAgICAgICAgICAgICAgICdzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgICAgICAgICAgICAn54q25oCBJzogJ3N0YXR1cycsXG4gICAgICAgICAgICAgICAgJ2xhYmVscyc6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICdsYWJlbCc6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICfmoIfnrb4nOiAnbGFiZWxzJyxcbiAgICAgICAgICAgICAgICAnY29tcG9uZW50cyc6ICdjb21wb25lbnRzJyxcbiAgICAgICAgICAgICAgICAnY29tcG9uZW50JzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICfmqKHlnZcnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ2ZpeCB2ZXJzaW9ucyc6ICdmaXhWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2ZpeCB2ZXJzaW9uJzogJ2ZpeFZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAn5L+u5aSN54mI5pysJzogJ2ZpeFZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAnYWZmZWN0cyB2ZXJzaW9ucyc6ICdhZmZlY3RzVmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdhZmZlY3QgdmVyc2lvbic6ICdhZmZlY3RzVmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICflvbHlk43niYjmnKwnOiAnYWZmZWN0c1ZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAnbGlua2VkIGlzc3Vlcyc6ICdsaW5rZWRJc3N1ZXMnLFxuICAgICAgICAgICAgICAgICflhbPogZTpl67popgnOiAnbGlua2VkSXNzdWVzJyxcbiAgICAgICAgICAgICAgICAnZXBpYyBsaW5rJzogJ2VwaWNMaW5rJyxcbiAgICAgICAgICAgICAgICAnZXBpYyc6ICdlcGljTGluaycsXG4gICAgICAgICAgICAgICAgJ3NwcmludCc6ICdzcHJpbnQnLFxuICAgICAgICAgICAgICAgICflhrLliLonOiAnc3ByaW50JyxcbiAgICAgICAgICAgICAgICAnc3RvcnkgcG9pbnRzJzogJ3N0b3J5UG9pbnRzJyxcbiAgICAgICAgICAgICAgICAnc3RvcnkgcG9pbnQnOiAnc3RvcnlQb2ludHMnLFxuICAgICAgICAgICAgICAgICfmlYXkuovngrknOiAnc3RvcnlQb2ludHMnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaGVhZGVycyA9IGF3YWl0IHNoZWV0LmdldEhlYWRlcnMoKTtcbiAgICAgICAgY29uc29sZS5sb2coJ1NoZWV0IEhlYWRlcnM6JywgaGVhZGVycyk7XG4gICAgICAgIGNvbnN0IHZhbGlkSGVhZGVyczogSmlyYUhlYWRlcnMgPSB7fTtcblxuICAgICAgICBjb25zdCBrbm93bkZpZWxkcyA9IFtcbiAgICAgICAgICAgICdrZXknLCAnc3VtbWFyeScsICdkZXNjcmlwdGlvbicsICdpc3N1ZXR5cGUnLCAncHJpb3JpdHknLCBcbiAgICAgICAgICAgICdhc3NpZ25lZScsICdyZXBvcnRlcicsICdzdGF0dXMnLCAnbGFiZWxzJywgJ2NvbXBvbmVudHMnLCBcbiAgICAgICAgICAgICdmaXhWZXJzaW9ucycsICdhZmZlY3RzVmVyc2lvbnMnLCAnbGlua2VkSXNzdWVzJywgJ2VwaWNMaW5rJywgXG4gICAgICAgICAgICAnc3ByaW50JywgJ3N0b3J5UG9pbnRzJ1xuICAgICAgICBdO1xuXG4gICAgICAgIGhlYWRlcnMuZm9yRWFjaCgoaGVhZGVyOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGlmICghaGVhZGVyKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJMb3dlciA9IGhlYWRlci50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbHVtbkxldHRlciA9IFN0cmluZy5mcm9tQ2hhckNvZGUoNjUgKyBpbmRleCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChoZWFkZXJNYXBwaW5nW2hlYWRlckxvd2VyXSkge1xuICAgICAgICAgICAgICAgICBjb25zdCBqaXJhRmllbGQgPSBoZWFkZXJNYXBwaW5nW2hlYWRlckxvd2VyXTtcbiAgICAgICAgICAgICAgICAgaWYgKCF2YWxpZEhlYWRlcnNbamlyYUZpZWxkXSkge1xuICAgICAgICAgICAgICAgICAgICAgdmFsaWRIZWFkZXJzW2ppcmFGaWVsZF0gPSBjb2x1bW5MZXR0ZXI7XG4gICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg6YWN572uL+WIq+WQjeWMuemFjTogXCIke2hlYWRlcn1cIiAtPiBcIiR7amlyYUZpZWxkfVwiICjliJcgJHtjb2x1bW5MZXR0ZXJ9KWApO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihg5YiXICR7Y29sdW1uTGV0dGVyfSAoXCIke2hlYWRlcn1cIikg55qE5Yir5ZCNIFwiJHtoZWFkZXJMb3dlcn1cIiDkuI7liJcgJHt2YWxpZEhlYWRlcnNbamlyYUZpZWxkXX0g5Yay56qB77yM6YO95oyH5ZCRIFwiJHtqaXJhRmllbGR9XCLjgILlsIbkvb/nlKjnrKzkuIDkuKrljLnphY3jgIJgKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdE1hdGNoID0ga25vd25GaWVsZHMuZmluZChmaWVsZCA9PiBmaWVsZC50b0xvd2VyQ2FzZSgpID09PSBoZWFkZXJMb3dlcik7XG4gICAgICAgICAgICBpZiAoZGlyZWN0TWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgaWYgKCF2YWxpZEhlYWRlcnNbZGlyZWN0TWF0Y2hdKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbGlkSGVhZGVyc1tkaXJlY3RNYXRjaF0gPSBjb2x1bW5MZXR0ZXI7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDnm7TmjqXlrZfmrrXlkI3ljLnphY06IFwiJHtoZWFkZXJ9XCIgLT4gXCIke2RpcmVjdE1hdGNofVwiICjliJcgJHtjb2x1bW5MZXR0ZXJ9KWApO1xuICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYOWIlyAke2NvbHVtbkxldHRlcn0gKFwiJHtoZWFkZXJ9XCIpIOeahOebtOaOpeWMuemFjeS4juWIlyAke3ZhbGlkSGVhZGVyc1tkaXJlY3RNYXRjaF19IOWGsueqge+8jOmDveaMh+WQkSBcIiR7ZGlyZWN0TWF0Y2h9XCLjgILlsIbkvb/nlKjnrKzkuIDkuKrljLnphY3jgIJgKTtcbiAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICByZXR1cm47IFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghdmFsaWRIZWFkZXJzLmtleSkge1xuICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIuacquiDveiHquWKqOaYoOWwhCAna2V5JyDliJfjgILor7fmo4Dmn6XooajlpLTmiJblnKjphY3nva7ooajkuK3mmI7noa7mjIflrpogJ2tleScg5oiWICdKaXJhIEtleSfjgIJcIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmxvZygn5pyA57uI5pyJ5pWI6KGo5aS05pig5bCEOicsIHZhbGlkSGVhZGVycyk7XG4gICAgICAgIHJldHVybiB2YWxpZEhlYWRlcnM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign5p+l5om+5pyJ5pWIIEppcmEg5qCH6aKY5pe25Ye66ZSZOicsIGVycm9yKTtcbiAgICAgICAgc2hvd1RvYXN0KCfmn6Xmib7ooajlpLTmmKDlsITml7blh7rplJk6ICcgKyAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBlcnJvciksICdlcnJvcicpXG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29sdW1uSW5kZXgoY29sdW1uOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGlmICghY29sdW1uIHx8IHR5cGVvZiBjb2x1bW4gIT09ICdzdHJpbmcnIHx8ICEvXltBLVpdKyQvLnRlc3QoY29sdW1uLnRvVXBwZXJDYXNlKCkpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihg5peg5pWI55qE5YiX5qCH6K+G56ymOiBcIiR7Y29sdW1ufVwiYCk7XG4gICAgfVxuICAgIGNvbnN0IHVwcGVyQ29sdW1uID0gY29sdW1uLnRvVXBwZXJDYXNlKCk7XG4gICAgbGV0IGluZGV4ID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVwcGVyQ29sdW1uLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGluZGV4ID0gaW5kZXggKiAyNiArICh1cHBlckNvbHVtbi5jaGFyQ29kZUF0KGkpIC0gNjQpO1xuICAgIH1cbiAgICByZXR1cm4gaW5kZXggLSAxO1xufVxuXG5mdW5jdGlvbiBnZXRNYXhDb2x1bW5JbmRleChjb2x1bW5MZXR0ZXJzOiBzdHJpbmdbXSk6IG51bWJlciB7XG4gICAgIGlmICghY29sdW1uTGV0dGVycyB8fCAhQXJyYXkuaXNBcnJheShjb2x1bW5MZXR0ZXJzKSB8fCBjb2x1bW5MZXR0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgcmV0dXJuIDA7XG4gICAgIH1cbiAgICAgY29uc3QgdmFsaWRMZXR0ZXJzID0gY29sdW1uTGV0dGVycy5maWx0ZXIoaCA9PiB0eXBlb2YgaCA9PT0gJ3N0cmluZycgJiYgL15bQS1aXSskLy50ZXN0KGgudG9VcHBlckNhc2UoKSkpO1xuICAgICBpZiAodmFsaWRMZXR0ZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgIGNvbnN0IGluZGljZXMgPSB2YWxpZExldHRlcnMubWFwKGNvbCA9PiBnZXRDb2x1bW5JbmRleChjb2wpKTtcbiAgICAgcmV0dXJuIE1hdGgubWF4KC4uLmluZGljZXMpICsgMTtcbn1cblxuLy8g5pi+56S656Gu6K6k5by556qXXG5hc3luYyBmdW5jdGlvbiBzaG93Q29uZmlybWF0aW9uRGlhbG9nKFxuICAgIG9wZXJhdGlvbnM6IFRpY2tldE9wZXJhdGlvbltdLFxuICAgIGRpc3BsYXlIZWFkZXJzOiBzdHJpbmdbXSxcbiAgICBzaGVldEhlYWRlcnM6IEppcmFIZWFkZXJzXG4pOiBQcm9taXNlPFRpY2tldE9wZXJhdGlvbltdPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBkaWFsb2cuaWQgPSAnamlyYUNvbmZpcm1hdGlvbkRpYWxvZyc7XG4gICAgICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICAgICAgei1pbmRleDogMTAwMDE7XG4gICAgICAgICAgICB3aWR0aDogODAwcHg7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDkwdnc7XG4gICAgICAgICAgICBtYXgtaGVpZ2h0OiA4MHZoO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgIGA7XG5cbiAgICAgICAgY29uc3QgY29sdW1uc1RvVXBkYXRlID0gZGlzcGxheUhlYWRlcnNcbiAgICAgICAgICAgIC5maWx0ZXIoZmllbGQgPT4gc2hlZXRIZWFkZXJzW2ZpZWxkIGFzIGtleW9mIEppcmFIZWFkZXJzXSlcbiAgICAgICAgICAgIC5tYXAoZmllbGQgPT4gZmllbGQpO1xuXG4gICAgICAgIGNvbnN0IHVwZGF0ZUNvdW50ID0gb3BlcmF0aW9ucy5maWx0ZXIob3AgPT4gb3AudHlwZSA9PT0gJ3VwZGF0ZScpLmxlbmd0aDtcbiAgICAgICAgY29uc3QgYXBwZW5kQ291bnQgPSBvcGVyYXRpb25zLmZpbHRlcihvcCA9PiBvcC50eXBlID09PSAnYXBwZW5kJykubGVuZ3RoO1xuXG4gICAgICAgIGRpYWxvZy5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBmbGV4LXNocmluazogMDtcIj7noa7orqTmlbDmja7mk43kvZw8L2gzPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDE1cHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxMHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICA8c3Ryb25nPuWwhuimgeaTjeS9nOeahOWIl++8mjwvc3Ryb25nPiBcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjogIzY2NjtcIj4ke2NvbHVtbnNUb1VwZGF0ZS5qb2luKCcsICcpfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPVwiY29sb3I6ICM2NjY7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+5pu05paw546w5pyJ5pWw5o2u77yaJHt1cGRhdGVDb3VudH0g5p2hPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+5paw5aKe5pWw5o2u77yaJHthcHBlbmRDb3VudH0g5p2hPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxMHB4OyBmbGV4LXNocmluazogMDtcIj5cbiAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyO1wiPlxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgaWQ9XCJzZWxlY3RBbGxUaWNrZXRzXCIgY2hlY2tlZCBzdHlsZT1cIm1hcmdpbi1yaWdodDogNXB4O1wiPlxuICAgICAgICAgICAgICAgICAgICDlhajpgIkv5Y+W5raI5YWo6YCJXG4gICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJmbGV4LWdyb3c6IDE7IG92ZXJmbG93LXk6IGF1dG87IGJvcmRlcjogMXB4IHNvbGlkICNlZWU7IGJvcmRlci1yYWRpdXM6IDRweDsgbWFyZ2luLWJvdHRvbTogMTVweDtcIj5cbiAgICAgICAgICAgICAgICA8dGFibGUgc3R5bGU9XCJ3aWR0aDogMTAwJTsgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTtcIj5cbiAgICAgICAgICAgICAgICAgICAgPHRoZWFkIHN0eWxlPVwicG9zaXRpb246IHN0aWNreTsgdG9wOiAwOyBiYWNrZ3JvdW5kOiAjZjVmNWY1OyB6LWluZGV4OiAxO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgd2lkdGg6IDUwcHg7XCI+6YCJ5oupPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7IHdpZHRoOiA4MHB4O1wiPuaTjeS9nDwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtkaXNwbGF5SGVhZGVycy5tYXAoaGVhZGVyID0+IGA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7XCI+JHtoZWFkZXJ9PC90aD5gKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgIDx0Ym9keT5cbiAgICAgICAgICAgICAgICAgICAgICAgICR7b3BlcmF0aW9ucy5tYXAoKG9wLCBpbmRleCkgPT4gYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ciBzdHlsZT1cImJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjZWVlO1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgY2xhc3M9XCJ0aWNrZXQtY2hlY2tib3hcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIiBjaGVja2VkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT1cImNvbG9yOiAke29wLnR5cGUgPT09ICd1cGRhdGUnID8gJyNmMGFkNGUnIDogJyM1Y2I4NWMnfTsgZm9udC13ZWlnaHQ6IGJvbGQ7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtvcC50eXBlID09PSAndXBkYXRlJyA/ICfmm7TmlrAnIDogJ+aWsOWinid9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZGlzcGxheUhlYWRlcnMubWFwKGZpZWxkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2YWx1ZSA9IG9wLnRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZS5sZW5ndGggPiAxMDApIHZhbHVlID0gdmFsdWUuc3Vic3RyaW5nKDAsIDk3KSArICcuLi4nOyBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4OyB3aGl0ZS1zcGFjZTogbm93cmFwOyBvdmVyZmxvdzogaGlkZGVuOyB0ZXh0LW92ZXJmbG93OiBlbGxpcHNpczsgbWF4LXdpZHRoOiAyMDBweDtcIiB0aXRsZT1cIiR7b3AudGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnfVwiPiR7dmFsdWV9PC90ZD5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgYCkuam9pbignJyl9XG4gICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICAgICAgPC90YWJsZT5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7IGdhcDogMTBweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cImNhbmNlbE9wZXJhdGlvblwiIHN0eWxlPVwicGFkZGluZzogNnB4IDEycHg7IGJhY2tncm91bmQ6ICNlZWU7IGJvcmRlcjogMXB4IHNvbGlkICNjY2M7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuWPlua2iDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjb25maXJtT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogIzAwN2JmZjsgY29sb3I6IHdoaXRlOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDRweDsgY3Vyc29yOiBwb2ludGVyO1wiPuehruiupCAoJHtvcGVyYXRpb25zLmxlbmd0aH0pPC9idXR0b24+IFxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG5cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkaWFsb2cpO1xuXG4gICAgICAgIGNvbnN0IHNlbGVjdEFsbENoZWNrYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlbGVjdEFsbFRpY2tldHMnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuICAgICAgICBjb25zdCB0aWNrZXRDaGVja2JveGVzID0gZGlhbG9nLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3RpY2tldC1jaGVja2JveCcpIGFzIEhUTUxDb2xsZWN0aW9uT2Y8SFRNTElucHV0RWxlbWVudD47XG4gICAgICAgIGNvbnN0IGNvbmZpcm1CdXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybU9wZXJhdGlvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG4gICAgICAgIGNvbnN0IHVwZGF0ZUNvbmZpcm1CdXR0b25Db3VudCA9ICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkQ291bnQgPSBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmZpbHRlcihjYiA9PiBjYi5jaGVja2VkKS5sZW5ndGg7XG4gICAgICAgICAgICBjb25maXJtQnV0dG9uLnRleHRDb250ZW50ID0gYOehruiupCAoJHtzZWxlY3RlZENvdW50fSlgO1xuICAgICAgICAgICAgY29uZmlybUJ1dHRvbi5kaXNhYmxlZCA9IHNlbGVjdGVkQ291bnQgPT09IDA7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZWN0QWxsQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgICAgICBjaGVja2JveC5jaGVja2VkID0gc2VsZWN0QWxsQ2hlY2tib3guY2hlY2tlZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZm9yRWFjaChjaGVja2JveCA9PiB7XG4gICAgICAgICAgICBjaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgc2VsZWN0QWxsQ2hlY2tib3guY2hlY2tlZCA9IEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZXZlcnkoY2IgPT4gY2IuY2hlY2tlZCk7XG4gICAgICAgICAgICAgICAgdXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbmNlbE9wZXJhdGlvbicpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIHJlc29sdmUoW10pO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25maXJtQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRPcGVyYXRpb25zID0gQXJyYXkuZnJvbSh0aWNrZXRDaGVja2JveGVzKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoY2hlY2tib3ggPT4gY2hlY2tib3guY2hlY2tlZClcbiAgICAgICAgICAgICAgICAubWFwKGNoZWNrYm94ID0+IG9wZXJhdGlvbnNbcGFyc2VJbnQoY2hlY2tib3guZGF0YXNldC5pbmRleCB8fCAnMCcpXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIHJlc29sdmUoc2VsZWN0ZWRPcGVyYXRpb25zKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdXBkYXRlQ29uZmlybUJ1dHRvbkNvdW50KCk7IFxuICAgIH0pO1xufVxuXG4vLyDmt7vliqDmmL7npLogdG9hc3Qg55qE5Ye95pWwXG5mdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nLCB0eXBlID0gJ2luZm8nKSB7XG4gICAgY29uc3QgZXhpc3RpbmdUb2FzdHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGAuamlyYS10b2FzdC0ke3R5cGV9YCk7XG4gICAgZXhpc3RpbmdUb2FzdHMuZm9yRWFjaCh0ID0+IHQucmVtb3ZlKCkpO1xuXG4gICAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB0b2FzdC5jbGFzc05hbWUgPSBgamlyYS10b2FzdC0ke3R5cGV9YDtcbiAgICB0b2FzdC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgbGV0IGJhY2tncm91bmRDb2xvciA9ICdyZ2JhKDAsIDAsIDAsIDAuNyknO1xuICAgIGlmICh0eXBlID09PSAnZXJyb3InKSBiYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgyMjAsIDUzLCA2OSwgMC45KSc7XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gJ3N1Y2Nlc3MnKSBiYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSg0MCwgMTY3LCA2OSwgMC45KSc7XG4gICAgZWxzZSBpZiAodHlwZSA9PT0gJ3dhcm5pbmcnKSBiYWNrZ3JvdW5kQ29sb3IgPSAncmdiYSgyNTUsIDE5MywgNywgMC45KSc7XG5cbiAgICB0b2FzdC5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIGJvdHRvbTogMjBweDtcbiAgICAgICAgbGVmdDogNTAlO1xuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6ICR7YmFja2dyb3VuZENvbG9yfTtcbiAgICAgICAgY29sb3I6ICR7dHlwZSA9PT0gJ3dhcm5pbmcnID8gJ2JsYWNrJyA6ICd3aGl0ZSd9O1xuICAgICAgICBwYWRkaW5nOiAxMHB4IDIwcHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgICAgICAgYm94LXNoYWRvdzogMCAycHggNXB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICAgICAgei1pbmRleDogMTAwMDE7XG4gICAgICAgIG9wYWNpdHk6IDA7XG4gICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4zcyBlYXNlO1xuICAgIGA7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b2FzdCk7XG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgdG9hc3Quc3R5bGUub3BhY2l0eSA9ICcxJztcbiAgICB9KTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdG9hc3Quc3R5bGUub3BhY2l0eSA9ICcwJztcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICAgICAgfSwgMzAwKTtcbiAgICB9LCAzMDAwKTtcbn1cblxuLy8g5paw5aKe77ya5aSE55CG5bGV5byAIEVwaWMgVGlja2V0cyDnmoTlh73mlbBcbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzKHNoZWV0VXJsOiBzdHJpbmcsIHRva2VuOiBzdHJpbmcpIHtcbiAgICBzaG93VG9hc3QoJ+W8gOWni+afpeaJviBFcGljIOW5tuiOt+WPluWtkOS7u+WKoS4uLicpO1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IHNoZWV0ID0gbmV3IFNoZWV0KHNoZWV0VXJsLCB0b2tlbik7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCBzaGVldC5yZWFkU2hlZXQoKTtcbiAgICAgICAgaWYgKCF2YWx1ZXMgfHwgdmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfooajmoLzkuLrnqbrmiJbml6Dms5Xor7vlj5YnLCAnZXJyb3InKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzaGVldEhlYWRlcnMgPSBhd2FpdCBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldCk7XG5cbiAgICAgICAgLy8g5om+5YiwIGtleSDliJfnmoTntKLlvJVcbiAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgaWYgKGtleUNvbHVtbkluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfmnKrmib7liLAgSmlyYSBLZXkg5YiX77yM6K+35qOA5p+l6KGo5aS05oiW6YWN572uJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5sb2coJ0ppcmEgS2V5IOWIl+e0ouW8lTonLCBrZXlDb2x1bW5JbmRleCk7XG5cbiAgICAgICAgY29uc3QgZXBpY3NUb0V4cGFuZDogeyBlcGljS2V5OiBzdHJpbmc7IGVwaWNTdW1tYXJ5OiBzdHJpbmc7IHJvd0luZGV4OiBudW1iZXI7IHN1YlRpY2tldHM6IEppcmFUaWNrZXRbXSB9W10gPSBbXTtcblxuICAgICAgICAvLyDpgY3ljobooajmoLzmn6Xmib4gRXBpYyBLZXkg5bm25p+l6K+i5a2Q5Lu75YqhXG4gICAgICAgIC8vIOS7juesrOS6jOihjOW8gOWni++8jOi3s+i/h+ihqOWktFxuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHZhbHVlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgcm93ID0gdmFsdWVzW2ldO1xuICAgICAgICAgICAgY29uc3Qga2V5Q2VsbENvbnRlbnQgPSByb3dba2V5Q29sdW1uSW5kZXhdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDlsJ3or5Xku44gSFlQRVJMSU5LIOaIlue6r+aWh+acrOS4reaPkOWPliBrZXlcbiAgICAgICAgICAgIGxldCBlcGljS2V5ID0gJyc7XG4gICAgICAgICAgICBpZiAoa2V5Q2VsbENvbnRlbnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaCA9IGtleUNlbGxDb250ZW50Lm1hdGNoKC9icm93c2VcXC8oW0EtWjAtOV0rLVswLTldKykvaSk7IC8vIOaPkOWPliBicm93c2UvIOWQjumdoueahCBLZXlcbiAgICAgICAgICAgICAgICAgaWYgKG1hdGNoICYmIG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgICBlcGljS2V5ID0gbWF0Y2hbMV07XG4gICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoL15bQS1aMC05XSstWzAtOV0rJC9pLnRlc3Qoa2V5Q2VsbENvbnRlbnQudHJpbSgpKSkgeyAvLyDlpoLmnpzmmK/nuq8gS2V5XG4gICAgICAgICAgICAgICAgICAgIGVwaWNLZXkgPSBrZXlDZWxsQ29udGVudC50cmltKCk7XG4gICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoZXBpY0tleSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDmib7liLAgS2V5OiAke2VwaWNLZXl9IOWcqOihjCAke2kgKyAxfWApO1xuICAgICAgICAgICAgICAgIGNvbnN0IGpxbCA9IGBpc3N1ZUZ1bmN0aW9uIGluIGlzc3Vlc0luRXBpY3MoXCJrZXkgPSAke2VwaWNLZXl9XCIpYDtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJUaWNrZXRzID0gYXdhaXQgZmV0Y2hKaXJhVGlja2V0cyhqcWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3ViVGlja2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXBpYyAke2VwaWNLZXl9IOaciSAke3N1YlRpY2tldHMubGVuZ3RofSDkuKrlrZDku7vliqFgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWwneivleiOt+WPliBFcGljIOeahOamguimgeS/oeaBr++8iOWmguaenOWFtuS7luWIl+WtmOWcqO+8iVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeUNvbHVtbkluZGV4ID0gc2hlZXRIZWFkZXJzLnN1bW1hcnkgPyBnZXRDb2x1bW5JbmRleChzaGVldEhlYWRlcnMuc3VtbWFyeSkgOiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVwaWNTdW1tYXJ5ID0gc3VtbWFyeUNvbHVtbkluZGV4ICE9PSAtMSAmJiByb3dbc3VtbWFyeUNvbHVtbkluZGV4XSA/IHJvd1tzdW1tYXJ5Q29sdW1uSW5kZXhdIDogZXBpY0tleTsgLy8gRGVmYXVsdCB0byBrZXkgaWYgc3VtbWFyeSBtaXNzaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGVwaWNzVG9FeHBhbmQucHVzaCh7IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVwaWNLZXksIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVwaWNTdW1tYXJ5OiBlcGljU3VtbWFyeSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dJbmRleDogaSwgLy8gMC1iYXNlZCBpbmRleFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YlRpY2tldHMgXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXBpYyAke2VwaWNLZXl9IOayoeacieWtkOS7u+WKoeaIluS4jeaYryBFcGljYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChmZXRjaEVycm9yOiBFcnJvciB8IGFueSkgeyAvLyBTcGVjaWZ5IHR5cGUgZm9yIGZldGNoRXJyb3JcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihg5p+l6K+iIEVwaWMgJHtlcGljS2V5fSDnmoTlrZDku7vliqHlpLHotKU6YCwgZmV0Y2hFcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIC8vIOmAieaLqeaAp+WcsOmAmuefpeeUqOaIt+aIlue7p+e7reWkhOeQhuS4i+S4gOS4qlxuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOafpeivoiAke2VwaWNLZXl9IOWtkOS7u+WKoeWksei0pTogJHtmZXRjaEVycm9yLm1lc3NhZ2UgfHwgZmV0Y2hFcnJvcn1gLCAnZXJyb3InKTsgLy8gU2hvdyBlcnJvciBtZXNzYWdlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhg6KGMICR7aSArIDF9IOacquaJvuWIsOacieaViOeahCBLZXlgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlcGljc1RvRXhwYW5kLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrmib7liLDku7vkvZXljIXlkKvlrZDku7vliqHnmoQgRXBpYycsICdpbmZvJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzaG93VG9hc3QoYOaJvuWIsCAke2VwaWNzVG9FeHBhbmQubGVuZ3RofSDkuKogRXBpYyDljIXlkKvlrZDku7vliqHvvIzlh4blpIfnoa7orqTmk43kvZwuLi5gKTtcblxuICAgICAgICAvLyAtLS0g5LiL5LiA5q2lOiDkv67mlLnnoa7orqTlr7nor53moYblubblpITnkIbmj5LlhaUv5YiG57uEIC0tLVxuICAgICAgICBjb25zb2xlLmxvZygn5YeG5aSH56Gu6K6k55qEIEVwaWNzOicsIGVwaWNzVG9FeHBhbmQpO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY29uZmlybWVkRXBpY3MgPSBhd2FpdCBzaG93RXBpY0NvbmZpcm1hdGlvbkRpYWxvZyhlcGljc1RvRXhwYW5kKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjb25maXJtZWRFcGljcyAmJiBjb25maXJtZWRFcGljcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBhd2FpdCBpbnNlcnRTdWJUaWNrZXRzKHNoZWV0LCBjb25maXJtZWRFcGljcywgc2hlZXRIZWFkZXJzLCBlbnZDb25maWcuSklSQV9CQVNFX1VSTCk7XG4gICAgICAgICAgICBzaG93VG9hc3QoYOW3suaIkOWKn+WxleW8gCAke2NvbmZpcm1lZEVwaWNzLmxlbmd0aH0g5LiqIEVwaWMg55qE5a2Q5Lu75YqhYCwgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pON5L2c5bey5Y+W5raIJywgJ2luZm8nKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5Li05pe25Y2g5L2N56ym77yM6KGo56S65rWB56iL6L+b6KGM5Yiw6L+Z6YeMXG4gICAgICAgIHNob3dUb2FzdCgn5a2Q5Lu75Yqh5p+l5om+5a6M5oiQ77yM56Gu6K6k44CB5o+S5YWl5ZKM5YiG57uE5Yqf6IO95b6F5a6e546wJywgJ3dhcm5pbmcnKTtcblxuXG4gICAgfSBjYXRjaCAoZXJyb3I6IEVycm9yIHwgYW55KSB7IC8vIFNwZWNpZnkgdHlwZSBmb3IgZXJyb3JcbiAgICAgICAgY29uc29sZS5lcnJvcign5aSE55CGIEVwaWMg5bGV5byA5pe25Ye66ZSZOicsIGVycm9yKTtcbiAgICAgICAgc2hvd1RvYXN0KCflpITnkIYgRXBpYyDlsZXlvIDml7blh7rplJk6ICcgKyAoZXJyb3IubWVzc2FnZSB8fCBlcnJvciksICdlcnJvcicpOyAvLyBVc2UgZXJyb3IubWVzc2FnZSBpZiBhdmFpbGFibGVcbiAgICAgICAgdGhyb3cgZXJyb3I7IC8vIFJlLXRocm93IGVycm9yIHRvIGJlIGNhdWdodCBieSB0aGUgY2FsbGVyXG4gICAgfVxufVxuXG4vLyBFcGljIOehruiupOWvueivneahhlxuYXN5bmMgZnVuY3Rpb24gc2hvd0VwaWNDb25maXJtYXRpb25EaWFsb2coXG4gICAgZXBpY3M6IHsgZXBpY0tleTogc3RyaW5nOyBlcGljU3VtbWFyeTogc3RyaW5nOyByb3dJbmRleDogbnVtYmVyOyBzdWJUaWNrZXRzOiBKaXJhVGlja2V0W10gfVtdXG4pOiBQcm9taXNlPHR5cGVvZiBlcGljcz4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCBkaWFsb2cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgICAgIHdpZHRoOiA4MDBweDtcbiAgICAgICAgICAgIG1heC13aWR0aDogOTB2dztcbiAgICAgICAgICAgIG1heC1oZWlnaHQ6IDgwdmg7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICAgICAgYDtcblxuICAgICAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDsgZmxleC1zaHJpbms6IDA7XCI+56Gu6K6k5bGV5byAIEVwaWM8L2gzPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDE1cHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJjb2xvcjogIzY2NjtcIj5cbiAgICAgICAgICAgICAgICAgICAg5om+5YiwICR7ZXBpY3MubGVuZ3RofSDkuKrljIXlkKvlrZDku7vliqHnmoQgRXBpY1xuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTBweDsgZmxleC1zaHJpbms6IDA7XCI+XG4gICAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPVwiZGlzcGxheTogZmxleDsgYWxpZ24taXRlbXM6IGNlbnRlcjtcIj5cbiAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGlkPVwic2VsZWN0QWxsRXBpY3NcIiBjaGVja2VkIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiA1cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIOWFqOmAiS/lj5bmtojlhajpgIlcbiAgICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZmxleC1ncm93OiAxOyBvdmVyZmxvdy15OiBhdXRvOyBib3JkZXI6IDFweCBzb2xpZCAjZWVlOyBib3JkZXItcmFkaXVzOiA0cHg7IG1hcmdpbi1ib3R0b206IDE1cHg7XCI+XG4gICAgICAgICAgICAgICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IDEwMCU7IGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XCI+XG4gICAgICAgICAgICAgICAgICAgIDx0aGVhZCBzdHlsZT1cInBvc2l0aW9uOiBzdGlja3k7IHRvcDogMDsgYmFja2dyb3VuZDogI2Y1ZjVmNTsgei1pbmRleDogMTtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7IHdpZHRoOiA1MHB4O1wiPumAieaLqTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0O1wiPkVwaWM8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDtcIj7lrZDku7vliqHmlbDph488L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgPC90aGVhZD5cbiAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICAgICAgJHtlcGljcy5tYXAoKGVwaWMsIGluZGV4KSA9PiBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyIHN0eWxlPVwiYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNlZWU7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cImVwaWMtY2hlY2tib3hcIiBkYXRhLWluZGV4PVwiJHtpbmRleH1cIiBjaGVja2VkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke2VwaWMuZXBpY0tleX0gLSAke2VwaWMuZXBpY1N1bW1hcnl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR7ZXBpYy5zdWJUaWNrZXRzLmxlbmd0aH0g5Liq5a2Q5Lu75YqhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgICAgICAgICAgICAgIGApLmpvaW4oJycpfVxuICAgICAgICAgICAgICAgICAgICA8L3Rib2R5PlxuICAgICAgICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtZW5kOyBnYXA6IDEwcHg7IGZsZXgtc2hyaW5rOiAwO1wiPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxPcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4OyBiYWNrZ3JvdW5kOiAjZWVlOyBib3JkZXI6IDFweCBzb2xpZCAjY2NjOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwiY29uZmlybU9wZXJhdGlvblwiIHN0eWxlPVwicGFkZGluZzogNnB4IDEycHg7IGJhY2tncm91bmQ6ICMwMDdiZmY7IGNvbG9yOiB3aGl0ZTsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjtcIj7noa7orqQ8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgICAgICBjb25zdCBzZWxlY3RBbGxDaGVja2JveCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzZWxlY3RBbGxFcGljcycpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IGVwaWNDaGVja2JveGVzID0gZGlhbG9nLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2VwaWMtY2hlY2tib3gnKSBhcyBIVE1MQ29sbGVjdGlvbk9mPEhUTUxJbnB1dEVsZW1lbnQ+O1xuICAgICAgICBjb25zdCBjb25maXJtQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbmZpcm1PcGVyYXRpb24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblxuICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgICAgICBjaGVja2JveC5jaGVja2VkID0gc2VsZWN0QWxsQ2hlY2tib3guY2hlY2tlZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBBcnJheS5mcm9tKGVwaWNDaGVja2JveGVzKS5mb3JFYWNoKGNoZWNrYm94ID0+IHtcbiAgICAgICAgICAgIGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBzZWxlY3RBbGxDaGVja2JveC5jaGVja2VkID0gQXJyYXkuZnJvbShlcGljQ2hlY2tib3hlcykuZXZlcnkoY2IgPT4gY2IuY2hlY2tlZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbmNlbE9wZXJhdGlvbicpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIHJlc29sdmUoW10pO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25maXJtQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRFcGljcyA9IEFycmF5LmZyb20oZXBpY0NoZWNrYm94ZXMpXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjaGVja2JveCA9PiBjaGVja2JveC5jaGVja2VkKVxuICAgICAgICAgICAgICAgIC5tYXAoY2hlY2tib3ggPT4gZXBpY3NbcGFyc2VJbnQoY2hlY2tib3guZGF0YXNldC5pbmRleCB8fCAnMCcpXSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIHJlc29sdmUoc2VsZWN0ZWRFcGljcyk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDmj5LlhaXlrZDku7vliqFcbmFzeW5jIGZ1bmN0aW9uIGluc2VydFN1YlRpY2tldHMoXG4gICAgc2hlZXQ6IFNoZWV0LFxuICAgIGVwaWNzOiB7IGVwaWNLZXk6IHN0cmluZzsgZXBpY1N1bW1hcnk6IHN0cmluZzsgcm93SW5kZXg6IG51bWJlcjsgc3ViVGlja2V0czogSmlyYVRpY2tldFtdIH1bXSxcbiAgICBzaGVldEhlYWRlcnM6IEppcmFIZWFkZXJzLFxuICAgIGppcmFCYXNlVXJsOiBzdHJpbmdcbikge1xuICAgIC8vIOaMieihjOWPt+S7juWkp+WIsOWwj+aOkuW6j++8jOi/meagt+aPkuWFpeaXtuS4jeS8muW9seWTjeWQjue7reeahOihjOWPt1xuICAgIGNvbnN0IHNvcnRlZEVwaWNzID0gWy4uLmVwaWNzXS5zb3J0KChhLCBiKSA9PiBiLnJvd0luZGV4IC0gYS5yb3dJbmRleCk7XG4gICAgXG4gICAgZm9yIChjb25zdCBlcGljIG9mIHNvcnRlZEVwaWNzKSB7XG4gICAgICAgIGNvbnN0IGluc2VydFJvd0luZGV4ID0gZXBpYy5yb3dJbmRleCArIDI7IC8vICsyIOWboOS4uiByb3dJbmRleCDmmK8gMC1iYXNlZO+8jOS4lOaIkeS7rOimgeaPkuWcqCBFcGljIOihjOeahOS4i+aWuVxuICAgICAgICBjb25zdCBkaXNwbGF5SGVhZGVycyA9IFsna2V5JywgJ3N1bW1hcnknLCAnc3RhdHVzJywgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJ107XG4gICAgICAgIGNvbnN0IG1heENvbEluZGV4ID0gZ2V0TWF4Q29sdW1uSW5kZXgoT2JqZWN0LnZhbHVlcyhzaGVldEhlYWRlcnMpLmZpbHRlcigodmFsdWUpOiB2YWx1ZSBpcyBzdHJpbmcgPT4gXG4gICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmxlbmd0aCA+IDBcbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8g5YWI5o+S5YWl56m66KGMXG4gICAgICAgIGNvbnN0IHJvd3NUb0luc2VydCA9IGVwaWMuc3ViVGlja2V0cy5sZW5ndGg7XG4gICAgICAgIGlmIChyb3dzVG9JbnNlcnQgPiAwKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0Lmluc2VydERpbWVuc2lvbignUk9XUycsIGluc2VydFJvd0luZGV4IC0gMSwgaW5zZXJ0Um93SW5kZXggLSAxICsgcm93c1RvSW5zZXJ0KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5bey5Zyo6KGMICR7aW5zZXJ0Um93SW5kZXh9IOaPkuWFpSAke3Jvd3NUb0luc2VydH0g5Liq56m66KGMYCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+aPkuWFpeepuuihjOWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDmj5LlhaXnqbrooYzlpLHotKU6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpfWAsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3ViVGlja2V0Um93cyA9IGVwaWMuc3ViVGlja2V0cy5tYXAodGlja2V0ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHJvdyA9IG5ldyBBcnJheShtYXhDb2xJbmRleCkuZmlsbCgnJyk7XG4gICAgICAgICAgICBkaXNwbGF5SGVhZGVycy5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2x1bW5MZXR0ZXIgPSBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF07XG4gICAgICAgICAgICAgICAgaWYgKGNvbHVtbkxldHRlciAmJiB0eXBlb2YgY29sdW1uTGV0dGVyID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xJbmRleCA9IGdldENvbHVtbkluZGV4KGNvbHVtbkxldHRlcik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZCA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSBgPUhZUEVSTElOSyhcIiR7amlyYUJhc2VVcmx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gcm93O1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyDlhpnlhaXlrZDku7vliqHmlbDmja5cbiAgICAgICAgY29uc3Qgc3RhcnRQb3NpdGlvbiA9IGBBJHtpbnNlcnRSb3dJbmRleH1gO1xuICAgICAgICBhd2FpdCBzaGVldC53cml0ZVNoZWV0KHN1YlRpY2tldFJvd3MsIHN0YXJ0UG9zaXRpb24pO1xuICAgICAgICBjb25zb2xlLmxvZyhg5bey5Zyo6KGMICR7aW5zZXJ0Um93SW5kZXh9IOWGmeWFpSAke3N1YlRpY2tldFJvd3MubGVuZ3RofSDkuKrlrZDku7vliqFgKTtcbiAgICB9XG59XG4iXSwibmFtZXMiOlsiZ2V0RW52Q29uZmlnIiwiREVGQVVMVF9KSVJBX0ZJRUxEUyIsImZldGNoSmlyYVRpY2tldHMiLCJqcWwiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlcXVlc3RJZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInN1YnN0cmluZyIsIm1lc3NhZ2VMaXN0ZW5lciIsIm1lc3NhZ2UiLCJ0eXBlIiwiY2hyb21lIiwicnVudGltZSIsIm9uTWVzc2FnZSIsInJlbW92ZUxpc3RlbmVyIiwiZXJyb3IiLCJFcnJvciIsInRpY2tldHMiLCJhZGRMaXN0ZW5lciIsInNlbmRNZXNzYWdlIiwiRkVUQ0hfSklSQV9USUNLRVRTIiwic291cmNlVGFiSWQiLCJlbnZDb25maWciLCJ1cmwiLCJKSVJBX0JBU0VfVVJMIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwidGFicyIsImNyZWF0ZSIsImFjdGl2ZSIsInRhYiIsImlkIiwiY2hlY2tQYWdlTG9hZCIsImdldCIsInVwZGF0ZWRUYWIiLCJzdGF0dXMiLCJpbmNsdWRlcyIsInNldFRpbWVvdXQiLCJ1cGRhdGUiLCJzY3JpcHRpbmciLCJleGVjdXRlU2NyaXB0IiwidGFyZ2V0IiwidGFiSWQiLCJmdW5jIiwicm93cyIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJyb3ciLCJ0aWNrZXQiLCJrZXkiLCJxdWVyeVNlbGVjdG9yIiwidGV4dENvbnRlbnQiLCJ0cmltIiwic3VtbWFyeSIsImFzc2lnbmVlIiwicmVwb3J0ZXIiLCJwcmlvcml0eSIsImNyZWF0ZWQiLCJ1cGRhdGVkIiwiZHVlZGF0ZSIsImRlc2NyaXB0aW9uIiwicHVzaCIsInJlc3VsdHMiLCJyZXN1bHQiLCJtYXAiLCJzcGxpdCIsInNsaWNlIiwicmVtb3ZlIiwiU2hlZXQiLCJjb25zdHJ1Y3RvciIsInRva2VuIiwic2hlZXRJZCIsImV4dHJhY3RTaGVldElkIiwiZ2lkIiwiZXh0cmFjdEdpZCIsImluaXQiLCJnZXRUb2tlbiIsInNoZWV0TmFtZSIsImdldFNoZWV0TmFtZUJ5R2lkIiwiaWRlbnRpdHkiLCJnZXRBdXRoVG9rZW4iLCJpbnRlcmFjdGl2ZSIsImxhc3RFcnJvciIsIm1hdGNoIiwiZ2V0U2hlZXROYW1lcyIsInJlcyIsImZldGNoIiwiaGVhZGVycyIsIkF1dGhvcml6YXRpb24iLCJqc29uIiwic2hlZXRzIiwic2hlZXQiLCJmaW5kIiwicyIsInByb3BlcnRpZXMiLCJ0aXRsZSIsInJlYWRTaGVldCIsInNoZWV0VXJsIiwidmFsdWVzIiwid3JpdGVTaGVldCIsInBvc2l0aW9uIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwibWV0aG9kIiwiYm9keSIsIkpTT04iLCJzdHJpbmdpZnkiLCJpbnNlcnREaW1lbnNpb24iLCJkaW1lbnNpb24iLCJzdGFydEluZGV4IiwiZW5kSW5kZXgiLCJyZXF1ZXN0IiwicmVxdWVzdHMiLCJyYW5nZSIsInBhcnNlSW50IiwiaW5oZXJpdEZyb21CZWZvcmUiLCJhZGREaW1lbnNpb25Hcm91cCIsIm9rIiwicmVhZENvbmZpZ1NoZWV0IiwiY29uZmlnU2hlZXROYW1lIiwiY29uc29sZSIsImdldEhlYWRlcnMiLCJnZXRTaGVldE5hbWUiLCJnZXRJbmRleGVkREJEYXRhIiwiZGF0YWJhc2VOYW1lIiwic3RvcmVOYW1lIiwiaW5kZXhlZERCIiwib3BlbiIsIm9uc3VjY2VzcyIsImV2ZW50IiwiZGIiLCJ0cmFuc2FjdGlvbiIsIm9iamVjdFN0b3JlIiwiZGF0YVJlcXVlc3QiLCJnZXRBbGwiLCJvbmVycm9yIiwiZ2V0TG9jYWxTdG9yYWdlSXRlbSIsImRlZmF1bHRWYWx1ZSIsInBhcnNlIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsInNldExvY2FsU3RvcmFnZUl0ZW0iLCJzZXRJdGVtIiwiZ2V0Q3VycmVudFVzZXJJbmZvIiwiZXh0ZW5zaW9uIiwiZXh0ZW5zaW9uSWQiLCJ1c2VybmFtZSIsImdldEZvbGRlcnMiLCJ0aGVuIiwiX3JlZiIsImRhdGEiLCJmYXZvcml0ZV9ncm91cF9pZHMiLCJjb252ZXJzYXRpb25fc2V0cyIsImZvbGRlcnMiLCJpZHMiLCJmaWx0ZXIiLCJpdGVtIiwiY2F0Y2giLCJsb2ciLCJnZXRHcm91cHNNYXAiLCJncm91cHMiLCJncm91cHNNYXAiLCJyZWR1Y2UiLCJhY2MiLCJncm91cCIsIm5hbWUiLCJzZXRfYWJicmV2aWF0aW9uIiwiaXNfdGVhbSIsImZvcm1hdERhdGUiLCJkYXRlU3RyaW5nIiwiZGF0ZSIsIkRhdGUiLCJ5ZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsIlN0cmluZyIsImdldE1vbnRoIiwicGFkU3RhcnQiLCJkYXkiLCJnZXREYXRlIiwiaG91cnMiLCJnZXRIb3VycyIsIm1pbnV0ZXMiLCJnZXRNaW51dGVzIiwic2Vjb25kcyIsImdldFNlY29uZHMiLCJ1bmlxQnkiLCJhcnJheSIsInNlZW4iLCJTZXQiLCJrZXlWYWx1ZSIsImhhcyIsImFkZCIsInNob3dUb2FzdCIsIm9uQ2xvc2UiLCJjb250YWluZXIiLCJnZXRFbGVtZW50QnlJZCIsImV4aXN0aW5nVG9hc3QiLCJyZW1vdmVDaGlsZCIsInRvYXN0IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInRvYXN0SW5uZXIiLCJhcHBlbmRDaGlsZCIsInRpbWVyIiwiY29udGFpbnMiLCJjbGVhclRpbWVvdXQiLCJ0cmFuc2Zvcm1Hcm91cExpbmtzIiwiaW5wdXRTdHJpbmciLCJncm91cExpbmtQYXR0ZXJuIiwidHJhbnNmb3JtZWRTdHJpbmciLCJyZXBsYWNlIiwiZ3JvdXBOYW1lIiwiZ3JvdXBJZCIsInRyYW5zZm9ybVBvc3RMaW5rcyIsInBvc3RMaW5rUGF0dGVybiIsImluZGV4IiwicG9zdElkIiwid2luZG93IiwibG9jYXRpb24iLCJwYXRobmFtZSIsImRlZmF1bHRFbnZDb25maWciLCJTQ0hFRFVMRURfSU5URVJWQUwiLCJOdW1iZXIiLCJwcm9jZXNzIiwiZW52IiwiQU5BTFlTSVNfVFlQRSIsIkxMTV9UWVBFIiwiQU5BTFlaRV9CWV9HUk9VUCIsIk9MTEFNQV9CQVNFX1VSTCIsIk9MTEFNQV9NT0RFTCIsIk9MTEFNQV9SRVZJRVdfTU9ERUwiLCJPTExBTUFfUVVFUllfTU9ERUwiLCJESUZZX0FQSV9LRVkiLCJESUZZX1JFVklFV19BUElfS0VZIiwiRElGWV9BUElfQkFTRV9VUkwiLCJPUEVOQUlfQVBJX0tFWSIsIk9QRU5BSV9NT0RFTCIsIk9QRU5BSV9SRVZJRVdfTU9ERUwiLCJPUEVOQUlfQVBJX0JBU0VfVVJMIiwiR1JPUV9BUElfS0VZIiwiR1JPUV9NT0RFTCIsIkdST1FfUkVWSUVXX01PREVMIiwiQk9UX0FQSV9CQVNFX1VSTCIsIkJPVF9UT0tFTiIsIkJPVF9JRCIsIkJPVF9UWVBFIiwiVEVBTV9JRCIsIkVOQUJMRV9CT1QiLCJMTE1fUkVWSUVXX0JFRk9SRV9TRU5EIiwiRU5BQkxFX0NIUk9NQSIsIkNIUk9NQV9BUElfVVJMIiwiQ0hST01BX1BPUlQiLCJDSFJPTUFfQ09MTEVDVElPTl9OQU1FIiwiSklSQV9VU0VSTkFNRSIsIkpJUkFfQVBJX1RPS0VOIiwic3RvcmFnZSIsImxvY2FsIiwiZ2V0VXNlckluZm8iLCJhY2NvdW50VUQiLCJhY2NvdW50SW5mb0xpc3QiLCJhY2NvdW50SW5mbyIsImRpc3BsYXlOYW1lIiwiZW1haWwiLCJmdWxsTmFtZSIsImpvaW4iLCJ0b0xvd2VyQ2FzZSIsInVzZXJJbmZvIiwic2hlZXRUb2tlbiIsInNlbmRlciIsInNlbmRSZXNwb25zZSIsIndhcm4iLCJzdWNjZXNzIiwib3BlbkpxbERpYWxvZyIsImhhbmRsZUV4cGFuZEVwaWNUaWNrZXRzIiwiZGlhbG9nIiwic3R5bGUiLCJjc3NUZXh0IiwiaW5uZXJIVE1MIiwiYWRkRXZlbnRMaXN0ZW5lciIsInZhbHVlIiwiZm9ybWF0dGVkRGF0YSIsImZpZWxkIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0Iiwic2hlZXRIZWFkZXJzIiwiZmluZFZhbGlkSmlyYUhlYWRlcnMiLCJkaXNwbGF5SGVhZGVycyIsImtleUNvbHVtbkluZGV4IiwiZ2V0Q29sdW1uSW5kZXgiLCJpbmZlcnJlZEtleUluZGV4IiwiZmluZEluZGV4IiwiaGVhZGVyIiwiZnJvbUNoYXJDb2RlIiwia2V5VG9Sb3dNYXAiLCJNYXAiLCJrZXlDZWxsIiwidGVzdCIsInNldCIsIm9wZXJhdGlvbnMiLCJleGlzdGluZ1Jvd0luZGV4Iiwicm93SW5kZXgiLCJjb25maXJtZWRPcGVyYXRpb25zIiwic2hvd0NvbmZpcm1hdGlvbkRpYWxvZyIsInVwZGF0ZXNEYXRhIiwiYXBwZW5kRGF0YSIsImhlYWRlclZhbHVlcyIsIk9iamVjdCIsIm1heENvbEluZGV4IiwiZ2V0TWF4Q29sdW1uSW5kZXgiLCJvcGVyYXRpb24iLCJBcnJheSIsImZpbGwiLCJjb2x1bW5MZXR0ZXIiLCJjb2xJbmRleCIsInVwZGF0ZWRDb3VudCIsImFwcGVuZGVkQ291bnQiLCJzdGFydENvbHVtbiIsInN0YXJ0UG9zaXRpb24iLCJ0b2FzdE1lc3NhZ2UiLCJoZWFkZXJNYXBwaW5nIiwiY3VzdG9tRmllbGRNYXBwaW5nIiwiY29uZmlnRGF0YSIsInNoZWV0SGVhZGVySW5kZXgiLCJoIiwiamlyYUZpZWxkSW5kZXgiLCJpIiwibWF4Iiwic2hlZXRIZWFkZXIiLCJqaXJhRmllbGQiLCJzdGFydHNXaXRoIiwidmFsaWRIZWFkZXJzIiwia25vd25GaWVsZHMiLCJoZWFkZXJMb3dlciIsImRpcmVjdE1hdGNoIiwiY29sdW1uIiwidG9VcHBlckNhc2UiLCJ1cHBlckNvbHVtbiIsImNoYXJDb2RlQXQiLCJjb2x1bW5MZXR0ZXJzIiwiaXNBcnJheSIsInZhbGlkTGV0dGVycyIsImluZGljZXMiLCJjb2wiLCJjb2x1bW5zVG9VcGRhdGUiLCJ1cGRhdGVDb3VudCIsIm9wIiwiYXBwZW5kQ291bnQiLCJzZWxlY3RBbGxDaGVja2JveCIsInRpY2tldENoZWNrYm94ZXMiLCJnZXRFbGVtZW50c0J5Q2xhc3NOYW1lIiwiY29uZmlybUJ1dHRvbiIsInVwZGF0ZUNvbmZpcm1CdXR0b25Db3VudCIsInNlbGVjdGVkQ291bnQiLCJmcm9tIiwiY2IiLCJjaGVja2VkIiwiZGlzYWJsZWQiLCJjaGVja2JveCIsImV2ZXJ5Iiwic2VsZWN0ZWRPcGVyYXRpb25zIiwiZGF0YXNldCIsImV4aXN0aW5nVG9hc3RzIiwidCIsImJhY2tncm91bmRDb2xvciIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm9wYWNpdHkiLCJlcGljc1RvRXhwYW5kIiwia2V5Q2VsbENvbnRlbnQiLCJlcGljS2V5Iiwic3ViVGlja2V0cyIsInN1bW1hcnlDb2x1bW5JbmRleCIsImVwaWNTdW1tYXJ5IiwiZmV0Y2hFcnJvciIsImNvbmZpcm1lZEVwaWNzIiwic2hvd0VwaWNDb25maXJtYXRpb25EaWFsb2ciLCJpbnNlcnRTdWJUaWNrZXRzIiwiZXBpY3MiLCJlcGljIiwiZXBpY0NoZWNrYm94ZXMiLCJzZWxlY3RlZEVwaWNzIiwiamlyYUJhc2VVcmwiLCJzb3J0ZWRFcGljcyIsInNvcnQiLCJhIiwiYiIsImluc2VydFJvd0luZGV4Iiwicm93c1RvSW5zZXJ0Iiwic3ViVGlja2V0Um93cyJdLCJzb3VyY2VSb290IjoiIn0=