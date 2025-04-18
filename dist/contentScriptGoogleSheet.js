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
            const headers = ['key', 'summary', 'status', 'assignee', 'reporter'];

            // 找到 key 列的索引
            const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
            if (keyColumnIndex === -1) {
              throw new Error('未找到 key 列');
            }

            // 创建现有 key 到行号的映射
            const keyToRowMap = new Map();
            values.forEach((row, index) => {
              const key = row[keyColumnIndex]?.replace(/.*"([^"]+)".*/, '$1');
              if (key) {
                keyToRowMap.set(key, index);
              }
            });

            // 准备操作数据
            const operations = tickets.map(ticket => {
              const existingRowIndex = keyToRowMap.get(ticket.key);
              return {
                ticket,
                type: existingRowIndex !== undefined ? 'update' : 'append',
                rowIndex: existingRowIndex
              };
            });

            // 显示确认弹窗
            const confirmedOperations = await showConfirmationDialog(operations, headers, sheetHeaders);
            if (confirmedOperations.length === 0) {
              showToast('操作已取消');
              document.body.removeChild(dialog);
              return;
            }

            // 分离需要更新和需要追加的数据
            const updatesData = [];
            const appendData = [];

            // 处理确认的操作
            confirmedOperations.forEach(operation => {
              const headerValues = Object.values(sheetHeaders).filter(value => typeof value === 'string' && value.length > 0);
              const maxColIndex = getMaxColumnIndex(headerValues);
              const row = new Array(maxColIndex).fill('');

              // 填充数据
              headers.forEach(field => {
                const columnIndex = sheetHeaders[field];
                if (columnIndex && typeof columnIndex === 'string') {
                  try {
                    const colIndex = getColumnIndex(columnIndex);
                    if (field === 'key') {
                      row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${operation.ticket.key}", "${operation.ticket.key}")`;
                    } else {
                      row[colIndex] = operation.ticket[field] || '';
                    }
                  } catch (error) {
                    console.error('处理列索引时出错:', error);
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

            // 执行更新操作
            if (updatesData.length > 0) {
              for (const update of updatesData) {
                await sheet.writeSheet([update.data], `A${update.rowIndex + 1}`);
              }
              showToast(`已更新 ${updatesData.length} 条现有数据`);
            }

            // 执行追加操作
            if (appendData.length > 0) {
              const startPosition = `A${values.length + 1}`;
              await sheet.writeSheet(appendData, startPosition);
              showToast(`已追加 ${appendData.length} 条新数据`);
            }
            if (updatesData.length === 0 && appendData.length === 0) {
              showToast('没有需要更新或追加的数据');
            }
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
        'jira': 'key',
        'jira key': 'key',
        'jira link': 'key',
        'jira id': 'key',
        'init': 'key',
        'title': 'summary',
        '概要': 'summary',
        '描述': 'description',
        'type': 'issueType',
        '类型': 'issueType',
        '优先级': 'priority',
        '经办人': 'assignee',
        '报告人': 'reporter',
        'label': 'labels',
        '标签': 'labels',
        'component': 'components',
        '模块': 'components',
        'fix versions': 'fixVersions',
        '修复版本': 'fixVersions',
        'affects versions': 'affectsVersions',
        '影响版本': 'affectsVersions',
        'linked issues': 'linkedIssues',
        '关联问题': 'linkedIssues',
        'epic link': 'epicLink',
        'epic': 'epicLink',
        '冲刺': 'sprint',
        'story points': 'storyPoints',
        'story point': 'storyPoints',
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
        if (headerLower === field.toLowerCase()) {
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

// 显示确认弹窗
async function showConfirmationDialog(operations, headers, sheetHeaders) {
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
            z-index: 10000;
            width: 800px;
            max-height: 80vh;
            overflow-y: auto;
        `;

    // 获取将要更新的列
    const columnsToUpdate = headers.filter(field => sheetHeaders[field]).map(field => field);
    const updateCount = operations.filter(op => op.type === 'update').length;
    const appendCount = operations.filter(op => op.type === 'append').length;
    dialog.innerHTML = `
            <h3 style="margin-top: 0;">确认数据操作</h3>
            <div style="margin-bottom: 15px;">
                <div style="margin-bottom: 10px;">
                    <strong>将要更新的列：</strong>
                    <span style="color: #666;">${columnsToUpdate.join(', ')}</span>
                </div>
                <div style="color: #666;">
                    <div>更新现有数据：${updateCount} 条</div>
                    <div>新增数据：${appendCount} 条</div>
                </div>
            </div>
            <div style="margin-bottom: 10px;">
                <label>
                    <input type="checkbox" id="selectAll" checked>
                    全选
                </label>
            </div>
            <div style="margin-bottom: 15px; border: 1px solid #eee; border-radius: 4px; max-height: 400px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left; position: sticky; top: 0; background: #f5f5f5;">选择</th>
                            <th style="padding: 8px; text-align: left; position: sticky; top: 0; background: #f5f5f5;">操作类型</th>
                            <th style="padding: 8px; text-align: left; position: sticky; top: 0; background: #f5f5f5;">Key</th>
                            <th style="padding: 8px; text-align: left; position: sticky; top: 0; background: #f5f5f5;">概要</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${operations.map((op, index) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 8px;">
                                    <input type="checkbox" class="ticket-checkbox" data-index="${index}" checked>
                                </td>
                                <td style="padding: 8px;">
                                    <span style="color: ${op.type === 'update' ? '#f0ad4e' : '#5cb85c'}">
                                        ${op.type === 'update' ? '更新' : '新增'}
                                    </span>
                                </td>
                                <td style="padding: 8px;">${op.ticket.key}</td>
                                <td style="padding: 8px;">${op.ticket.summary}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cancelOperation" style="padding: 6px 12px;">取消</button>
                <button id="confirmOperation" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px;">确认</button>
            </div>
        `;
    document.body.appendChild(dialog);

    // 全选/取消全选功能
    const selectAllCheckbox = document.getElementById('selectAll');
    const ticketCheckboxes = document.getElementsByClassName('ticket-checkbox');
    selectAllCheckbox.addEventListener('change', () => {
      Array.from(ticketCheckboxes).forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
      });
    });

    // 监听单个 checkbox 变化，更新全选状态
    Array.from(ticketCheckboxes).forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        selectAllCheckbox.checked = Array.from(ticketCheckboxes).every(cb => cb.checked);
      });
    });

    // 取消按钮
    document.getElementById('cancelOperation')?.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve([]);
    });

    // 确认按钮
    document.getElementById('confirmOperation')?.addEventListener('click', () => {
      const selectedOperations = Array.from(ticketCheckboxes).filter(checkbox => checkbox.checked).map(checkbox => operations[parseInt(checkbox.dataset.index || '0')]);
      document.body.removeChild(dialog);
      resolve(selectedOperations);
    });
  });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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c0JoUSxJQUFJLEtBQUssT0FBTyxHQUFHLHdCQUF3QixHQUFHQSxJQUFJLEtBQUssU0FBUyxHQUFHLHdCQUF3QixHQUFHLG9CQUFvQjtBQUN4STtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7RUFDRGtDLFFBQVEsQ0FBQzZELElBQUksQ0FBQ3lGLFdBQVcsQ0FBQ0osS0FBSyxDQUFDO0VBQ2hDMEoscUJBQXFCLENBQUMsTUFBTTtJQUN4QjFKLEtBQUssQ0FBQzJFLEtBQUssQ0FBQ2dGLE9BQU8sR0FBRyxHQUFHO0VBQzdCLENBQUMsQ0FBQztFQUNGclQsVUFBVSxDQUFDLE1BQU07SUFDYjBKLEtBQUssQ0FBQzJFLEtBQUssQ0FBQ2dGLE9BQU8sR0FBRyxHQUFHO0lBQ3pCclQsVUFBVSxDQUFDLE1BQU07TUFDYlEsUUFBUSxDQUFDNkQsSUFBSSxDQUFDb0YsV0FBVyxDQUFDQyxLQUFLLENBQUM7SUFDcEMsQ0FBQyxFQUFFLEdBQUcsQ0FBQztFQUNYLENBQUMsRUFBRSxJQUFJLENBQUM7QUFDWixDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvamlyYS50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9zaGVldC50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9zdG9yYWdlLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3V0aWxzLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvY29udGVudFNjcmlwdEdvb2dsZVNoZWV0LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBKaXJhVGlja2V0IH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRFbnZDb25maWcgfSBmcm9tICcuL3V0aWxzJztcblxuLy8g6buY6K6k55qEIEppcmEg5a2X5q616YWN572uXG5jb25zdCBERUZBVUxUX0pJUkFfRklFTERTID0ge1xuICAnS2V5JzogJ2tleScsXG4gICdTdW1tYXJ5JzogJ3N1bW1hcnknLFxuICAnU3RhdHVzJzogJ3N0YXR1cycsXG4gICdBc3NpZ25lZSc6ICdhc3NpZ25lZScsXG4gICdSZXBvcnRlcic6ICdyZXBvcnRlcicsXG4gICdQcmlvcml0eSc6ICdwcmlvcml0eScsXG4gICdDcmVhdGVkJzogJ2NyZWF0ZWQnLFxuICAnVXBkYXRlZCc6ICd1cGRhdGVkJyxcbiAgJ0R1ZSBEYXRlJzogJ2R1ZWRhdGUnLFxuICAnRGVzY3JpcHRpb24nOiAnZGVzY3JpcHRpb24nXG59O1xuXG4vLyDku44gSmlyYSDpobXpnaLmipPlj5bmlbDmja5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaEppcmFUaWNrZXRzKGpxbDogc3RyaW5nKTogUHJvbWlzZTxKaXJhVGlja2V0W10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0SWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoNyk7XG4gICAgICAgIFxuICAgICAgICAvLyDnm5HlkKzmnaXoh6ogYmFja2dyb3VuZCBzY3JpcHQg55qE5raI5oGvXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VMaXN0ZW5lciA9IChtZXNzYWdlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyAmJiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gcmVxdWVzdElkKSB7XG4gICAgICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlLmVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLnRpY2tldHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgIFxuICAgICAgICAvLyDlj5HpgIHmtojmga/nu5kgYmFja2dyb3VuZCBzY3JpcHQg5p2l5Yib5bu65paw5qCH562+6aG1XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdGRVRDSF9KSVJBX1RJQ0tFVFMnLFxuICAgICAgICAgICAganFsLFxuICAgICAgICAgICAgcmVxdWVzdElkXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDnhLblkI7lnKggRkVUQ0hfSklSQV9USUNLRVRTIOWHveaVsOS4reS9v+eUqCBzb3VyY2VUYWJJZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEZFVENIX0pJUkFfVElDS0VUUyhqcWw6IHN0cmluZywgcmVxdWVzdElkOiBzdHJpbmcsIHNvdXJjZVRhYklkOiBudW1iZXIpIHtcbiAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gIGNvbnN0IHVybCA9IGAke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9pc3N1ZXMvP2pxbD0ke2VuY29kZVVSSUNvbXBvbmVudChqcWwpfWA7XG4gICAgICAgIFxuICAvLyDliJvlu7rmlrDmoIfnrb7pobVcbiAgY2hyb21lLnRhYnMuY3JlYXRlKHsgdXJsLCBhY3RpdmU6IGZhbHNlIH0sICh0YWIpID0+IHtcbiAgICAgIGlmICghdGFiLmlkKSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgIGVycm9yOiAn5peg5rOV5Yib5bu65qCH562+6aG1J1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICBjb25zdCBjaGVja1BhZ2VMb2FkID0gKCkgPT4ge1xuICAgICAgICAgIGNocm9tZS50YWJzLmdldCh0YWIuaWQhLCAodXBkYXRlZFRhYikgPT4ge1xuICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi5zdGF0dXMgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi51cmwuaW5jbHVkZXMoJ2xvZ2luJykgfHwgdXBkYXRlZFRhYi51cmwuaW5jbHVkZXMoJ29rdGEnKSkge1xuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShzb3VyY2VUYWJJZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdqaXJhIOmcgOimgeeZu+W9le+8jOivt+eZu+W9leWQjumHjeaWsOWwneivlSdcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gY2hyb21lLnRhYnMudXBkYXRlKHRhYi5pZCEsIHsgYWN0aXZlOiB0cnVlIH0pLCAzMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIC8vIOazqOWFpeWGheWuueiEmuacrFxuICAgICAgICAgICAgICAgICAgY2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdGFiSWQ6IHRhYi5pZCEgfSxcbiAgICAgICAgICAgICAgICAgICAgICBmdW5jOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ci5pc3N1ZXJvdycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiByb3cucXVlcnlTZWxlY3RvcignLmlzc3Vla2V5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5zdW1tYXJ5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiByb3cucXVlcnlTZWxlY3RvcignLnN0YXR1cycpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlOiByb3cucXVlcnlTZWxlY3RvcignLmFzc2lnbmVlJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZXI6IHJvdy5xdWVyeVNlbGVjdG9yKCcucmVwb3J0ZXInKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5wcmlvcml0eScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcuY3JlYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcudXBkYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGU6IHJvdy5xdWVyeVNlbGVjdG9yKCcuZHVlZGF0ZScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiByb3cucXVlcnlTZWxlY3RvcignLmRlc2NyaXB0aW9uJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGlja2V0cztcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9LCAocmVzdWx0cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzWzBdLnJlc3VsdCA9IHJlc3VsdHNbMF0ucmVzdWx0Lm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogdGlja2V0LnN1bW1hcnkuc3BsaXQoJ1xcbicpLnNsaWNlKC0xKVswXS50cmltKCksXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5Y+R6YCB57uT5p6c5Zue5rqQ5qCH562+6aG1XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiByZXN1bHRzWzBdLnJlc3VsdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIOWFs+mXrSBKaXJhIOagh+etvumhtVxuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5yZW1vdmUodGFiLmlkISk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoY2hlY2tQYWdlTG9hZCwgMTAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgY2hlY2tQYWdlTG9hZCgpO1xuICB9KTtcbn1cbiIsImV4cG9ydCBjbGFzcyBTaGVldCB7XG4gIHByaXZhdGUgdG9rZW46IHN0cmluZztcbiAgcHJpdmF0ZSBzaGVldElkOiBzdHJpbmc7XG4gIHByaXZhdGUgZ2lkOiBzdHJpbmc7XG4gIHByaXZhdGUgc2hlZXROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcsIHRva2VuOiBzdHJpbmcpIHtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5zaGVldElkID0gdGhpcy5leHRyYWN0U2hlZXRJZCh1cmwpO1xuICAgIHRoaXMuZ2lkID0gdGhpcy5leHRyYWN0R2lkKHVybCk7XG4gIH1cbiAgICBcbiAgYXN5bmMgaW5pdCgpIHtcbiAgICBpZiAoIXRoaXMudG9rZW4pIHRoaXMudG9rZW4gPSBhd2FpdCB0aGlzLmdldFRva2VuKCk7XG4gICAgdGhpcy5zaGVldE5hbWUgPSBhd2FpdCB0aGlzLmdldFNoZWV0TmFtZUJ5R2lkKHRoaXMudG9rZW4sIHRoaXMuc2hlZXRJZCwgdGhpcy5naWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjaHJvbWUuaWRlbnRpdHkuZ2V0QXV0aFRva2VuKHsgaW50ZXJhY3RpdmU6IHRydWUgfSwgKHRva2VuKSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgICAgIGVsc2UgcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZXh0cmFjdFNoZWV0SWQodXJsOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvXFwvZFxcLyhbYS16QS1aMC05LV9dKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBleHRyYWN0R2lkKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL1sjJl1naWQ9KFswLTldKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBhc3luYyBnZXRTaGVldE5hbWVzKHRva2VuOiBzdHJpbmcsIHNoZWV0SWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3NoZWV0SWR9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9XG4gICAgfSk7XG4gICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgcmV0dXJuIGpzb24uc2hlZXRzO1xuICB9XG5cbiAgYXN5bmMgZ2V0U2hlZXROYW1lQnlHaWQodG9rZW46IHN0cmluZywgc2hlZXRJZDogc3RyaW5nLCBnaWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qgc2hlZXRzID0gYXdhaXQgdGhpcy5nZXRTaGVldE5hbWVzKHRva2VuLCBzaGVldElkKTtcbiAgICBjb25zdCBzaGVldCA9IHNoZWV0cy5maW5kKChzOiBhbnkpID0+IHMucHJvcGVydGllcy5zaGVldElkLnRvU3RyaW5nKCkgPT09IGdpZCk7XG4gICAgcmV0dXJuIHNoZWV0ID8gc2hlZXQucHJvcGVydGllcy50aXRsZSA6IHNoZWV0c1swXS5wcm9wZXJ0aWVzLnRpdGxlOyAvLyDlpoLmnpzmib7kuI3liLDlr7nlupTnmoRnaWQs6L+U5Zue56ys5LiA5Liqc2hlZXTnmoTlkI3np7BcbiAgfVxuXG4gIGFzeW5jIHJlYWRTaGVldCgpOiBQcm9taXNlPHN0cmluZ1tdW10+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gIH1cbiAgICB9KTtcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICByZXR1cm4ganNvbi52YWx1ZXM7XG4gIH1cblxuICBhc3luYyB3cml0ZVNoZWV0KHZhbHVlczogc3RyaW5nW11bXSwgcG9zaXRpb24gPSAnQTEnKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfSEke3Bvc2l0aW9ufT92YWx1ZUlucHV0T3B0aW9uPVVTRVJfRU5URVJFRGA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgdmFsdWVzIH0pXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gIH1cblxuICAvKipcbiAgICog6K+75Y+W6YWN572u6KGo5pWw5o2uXG4gICAqIEBwYXJhbSBzaGVldE5hbWUg6YWN572u6KGo5ZCN56ewXG4gICAqIEByZXR1cm5zIOmFjee9ruihqOaVsOaNrlxuICAgKi9cbiAgYXN5bmMgcmVhZENvbmZpZ1NoZWV0KGNvbmZpZ1NoZWV0TmFtZSA9ICcnKTogUHJvbWlzZTxzdHJpbmdbXVtdPiB7XG4gICAgaWYgKCFjb25maWdTaGVldE5hbWUpIGNvbmZpZ1NoZWV0TmFtZSA9IHRoaXMuc2hlZXROYW1lICsgJ19jb25maWcnO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7Y29uZmlnU2hlZXROYW1lfWA7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICAgIHJldHVybiBqc29uLnZhbHVlcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign6K+75Y+W6YWN572u6KGo5aSx6LSlOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5booajmoLznmoTnrKzkuIDooYzkvZzkuLrooajlpLRcbiAgICogQHJldHVybnMg6KGo5aS05pWw57uEXG4gICAqL1xuICBhc3luYyBnZXRIZWFkZXJzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCB0aGlzLnJlYWRTaGVldCgpO1xuICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign6KGo5qC85Li656m6Jyk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXNbMF07XG4gIH1cblxuICBwdWJsaWMgZ2V0U2hlZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc2hlZXROYW1lO1xuICB9XG59IiwiZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4ZWREQkRhdGEoZGF0YWJhc2VOYW1lOiBzdHJpbmcsIHN0b3JlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oZGF0YWJhc2VOYW1lKTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbihbc3RvcmVOYW1lXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBkYXRhUmVxdWVzdCA9IG9iamVjdFN0b3JlLmdldEFsbCgpO1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgICAgICB9O1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn1cblxuXG5leHBvcnQgY29uc3QgZ2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8IEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IHNldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VXNlckluZm8oKSB7XG4gICAgY29uc3QgeyBleHRlbnNpb246IGV4dGVuc2lvbklkIH0gPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdvd25FeHRlbnNpb24nLCB7fSk7XG4gICAgY29uc3QgdXNlcm5hbWUgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdkaXNwbGF5TmFtZScsICdyYWRhci1wb2MnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBleHRlbnNpb25JZCxcbiAgICAgICAgdXNlcm5hbWVcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rm9sZGVycygpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdwcm9maWxlJykudGhlbigoW2RhdGFdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmYXZvcml0ZV9ncm91cF9pZHMgPSBkYXRhPy5mYXZvcml0ZV9ncm91cF9pZHMgfHwgW107XG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25fc2V0cyA9IGRhdGE/LmNvbnZlcnNhdGlvbl9zZXRzIHx8IFtdO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IFt7dGl0bGU6ICcgJywgaWRzOiBbXX0se3RpdGxlOiAnZmF2b3JpdGUnLCBpZHM6IGZhdm9yaXRlX2dyb3VwX2lkc30sIC4uLmNvbnZlcnNhdGlvbl9zZXRzLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2ZvbGRlcicpXVxuICAgICAgICAgICAgcmV0dXJuIGZvbGRlcnM7XG4gICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0R3JvdXBzTWFwKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ2dyb3VwJykudGhlbigoZ3JvdXBzKSA9PiB7XG4gICAgICAgIGNvbnN0IGdyb3Vwc01hcCA9IGdyb3Vwcy5yZWR1Y2UoKGFjYzogYW55LCBncm91cDogYW55KSA9PiB7XG4gICAgICAgICAgICBhY2NbZ3JvdXAuaWRdID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLnNldF9hYmJyZXZpYXRpb24sXG4gICAgICAgICAgICAgICAgaXNfdGVhbTogZ3JvdXAuaXNfdGVhbVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sIHt9KTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBzTWFwO1xuICAgIH0pO1xufSIsImltcG9ydCB7IGdldEN1cnJlbnRVc2VySW5mbywgZ2V0TG9jYWxTdG9yYWdlSXRlbSB9IGZyb20gXCIuL3N0b3JhZ2VcIjtcblxuLy8g546v5aKD6YWN572u57G75Z6L5a6a5LmJXG5leHBvcnQgaW50ZXJmYWNlIEVudkNvbmZpZ1R5cGUge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IG51bWJlcjtcbiAgQU5BTFlTSVNfVFlQRTogc3RyaW5nO1xuICBBTkFMWVpFX0JZX0dST1VQOiBib29sZWFuO1xuICBMTE1fVFlQRTogc3RyaW5nO1xuICBPTExBTUFfQkFTRV9VUkw6IHN0cmluZztcbiAgT0xMQU1BX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBzdHJpbmc7XG4gIERJRllfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX1JFVklFV19BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfS0VZOiBzdHJpbmc7XG4gIE9QRU5BSV9NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgR1JPUV9BUElfS0VZOiBzdHJpbmc7XG4gIEdST1FfTU9ERUw6IHN0cmluZztcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgQk9UX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBCT1RfVE9LRU46IHN0cmluZztcbiAgQk9UX0lEOiBzdHJpbmc7XG4gIEJPVF9UWVBFOiBzdHJpbmc7XG4gIFRFQU1fSUQ6IHN0cmluZztcbiAgRU5BQkxFX0JPVDogYm9vbGVhbjtcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogYm9vbGVhbjtcbiAgRU5BQkxFX0NIUk9NQTogYm9vbGVhbjtcbiAgQ0hST01BX0FQSV9VUkw6IHN0cmluZztcbiAgQ0hST01BX1BPUlQ6IG51bWJlcjtcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogc3RyaW5nO1xuICAvLyBKSVJB55u45YWz6YWN572uXG4gIEpJUkFfQkFTRV9VUkw/OiBzdHJpbmc7XG4gIEpJUkFfVVNFUk5BTUU/OiBzdHJpbmc7XG4gIEpJUkFfQVBJX1RPS0VOPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gICAgXG4gICAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBob3VycyA9IFN0cmluZyhkYXRlLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICBcbiAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9ICR7aG91cnN9OiR7bWludXRlc306JHtzZWNvbmRzfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnkoYXJyYXk6IGFueVtdLCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgcmV0dXJuIGFycmF5LmZpbHRlcihpdGVtID0+IHtcbiAgICAgIGNvbnN0IGtleVZhbHVlID0gaXRlbVtrZXldO1xuICAgICAgaWYgKHNlZW4uaGFzKGtleVZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLmFkZChrZXlWYWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgb25DbG9zZT86ICgpID0+IHZvaWQpIHtcbiAgLy8g6I635Y+W5oiW5Yib5bu65a655Zmo5YWD57SgXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyYWRhci1wb2MtcmVzdWx0Jyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm5cblxuICAvLyDnp7vpmaTnjrDmnInnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IGV4aXN0aW5nVG9hc3QgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLnJhZGFyLXBvYy10b2FzdCcpO1xuICBpZiAoZXhpc3RpbmdUb2FzdCkge1xuICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChleGlzdGluZ1RvYXN0KTtcbiAgfVxuXG4gIC8vIOWIm+W7uuaWsOeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHJhZGFyLXBvYy10b2FzdCByYWRhci1wb2MtdG9hc3QtJHt0eXBlfWA7XG5cbiAgY29uc3QgdG9hc3RJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdElubmVyLmNsYXNzTmFtZSA9ICdyYWRhci1wb2MtdG9hc3QtaW5uZXInO1xuICB0b2FzdElubmVyLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblxuICB0b2FzdC5hcHBlbmRDaGlsZCh0b2FzdElubmVyKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcblxuICAvLyDorr7nva7lrprml7blmajlnKggMyDnp5LlkI7lhbPpl60gVG9hc3RcbiAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH0sIDMwMDApO1xuXG4gIC8vIOi/lOWbnuS4gOS4quWHveaVsOS7peS+v+aJi+WKqOWFs+mXrSBUb2FzdFxuICByZXR1cm4gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtR3JvdXBMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IGdyb3VwTGlua1BhdHRlcm4gPSAvXFxbZ3JvdXA6KC4rKTooXFxkKylcXF0vZztcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKGdyb3VwTGlua1BhdHRlcm4sIChtYXRjaCwgZ3JvdXBOYW1lLCBncm91cElkKSA9PiB7XG4gICAgcmV0dXJuIGBbJHtncm91cE5hbWV9XSgvbWVzc2FnZXMvJHtncm91cElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtUG9zdExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgcG9zdExpbmtQYXR0ZXJuID0gL1xcW3Bvc3Q6KFxcZCspXFxdL2c7XG4gIGxldCBpbmRleCA9IDE7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShwb3N0TGlua1BhdHRlcm4sIChtYXRjaCwgcG9zdElkKSA9PiB7XG4gICAgcmV0dXJuIGBbWyR7aW5kZXgrK31dXSgvbCR7d2luZG93LmxvY2F0aW9uLnBhdGhuYW1lfS8ke3Bvc3RJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuLy8g6buY6K6k546v5aKD6YWN572uXG5leHBvcnQgY29uc3QgZGVmYXVsdEVudkNvbmZpZzogRW52Q29uZmlnVHlwZSA9IHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBOdW1iZXIocHJvY2Vzcy5lbnYuU0NIRURVTEVEX0lOVEVSVkFMKSB8fCAxMjAsXG4gIEFOQUxZU0lTX1RZUEU6IHByb2Nlc3MuZW52LkFOQUxZU0lTX1RZUEUgfHwgXCJmaWx0ZXJcIixcbiAgTExNX1RZUEU6IHByb2Nlc3MuZW52LkxMTV9UWVBFIHx8IFwiZGlmeVwiLFxuICBBTkFMWVpFX0JZX0dST1VQOiBwcm9jZXNzLmVudi5BTkFMWVpFX0JZX0dST1VQID09PSBcInRydWVcIixcbiAgT0xMQU1BX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PTExBTUFfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjExNDM0XCIsXG4gIE9MTEFNQV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX01PREVMIHx8IFwiZGVlcHNlZWstcjFcIixcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1JFVklFV19NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1FVRVJZX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgRElGWV9BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9SRVZJRVdfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuRElGWV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9LRVk6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZIHx8IFwiXCIsXG4gIE9QRU5BSV9NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBHUk9RX0FQSV9LRVk6IHByb2Nlc3MuZW52LkdST1FfQVBJX0tFWSB8fCBcIlwiLFxuICBHUk9RX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX01PREVMIHx8IFwiXCIsXG4gIEdST1FfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBCT1RfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5CT1RfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9ib3RtYW4uaW50LnJjbGFiZW52LmNvbS92MlwiLFxuICBCT1RfVE9LRU46IHByb2Nlc3MuZW52LkJPVF9UT0tFTiB8fCBcIlwiLFxuICBCT1RfSUQ6IHByb2Nlc3MuZW52LkJPVF9JRCB8fCBcIjQ3MDAzNzIwMjBAMzc0Mzk1MTAuYm90LmdsaXAubmV0XCIsXG4gIEJPVF9UWVBFOiBwcm9jZXNzLmVudi5CT1RfVFlQRSB8fCBcInVzZXJcIixcbiAgVEVBTV9JRDogcHJvY2Vzcy5lbnYuVEVBTV9JRCB8fCBcIlwiLFxuICBFTkFCTEVfQk9UOiBwcm9jZXNzLmVudi5FTkFCTEVfQk9UID09PSBcInRydWVcIixcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogcHJvY2Vzcy5lbnYuTExNX1JFVklFV19CRUZPUkVfU0VORCA9PT0gXCJ0cnVlXCIsXG4gIEVOQUJMRV9DSFJPTUE6IHByb2Nlc3MuZW52LkVOQUJMRV9DSFJPTUEgPT09IFwidHJ1ZVwiLFxuICBDSFJPTUFfQVBJX1VSTDogcHJvY2Vzcy5lbnYuQ0hST01BX0FQSV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgQ0hST01BX1BPUlQ6IE51bWJlcihwcm9jZXNzLmVudi5DSFJPTUFfUE9SVCkgfHwgODAwMCxcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogcHJvY2Vzcy5lbnYuQ0hST01BX0NPTExFQ1RJT05fTkFNRSB8fCBcIlwiLFxuICBKSVJBX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5KSVJBX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9qaXJhLnJpbmdjZW50cmFsLmNvbVwiLFxuICBKSVJBX1VTRVJOQU1FOiBwcm9jZXNzLmVudi5KSVJBX1VTRVJOQU1FIHx8IFwiXCIsXG4gIEpJUkFfQVBJX1RPS0VOOiBwcm9jZXNzLmVudi5KSVJBX0FQSV9UT0tFTiB8fCBcIlwiLFxufTtcblxuLy8g6I635Y+W546v5aKD6YWN572u77yM5aaC5p6c5Y+v6IO955qE6K+d5LuOIHN0b3JhZ2Ug6I635Y+W77yM5ZCm5YiZ5LuOIHByb2Nlc3MuZW52IOiOt+WPllxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEVudkNvbmZpZygpOiBQcm9taXNlPEVudkNvbmZpZ1R5cGU+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGVudkNvbmZpZyB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFsnZW52Q29uZmlnJ10pO1xuICAgIGlmIChlbnZDb25maWcpIHtcbiAgICAgIC8vIOWwhuWtmOWCqOeahOmFjee9ruS4jum7mOiupOmFjee9ruWQiOW5tu+8jOehruS/neaWsOWinueahOmFjee9rumhueS5n+S8muiiq+WMheWQq1xuICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdEVudkNvbmZpZywgLi4uZW52Q29uZmlnIH07XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+iOt+WPlumFjee9ruWksei0pTonLCBlcnJvcik7XG4gIH1cbiAgXG4gIC8vIOWmguaenOiOt+WPluWksei0peaIluayoeacieS/neWtmOeahOmFjee9ru+8jOi/lOWbnum7mOiupOWAvFxuICByZXR1cm4gZGVmYXVsdEVudkNvbmZpZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJJbmZvKCkge1xuICBjb25zdCBhY2NvdW50VUQgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdnbG9iYWwuYWNjb3VudC5VRCcsICcnKTtcbiAgY29uc3QgYWNjb3VudEluZm9MaXN0ID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuQUNDT1VOVF9TRVNTSU9OX0RBVEFfTElTVCcsIHt9KTtcblxuICBjb25zdCBhY2NvdW50SW5mbyA9IGFjY291bnRVRCA/IGFjY291bnRJbmZvTGlzdFthY2NvdW50VURdIDogYWNjb3VudEluZm9MaXN0LmZpbmQoKGl0ZW06YW55KSA9PiBpdGVtLmRpc3BsYXlOYW1lICE9ICcnKTtcbiAgY29uc29sZS5sb2coJ2FjY291bnRJbmZvTGlzdCcsIGFjY291bnRJbmZvTGlzdCwgYWNjb3VudEluZm8pO1xuICBpZiAoYWNjb3VudEluZm8pIHJldHVybiB7XG4gICAgZXh0ZW5zaW9uSWQ6IGFjY291bnRJbmZvLmV4dGVuc2lvbklkLFxuICAgIGVtYWlsOiBhY2NvdW50SW5mby5lbWFpbCxcbiAgICBmdWxsTmFtZTogYWNjb3VudEluZm8uZGlzcGxheU5hbWUsXG4gICAgdXNlcm5hbWU6IGFjY291bnRJbmZvLmVtYWlsID8gYWNjb3VudEluZm8uZW1haWwudHJpbSgpLnNwbGl0KCdAJylbMF0gOiBhY2NvdW50SW5mby5kaXNwbGF5TmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gIH1cblxuICBjb25zdCB1c2VySW5mbyA9IGdldEN1cnJlbnRVc2VySW5mbygpO1xuICByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiB1c2VySW5mby5leHRlbnNpb25JZCxcbiAgICBmdWxsTmFtZTogdXNlckluZm8udXNlcm5hbWUsXG4gICAgdXNlcm5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSxcbiAgICBlbWFpbDogdXNlckluZm8udXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpICsgJ0ByaW5nY2VudHJhbC5jb20nXG4gIH07XG59XG5cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IHsgZmV0Y2hKaXJhVGlja2V0cyB9IGZyb20gJy4vamlyYSc7XG5pbXBvcnQgeyBTaGVldCB9IGZyb20gJy4vc2hlZXQnO1xuaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RW52Q29uZmlnIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIOWFqOWxgOWPmOmHj1xubGV0IHVybCA9IG51bGw7XG5sZXQgc2hlZXRUb2tlbiA9IG51bGw7XG5cbi8vIE1haW4gbGlzdGVuZXJcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBjb25zb2xlLmxvZygn5pS25Yiw5raI5oGvOicsIG1lc3NhZ2UsICflj5HpgIHogIU6Jywgc2VuZGVyKTtcblxuICAgIGlmICghbWVzc2FnZSB8fCAhbWVzc2FnZS50eXBlKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign5pS25Yiw5peg5pWI5raI5oGv5qC85byPJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IHR5cGUgfSA9IG1lc3NhZ2U7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09QRU5fSklSQV9RVUVSWV9ESUFMT0cnKSB7XG4gICAgICAgIG9wZW5KcWxEaWFsb2cobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbik7XG4gICAgICAgIHVybCA9IG1lc3NhZ2UudXJsO1xuICAgICAgICBzaGVldFRva2VuID0gbWVzc2FnZS5zaGVldFRva2VuO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlOyAvLyDkuLrmiYDmnInmtojmga/kv53mjIHmtojmga/pgJrpgZPlvIDlkK9cbn0pO1xuXG4vLyDliJvlu7ogSlFMIOafpeivouWvueivneahhlxuYXN5bmMgZnVuY3Rpb24gb3BlbkpxbERpYWxvZyh1cmw6IHN0cmluZywgc2hlZXRUb2tlbjogc3RyaW5nKSB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgIGA7XG5cbiAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwO1wiPui+k+WFpSBKUUwg5p+l6K+iPC9oMz5cbiAgICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj48L3RleHRhcmVhPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcIj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxcIiBzdHlsZT1cIm1hcmdpbi1yaWdodDogMTBweDtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzdWJtaXRcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgYDtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgIC8vIOa3u+WKoOS6i+S7tuebkeWQrOWZqFxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWwnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJtaXQnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGpxbCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanFsJykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XG4gICAgICAgIGlmIChqcWwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGlja2V0cycsIHRpY2tldHMpO1xuICAgICAgICAgICAgICAgIGlmICghdGlja2V0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmsqHmnInmib7liLDmlbDmja4nLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXNoZWV0VG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5rKh5pyJ5p2D6ZmQ5o+S5YWl77yM55So5Ymq5YiH5p2/5qih5byP5omL5Yqo57KY6LS0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXR0ZWREYXRhID0gW2hlYWRlcnMuam9pbignXFx0JyksIC4uLnRpY2tldHMubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWBcbiAgICAgICAgICAgICAgICAgICAgICB9KSkubWFwKHRpY2tldCA9PiBoZWFkZXJzLm1hcChmaWVsZCA9PiB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0pLmpvaW4oJ1xcdCcpKV0uam9pbignXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkRGF0YScsIGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0ppcmEg5pWw5o2u5bey5aSN5Yi25Yiw5Ymq6LS05p2/Jyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g55So5o6l5Y+j5qih5byP6Ieq5Yqo5o+S5YWl5pWw5o2uXG4gICAgICAgICAgICAgICAgICAgIGlmICghdXJsIHx8ICFzaGVldFRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeW/heimgeWPguaVsCcsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8g5bCd6K+V55u05o6l5Zyo5b2T5YmN5omT5byA55qER29vZ2xlIFNoZWV0c+S4reaPkuWFpeaVsOaNrlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGVldCA9IG5ldyBTaGVldCh1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndmFsdWVzJywgdmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVycyA9IGF3YWl0IGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmib7liLAga2V5IOWIl+eahOe0ouW8lVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+acquaJvuWIsCBrZXkg5YiXJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWIm+W7uueOsOaciSBrZXkg5Yiw6KGM5Y+355qE5pig5bCEXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXlUb1Jvd01hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMuZm9yRWFjaCgocm93OiBzdHJpbmdbXSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IHJvd1trZXlDb2x1bW5JbmRleF0/LnJlcGxhY2UoLy4qXCIoW15cIl0rKVwiLiovLCAnJDEnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleVRvUm93TWFwLnNldChrZXksIGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YeG5aSH5pON5L2c5pWw5o2uXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBvcGVyYXRpb25zOiBUaWNrZXRPcGVyYXRpb25bXSA9IHRpY2tldHMubWFwKHRpY2tldCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdSb3dJbmRleCA9IGtleVRvUm93TWFwLmdldCh0aWNrZXQua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IGV4aXN0aW5nUm93SW5kZXggIT09IHVuZGVmaW5lZCA/ICd1cGRhdGUnIDogJ2FwcGVuZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBleGlzdGluZ1Jvd0luZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmmL7npLrnoa7orqTlvLnnqpdcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpcm1lZE9wZXJhdGlvbnMgPSBhd2FpdCBzaG93Q29uZmlybWF0aW9uRGlhbG9nKG9wZXJhdGlvbnMsIGhlYWRlcnMsIHNoZWV0SGVhZGVycyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb25maXJtZWRPcGVyYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5pON5L2c5bey5Y+W5raIJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5YiG56a76ZyA6KaB5pu05paw5ZKM6ZyA6KaB6L+95Yqg55qE5pWw5o2uXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVzRGF0YTogVXBkYXRlRGF0YVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhcHBlbmREYXRhOiBzdHJpbmdbXVtdID0gW107XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWkhOeQhuehruiupOeahOaTjeS9nFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlybWVkT3BlcmF0aW9ucy5mb3JFYWNoKG9wZXJhdGlvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVyVmFsdWVzID0gT2JqZWN0LnZhbHVlcyhzaGVldEhlYWRlcnMpLmZpbHRlcigodmFsdWUpOiB2YWx1ZSBpcyBzdHJpbmcgPT4gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF4Q29sSW5kZXggPSBnZXRNYXhDb2x1bW5JbmRleChoZWFkZXJWYWx1ZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IG5ldyBBcnJheShtYXhDb2xJbmRleCkuZmlsbCgnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDloavlhYXmlbDmja5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJzLmZvckVhY2goZmllbGQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2x1bW5JbmRleCA9IHNoZWV0SGVhZGVyc1tmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbHVtbkluZGV4ICYmIHR5cGVvZiBjb2x1bW5JbmRleCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sSW5kZXggPSBnZXRDb2x1bW5JbmRleChjb2x1bW5JbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpZWxkID09PSAna2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHtvcGVyYXRpb24udGlja2V0LmtleX1cIiwgXCIke29wZXJhdGlvbi50aWNrZXQua2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IG9wZXJhdGlvbi50aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCflpITnkIbliJfntKLlvJXml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAob3BlcmF0aW9uLnR5cGUgPT09ICd1cGRhdGUnICYmIG9wZXJhdGlvbi5yb3dJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZXNEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93SW5kZXg6IG9wZXJhdGlvbi5yb3dJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHJvd1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBlbmREYXRhLnB1c2gocm93KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+abtOaWsOaVsOaNrjonLCB1cGRhdGVzRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn6L+95Yqg5pWw5o2uOicsIGFwcGVuZERhdGEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmiafooYzmm7TmlrDmk43kvZxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cGRhdGVzRGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGUgb2YgdXBkYXRlc0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChbdXBkYXRlLmRhdGFdLCBgQSR7dXBkYXRlLnJvd0luZGV4ICsgMX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDlt7Lmm7TmlrAgJHt1cGRhdGVzRGF0YS5sZW5ndGh9IOadoeeOsOacieaVsOaNrmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmiafooYzov73liqDmk43kvZxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcHBlbmREYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGFydFBvc2l0aW9uID0gYEEke3ZhbHVlcy5sZW5ndGggKyAxfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChhcHBlbmREYXRhLCBzdGFydFBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOW3sui/veWKoCAke2FwcGVuZERhdGEubGVuZ3RofSDmnaHmlrDmlbDmja5gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVwZGF0ZXNEYXRhLmxlbmd0aCA9PT0gMCAmJiBhcHBlbmREYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5rKh5pyJ6ZyA6KaB5pu05paw5oiW6L+95Yqg55qE5pWw5o2uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdHb29nbGUgU2hlZXRzIOaTjeS9nOWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0dvb2dsZSBTaGVldHMg5pON5L2c5aSx6LSlOiAnICsgZXJyb3IsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign5p+l6K+i5aSx6LSlOiAnLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgYWxlcnQoJ+afpeivouWksei0pTogJyArIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5pbnRlcmZhY2UgSmlyYUhlYWRlcnMge1xuICAgIHN1bW1hcnk6IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgIGlzc3VlVHlwZTogc3RyaW5nO1xuICAgIHByaW9yaXR5OiBzdHJpbmc7XG4gICAgYXNzaWduZWU6IHN0cmluZztcbiAgICByZXBvcnRlcjogc3RyaW5nO1xuICAgIGxhYmVsczogc3RyaW5nO1xuICAgIGNvbXBvbmVudHM6IHN0cmluZztcbiAgICBmaXhWZXJzaW9uczogc3RyaW5nO1xuICAgIGFmZmVjdHNWZXJzaW9uczogc3RyaW5nO1xuICAgIGxpbmtlZElzc3Vlczogc3RyaW5nO1xuICAgIGVwaWNMaW5rOiBzdHJpbmc7XG4gICAgc3ByaW50OiBzdHJpbmc7XG4gICAgc3RvcnlQb2ludHM6IHN0cmluZztcbiAgICBjdXN0b21GaWVsZHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbmludGVyZmFjZSBVcGRhdGVEYXRhIHtcbiAgICByb3dJbmRleDogbnVtYmVyO1xuICAgIGRhdGE6IHN0cmluZ1tdO1xufVxuXG5pbnRlcmZhY2UgVGlja2V0T3BlcmF0aW9uIHtcbiAgICB0aWNrZXQ6IEppcmFUaWNrZXQ7XG4gICAgdHlwZTogJ3VwZGF0ZScgfCAnYXBwZW5kJztcbiAgICByb3dJbmRleD86IG51bWJlcjtcbn1cblxuLy8g5p+l5om+5pyJ5pWI55qESmlyYeWtl+auteihqOWktFxuYXN5bmMgZnVuY3Rpb24gZmluZFZhbGlkSmlyYUhlYWRlcnMoc2hlZXQ6IFNoZWV0KTogUHJvbWlzZTxKaXJhVGlja2V0PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgbGV0IGhlYWRlck1hcHBpbmc6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyDlsJ3or5Xor7vlj5bphY3nva7ooajmlbDmja5cbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0RhdGEgPSBhd2FpdCBzaGVldC5yZWFkQ29uZmlnU2hlZXQoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjb25maWdEYXRhJywgY29uZmlnRGF0YSk7XG4gICAgICAgICAgICBpZiAoY29uZmlnRGF0YSAmJiBjb25maWdEYXRhLmxlbmd0aCA+PSAyKSB7XG4gICAgICAgICAgICAgICAgLy8g5Yib5bu66YWN572u5pig5bCE5a2X5YW4XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBjb25maWdEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IGNvbmZpZ0RhdGFbaV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChyb3cubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyb3dbMV0gPT09ICdKSVJBIGtleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJNYXBwaW5nW3Jvd1swXS50b0xvd2VyQ2FzZSgpXSA9ICdrZXknO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoZWFkZXJNYXBwaW5nW3Jvd1swXS50b0xvd2VyQ2FzZSgpXSA9IHJvd1sxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ+mFjee9ruihqOaVsOaNruS4uuepuicpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfor7vlj5bphY3nva7ooajlpLHotKXvvIzlsIbkvb/nlKjpu5jorqTlrZfmrrXliKvlkI06JywgZXJyb3IpO1xuICAgICAgICAgICAgLy8g5L2/55So6buY6K6k55qE5a2X5q615Yir5ZCN5pig5bCEXG4gICAgICAgICAgICBoZWFkZXJNYXBwaW5nID0ge1xuICAgICAgICAgICAgICAgICdqaXJhJzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2ppcmEga2V5JzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2ppcmEgbGluayc6ICdrZXknLFxuICAgICAgICAgICAgICAgICdqaXJhIGlkJzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2luaXQnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAndGl0bGUnOiAnc3VtbWFyeScsXG4gICAgICAgICAgICAgICAgJ+amguimgSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAn5o+P6L+wJzogJ2Rlc2NyaXB0aW9uJyxcbiAgICAgICAgICAgICAgICAndHlwZSc6ICdpc3N1ZVR5cGUnLFxuICAgICAgICAgICAgICAgICfnsbvlnosnOiAnaXNzdWVUeXBlJyxcbiAgICAgICAgICAgICAgICAn5LyY5YWI57qnJzogJ3ByaW9yaXR5JyxcbiAgICAgICAgICAgICAgICAn57uP5Yqe5Lq6JzogJ2Fzc2lnbmVlJyxcbiAgICAgICAgICAgICAgICAn5oql5ZGK5Lq6JzogJ3JlcG9ydGVyJyxcbiAgICAgICAgICAgICAgICAnbGFiZWwnOiAnbGFiZWxzJyxcbiAgICAgICAgICAgICAgICAn5qCH562+JzogJ2xhYmVscycsXG4gICAgICAgICAgICAgICAgJ2NvbXBvbmVudCc6ICdjb21wb25lbnRzJyxcbiAgICAgICAgICAgICAgICAn5qih5Z2XJzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICdmaXggdmVyc2lvbnMnOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICfkv67lpI3niYjmnKwnOiAnZml4VmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdhZmZlY3RzIHZlcnNpb25zJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+W9seWTjeeJiOacrCc6ICdhZmZlY3RzVmVyc2lvbnMnLFxuICAgICAgICAgICAgICAgICdsaW5rZWQgaXNzdWVzJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ+WFs+iBlOmXrumimCc6ICdsaW5rZWRJc3N1ZXMnLFxuICAgICAgICAgICAgICAgICdlcGljIGxpbmsnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICdlcGljJzogJ2VwaWNMaW5rJyxcbiAgICAgICAgICAgICAgICAn5Yay5Yi6JzogJ3NwcmludCcsXG4gICAgICAgICAgICAgICAgJ3N0b3J5IHBvaW50cyc6ICdzdG9yeVBvaW50cycsXG4gICAgICAgICAgICAgICAgJ3N0b3J5IHBvaW50JzogJ3N0b3J5UG9pbnRzJyxcbiAgICAgICAgICAgICAgICAn5pWF5LqL54K5JzogJ3N0b3J5UG9pbnRzJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOiOt+WPluW9k+WJjeW3peS9nOihqOeahOaJgOacieWIl+agh+mimFxuICAgICAgICBjb25zdCBoZWFkZXJzID0gYXdhaXQgc2hlZXQuZ2V0SGVhZGVycygpO1xuICAgICAgICBjb25zb2xlLmxvZygnaGVhZGVycycsIGhlYWRlcnMpO1xuICAgICAgICBjb25zdCB2YWxpZEhlYWRlcnM6IEppcmFUaWNrZXQgPSB7XG4gICAgICAgICAgICBrZXk6ICcnLFxuICAgICAgICAgICAgc3VtbWFyeTogJycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJycsXG4gICAgICAgICAgICBpc3N1ZXR5cGU6ICcnLFxuICAgICAgICAgICAgcHJpb3JpdHk6ICcnLFxuICAgICAgICAgICAgYXNzaWduZWU6ICcnLFxuICAgICAgICAgICAgcmVwb3J0ZXI6ICcnLFxuICAgICAgICAgICAgbGFiZWxzOiAnJyxcbiAgICAgICAgICAgIGNvbXBvbmVudHM6ICcnLFxuICAgICAgICAgICAgZml4VmVyc2lvbnM6ICcnLFxuICAgICAgICAgICAgYWZmZWN0c1ZlcnNpb25zOiAnJyxcbiAgICAgICAgICAgIGxpbmtlZElzc3VlczogJycsXG4gICAgICAgICAgICBlcGljTGluazogJycsXG4gICAgICAgICAgICBzcHJpbnQ6ICcnLFxuICAgICAgICAgICAgc3RvcnlQb2ludHM6ICcnLFxuICAgICAgICAgICAgc3RhdHVzOiAnJyxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyDpgY3ljobmiYDmnInliJfmoIfpopjvvIzmn6Xmib7ljLnphY3nmoQgSmlyYSDlrZfmrrVcbiAgICAgICAgaGVhZGVycy5mb3JFYWNoKChoZWFkZXI6IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgaGVhZGVyTG93ZXIgPSBoZWFkZXIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbHVtbkxldHRlciA9IFN0cmluZy5mcm9tQ2hhckNvZGUoNjUgKyBpbmRleCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuWcqOmFjee9ruaYoOWwhOS4reWtmOWcqOWMuemFjVxuICAgICAgICAgICAgZm9yIChjb25zdCBbY29uZmlnS2V5LCBqaXJhRmllbGRdIG9mIE9iamVjdC5lbnRyaWVzKGhlYWRlck1hcHBpbmcpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhlYWRlckxvd2VyLmluY2x1ZGVzKGNvbmZpZ0tleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOWIq+WQjeWMuemFjTogXCIke2hlYWRlckxvd2VyfVwiIC0+IFwiJHtqaXJhRmllbGR9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgICAgICh2YWxpZEhlYWRlcnMgYXMgYW55KVtqaXJhRmllbGRdID0gY29sdW1uTGV0dGVyO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKE9iamVjdC5rZXlzKHZhbGlkSGVhZGVycykuaW5jbHVkZXMoaGVhZGVyTG93ZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDlrZfmrrXljLnphY06IFwiJHtoZWFkZXJMb3dlcn1cIiAo5YiXICR7Y29sdW1uTGV0dGVyfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgKHZhbGlkSGVhZGVycyBhcyBhbnkpW2hlYWRlckxvd2VyXSA9IGNvbHVtbkxldHRlcjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDmo4Dmn6XmmK/lkKbnm7TmjqXljLnphY3lrZfmrrXlkI1cbiAgICAgICAgICAgIGZvciAoY29uc3QgZmllbGQgb2YgT2JqZWN0LmtleXModmFsaWRIZWFkZXJzKSkge1xuICAgICAgICAgICAgICAgIGlmIChoZWFkZXJMb3dlciA9PT0gZmllbGQudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg55u05o6l5Yy56YWNOiBcIiR7aGVhZGVyTG93ZXJ9XCIgLT4gXCIke2ZpZWxkfVwiICjliJcgJHtjb2x1bW5MZXR0ZXJ9KWApO1xuICAgICAgICAgICAgICAgICAgICAodmFsaWRIZWFkZXJzIGFzIGFueSlbZmllbGRdID0gY29sdW1uTGV0dGVyO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKCfmnIDnu4jljLnphY3nu5Pmnpw6JywgdmFsaWRIZWFkZXJzKTtcbiAgICAgICAgcmV0dXJuIHZhbGlkSGVhZGVycztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfmn6Xmib7mnInmlYggSmlyYSDmoIfpopjml7blh7rplJk6JywgZXJyb3IpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldENvbHVtbkluZGV4KGNvbHVtbjogc3RyaW5nKTogbnVtYmVyIHtcbiAgICBpZiAoIWNvbHVtbiB8fCB0eXBlb2YgY29sdW1uICE9PSAnc3RyaW5nJyB8fCBjb2x1bW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcign5peg5pWI55qE5YiX5qCH6K+GJyk7XG4gICAgfVxuICAgIGNvbnN0IHVwcGVyQ29sdW1uID0gY29sdW1uLnRvVXBwZXJDYXNlKCk7XG4gICAgcmV0dXJuIHVwcGVyQ29sdW1uLmNoYXJDb2RlQXQoMCkgLSA2NTtcbn1cblxuZnVuY3Rpb24gZ2V0TWF4Q29sdW1uSW5kZXgoaGVhZGVyczogc3RyaW5nW10pOiBudW1iZXIge1xuICAgIGlmICghaGVhZGVycyB8fCAhQXJyYXkuaXNBcnJheShoZWFkZXJzKSB8fCBoZWFkZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgY29uc3QgdmFsaWRIZWFkZXJzID0gaGVhZGVycy5maWx0ZXIoaCA9PiB0eXBlb2YgaCA9PT0gJ3N0cmluZycgJiYgaC5sZW5ndGggPiAwKTtcbiAgICByZXR1cm4gTWF0aC5tYXgoLi4udmFsaWRIZWFkZXJzLm1hcChjb2wgPT4gY29sLnRvVXBwZXJDYXNlKCkuY2hhckNvZGVBdCgwKSAtIDY0KSk7XG59XG5cbi8vIOaYvuekuuehruiupOW8ueeql1xuYXN5bmMgZnVuY3Rpb24gc2hvd0NvbmZpcm1hdGlvbkRpYWxvZyhcbiAgICBvcGVyYXRpb25zOiBUaWNrZXRPcGVyYXRpb25bXSxcbiAgICBoZWFkZXJzOiBzdHJpbmdbXSxcbiAgICBzaGVldEhlYWRlcnM6IEppcmFUaWNrZXRcbik6IFByb21pc2U8VGlja2V0T3BlcmF0aW9uW10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgICAgICAgICB3aWR0aDogODAwcHg7XG4gICAgICAgICAgICBtYXgtaGVpZ2h0OiA4MHZoO1xuICAgICAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgYDtcblxuICAgICAgICAvLyDojrflj5blsIbopoHmm7TmlrDnmoTliJdcbiAgICAgICAgY29uc3QgY29sdW1uc1RvVXBkYXRlID0gaGVhZGVyc1xuICAgICAgICAgICAgLmZpbHRlcihmaWVsZCA9PiBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0pXG4gICAgICAgICAgICAubWFwKGZpZWxkID0+IGZpZWxkKTtcblxuICAgICAgICBjb25zdCB1cGRhdGVDb3VudCA9IG9wZXJhdGlvbnMuZmlsdGVyKG9wID0+IG9wLnR5cGUgPT09ICd1cGRhdGUnKS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGFwcGVuZENvdW50ID0gb3BlcmF0aW9ucy5maWx0ZXIob3AgPT4gb3AudHlwZSA9PT0gJ2FwcGVuZCcpLmxlbmd0aDtcblxuICAgICAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDtcIj7noa7orqTmlbDmja7mk43kvZw8L2gzPlxuICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDE1cHg7XCI+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cIm1hcmdpbi1ib3R0b206IDEwcHg7XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+5bCG6KaB5pu05paw55qE5YiX77yaPC9zdHJvbmc+XG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIHN0eWxlPVwiY29sb3I6ICM2NjY7XCI+JHtjb2x1bW5zVG9VcGRhdGUuam9pbignLCAnKX08L3NwYW4+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT1cImNvbG9yOiAjNjY2O1wiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2PuabtOaWsOeOsOacieaVsOaNru+8miR7dXBkYXRlQ291bnR9IOadoTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2PuaWsOWinuaVsOaNru+8miR7YXBwZW5kQ291bnR9IOadoTwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMTBweDtcIj5cbiAgICAgICAgICAgICAgICA8bGFiZWw+XG4gICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cInNlbGVjdEFsbFwiIGNoZWNrZWQ+XG4gICAgICAgICAgICAgICAgICAgIOWFqOmAiVxuICAgICAgICAgICAgICAgIDwvbGFiZWw+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgc3R5bGU9XCJtYXJnaW4tYm90dG9tOiAxNXB4OyBib3JkZXI6IDFweCBzb2xpZCAjZWVlOyBib3JkZXItcmFkaXVzOiA0cHg7IG1heC1oZWlnaHQ6IDQwMHB4OyBvdmVyZmxvdy15OiBhdXRvO1wiPlxuICAgICAgICAgICAgICAgIDx0YWJsZSBzdHlsZT1cIndpZHRoOiAxMDAlOyBib3JkZXItY29sbGFwc2U6IGNvbGxhcHNlO1wiPlxuICAgICAgICAgICAgICAgICAgICA8dGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dHIgc3R5bGU9XCJiYWNrZ3JvdW5kOiAjZjVmNWY1O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgcG9zaXRpb246IHN0aWNreTsgdG9wOiAwOyBiYWNrZ3JvdW5kOiAjZjVmNWY1O1wiPumAieaLqTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPVwicGFkZGluZzogOHB4OyB0ZXh0LWFsaWduOiBsZWZ0OyBwb3NpdGlvbjogc3RpY2t5OyB0b3A6IDA7IGJhY2tncm91bmQ6ICNmNWY1ZjU7XCI+5pON5L2c57G75Z6LPC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9XCJwYWRkaW5nOiA4cHg7IHRleHQtYWxpZ246IGxlZnQ7IHBvc2l0aW9uOiBzdGlja3k7IHRvcDogMDsgYmFja2dyb3VuZDogI2Y1ZjVmNTtcIj5LZXk8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT1cInBhZGRpbmc6IDhweDsgdGV4dC1hbGlnbjogbGVmdDsgcG9zaXRpb246IHN0aWNreTsgdG9wOiAwOyBiYWNrZ3JvdW5kOiAjZjVmNWY1O1wiPuamguimgTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICA8dGJvZHk+XG4gICAgICAgICAgICAgICAgICAgICAgICAke29wZXJhdGlvbnMubWFwKChvcCwgaW5kZXgpID0+IGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHIgc3R5bGU9XCJib3JkZXItYm90dG9tOiAxcHggc29saWQgI2VlZTtcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIGNsYXNzPVwidGlja2V0LWNoZWNrYm94XCIgZGF0YS1pbmRleD1cIiR7aW5kZXh9XCIgY2hlY2tlZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9XCJjb2xvcjogJHtvcC50eXBlID09PSAndXBkYXRlJyA/ICcjZjBhZDRlJyA6ICcjNWNiODVjJ31cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke29wLnR5cGUgPT09ICd1cGRhdGUnID8gJ+abtOaWsCcgOiAn5paw5aKeJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4O1wiPiR7b3AudGlja2V0LmtleX08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7XCI+JHtvcC50aWNrZXQuc3VtbWFyeX08L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDsgZ2FwOiAxMHB4O1wiPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxPcGVyYXRpb25cIiBzdHlsZT1cInBhZGRpbmc6IDZweCAxMnB4O1wiPuWPlua2iDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjb25maXJtT3BlcmF0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOiA2cHggMTJweDsgYmFja2dyb3VuZDogIzAwN2JmZjsgY29sb3I6IHdoaXRlOyBib3JkZXI6IG5vbmU7IGJvcmRlci1yYWRpdXM6IDRweDtcIj7noa7orqQ8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICBgO1xuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgICAgICAvLyDlhajpgIkv5Y+W5raI5YWo6YCJ5Yqf6IO9XG4gICAgICAgIGNvbnN0IHNlbGVjdEFsbENoZWNrYm94ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3NlbGVjdEFsbCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHRpY2tldENoZWNrYm94ZXMgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCd0aWNrZXQtY2hlY2tib3gnKSBhcyBIVE1MQ29sbGVjdGlvbk9mPEhUTUxJbnB1dEVsZW1lbnQ+O1xuXG4gICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsICgpID0+IHtcbiAgICAgICAgICAgIEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcykuZm9yRWFjaChjaGVja2JveCA9PiB7XG4gICAgICAgICAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9IHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8g55uR5ZCs5Y2V5LiqIGNoZWNrYm94IOWPmOWMlu+8jOabtOaWsOWFqOmAieeKtuaAgVxuICAgICAgICBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmZvckVhY2goY2hlY2tib3ggPT4ge1xuICAgICAgICAgICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHNlbGVjdEFsbENoZWNrYm94LmNoZWNrZWQgPSBBcnJheS5mcm9tKHRpY2tldENoZWNrYm94ZXMpLmV2ZXJ5KGNiID0+IGNiLmNoZWNrZWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIOWPlua2iOaMiemSrlxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsT3BlcmF0aW9uJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIOehruiupOaMiemSrlxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29uZmlybU9wZXJhdGlvbicpPy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkT3BlcmF0aW9ucyA9IEFycmF5LmZyb20odGlja2V0Q2hlY2tib3hlcylcbiAgICAgICAgICAgICAgICAuZmlsdGVyKGNoZWNrYm94ID0+IGNoZWNrYm94LmNoZWNrZWQpXG4gICAgICAgICAgICAgICAgLm1hcChjaGVja2JveCA9PiBvcGVyYXRpb25zW3BhcnNlSW50KGNoZWNrYm94LmRhdGFzZXQuaW5kZXggfHwgJzAnKV0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICByZXNvbHZlKHNlbGVjdGVkT3BlcmF0aW9ucyk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDmt7vliqDmmL7npLogdG9hc3Qg55qE5Ye95pWwXG5mdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nLCB0eXBlID0gJ2luZm8nKSB7XG4gICAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB0b2FzdC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gICAgdG9hc3Quc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICBib3R0b206IDIwcHg7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiAke3R5cGUgPT09ICdlcnJvcicgPyAncmdiYSgyMjAsIDUzLCA2OSwgMC45KScgOiB0eXBlID09PSAnc3VjY2VzcycgPyAncmdiYSg0MCwgMTY3LCA2OSwgMC45KScgOiAncmdiYSgwLCAwLCAwLCAwLjcpJ307XG4gICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgcGFkZGluZzogMTBweCAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDVweCByZ2JhKDAsIDAsIDAsIDAuMik7XG4gICAgICAgIHotaW5kZXg6IDEwMDAxO1xuICAgICAgICBvcGFjaXR5OiAwO1xuICAgICAgICB0cmFuc2l0aW9uOiBvcGFjaXR5IDAuM3MgZWFzZTtcbiAgICBgO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiB7XG4gICAgICAgIHRvYXN0LnN0eWxlLm9wYWNpdHkgPSAnMSc7XG4gICAgfSk7XG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRvYXN0LnN0eWxlLm9wYWNpdHkgPSAnMCc7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgICAgIH0sIDMwMCk7XG4gICAgfSwgMzAwMCk7XG59XG4iXSwibmFtZXMiOlsiZ2V0RW52Q29uZmlnIiwiREVGQVVMVF9KSVJBX0ZJRUxEUyIsImZldGNoSmlyYVRpY2tldHMiLCJqcWwiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlcXVlc3RJZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInN1YnN0cmluZyIsIm1lc3NhZ2VMaXN0ZW5lciIsIm1lc3NhZ2UiLCJ0eXBlIiwiY2hyb21lIiwicnVudGltZSIsIm9uTWVzc2FnZSIsInJlbW92ZUxpc3RlbmVyIiwiZXJyb3IiLCJFcnJvciIsInRpY2tldHMiLCJhZGRMaXN0ZW5lciIsInNlbmRNZXNzYWdlIiwiRkVUQ0hfSklSQV9USUNLRVRTIiwic291cmNlVGFiSWQiLCJlbnZDb25maWciLCJ1cmwiLCJKSVJBX0JBU0VfVVJMIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwidGFicyIsImNyZWF0ZSIsImFjdGl2ZSIsInRhYiIsImlkIiwiY2hlY2tQYWdlTG9hZCIsImdldCIsInVwZGF0ZWRUYWIiLCJzdGF0dXMiLCJpbmNsdWRlcyIsInNldFRpbWVvdXQiLCJ1cGRhdGUiLCJzY3JpcHRpbmciLCJleGVjdXRlU2NyaXB0IiwidGFyZ2V0IiwidGFiSWQiLCJmdW5jIiwicm93cyIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJyb3ciLCJ0aWNrZXQiLCJrZXkiLCJxdWVyeVNlbGVjdG9yIiwidGV4dENvbnRlbnQiLCJ0cmltIiwic3VtbWFyeSIsImFzc2lnbmVlIiwicmVwb3J0ZXIiLCJwcmlvcml0eSIsImNyZWF0ZWQiLCJ1cGRhdGVkIiwiZHVlZGF0ZSIsImRlc2NyaXB0aW9uIiwicHVzaCIsInJlc3VsdHMiLCJyZXN1bHQiLCJtYXAiLCJzcGxpdCIsInNsaWNlIiwicmVtb3ZlIiwiU2hlZXQiLCJjb25zdHJ1Y3RvciIsInRva2VuIiwic2hlZXRJZCIsImV4dHJhY3RTaGVldElkIiwiZ2lkIiwiZXh0cmFjdEdpZCIsImluaXQiLCJnZXRUb2tlbiIsInNoZWV0TmFtZSIsImdldFNoZWV0TmFtZUJ5R2lkIiwiaWRlbnRpdHkiLCJnZXRBdXRoVG9rZW4iLCJpbnRlcmFjdGl2ZSIsImxhc3RFcnJvciIsIm1hdGNoIiwiZ2V0U2hlZXROYW1lcyIsInJlcyIsImZldGNoIiwiaGVhZGVycyIsIkF1dGhvcml6YXRpb24iLCJqc29uIiwic2hlZXRzIiwic2hlZXQiLCJmaW5kIiwicyIsInByb3BlcnRpZXMiLCJ0aXRsZSIsInJlYWRTaGVldCIsInNoZWV0VXJsIiwidmFsdWVzIiwid3JpdGVTaGVldCIsInBvc2l0aW9uIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwibWV0aG9kIiwiYm9keSIsIkpTT04iLCJzdHJpbmdpZnkiLCJyZWFkQ29uZmlnU2hlZXQiLCJjb25maWdTaGVldE5hbWUiLCJjb25zb2xlIiwiZ2V0SGVhZGVycyIsImdldFNoZWV0TmFtZSIsImdldEluZGV4ZWREQkRhdGEiLCJkYXRhYmFzZU5hbWUiLCJzdG9yZU5hbWUiLCJyZXF1ZXN0IiwiaW5kZXhlZERCIiwib3BlbiIsIm9uc3VjY2VzcyIsImV2ZW50IiwiZGIiLCJ0cmFuc2FjdGlvbiIsIm9iamVjdFN0b3JlIiwiZGF0YVJlcXVlc3QiLCJnZXRBbGwiLCJvbmVycm9yIiwiZ2V0TG9jYWxTdG9yYWdlSXRlbSIsImRlZmF1bHRWYWx1ZSIsInBhcnNlIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsInNldExvY2FsU3RvcmFnZUl0ZW0iLCJzZXRJdGVtIiwiZ2V0Q3VycmVudFVzZXJJbmZvIiwiZXh0ZW5zaW9uIiwiZXh0ZW5zaW9uSWQiLCJ1c2VybmFtZSIsImdldEZvbGRlcnMiLCJ0aGVuIiwiX3JlZiIsImRhdGEiLCJmYXZvcml0ZV9ncm91cF9pZHMiLCJjb252ZXJzYXRpb25fc2V0cyIsImZvbGRlcnMiLCJpZHMiLCJmaWx0ZXIiLCJpdGVtIiwiY2F0Y2giLCJsb2ciLCJnZXRHcm91cHNNYXAiLCJncm91cHMiLCJncm91cHNNYXAiLCJyZWR1Y2UiLCJhY2MiLCJncm91cCIsIm5hbWUiLCJzZXRfYWJicmV2aWF0aW9uIiwiaXNfdGVhbSIsImZvcm1hdERhdGUiLCJkYXRlU3RyaW5nIiwiZGF0ZSIsIkRhdGUiLCJ5ZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsIlN0cmluZyIsImdldE1vbnRoIiwicGFkU3RhcnQiLCJkYXkiLCJnZXREYXRlIiwiaG91cnMiLCJnZXRIb3VycyIsIm1pbnV0ZXMiLCJnZXRNaW51dGVzIiwic2Vjb25kcyIsImdldFNlY29uZHMiLCJ1bmlxQnkiLCJhcnJheSIsInNlZW4iLCJTZXQiLCJrZXlWYWx1ZSIsImhhcyIsImFkZCIsInNob3dUb2FzdCIsIm9uQ2xvc2UiLCJjb250YWluZXIiLCJnZXRFbGVtZW50QnlJZCIsImV4aXN0aW5nVG9hc3QiLCJyZW1vdmVDaGlsZCIsInRvYXN0IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInRvYXN0SW5uZXIiLCJhcHBlbmRDaGlsZCIsInRpbWVyIiwiY29udGFpbnMiLCJjbGVhclRpbWVvdXQiLCJ0cmFuc2Zvcm1Hcm91cExpbmtzIiwiaW5wdXRTdHJpbmciLCJncm91cExpbmtQYXR0ZXJuIiwidHJhbnNmb3JtZWRTdHJpbmciLCJyZXBsYWNlIiwiZ3JvdXBOYW1lIiwiZ3JvdXBJZCIsInRyYW5zZm9ybVBvc3RMaW5rcyIsInBvc3RMaW5rUGF0dGVybiIsImluZGV4IiwicG9zdElkIiwid2luZG93IiwibG9jYXRpb24iLCJwYXRobmFtZSIsImRlZmF1bHRFbnZDb25maWciLCJTQ0hFRFVMRURfSU5URVJWQUwiLCJOdW1iZXIiLCJwcm9jZXNzIiwiZW52IiwiQU5BTFlTSVNfVFlQRSIsIkxMTV9UWVBFIiwiQU5BTFlaRV9CWV9HUk9VUCIsIk9MTEFNQV9CQVNFX1VSTCIsIk9MTEFNQV9NT0RFTCIsIk9MTEFNQV9SRVZJRVdfTU9ERUwiLCJPTExBTUFfUVVFUllfTU9ERUwiLCJESUZZX0FQSV9LRVkiLCJESUZZX1JFVklFV19BUElfS0VZIiwiRElGWV9BUElfQkFTRV9VUkwiLCJPUEVOQUlfQVBJX0tFWSIsIk9QRU5BSV9NT0RFTCIsIk9QRU5BSV9SRVZJRVdfTU9ERUwiLCJPUEVOQUlfQVBJX0JBU0VfVVJMIiwiR1JPUV9BUElfS0VZIiwiR1JPUV9NT0RFTCIsIkdST1FfUkVWSUVXX01PREVMIiwiQk9UX0FQSV9CQVNFX1VSTCIsIkJPVF9UT0tFTiIsIkJPVF9JRCIsIkJPVF9UWVBFIiwiVEVBTV9JRCIsIkVOQUJMRV9CT1QiLCJMTE1fUkVWSUVXX0JFRk9SRV9TRU5EIiwiRU5BQkxFX0NIUk9NQSIsIkNIUk9NQV9BUElfVVJMIiwiQ0hST01BX1BPUlQiLCJDSFJPTUFfQ09MTEVDVElPTl9OQU1FIiwiSklSQV9VU0VSTkFNRSIsIkpJUkFfQVBJX1RPS0VOIiwic3RvcmFnZSIsImxvY2FsIiwiZ2V0VXNlckluZm8iLCJhY2NvdW50VUQiLCJhY2NvdW50SW5mb0xpc3QiLCJhY2NvdW50SW5mbyIsImRpc3BsYXlOYW1lIiwiZW1haWwiLCJmdWxsTmFtZSIsImpvaW4iLCJ0b0xvd2VyQ2FzZSIsInVzZXJJbmZvIiwic2hlZXRUb2tlbiIsInNlbmRlciIsInNlbmRSZXNwb25zZSIsIndhcm4iLCJvcGVuSnFsRGlhbG9nIiwiZGlhbG9nIiwic3R5bGUiLCJjc3NUZXh0IiwiaW5uZXJIVE1MIiwiYWRkRXZlbnRMaXN0ZW5lciIsInZhbHVlIiwiZm9ybWF0dGVkRGF0YSIsImZpZWxkIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0Iiwic2hlZXRIZWFkZXJzIiwiZmluZFZhbGlkSmlyYUhlYWRlcnMiLCJrZXlDb2x1bW5JbmRleCIsImdldENvbHVtbkluZGV4Iiwia2V5VG9Sb3dNYXAiLCJNYXAiLCJzZXQiLCJvcGVyYXRpb25zIiwiZXhpc3RpbmdSb3dJbmRleCIsInJvd0luZGV4IiwiY29uZmlybWVkT3BlcmF0aW9ucyIsInNob3dDb25maXJtYXRpb25EaWFsb2ciLCJ1cGRhdGVzRGF0YSIsImFwcGVuZERhdGEiLCJvcGVyYXRpb24iLCJoZWFkZXJWYWx1ZXMiLCJPYmplY3QiLCJtYXhDb2xJbmRleCIsImdldE1heENvbHVtbkluZGV4IiwiQXJyYXkiLCJmaWxsIiwiY29sdW1uSW5kZXgiLCJjb2xJbmRleCIsInN0YXJ0UG9zaXRpb24iLCJhbGVydCIsImhlYWRlck1hcHBpbmciLCJjb25maWdEYXRhIiwiaSIsInZhbGlkSGVhZGVycyIsImlzc3VldHlwZSIsImxhYmVscyIsImNvbXBvbmVudHMiLCJmaXhWZXJzaW9ucyIsImFmZmVjdHNWZXJzaW9ucyIsImxpbmtlZElzc3VlcyIsImVwaWNMaW5rIiwic3ByaW50Iiwic3RvcnlQb2ludHMiLCJoZWFkZXIiLCJoZWFkZXJMb3dlciIsImNvbHVtbkxldHRlciIsImZyb21DaGFyQ29kZSIsImNvbmZpZ0tleSIsImppcmFGaWVsZCIsImVudHJpZXMiLCJrZXlzIiwiY29sdW1uIiwidXBwZXJDb2x1bW4iLCJ0b1VwcGVyQ2FzZSIsImNoYXJDb2RlQXQiLCJpc0FycmF5IiwiaCIsIm1heCIsImNvbCIsImNvbHVtbnNUb1VwZGF0ZSIsInVwZGF0ZUNvdW50Iiwib3AiLCJhcHBlbmRDb3VudCIsInNlbGVjdEFsbENoZWNrYm94IiwidGlja2V0Q2hlY2tib3hlcyIsImdldEVsZW1lbnRzQnlDbGFzc05hbWUiLCJmcm9tIiwiY2hlY2tib3giLCJjaGVja2VkIiwiZXZlcnkiLCJjYiIsInNlbGVjdGVkT3BlcmF0aW9ucyIsInBhcnNlSW50IiwiZGF0YXNldCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm9wYWNpdHkiXSwic291cmNlUm9vdCI6IiJ9