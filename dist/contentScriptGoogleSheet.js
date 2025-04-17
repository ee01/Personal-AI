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
    return;
  }
  const {
    type
  } = message;
  if (type === 'OPEN_JIRA_QUERY_DIALOG') {
    openJqlDialog(message.url, message.sheetToken);
    url = message.url;
    sheetToken = message.sheetToken;
  }
  return true; // 为所有消息保持消息通道开启
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
    document.body.removeChild(dialog);
  });
  document.getElementById('submit')?.addEventListener('click', async () => {
    const jql = document.getElementById('jql').value;
    if (jql) {
      try {
        const tickets = await (0,_jira__WEBPACK_IMPORTED_MODULE_0__.fetchJiraTickets)(jql);
        console.log('tickets', tickets);
        if (!tickets.length) {
          showToast('没有找到数据', 'error');
          return;
        }
        if (!sheetToken) {
          // 没有权限插入，用剪切板模式手动粘贴
          const headers = ['key', 'summary', 'status', 'assignee', 'reporter'];
          const formattedData = [headers.join('\t'), ...tickets.map(ticket => ({
            ...ticket,
            key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
          })).map(ticket => headers.map(field => ticket[field]).join('\t'))].join('\n');
          await navigator.clipboard.writeText(formattedData);
          console.log('formattedData', formattedData);
          showToast('Jira 数据已复制到剪贴板');
        } else {
          // 用接口模式自动插入数据
          if (!url || !sheetToken) {
            showToast('缺少必要参数', 'error');
            return;
          }

          // 尝试直接在当前打开的Google Sheets中插入数据
          const sheet = new _sheet__WEBPACK_IMPORTED_MODULE_1__.Sheet(url, sheetToken);
          try {
            await sheet.init();
            const values = await sheet.readSheet();
            console.log('values', values);
            const sheetHeaders = await findValidJiraHeaders(sheet);
            console.log('sheetHeaders', sheetHeaders);
            const headers = ['key', 'summary', 'status', 'assignee', 'reporter'];
            // 获取表格现有数据的行数
            const lastRow = values.length;
            console.log('当前表格行数:', lastRow);

            // 根据现有表头的位置构建数据
            const formattedData = tickets.map(ticket => {
              const headerValues = Object.values(sheetHeaders).filter(value => typeof value === 'string' && value.length > 0);
              const maxColIndex = getMaxColumnIndex(headerValues);
              const row = new Array(maxColIndex).fill(''); // 创建一个足够长的空数组

              // 根据表头位置填充数据
              headers.forEach(field => {
                const columnIndex = sheetHeaders[field];
                if (columnIndex && typeof columnIndex === 'string') {
                  try {
                    const colIndex = getColumnIndex(columnIndex);
                    if (field === 'key') {
                      row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`;
                    } else {
                      row[colIndex] = ticket[field] || '';
                    }
                  } catch (error) {
                    console.error('处理列索引时出错:', error);
                    // 根据需要处理错误
                  }
                }
              });
              return row;
            });
            console.log('formattedData', formattedData);
            // 从最后一行开始追加数据
            const startPosition = `A${lastRow + 1}`;
            await sheet.writeSheet(formattedData, startPosition);
            showToast('Jira 数据已插入到Google Sheets');
          } catch (error) {
            console.error('Google Sheets 操作失败:', error);
            showToast('Google Sheets 操作失败: ' + error, 'error');
          }
        }
        document.body.removeChild(dialog);
      } catch (error) {
        console.error('查询失败: ', error);
        alert('查询失败: ' + error);
      }
    }
  });
}
// 查找有效的Jira字段表头
async function findValidJiraHeaders(sheet) {
  try {
    let headerMapping = {};
    try {
      // 尝试读取配置表数据
      const configData = await sheet.readConfigSheet();
      console.log('configData', configData);
      if (configData && configData.length >= 2) {
        // 创建配置映射字典
        for (let i = 1; i < configData.length; i++) {
          const row = configData[i];
          if (row.length >= 2) {
            if (row[1] === 'JIRA key') {
              headerMapping[row[0].toLowerCase()] = 'key';
            } else {
              headerMapping[row[0].toLowerCase()] = row[1];
            }
          }
        }
      } else throw new Error('配置表数据为空');
    } catch (error) {
      console.warn('读取配置表失败，将使用默认字段别名:', error);
      // 使用默认的字段别名映射
      headerMapping = {
        'summary': 'summary',
        '概要': 'summary',
        'description': 'description',
        '描述': 'description',
        'type': 'issueType',
        '类型': 'issueType',
        'priority': 'priority',
        '优先级': 'priority',
        'assignee': 'assignee',
        '经办人': 'assignee',
        'reporter': 'reporter',
        '报告人': 'reporter',
        'labels': 'labels',
        '标签': 'labels',
        'components': 'components',
        '模块': 'components',
        'fix versions': 'fixVersions',
        '修复版本': 'fixVersions',
        'affects versions': 'affectsVersions',
        '影响版本': 'affectsVersions',
        'linked issues': 'linkedIssues',
        '关联问题': 'linkedIssues',
        'epic link': 'epicLink',
        'epic': 'epicLink',
        'sprint': 'sprint',
        '冲刺': 'sprint',
        'story points': 'storyPoints',
        '故事点': 'storyPoints'
      };
    }

    // 获取当前工作表的所有列标题
    const headers = await sheet.getHeaders();
    console.log('headers', headers);
    const validHeaders = {
      key: '',
      summary: '',
      description: '',
      issuetype: '',
      priority: '',
      assignee: '',
      reporter: '',
      labels: '',
      components: '',
      fixVersions: '',
      affectsVersions: '',
      linkedIssues: '',
      epicLink: '',
      sprint: '',
      storyPoints: '',
      status: ''
    };

    // 遍历所有列标题，查找匹配的 Jira 字段
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      const columnLetter = String.fromCharCode(65 + index);

      // 检查是否在配置映射中存在匹配
      for (const [configKey, jiraField] of Object.entries(headerMapping)) {
        if (headerLower.includes(configKey)) {
          console.log(`别名匹配: "${headerLower}" -> "${jiraField}" (列 ${columnLetter})`);
          validHeaders[jiraField] = columnLetter;
          break;
        } else if (Object.keys(validHeaders).includes(headerLower)) {
          console.log(`字段匹配: "${headerLower}" (列 ${columnLetter})`);
          validHeaders[headerLower] = columnLetter;
          break;
        }
      }

      // 检查是否直接匹配字段名
      for (const field of Object.keys(validHeaders)) {
        if (field !== 'customFields' && headerLower === field.toLowerCase()) {
          console.log(`直接匹配: "${headerLower}" -> "${field}" (列 ${columnLetter})`);
          validHeaders[field] = columnLetter;
          break;
        }
      }
    });
    console.log('最终匹配结果:', validHeaders);
    return validHeaders;
  } catch (error) {
    console.error('查找有效 Jira 标题时出错:', error);
    throw error;
  }
}
function getColumnIndex(column) {
  if (!column || typeof column !== 'string' || column.length === 0) {
    throw new Error('无效的列标识');
  }
  const upperColumn = column.toUpperCase();
  return upperColumn.charCodeAt(0) - 65;
}
function getMaxColumnIndex(headers) {
  if (!headers || !Array.isArray(headers) || headers.length === 0) {
    return 0;
  }
  const validHeaders = headers.filter(h => typeof h === 'string' && h.length > 0);
  return Math.max(...validHeaders.map(col => col.toUpperCase().charCodeAt(0) - 64));
}

// 添加显示 toast 的函数
function showToast(message) {
  let type = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'info';
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? 'rgba(220, 53, 69, 0.9)' : type === 'success' ? 'rgba(40, 167, 69, 0.9)' : 'rgba(0, 0, 0, 0.7)'};
        color: white;
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
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUssT0FBTyxHQUFHLHdCQUF3QixHQUFHQSxJQUFJLEtBQUssU0FBUyxHQUFHLHdCQUF3QixHQUFHLG9CQUFvQjtBQUN4STtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7RUFDRCtCLFFBQVEsQ0FBQzhELElBQUksQ0FBQ3lGLFdBQVcsQ0FBQ0osS0FBSyxDQUFDO0VBQ2hDaUkscUJBQXFCLENBQUMsTUFBTTtJQUN4QmpJLEtBQUssQ0FBQzJFLEtBQUssQ0FBQ3VELE9BQU8sR0FBRyxHQUFHO0VBQzdCLENBQUMsQ0FBQztFQUNGN1AsVUFBVSxDQUFDLE1BQU07SUFDYjJILEtBQUssQ0FBQzJFLEtBQUssQ0FBQ3VELE9BQU8sR0FBRyxHQUFHO0lBQ3pCN1AsVUFBVSxDQUFDLE1BQU07TUFDYnhCLFFBQVEsQ0FBQzhELElBQUksQ0FBQ29GLFdBQVcsQ0FBQ0MsS0FBSyxDQUFDO0lBQ3BDLENBQUMsRUFBRSxHQUFHLENBQUM7RUFDWCxDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQ1osQyIsInNvdXJjZXMiOlsid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2ppcmEudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvc2hlZXQudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvc3RvcmFnZS50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy91dGlscy50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2hhc093blByb3BlcnR5IHNob3J0aGFuZCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvbWFrZSBuYW1lc3BhY2Ugb2JqZWN0Iiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL2NvbnRlbnRTY3JpcHRHb29nbGVTaGVldC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RW52Q29uZmlnIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIOm7mOiupOeahCBKaXJhIOWtl+autemFjee9rlxuY29uc3QgREVGQVVMVF9KSVJBX0ZJRUxEUyA9IHtcbiAgJ0tleSc6ICdrZXknLFxuICAnU3VtbWFyeSc6ICdzdW1tYXJ5JyxcbiAgJ1N0YXR1cyc6ICdzdGF0dXMnLFxuICAnQXNzaWduZWUnOiAnYXNzaWduZWUnLFxuICAnUmVwb3J0ZXInOiAncmVwb3J0ZXInLFxuICAnUHJpb3JpdHknOiAncHJpb3JpdHknLFxuICAnQ3JlYXRlZCc6ICdjcmVhdGVkJyxcbiAgJ1VwZGF0ZWQnOiAndXBkYXRlZCcsXG4gICdEdWUgRGF0ZSc6ICdkdWVkYXRlJyxcbiAgJ0Rlc2NyaXB0aW9uJzogJ2Rlc2NyaXB0aW9uJ1xufTtcblxuLy8g5LuOIEppcmEg6aG16Z2i5oqT5Y+W5pWw5o2uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hKaXJhVGlja2V0cyhqcWw6IHN0cmluZyk6IFByb21pc2U8SmlyYVRpY2tldFtdPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdElkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDcpO1xuICAgICAgICBcbiAgICAgICAgLy8g55uR5ZCs5p2l6IeqIGJhY2tncm91bmQgc2NyaXB0IOeahOa2iOaBr1xuICAgICAgICBjb25zdCBtZXNzYWdlTGlzdGVuZXIgPSAobWVzc2FnZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAobWVzc2FnZS50eXBlID09PSAnSklSQV9USUNLRVRTX1JFU1VMVCcgJiYgbWVzc2FnZS5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCkge1xuICAgICAgICAgICAgICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihtZXNzYWdlTGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIGlmIChtZXNzYWdlLmVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IobWVzc2FnZS5lcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUobWVzc2FnZS50aWNrZXRzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihtZXNzYWdlTGlzdGVuZXIpO1xuICAgICAgICBcbiAgICAgICAgLy8g5Y+R6YCB5raI5oGv57uZIGJhY2tncm91bmQgc2NyaXB0IOadpeWIm+W7uuaWsOagh+etvumhtVxuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICAgICAgICB0eXBlOiAnRkVUQ0hfSklSQV9USUNLRVRTJyxcbiAgICAgICAgICAgIGpxbCxcbiAgICAgICAgICAgIHJlcXVlc3RJZFxuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuLy8g54S25ZCO5ZyoIEZFVENIX0pJUkFfVElDS0VUUyDlh73mlbDkuK3kvb/nlKggc291cmNlVGFiSWRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBGRVRDSF9KSVJBX1RJQ0tFVFMoanFsOiBzdHJpbmcsIHJlcXVlc3RJZDogc3RyaW5nLCBzb3VyY2VUYWJJZDogbnVtYmVyKSB7XG4gIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICBjb25zdCB1cmwgPSBgJHtlbnZDb25maWcuSklSQV9CQVNFX1VSTH0vaXNzdWVzLz9qcWw9JHtlbmNvZGVVUklDb21wb25lbnQoanFsKX1gO1xuICAgICAgICBcbiAgLy8g5Yib5bu65paw5qCH562+6aG1XG4gIGNocm9tZS50YWJzLmNyZWF0ZSh7IHVybCwgYWN0aXZlOiBmYWxzZSB9LCAodGFiKSA9PiB7XG4gICAgICBpZiAoIXRhYi5pZCkge1xuICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgIHR5cGU6ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyxcbiAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICBlcnJvcjogJ+aXoOazleWIm+W7uuagh+etvumhtSdcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIOetieW+hemhtemdouWKoOi9veWujOaIkFxuICAgICAgY29uc3QgY2hlY2tQYWdlTG9hZCA9ICgpID0+IHtcbiAgICAgICAgICBjaHJvbWUudGFicy5nZXQodGFiLmlkISwgKHVwZGF0ZWRUYWIpID0+IHtcbiAgICAgICAgICAgICAgaWYgKHVwZGF0ZWRUYWIuc3RhdHVzID09PSAnY29tcGxldGUnKSB7XG4gICAgICAgICAgICAgICAgICAvLyDms6jlhaXlhoXlrrnohJrmnKxcbiAgICAgICAgICAgICAgICAgIGNocm9tZS5zY3JpcHRpbmcuZXhlY3V0ZVNjcmlwdCh7XG4gICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB7IHRhYklkOiB0YWIuaWQhIH0sXG4gICAgICAgICAgICAgICAgICAgICAgZnVuYzogKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3dzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndHIuaXNzdWVyb3cnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvd3MuZm9yRWFjaChyb3cgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGlja2V0ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5pc3N1ZWtleScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHJvdy5xdWVyeVNlbGVjdG9yKCcuc3VtbWFyeScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogcm93LnF1ZXJ5U2VsZWN0b3IoJy5zdGF0dXMnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NpZ25lZTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5hc3NpZ25lZScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG9ydGVyOiByb3cucXVlcnlTZWxlY3RvcignLnJlcG9ydGVyJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6IHJvdy5xdWVyeVNlbGVjdG9yKCcucHJpb3JpdHknKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkOiByb3cucXVlcnlTZWxlY3RvcignLmNyZWF0ZWQnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVkOiByb3cucXVlcnlTZWxlY3RvcignLnVwZGF0ZWQnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdWVkYXRlOiByb3cucXVlcnlTZWxlY3RvcignLmR1ZWRhdGUnKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogcm93LnF1ZXJ5U2VsZWN0b3IoJy5kZXNjcmlwdGlvbicpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRpY2tldHM7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSwgKHJlc3VsdHMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0c1swXS5yZXN1bHQgPSByZXN1bHRzWzBdLnJlc3VsdC5tYXAodGlja2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnk6IHRpY2tldC5zdW1tYXJ5LnNwbGl0KCdcXG4nKS5zbGljZSgtMSlbMF0udHJpbSgpLFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHNvdXJjZVRhYklkLCB7XG4gICAgICAgICAgICAgICAgICAgIC8vIOWPkemAgee7k+aenOWbnua6kOagh+etvumhtVxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGlja2V0czogcmVzdWx0c1swXS5yZXN1bHRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyDlhbPpl60gSmlyYSDmoIfnrb7pobVcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMucmVtb3ZlKHRhYi5pZCEpO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGNoZWNrUGFnZUxvYWQsIDEwMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgICBcbiAgICAgIGNoZWNrUGFnZUxvYWQoKTtcbiAgfSk7XG59XG4iLCJleHBvcnQgY2xhc3MgU2hlZXQge1xuICBwcml2YXRlIHRva2VuOiBzdHJpbmc7XG4gIHByaXZhdGUgc2hlZXRJZDogc3RyaW5nO1xuICBwcml2YXRlIGdpZDogc3RyaW5nO1xuICBwcml2YXRlIHNoZWV0TmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHVybDogc3RyaW5nLCB0b2tlbjogc3RyaW5nKSB7XG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xuICAgIHRoaXMuc2hlZXRJZCA9IHRoaXMuZXh0cmFjdFNoZWV0SWQodXJsKTtcbiAgICB0aGlzLmdpZCA9IHRoaXMuZXh0cmFjdEdpZCh1cmwpO1xuICB9XG4gICAgXG4gIGFzeW5jIGluaXQoKSB7XG4gICAgaWYgKCF0aGlzLnRva2VuKSB0aGlzLnRva2VuID0gYXdhaXQgdGhpcy5nZXRUb2tlbigpO1xuICAgIHRoaXMuc2hlZXROYW1lID0gYXdhaXQgdGhpcy5nZXRTaGVldE5hbWVCeUdpZCh0aGlzLnRva2VuLCB0aGlzLnNoZWV0SWQsIHRoaXMuZ2lkKTtcbiAgfVxuXG4gIGFzeW5jIGdldFRva2VuKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY2hyb21lLmlkZW50aXR5LmdldEF1dGhUb2tlbih7IGludGVyYWN0aXZlOiB0cnVlIH0sICh0b2tlbikgPT4ge1xuICAgICAgICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikgcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgICAgICBlbHNlIHJlc29sdmUodG9rZW4pO1xuICAgICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGV4dHJhY3RTaGVldElkKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL1xcL2RcXC8oW2EtekEtWjAtOS1fXSspLyk7XG4gICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBudWxsO1xuICB9XG5cbiAgZXh0cmFjdEdpZCh1cmw6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGNvbnN0IG1hdGNoID0gdXJsLm1hdGNoKC9bIyZdZ2lkPShbMC05XSspLyk7XG4gICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBudWxsO1xuICB9XG5cbiAgYXN5bmMgZ2V0U2hlZXROYW1lcyh0b2tlbjogc3RyaW5nLCBzaGVldElkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHtzaGVldElkfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgfVxuICAgIH0pO1xuICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgIHJldHVybiBqc29uLnNoZWV0cztcbiAgfVxuXG4gIGFzeW5jIGdldFNoZWV0TmFtZUJ5R2lkKHRva2VuOiBzdHJpbmcsIHNoZWV0SWQ6IHN0cmluZywgZ2lkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHNoZWV0cyA9IGF3YWl0IHRoaXMuZ2V0U2hlZXROYW1lcyh0b2tlbiwgc2hlZXRJZCk7XG4gICAgY29uc3Qgc2hlZXQgPSBzaGVldHMuZmluZCgoczogYW55KSA9PiBzLnByb3BlcnRpZXMuc2hlZXRJZC50b1N0cmluZygpID09PSBnaWQpO1xuICAgIHJldHVybiBzaGVldCA/IHNoZWV0LnByb3BlcnRpZXMudGl0bGUgOiBzaGVldHNbMF0ucHJvcGVydGllcy50aXRsZTsgLy8g5aaC5p6c5om+5LiN5Yiw5a+55bqU55qEZ2lkLOi/lOWbnuesrOS4gOS4qnNoZWV055qE5ZCN56ewXG4gIH1cblxuICBhc3luYyByZWFkU2hlZXQoKTogUHJvbWlzZTxzdHJpbmdbXVtdPiB7XG4gICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHt0aGlzLnNoZWV0TmFtZX1gO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCB9XG4gICAgfSk7XG4gICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgcmV0dXJuIGpzb24udmFsdWVzO1xuICB9XG5cbiAgYXN5bmMgd3JpdGVTaGVldCh2YWx1ZXM6IHN0cmluZ1tdW10sIHBvc2l0aW9uID0gJ0ExJyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3Qgc2hlZXRVcmwgPSBgaHR0cHM6Ly9zaGVldHMuZ29vZ2xlYXBpcy5jb20vdjQvc3ByZWFkc2hlZXRzLyR7dGhpcy5zaGVldElkfS92YWx1ZXMvJHt0aGlzLnNoZWV0TmFtZX0hJHtwb3NpdGlvbn0/dmFsdWVJbnB1dE9wdGlvbj1VU0VSX0VOVEVSRURgO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3RoaXMudG9rZW59YCxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9LFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHZhbHVlcyB9KVxuICAgIH0pO1xuICAgIHJldHVybiByZXMuanNvbigpO1xuICB9XG5cbiAgLyoqXG4gICAqIOivu+WPlumFjee9ruihqOaVsOaNrlxuICAgKiBAcGFyYW0gc2hlZXROYW1lIOmFjee9ruihqOWQjeensFxuICAgKiBAcmV0dXJucyDphY3nva7ooajmlbDmja5cbiAgICovXG4gIGFzeW5jIHJlYWRDb25maWdTaGVldChjb25maWdTaGVldE5hbWUgPSAnJyk6IFByb21pc2U8c3RyaW5nW11bXT4ge1xuICAgIGlmICghY29uZmlnU2hlZXROYW1lKSBjb25maWdTaGVldE5hbWUgPSB0aGlzLnNoZWV0TmFtZSArICdfY29uZmlnJztcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke2NvbmZpZ1NoZWV0TmFtZX1gO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChzaGVldFVybCwge1xuICAgICAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXMuanNvbigpO1xuICAgICAgICByZXR1cm4ganNvbi52YWx1ZXM7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+ivu+WPlumFjee9ruihqOWksei0pTonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6I635Y+W6KGo5qC855qE56ys5LiA6KGM5L2c5Li66KGo5aS0XG4gICAqIEByZXR1cm5zIOihqOWktOaVsOe7hFxuICAgKi9cbiAgYXN5bmMgZ2V0SGVhZGVycygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgdmFsdWVzID0gYXdhaXQgdGhpcy5yZWFkU2hlZXQoKTtcbiAgICBpZiAoIXZhbHVlcyB8fCB2YWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ihqOagvOS4uuepuicpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzWzBdO1xuICB9XG5cbiAgcHVibGljIGdldFNoZWV0TmFtZSgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnNoZWV0TmFtZTtcbiAgfVxufSIsImV4cG9ydCBmdW5jdGlvbiBnZXRJbmRleGVkREJEYXRhKGRhdGFiYXNlTmFtZTogc3RyaW5nLCBzdG9yZU5hbWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKGRhdGFiYXNlTmFtZSk7XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGRiID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zYWN0aW9uID0gZGIudHJhbnNhY3Rpb24oW3N0b3JlTmFtZV0sICdyZWFkb25seScpO1xuICAgICAgICAgICAgY29uc3Qgb2JqZWN0U3RvcmUgPSB0cmFuc2FjdGlvbi5vYmplY3RTdG9yZShzdG9yZU5hbWUpO1xuICAgICAgICAgICAgY29uc3QgZGF0YVJlcXVlc3QgPSBvYmplY3RTdG9yZS5nZXRBbGwoKTtcbiAgICBcbiAgICAgICAgICAgIGRhdGFSZXF1ZXN0Lm9uc3VjY2VzcyA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKGV2ZW50LnRhcmdldC5yZXN1bHQpO1xuICAgICAgICAgICAgfTtcbiAgICBcbiAgICAgICAgICAgIGRhdGFSZXF1ZXN0Lm9uZXJyb3IgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGV2ZW50LnRhcmdldC5lcnJvcik7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9O1xuICAgIFxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgcmVqZWN0KGV2ZW50LnRhcmdldC5lcnJvcik7XG4gICAgICAgIH07XG4gICAgfSk7XG59XG5cblxuZXhwb3J0IGNvbnN0IGdldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oa2V5KSB8fCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZXRMb2NhbFN0b3JhZ2VJdGVtID0gKGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IGFueSkgPT4ge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdFZhbHVlKSk7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudFVzZXJJbmZvKCkge1xuICAgIGNvbnN0IHsgZXh0ZW5zaW9uOiBleHRlbnNpb25JZCB9ID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnb3duRXh0ZW5zaW9uJywge30pO1xuICAgIGNvbnN0IHVzZXJuYW1lID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZGlzcGxheU5hbWUnLCAncmFkYXItcG9jJyk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZXh0ZW5zaW9uSWQsXG4gICAgICAgIHVzZXJuYW1lXG4gICAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZvbGRlcnMoKSB7XG4gICAgcmV0dXJuIGdldEluZGV4ZWREQkRhdGEoJ0dsaXAnLCAncHJvZmlsZScpLnRoZW4oKFtkYXRhXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmF2b3JpdGVfZ3JvdXBfaWRzID0gZGF0YT8uZmF2b3JpdGVfZ3JvdXBfaWRzIHx8IFtdO1xuICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9uX3NldHMgPSBkYXRhPy5jb252ZXJzYXRpb25fc2V0cyB8fCBbXTtcbiAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlcnMgPSBbe3RpdGxlOiAnICcsIGlkczogW119LHt0aXRsZTogJ2Zhdm9yaXRlJywgaWRzOiBmYXZvcml0ZV9ncm91cF9pZHN9LCAuLi5jb252ZXJzYXRpb25fc2V0cy5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgPT09ICdmb2xkZXInKV1cbiAgICAgICAgICAgIHJldHVybiBmb2xkZXJzO1xuICAgICAgICB9KS5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEdyb3Vwc01hcCgpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdncm91cCcpLnRoZW4oKGdyb3VwcykgPT4ge1xuICAgICAgICBjb25zdCBncm91cHNNYXAgPSBncm91cHMucmVkdWNlKChhY2M6IGFueSwgZ3JvdXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgYWNjW2dyb3VwLmlkXSA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBncm91cC5zZXRfYWJicmV2aWF0aW9uLFxuICAgICAgICAgICAgICAgIGlzX3RlYW06IGdyb3VwLmlzX3RlYW1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gYWNjO1xuICAgICAgICB9LCB7fSk7XG5cbiAgICAgICAgcmV0dXJuIGdyb3Vwc01hcDtcbiAgICB9KTtcbn0iLCJpbXBvcnQgeyBnZXRDdXJyZW50VXNlckluZm8sIGdldExvY2FsU3RvcmFnZUl0ZW0gfSBmcm9tIFwiLi9zdG9yYWdlXCI7XG5cbi8vIOeOr+Wig+mFjee9ruexu+Wei+WumuS5iVxuZXhwb3J0IGludGVyZmFjZSBFbnZDb25maWdUeXBlIHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBudW1iZXI7XG4gIEFOQUxZU0lTX1RZUEU6IHN0cmluZztcbiAgQU5BTFlaRV9CWV9HUk9VUDogYm9vbGVhbjtcbiAgTExNX1RZUEU6IHN0cmluZztcbiAgT0xMQU1BX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9MTEFNQV9NT0RFTDogc3RyaW5nO1xuICBPTExBTUFfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogc3RyaW5nO1xuICBESUZZX0FQSV9LRVk6IHN0cmluZztcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBPUEVOQUlfQVBJX0tFWTogc3RyaW5nO1xuICBPUEVOQUlfTU9ERUw6IHN0cmluZztcbiAgT1BFTkFJX1JFVklFV19NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIEdST1FfQVBJX0tFWTogc3RyaW5nO1xuICBHUk9RX01PREVMOiBzdHJpbmc7XG4gIEdST1FfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIEJPVF9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgQk9UX1RPS0VOOiBzdHJpbmc7XG4gIEJPVF9JRDogc3RyaW5nO1xuICBCT1RfVFlQRTogc3RyaW5nO1xuICBURUFNX0lEOiBzdHJpbmc7XG4gIEVOQUJMRV9CT1Q6IGJvb2xlYW47XG4gIExMTV9SRVZJRVdfQkVGT1JFX1NFTkQ6IGJvb2xlYW47XG4gIEVOQUJMRV9DSFJPTUE6IGJvb2xlYW47XG4gIENIUk9NQV9BUElfVVJMOiBzdHJpbmc7XG4gIENIUk9NQV9QT1JUOiBudW1iZXI7XG4gIENIUk9NQV9DT0xMRUNUSU9OX05BTUU6IHN0cmluZztcbiAgLy8gSklSQeebuOWFs+mFjee9rlxuICBKSVJBX0JBU0VfVVJMPzogc3RyaW5nO1xuICBKSVJBX1VTRVJOQU1FPzogc3RyaW5nO1xuICBKSVJBX0FQSV9UT0tFTj86IHN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdERhdGUoZGF0ZVN0cmluZzogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGRhdGVTdHJpbmcpO1xuICAgIFxuICAgIGNvbnN0IHllYXIgPSBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgY29uc3QgbW9udGggPSBTdHJpbmcoZGF0ZS5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBkYXkgPSBTdHJpbmcoZGF0ZS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgaG91cnMgPSBTdHJpbmcoZGF0ZS5nZXRIb3VycygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IG1pbnV0ZXMgPSBTdHJpbmcoZGF0ZS5nZXRNaW51dGVzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3Qgc2Vjb25kcyA9IFN0cmluZyhkYXRlLmdldFNlY29uZHMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgXG4gICAgcmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fSAke2hvdXJzfToke21pbnV0ZXN9OiR7c2Vjb25kc31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5pcUJ5KGFycmF5OiBhbnlbXSwga2V5OiBzdHJpbmcpIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xuICAgIHJldHVybiBhcnJheS5maWx0ZXIoaXRlbSA9PiB7XG4gICAgICBjb25zdCBrZXlWYWx1ZSA9IGl0ZW1ba2V5XTtcbiAgICAgIGlmIChzZWVuLmhhcyhrZXlWYWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgc2Vlbi5hZGQoa2V5VmFsdWUpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIG9uQ2xvc2U/OiAoKSA9PiB2b2lkKSB7XG4gIC8vIOiOt+WPluaIluWIm+W7uuWuueWZqOWFg+e0oFxuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmFkYXItcG9jLXJlc3VsdCcpO1xuICBpZiAoIWNvbnRhaW5lcikgcmV0dXJuXG5cbiAgLy8g56e76Zmk546w5pyJ55qEIFRvYXN0IOWFg+e0oFxuICBjb25zdCBleGlzdGluZ1RvYXN0ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5yYWRhci1wb2MtdG9hc3QnKTtcbiAgaWYgKGV4aXN0aW5nVG9hc3QpIHtcbiAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQoZXhpc3RpbmdUb2FzdCk7XG4gIH1cblxuICAvLyDliJvlu7rmlrDnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9IGByYWRhci1wb2MtdG9hc3QgcmFkYXItcG9jLXRvYXN0LSR7dHlwZX1gO1xuXG4gIGNvbnN0IHRvYXN0SW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3RJbm5lci5jbGFzc05hbWUgPSAncmFkYXItcG9jLXRvYXN0LWlubmVyJztcbiAgdG9hc3RJbm5lci50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cbiAgdG9hc3QuYXBwZW5kQ2hpbGQodG9hc3RJbm5lcik7XG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b2FzdCk7XG5cbiAgLy8g6K6+572u5a6a5pe25Zmo5ZyoIDMg56eS5ZCO5YWz6ZetIFRvYXN0XG4gIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9LCAzMDAwKTtcblxuICAvLyDov5Tlm57kuIDkuKrlh73mlbDku6Xkvr/miYvliqjlhbPpl60gVG9hc3RcbiAgcmV0dXJuICgpID0+IHtcbiAgICBjbGVhclRpbWVvdXQodGltZXIpO1xuICAgIGlmIChjb250YWluZXIuY29udGFpbnModG9hc3QpKSB7XG4gICAgICBjb250YWluZXIucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgIH1cbiAgICBpZiAob25DbG9zZSkge1xuICAgICAgb25DbG9zZSgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybUdyb3VwTGlua3MoaW5wdXRTdHJpbmc6IHN0cmluZykge1xuICBjb25zdCBncm91cExpbmtQYXR0ZXJuID0gL1xcW2dyb3VwOiguKyk6KFxcZCspXFxdL2c7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShncm91cExpbmtQYXR0ZXJuLCAobWF0Y2gsIGdyb3VwTmFtZSwgZ3JvdXBJZCkgPT4ge1xuICAgIHJldHVybiBgWyR7Z3JvdXBOYW1lfV0oL21lc3NhZ2VzLyR7Z3JvdXBJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybVBvc3RMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IHBvc3RMaW5rUGF0dGVybiA9IC9cXFtwb3N0OihcXGQrKVxcXS9nO1xuICBsZXQgaW5kZXggPSAxO1xuICBjb25zdCB0cmFuc2Zvcm1lZFN0cmluZyA9IGlucHV0U3RyaW5nLnJlcGxhY2UocG9zdExpbmtQYXR0ZXJuLCAobWF0Y2gsIHBvc3RJZCkgPT4ge1xuICAgIHJldHVybiBgW1ske2luZGV4Kyt9XV0oL2wke3dpbmRvdy5sb2NhdGlvbi5wYXRobmFtZX0vJHtwb3N0SWR9KWA7XG4gIH0pO1xuICByZXR1cm4gdHJhbnNmb3JtZWRTdHJpbmc7XG59XG5cbi8vIOm7mOiupOeOr+Wig+mFjee9rlxuZXhwb3J0IGNvbnN0IGRlZmF1bHRFbnZDb25maWc6IEVudkNvbmZpZ1R5cGUgPSB7XG4gIFNDSEVEVUxFRF9JTlRFUlZBTDogTnVtYmVyKHByb2Nlc3MuZW52LlNDSEVEVUxFRF9JTlRFUlZBTCkgfHwgMTIwLFxuICBBTkFMWVNJU19UWVBFOiBwcm9jZXNzLmVudi5BTkFMWVNJU19UWVBFIHx8IFwiZmlsdGVyXCIsXG4gIExMTV9UWVBFOiBwcm9jZXNzLmVudi5MTE1fVFlQRSB8fCBcImRpZnlcIixcbiAgQU5BTFlaRV9CWV9HUk9VUDogcHJvY2Vzcy5lbnYuQU5BTFlaRV9CWV9HUk9VUCA9PT0gXCJ0cnVlXCIsXG4gIE9MTEFNQV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT0xMQU1BX0JBU0VfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDoxMTQzNFwiLFxuICBPTExBTUFfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9NT0RFTCB8fCBcImRlZXBzZWVrLXIxXCIsXG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9SRVZJRVdfTU9ERUwgfHwgXCJsbGFtYTMuMVwiLFxuICBPTExBTUFfUVVFUllfTU9ERUw6IHByb2Nlc3MuZW52Lk9MTEFNQV9RVUVSWV9NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIERJRllfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9BUElfS0VZIHx8IFwiXCIsXG4gIERJRllfUkVWSUVXX0FQSV9LRVk6IHByb2Nlc3MuZW52LkRJRllfUkVWSUVXX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52LkRJRllfQVBJX0JBU0VfVVJMIHx8IFwiXCIsXG4gIE9QRU5BSV9BUElfS0VZOiBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSB8fCBcIlwiLFxuICBPUEVOQUlfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9NT0RFTCB8fCBcIlwiLFxuICBPUEVOQUlfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5PUEVOQUlfUkVWSUVXX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgR1JPUV9BUElfS0VZOiBwcm9jZXNzLmVudi5HUk9RX0FQSV9LRVkgfHwgXCJcIixcbiAgR1JPUV9NT0RFTDogcHJvY2Vzcy5lbnYuR1JPUV9NT0RFTCB8fCBcIlwiLFxuICBHUk9RX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuR1JPUV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgQk9UX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuQk9UX0FQSV9CQVNFX1VSTCB8fCBcImh0dHBzOi8vYm90bWFuLmludC5yY2xhYmVudi5jb20vdjJcIixcbiAgQk9UX1RPS0VOOiBwcm9jZXNzLmVudi5CT1RfVE9LRU4gfHwgXCJcIixcbiAgQk9UX0lEOiBwcm9jZXNzLmVudi5CT1RfSUQgfHwgXCI0NzAwMzcyMDIwQDM3NDM5NTEwLmJvdC5nbGlwLm5ldFwiLFxuICBCT1RfVFlQRTogcHJvY2Vzcy5lbnYuQk9UX1RZUEUgfHwgXCJ1c2VyXCIsXG4gIFRFQU1fSUQ6IHByb2Nlc3MuZW52LlRFQU1fSUQgfHwgXCJcIixcbiAgRU5BQkxFX0JPVDogcHJvY2Vzcy5lbnYuRU5BQkxFX0JPVCA9PT0gXCJ0cnVlXCIsXG4gIExMTV9SRVZJRVdfQkVGT1JFX1NFTkQ6IHByb2Nlc3MuZW52LkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQgPT09IFwidHJ1ZVwiLFxuICBFTkFCTEVfQ0hST01BOiBwcm9jZXNzLmVudi5FTkFCTEVfQ0hST01BID09PSBcInRydWVcIixcbiAgQ0hST01BX0FQSV9VUkw6IHByb2Nlc3MuZW52LkNIUk9NQV9BUElfVVJMIHx8IFwiaHR0cDovL2xvY2FsaG9zdDo4MDAwXCIsXG4gIENIUk9NQV9QT1JUOiBOdW1iZXIocHJvY2Vzcy5lbnYuQ0hST01BX1BPUlQpIHx8IDgwMDAsXG4gIENIUk9NQV9DT0xMRUNUSU9OX05BTUU6IHByb2Nlc3MuZW52LkNIUk9NQV9DT0xMRUNUSU9OX05BTUUgfHwgXCJcIixcbiAgSklSQV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuSklSQV9CQVNFX1VSTCB8fCBcImh0dHBzOi8vamlyYS5yaW5nY2VudHJhbC5jb21cIixcbiAgSklSQV9VU0VSTkFNRTogcHJvY2Vzcy5lbnYuSklSQV9VU0VSTkFNRSB8fCBcIlwiLFxuICBKSVJBX0FQSV9UT0tFTjogcHJvY2Vzcy5lbnYuSklSQV9BUElfVE9LRU4gfHwgXCJcIixcbn07XG5cbi8vIOiOt+WPlueOr+Wig+mFjee9ru+8jOWmguaenOWPr+iDveeahOivneS7jiBzdG9yYWdlIOiOt+WPlu+8jOWQpuWImeS7jiBwcm9jZXNzLmVudiDojrflj5ZcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRFbnZDb25maWcoKTogUHJvbWlzZTxFbnZDb25maWdUeXBlPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBlbnZDb25maWcgfSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2VudkNvbmZpZyddKTtcbiAgICBpZiAoZW52Q29uZmlnKSB7XG4gICAgICAvLyDlsIblrZjlgqjnmoTphY3nva7kuI7pu5jorqTphY3nva7lkIjlubbvvIznoa7kv53mlrDlop7nmoTphY3nva7pobnkuZ/kvJrooqvljIXlkKtcbiAgICAgIHJldHVybiB7IC4uLmRlZmF1bHRFbnZDb25maWcsIC4uLmVudkNvbmZpZyB9O1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfojrflj5bphY3nva7lpLHotKU6JywgZXJyb3IpO1xuICB9XG4gIFxuICAvLyDlpoLmnpzojrflj5blpLHotKXmiJbmsqHmnInkv53lrZjnmoTphY3nva7vvIzov5Tlm57pu5jorqTlgLxcbiAgcmV0dXJuIGRlZmF1bHRFbnZDb25maWc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRVc2VySW5mbygpIHtcbiAgY29uc3QgYWNjb3VudFVEID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuVUQnLCAnJyk7XG4gIGNvbnN0IGFjY291bnRJbmZvTGlzdCA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2dsb2JhbC5hY2NvdW50LkFDQ09VTlRfU0VTU0lPTl9EQVRBX0xJU1QnLCB7fSk7XG5cbiAgY29uc3QgYWNjb3VudEluZm8gPSBhY2NvdW50VUQgPyBhY2NvdW50SW5mb0xpc3RbYWNjb3VudFVEXSA6IGFjY291bnRJbmZvTGlzdC5maW5kKChpdGVtOmFueSkgPT4gaXRlbS5kaXNwbGF5TmFtZSAhPSAnJyk7XG4gIGNvbnNvbGUubG9nKCdhY2NvdW50SW5mb0xpc3QnLCBhY2NvdW50SW5mb0xpc3QsIGFjY291bnRJbmZvKTtcbiAgaWYgKGFjY291bnRJbmZvKSByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiBhY2NvdW50SW5mby5leHRlbnNpb25JZCxcbiAgICBlbWFpbDogYWNjb3VudEluZm8uZW1haWwsXG4gICAgZnVsbE5hbWU6IGFjY291bnRJbmZvLmRpc3BsYXlOYW1lLFxuICAgIHVzZXJuYW1lOiBhY2NvdW50SW5mby5lbWFpbCA/IGFjY291bnRJbmZvLmVtYWlsLnRyaW0oKS5zcGxpdCgnQCcpWzBdIDogYWNjb3VudEluZm8uZGlzcGxheU5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpLFxuICB9XG5cbiAgY29uc3QgdXNlckluZm8gPSBnZXRDdXJyZW50VXNlckluZm8oKTtcbiAgcmV0dXJuIHtcbiAgICBleHRlbnNpb25JZDogdXNlckluZm8uZXh0ZW5zaW9uSWQsXG4gICAgZnVsbE5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLFxuICAgIHVzZXJuYW1lOiB1c2VySW5mby51c2VybmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gICAgZW1haWw6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSArICdAcmluZ2NlbnRyYWwuY29tJ1xuICB9O1xufVxuXG4iLCIvLyBUaGUgbW9kdWxlIGNhY2hlXG52YXIgX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fID0ge307XG5cbi8vIFRoZSByZXF1aXJlIGZ1bmN0aW9uXG5mdW5jdGlvbiBfX3dlYnBhY2tfcmVxdWlyZV9fKG1vZHVsZUlkKSB7XG5cdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuXHR2YXIgY2FjaGVkTW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXTtcblx0aWYgKGNhY2hlZE1vZHVsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIGNhY2hlZE1vZHVsZS5leHBvcnRzO1xuXHR9XG5cdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG5cdHZhciBtb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdID0ge1xuXHRcdC8vIG5vIG1vZHVsZS5pZCBuZWVkZWRcblx0XHQvLyBubyBtb2R1bGUubG9hZGVkIG5lZWRlZFxuXHRcdGV4cG9ydHM6IHt9XG5cdH07XG5cblx0Ly8gRXhlY3V0ZSB0aGUgbW9kdWxlIGZ1bmN0aW9uXG5cdF9fd2VicGFja19tb2R1bGVzX19bbW9kdWxlSWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fd2VicGFja19yZXF1aXJlX18pO1xuXG5cdC8vIFJldHVybiB0aGUgZXhwb3J0cyBvZiB0aGUgbW9kdWxlXG5cdHJldHVybiBtb2R1bGUuZXhwb3J0cztcbn1cblxuIiwiLy8gZGVmaW5lIGdldHRlciBmdW5jdGlvbnMgZm9yIGhhcm1vbnkgZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5kID0gKGV4cG9ydHMsIGRlZmluaXRpb24pID0+IHtcblx0Zm9yKHZhciBrZXkgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmKF9fd2VicGFja19yZXF1aXJlX18ubyhkZWZpbml0aW9uLCBrZXkpICYmICFfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZXhwb3J0cywga2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIGtleSwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGRlZmluaXRpb25ba2V5XSB9KTtcblx0XHR9XG5cdH1cbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIi8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uciA9IChleHBvcnRzKSA9PiB7XG5cdGlmKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1N0cmluZ1RhZykge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBTeW1ib2wudG9TdHJpbmdUYWcsIHsgdmFsdWU6ICdNb2R1bGUnIH0pO1xuXHR9XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHsgdmFsdWU6IHRydWUgfSk7XG59OyIsImltcG9ydCB7IGZldGNoSmlyYVRpY2tldHMgfSBmcm9tICcuL2ppcmEnO1xuaW1wb3J0IHsgU2hlZXQgfSBmcm9tICcuL3NoZWV0JztcbmltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyDlhajlsYDlj5jph49cbmxldCB1cmwgPSBudWxsO1xubGV0IHNoZWV0VG9rZW4gPSBudWxsO1xuXG4vLyBNYWluIGxpc3RlbmVyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ+aUtuWIsOa2iOaBrzonLCBtZXNzYWdlLCAn5Y+R6YCB6ICFOicsIHNlbmRlcik7XG5cbiAgICBpZiAoIW1lc3NhZ2UgfHwgIW1lc3NhZ2UudHlwZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+aUtuWIsOaXoOaViOa2iOaBr+agvOW8jycpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyB0eXBlIH0gPSBtZXNzYWdlO1xuXG4gICAgaWYgKHR5cGUgPT09ICdPUEVOX0pJUkFfUVVFUllfRElBTE9HJykge1xuICAgICAgICBvcGVuSnFsRGlhbG9nKG1lc3NhZ2UudXJsLCBtZXNzYWdlLnNoZWV0VG9rZW4pO1xuICAgICAgICB1cmwgPSBtZXNzYWdlLnVybDtcbiAgICAgICAgc2hlZXRUb2tlbiA9IG1lc3NhZ2Uuc2hlZXRUb2tlbjtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTsgLy8g5Li65omA5pyJ5raI5oGv5L+d5oyB5raI5oGv6YCa6YGT5byA5ZCvXG59KTtcblxuLy8g5Yib5bu6IEpRTCDmn6Xor6Llr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIG9wZW5KcWxEaWFsb2codXJsOiBzdHJpbmcsIHNoZWV0VG9rZW46IHN0cmluZykge1xuICAgIGNvbnN0IGVudkNvbmZpZyA9IGF3YWl0IGdldEVudkNvbmZpZygpO1xuICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIHRvcDogNTAlO1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgICAgIHdpZHRoOiA0MDBweDtcbiAgICBgO1xuXG4gICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDtcIj7ovpPlhaUgSlFMIOafpeivojwvaDM+XG4gICAgICAgIDx0ZXh0YXJlYSBpZD1cImpxbFwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwcHg7IG1hcmdpbi1ib3R0b206IDEwcHg7XCI+PC90ZXh0YXJlYT5cbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XCI+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsXCIgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDEwcHg7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwic3VibWl0XCI+5p+l6K+iPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAvLyDmt7vliqDkuovku7bnm5HlkKzlmahcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgfSk7XG5cbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3VibWl0Jyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBqcWwgPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pxbCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQpLnZhbHVlO1xuICAgICAgICBpZiAoanFsKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHMgPSBhd2FpdCBmZXRjaEppcmFUaWNrZXRzKGpxbCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RpY2tldHMnLCB0aWNrZXRzKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRpY2tldHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5rKh5pyJ5om+5Yiw5pWw5o2uJywgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFzaGVldFRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIOayoeacieadg+mZkOaPkuWFpe+8jOeUqOWJquWIh+adv+aooeW8j+aJi+WKqOeymOi0tFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkRGF0YSA9IFtoZWFkZXJzLmpvaW4oJ1xcdCcpLCAuLi50aWNrZXRzLm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgXG4gICAgICAgICAgICAgICAgICAgICAgfSkpLm1hcCh0aWNrZXQgPT4gaGVhZGVycy5tYXAoZmllbGQgPT4gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdKS5qb2luKCdcXHQnKSldLmpvaW4oJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2Zvcm1hdHRlZERhdGEnLCBmb3JtYXR0ZWREYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCdKaXJhIOaVsOaNruW3suWkjeWItuWIsOWJqui0tOadvycpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIOeUqOaOpeWPo+aooeW8j+iHquWKqOaPkuWFpeaVsOaNrlxuICAgICAgICAgICAgICAgICAgICBpZiAoIXVybCB8fCAhc2hlZXRUb2tlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfnvLrlsJHlv4XopoHlj4LmlbAnLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIOWwneivleebtOaOpeWcqOW9k+WJjeaJk+W8gOeahEdvb2dsZSBTaGVldHPkuK3mj5LlhaXmlbDmja5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hlZXQgPSBuZXcgU2hlZXQodXJsLCBzaGVldFRva2VuKTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNoZWV0LmluaXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlcyA9IGF3YWl0IHNoZWV0LnJlYWRTaGVldCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3ZhbHVlcycsIHZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGVldEhlYWRlcnMgPSBhd2FpdCBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnc2hlZXRIZWFkZXJzJywgc2hlZXRIZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IFsna2V5JywgJ3N1bW1hcnknLCAnc3RhdHVzJywgJ2Fzc2lnbmVlJywgJ3JlcG9ydGVyJ107XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDojrflj5booajmoLznjrDmnInmlbDmja7nmoTooYzmlbBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RSb3cgPSB2YWx1ZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+W9k+WJjeihqOagvOihjOaVsDonLCBsYXN0Um93KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5qC55o2u546w5pyJ6KGo5aS055qE5L2N572u5p6E5bu65pWw5o2uXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXR0ZWREYXRhID0gdGlja2V0cy5tYXAodGlja2V0ID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZWFkZXJWYWx1ZXMgPSBPYmplY3QudmFsdWVzKHNoZWV0SGVhZGVycykuZmlsdGVyKCh2YWx1ZSk6IHZhbHVlIGlzIHN0cmluZyA9PiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXhDb2xJbmRleCA9IGdldE1heENvbHVtbkluZGV4KGhlYWRlclZhbHVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gbmV3IEFycmF5KG1heENvbEluZGV4KS5maWxsKCcnKTsgLy8g5Yib5bu65LiA5Liq6Laz5aSf6ZW/55qE56m65pWw57uEXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDmoLnmja7ooajlpLTkvY3nva7loavlhYXmlbDmja5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzLmZvckVhY2goZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2x1bW5JbmRleCA9IHNoZWV0SGVhZGVyc1tmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbHVtbkluZGV4ICYmIHR5cGVvZiBjb2x1bW5JbmRleCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sSW5kZXggPSBnZXRDb2x1bW5JbmRleChjb2x1bW5JbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkID09PSAna2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd1tjb2xJbmRleF0gPSB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCflpITnkIbliJfntKLlvJXml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOagueaNrumcgOimgeWkhOeQhumUmeivr1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkRGF0YScsIGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5LuO5pyA5ZCO5LiA6KGM5byA5aeL6L+95Yqg5pWw5o2uXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGFydFBvc2l0aW9uID0gYEEke2xhc3RSb3cgKyAxfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBzaGVldC53cml0ZVNoZWV0KGZvcm1hdHRlZERhdGEsIHN0YXJ0UG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCdKaXJhIOaVsOaNruW3suaPkuWFpeWIsEdvb2dsZSBTaGVldHMnKTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0dvb2dsZSBTaGVldHMg5pON5L2c5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgnR29vZ2xlIFNoZWV0cyDmk43kvZzlpLHotKU6ICcgKyBlcnJvciwgJ2Vycm9yJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xor6LlpLHotKU6ICcsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBhbGVydCgn5p+l6K+i5aSx6LSlOiAnICsgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmludGVyZmFjZSBKaXJhSGVhZGVycyB7XG4gICAgc3VtbWFyeTogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gICAgaXNzdWVUeXBlOiBzdHJpbmc7XG4gICAgcHJpb3JpdHk6IHN0cmluZztcbiAgICBhc3NpZ25lZTogc3RyaW5nO1xuICAgIHJlcG9ydGVyOiBzdHJpbmc7XG4gICAgbGFiZWxzOiBzdHJpbmc7XG4gICAgY29tcG9uZW50czogc3RyaW5nO1xuICAgIGZpeFZlcnNpb25zOiBzdHJpbmc7XG4gICAgYWZmZWN0c1ZlcnNpb25zOiBzdHJpbmc7XG4gICAgbGlua2VkSXNzdWVzOiBzdHJpbmc7XG4gICAgZXBpY0xpbms6IHN0cmluZztcbiAgICBzcHJpbnQ6IHN0cmluZztcbiAgICBzdG9yeVBvaW50czogc3RyaW5nO1xuICAgIGN1c3RvbUZpZWxkczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuLy8g5p+l5om+5pyJ5pWI55qESmlyYeWtl+auteihqOWktFxuYXN5bmMgZnVuY3Rpb24gZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQ6IFNoZWV0KTogUHJvbWlzZTxKaXJhVGlja2V0PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgbGV0IGhlYWRlck1hcHBpbmc6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyDlsJ3or5Xor7vlj5bphY3nva7ooajmlbDmja5cbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0RhdGEgPSBhd2FpdCBzaGVldC5yZWFkQ29uZmlnU2hlZXQoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjb25maWdEYXRhJywgY29uZmlnRGF0YSk7XG4gICAgICAgICAgICBpZiAoY29uZmlnRGF0YSAmJiBjb25maWdEYXRhLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICAgICAgLy8g5Yib5bu66YWN572u5pig5bCE5a2X5YW4XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBjb25maWdEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IGNvbmZpZ0RhdGFbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChyb3cubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyb3dbMV0gPT09ICdKSVJBIGtleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJNYXBwaW5nW3Jvd1swXS50b0xvd2VyQ2FzZSgpXSA9ICdrZXknO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJNYXBwaW5nW3Jvd1swXS50b0xvd2VyQ2FzZSgpXSA9IHJvd1sxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ+mFjee9ruihqOaVsOaNruS4uuepuicpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfor7vlj5bphY3nva7ooajlpLHotKXvvIzlsIbkvb/nlKjpu5jorqTlrZfmrrXliKvlkI06JywgZXJyb3IpO1xuICAgICAgICAgICAgLy8g5L2/55So6buY6K6k55qE5a2X5q615Yir5ZCN5pig5bCEXG4gICAgICAgICAgICBoZWFkZXJNYXBwaW5nID0ge1xuICAgICAgICAgICAgICAgICdzdW1tYXJ5JzogJ3N1bW1hcnknLFxuICAgICAgICAgICAgICAgICfmpoLopoEnOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ2Rlc2NyaXB0aW9uJzogJ2Rlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgICAgICAn5o+P6L+wJzogJ2Rlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgICAgICAndHlwZSc6ICdpc3N1ZVR5cGUnLFxuICAgICAgICAgICAgICAgICfnsbvlnosnOiAnaXNzdWVUeXBlJyxcbiAgICAgICAgICAgICAgICAncHJpb3JpdHknOiAncHJpb3JpdHknLFxuICAgICAgICAgICAgICAgICfkvJjlhYjnuqcnOiAncHJpb3JpdHknLFxuICAgICAgICAgICAgICAgICdhc3NpZ25lZSc6ICdhc3NpZ25lZScsXG4gICAgICAgICAgICAgICAgJ+e7j+WKnuS6uic6ICdhc3NpZ25lZScsXG4gICAgICAgICAgICAgICAgJ3JlcG9ydGVyJzogJ3JlcG9ydGVyJyxcbiAgICAgICAgICAgICAgICAn5oql5ZGK5Lq6JzogJ3JlcG9ydGVyJyxcbiAgICAgICAgICAgICAgICAnbGFiZWxzJzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ+agh+etvic6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICdjb21wb25lbnRzJzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICfmqKHlnZcnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ2ZpeCB2ZXJzaW9ucyc6ICdmaXhWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+S/ruWkjeeJiOacrCc6ICdmaXhWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2FmZmVjdHMgdmVyc2lvbnMnOiAnYWZmZWN0c1ZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAn5b2x5ZON54mI5pysJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2xpbmtlZCBpc3N1ZXMnOiAnbGlua2VkSXNzdWVzJyxcbiAgICAgICAgICAgICAgICAn5YWz6IGU6Zeu6aKYJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ2VwaWMgbGluayc6ICdlcGljTGluaycsXG4gICAgICAgICAgICAgICAgJ2VwaWMnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICdzcHJpbnQnOiAnc3ByaW50JyxcbiAgICAgICAgICAgICAgICAn5Yay5Yi6JzogJ3NwcmludCcsXG4gICAgICAgICAgICAgICAgJ3N0b3J5IHBvaW50cyc6ICdzdG9yeVBvaW50cycsXG4gICAgICAgICAgICAgICAgJ+aVheS6i+eCuSc6ICdzdG9yeVBvaW50cydcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyDojrflj5blvZPliY3lt6XkvZzooajnmoTmiYDmnInliJfmoIfpophcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IGF3YWl0IHNoZWV0LmdldEhlYWRlcnMoKTtcbiAgICAgICAgY29uc29sZS5sb2coJ2hlYWRlcnMnLCBoZWFkZXJzKTtcbiAgICAgICAgY29uc3QgdmFsaWRIZWFkZXJzOiBKaXJhVGlja2V0ID0ge1xuICAgICAgICAgICAga2V5OiAnJyxcbiAgICAgICAgICAgIHN1bW1hcnk6ICcnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246ICcnLFxuICAgICAgICAgICAgaXNzdWV0eXBlOiAnJyxcbiAgICAgICAgICAgIHByaW9yaXR5OiAnJyxcbiAgICAgICAgICAgIGFzc2lnbmVlOiAnJyxcbiAgICAgICAgICAgIHJlcG9ydGVyOiAnJyxcbiAgICAgICAgICAgIGxhYmVsczogJycsXG4gICAgICAgICAgICBjb21wb25lbnRzOiAnJyxcbiAgICAgICAgICAgIGZpeFZlcnNpb25zOiAnJyxcbiAgICAgICAgICAgIGFmZmVjdHNWZXJzaW9uczogJycsXG4gICAgICAgICAgICBsaW5rZWRJc3N1ZXM6ICcnLFxuICAgICAgICAgICAgZXBpY0xpbms6ICcnLFxuICAgICAgICAgICAgc3ByaW50OiAnJyxcbiAgICAgICAgICAgIHN0b3J5UG9pbnRzOiAnJyxcbiAgICAgICAgICAgIHN0YXR1czogJycsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8g6YGN5Y6G5omA5pyJ5YiX5qCH6aKY77yM5p+l5om+5Yy56YWN55qEIEppcmEg5a2X5q61XG4gICAgICAgIGhlYWRlcnMuZm9yRWFjaCgoaGVhZGVyOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlckxvd2VyID0gaGVhZGVyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBjb25zdCBjb2x1bW5MZXR0ZXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDY1ICsgaW5kZXgpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDmo4Dmn6XmmK/lkKblnKjphY3nva7mmKDlsITkuK3lrZjlnKjljLnphY1cbiAgICAgICAgICAgIGZvciAoY29uc3QgW2NvbmZpZ0tleSwgamlyYUZpZWxkXSBvZiBPYmplY3QuZW50cmllcyhoZWFkZXJNYXBwaW5nKSkge1xuICAgICAgICAgICAgICAgIGlmIChoZWFkZXJMb3dlci5pbmNsdWRlcyhjb25maWdLZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDliKvlkI3ljLnphY06IFwiJHtoZWFkZXJMb3dlcn1cIiAtPiBcIiR7amlyYUZpZWxkfVwiICjliJcgJHtjb2x1bW5MZXR0ZXJ9KWApO1xuICAgICAgICAgICAgICAgICAgICAodmFsaWRIZWFkZXJzIGFzIGFueSlbamlyYUZpZWxkXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChPYmplY3Qua2V5cyh2YWxpZEhlYWRlcnMpLmluY2x1ZGVzKGhlYWRlckxvd2VyKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5a2X5q615Yy56YWNOiBcIiR7aGVhZGVyTG93ZXJ9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgICAgICh2YWxpZEhlYWRlcnMgYXMgYW55KVtoZWFkZXJMb3dlcl0gPSBjb2x1bW5MZXR0ZXI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8g5qOA5p+l5piv5ZCm55u05o6l5Yy56YWN5a2X5q615ZCNXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZpZWxkIG9mIE9iamVjdC5rZXlzKHZhbGlkSGVhZGVycykpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmllbGQgIT09ICdjdXN0b21GaWVsZHMnICYmIGhlYWRlckxvd2VyID09PSBmaWVsZC50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDnm7TmjqXljLnphY06IFwiJHtoZWFkZXJMb3dlcn1cIiAtPiBcIiR7ZmllbGR9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgICAgICh2YWxpZEhlYWRlcnMgYXMgYW55KVtmaWVsZF0gPSBjb2x1bW5MZXR0ZXI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+acgOe7iOWMuemFjee7k+aenDonLCB2YWxpZEhlYWRlcnMpO1xuICAgICAgICByZXR1cm4gdmFsaWRIZWFkZXJzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+afpeaJvuacieaViCBKaXJhIOagh+mimOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29sdW1uSW5kZXgoY29sdW1uOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGlmICghY29sdW1uIHx8IHR5cGVvZiBjb2x1bW4gIT09ICdzdHJpbmcnIHx8IGNvbHVtbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfml6DmlYjnmoTliJfmoIfor4YnKTtcbiAgICB9XG4gICAgY29uc3QgdXBwZXJDb2x1bW4gPSBjb2x1bW4udG9VcHBlckNhc2UoKTtcbiAgICByZXR1cm4gdXBwZXJDb2x1bW4uY2hhckNvZGVBdCgwKSAtIDY1O1xufVxuXG5mdW5jdGlvbiBnZXRNYXhDb2x1bW5JbmRleChoZWFkZXJzOiBzdHJpbmdbXSk6IG51bWJlciB7XG4gICAgaWYgKCFoZWFkZXJzIHx8ICFBcnJheS5pc0FycmF5KGhlYWRlcnMpIHx8IGhlYWRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBjb25zdCB2YWxpZEhlYWRlcnMgPSBoZWFkZXJzLmZpbHRlcihoID0+IHR5cGVvZiBoID09PSAnc3RyaW5nJyAmJiBoLmxlbmd0aCA+IDApO1xuICAgIHJldHVybiBNYXRoLm1heCguLi52YWxpZEhlYWRlcnMubWFwKGNvbCA9PiBjb2wudG9VcHBlckNhc2UoKS5jaGFyQ29kZUF0KDApIC0gNjQpKTtcbn1cblxuLy8g5re75Yqg5pi+56S6IHRvYXN0IOeahOWHveaVsFxuZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2U6IHN0cmluZywgdHlwZSA9ICdpbmZvJykge1xuICAgIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdG9hc3QudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIHRvYXN0LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogJHt0eXBlID09PSAnZXJyb3InID8gJ3JnYmEoMjIwLCA1MywgNjksIDAuOSknIDogdHlwZSA9PT0gJ3N1Y2Nlc3MnID8gJ3JnYmEoNDAsIDE2NywgNjksIDAuOSknIDogJ3JnYmEoMCwgMCwgMCwgMC43KSd9O1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCA1cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gICAgYDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgIH0pO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgICAgICB9LCAzMDApO1xuICAgIH0sIDMwMDApO1xufVxuIl0sIm5hbWVzIjpbImdldEVudkNvbmZpZyIsIkRFRkFVTFRfSklSQV9GSUVMRFMiLCJmZXRjaEppcmFUaWNrZXRzIiwianFsIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZXF1ZXN0SWQiLCJNYXRoIiwicmFuZG9tIiwidG9TdHJpbmciLCJzdWJzdHJpbmciLCJtZXNzYWdlTGlzdGVuZXIiLCJtZXNzYWdlIiwidHlwZSIsImNocm9tZSIsInJ1bnRpbWUiLCJvbk1lc3NhZ2UiLCJyZW1vdmVMaXN0ZW5lciIsImVycm9yIiwiRXJyb3IiLCJ0aWNrZXRzIiwiYWRkTGlzdGVuZXIiLCJzZW5kTWVzc2FnZSIsIkZFVENIX0pJUkFfVElDS0VUUyIsInNvdXJjZVRhYklkIiwiZW52Q29uZmlnIiwidXJsIiwiSklSQV9CQVNFX1VSTCIsImVuY29kZVVSSUNvbXBvbmVudCIsInRhYnMiLCJjcmVhdGUiLCJhY3RpdmUiLCJ0YWIiLCJpZCIsImNoZWNrUGFnZUxvYWQiLCJnZXQiLCJ1cGRhdGVkVGFiIiwic3RhdHVzIiwic2NyaXB0aW5nIiwiZXhlY3V0ZVNjcmlwdCIsInRhcmdldCIsInRhYklkIiwiZnVuYyIsInJvd3MiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb3JFYWNoIiwicm93IiwidGlja2V0Iiwia2V5IiwicXVlcnlTZWxlY3RvciIsInRleHRDb250ZW50IiwidHJpbSIsInN1bW1hcnkiLCJhc3NpZ25lZSIsInJlcG9ydGVyIiwicHJpb3JpdHkiLCJjcmVhdGVkIiwidXBkYXRlZCIsImR1ZWRhdGUiLCJkZXNjcmlwdGlvbiIsInB1c2giLCJyZXN1bHRzIiwicmVzdWx0IiwibWFwIiwic3BsaXQiLCJzbGljZSIsInJlbW92ZSIsInNldFRpbWVvdXQiLCJTaGVldCIsImNvbnN0cnVjdG9yIiwidG9rZW4iLCJzaGVldElkIiwiZXh0cmFjdFNoZWV0SWQiLCJnaWQiLCJleHRyYWN0R2lkIiwiaW5pdCIsImdldFRva2VuIiwic2hlZXROYW1lIiwiZ2V0U2hlZXROYW1lQnlHaWQiLCJpZGVudGl0eSIsImdldEF1dGhUb2tlbiIsImludGVyYWN0aXZlIiwibGFzdEVycm9yIiwibWF0Y2giLCJnZXRTaGVldE5hbWVzIiwicmVzIiwiZmV0Y2giLCJoZWFkZXJzIiwiQXV0aG9yaXphdGlvbiIsImpzb24iLCJzaGVldHMiLCJzaGVldCIsImZpbmQiLCJzIiwicHJvcGVydGllcyIsInRpdGxlIiwicmVhZFNoZWV0Iiwic2hlZXRVcmwiLCJ2YWx1ZXMiLCJ3cml0ZVNoZWV0IiwicG9zaXRpb24iLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJtZXRob2QiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsInJlYWRDb25maWdTaGVldCIsImNvbmZpZ1NoZWV0TmFtZSIsImNvbnNvbGUiLCJnZXRIZWFkZXJzIiwiZ2V0U2hlZXROYW1lIiwiZ2V0SW5kZXhlZERCRGF0YSIsImRhdGFiYXNlTmFtZSIsInN0b3JlTmFtZSIsInJlcXVlc3QiLCJpbmRleGVkREIiLCJvcGVuIiwib25zdWNjZXNzIiwiZXZlbnQiLCJkYiIsInRyYW5zYWN0aW9uIiwib2JqZWN0U3RvcmUiLCJkYXRhUmVxdWVzdCIsImdldEFsbCIsIm9uZXJyb3IiLCJnZXRMb2NhbFN0b3JhZ2VJdGVtIiwiZGVmYXVsdFZhbHVlIiwicGFyc2UiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwic2V0TG9jYWxTdG9yYWdlSXRlbSIsInNldEl0ZW0iLCJnZXRDdXJyZW50VXNlckluZm8iLCJleHRlbnNpb24iLCJleHRlbnNpb25JZCIsInVzZXJuYW1lIiwiZ2V0Rm9sZGVycyIsInRoZW4iLCJfcmVmIiwiZGF0YSIsImZhdm9yaXRlX2dyb3VwX2lkcyIsImNvbnZlcnNhdGlvbl9zZXRzIiwiZm9sZGVycyIsImlkcyIsImZpbHRlciIsIml0ZW0iLCJjYXRjaCIsImxvZyIsImdldEdyb3Vwc01hcCIsImdyb3VwcyIsImdyb3Vwc01hcCIsInJlZHVjZSIsImFjYyIsImdyb3VwIiwibmFtZSIsInNldF9hYmJyZXZpYXRpb24iLCJpc190ZWFtIiwiZm9ybWF0RGF0ZSIsImRhdGVTdHJpbmciLCJkYXRlIiwiRGF0ZSIsInllYXIiLCJnZXRGdWxsWWVhciIsIm1vbnRoIiwiU3RyaW5nIiwiZ2V0TW9udGgiLCJwYWRTdGFydCIsImRheSIsImdldERhdGUiLCJob3VycyIsImdldEhvdXJzIiwibWludXRlcyIsImdldE1pbnV0ZXMiLCJzZWNvbmRzIiwiZ2V0U2Vjb25kcyIsInVuaXFCeSIsImFycmF5Iiwic2VlbiIsIlNldCIsImtleVZhbHVlIiwiaGFzIiwiYWRkIiwic2hvd1RvYXN0Iiwib25DbG9zZSIsImNvbnRhaW5lciIsImdldEVsZW1lbnRCeUlkIiwiZXhpc3RpbmdUb2FzdCIsInJlbW92ZUNoaWxkIiwidG9hc3QiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwidG9hc3RJbm5lciIsImFwcGVuZENoaWxkIiwidGltZXIiLCJjb250YWlucyIsImNsZWFyVGltZW91dCIsInRyYW5zZm9ybUdyb3VwTGlua3MiLCJpbnB1dFN0cmluZyIsImdyb3VwTGlua1BhdHRlcm4iLCJ0cmFuc2Zvcm1lZFN0cmluZyIsInJlcGxhY2UiLCJncm91cE5hbWUiLCJncm91cElkIiwidHJhbnNmb3JtUG9zdExpbmtzIiwicG9zdExpbmtQYXR0ZXJuIiwiaW5kZXgiLCJwb3N0SWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwiZGVmYXVsdEVudkNvbmZpZyIsIlNDSEVEVUxFRF9JTlRFUlZBTCIsIk51bWJlciIsInByb2Nlc3MiLCJlbnYiLCJBTkFMWVNJU19UWVBFIiwiTExNX1RZUEUiLCJBTkFMWVpFX0JZX0dST1VQIiwiT0xMQU1BX0JBU0VfVVJMIiwiT0xMQU1BX01PREVMIiwiT0xMQU1BX1JFVklFV19NT0RFTCIsIk9MTEFNQV9RVUVSWV9NT0RFTCIsIkRJRllfQVBJX0tFWSIsIkRJRllfUkVWSUVXX0FQSV9LRVkiLCJESUZZX0FQSV9CQVNFX1VSTCIsIk9QRU5BSV9BUElfS0VZIiwiT1BFTkFJX01PREVMIiwiT1BFTkFJX1JFVklFV19NT0RFTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJHUk9RX0FQSV9LRVkiLCJHUk9RX01PREVMIiwiR1JPUV9SRVZJRVdfTU9ERUwiLCJCT1RfQVBJX0JBU0VfVVJMIiwiQk9UX1RPS0VOIiwiQk9UX0lEIiwiQk9UX1RZUEUiLCJURUFNX0lEIiwiRU5BQkxFX0JPVCIsIkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQiLCJFTkFCTEVfQ0hST01BIiwiQ0hST01BX0FQSV9VUkwiLCJDSFJPTUFfUE9SVCIsIkNIUk9NQV9DT0xMRUNUSU9OX05BTUUiLCJKSVJBX1VTRVJOQU1FIiwiSklSQV9BUElfVE9LRU4iLCJzdG9yYWdlIiwibG9jYWwiLCJnZXRVc2VySW5mbyIsImFjY291bnRVRCIsImFjY291bnRJbmZvTGlzdCIsImFjY291bnRJbmZvIiwiZGlzcGxheU5hbWUiLCJlbWFpbCIsImZ1bGxOYW1lIiwiam9pbiIsInRvTG93ZXJDYXNlIiwidXNlckluZm8iLCJzaGVldFRva2VuIiwic2VuZGVyIiwic2VuZFJlc3BvbnNlIiwid2FybiIsIm9wZW5KcWxEaWFsb2ciLCJkaWFsb2ciLCJzdHlsZSIsImNzc1RleHQiLCJpbm5lckhUTUwiLCJhZGRFdmVudExpc3RlbmVyIiwidmFsdWUiLCJmb3JtYXR0ZWREYXRhIiwiZmllbGQiLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJzaGVldEhlYWRlcnMiLCJmaW5kVmFsaWRKaXJhSGVhZGVycyIsImxhc3RSb3ciLCJoZWFkZXJWYWx1ZXMiLCJPYmplY3QiLCJtYXhDb2xJbmRleCIsImdldE1heENvbHVtbkluZGV4IiwiQXJyYXkiLCJmaWxsIiwiY29sdW1uSW5kZXgiLCJjb2xJbmRleCIsImdldENvbHVtbkluZGV4Iiwic3RhcnRQb3NpdGlvbiIsImFsZXJ0IiwiaGVhZGVyTWFwcGluZyIsImNvbmZpZ0RhdGEiLCJpIiwidmFsaWRIZWFkZXJzIiwiaXNzdWV0eXBlIiwibGFiZWxzIiwiY29tcG9uZW50cyIsImZpeFZlcnNpb25zIiwiYWZmZWN0c1ZlcnNpb25zIiwibGlua2VkSXNzdWVzIiwiZXBpY0xpbmsiLCJzcHJpbnQiLCJzdG9yeVBvaW50cyIsImhlYWRlciIsImhlYWRlckxvd2VyIiwiY29sdW1uTGV0dGVyIiwiZnJvbUNoYXJDb2RlIiwiY29uZmlnS2V5IiwiamlyYUZpZWxkIiwiZW50cmllcyIsImluY2x1ZGVzIiwia2V5cyIsImNvbHVtbiIsInVwcGVyQ29sdW1uIiwidG9VcHBlckNhc2UiLCJjaGFyQ29kZUF0IiwiaXNBcnJheSIsImgiLCJtYXgiLCJjb2wiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJvcGFjaXR5Il0sInNvdXJjZVJvb3QiOiIifQ==