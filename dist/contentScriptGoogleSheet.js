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
            const headers = ['key', 'summary', 'status', 'assignee', 'reporter'];

            // 找到 key 列的索引
            const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
            if (keyColumnIndex === -1) {
              throw new Error('未找到 key 列');
            }

            // 创建现有 key 到行号的映射
            const keyToRowMap = new Map();
            values.forEach((row, index) => {
              const key = row[keyColumnIndex]?.replace(/.*"([^"]+)".*/, '$1'); // 提取超链接中的 key
              if (key) {
                keyToRowMap.set(key, index);
              }
            });

            // 分离需要更新和需要追加的数据
            const updatesData = [];
            const appendData = [];

            // 格式化每个 ticket 的数据
            tickets.forEach(ticket => {
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
                      row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`;
                    } else {
                      row[colIndex] = ticket[field] || '';
                    }
                  } catch (error) {
                    console.error('处理列索引时出错:', error);
                  }
                }
              });

              // 判断是更新还是追加
              const existingRowIndex = keyToRowMap.get(ticket.key);
              if (existingRowIndex !== undefined) {
                // 更新现有行
                updatesData.push({
                  rowIndex: existingRowIndex,
                  data: row
                });
              } else {
                // 追加新行
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUEsQ0FBQUMsTUFBQSxRQUFBRCxTQUFBLFFBQUFFLFNBQUEsR0FBQUYsU0FBQSxNQUFHLE1BQU07RUFDN0MsTUFBTXlGLEtBQUssR0FBR25KLFFBQVEsQ0FBQ29KLGFBQWEsQ0FBQyxLQUFLLENBQUM7RUFDM0NELEtBQUssQ0FBQzVJLFdBQVcsR0FBR3ZDLE9BQU87RUFDM0JtTCxLQUFLLENBQUMyRSxLQUFLLENBQUNDLE9BQU8sR0FBRztBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQjlQLElBQUksS0FBSyxPQUFPLEdBQUcsd0JBQXdCLEdBQUdBLElBQUksS0FBSyxTQUFTLEdBQUcsd0JBQXdCLEdBQUcsb0JBQW9CO0FBQ3hJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztFQUNEK0IsUUFBUSxDQUFDOEQsSUFBSSxDQUFDeUYsV0FBVyxDQUFDSixLQUFLLENBQUM7RUFDaEN5SSxxQkFBcUIsQ0FBQyxNQUFNO0lBQ3hCekksS0FBSyxDQUFDMkUsS0FBSyxDQUFDK0QsT0FBTyxHQUFHLEdBQUc7RUFDN0IsQ0FBQyxDQUFDO0VBQ0ZyUSxVQUFVLENBQUMsTUFBTTtJQUNiMkgsS0FBSyxDQUFDMkUsS0FBSyxDQUFDK0QsT0FBTyxHQUFHLEdBQUc7SUFDekJyUSxVQUFVLENBQUMsTUFBTTtNQUNieEIsUUFBUSxDQUFDOEQsSUFBSSxDQUFDb0YsV0FBVyxDQUFDQyxLQUFLLENBQUM7SUFDcEMsQ0FBQyxFQUFFLEdBQUcsQ0FBQztFQUNYLENBQUMsRUFBRSxJQUFJLENBQUM7QUFDWixDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvamlyYS50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9zaGVldC50cyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9zdG9yYWdlLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3V0aWxzLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvY29udGVudFNjcmlwdEdvb2dsZVNoZWV0LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBKaXJhVGlja2V0IH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBnZXRFbnZDb25maWcgfSBmcm9tICcuL3V0aWxzJztcblxuLy8g6buY6K6k55qEIEppcmEg5a2X5q616YWN572uXG5jb25zdCBERUZBVUxUX0pJUkFfRklFTERTID0ge1xuICAnS2V5JzogJ2tleScsXG4gICdTdW1tYXJ5JzogJ3N1bW1hcnknLFxuICAnU3RhdHVzJzogJ3N0YXR1cycsXG4gICdBc3NpZ25lZSc6ICdhc3NpZ25lZScsXG4gICdSZXBvcnRlcic6ICdyZXBvcnRlcicsXG4gICdQcmlvcml0eSc6ICdwcmlvcml0eScsXG4gICdDcmVhdGVkJzogJ2NyZWF0ZWQnLFxuICAnVXBkYXRlZCc6ICd1cGRhdGVkJyxcbiAgJ0R1ZSBEYXRlJzogJ2R1ZWRhdGUnLFxuICAnRGVzY3JpcHRpb24nOiAnZGVzY3JpcHRpb24nXG59O1xuXG4vLyDku44gSmlyYSDpobXpnaLmipPlj5bmlbDmja5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaEppcmFUaWNrZXRzKGpxbDogc3RyaW5nKTogUHJvbWlzZTxKaXJhVGlja2V0W10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0SWQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoNyk7XG4gICAgICAgIFxuICAgICAgICAvLyDnm5HlkKzmnaXoh6ogYmFja2dyb3VuZCBzY3JpcHQg55qE5raI5oGvXG4gICAgICAgIGNvbnN0IG1lc3NhZ2VMaXN0ZW5lciA9IChtZXNzYWdlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyAmJiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gcmVxdWVzdElkKSB7XG4gICAgICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlLmVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLnRpY2tldHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgIFxuICAgICAgICAvLyDlj5HpgIHmtojmga/nu5kgYmFja2dyb3VuZCBzY3JpcHQg5p2l5Yib5bu65paw5qCH562+6aG1XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdGRVRDSF9KSVJBX1RJQ0tFVFMnLFxuICAgICAgICAgICAganFsLFxuICAgICAgICAgICAgcmVxdWVzdElkXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDnhLblkI7lnKggRkVUQ0hfSklSQV9USUNLRVRTIOWHveaVsOS4reS9v+eUqCBzb3VyY2VUYWJJZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEZFVENIX0pJUkFfVElDS0VUUyhqcWw6IHN0cmluZywgcmVxdWVzdElkOiBzdHJpbmcsIHNvdXJjZVRhYklkOiBudW1iZXIpIHtcbiAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gIGNvbnN0IHVybCA9IGAke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9pc3N1ZXMvP2pxbD0ke2VuY29kZVVSSUNvbXBvbmVudChqcWwpfWA7XG4gICAgICAgIFxuICAvLyDliJvlu7rmlrDmoIfnrb7pobVcbiAgY2hyb21lLnRhYnMuY3JlYXRlKHsgdXJsLCBhY3RpdmU6IGZhbHNlIH0sICh0YWIpID0+IHtcbiAgICAgIGlmICghdGFiLmlkKSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgIGVycm9yOiAn5peg5rOV5Yib5bu65qCH562+6aG1J1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICBjb25zdCBjaGVja1BhZ2VMb2FkID0gKCkgPT4ge1xuICAgICAgICAgIGNocm9tZS50YWJzLmdldCh0YWIuaWQhLCAodXBkYXRlZFRhYikgPT4ge1xuICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi5zdGF0dXMgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICAgICAgICAgIC8vIOazqOWFpeWGheWuueiEmuacrFxuICAgICAgICAgICAgICAgICAgY2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdGFiSWQ6IHRhYi5pZCEgfSxcbiAgICAgICAgICAgICAgICAgICAgICBmdW5jOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ci5pc3N1ZXJvdycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiByb3cucXVlcnlTZWxlY3RvcignLmlzc3Vla2V5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5zdW1tYXJ5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiByb3cucXVlcnlTZWxlY3RvcignLnN0YXR1cycpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlOiByb3cucXVlcnlTZWxlY3RvcignLmFzc2lnbmVlJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZXI6IHJvdy5xdWVyeVNlbGVjdG9yKCcucmVwb3J0ZXInKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5wcmlvcml0eScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcuY3JlYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcudXBkYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGU6IHJvdy5xdWVyeVNlbGVjdG9yKCcuZHVlZGF0ZScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiByb3cucXVlcnlTZWxlY3RvcignLmRlc2NyaXB0aW9uJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGlja2V0cztcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9LCAocmVzdWx0cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzWzBdLnJlc3VsdCA9IHJlc3VsdHNbMF0ucmVzdWx0Lm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogdGlja2V0LnN1bW1hcnkuc3BsaXQoJ1xcbicpLnNsaWNlKC0xKVswXS50cmltKCksXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5Y+R6YCB57uT5p6c5Zue5rqQ5qCH562+6aG1XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiByZXN1bHRzWzBdLnJlc3VsdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIOWFs+mXrSBKaXJhIOagh+etvumhtVxuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5yZW1vdmUodGFiLmlkISk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoY2hlY2tQYWdlTG9hZCwgMTAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgY2hlY2tQYWdlTG9hZCgpO1xuICB9KTtcbn1cbiIsImV4cG9ydCBjbGFzcyBTaGVldCB7XG4gIHByaXZhdGUgdG9rZW46IHN0cmluZztcbiAgcHJpdmF0ZSBzaGVldElkOiBzdHJpbmc7XG4gIHByaXZhdGUgZ2lkOiBzdHJpbmc7XG4gIHByaXZhdGUgc2hlZXROYW1lOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IodXJsOiBzdHJpbmcsIHRva2VuOiBzdHJpbmcpIHtcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XG4gICAgdGhpcy5zaGVldElkID0gdGhpcy5leHRyYWN0U2hlZXRJZCh1cmwpO1xuICAgIHRoaXMuZ2lkID0gdGhpcy5leHRyYWN0R2lkKHVybCk7XG4gIH1cbiAgICBcbiAgYXN5bmMgaW5pdCgpIHtcbiAgICBpZiAoIXRoaXMudG9rZW4pIHRoaXMudG9rZW4gPSBhd2FpdCB0aGlzLmdldFRva2VuKCk7XG4gICAgdGhpcy5zaGVldE5hbWUgPSBhd2FpdCB0aGlzLmdldFNoZWV0TmFtZUJ5R2lkKHRoaXMudG9rZW4sIHRoaXMuc2hlZXRJZCwgdGhpcy5naWQpO1xuICB9XG5cbiAgYXN5bmMgZ2V0VG9rZW4oKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjaHJvbWUuaWRlbnRpdHkuZ2V0QXV0aFRva2VuKHsgaW50ZXJhY3RpdmU6IHRydWUgfSwgKHRva2VuKSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSByZWplY3QoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgICAgIGVsc2UgcmVzb2x2ZSh0b2tlbik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZXh0cmFjdFNoZWV0SWQodXJsOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBtYXRjaCA9IHVybC5tYXRjaCgvXFwvZFxcLyhbYS16QS1aMC05LV9dKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBleHRyYWN0R2lkKHVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgbWF0Y2ggPSB1cmwubWF0Y2goL1sjJl1naWQ9KFswLTldKykvKTtcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IG51bGw7XG4gIH1cblxuICBhc3luYyBnZXRTaGVldE5hbWVzKHRva2VuOiBzdHJpbmcsIHNoZWV0SWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3NoZWV0SWR9YDtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9XG4gICAgfSk7XG4gICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgcmV0dXJuIGpzb24uc2hlZXRzO1xuICB9XG5cbiAgYXN5bmMgZ2V0U2hlZXROYW1lQnlHaWQodG9rZW46IHN0cmluZywgc2hlZXRJZDogc3RyaW5nLCBnaWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qgc2hlZXRzID0gYXdhaXQgdGhpcy5nZXRTaGVldE5hbWVzKHRva2VuLCBzaGVldElkKTtcbiAgICBjb25zdCBzaGVldCA9IHNoZWV0cy5maW5kKChzOiBhbnkpID0+IHMucHJvcGVydGllcy5zaGVldElkLnRvU3RyaW5nKCkgPT09IGdpZCk7XG4gICAgcmV0dXJuIHNoZWV0ID8gc2hlZXQucHJvcGVydGllcy50aXRsZSA6IHNoZWV0c1swXS5wcm9wZXJ0aWVzLnRpdGxlOyAvLyDlpoLmnpzmib7kuI3liLDlr7nlupTnmoRnaWQs6L+U5Zue56ys5LiA5Liqc2hlZXTnmoTlkI3np7BcbiAgfVxuXG4gIGFzeW5jIHJlYWRTaGVldCgpOiBQcm9taXNlPHN0cmluZ1tdW10+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfWA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gIH1cbiAgICB9KTtcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgICByZXR1cm4ganNvbi52YWx1ZXM7XG4gIH1cblxuICBhc3luYyB3cml0ZVNoZWV0KHZhbHVlczogc3RyaW5nW11bXSwgcG9zaXRpb24gPSAnQTEnKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBzaGVldFVybCA9IGBodHRwczovL3NoZWV0cy5nb29nbGVhcGlzLmNvbS92NC9zcHJlYWRzaGVldHMvJHt0aGlzLnNoZWV0SWR9L3ZhbHVlcy8ke3RoaXMuc2hlZXROYW1lfSEke3Bvc2l0aW9ufT92YWx1ZUlucHV0T3B0aW9uPVVTRVJfRU5URVJFRGA7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goc2hlZXRVcmwsIHtcbiAgICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dGhpcy50b2tlbn1gLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgdmFsdWVzIH0pXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcy5qc29uKCk7XG4gIH1cblxuICAvKipcbiAgICog6K+75Y+W6YWN572u6KGo5pWw5o2uXG4gICAqIEBwYXJhbSBzaGVldE5hbWUg6YWN572u6KGo5ZCN56ewXG4gICAqIEByZXR1cm5zIOmFjee9ruihqOaVsOaNrlxuICAgKi9cbiAgYXN5bmMgcmVhZENvbmZpZ1NoZWV0KGNvbmZpZ1NoZWV0TmFtZSA9ICcnKTogUHJvbWlzZTxzdHJpbmdbXVtdPiB7XG4gICAgaWYgKCFjb25maWdTaGVldE5hbWUpIGNvbmZpZ1NoZWV0TmFtZSA9IHRoaXMuc2hlZXROYW1lICsgJ19jb25maWcnO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNoZWV0VXJsID0gYGh0dHBzOi8vc2hlZXRzLmdvb2dsZWFwaXMuY29tL3Y0L3NwcmVhZHNoZWV0cy8ke3RoaXMuc2hlZXRJZH0vdmFsdWVzLyR7Y29uZmlnU2hlZXROYW1lfWA7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHNoZWV0VXJsLCB7XG4gICAgICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0aGlzLnRva2VufWAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7XG4gICAgICAgIHJldHVybiBqc29uLnZhbHVlcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign6K+75Y+W6YWN572u6KGo5aSx6LSlOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDojrflj5booajmoLznmoTnrKzkuIDooYzkvZzkuLrooajlpLRcbiAgICogQHJldHVybnMg6KGo5aS05pWw57uEXG4gICAqL1xuICBhc3luYyBnZXRIZWFkZXJzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBjb25zdCB2YWx1ZXMgPSBhd2FpdCB0aGlzLnJlYWRTaGVldCgpO1xuICAgIGlmICghdmFsdWVzIHx8IHZhbHVlcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign6KGo5qC85Li656m6Jyk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXNbMF07XG4gIH1cblxuICBwdWJsaWMgZ2V0U2hlZXROYW1lKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuc2hlZXROYW1lO1xuICB9XG59IiwiZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4ZWREQkRhdGEoZGF0YWJhc2VOYW1lOiBzdHJpbmcsIHN0b3JlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oZGF0YWJhc2VOYW1lKTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbihbc3RvcmVOYW1lXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBkYXRhUmVxdWVzdCA9IG9iamVjdFN0b3JlLmdldEFsbCgpO1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgICAgICB9O1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn1cblxuXG5leHBvcnQgY29uc3QgZ2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8IEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IHNldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VXNlckluZm8oKSB7XG4gICAgY29uc3QgeyBleHRlbnNpb246IGV4dGVuc2lvbklkIH0gPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdvd25FeHRlbnNpb24nLCB7fSk7XG4gICAgY29uc3QgdXNlcm5hbWUgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdkaXNwbGF5TmFtZScsICdyYWRhci1wb2MnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBleHRlbnNpb25JZCxcbiAgICAgICAgdXNlcm5hbWVcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rm9sZGVycygpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdwcm9maWxlJykudGhlbigoW2RhdGFdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmYXZvcml0ZV9ncm91cF9pZHMgPSBkYXRhPy5mYXZvcml0ZV9ncm91cF9pZHMgfHwgW107XG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25fc2V0cyA9IGRhdGE/LmNvbnZlcnNhdGlvbl9zZXRzIHx8IFtdO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IFt7dGl0bGU6ICcgJywgaWRzOiBbXX0se3RpdGxlOiAnZmF2b3JpdGUnLCBpZHM6IGZhdm9yaXRlX2dyb3VwX2lkc30sIC4uLmNvbnZlcnNhdGlvbl9zZXRzLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2ZvbGRlcicpXVxuICAgICAgICAgICAgcmV0dXJuIGZvbGRlcnM7XG4gICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0R3JvdXBzTWFwKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ2dyb3VwJykudGhlbigoZ3JvdXBzKSA9PiB7XG4gICAgICAgIGNvbnN0IGdyb3Vwc01hcCA9IGdyb3Vwcy5yZWR1Y2UoKGFjYzogYW55LCBncm91cDogYW55KSA9PiB7XG4gICAgICAgICAgICBhY2NbZ3JvdXAuaWRdID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLnNldF9hYmJyZXZpYXRpb24sXG4gICAgICAgICAgICAgICAgaXNfdGVhbTogZ3JvdXAuaXNfdGVhbVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sIHt9KTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBzTWFwO1xuICAgIH0pO1xufSIsImltcG9ydCB7IGdldEN1cnJlbnRVc2VySW5mbywgZ2V0TG9jYWxTdG9yYWdlSXRlbSB9IGZyb20gXCIuL3N0b3JhZ2VcIjtcblxuLy8g546v5aKD6YWN572u57G75Z6L5a6a5LmJXG5leHBvcnQgaW50ZXJmYWNlIEVudkNvbmZpZ1R5cGUge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IG51bWJlcjtcbiAgQU5BTFlTSVNfVFlQRTogc3RyaW5nO1xuICBBTkFMWVpFX0JZX0dST1VQOiBib29sZWFuO1xuICBMTE1fVFlQRTogc3RyaW5nO1xuICBPTExBTUFfQkFTRV9VUkw6IHN0cmluZztcbiAgT0xMQU1BX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBzdHJpbmc7XG4gIERJRllfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX1JFVklFV19BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfS0VZOiBzdHJpbmc7XG4gIE9QRU5BSV9NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgR1JPUV9BUElfS0VZOiBzdHJpbmc7XG4gIEdST1FfTU9ERUw6IHN0cmluZztcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgQk9UX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBCT1RfVE9LRU46IHN0cmluZztcbiAgQk9UX0lEOiBzdHJpbmc7XG4gIEJPVF9UWVBFOiBzdHJpbmc7XG4gIFRFQU1fSUQ6IHN0cmluZztcbiAgRU5BQkxFX0JPVDogYm9vbGVhbjtcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogYm9vbGVhbjtcbiAgRU5BQkxFX0NIUk9NQTogYm9vbGVhbjtcbiAgQ0hST01BX0FQSV9VUkw6IHN0cmluZztcbiAgQ0hST01BX1BPUlQ6IG51bWJlcjtcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogc3RyaW5nO1xuICAvLyBKSVJB55u45YWz6YWN572uXG4gIEpJUkFfQkFTRV9VUkw/OiBzdHJpbmc7XG4gIEpJUkFfVVNFUk5BTUU/OiBzdHJpbmc7XG4gIEpJUkFfQVBJX1RPS0VOPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gICAgXG4gICAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBob3VycyA9IFN0cmluZyhkYXRlLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICBcbiAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9ICR7aG91cnN9OiR7bWludXRlc306JHtzZWNvbmRzfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnkoYXJyYXk6IGFueVtdLCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgcmV0dXJuIGFycmF5LmZpbHRlcihpdGVtID0+IHtcbiAgICAgIGNvbnN0IGtleVZhbHVlID0gaXRlbVtrZXldO1xuICAgICAgaWYgKHNlZW4uaGFzKGtleVZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLmFkZChrZXlWYWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgb25DbG9zZT86ICgpID0+IHZvaWQpIHtcbiAgLy8g6I635Y+W5oiW5Yib5bu65a655Zmo5YWD57SgXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyYWRhci1wb2MtcmVzdWx0Jyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm5cblxuICAvLyDnp7vpmaTnjrDmnInnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IGV4aXN0aW5nVG9hc3QgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLnJhZGFyLXBvYy10b2FzdCcpO1xuICBpZiAoZXhpc3RpbmdUb2FzdCkge1xuICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChleGlzdGluZ1RvYXN0KTtcbiAgfVxuXG4gIC8vIOWIm+W7uuaWsOeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHJhZGFyLXBvYy10b2FzdCByYWRhci1wb2MtdG9hc3QtJHt0eXBlfWA7XG5cbiAgY29uc3QgdG9hc3RJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdElubmVyLmNsYXNzTmFtZSA9ICdyYWRhci1wb2MtdG9hc3QtaW5uZXInO1xuICB0b2FzdElubmVyLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblxuICB0b2FzdC5hcHBlbmRDaGlsZCh0b2FzdElubmVyKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcblxuICAvLyDorr7nva7lrprml7blmajlnKggMyDnp5LlkI7lhbPpl60gVG9hc3RcbiAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH0sIDMwMDApO1xuXG4gIC8vIOi/lOWbnuS4gOS4quWHveaVsOS7peS+v+aJi+WKqOWFs+mXrSBUb2FzdFxuICByZXR1cm4gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtR3JvdXBMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IGdyb3VwTGlua1BhdHRlcm4gPSAvXFxbZ3JvdXA6KC4rKTooXFxkKylcXF0vZztcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKGdyb3VwTGlua1BhdHRlcm4sIChtYXRjaCwgZ3JvdXBOYW1lLCBncm91cElkKSA9PiB7XG4gICAgcmV0dXJuIGBbJHtncm91cE5hbWV9XSgvbWVzc2FnZXMvJHtncm91cElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtUG9zdExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgcG9zdExpbmtQYXR0ZXJuID0gL1xcW3Bvc3Q6KFxcZCspXFxdL2c7XG4gIGxldCBpbmRleCA9IDE7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShwb3N0TGlua1BhdHRlcm4sIChtYXRjaCwgcG9zdElkKSA9PiB7XG4gICAgcmV0dXJuIGBbWyR7aW5kZXgrK31dXSgvbCR7d2luZG93LmxvY2F0aW9uLnBhdGhuYW1lfS8ke3Bvc3RJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuLy8g6buY6K6k546v5aKD6YWN572uXG5leHBvcnQgY29uc3QgZGVmYXVsdEVudkNvbmZpZzogRW52Q29uZmlnVHlwZSA9IHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBOdW1iZXIocHJvY2Vzcy5lbnYuU0NIRURVTEVEX0lOVEVSVkFMKSB8fCAxMjAsXG4gIEFOQUxZU0lTX1RZUEU6IHByb2Nlc3MuZW52LkFOQUxZU0lTX1RZUEUgfHwgXCJmaWx0ZXJcIixcbiAgTExNX1RZUEU6IHByb2Nlc3MuZW52LkxMTV9UWVBFIHx8IFwiZGlmeVwiLFxuICBBTkFMWVpFX0JZX0dST1VQOiBwcm9jZXNzLmVudi5BTkFMWVpFX0JZX0dST1VQID09PSBcInRydWVcIixcbiAgT0xMQU1BX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PTExBTUFfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjExNDM0XCIsXG4gIE9MTEFNQV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX01PREVMIHx8IFwiZGVlcHNlZWstcjFcIixcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1JFVklFV19NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1FVRVJZX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgRElGWV9BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9SRVZJRVdfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuRElGWV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9LRVk6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZIHx8IFwiXCIsXG4gIE9QRU5BSV9NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBHUk9RX0FQSV9LRVk6IHByb2Nlc3MuZW52LkdST1FfQVBJX0tFWSB8fCBcIlwiLFxuICBHUk9RX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX01PREVMIHx8IFwiXCIsXG4gIEdST1FfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBCT1RfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5CT1RfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9ib3RtYW4uaW50LnJjbGFiZW52LmNvbS92MlwiLFxuICBCT1RfVE9LRU46IHByb2Nlc3MuZW52LkJPVF9UT0tFTiB8fCBcIlwiLFxuICBCT1RfSUQ6IHByb2Nlc3MuZW52LkJPVF9JRCB8fCBcIjQ3MDAzNzIwMjBAMzc0Mzk1MTAuYm90LmdsaXAubmV0XCIsXG4gIEJPVF9UWVBFOiBwcm9jZXNzLmVudi5CT1RfVFlQRSB8fCBcInVzZXJcIixcbiAgVEVBTV9JRDogcHJvY2Vzcy5lbnYuVEVBTV9JRCB8fCBcIlwiLFxuICBFTkFCTEVfQk9UOiBwcm9jZXNzLmVudi5FTkFCTEVfQk9UID09PSBcInRydWVcIixcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogcHJvY2Vzcy5lbnYuTExNX1JFVklFV19CRUZPUkVfU0VORCA9PT0gXCJ0cnVlXCIsXG4gIEVOQUJMRV9DSFJPTUE6IHByb2Nlc3MuZW52LkVOQUJMRV9DSFJPTUEgPT09IFwidHJ1ZVwiLFxuICBDSFJPTUFfQVBJX1VSTDogcHJvY2Vzcy5lbnYuQ0hST01BX0FQSV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgQ0hST01BX1BPUlQ6IE51bWJlcihwcm9jZXNzLmVudi5DSFJPTUFfUE9SVCkgfHwgODAwMCxcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogcHJvY2Vzcy5lbnYuQ0hST01BX0NPTExFQ1RJT05fTkFNRSB8fCBcIlwiLFxuICBKSVJBX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5KSVJBX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9qaXJhLnJpbmdjZW50cmFsLmNvbVwiLFxuICBKSVJBX1VTRVJOQU1FOiBwcm9jZXNzLmVudi5KSVJBX1VTRVJOQU1FIHx8IFwiXCIsXG4gIEpJUkFfQVBJX1RPS0VOOiBwcm9jZXNzLmVudi5KSVJBX0FQSV9UT0tFTiB8fCBcIlwiLFxufTtcblxuLy8g6I635Y+W546v5aKD6YWN572u77yM5aaC5p6c5Y+v6IO955qE6K+d5LuOIHN0b3JhZ2Ug6I635Y+W77yM5ZCm5YiZ5LuOIHByb2Nlc3MuZW52IOiOt+WPllxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEVudkNvbmZpZygpOiBQcm9taXNlPEVudkNvbmZpZ1R5cGU+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGVudkNvbmZpZyB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFsnZW52Q29uZmlnJ10pO1xuICAgIGlmIChlbnZDb25maWcpIHtcbiAgICAgIC8vIOWwhuWtmOWCqOeahOmFjee9ruS4jum7mOiupOmFjee9ruWQiOW5tu+8jOehruS/neaWsOWinueahOmFjee9rumhueS5n+S8muiiq+WMheWQq1xuICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdEVudkNvbmZpZywgLi4uZW52Q29uZmlnIH07XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+iOt+WPlumFjee9ruWksei0pTonLCBlcnJvcik7XG4gIH1cbiAgXG4gIC8vIOWmguaenOiOt+WPluWksei0peaIluayoeacieS/neWtmOeahOmFjee9ru+8jOi/lOWbnum7mOiupOWAvFxuICByZXR1cm4gZGVmYXVsdEVudkNvbmZpZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJJbmZvKCkge1xuICBjb25zdCBhY2NvdW50VUQgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdnbG9iYWwuYWNjb3VudC5VRCcsICcnKTtcbiAgY29uc3QgYWNjb3VudEluZm9MaXN0ID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuQUNDT1VOVF9TRVNTSU9OX0RBVEFfTElTVCcsIHt9KTtcblxuICBjb25zdCBhY2NvdW50SW5mbyA9IGFjY291bnRVRCA/IGFjY291bnRJbmZvTGlzdFthY2NvdW50VURdIDogYWNjb3VudEluZm9MaXN0LmZpbmQoKGl0ZW06YW55KSA9PiBpdGVtLmRpc3BsYXlOYW1lICE9ICcnKTtcbiAgY29uc29sZS5sb2coJ2FjY291bnRJbmZvTGlzdCcsIGFjY291bnRJbmZvTGlzdCwgYWNjb3VudEluZm8pO1xuICBpZiAoYWNjb3VudEluZm8pIHJldHVybiB7XG4gICAgZXh0ZW5zaW9uSWQ6IGFjY291bnRJbmZvLmV4dGVuc2lvbklkLFxuICAgIGVtYWlsOiBhY2NvdW50SW5mby5lbWFpbCxcbiAgICBmdWxsTmFtZTogYWNjb3VudEluZm8uZGlzcGxheU5hbWUsXG4gICAgdXNlcm5hbWU6IGFjY291bnRJbmZvLmVtYWlsID8gYWNjb3VudEluZm8uZW1haWwudHJpbSgpLnNwbGl0KCdAJylbMF0gOiBhY2NvdW50SW5mby5kaXNwbGF5TmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gIH1cblxuICBjb25zdCB1c2VySW5mbyA9IGdldEN1cnJlbnRVc2VySW5mbygpO1xuICByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiB1c2VySW5mby5leHRlbnNpb25JZCxcbiAgICBmdWxsTmFtZTogdXNlckluZm8udXNlcm5hbWUsXG4gICAgdXNlcm5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSxcbiAgICBlbWFpbDogdXNlckluZm8udXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpICsgJ0ByaW5nY2VudHJhbC5jb20nXG4gIH07XG59XG5cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IHsgZmV0Y2hKaXJhVGlja2V0cyB9IGZyb20gJy4vamlyYSc7XG5pbXBvcnQgeyBTaGVldCB9IGZyb20gJy4vc2hlZXQnO1xuaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RW52Q29uZmlnIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIOWFqOWxgOWPmOmHj1xubGV0IHVybCA9IG51bGw7XG5sZXQgc2hlZXRUb2tlbiA9IG51bGw7XG5cbi8vIE1haW4gbGlzdGVuZXJcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBjb25zb2xlLmxvZygn5pS25Yiw5raI5oGvOicsIG1lc3NhZ2UsICflj5HpgIHogIU6Jywgc2VuZGVyKTtcblxuICAgIGlmICghbWVzc2FnZSB8fCAhbWVzc2FnZS50eXBlKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign5pS25Yiw5peg5pWI5raI5oGv5qC85byPJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IHR5cGUgfSA9IG1lc3NhZ2U7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09QRU5fSklSQV9RVUVSWV9ESUFMT0cnKSB7XG4gICAgICAgIG9wZW5KcWxEaWFsb2cobWVzc2FnZS51cmwsIG1lc3NhZ2Uuc2hlZXRUb2tlbik7XG4gICAgICAgIHVybCA9IG1lc3NhZ2UudXJsO1xuICAgICAgICBzaGVldFRva2VuID0gbWVzc2FnZS5zaGVldFRva2VuO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlOyAvLyDkuLrmiYDmnInmtojmga/kv53mjIHmtojmga/pgJrpgZPlvIDlkK9cbn0pO1xuXG4vLyDliJvlu7ogSlFMIOafpeivouWvueivneahhlxuYXN5bmMgZnVuY3Rpb24gb3BlbkpxbERpYWxvZyh1cmw6IHN0cmluZywgc2hlZXRUb2tlbjogc3RyaW5nKSB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgIGA7XG5cbiAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwO1wiPui+k+WFpSBKUUwg5p+l6K+iPC9oMz5cbiAgICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj48L3RleHRhcmVhPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcIj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxcIiBzdHlsZT1cIm1hcmdpbi1yaWdodDogMTBweDtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzdWJtaXRcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgYDtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgIC8vIOa3u+WKoOS6i+S7tuebkeWQrOWZqFxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWwnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJtaXQnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGpxbCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanFsJykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XG4gICAgICAgIGlmIChqcWwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGlja2V0cycsIHRpY2tldHMpO1xuICAgICAgICAgICAgICAgIGlmICghdGlja2V0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmsqHmnInmib7liLDmlbDmja4nLCAnZXJyb3InKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXNoZWV0VG9rZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5rKh5pyJ5p2D6ZmQ5o+S5YWl77yM55So5Ymq5YiH5p2/5qih5byP5omL5Yqo57KY6LS0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXR0ZWREYXRhID0gW2hlYWRlcnMuam9pbignXFx0JyksIC4uLnRpY2tldHMubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAga2V5OiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWBcbiAgICAgICAgICAgICAgICAgICAgICB9KSkubWFwKHRpY2tldCA9PiBoZWFkZXJzLm1hcChmaWVsZCA9PiB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0pLmpvaW4oJ1xcdCcpKV0uam9pbignXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkRGF0YScsIGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0ppcmEg5pWw5o2u5bey5aSN5Yi25Yiw5Ymq6LS05p2/Jyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g55So5o6l5Y+j5qih5byP6Ieq5Yqo5o+S5YWl5pWw5o2uXG4gICAgICAgICAgICAgICAgICAgIGlmICghdXJsIHx8ICFzaGVldFRva2VuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ+e8uuWwkeW/heimgeWPguaVsCcsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8g5bCd6K+V55u05o6l5Zyo5b2T5YmN5omT5byA55qER29vZ2xlIFNoZWV0c+S4reaPkuWFpeaVsOaNrlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGVldCA9IG5ldyBTaGVldCh1cmwsIHNoZWV0VG9rZW4pO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQuaW5pdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gYXdhaXQgc2hlZXQucmVhZFNoZWV0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndmFsdWVzJywgdmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoZWV0SGVhZGVycyA9IGF3YWl0IGZpbmRWYWxpZEppcmFIZWFkZXJzKHNoZWV0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlcnMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmib7liLAga2V5IOWIl+eahOe0ouW8lVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5Q29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnMua2V5ID8gZ2V0Q29sdW1uSW5kZXgoc2hlZXRIZWFkZXJzLmtleSkgOiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXlDb2x1bW5JbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ+acquaJvuWIsCBrZXkg5YiXJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWIm+W7uueOsOaciSBrZXkg5Yiw6KGM5Y+355qE5pig5bCEXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXlUb1Jvd01hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZXMuZm9yRWFjaCgocm93OiBzdHJpbmdbXSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleSA9IHJvd1trZXlDb2x1bW5JbmRleF0/LnJlcGxhY2UoLy4qXCIoW15cIl0rKVwiLiovLCAnJDEnKTsgLy8g5o+Q5Y+W6LaF6ZO+5o6l5Lit55qEIGtleVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5VG9Sb3dNYXAuc2V0KGtleSwgaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDliIbnprvpnIDopoHmm7TmlrDlkozpnIDopoHov73liqDnmoTmlbDmja5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZXNEYXRhOiBVcGRhdGVEYXRhW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFwcGVuZERhdGE6IHN0cmluZ1tdW10gPSBbXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5qC85byP5YyW5q+P5LiqIHRpY2tldCDnmoTmlbDmja5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldHMuZm9yRWFjaCh0aWNrZXQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlclZhbHVlcyA9IE9iamVjdC52YWx1ZXMoc2hlZXRIZWFkZXJzKS5maWx0ZXIoKHZhbHVlKTogdmFsdWUgaXMgc3RyaW5nID0+IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1heENvbEluZGV4ID0gZ2V0TWF4Q29sdW1uSW5kZXgoaGVhZGVyVmFsdWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBuZXcgQXJyYXkobWF4Q29sSW5kZXgpLmZpbGwoJycpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5aGr5YWF5pWw5o2uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVhZGVycy5mb3JFYWNoKGZpZWxkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sdW1uSW5kZXggPSBzaGVldEhlYWRlcnNbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2x1bW5JbmRleCAmJiB0eXBlb2YgY29sdW1uSW5kZXggPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbEluZGV4ID0gZ2V0Q29sdW1uSW5kZXgoY29sdW1uSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZCA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93W2NvbEluZGV4XSA9IGA9SFlQRVJMSU5LKFwiJHtlbnZDb25maWcuSklSQV9CQVNFX1VSTH0vYnJvd3NlLyR7dGlja2V0LmtleX1cIiwgXCIke3RpY2tldC5rZXl9XCIpYDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb3dbY29sSW5kZXhdID0gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign5aSE55CG5YiX57Si5byV5pe25Ye66ZSZOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5Yik5pat5piv5pu05paw6L+Y5piv6L+95YqgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdSb3dJbmRleCA9IGtleVRvUm93TWFwLmdldCh0aWNrZXQua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmdSb3dJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOabtOaWsOeOsOacieihjFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvd0luZGV4OiBleGlzdGluZ1Jvd0luZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogcm93XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOi/veWKoOaWsOihjFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBlbmREYXRhLnB1c2gocm93KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+abtOaWsOaVsOaNrjonLCB1cGRhdGVzRGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn6L+95Yqg5pWw5o2uOicsIGFwcGVuZERhdGEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmiafooYzmm7TmlrDmk43kvZxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh1cGRhdGVzRGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGUgb2YgdXBkYXRlc0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChbdXBkYXRlLmRhdGFdLCBgQSR7dXBkYXRlLnJvd0luZGV4ICsgMX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1RvYXN0KGDlt7Lmm7TmlrAgJHt1cGRhdGVzRGF0YS5sZW5ndGh9IOadoeeOsOacieaVsOaNrmApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDmiafooYzov73liqDmk43kvZxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcHBlbmREYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGFydFBvc2l0aW9uID0gYEEke3ZhbHVlcy5sZW5ndGggKyAxfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2hlZXQud3JpdGVTaGVldChhcHBlbmREYXRhLCBzdGFydFBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOW3sui/veWKoCAke2FwcGVuZERhdGEubGVuZ3RofSDmnaHmlrDmlbDmja5gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVwZGF0ZXNEYXRhLmxlbmd0aCA9PT0gMCAmJiBhcHBlbmREYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dUb2FzdCgn5rKh5pyJ6ZyA6KaB5pu05paw5oiW6L+95Yqg55qE5pWw5o2uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdHb29nbGUgU2hlZXRzIOaTjeS9nOWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0dvb2dsZSBTaGVldHMg5pON5L2c5aSx6LSlOiAnICsgZXJyb3IsICdlcnJvcicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign5p+l6K+i5aSx6LSlOiAnLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgYWxlcnQoJ+afpeivouWksei0pTogJyArIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5pbnRlcmZhY2UgSmlyYUhlYWRlcnMge1xuICAgIHN1bW1hcnk6IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgIGlzc3VlVHlwZTogc3RyaW5nO1xuICAgIHByaW9yaXR5OiBzdHJpbmc7XG4gICAgYXNzaWduZWU6IHN0cmluZztcbiAgICByZXBvcnRlcjogc3RyaW5nO1xuICAgIGxhYmVsczogc3RyaW5nO1xuICAgIGNvbXBvbmVudHM6IHN0cmluZztcbiAgICBmaXhWZXJzaW9uczogc3RyaW5nO1xuICAgIGFmZmVjdHNWZXJzaW9uczogc3RyaW5nO1xuICAgIGxpbmtlZElzc3Vlczogc3RyaW5nO1xuICAgIGVwaWNMaW5rOiBzdHJpbmc7XG4gICAgc3ByaW50OiBzdHJpbmc7XG4gICAgc3RvcnlQb2ludHM6IHN0cmluZztcbiAgICBjdXN0b21GaWVsZHM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH07XG59XG5cbmludGVyZmFjZSBVcGRhdGVEYXRhIHtcbiAgICByb3dJbmRleDogbnVtYmVyO1xuICAgIGRhdGE6IHN0cmluZ1tdO1xufVxuXG4vLyDmn6Xmib7mnInmlYjnmoRKaXJh5a2X5q616KGo5aS0XG5hc3luYyBmdW5jdGlvbiBmaW5kVmFsaWRKaXJhSGVhZGVycyhzaGVldDogU2hlZXQpOiBQcm9taXNlPEppcmFUaWNrZXQ+IHtcbiAgICB0cnkge1xuICAgICAgICBsZXQgaGVhZGVyTWFwcGluZzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOWwneivleivu+WPlumFjee9ruihqOaVsOaNrlxuICAgICAgICAgICAgY29uc3QgY29uZmlnRGF0YSA9IGF3YWl0IHNoZWV0LnJlYWRDb25maWdTaGVldCgpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2NvbmZpZ0RhdGEnLCBjb25maWdEYXRhKTtcbiAgICAgICAgICAgIGlmIChjb25maWdEYXRhICYmIGNvbmZpZ0RhdGEubGVuZ3RoID49IDIpIHtcbiAgICAgICAgICAgICAgICAvLyDliJvlu7rphY3nva7mmKDlsITlrZflhbhcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IGNvbmZpZ0RhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gY29uZmlnRGF0YVtpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJvdy5sZW5ndGggPj0gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJvd1sxXSA9PT0gJ0pJUkEga2V5Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlck1hcHBpbmdbcm93WzBdLnRvTG93ZXJDYXNlKCldID0gJ2tleSc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlYWRlck1hcHBpbmdbcm93WzBdLnRvTG93ZXJDYXNlKCldID0gcm93WzFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHRocm93IG5ldyBFcnJvcign6YWN572u6KGo5pWw5o2u5Li656m6Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+ivu+WPlumFjee9ruihqOWksei0pe+8jOWwhuS9v+eUqOm7mOiupOWtl+auteWIq+WQjTonLCBlcnJvcik7XG4gICAgICAgICAgICAvLyDkvb/nlKjpu5jorqTnmoTlrZfmrrXliKvlkI3mmKDlsIRcbiAgICAgICAgICAgIGhlYWRlck1hcHBpbmcgPSB7XG4gICAgICAgICAgICAgICAgJ2ppcmEnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBrZXknOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnamlyYSBsaW5rJzogJ2tleScsXG4gICAgICAgICAgICAgICAgJ2ppcmEgaWQnOiAna2V5JyxcbiAgICAgICAgICAgICAgICAnaW5pdCc6ICdrZXknLFxuICAgICAgICAgICAgICAgICd0aXRsZSc6ICdzdW1tYXJ5JyxcbiAgICAgICAgICAgICAgICAn5qaC6KaBJzogJ3N1bW1hcnknLFxuICAgICAgICAgICAgICAgICfmj4/ov7AnOiAnZGVzY3JpcHRpb24nLFxuICAgICAgICAgICAgICAgICd0eXBlJzogJ2lzc3VlVHlwZScsXG4gICAgICAgICAgICAgICAgJ+exu+Weiyc6ICdpc3N1ZVR5cGUnLFxuICAgICAgICAgICAgICAgICfkvJjlhYjnuqcnOiAncHJpb3JpdHknLFxuICAgICAgICAgICAgICAgICfnu4/lip7kuronOiAnYXNzaWduZWUnLFxuICAgICAgICAgICAgICAgICfmiqXlkYrkuronOiAncmVwb3J0ZXInLFxuICAgICAgICAgICAgICAgICdsYWJlbCc6ICdsYWJlbHMnLFxuICAgICAgICAgICAgICAgICfmoIfnrb4nOiAnbGFiZWxzJyxcbiAgICAgICAgICAgICAgICAnY29tcG9uZW50JzogJ2NvbXBvbmVudHMnLFxuICAgICAgICAgICAgICAgICfmqKHlnZcnOiAnY29tcG9uZW50cycsXG4gICAgICAgICAgICAgICAgJ2ZpeCB2ZXJzaW9ucyc6ICdmaXhWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ+S/ruWkjeeJiOacrCc6ICdmaXhWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2FmZmVjdHMgdmVyc2lvbnMnOiAnYWZmZWN0c1ZlcnNpb25zJyxcbiAgICAgICAgICAgICAgICAn5b2x5ZON54mI5pysJzogJ2FmZmVjdHNWZXJzaW9ucycsXG4gICAgICAgICAgICAgICAgJ2xpbmtlZCBpc3N1ZXMnOiAnbGlua2VkSXNzdWVzJyxcbiAgICAgICAgICAgICAgICAn5YWz6IGU6Zeu6aKYJzogJ2xpbmtlZElzc3VlcycsXG4gICAgICAgICAgICAgICAgJ2VwaWMgbGluayc6ICdlcGljTGluaycsXG4gICAgICAgICAgICAgICAgJ2VwaWMnOiAnZXBpY0xpbmsnLFxuICAgICAgICAgICAgICAgICflhrLliLonOiAnc3ByaW50JyxcbiAgICAgICAgICAgICAgICAnc3RvcnkgcG9pbnRzJzogJ3N0b3J5UG9pbnRzJyxcbiAgICAgICAgICAgICAgICAnc3RvcnkgcG9pbnQnOiAnc3RvcnlQb2ludHMnLFxuICAgICAgICAgICAgICAgICfmlYXkuovngrknOiAnc3RvcnlQb2ludHMnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g6I635Y+W5b2T5YmN5bel5L2c6KGo55qE5omA5pyJ5YiX5qCH6aKYXG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBhd2FpdCBzaGVldC5nZXRIZWFkZXJzKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdoZWFkZXJzJywgaGVhZGVycyk7XG4gICAgICAgIGNvbnN0IHZhbGlkSGVhZGVyczogSmlyYVRpY2tldCA9IHtcbiAgICAgICAgICAgIGtleTogJycsXG4gICAgICAgICAgICBzdW1tYXJ5OiAnJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnJyxcbiAgICAgICAgICAgIGlzc3VldHlwZTogJycsXG4gICAgICAgICAgICBwcmlvcml0eTogJycsXG4gICAgICAgICAgICBhc3NpZ25lZTogJycsXG4gICAgICAgICAgICByZXBvcnRlcjogJycsXG4gICAgICAgICAgICBsYWJlbHM6ICcnLFxuICAgICAgICAgICAgY29tcG9uZW50czogJycsXG4gICAgICAgICAgICBmaXhWZXJzaW9uczogJycsXG4gICAgICAgICAgICBhZmZlY3RzVmVyc2lvbnM6ICcnLFxuICAgICAgICAgICAgbGlua2VkSXNzdWVzOiAnJyxcbiAgICAgICAgICAgIGVwaWNMaW5rOiAnJyxcbiAgICAgICAgICAgIHNwcmludDogJycsXG4gICAgICAgICAgICBzdG9yeVBvaW50czogJycsXG4gICAgICAgICAgICBzdGF0dXM6ICcnLFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIOmBjeWOhuaJgOacieWIl+agh+mimO+8jOafpeaJvuWMuemFjeeahCBKaXJhIOWtl+autVxuICAgICAgICBoZWFkZXJzLmZvckVhY2goKGhlYWRlcjogc3RyaW5nLCBpbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBoZWFkZXJMb3dlciA9IGhlYWRlci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgY29uc3QgY29sdW1uTGV0dGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZSg2NSArIGluZGV4KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5qOA5p+l5piv5ZCm5Zyo6YWN572u5pig5bCE5Lit5a2Y5Zyo5Yy56YWNXG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtjb25maWdLZXksIGppcmFGaWVsZF0gb2YgT2JqZWN0LmVudHJpZXMoaGVhZGVyTWFwcGluZykpIHtcbiAgICAgICAgICAgICAgICBpZiAoaGVhZGVyTG93ZXIuaW5jbHVkZXMoY29uZmlnS2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5Yir5ZCN5Yy56YWNOiBcIiR7aGVhZGVyTG93ZXJ9XCIgLT4gXCIke2ppcmFGaWVsZH1cIiAo5YiXICR7Y29sdW1uTGV0dGVyfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgKHZhbGlkSGVhZGVycyBhcyBhbnkpW2ppcmFGaWVsZF0gPSBjb2x1bW5MZXR0ZXI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoT2JqZWN0LmtleXModmFsaWRIZWFkZXJzKS5pbmNsdWRlcyhoZWFkZXJMb3dlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOWtl+auteWMuemFjTogXCIke2hlYWRlckxvd2VyfVwiICjliJcgJHtjb2x1bW5MZXR0ZXJ9KWApO1xuICAgICAgICAgICAgICAgICAgICAodmFsaWRIZWFkZXJzIGFzIGFueSlbaGVhZGVyTG93ZXJdID0gY29sdW1uTGV0dGVyO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuebtOaOpeWMuemFjeWtl+auteWQjVxuICAgICAgICAgICAgZm9yIChjb25zdCBmaWVsZCBvZiBPYmplY3Qua2V5cyh2YWxpZEhlYWRlcnMpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhlYWRlckxvd2VyID09PSBmaWVsZC50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDnm7TmjqXljLnphY06IFwiJHtoZWFkZXJMb3dlcn1cIiAtPiBcIiR7ZmllbGR9XCIgKOWIlyAke2NvbHVtbkxldHRlcn0pYCk7XG4gICAgICAgICAgICAgICAgICAgICh2YWxpZEhlYWRlcnMgYXMgYW55KVtmaWVsZF0gPSBjb2x1bW5MZXR0ZXI7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+acgOe7iOWMuemFjee7k+aenDonLCB2YWxpZEhlYWRlcnMpO1xuICAgICAgICByZXR1cm4gdmFsaWRIZWFkZXJzO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+afpeaJvuacieaViCBKaXJhIOagh+mimOaXtuWHuumUmTonLCBlcnJvcik7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29sdW1uSW5kZXgoY29sdW1uOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIGlmICghY29sdW1uIHx8IHR5cGVvZiBjb2x1bW4gIT09ICdzdHJpbmcnIHx8IGNvbHVtbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCfml6DmlYjnmoTliJfmoIfor4YnKTtcbiAgICB9XG4gICAgY29uc3QgdXBwZXJDb2x1bW4gPSBjb2x1bW4udG9VcHBlckNhc2UoKTtcbiAgICByZXR1cm4gdXBwZXJDb2x1bW4uY2hhckNvZGVBdCgwKSAtIDY1O1xufVxuXG5mdW5jdGlvbiBnZXRNYXhDb2x1bW5JbmRleChoZWFkZXJzOiBzdHJpbmdbXSk6IG51bWJlciB7XG4gICAgaWYgKCFoZWFkZXJzIHx8ICFBcnJheS5pc0FycmF5KGhlYWRlcnMpIHx8IGhlYWRlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgICBjb25zdCB2YWxpZEhlYWRlcnMgPSBoZWFkZXJzLmZpbHRlcihoID0+IHR5cGVvZiBoID09PSAnc3RyaW5nJyAmJiBoLmxlbmd0aCA+IDApO1xuICAgIHJldHVybiBNYXRoLm1heCguLi52YWxpZEhlYWRlcnMubWFwKGNvbCA9PiBjb2wudG9VcHBlckNhc2UoKS5jaGFyQ29kZUF0KDApIC0gNjQpKTtcbn1cblxuLy8g5re75Yqg5pi+56S6IHRvYXN0IOeahOWHveaVsFxuZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2U6IHN0cmluZywgdHlwZSA9ICdpbmZvJykge1xuICAgIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdG9hc3QudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIHRvYXN0LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogJHt0eXBlID09PSAnZXJyb3InID8gJ3JnYmEoMjIwLCA1MywgNjksIDAuOSknIDogdHlwZSA9PT0gJ3N1Y2Nlc3MnID8gJ3JnYmEoNDAsIDE2NywgNjksIDAuOSknIDogJ3JnYmEoMCwgMCwgMCwgMC43KSd9O1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCA1cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gICAgYDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgIH0pO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgICAgICB9LCAzMDApO1xuICAgIH0sIDMwMDApO1xufVxuIl0sIm5hbWVzIjpbImdldEVudkNvbmZpZyIsIkRFRkFVTFRfSklSQV9GSUVMRFMiLCJmZXRjaEppcmFUaWNrZXRzIiwianFsIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJyZXF1ZXN0SWQiLCJNYXRoIiwicmFuZG9tIiwidG9TdHJpbmciLCJzdWJzdHJpbmciLCJtZXNzYWdlTGlzdGVuZXIiLCJtZXNzYWdlIiwidHlwZSIsImNocm9tZSIsInJ1bnRpbWUiLCJvbk1lc3NhZ2UiLCJyZW1vdmVMaXN0ZW5lciIsImVycm9yIiwiRXJyb3IiLCJ0aWNrZXRzIiwiYWRkTGlzdGVuZXIiLCJzZW5kTWVzc2FnZSIsIkZFVENIX0pJUkFfVElDS0VUUyIsInNvdXJjZVRhYklkIiwiZW52Q29uZmlnIiwidXJsIiwiSklSQV9CQVNFX1VSTCIsImVuY29kZVVSSUNvbXBvbmVudCIsInRhYnMiLCJjcmVhdGUiLCJhY3RpdmUiLCJ0YWIiLCJpZCIsImNoZWNrUGFnZUxvYWQiLCJnZXQiLCJ1cGRhdGVkVGFiIiwic3RhdHVzIiwic2NyaXB0aW5nIiwiZXhlY3V0ZVNjcmlwdCIsInRhcmdldCIsInRhYklkIiwiZnVuYyIsInJvd3MiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb3JFYWNoIiwicm93IiwidGlja2V0Iiwia2V5IiwicXVlcnlTZWxlY3RvciIsInRleHRDb250ZW50IiwidHJpbSIsInN1bW1hcnkiLCJhc3NpZ25lZSIsInJlcG9ydGVyIiwicHJpb3JpdHkiLCJjcmVhdGVkIiwidXBkYXRlZCIsImR1ZWRhdGUiLCJkZXNjcmlwdGlvbiIsInB1c2giLCJyZXN1bHRzIiwicmVzdWx0IiwibWFwIiwic3BsaXQiLCJzbGljZSIsInJlbW92ZSIsInNldFRpbWVvdXQiLCJTaGVldCIsImNvbnN0cnVjdG9yIiwidG9rZW4iLCJzaGVldElkIiwiZXh0cmFjdFNoZWV0SWQiLCJnaWQiLCJleHRyYWN0R2lkIiwiaW5pdCIsImdldFRva2VuIiwic2hlZXROYW1lIiwiZ2V0U2hlZXROYW1lQnlHaWQiLCJpZGVudGl0eSIsImdldEF1dGhUb2tlbiIsImludGVyYWN0aXZlIiwibGFzdEVycm9yIiwibWF0Y2giLCJnZXRTaGVldE5hbWVzIiwicmVzIiwiZmV0Y2giLCJoZWFkZXJzIiwiQXV0aG9yaXphdGlvbiIsImpzb24iLCJzaGVldHMiLCJzaGVldCIsImZpbmQiLCJzIiwicHJvcGVydGllcyIsInRpdGxlIiwicmVhZFNoZWV0Iiwic2hlZXRVcmwiLCJ2YWx1ZXMiLCJ3cml0ZVNoZWV0IiwicG9zaXRpb24iLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJtZXRob2QiLCJib2R5IiwiSlNPTiIsInN0cmluZ2lmeSIsInJlYWRDb25maWdTaGVldCIsImNvbmZpZ1NoZWV0TmFtZSIsImNvbnNvbGUiLCJnZXRIZWFkZXJzIiwiZ2V0U2hlZXROYW1lIiwiZ2V0SW5kZXhlZERCRGF0YSIsImRhdGFiYXNlTmFtZSIsInN0b3JlTmFtZSIsInJlcXVlc3QiLCJpbmRleGVkREIiLCJvcGVuIiwib25zdWNjZXNzIiwiZXZlbnQiLCJkYiIsInRyYW5zYWN0aW9uIiwib2JqZWN0U3RvcmUiLCJkYXRhUmVxdWVzdCIsImdldEFsbCIsIm9uZXJyb3IiLCJnZXRMb2NhbFN0b3JhZ2VJdGVtIiwiZGVmYXVsdFZhbHVlIiwicGFyc2UiLCJsb2NhbFN0b3JhZ2UiLCJnZXRJdGVtIiwic2V0TG9jYWxTdG9yYWdlSXRlbSIsInNldEl0ZW0iLCJnZXRDdXJyZW50VXNlckluZm8iLCJleHRlbnNpb24iLCJleHRlbnNpb25JZCIsInVzZXJuYW1lIiwiZ2V0Rm9sZGVycyIsInRoZW4iLCJfcmVmIiwiZGF0YSIsImZhdm9yaXRlX2dyb3VwX2lkcyIsImNvbnZlcnNhdGlvbl9zZXRzIiwiZm9sZGVycyIsImlkcyIsImZpbHRlciIsIml0ZW0iLCJjYXRjaCIsImxvZyIsImdldEdyb3Vwc01hcCIsImdyb3VwcyIsImdyb3Vwc01hcCIsInJlZHVjZSIsImFjYyIsImdyb3VwIiwibmFtZSIsInNldF9hYmJyZXZpYXRpb24iLCJpc190ZWFtIiwiZm9ybWF0RGF0ZSIsImRhdGVTdHJpbmciLCJkYXRlIiwiRGF0ZSIsInllYXIiLCJnZXRGdWxsWWVhciIsIm1vbnRoIiwiU3RyaW5nIiwiZ2V0TW9udGgiLCJwYWRTdGFydCIsImRheSIsImdldERhdGUiLCJob3VycyIsImdldEhvdXJzIiwibWludXRlcyIsImdldE1pbnV0ZXMiLCJzZWNvbmRzIiwiZ2V0U2Vjb25kcyIsInVuaXFCeSIsImFycmF5Iiwic2VlbiIsIlNldCIsImtleVZhbHVlIiwiaGFzIiwiYWRkIiwic2hvd1RvYXN0Iiwib25DbG9zZSIsImNvbnRhaW5lciIsImdldEVsZW1lbnRCeUlkIiwiZXhpc3RpbmdUb2FzdCIsInJlbW92ZUNoaWxkIiwidG9hc3QiLCJjcmVhdGVFbGVtZW50IiwiY2xhc3NOYW1lIiwidG9hc3RJbm5lciIsImFwcGVuZENoaWxkIiwidGltZXIiLCJjb250YWlucyIsImNsZWFyVGltZW91dCIsInRyYW5zZm9ybUdyb3VwTGlua3MiLCJpbnB1dFN0cmluZyIsImdyb3VwTGlua1BhdHRlcm4iLCJ0cmFuc2Zvcm1lZFN0cmluZyIsInJlcGxhY2UiLCJncm91cE5hbWUiLCJncm91cElkIiwidHJhbnNmb3JtUG9zdExpbmtzIiwicG9zdExpbmtQYXR0ZXJuIiwiaW5kZXgiLCJwb3N0SWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwiZGVmYXVsdEVudkNvbmZpZyIsIlNDSEVEVUxFRF9JTlRFUlZBTCIsIk51bWJlciIsInByb2Nlc3MiLCJlbnYiLCJBTkFMWVNJU19UWVBFIiwiTExNX1RZUEUiLCJBTkFMWVpFX0JZX0dST1VQIiwiT0xMQU1BX0JBU0VfVVJMIiwiT0xMQU1BX01PREVMIiwiT0xMQU1BX1JFVklFV19NT0RFTCIsIk9MTEFNQV9RVUVSWV9NT0RFTCIsIkRJRllfQVBJX0tFWSIsIkRJRllfUkVWSUVXX0FQSV9LRVkiLCJESUZZX0FQSV9CQVNFX1VSTCIsIk9QRU5BSV9BUElfS0VZIiwiT1BFTkFJX01PREVMIiwiT1BFTkFJX1JFVklFV19NT0RFTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJHUk9RX0FQSV9LRVkiLCJHUk9RX01PREVMIiwiR1JPUV9SRVZJRVdfTU9ERUwiLCJCT1RfQVBJX0JBU0VfVVJMIiwiQk9UX1RPS0VOIiwiQk9UX0lEIiwiQk9UX1RZUEUiLCJURUFNX0lEIiwiRU5BQkxFX0JPVCIsIkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQiLCJFTkFCTEVfQ0hST01BIiwiQ0hST01BX0FQSV9VUkwiLCJDSFJPTUFfUE9SVCIsIkNIUk9NQV9DT0xMRUNUSU9OX05BTUUiLCJKSVJBX1VTRVJOQU1FIiwiSklSQV9BUElfVE9LRU4iLCJzdG9yYWdlIiwibG9jYWwiLCJnZXRVc2VySW5mbyIsImFjY291bnRVRCIsImFjY291bnRJbmZvTGlzdCIsImFjY291bnRJbmZvIiwiZGlzcGxheU5hbWUiLCJlbWFpbCIsImZ1bGxOYW1lIiwiam9pbiIsInRvTG93ZXJDYXNlIiwidXNlckluZm8iLCJzaGVldFRva2VuIiwic2VuZGVyIiwic2VuZFJlc3BvbnNlIiwid2FybiIsIm9wZW5KcWxEaWFsb2ciLCJkaWFsb2ciLCJzdHlsZSIsImNzc1RleHQiLCJpbm5lckhUTUwiLCJhZGRFdmVudExpc3RlbmVyIiwidmFsdWUiLCJmb3JtYXR0ZWREYXRhIiwiZmllbGQiLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cml0ZVRleHQiLCJzaGVldEhlYWRlcnMiLCJmaW5kVmFsaWRKaXJhSGVhZGVycyIsImtleUNvbHVtbkluZGV4IiwiZ2V0Q29sdW1uSW5kZXgiLCJrZXlUb1Jvd01hcCIsIk1hcCIsInNldCIsInVwZGF0ZXNEYXRhIiwiYXBwZW5kRGF0YSIsImhlYWRlclZhbHVlcyIsIk9iamVjdCIsIm1heENvbEluZGV4IiwiZ2V0TWF4Q29sdW1uSW5kZXgiLCJBcnJheSIsImZpbGwiLCJjb2x1bW5JbmRleCIsImNvbEluZGV4IiwiZXhpc3RpbmdSb3dJbmRleCIsInJvd0luZGV4IiwidXBkYXRlIiwic3RhcnRQb3NpdGlvbiIsImFsZXJ0IiwiaGVhZGVyTWFwcGluZyIsImNvbmZpZ0RhdGEiLCJpIiwidmFsaWRIZWFkZXJzIiwiaXNzdWV0eXBlIiwibGFiZWxzIiwiY29tcG9uZW50cyIsImZpeFZlcnNpb25zIiwiYWZmZWN0c1ZlcnNpb25zIiwibGlua2VkSXNzdWVzIiwiZXBpY0xpbmsiLCJzcHJpbnQiLCJzdG9yeVBvaW50cyIsImhlYWRlciIsImhlYWRlckxvd2VyIiwiY29sdW1uTGV0dGVyIiwiZnJvbUNoYXJDb2RlIiwiY29uZmlnS2V5IiwiamlyYUZpZWxkIiwiZW50cmllcyIsImluY2x1ZGVzIiwia2V5cyIsImNvbHVtbiIsInVwcGVyQ29sdW1uIiwidG9VcHBlckNhc2UiLCJjaGFyQ29kZUF0IiwiaXNBcnJheSIsImgiLCJtYXgiLCJjb2wiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJvcGFjaXR5Il0sInNvdXJjZVJvb3QiOiIifQ==