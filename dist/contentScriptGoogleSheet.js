/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/googleSheets.ts":
/*!*****************************!*\
  !*** ./src/googleSheets.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   FETCH_JIRA_TICKETS: () => (/* binding */ FETCH_JIRA_TICKETS),
/* harmony export */   fetchJiraTickets: () => (/* binding */ fetchJiraTickets),
/* harmony export */   getFieldMapping: () => (/* binding */ getFieldMapping),
/* harmony export */   getSheetHeaders: () => (/* binding */ getSheetHeaders),
/* harmony export */   writeTicketsToSheet: () => (/* binding */ writeTicketsToSheet)
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

// 从 Google Sheets 获取数据
async function getFieldMapping(sheetName) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'GET_SHEET_CONFIG',
      sheetName: sheetName
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('获取配置失败:', chrome.runtime.lastError);
        resolve(DEFAULT_JIRA_FIELDS);
        return;
      }
      resolve(response?.mapping || DEFAULT_JIRA_FIELDS);
    });
  });
}

// 获取当前工作表的表头
async function getSheetHeaders() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'GET_SHEET_HEADERS'
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('获取表头失败:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response?.headers || []);
    });
  });
}

// 从 Jira 页面抓取数据
async function fetchJiraTickets(jql) {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(7);

    // 监听来自 background script 的消息
    const messageListener = message => {
      console.log('message111', message);
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

// 将 Jira tickets 写入 Google Sheet
async function writeTicketsToSheet(tickets) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'WRITE_TICKETS',
      tickets: tickets
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('写入数据失败:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
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
/* harmony import */ var _googleSheets__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./googleSheets */ "./src/googleSheets.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ "./src/utils.ts");



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
    openJqlDialog();
  }
  return true; // 为所有消息保持消息通道开启
});

// 初始化
function initialize() {
  // 检查是否在Google Sheets环境中
  if (window.location.href.includes('docs.google.com/spreadsheets')) {
    // 检查是否启用了Sheets集成功能
    chrome.storage.local.get(['enableSheetsIntegration'], result => {
      const enableSheetsIntegration = result.enableSheetsIntegration !== false; // 默认启用

      if (enableSheetsIntegration) {
        // 添加浮动工具栏
        addFloatingToolbar();
        console.log('已加载Google Sheets集成工具');
      } else {
        console.log('Google Sheets集成功能已禁用');
      }
    });
  }
}

// 添加浮动工具栏到Google Sheets
function addFloatingToolbar() {
  const toolbar = document.createElement('div');
  toolbar.id = 'jira-sheets-toolbar';
  toolbar.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        padding: 10px;
    `;
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #666;
    `;
  closeButton.addEventListener('click', () => {
    document.body.removeChild(toolbar);
  });
  const titleLabel = document.createElement('div');
  titleLabel.textContent = 'Jira-Sheets 工具';
  titleLabel.style.cssText = `
        font-weight: bold;
        margin-bottom: 10px;
        text-align: center;
    `;
  const queryButton = document.createElement('button');
  queryButton.textContent = '查询 Jira 数据';
  queryButton.style.cssText = `
        margin-bottom: 8px;
        padding: 8px 15px;
        border: none;
        background: #0073e6;
        color: white;
        border-radius: 4px;
        cursor: pointer;
    `;
  queryButton.addEventListener('click', () => {
    openJqlDialog();
  });
  const readButton = document.createElement('button');
  readButton.textContent = '读取表格数据';
  readButton.style.cssText = `
        margin-bottom: 8px;
        padding: 8px 15px;
        border: none;
        background: #28a745;
        color: white;
        border-radius: 4px;
        cursor: pointer;
    `;
  readButton.addEventListener('click', async () => {
    try {
      const data = await readSheetData();
      if (data && data.length > 0) {
        console.log('读取到的表格数据:', data);
        showToast(`成功读取表格数据，共 ${data.length} 行`, 'success');

        // 保存到本地存储供后续使用
        chrome.storage.local.set({
          sheetData: JSON.stringify(data)
        }, () => {
          console.log('表格数据已保存到本地存储');
        });
      } else {
        showToast('未能读取到表格数据', 'error');
      }
    } catch (error) {
      console.error('读取表格数据失败:', error);
      showToast('读取表格数据时出错', 'error');
    }
  });
  const analyzeButton = document.createElement('button');
  analyzeButton.textContent = '分析表格数据';
  analyzeButton.style.cssText = `
        margin-bottom: 8px;
        padding: 8px 15px;
        border: none;
        background: #6c757d;
        color: white;
        border-radius: 4px;
        cursor: pointer;
    `;
  analyzeButton.addEventListener('click', async () => {
    try {
      const data = await readSheetData();
      if (data && data.length > 0) {
        showDataAnalysisDialog(data);
      } else {
        showToast('没有可分析的数据', 'error');
      }
    } catch (error) {
      console.error('分析数据失败:', error);
      showToast('分析数据时出错', 'error');
    }
  });

  // 添加调试按钮
  const debugButton = document.createElement('button');
  debugButton.textContent = '调试DOM元素';
  debugButton.style.cssText = `
        margin-bottom: 8px;
        padding: 8px 15px;
        border: none;
        background: #dc3545;
        color: white;
        border-radius: 4px;
        cursor: pointer;
    `;
  debugButton.addEventListener('click', () => {
    debugGoogleSheetsDOM();
  });

  // 添加简单读取按钮
  const simpleScanButton = document.createElement('button');
  simpleScanButton.textContent = '扫描可见单元格';
  simpleScanButton.style.cssText = `
        margin-bottom: 8px;
        padding: 8px 15px;
        border: none;
        background: #fd7e14;
        color: white;
        border-radius: 4px;
        cursor: pointer;
    `;
  simpleScanButton.addEventListener('click', () => {
    scanVisibleCells();
  });
  toolbar.appendChild(closeButton);
  toolbar.appendChild(titleLabel);
  toolbar.appendChild(queryButton);
  toolbar.appendChild(readButton);
  toolbar.appendChild(analyzeButton);
  toolbar.appendChild(debugButton);
  toolbar.appendChild(simpleScanButton);
  document.body.appendChild(toolbar);
}

// 调试Google Sheets DOM结构
function debugGoogleSheetsDOM() {
  try {
    console.log('开始调试Google Sheets DOM结构...');

    // 查找所有可能与表格相关的元素
    const elements = {
      tables: document.querySelectorAll('table'),
      grids: document.querySelectorAll('[role="grid"]'),
      cells: document.querySelectorAll('[role="gridcell"]'),
      cellContents: document.querySelectorAll('.cell-content, .waffle-cell-content'),
      rows: document.querySelectorAll('[role="row"]'),
      headers: document.querySelectorAll('[role="columnheader"], [role="rowheader"]'),
      spreadsheetContainer: document.querySelector('#sheets-viewport')
    };
    console.log('Google Sheets DOM结构:', elements);

    // 查找Google Sheets的内部对象
    const sheetsApp = window.SHEETS_APP || window.google?.sheets?.app || window.SheetsApp;
    console.log('Google Sheets应用对象:', sheetsApp);

    // 显示调试信息
    showToast('DOM调试信息已输出到控制台', 'info');

    // 创建DOM调试对话框
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
            width: 80%;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
        `;

    // 头部和关闭按钮
    const header = document.createElement('div');
    header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        `;
    const title = document.createElement('h3');
    title.textContent = 'Google Sheets DOM调试';
    title.style.margin = '0';
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
        `;
    closeButton.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    header.appendChild(title);
    header.appendChild(closeButton);
    dialog.appendChild(header);

    // 调试信息内容
    const content = document.createElement('div');
    content.innerHTML = `
            <h4>DOM元素统计</h4>
            <ul>
                <li>表格元素(table): ${elements.tables.length}</li>
                <li>网格元素(role="grid"): ${elements.grids.length}</li>
                <li>单元格元素(role="gridcell"): ${elements.cells.length}</li>
                <li>单元格内容元素(.cell-content): ${elements.cellContents.length}</li>
                <li>行元素(role="row"): ${elements.rows.length}</li>
                <li>表头元素: ${elements.headers.length}</li>
            </ul>
            
            <h4>建议</h4>
            <p>请在控制台中查看完整的调试信息。如果表格不能正常读取，您可以:</p>
            <ol>
                <li>尝试点击"扫描可见单元格"按钮</li>
                <li>确保已选中至少一个单元格</li>
                <li>确保表格已完全加载</li>
            </ol>
        `;
    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // 高亮显示表格区域
    const highlightElement = (selector, color) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const originalBackground = el.style.backgroundColor;
        const originalOutline = el.style.outline;
        el.style.backgroundColor = color;
        el.style.outline = `2px solid ${color}`;
        setTimeout(() => {
          el.style.backgroundColor = originalBackground;
          el.style.outline = originalOutline;
        }, 3000);
      });
    };

    // 高亮不同的元素类型
    highlightElement('table', 'rgba(255, 0, 0, 0.2)');
    highlightElement('[role="grid"]', 'rgba(0, 255, 0, 0.2)');
    highlightElement('.cell-content, .waffle-cell-content', 'rgba(0, 0, 255, 0.2)');
  } catch (error) {
    console.error('调试DOM结构失败:', error);
    showToast('调试过程出错', 'error');
  }
}

// 扫描可见单元格
function scanVisibleCells() {
  try {
    console.log('开始扫描可见单元格...');

    // 1. 获取视口尺寸
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    console.log(`视口尺寸: ${viewportWidth}x${viewportHeight}`);

    // 2. 创建一个覆盖层来显示扫描进度
    const overlay = document.createElement('div');
    overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 20px;
        `;
    overlay.innerHTML = `<div>扫描单元格中... <span id="scan-progress">0%</span></div>`;
    document.body.appendChild(overlay);

    // 3. 获取表格容器
    const sheetsContainer = document.querySelector('#sheets-viewport') || document.querySelector('[role="grid"]') || document.body;

    // 4. 创建结果存储器
    const cellsData = [];

    // 5. 执行扫描
    setTimeout(() => {
      // 使用深度优先搜索遍历DOM
      const walkDOM = function (element) {
        let depth = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
        // 检查是否可能是单元格
        const maybeCell = isCellElement(element);

        // 获取元素在页面上的位置
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < viewportWidth && rect.bottom > 0 && rect.top < viewportHeight;

        // 如果是可见的单元格元素，记录其信息
        if (maybeCell && isVisible) {
          const text = element.textContent || '';
          if (text.trim()) {
            // 只记录非空单元格
            cellsData.push({
              text: text,
              x: rect.left,
              y: rect.top,
              element: element
            });
          }
        }

        // 递归处理子元素
        if (depth < 10) {
          // 限制递归深度
          Array.from(element.children).forEach(child => {
            walkDOM(child, depth + 1);
          });
        }
      };

      // 检查元素是否可能是单元格
      const isCellElement = element => {
        // 检查常见的单元格特征
        if (element.getAttribute('role') === 'gridcell') return true;
        if (element.classList.contains('cell-content')) return true;
        if (element.classList.contains('waffle-cell-content')) return true;

        // 检查元素样式特征
        const style = window.getComputedStyle(element);
        if (style.display === 'table-cell') return true;

        // 检查元素尺寸是否像单元格
        const rect = element.getBoundingClientRect();
        if (rect.width > 20 && rect.width < 300 && rect.height > 15 && rect.height < 100) {
          // 检查是否有文本内容和边框
          if ((element.textContent || '').trim() && (style.border || style.borderBottom || style.borderRight)) {
            return true;
          }
        }
        return false;
      };

      // 执行扫描
      walkDOM(sheetsContainer);
      console.log(`扫描完成，找到 ${cellsData.length} 个可能的单元格`);

      // 6. 处理扫描结果
      if (cellsData.length > 0) {
        // 按垂直位置排序，猜测行
        cellsData.sort((a, b) => a.y - b.y);

        // 尝试识别行
        const rowThreshold = 10; // 同一行的单元格垂直位置差异应小于这个值
        const rows = [];
        let currentRow = [];
        let lastY = cellsData[0].y;
        cellsData.forEach(cell => {
          if (Math.abs(cell.y - lastY) > rowThreshold) {
            // 开始新的一行
            if (currentRow.length > 0) {
              rows.push(currentRow);
              currentRow = [];
            }
            lastY = cell.y;
          }
          currentRow.push(cell);
        });

        // 添加最后一行
        if (currentRow.length > 0) {
          rows.push(currentRow);
        }

        // 按水平位置排序每一行
        rows.forEach(row => {
          row.sort((a, b) => a.x - b.x);
        });
        console.log(`识别出 ${rows.length} 行数据`);

        // 转换为二维数组格式
        const data = rows.map(row => row.map(cell => cell.text));
        console.log('最终数据:', data);

        // 保存并显示结果
        chrome.storage.local.set({
          sheetData: JSON.stringify(data)
        }, () => {
          document.body.removeChild(overlay);
          showToast(`成功读取表格数据，共 ${data.length} 行`, 'success');

          // 显示一个简单的预览
          showTablePreview(data);
        });
      } else {
        document.body.removeChild(overlay);
        showToast('未能识别任何单元格数据', 'error');
      }
    }, 100);
  } catch (error) {
    console.error('扫描单元格失败:', error);

    // 确保移除覆盖层
    const overlay = document.querySelector('div[style*="position: fixed"][style*="z-index: 10000"]');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    showToast('扫描过程出错', 'error');
  }
}

// 显示表格预览
function showTablePreview(data) {
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
        width: 80%;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
    `;

  // 标题和关闭按钮
  const header = document.createElement('div');
  header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    `;
  const title = document.createElement('h3');
  title.textContent = '表格数据预览';
  title.style.margin = '0';
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
    `;
  closeButton.addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
  header.appendChild(title);
  header.appendChild(closeButton);
  dialog.appendChild(header);

  // 创建表格预览
  const table = document.createElement('table');
  table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
    `;

  // 添加表头（如果有）
  if (data.length > 0) {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    data[0].forEach(cell => {
      const th = document.createElement('th');
      th.textContent = cell;
      th.style.cssText = `
                padding: 8px;
                background: #f2f2f2;
                border: 1px solid #ddd;
                text-align: left;
            `;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
  }

  // 添加表格内容
  const tbody = document.createElement('tbody');

  // 如果有表头，从第二行开始添加数据
  for (let i = 1; i < data.length; i++) {
    const row = document.createElement('tr');
    data[i].forEach(cell => {
      const td = document.createElement('td');
      td.textContent = cell;
      td.style.cssText = `
                padding: 8px;
                border: 1px solid #ddd;
            `;
      row.appendChild(td);
    });
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  dialog.appendChild(table);

  // 添加按钮
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
        margin-top: 15px;
        text-align: right;
    `;
  const analyzeButton = document.createElement('button');
  analyzeButton.textContent = '分析数据';
  analyzeButton.style.cssText = `
        padding: 8px 15px;
        background: #0073e6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
  analyzeButton.addEventListener('click', () => {
    document.body.removeChild(dialog);
    showDataAnalysisDialog(data);
  });
  buttonContainer.appendChild(analyzeButton);
  dialog.appendChild(buttonContainer);
  document.body.appendChild(dialog);
}

// 当文档加载完成时初始化
if (document.readyState === 'complete') {
  initialize();
} else {
  window.addEventListener('load', initialize);
}

// 创建 JQL 查询对话框
async function openJqlDialog() {
  const envConfig = await (0,_utils__WEBPACK_IMPORTED_MODULE_1__.getEnvConfig)();
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
        const tickets = await (0,_googleSheets__WEBPACK_IMPORTED_MODULE_0__.fetchJiraTickets)(jql);
        console.log('tickets', tickets);
        if (tickets.length > 0) {
          const fields = ['key', 'summary', 'status', 'assignee', 'reporter'];
          const headers = fields.join('\t');
          const formattedData = [headers, ...tickets.map(ticket => ({
            ...ticket,
            key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
          })).map(ticket => fields.map(field => ticket[field]).join('\t'))].join('\n');
          await navigator.clipboard.writeText(formattedData);
          console.log('formattedData', formattedData);
          showToast('Jira 数据已复制到剪贴板');
        }
        document.body.removeChild(dialog);

        // 尝试直接在当前打开的Google Sheets中插入数据
        insertTicketsToActiveSheet(tickets, envConfig);
      } catch (error) {
        alert('查询失败: ' + error);
      }
    }
  });
}

// 直接在当前打开的Google Sheets中插入数据
async function insertTicketsToActiveSheet(tickets, envConfig) {
  try {
    if (!tickets || tickets.length === 0) {
      console.warn('没有数据可插入');
      return;
    }
    console.log('准备向Google Sheets中插入数据...');

    // 获取活动单元格
    const activeCell = document.querySelector('[aria-selected="true"]');
    if (!activeCell) {
      // 如果没有选择的单元格，引导用户选择一个单元格
      showGuideDialog(tickets, envConfig);
      return;
    }

    // 尝试使用Google Sheets DOM API直接插入数据
    if (await insertDataViaSheetsDomApi(tickets, envConfig)) {
      showToast('数据已成功插入表格', 'success');
      return;
    }

    // 如果直接插入失败，回退到剪贴板方法
    // 显式触发复制选中的表头（如果有）
    await copySelectedHeaders();

    // 检查是否存在表头
    const existingHeaders = await getExistingHeaders();
    console.log('获取到的表头:', existingHeaders);
    let fields = ['key', 'summary', 'status', 'assignee', 'reporter'];
    let useExistingHeaders = false;
    if (existingHeaders && existingHeaders.length > 0) {
      console.log('检测到现有表头:', existingHeaders);

      // 增强表头匹配逻辑
      const validHeaders = findValidJiraHeaders(existingHeaders, tickets[0]);
      if (validHeaders.length > 0) {
        fields = validHeaders;
        useExistingHeaders = true;
        console.log('使用现有表头:', fields);
      } else {
        console.warn('找不到有效的Jira字段匹配，将使用默认字段');
      }
    }

    // 模拟粘贴操作 - 首先将格式化的数据保存到剪贴板
    let formattedData;
    if (useExistingHeaders) {
      // 仅使用数据，不包含表头
      formattedData = tickets.map(ticket => ({
        ...ticket,
        key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
      })).map(ticket => fields.map(header => {
        // 尝试不同的字段名称格式（原始格式、小写、无空格）
        const fieldName = header.toLowerCase().trim();
        const value = ticket[fieldName] || ticket[fieldName.replace(/\s+/g, '')] || '';
        console.log(`映射字段 ${header} -> ${fieldName}, 值:`, value);
        return value;
      }).join('\t')).join('\n');
    } else {
      // 包含表头和数据
      const headers = fields.join('\t');
      formattedData = [headers, ...tickets.map(ticket => ({
        ...ticket,
        key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
      })).map(ticket => fields.map(field => ticket[field]).join('\t'))].join('\n');
    }
    console.log('格式化数据样例:', formattedData.split('\n')[0]);

    // 将数据复制到剪贴板
    await copyToClipboard(formattedData);

    // 模拟粘贴操作
    if (!attemptAutoPaste(activeCell)) {
      // 如果自动粘贴失败，提示用户手动粘贴
      showPasteInstructions();
    }
  } catch (error) {
    console.error('插入数据到表格失败:', error);
    showToast('插入数据失败，请检查控制台错误', 'error');
  }
}

// 尝试使用Google Sheets DOM API直接插入数据
async function insertDataViaSheetsDomApi(tickets, envConfig) {
  try {
    console.log('尝试使用Google Sheets DOM API插入数据...');

    // 检查是否在Google Sheets环境中
    if (!window.location.href.includes('docs.google.com/spreadsheets')) {
      console.warn('非Google Sheets环境，无法使用DOM API');
      return false;
    }

    // 获取活动单元格位置
    const activeCell = document.querySelector('[aria-selected="true"]');
    if (!activeCell) {
      console.warn('未找到活动单元格');
      return false;
    }

    // 尝试获取单元格坐标
    const cellCoordinates = getCellCoordinates(activeCell);
    if (!cellCoordinates) {
      console.warn('无法获取单元格坐标');
      return false;
    }
    console.log('当前活动单元格坐标:', cellCoordinates);

    // 获取表头
    const headers = await getExistingHeaders();
    const fields = headers && headers.length > 0 ? findValidJiraHeaders(headers, tickets[0]) : ['key', 'summary', 'status', 'assignee', 'reporter'];
    console.log('将使用以下字段:', fields);

    // 访问Google Sheets应用实例
    // 注意：这是一种试探性方法，依赖于Google Sheets的内部API
    const sheetsApp = getSheetsAppInstance();
    if (!sheetsApp) {
      console.warn('无法访问Google Sheets应用实例');
      return false;
    }

    // 尝试插入数据
    if (typeof sheetsApp.insertData === 'function') {
      const formattedData = tickets.map(ticket => fields.map(field => {
        if (field === 'key') {
          return `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`;
        }
        return ticket[field] || '';
      }));
      sheetsApp.insertData(cellCoordinates.row, cellCoordinates.col, formattedData);
      console.log('通过Sheets应用实例成功插入数据');
      return true;
    }

    // 如果无法直接插入，尝试触发本机事件
    if (injectDataViaNativeEvents(activeCell, tickets, fields, envConfig)) {
      console.log('通过本机事件成功插入数据');
      return true;
    }
    console.warn('无法使用Google Sheets DOM API插入数据');
    return false;
  } catch (error) {
    console.error('使用Google Sheets DOM API插入数据失败:', error);
    return false;
  }
}

// 获取单元格坐标
function getCellCoordinates(cell) {
  try {
    // 尝试从单元格属性或数据属性中获取坐标
    const rowAttr = cell.getAttribute('data-row-index') || cell.getAttribute('row-index');
    const colAttr = cell.getAttribute('data-col-index') || cell.getAttribute('col-index');
    if (rowAttr && colAttr) {
      return {
        row: parseInt(rowAttr, 10),
        col: parseInt(colAttr, 10)
      };
    }

    // 尝试从样式中解析坐标
    const style = cell.getAttribute('style');
    if (style) {
      const rowMatch = style.match(/top:\s*(\d+)px/);
      const colMatch = style.match(/left:\s*(\d+)px/);
      if (rowMatch && colMatch) {
        // 这里需要根据实际的单元格大小进行调整
        const rowHeight = 21; // 默认行高
        const colWidth = 120; // 默认列宽

        return {
          row: Math.floor(parseInt(rowMatch[1], 10) / rowHeight),
          col: Math.floor(parseInt(colMatch[1], 10) / colWidth)
        };
      }
    }

    // 尝试从父元素或关联元素获取坐标
    const parent = cell.closest('[data-row-index], [data-col-index]');
    if (parent) {
      const rowAttr = parent.getAttribute('data-row-index');
      const colAttr = parent.getAttribute('data-col-index');
      if (rowAttr && colAttr) {
        return {
          row: parseInt(rowAttr, 10),
          col: parseInt(colAttr, 10)
        };
      }
    }
    return null;
  } catch (error) {
    console.error('获取单元格坐标失败:', error);
    return null;
  }
}

// 获取Google Sheets应用实例
function getSheetsAppInstance() {
  try {
    // 尝试通过全局变量访问Sheets应用实例
    // 注意：这是基于Google Sheets内部实现的试探性方法
    return window.SHEETS_APP || window.google?.sheets?.app || window.SheetsApp || null;
  } catch (error) {
    console.error('获取Sheets应用实例失败:', error);
    return null;
  }
}

// 通过本机事件注入数据
function injectDataViaNativeEvents(activeCell, tickets, fields, envConfig) {
  try {
    // 创建数据输入事件
    // 这是一种试探性方法，模拟用户在单元格中输入数据
    const startEdit = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    activeCell.dispatchEvent(startEdit);

    // 检查是否进入编辑模式
    const editBox = document.querySelector('.cell-input, .waffle-formula-input');
    if (!editBox) {
      console.warn('无法进入单元格编辑模式');
      return false;
    }

    // 提交第一个数据作为测试
    const testData = tickets[0][fields[0]] || '';
    editBox.value = testData;

    // 触发输入事件
    editBox.dispatchEvent(new Event('input', {
      bubbles: true,
      cancelable: true
    }));

    // 触发回车键提交
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    editBox.dispatchEvent(enterEvent);

    // 这里理论上应该继续为其他单元格注入数据
    // 但由于复杂性和可靠性问题，这里返回false让函数回退到剪贴板方法
    console.log('单元格编辑测试成功，但完整数据注入需要更复杂的实现');
    return false;
  } catch (error) {
    console.error('通过本机事件注入数据失败:', error);
    return false;
  }
}

// 读取当前Google Sheet中的数据
async function readSheetData() {
  try {
    console.log('尝试读取当前Google Sheet数据...');

    // 检查是否在Google Sheets环境中
    if (!window.location.href.includes('docs.google.com/spreadsheets')) {
      console.warn('非Google Sheets环境，无法读取数据');
      return [];
    }

    // 记录DOM结构，帮助调试
    console.log('当前Google Sheets DOM结构:', {
      'table元素': document.querySelectorAll('table, div[role="grid"]').length,
      '可见单元格': document.querySelectorAll('.cell-content, .waffle-cell-content, div[role="gridcell"]').length,
      '行元素': document.querySelectorAll('.row-header-wrapper, div[role="row"]').length
    });

    // 方法1: 尝试通过选择所有可见单元格并复制来获取数据
    try {
      console.log('尝试方法1: 通过选择和复制');

      // 查找当前选中的单元格，如果没有，尝试选择第一个单元格
      const currentSelection = document.querySelector('[aria-selected="true"]');
      if (!currentSelection) {
        console.log('没有选中的单元格，尝试选择第一个单元格');
        const firstCell = document.querySelector('.cell-content, .waffle-cell-content, div[role="gridcell"]');
        if (firstCell) {
          firstCell.click();
        }
      }

      // 选择所有内容快捷键 (Ctrl+A)
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'a',
        code: 'KeyA',
        ctrlKey: true,
        bubbles: true
      }));

      // 等待选择操作完成
      await new Promise(resolve => setTimeout(resolve, 300));

      // 复制到剪贴板 (Ctrl+C)
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'c',
        code: 'KeyC',
        ctrlKey: true,
        bubbles: true
      }));

      // 等待复制操作完成
      await new Promise(resolve => setTimeout(resolve, 300));

      // 创建临时元素以获取剪贴板内容
      const tempInput = document.createElement('textarea');
      tempInput.style.position = 'fixed';
      tempInput.style.opacity = '0';
      document.body.appendChild(tempInput);
      tempInput.focus();
      const success = document.execCommand('paste');
      console.log('粘贴命令结果:', success);
      const content = tempInput.value;
      console.log('获取到的内容长度:', content ? content.length : 0);
      document.body.removeChild(tempInput);

      // 清除选择
      window.getSelection()?.removeAllRanges();
      if (content && content.trim()) {
        // 解析TSV格式数据
        const rows = content.split('\n');
        console.log(`方法1成功: 获取到${rows.length}行数据`);
        const data = rows.map(row => row.split('\t'));
        return data;
      } else {
        console.warn('方法1: 复制内容为空');
      }
    } catch (e) {
      console.warn('方法1通过选择和复制读取数据失败:', e);
    }

    // 方法2: 尝试使用navigatorClipboard API
    try {
      console.log('尝试方法2: 使用navigator.clipboard');
      if (navigator.clipboard && navigator.clipboard.readText) {
        // 先尝试用Ctrl+A全选
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'a',
          code: 'KeyA',
          ctrlKey: true,
          bubbles: true
        }));
        await new Promise(resolve => setTimeout(resolve, 300));

        // 再用Ctrl+C复制
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'c',
          code: 'KeyC',
          ctrlKey: true,
          bubbles: true
        }));
        await new Promise(resolve => setTimeout(resolve, 300));

        // 从剪贴板读取
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          // 解析TSV格式数据
          const rows = text.split('\n');
          console.log(`方法2成功: 获取到${rows.length}行数据`);
          const data = rows.map(row => row.split('\t'));
          return data;
        } else {
          console.warn('方法2: 剪贴板内容为空');
        }
      } else {
        console.warn('方法2: navigator.clipboard API不可用');
      }
    } catch (e) {
      console.warn('方法2通过navigator.clipboard读取数据失败:', e);
    }

    // 方法3: 尝试通过DOM API直接读取可见单元格内容
    try {
      console.log('尝试方法3: 通过DOM API读取可见单元格');

      // 尝试不同的选择器来获取单元格
      const selectors = ['.cell-content', '.waffle-cell-content', 'div[role="gridcell"]', '.grid-cell', '.cell'];
      let visibleCells = null;
      for (const selector of selectors) {
        const cells = document.querySelectorAll(selector);
        if (cells && cells.length > 0) {
          console.log(`找到选择器 ${selector} 的单元格: ${cells.length}个`);
          visibleCells = cells;
          break;
        }
      }
      if (!visibleCells || visibleCells.length === 0) {
        console.warn('方法3: 未找到任何单元格元素');

        // 记录当前页面结构
        console.log('页面结构:', document.body.innerHTML.substring(0, 1000) + '...');

        // 尝试查找表格相关元素
        const tableElements = document.querySelectorAll('table, [role="grid"], [role="table"]');
        console.log('表格相关元素:', tableElements.length);
        if (tableElements.length > 0) {
          // 尝试直接从表格元素获取数据
          const firstTable = tableElements[0];
          if (firstTable.rows && firstTable.rows.length > 0) {
            const data = [];
            for (let i = 0; i < firstTable.rows.length; i++) {
              const row = firstTable.rows[i];
              const rowData = [];
              for (let j = 0; j < row.cells.length; j++) {
                rowData.push(row.cells[j].textContent || '');
              }
              data.push(rowData);
            }
            if (data.length > 0) {
              console.log(`方法3(表格元素)成功: 获取到${data.length}行数据`);
              return data;
            }
          }
        }
        return [];
      }
      const cellDataMap = new Map();

      // 尝试识别单元格坐标
      visibleCells.forEach((cell, index) => {
        const htmlCell = cell;
        const text = htmlCell.textContent || '';

        // 尝试多种方式获取坐标
        let row = -1;
        let col = -1;

        // 1. 从数据属性获取
        const rowAttr = htmlCell.getAttribute('data-row') || htmlCell.getAttribute('data-row-index');
        const colAttr = htmlCell.getAttribute('data-col') || htmlCell.getAttribute('data-col-index');
        if (rowAttr && colAttr) {
          row = parseInt(rowAttr, 10);
          col = parseInt(colAttr, 10);
        } else {
          // 2. 从样式位置推断
          const style = htmlCell.getAttribute('style');
          const rect = htmlCell.getBoundingClientRect();
          if (style || rect && rect.top && rect.left) {
            // 使用位置计算大致的行列
            const top = rect.top || parseInt(style?.match(/top:\s*(\d+)/)?.[1] || '0', 10);
            const left = rect.left || parseInt(style?.match(/left:\s*(\d+)/)?.[1] || '0', 10);

            // 估计行列（这需要根据实际表格调整）
            const rowHeight = 25; // 预估行高
            const colWidth = 100; // 预估列宽

            row = Math.floor(top / rowHeight);
            col = Math.floor(left / colWidth);
          } else {
            // 3. 基于索引的简单猜测
            // 这是非常粗略的估计，可能不准确
            const rowEstimate = Math.floor(index / 10); // 假设每行有10列
            const colEstimate = index % 10;
            row = rowEstimate;
            col = colEstimate;
          }
        }
        if (row >= 0 && col >= 0) {
          cellDataMap.set(`${row},${col}`, {
            text,
            row,
            col
          });
        }
      });

      // 整理成二维数组
      if (cellDataMap.size > 0) {
        // 找出最大的行和列
        const rows = Math.max(...Array.from(cellDataMap.values()).map(cell => cell.row)) + 1;
        const cols = Math.max(...Array.from(cellDataMap.values()).map(cell => cell.col)) + 1;
        console.log(`检测到表格尺寸: ${rows}行 x ${cols}列`);

        // 创建并填充数据数组
        const data = Array(rows).fill(0).map(() => Array(cols).fill(''));
        for (const cell of Array.from(cellDataMap.values())) {
          if (cell.row < data.length && cell.col < data[0].length) {
            data[cell.row][cell.col] = cell.text;
          }
        }
        if (data.length > 0 && data[0].length > 0) {
          console.log(`方法3成功: 通过DOM API获取到${data.length}行数据`);
          return data;
        }
      }
      console.warn('方法3: 无法整理单元格数据');
    } catch (error) {
      console.error('方法3读取单元格失败:', error);
    }

    // 方法4: 尝试使用Google Sheets API (如果用户已授权)
    try {
      console.log('尝试方法4: 通过消息传递使用后台的Google Sheets API');

      // 提取当前表格ID
      const spreadsheetId = window.location.href.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (spreadsheetId) {
        console.log('当前表格ID:', spreadsheetId);

        // 通过消息传递请求后台获取数据
        return new Promise(resolve => {
          chrome.runtime.sendMessage({
            type: 'GET_SHEET_DATA',
            spreadsheetId
          }, response => {
            if (response && response.data && response.data.length > 0) {
              console.log(`方法4成功: 通过API获取到${response.data.length}行数据`);
              resolve(response.data);
            } else {
              console.warn('方法4: API返回空数据或错误');
              resolve([]);
            }
          });

          // 设置超时，避免无限等待
          setTimeout(() => {
            console.warn('方法4: API请求超时');
            resolve([]);
          }, 5000);
        });
      } else {
        console.warn('方法4: 无法从URL提取表格ID');
      }
    } catch (error) {
      console.error('方法4使用API失败:', error);
    }

    // 所有方法都失败了，提供空数据
    console.error('所有读取方法都失败，无法获取表格数据');
    showToast('无法读取表格数据，请查看控制台了解详情', 'error');
    return [];
  } catch (error) {
    console.error('读取表格数据主函数失败:', error);
    return [];
  }
}

// 将文本复制到剪贴板
async function copyToClipboard(text) {
  try {
    // 确保页面处于焦点状态
    window.focus();

    // 创建临时文本区域元素
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '0';
    textArea.style.top = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    document.body.appendChild(textArea);

    // 选择文本
    textArea.focus();
    textArea.select();

    // 尝试使用 execCommand 复制
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      console.error('execCommand错误:', err);
      success = false;
    }

    // 尝试使用现代的剪贴板API作为备选方案
    if (!success && navigator.clipboard && window.isSecureContext) {
      try {
        // 等待焦点获取
        setTimeout(async () => {
          try {
            await navigator.clipboard.writeText(text);
            console.log('使用Clipboard API复制成功');
            success = true;
          } catch (err) {
            console.error('Clipboard API错误:', err);
          }
        }, 100);
      } catch (err) {
        console.error('Clipboard API错误:', err);
      }
    }

    // 安全移除临时元素
    try {
      if (document.body.contains(textArea)) {
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.warn('移除临时元素失败，这是正常的:', err);
    }
    if (success) {
      showToast('数据已复制到剪贴板，请在单元格中按 Ctrl+V 粘贴', 'success');
    } else {
      showToast('无法自动复制数据，请手动选择并复制', 'error');
    }
    return success;
  } catch (error) {
    console.error('复制到剪贴板错误:', error);

    // 确保清理
    const tempElements = document.querySelectorAll('textarea[style*="position: fixed"]');
    tempElements.forEach(el => {
      try {
        if (document.body.contains(el)) {
          document.body.removeChild(el);
        } else if (el.parentNode) {
          el.parentNode.removeChild(el);
        } else {
          el.remove();
        }
      } catch (err) {
        // 忽略移除错误
      }
    });
    return false;
  }
}

// 尝试自动粘贴
function attemptAutoPaste(targetElement) {
  try {
    // 聚焦目标元素
    targetElement.focus();

    // 尝试直接模拟Ctrl+V键
    try {
      targetElement.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        ctrlKey: true,
        bubbles: true
      }));
    } catch (err) {
      console.warn('键盘事件分发失败:', err);
    }

    // 尝试使用execCommand
    try {
      return document.execCommand('paste');
    } catch (err) {
      console.warn('execCommand粘贴失败:', err);
      return false;
    }
  } catch (error) {
    console.error('自动粘贴失败:', error);
    return false;
  }
}

// 显示粘贴说明
function showPasteInstructions() {
  // 创建指令对话框
  const instructions = document.createElement('div');
  const dialogId = 'paste-instructions-dialog-' + Date.now();
  instructions.id = dialogId;
  instructions.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 10000;
        width: 350px;
    `;
  instructions.innerHTML = `
        <h3 style="margin-top: 0;">粘贴数据</h3>
        <p>Jira数据已复制到剪贴板。请按照以下步骤完成粘贴：</p>
        <ol style="margin-bottom: 20px; padding-left: 20px;">
            <li>确保表格中有一个选中的单元格</li>
            <li>按 Ctrl+V 或 Command+V 粘贴数据</li>
        </ol>
        <div style="display: flex; justify-content: center;">
            <button id="close-${dialogId}">我知道了</button>
        </div>
    `;
  document.body.appendChild(instructions);

  // 添加事件监听器
  document.getElementById(`close-${dialogId}`)?.addEventListener('click', () => {
    if (document.body.contains(instructions)) {
      document.body.removeChild(instructions);
    } else {
      instructions.remove();
    }
  });
}

// 创建用户指南对话框
function showGuideDialog(tickets, envConfig) {
  const dialog = document.createElement('div');
  const dialogId = 'guide-dialog-' + Date.now();
  dialog.id = dialogId;
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
        width: 450px;
    `;
  dialog.innerHTML = `
        <h3 style="margin-top: 0;">插入Jira数据到表格</h3>
        <p>需要执行以下步骤：</p>
        <ol style="margin-bottom: 20px; padding-left: 20px;">
            <li>请先在表格中选择一个单元格作为起点</li>
            <li>如果表格第一行有标题，请确保标题包含与Jira字段对应的名称</li>
            <li>点击"继续"后，数据将被复制到剪贴板</li>
            <li>然后在选中的单元格按 Ctrl+V (或 Command+V) 粘贴</li>
        </ol>
        <div style="display: flex; justify-content: flex-end;">
            <button id="cancel-${dialogId}" style="margin-right: 10px;">取消</button>
            <button id="continue-${dialogId}">继续</button>
        </div>
    `;
  document.body.appendChild(dialog);

  // 添加事件监听器
  document.getElementById(`cancel-${dialogId}`)?.addEventListener('click', () => {
    if (document.body.contains(dialog)) {
      document.body.removeChild(dialog);
    } else {
      dialog.remove();
    }
  });
  document.getElementById(`continue-${dialogId}`)?.addEventListener('click', () => {
    if (document.body.contains(dialog)) {
      document.body.removeChild(dialog);
    } else {
      dialog.remove();
    }

    // 格式化数据并复制到剪贴板
    const fields = ['key', 'summary', 'status', 'assignee', 'reporter'];
    const headers = fields.join('\t');
    const formattedData = [headers, ...tickets.map(ticket => ({
      ...ticket,
      key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
    })).map(ticket => fields.map(field => ticket[field]).join('\t'))].join('\n');
    copyToClipboard(formattedData);
  });
}

// 获取表格中已存在的表头
function getExistingHeaders() {
  try {
    // 尝试获取表格第一行作为表头
    const headerCells = Array.from(document.querySelectorAll('.row-header-wrapper[style*="top: 0"] ~ .cell-content > .cell-border'));
    if (!headerCells || headerCells.length === 0) {
      // 尝试其他选择器
      const firstRowCells = Array.from(document.querySelectorAll('.grid-row[style*="top: 0"] .cell-content'));
      if (firstRowCells && firstRowCells.length > 0) {
        return firstRowCells.map(cell => cell.textContent?.trim() || '');
      }

      // 尝试直接获取所有可见的单元格内容
      const allVisibleCells = Array.from(document.querySelectorAll('.waffle-row-wrapper > div[style*="top: 0"] span'));
      if (allVisibleCells && allVisibleCells.length > 0) {
        return allVisibleCells.map(cell => cell.textContent?.trim() || '');
      }

      // 针对Canvas渲染的Google Sheets，使用数据属性或其他可能的选择器
      const canvasHeaders = getCanvasBasedHeaders();
      if (canvasHeaders && canvasHeaders.length > 0) {
        return canvasHeaders;
      }

      // 尝试通过API获取表头 - 使用剪贴板方式
      return getHeadersByClipboard();
    }
    return headerCells.map(cell => cell.textContent?.trim() || '');
  } catch (error) {
    console.error('获取表头失败:', error);
    return [];
  }
}

// 尝试通过分析Canvas渲染的表格获取表头
function getCanvasBasedHeaders() {
  try {
    // 尝试查找第一行单元格的数据
    console.log('尝试获取Canvas渲染的表头...');

    // 创建临时输入区域来捕获粘贴内容
    const tempInput = document.createElement('textarea');
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-999999px';
    tempInput.style.top = '-999999px';
    document.body.appendChild(tempInput);

    // 尝试通过模拟键盘快捷键复制第一行
    // 1. 选择第一行 (Shift+Space)
    const firstRowSelector = document.querySelector('div[style*="top: 0"]') || document.querySelector('.grid-row[style*="top: 0"]') || document.querySelector('.waffle-row-wrapper > div[style*="top: 0"]');
    if (firstRowSelector) {
      firstRowSelector.dispatchEvent(new MouseEvent('click', {
        bubbles: true
      }));
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Space',
        code: 'Space',
        shiftKey: true,
        bubbles: true
      }));

      // 等待一点时间让选择生效
      setTimeout(() => {
        // 2. 尝试复制 (Ctrl+C)
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'c',
          code: 'KeyC',
          ctrlKey: true,
          bubbles: true
        }));

        // 等待复制操作完成
        setTimeout(() => {
          // 3. 粘贴到临时输入框
          tempInput.focus();
          document.execCommand('paste');

          // 4. 解析得到的内容
          const clipboardContent = tempInput.value;

          // 安全移除临时元素
          if (document.body.contains(tempInput)) {
            document.body.removeChild(tempInput);
          } else {
            tempInput.remove();
          }
          if (clipboardContent && clipboardContent.trim()) {
            const headers = clipboardContent.split('\t');
            console.log('通过Canvas模拟操作获取的表头:', headers);
            return headers;
          }
        }, 100);
      }, 100);
    }

    // 安全移除临时元素
    if (document.body.contains(tempInput)) {
      document.body.removeChild(tempInput);
    } else if (tempInput.parentNode) {
      tempInput.parentNode.removeChild(tempInput);
    } else {
      tempInput.remove();
    }

    // 如果上述方法失败，尝试分析DOM中可能的数据属性
    const canvasElement = document.querySelector('canvas');
    if (canvasElement) {
      // 这里可能需要使用一些更高级的技术来解析Canvas内容
      console.log('找到Canvas元素，但无法直接读取内容');
    }
    return [];
  } catch (error) {
    console.error('获取Canvas表头失败:', error);

    // 确保清理
    const tempElements = document.querySelectorAll('textarea[style*="position: fixed"]');
    tempElements.forEach(el => {
      try {
        if (document.body.contains(el)) {
          document.body.removeChild(el);
        } else if (el.parentNode) {
          el.parentNode.removeChild(el);
        } else {
          el.remove();
        }
      } catch (err) {
        // 忽略移除错误
      }
    });
    return [];
  }
}

// 提示用户选择第一行并尝试通过剪贴板获取表头
function getHeadersByClipboard() {
  try {
    // 显示提示让用户先选择表头行
    showToast('请先选择表格的第一行（表头行），然后再次尝试', 'info');

    // 尝试获取已选择的内容
    const selectedCells = document.querySelectorAll('[aria-selected="true"]');
    console.log('检测到选中单元格数量:', selectedCells.length);
    if (selectedCells && selectedCells.length > 0) {
      // 创建临时输入区域来获取剪贴板内容
      const tempInput = document.createElement('textarea');
      document.body.appendChild(tempInput);

      // 模拟复制已选择的内容
      document.execCommand('copy');

      // 等待一点时间确保复制完成
      setTimeout(() => {
        tempInput.focus();
        document.execCommand('paste');

        // 解析得到的内容
        const clipboardContent = tempInput.value;
        console.log('剪贴板内容:', clipboardContent);
        if (document.body.contains(tempInput)) {
          document.body.removeChild(tempInput);
        } else {
          tempInput.remove();
        }
        if (clipboardContent && clipboardContent.trim()) {
          // 假设表头是以制表符分隔的
          const headers = clipboardContent.split('\t').map(header => header.trim().toLowerCase());
          console.log('通过剪贴板获取的表头:', headers);
          return headers;
        }
      }, 100);

      // 如果没有成功获取剪贴板内容，尝试直接从选中的单元格内容获取
      const headerTexts = [];
      selectedCells.forEach(cell => {
        const text = cell.innerText || cell.textContent || '';
        if (text.trim()) {
          headerTexts.push(text.trim().toLowerCase());
        }
      });
      if (headerTexts.length > 0) {
        console.log('从选中单元格文本获取的表头:', headerTexts);
        return headerTexts;
      }
    }

    // 如果用户还没有选择表头行，返回默认的Jira字段
    console.log('用户需要手动选择表头行');
    return [];
  } catch (error) {
    console.error('通过剪贴板获取表头失败:', error);
    return [];
  }
}

// 强制复制当前选中的内容作为表头
async function copySelectedHeaders() {
  try {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      // 有选择内容的情况
      document.execCommand('copy');
      return true;
    }

    // 尝试获取当前选中的表格单元格
    const selectedCells = document.querySelectorAll('[aria-selected="true"]');
    if (selectedCells && selectedCells.length > 0) {
      // 尝试模拟复制操作
      document.execCommand('copy');
      return true;
    }
    return false;
  } catch (error) {
    console.error('复制选中表头失败:', error);
    return false;
  }
}

// 查找有效的Jira字段表头
function findValidJiraHeaders(headers, ticket) {
  if (!headers || headers.length === 0 || !ticket) {
    return [];
  }
  const validHeaders = [];
  const possibleJiraFields = Object.keys(ticket).map(k => k.toLowerCase());

  // 打印所有可能的Jira字段名称，用于调试
  console.log('可能的Jira字段:', possibleJiraFields);
  console.log('票据样例:', ticket);
  headers.forEach(header => {
    const headerLower = header.toLowerCase().trim();

    // 检查精确匹配
    if (possibleJiraFields.includes(headerLower)) {
      validHeaders.push(headerLower);
      return;
    }

    // 检查移除空格后匹配
    const headerNoSpace = headerLower.replace(/\s+/g, '');
    if (possibleJiraFields.includes(headerNoSpace)) {
      validHeaders.push(headerLower);
      return;
    }

    // 检查部分匹配
    for (const field of possibleJiraFields) {
      if (headerLower.includes(field) || field.includes(headerLower)) {
        validHeaders.push(headerLower);
        console.log(`部分匹配: "${headerLower}" -> "${field}"`);
        return;
      }
    }

    // 特殊处理常见的字段名别名
    const fieldAliases = {
      'key': ['id', 'ticket', 'jira', 'issue'],
      'summary': ['title', 'name', 'description', '摘要', '标题'],
      'status': ['state', '状态'],
      'assignee': ['assigned', 'owner', '负责人', '经办人'],
      'reporter': ['created by', 'author', '报告人', '创建人']
    };
    for (const [field, aliases] of Object.entries(fieldAliases)) {
      if (aliases.some(alias => headerLower.includes(alias))) {
        validHeaders.push(field);
        console.log(`别名匹配: "${headerLower}" -> "${field}"`);
        return;
      }
    }
  });

  // 如果没有有效头部但有输入头部，至少保留一些基本字段
  if (validHeaders.length === 0 && headers.length > 0) {
    console.log('未找到匹配的字段，使用基本字段映射');
    // 尝试映射基本字段
    return ['key', 'summary', 'status'].filter(f => possibleJiraFields.includes(f));
  }
  return validHeaders;
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

// 显示数据分析对话框
function showDataAnalysisDialog(data) {
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
        width: 80%;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
    `;

  // 头部标题和关闭按钮
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    `;
  const title = document.createElement('h3');
  title.textContent = '数据分析';
  title.style.margin = '0';
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
    `;
  closeButton.addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
  headerDiv.appendChild(title);
  headerDiv.appendChild(closeButton);
  dialog.appendChild(headerDiv);

  // 基本统计信息
  const statsDiv = document.createElement('div');
  statsDiv.style.cssText = `
        background: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 15px;
    `;
  const headers = data[0] || [];
  const dataWithoutHeaders = data.slice(1);
  const rowCount = dataWithoutHeaders.length;
  const colCount = headers.length;
  statsDiv.innerHTML = `
        <h4 style="margin-top: 0; margin-bottom: 10px;">基本统计</h4>
        <p>总行数: ${rowCount}</p>
        <p>总列数: ${colCount}</p>
        <p>表头: ${headers.join(', ')}</p>
    `;
  dialog.appendChild(statsDiv);

  // 列分析
  const columnsDiv = document.createElement('div');
  columnsDiv.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 15px;
    `;

  // 分析每一列
  headers.forEach((header, colIndex) => {
    if (!header) return;
    const columnValues = dataWithoutHeaders.map(row => row[colIndex] || '').filter(Boolean);
    if (columnValues.length === 0) return;
    const columnDiv = document.createElement('div');
    columnDiv.style.cssText = `
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
        `;

    // 检测列数据类型
    const isNumeric = columnValues.every(v => !isNaN(parseFloat(v)) && isFinite(parseFloat(v)));
    if (isNumeric) {
      // 数值型列
      const numericValues = columnValues.map(v => parseFloat(v));
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const avg = sum / numericValues.length;
      const max = Math.max(...numericValues);
      const min = Math.min(...numericValues);
      columnDiv.innerHTML = `
                <h4 style="margin-top: 0; margin-bottom: 10px;">${header}</h4>
                <p>类型: 数值</p>
                <p>平均值: ${avg.toFixed(2)}</p>
                <p>最大值: ${max}</p>
                <p>最小值: ${min}</p>
                <p>总和: ${sum.toFixed(2)}</p>
                <p>非空值数: ${columnValues.length}</p>
            `;
    } else {
      // 分类/文本型列
      const valueCounts = {};
      columnValues.forEach(value => {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
      });

      // 获取前5个最常见值
      const topValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      columnDiv.innerHTML = `
                <h4 style="margin-top: 0; margin-bottom: 10px;">${header}</h4>
                <p>类型: 文本/分类</p>
                <p>唯一值数: ${Object.keys(valueCounts).length}</p>
                <p>非空值数: ${columnValues.length}</p>
                <p>最常见值:</p>
                <ul style="margin-top: 5px; padding-left: 20px;">
                    ${topValues.map(_ref => {
        let [value, count] = _ref;
        return `<li>${value}: ${count}次</li>`;
      }).join('')}
                </ul>
            `;
    }
    columnsDiv.appendChild(columnDiv);
  });
  dialog.appendChild(columnsDiv);

  // 添加功能按钮区域
  const actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = `
        margin-top: 20px;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    `;

  // 导出分析结果按钮
  const exportButton = document.createElement('button');
  exportButton.textContent = '导出分析结果';
  exportButton.style.cssText = `
        padding: 8px 15px;
        background: #0073e6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
  exportButton.addEventListener('click', () => {
    exportAnalysisResults(data);
  });
  actionsDiv.appendChild(exportButton);
  dialog.appendChild(actionsDiv);
  document.body.appendChild(dialog);
}

// 导出分析结果
function exportAnalysisResults(data) {
  try {
    const headers = data[0] || [];
    const dataWithoutHeaders = data.slice(1);

    // 生成分析报告
    let report = `# 数据分析报告\n\n`;
    report += `## 基本信息\n`;
    report += `- 总行数: ${dataWithoutHeaders.length}\n`;
    report += `- 总列数: ${headers.length}\n\n`;
    report += `## 列统计\n\n`;

    // 分析每一列
    headers.forEach((header, colIndex) => {
      if (!header) return;
      const columnValues = dataWithoutHeaders.map(row => row[colIndex] || '').filter(Boolean);
      if (columnValues.length === 0) return;
      report += `### ${header}\n`;

      // 检测列数据类型
      const isNumeric = columnValues.every(v => !isNaN(parseFloat(v)) && isFinite(parseFloat(v)));
      if (isNumeric) {
        // 数值型列
        const numericValues = columnValues.map(v => parseFloat(v));
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const avg = sum / numericValues.length;
        const max = Math.max(...numericValues);
        const min = Math.min(...numericValues);
        report += `- 类型: 数值\n`;
        report += `- 平均值: ${avg.toFixed(2)}\n`;
        report += `- 最大值: ${max}\n`;
        report += `- 最小值: ${min}\n`;
        report += `- 总和: ${sum.toFixed(2)}\n`;
        report += `- 非空值数: ${columnValues.length}\n\n`;
      } else {
        // 分类/文本型列
        const valueCounts = {};
        columnValues.forEach(value => {
          valueCounts[value] = (valueCounts[value] || 0) + 1;
        });

        // 获取前5个最常见值
        const topValues = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        report += `- 类型: 文本/分类\n`;
        report += `- 唯一值数: ${Object.keys(valueCounts).length}\n`;
        report += `- 非空值数: ${columnValues.length}\n`;
        report += `- 最常见值:\n`;
        topValues.forEach(_ref2 => {
          let [value, count] = _ref2;
          report += `  - ${value}: ${count}次\n`;
        });
        report += `\n`;
      }
    });

    // 创建下载链接
    const blob = new Blob([report], {
      type: 'text/plain'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '数据分析报告.md';
    a.click();
    URL.revokeObjectURL(url);
    showToast('分析报告已导出', 'success');
  } catch (error) {
    console.error('导出分析结果失败:', error);
    showToast('导出分析结果失败', 'error');
  }
}
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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YSxDQUFDLENBQUM7SUFDdkQsTUFBTTBCLEdBQUcsR0FBR3ljLEdBQUcsQ0FBQ0MsZUFBZSxDQUFDSCxJQUFJLENBQUM7SUFDckMsTUFBTTFLLENBQUMsR0FBRzNRLFFBQVEsQ0FBQzBHLGFBQWEsQ0FBQyxHQUFHLENBQUM7SUFDckNpSyxDQUFDLENBQUN0RixJQUFJLEdBQUd2TSxHQUFHO0lBQ1o2UixDQUFDLENBQUM4SyxRQUFRLEdBQUcsV0FBVztJQUN4QjlLLENBQUMsQ0FBQ3dFLEtBQUssQ0FBQyxDQUFDO0lBRVRvRyxHQUFHLENBQUNHLGVBQWUsQ0FBQzVjLEdBQUcsQ0FBQztJQUN4QnFILFNBQVMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDO0VBQ25DLENBQUMsQ0FBQyxPQUFPM0ksS0FBSyxFQUFFO0lBQ1pELE9BQU8sQ0FBQ0MsS0FBSyxDQUFDLFdBQVcsRUFBRUEsS0FBSyxDQUFDO0lBQ2pDMkksU0FBUyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUM7RUFDbEM7QUFDSixDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvZ29vZ2xlU2hlZXRzLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3N0b3JhZ2UudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvdXRpbHMudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9jb250ZW50U2NyaXB0R29vZ2xlU2hlZXQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyDpu5jorqTnmoQgSmlyYSDlrZfmrrXphY3nva5cbmNvbnN0IERFRkFVTFRfSklSQV9GSUVMRFMgPSB7XG4gICdLZXknOiAna2V5JyxcbiAgJ1N1bW1hcnknOiAnc3VtbWFyeScsXG4gICdTdGF0dXMnOiAnc3RhdHVzJyxcbiAgJ0Fzc2lnbmVlJzogJ2Fzc2lnbmVlJyxcbiAgJ1JlcG9ydGVyJzogJ3JlcG9ydGVyJyxcbiAgJ1ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgJ0NyZWF0ZWQnOiAnY3JlYXRlZCcsXG4gICdVcGRhdGVkJzogJ3VwZGF0ZWQnLFxuICAnRHVlIERhdGUnOiAnZHVlZGF0ZScsXG4gICdEZXNjcmlwdGlvbic6ICdkZXNjcmlwdGlvbidcbn07XG5cbi8vIOS7jiBHb29nbGUgU2hlZXRzIOiOt+WPluaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEZpZWxkTWFwcGluZyhzaGVldE5hbWU6IHN0cmluZyk6IFByb21pc2U8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgIHR5cGU6ICdHRVRfU0hFRVRfQ09ORklHJyxcbiAgICAgIHNoZWV0TmFtZTogc2hlZXROYW1lXG4gICAgfSwgcmVzcG9uc2UgPT4ge1xuICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfojrflj5bphY3nva7lpLHotKU6JywgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgcmVzb2x2ZShERUZBVUxUX0pJUkFfRklFTERTKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmVzb2x2ZShyZXNwb25zZT8ubWFwcGluZyB8fCBERUZBVUxUX0pJUkFfRklFTERTKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbi8vIOiOt+WPluW9k+WJjeW3peS9nOihqOeahOihqOWktFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNoZWV0SGVhZGVycygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgdHlwZTogJ0dFVF9TSEVFVF9IRUFERVJTJ1xuICAgIH0sIHJlc3BvbnNlID0+IHtcbiAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign6I635Y+W6KGo5aS05aSx6LSlOicsIGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXNvbHZlKHJlc3BvbnNlPy5oZWFkZXJzIHx8IFtdKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbi8vIOS7jiBKaXJhIOmhtemdouaKk+WPluaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoSmlyYVRpY2tldHMoanFsOiBzdHJpbmcpOiBQcm9taXNlPEppcmFUaWNrZXRbXT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZyg3KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOebkeWQrOadpeiHqiBiYWNrZ3JvdW5kIHNjcmlwdCDnmoTmtojmga9cbiAgICAgICAgY29uc3QgbWVzc2FnZUxpc3RlbmVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ21lc3NhZ2UxMTEnLCBtZXNzYWdlKTtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyAmJiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gcmVxdWVzdElkKSB7XG4gICAgICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlLmVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLnRpY2tldHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgIFxuICAgICAgICAvLyDlj5HpgIHmtojmga/nu5kgYmFja2dyb3VuZCBzY3JpcHQg5p2l5Yib5bu65paw5qCH562+6aG1XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdGRVRDSF9KSVJBX1RJQ0tFVFMnLFxuICAgICAgICAgICAganFsLFxuICAgICAgICAgICAgcmVxdWVzdElkXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDnhLblkI7lnKggRkVUQ0hfSklSQV9USUNLRVRTIOWHveaVsOS4reS9v+eUqCBzb3VyY2VUYWJJZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEZFVENIX0pJUkFfVElDS0VUUyhqcWw6IHN0cmluZywgcmVxdWVzdElkOiBzdHJpbmcsIHNvdXJjZVRhYklkOiBudW1iZXIpIHtcbiAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gIGNvbnN0IHVybCA9IGAke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9pc3N1ZXMvP2pxbD0ke2VuY29kZVVSSUNvbXBvbmVudChqcWwpfWA7XG4gICAgICAgIFxuICAvLyDliJvlu7rmlrDmoIfnrb7pobVcbiAgY2hyb21lLnRhYnMuY3JlYXRlKHsgdXJsLCBhY3RpdmU6IGZhbHNlIH0sICh0YWIpID0+IHtcbiAgICAgIGlmICghdGFiLmlkKSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgIGVycm9yOiAn5peg5rOV5Yib5bu65qCH562+6aG1J1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICBjb25zdCBjaGVja1BhZ2VMb2FkID0gKCkgPT4ge1xuICAgICAgICAgIGNocm9tZS50YWJzLmdldCh0YWIuaWQhLCAodXBkYXRlZFRhYikgPT4ge1xuICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi5zdGF0dXMgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICAgICAgICAgIC8vIOazqOWFpeWGheWuueiEmuacrFxuICAgICAgICAgICAgICAgICAgY2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdGFiSWQ6IHRhYi5pZCEgfSxcbiAgICAgICAgICAgICAgICAgICAgICBmdW5jOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ci5pc3N1ZXJvdycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiByb3cucXVlcnlTZWxlY3RvcignLmlzc3Vla2V5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5zdW1tYXJ5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiByb3cucXVlcnlTZWxlY3RvcignLnN0YXR1cycpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlOiByb3cucXVlcnlTZWxlY3RvcignLmFzc2lnbmVlJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZXI6IHJvdy5xdWVyeVNlbGVjdG9yKCcucmVwb3J0ZXInKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5wcmlvcml0eScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcuY3JlYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcudXBkYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGU6IHJvdy5xdWVyeVNlbGVjdG9yKCcuZHVlZGF0ZScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiByb3cucXVlcnlTZWxlY3RvcignLmRlc2NyaXB0aW9uJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGlja2V0cztcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9LCAocmVzdWx0cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzWzBdLnJlc3VsdCA9IHJlc3VsdHNbMF0ucmVzdWx0Lm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogdGlja2V0LnN1bW1hcnkuc3BsaXQoJ1xcbicpLnNsaWNlKC0xKVswXS50cmltKCksXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5Y+R6YCB57uT5p6c5Zue5rqQ5qCH562+6aG1XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiByZXN1bHRzWzBdLnJlc3VsdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIOWFs+mXrSBKaXJhIOagh+etvumhtVxuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5yZW1vdmUodGFiLmlkISk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoY2hlY2tQYWdlTG9hZCwgMTAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgY2hlY2tQYWdlTG9hZCgpO1xuICB9KTtcbn1cblxuLy8g5bCGIEppcmEgdGlja2V0cyDlhpnlhaUgR29vZ2xlIFNoZWV0XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVUaWNrZXRzVG9TaGVldCh0aWNrZXRzOiBKaXJhVGlja2V0W10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICB0eXBlOiAnV1JJVEVfVElDS0VUUycsXG4gICAgICB0aWNrZXRzOiB0aWNrZXRzXG4gICAgfSwgcmVzcG9uc2UgPT4ge1xuICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCflhpnlhaXmlbDmja7lpLHotKU6JywgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfSk7XG59IiwiZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4ZWREQkRhdGEoZGF0YWJhc2VOYW1lOiBzdHJpbmcsIHN0b3JlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oZGF0YWJhc2VOYW1lKTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbihbc3RvcmVOYW1lXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBkYXRhUmVxdWVzdCA9IG9iamVjdFN0b3JlLmdldEFsbCgpO1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgICAgICB9O1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn1cblxuXG5leHBvcnQgY29uc3QgZ2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8IEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IHNldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VXNlckluZm8oKSB7XG4gICAgY29uc3QgeyBleHRlbnNpb246IGV4dGVuc2lvbklkIH0gPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdvd25FeHRlbnNpb24nLCB7fSk7XG4gICAgY29uc3QgdXNlcm5hbWUgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdkaXNwbGF5TmFtZScsICdyYWRhci1wb2MnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBleHRlbnNpb25JZCxcbiAgICAgICAgdXNlcm5hbWVcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rm9sZGVycygpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdwcm9maWxlJykudGhlbigoW2RhdGFdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmYXZvcml0ZV9ncm91cF9pZHMgPSBkYXRhPy5mYXZvcml0ZV9ncm91cF9pZHMgfHwgW107XG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25fc2V0cyA9IGRhdGE/LmNvbnZlcnNhdGlvbl9zZXRzIHx8IFtdO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IFt7dGl0bGU6ICcgJywgaWRzOiBbXX0se3RpdGxlOiAnZmF2b3JpdGUnLCBpZHM6IGZhdm9yaXRlX2dyb3VwX2lkc30sIC4uLmNvbnZlcnNhdGlvbl9zZXRzLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2ZvbGRlcicpXVxuICAgICAgICAgICAgcmV0dXJuIGZvbGRlcnM7XG4gICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0R3JvdXBzTWFwKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ2dyb3VwJykudGhlbigoZ3JvdXBzKSA9PiB7XG4gICAgICAgIGNvbnN0IGdyb3Vwc01hcCA9IGdyb3Vwcy5yZWR1Y2UoKGFjYzogYW55LCBncm91cDogYW55KSA9PiB7XG4gICAgICAgICAgICBhY2NbZ3JvdXAuaWRdID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLnNldF9hYmJyZXZpYXRpb24sXG4gICAgICAgICAgICAgICAgaXNfdGVhbTogZ3JvdXAuaXNfdGVhbVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sIHt9KTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBzTWFwO1xuICAgIH0pO1xufSIsImltcG9ydCB7IGdldEN1cnJlbnRVc2VySW5mbywgZ2V0TG9jYWxTdG9yYWdlSXRlbSB9IGZyb20gXCIuL3N0b3JhZ2VcIjtcblxuLy8g546v5aKD6YWN572u57G75Z6L5a6a5LmJXG5leHBvcnQgaW50ZXJmYWNlIEVudkNvbmZpZ1R5cGUge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IG51bWJlcjtcbiAgQU5BTFlTSVNfVFlQRTogc3RyaW5nO1xuICBBTkFMWVpFX0JZX0dST1VQOiBib29sZWFuO1xuICBMTE1fVFlQRTogc3RyaW5nO1xuICBPTExBTUFfQkFTRV9VUkw6IHN0cmluZztcbiAgT0xMQU1BX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBzdHJpbmc7XG4gIERJRllfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX1JFVklFV19BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfS0VZOiBzdHJpbmc7XG4gIE9QRU5BSV9NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgR1JPUV9BUElfS0VZOiBzdHJpbmc7XG4gIEdST1FfTU9ERUw6IHN0cmluZztcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgQk9UX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBCT1RfVE9LRU46IHN0cmluZztcbiAgQk9UX0lEOiBzdHJpbmc7XG4gIEJPVF9UWVBFOiBzdHJpbmc7XG4gIFRFQU1fSUQ6IHN0cmluZztcbiAgRU5BQkxFX0JPVDogYm9vbGVhbjtcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogYm9vbGVhbjtcbiAgRU5BQkxFX0NIUk9NQTogYm9vbGVhbjtcbiAgQ0hST01BX0FQSV9VUkw6IHN0cmluZztcbiAgQ0hST01BX1BPUlQ6IG51bWJlcjtcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogc3RyaW5nO1xuICAvLyBKSVJB55u45YWz6YWN572uXG4gIEpJUkFfQkFTRV9VUkw/OiBzdHJpbmc7XG4gIEpJUkFfVVNFUk5BTUU/OiBzdHJpbmc7XG4gIEpJUkFfQVBJX1RPS0VOPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gICAgXG4gICAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBob3VycyA9IFN0cmluZyhkYXRlLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICBcbiAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9ICR7aG91cnN9OiR7bWludXRlc306JHtzZWNvbmRzfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnkoYXJyYXk6IGFueVtdLCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgcmV0dXJuIGFycmF5LmZpbHRlcihpdGVtID0+IHtcbiAgICAgIGNvbnN0IGtleVZhbHVlID0gaXRlbVtrZXldO1xuICAgICAgaWYgKHNlZW4uaGFzKGtleVZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLmFkZChrZXlWYWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgb25DbG9zZT86ICgpID0+IHZvaWQpIHtcbiAgLy8g6I635Y+W5oiW5Yib5bu65a655Zmo5YWD57SgXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyYWRhci1wb2MtcmVzdWx0Jyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm5cblxuICAvLyDnp7vpmaTnjrDmnInnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IGV4aXN0aW5nVG9hc3QgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLnJhZGFyLXBvYy10b2FzdCcpO1xuICBpZiAoZXhpc3RpbmdUb2FzdCkge1xuICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChleGlzdGluZ1RvYXN0KTtcbiAgfVxuXG4gIC8vIOWIm+W7uuaWsOeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHJhZGFyLXBvYy10b2FzdCByYWRhci1wb2MtdG9hc3QtJHt0eXBlfWA7XG5cbiAgY29uc3QgdG9hc3RJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdElubmVyLmNsYXNzTmFtZSA9ICdyYWRhci1wb2MtdG9hc3QtaW5uZXInO1xuICB0b2FzdElubmVyLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblxuICB0b2FzdC5hcHBlbmRDaGlsZCh0b2FzdElubmVyKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcblxuICAvLyDorr7nva7lrprml7blmajlnKggMyDnp5LlkI7lhbPpl60gVG9hc3RcbiAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH0sIDMwMDApO1xuXG4gIC8vIOi/lOWbnuS4gOS4quWHveaVsOS7peS+v+aJi+WKqOWFs+mXrSBUb2FzdFxuICByZXR1cm4gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtR3JvdXBMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IGdyb3VwTGlua1BhdHRlcm4gPSAvXFxbZ3JvdXA6KC4rKTooXFxkKylcXF0vZztcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKGdyb3VwTGlua1BhdHRlcm4sIChtYXRjaCwgZ3JvdXBOYW1lLCBncm91cElkKSA9PiB7XG4gICAgcmV0dXJuIGBbJHtncm91cE5hbWV9XSgvbWVzc2FnZXMvJHtncm91cElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtUG9zdExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgcG9zdExpbmtQYXR0ZXJuID0gL1xcW3Bvc3Q6KFxcZCspXFxdL2c7XG4gIGxldCBpbmRleCA9IDE7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShwb3N0TGlua1BhdHRlcm4sIChtYXRjaCwgcG9zdElkKSA9PiB7XG4gICAgcmV0dXJuIGBbWyR7aW5kZXgrK31dXSgvbCR7d2luZG93LmxvY2F0aW9uLnBhdGhuYW1lfS8ke3Bvc3RJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuLy8g6buY6K6k546v5aKD6YWN572uXG5leHBvcnQgY29uc3QgZGVmYXVsdEVudkNvbmZpZzogRW52Q29uZmlnVHlwZSA9IHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBOdW1iZXIocHJvY2Vzcy5lbnYuU0NIRURVTEVEX0lOVEVSVkFMKSB8fCAxMjAsXG4gIEFOQUxZU0lTX1RZUEU6IHByb2Nlc3MuZW52LkFOQUxZU0lTX1RZUEUgfHwgXCJmaWx0ZXJcIixcbiAgTExNX1RZUEU6IHByb2Nlc3MuZW52LkxMTV9UWVBFIHx8IFwiZGlmeVwiLFxuICBBTkFMWVpFX0JZX0dST1VQOiBwcm9jZXNzLmVudi5BTkFMWVpFX0JZX0dST1VQID09PSBcInRydWVcIixcbiAgT0xMQU1BX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PTExBTUFfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjExNDM0XCIsXG4gIE9MTEFNQV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX01PREVMIHx8IFwiZGVlcHNlZWstcjFcIixcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1JFVklFV19NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1FVRVJZX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgRElGWV9BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9SRVZJRVdfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuRElGWV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9LRVk6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZIHx8IFwiXCIsXG4gIE9QRU5BSV9NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBHUk9RX0FQSV9LRVk6IHByb2Nlc3MuZW52LkdST1FfQVBJX0tFWSB8fCBcIlwiLFxuICBHUk9RX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX01PREVMIHx8IFwiXCIsXG4gIEdST1FfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBCT1RfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5CT1RfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9ib3RtYW4uaW50LnJjbGFiZW52LmNvbS92MlwiLFxuICBCT1RfVE9LRU46IHByb2Nlc3MuZW52LkJPVF9UT0tFTiB8fCBcIlwiLFxuICBCT1RfSUQ6IHByb2Nlc3MuZW52LkJPVF9JRCB8fCBcIjQ3MDAzNzIwMjBAMzc0Mzk1MTAuYm90LmdsaXAubmV0XCIsXG4gIEJPVF9UWVBFOiBwcm9jZXNzLmVudi5CT1RfVFlQRSB8fCBcInVzZXJcIixcbiAgVEVBTV9JRDogcHJvY2Vzcy5lbnYuVEVBTV9JRCB8fCBcIlwiLFxuICBFTkFCTEVfQk9UOiBwcm9jZXNzLmVudi5FTkFCTEVfQk9UID09PSBcInRydWVcIixcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogcHJvY2Vzcy5lbnYuTExNX1JFVklFV19CRUZPUkVfU0VORCA9PT0gXCJ0cnVlXCIsXG4gIEVOQUJMRV9DSFJPTUE6IHByb2Nlc3MuZW52LkVOQUJMRV9DSFJPTUEgPT09IFwidHJ1ZVwiLFxuICBDSFJPTUFfQVBJX1VSTDogcHJvY2Vzcy5lbnYuQ0hST01BX0FQSV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgQ0hST01BX1BPUlQ6IE51bWJlcihwcm9jZXNzLmVudi5DSFJPTUFfUE9SVCkgfHwgODAwMCxcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogcHJvY2Vzcy5lbnYuQ0hST01BX0NPTExFQ1RJT05fTkFNRSB8fCBcIlwiLFxuICBKSVJBX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5KSVJBX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9qaXJhLnJpbmdjZW50cmFsLmNvbVwiLFxuICBKSVJBX1VTRVJOQU1FOiBwcm9jZXNzLmVudi5KSVJBX1VTRVJOQU1FIHx8IFwiXCIsXG4gIEpJUkFfQVBJX1RPS0VOOiBwcm9jZXNzLmVudi5KSVJBX0FQSV9UT0tFTiB8fCBcIlwiLFxufTtcblxuLy8g6I635Y+W546v5aKD6YWN572u77yM5aaC5p6c5Y+v6IO955qE6K+d5LuOIHN0b3JhZ2Ug6I635Y+W77yM5ZCm5YiZ5LuOIHByb2Nlc3MuZW52IOiOt+WPllxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEVudkNvbmZpZygpOiBQcm9taXNlPEVudkNvbmZpZ1R5cGU+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IGVudkNvbmZpZyB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFsnZW52Q29uZmlnJ10pO1xuICAgIGlmIChlbnZDb25maWcpIHtcbiAgICAgIC8vIOWwhuWtmOWCqOeahOmFjee9ruS4jum7mOiupOmFjee9ruWQiOW5tu+8jOehruS/neaWsOWinueahOmFjee9rumhueS5n+S8muiiq+WMheWQq1xuICAgICAgcmV0dXJuIHsgLi4uZGVmYXVsdEVudkNvbmZpZywgLi4uZW52Q29uZmlnIH07XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+iOt+WPlumFjee9ruWksei0pTonLCBlcnJvcik7XG4gIH1cbiAgXG4gIC8vIOWmguaenOiOt+WPluWksei0peaIluayoeacieS/neWtmOeahOmFjee9ru+8jOi/lOWbnum7mOiupOWAvFxuICByZXR1cm4gZGVmYXVsdEVudkNvbmZpZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVzZXJJbmZvKCkge1xuICBjb25zdCBhY2NvdW50VUQgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdnbG9iYWwuYWNjb3VudC5VRCcsICcnKTtcbiAgY29uc3QgYWNjb3VudEluZm9MaXN0ID0gZ2V0TG9jYWxTdG9yYWdlSXRlbSgnZ2xvYmFsLmFjY291bnQuQUNDT1VOVF9TRVNTSU9OX0RBVEFfTElTVCcsIHt9KTtcblxuICBjb25zdCBhY2NvdW50SW5mbyA9IGFjY291bnRVRCA/IGFjY291bnRJbmZvTGlzdFthY2NvdW50VURdIDogYWNjb3VudEluZm9MaXN0LmZpbmQoKGl0ZW06YW55KSA9PiBpdGVtLmRpc3BsYXlOYW1lICE9ICcnKTtcbiAgY29uc29sZS5sb2coJ2FjY291bnRJbmZvTGlzdCcsIGFjY291bnRJbmZvTGlzdCwgYWNjb3VudEluZm8pO1xuICBpZiAoYWNjb3VudEluZm8pIHJldHVybiB7XG4gICAgZXh0ZW5zaW9uSWQ6IGFjY291bnRJbmZvLmV4dGVuc2lvbklkLFxuICAgIGVtYWlsOiBhY2NvdW50SW5mby5lbWFpbCxcbiAgICBmdWxsTmFtZTogYWNjb3VudEluZm8uZGlzcGxheU5hbWUsXG4gICAgdXNlcm5hbWU6IGFjY291bnRJbmZvLmVtYWlsID8gYWNjb3VudEluZm8uZW1haWwudHJpbSgpLnNwbGl0KCdAJylbMF0gOiBhY2NvdW50SW5mby5kaXNwbGF5TmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJyksXG4gIH1cblxuICBjb25zdCB1c2VySW5mbyA9IGdldEN1cnJlbnRVc2VySW5mbygpO1xuICByZXR1cm4ge1xuICAgIGV4dGVuc2lvbklkOiB1c2VySW5mby5leHRlbnNpb25JZCxcbiAgICBmdWxsTmFtZTogdXNlckluZm8udXNlcm5hbWUsXG4gICAgdXNlcm5hbWU6IHVzZXJJbmZvLnVzZXJuYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSxcbiAgICBlbWFpbDogdXNlckluZm8udXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpICsgJ0ByaW5nY2VudHJhbC5jb20nXG4gIH07XG59XG5cbiIsIi8vIFRoZSBtb2R1bGUgY2FjaGVcbnZhciBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX18gPSB7fTtcblxuLy8gVGhlIHJlcXVpcmUgZnVuY3Rpb25cbmZ1bmN0aW9uIF9fd2VicGFja19yZXF1aXJlX18obW9kdWxlSWQpIHtcblx0Ly8gQ2hlY2sgaWYgbW9kdWxlIGlzIGluIGNhY2hlXG5cdHZhciBjYWNoZWRNb2R1bGUgPSBfX3dlYnBhY2tfbW9kdWxlX2NhY2hlX19bbW9kdWxlSWRdO1xuXHRpZiAoY2FjaGVkTW9kdWxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkTW9kdWxlLmV4cG9ydHM7XG5cdH1cblx0Ly8gQ3JlYXRlIGEgbmV3IG1vZHVsZSAoYW5kIHB1dCBpdCBpbnRvIHRoZSBjYWNoZSlcblx0dmFyIG1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF0gPSB7XG5cdFx0Ly8gbm8gbW9kdWxlLmlkIG5lZWRlZFxuXHRcdC8vIG5vIG1vZHVsZS5sb2FkZWQgbmVlZGVkXG5cdFx0ZXhwb3J0czoge31cblx0fTtcblxuXHQvLyBFeGVjdXRlIHRoZSBtb2R1bGUgZnVuY3Rpb25cblx0X193ZWJwYWNrX21vZHVsZXNfX1ttb2R1bGVJZF0obW9kdWxlLCBtb2R1bGUuZXhwb3J0cywgX193ZWJwYWNrX3JlcXVpcmVfXyk7XG5cblx0Ly8gUmV0dXJuIHRoZSBleHBvcnRzIG9mIHRoZSBtb2R1bGVcblx0cmV0dXJuIG1vZHVsZS5leHBvcnRzO1xufVxuXG4iLCIvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9ucyBmb3IgaGFybW9ueSBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLmQgPSAoZXhwb3J0cywgZGVmaW5pdGlvbikgPT4ge1xuXHRmb3IodmFyIGtleSBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYoX193ZWJwYWNrX3JlcXVpcmVfXy5vKGRlZmluaXRpb24sIGtleSkgJiYgIV9fd2VicGFja19yZXF1aXJlX18ubyhleHBvcnRzLCBrZXkpKSB7XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywga2V5LCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZGVmaW5pdGlvbltrZXldIH0pO1xuXHRcdH1cblx0fVxufTsiLCJfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSAob2JqLCBwcm9wKSA9PiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwgcHJvcCkpIiwiLy8gZGVmaW5lIF9fZXNNb2R1bGUgb24gZXhwb3J0c1xuX193ZWJwYWNrX3JlcXVpcmVfXy5yID0gKGV4cG9ydHMpID0+IHtcblx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG5cdH1cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbn07IiwiaW1wb3J0IHsgZmV0Y2hKaXJhVGlja2V0cywgd3JpdGVUaWNrZXRzVG9TaGVldCB9IGZyb20gJy4vZ29vZ2xlU2hlZXRzJztcbmltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyBNYWluIGxpc3RlbmVyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ+aUtuWIsOa2iOaBrzonLCBtZXNzYWdlLCAn5Y+R6YCB6ICFOicsIHNlbmRlcik7XG5cbiAgICBpZiAoIW1lc3NhZ2UgfHwgIW1lc3NhZ2UudHlwZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+aUtuWIsOaXoOaViOa2iOaBr+agvOW8jycpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyB0eXBlIH0gPSBtZXNzYWdlO1xuXG4gICAgaWYgKHR5cGUgPT09ICdPUEVOX0pJUkFfUVVFUllfRElBTE9HJykge1xuICAgICAgICBvcGVuSnFsRGlhbG9nKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7IC8vIOS4uuaJgOaciea2iOaBr+S/neaMgea2iOaBr+mAmumBk+W8gOWQr1xufSk7XG5cbi8vIOWIneWni+WMllxuZnVuY3Rpb24gaW5pdGlhbGl6ZSgpIHtcbiAgICAvLyDmo4Dmn6XmmK/lkKblnKhHb29nbGUgU2hlZXRz546v5aKD5LitXG4gICAgaWYgKHdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKCdkb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzJykpIHtcbiAgICAgICAgLy8g5qOA5p+l5piv5ZCm5ZCv55So5LqGU2hlZXRz6ZuG5oiQ5Yqf6IO9XG4gICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2VuYWJsZVNoZWV0c0ludGVncmF0aW9uJ10sIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGVuYWJsZVNoZWV0c0ludGVncmF0aW9uID0gcmVzdWx0LmVuYWJsZVNoZWV0c0ludGVncmF0aW9uICE9PSBmYWxzZTsgLy8g6buY6K6k5ZCv55SoXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChlbmFibGVTaGVldHNJbnRlZ3JhdGlvbikge1xuICAgICAgICAgICAgICAgIC8vIOa3u+WKoOa1ruWKqOW3peWFt+agj1xuICAgICAgICAgICAgICAgIGFkZEZsb2F0aW5nVG9vbGJhcigpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCflt7LliqDovb1Hb29nbGUgU2hlZXRz6ZuG5oiQ5bel5YW3Jyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdHb29nbGUgU2hlZXRz6ZuG5oiQ5Yqf6IO95bey56aB55SoJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuLy8g5re75Yqg5rWu5Yqo5bel5YW35qCP5YiwR29vZ2xlIFNoZWV0c1xuZnVuY3Rpb24gYWRkRmxvYXRpbmdUb29sYmFyKCkge1xuICAgIGNvbnN0IHRvb2xiYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB0b29sYmFyLmlkID0gJ2ppcmEtc2hlZXRzLXRvb2xiYXInO1xuICAgIHRvb2xiYXIuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICBib3R0b206IDMwcHg7XG4gICAgICAgIHJpZ2h0OiAzMHB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4yKTtcbiAgICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgIHBhZGRpbmc6IDEwcHg7XG4gICAgYDtcbiAgICBcbiAgICBjb25zdCBjbG9zZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGNsb3NlQnV0dG9uLnRleHRDb250ZW50ID0gJ8OXJztcbiAgICBjbG9zZUJ1dHRvbi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICAgIHRvcDogNXB4O1xuICAgICAgICByaWdodDogNXB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiBub25lO1xuICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgIGZvbnQtc2l6ZTogMTZweDtcbiAgICAgICAgY3Vyc29yOiBwb2ludGVyO1xuICAgICAgICBjb2xvcjogIzY2NjtcbiAgICBgO1xuICAgIGNsb3NlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRvb2xiYXIpO1xuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IHRpdGxlTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICB0aXRsZUxhYmVsLnRleHRDb250ZW50ID0gJ0ppcmEtU2hlZXRzIOW3peWFtyc7XG4gICAgdGl0bGVMYWJlbC5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBmb250LXdlaWdodDogYm9sZDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTBweDtcbiAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgIGA7XG4gICAgXG4gICAgY29uc3QgcXVlcnlCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBxdWVyeUJ1dHRvbi50ZXh0Q29udGVudCA9ICfmn6Xor6IgSmlyYSDmlbDmja4nO1xuICAgIHF1ZXJ5QnV0dG9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgcGFkZGluZzogOHB4IDE1cHg7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgYmFja2dyb3VuZDogIzAwNzNlNjtcbiAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICBgO1xuICAgIHF1ZXJ5QnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBvcGVuSnFsRGlhbG9nKCk7XG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgcmVhZEJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIHJlYWRCdXR0b24udGV4dENvbnRlbnQgPSAn6K+75Y+W6KGo5qC85pWw5o2uJztcbiAgICByZWFkQnV0dG9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgcGFkZGluZzogOHB4IDE1cHg7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgYmFja2dyb3VuZDogIzI4YTc0NTtcbiAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICBgO1xuICAgIHJlYWRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZFNoZWV0RGF0YSgpO1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+ivu+WPluWIsOeahOihqOagvOaVsOaNrjonLCBkYXRhKTtcbiAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOaIkOWKn+ivu+WPluihqOagvOaVsOaNru+8jOWFsSAke2RhdGEubGVuZ3RofSDooYxgLCAnc3VjY2VzcycpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIOS/neWtmOWIsOacrOWcsOWtmOWCqOS+m+WQjue7reS9v+eUqFxuICAgICAgICAgICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7XG4gICAgICAgICAgICAgICAgICAgIHNoZWV0RGF0YTogSlNPTi5zdHJpbmdpZnkoZGF0YSlcbiAgICAgICAgICAgICAgICB9LCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfooajmoLzmlbDmja7lt7Lkv53lrZjliLDmnKzlnLDlrZjlgqgnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrog73or7vlj5bliLDooajmoLzmlbDmja4nLCAnZXJyb3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+ivu+WPluihqOagvOaVsOaNruWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+ivu+WPluihqOagvOaVsOaNruaXtuWHuumUmScsICdlcnJvcicpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgYW5hbHl6ZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGFuYWx5emVCdXR0b24udGV4dENvbnRlbnQgPSAn5YiG5p6Q6KGo5qC85pWw5o2uJztcbiAgICBhbmFseXplQnV0dG9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgcGFkZGluZzogOHB4IDE1cHg7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgYmFja2dyb3VuZDogIzZjNzU3ZDtcbiAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICBgO1xuICAgIGFuYWx5emVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVhZFNoZWV0RGF0YSgpO1xuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgc2hvd0RhdGFBbmFseXNpc0RpYWxvZyhkYXRhKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmsqHmnInlj6/liIbmnpDnmoTmlbDmja4nLCAnZXJyb3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ+WIhuaekOaVsOaNruWksei0pTonLCBlcnJvcik7XG4gICAgICAgICAgICBzaG93VG9hc3QoJ+WIhuaekOaVsOaNruaXtuWHuumUmScsICdlcnJvcicpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgLy8g5re75Yqg6LCD6K+V5oyJ6ZKuXG4gICAgY29uc3QgZGVidWdCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBkZWJ1Z0J1dHRvbi50ZXh0Q29udGVudCA9ICfosIPor5VET03lhYPntKAnO1xuICAgIGRlYnVnQnV0dG9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIG1hcmdpbi1ib3R0b206IDhweDtcbiAgICAgICAgcGFkZGluZzogOHB4IDE1cHg7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgYmFja2dyb3VuZDogI2RjMzU0NTtcbiAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICBib3JkZXItcmFkaXVzOiA0cHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICBgO1xuICAgIGRlYnVnQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBkZWJ1Z0dvb2dsZVNoZWV0c0RPTSgpO1xuICAgIH0pO1xuICAgIFxuICAgIC8vIOa3u+WKoOeugOWNleivu+WPluaMiemSrlxuICAgIGNvbnN0IHNpbXBsZVNjYW5CdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBzaW1wbGVTY2FuQnV0dG9uLnRleHRDb250ZW50ID0gJ+aJq+aPj+WPr+ingeWNleWFg+agvCc7XG4gICAgc2ltcGxlU2NhbkJ1dHRvbi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBtYXJnaW4tYm90dG9tOiA4cHg7XG4gICAgICAgIHBhZGRpbmc6IDhweCAxNXB4O1xuICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgIGJhY2tncm91bmQ6ICNmZDdlMTQ7XG4gICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgYDtcbiAgICBzaW1wbGVTY2FuQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBzY2FuVmlzaWJsZUNlbGxzKCk7XG4gICAgfSk7XG4gICAgXG4gICAgdG9vbGJhci5hcHBlbmRDaGlsZChjbG9zZUJ1dHRvbik7XG4gICAgdG9vbGJhci5hcHBlbmRDaGlsZCh0aXRsZUxhYmVsKTtcbiAgICB0b29sYmFyLmFwcGVuZENoaWxkKHF1ZXJ5QnV0dG9uKTtcbiAgICB0b29sYmFyLmFwcGVuZENoaWxkKHJlYWRCdXR0b24pO1xuICAgIHRvb2xiYXIuYXBwZW5kQ2hpbGQoYW5hbHl6ZUJ1dHRvbik7XG4gICAgdG9vbGJhci5hcHBlbmRDaGlsZChkZWJ1Z0J1dHRvbik7XG4gICAgdG9vbGJhci5hcHBlbmRDaGlsZChzaW1wbGVTY2FuQnV0dG9uKTtcbiAgICBcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvb2xiYXIpO1xufVxuXG4vLyDosIPor5VHb29nbGUgU2hlZXRzIERPTee7k+aehFxuZnVuY3Rpb24gZGVidWdHb29nbGVTaGVldHNET00oKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc29sZS5sb2coJ+W8gOWni+iwg+ivlUdvb2dsZSBTaGVldHMgRE9N57uT5p6ELi4uJyk7XG4gICAgICAgIFxuICAgICAgICAvLyDmn6Xmib7miYDmnInlj6/og73kuI7ooajmoLznm7jlhbPnmoTlhYPntKBcbiAgICAgICAgY29uc3QgZWxlbWVudHMgPSB7XG4gICAgICAgICAgICB0YWJsZXM6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3RhYmxlJyksXG4gICAgICAgICAgICBncmlkczogZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW3JvbGU9XCJncmlkXCJdJyksXG4gICAgICAgICAgICBjZWxsczogZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW3JvbGU9XCJncmlkY2VsbFwiXScpLFxuICAgICAgICAgICAgY2VsbENvbnRlbnRzOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY2VsbC1jb250ZW50LCAud2FmZmxlLWNlbGwtY29udGVudCcpLFxuICAgICAgICAgICAgcm93czogZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW3JvbGU9XCJyb3dcIl0nKSxcbiAgICAgICAgICAgIGhlYWRlcnM6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ1tyb2xlPVwiY29sdW1uaGVhZGVyXCJdLCBbcm9sZT1cInJvd2hlYWRlclwiXScpLFxuICAgICAgICAgICAgc3ByZWFkc2hlZXRDb250YWluZXI6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNzaGVldHMtdmlld3BvcnQnKVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ0dvb2dsZSBTaGVldHMgRE9N57uT5p6EOicsIGVsZW1lbnRzKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOafpeaJvkdvb2dsZSBTaGVldHPnmoTlhoXpg6jlr7nosaFcbiAgICAgICAgY29uc3Qgc2hlZXRzQXBwID0gKHdpbmRvdyBhcyBhbnkpLlNIRUVUU19BUFAgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAod2luZG93IGFzIGFueSkuZ29vZ2xlPy5zaGVldHM/LmFwcCB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICh3aW5kb3cgYXMgYW55KS5TaGVldHNBcHA7XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygnR29vZ2xlIFNoZWV0c+W6lOeUqOWvueixoTonLCBzaGVldHNBcHApO1xuICAgICAgICBcbiAgICAgICAgLy8g5pi+56S66LCD6K+V5L+h5oGvXG4gICAgICAgIHNob3dUb2FzdCgnRE9N6LCD6K+V5L+h5oGv5bey6L6T5Ye65Yiw5o6n5Yi25Y+wJywgJ2luZm8nKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWIm+W7ukRPTeiwg+ivleWvueivneahhlxuICAgICAgICBjb25zdCBkaWFsb2cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgICAgIHdpZHRoOiA4MCU7XG4gICAgICAgICAgICBtYXgtd2lkdGg6IDgwMHB4O1xuICAgICAgICAgICAgbWF4LWhlaWdodDogODB2aDtcbiAgICAgICAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgICAgIGA7XG4gICAgICAgIFxuICAgICAgICAvLyDlpLTpg6jlkozlhbPpl63mjInpkq5cbiAgICAgICAgY29uc3QgaGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGhlYWRlci5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogc3BhY2UtYmV0d2VlbjtcbiAgICAgICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgICAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICAgICAgICBgO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpO1xuICAgICAgICB0aXRsZS50ZXh0Q29udGVudCA9ICdHb29nbGUgU2hlZXRzIERPTeiwg+ivlSc7XG4gICAgICAgIHRpdGxlLnN0eWxlLm1hcmdpbiA9ICcwJztcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGNsb3NlQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIGNsb3NlQnV0dG9uLnRleHRDb250ZW50ID0gJ8OXJztcbiAgICAgICAgY2xvc2VCdXR0b24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICAgICAgICBjb2xvcjogIzY2NjtcbiAgICAgICAgYDtcbiAgICAgICAgY2xvc2VCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgaGVhZGVyLmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgICAgICAgaGVhZGVyLmFwcGVuZENoaWxkKGNsb3NlQnV0dG9uKTtcbiAgICAgICAgZGlhbG9nLmFwcGVuZENoaWxkKGhlYWRlcik7XG4gICAgICAgIFxuICAgICAgICAvLyDosIPor5Xkv6Hmga/lhoXlrrlcbiAgICAgICAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBjb250ZW50LmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgIDxoND5ET03lhYPntKDnu5/orqE8L2g0PlxuICAgICAgICAgICAgPHVsPlxuICAgICAgICAgICAgICAgIDxsaT7ooajmoLzlhYPntKAodGFibGUpOiAke2VsZW1lbnRzLnRhYmxlcy5sZW5ndGh9PC9saT5cbiAgICAgICAgICAgICAgICA8bGk+572R5qC85YWD57SgKHJvbGU9XCJncmlkXCIpOiAke2VsZW1lbnRzLmdyaWRzLmxlbmd0aH08L2xpPlxuICAgICAgICAgICAgICAgIDxsaT7ljZXlhYPmoLzlhYPntKAocm9sZT1cImdyaWRjZWxsXCIpOiAke2VsZW1lbnRzLmNlbGxzLmxlbmd0aH08L2xpPlxuICAgICAgICAgICAgICAgIDxsaT7ljZXlhYPmoLzlhoXlrrnlhYPntKAoLmNlbGwtY29udGVudCk6ICR7ZWxlbWVudHMuY2VsbENvbnRlbnRzLmxlbmd0aH08L2xpPlxuICAgICAgICAgICAgICAgIDxsaT7ooYzlhYPntKAocm9sZT1cInJvd1wiKTogJHtlbGVtZW50cy5yb3dzLmxlbmd0aH08L2xpPlxuICAgICAgICAgICAgICAgIDxsaT7ooajlpLTlhYPntKA6ICR7ZWxlbWVudHMuaGVhZGVycy5sZW5ndGh9PC9saT5cbiAgICAgICAgICAgIDwvdWw+XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIDxoND7lu7rorq48L2g0PlxuICAgICAgICAgICAgPHA+6K+35Zyo5o6n5Yi25Y+w5Lit5p+l55yL5a6M5pW055qE6LCD6K+V5L+h5oGv44CC5aaC5p6c6KGo5qC85LiN6IO95q2j5bi46K+75Y+W77yM5oKo5Y+v5LulOjwvcD5cbiAgICAgICAgICAgIDxvbD5cbiAgICAgICAgICAgICAgICA8bGk+5bCd6K+V54K55Ye7XCLmiavmj4/lj6/op4HljZXlhYPmoLxcIuaMiemSrjwvbGk+XG4gICAgICAgICAgICAgICAgPGxpPuehruS/neW3sumAieS4reiHs+WwkeS4gOS4quWNleWFg+agvDwvbGk+XG4gICAgICAgICAgICAgICAgPGxpPuehruS/neihqOagvOW3suWujOWFqOWKoOi9vTwvbGk+XG4gICAgICAgICAgICA8L29sPlxuICAgICAgICBgO1xuICAgICAgICBcbiAgICAgICAgZGlhbG9nLmFwcGVuZENoaWxkKGNvbnRlbnQpO1xuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG4gICAgICAgIFxuICAgICAgICAvLyDpq5jkuq7mmL7npLrooajmoLzljLrln59cbiAgICAgICAgY29uc3QgaGlnaGxpZ2h0RWxlbWVudCA9IChzZWxlY3Rvcjogc3RyaW5nLCBjb2xvcjogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuICAgICAgICAgICAgZWxlbWVudHMuZm9yRWFjaChlbCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxCYWNrZ3JvdW5kID0gKGVsIGFzIEhUTUxFbGVtZW50KS5zdHlsZS5iYWNrZ3JvdW5kQ29sb3I7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxPdXRsaW5lID0gKGVsIGFzIEhUTUxFbGVtZW50KS5zdHlsZS5vdXRsaW5lO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIChlbCBhcyBIVE1MRWxlbWVudCkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gY29sb3I7XG4gICAgICAgICAgICAgICAgKGVsIGFzIEhUTUxFbGVtZW50KS5zdHlsZS5vdXRsaW5lID0gYDJweCBzb2xpZCAke2NvbG9yfWA7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIChlbCBhcyBIVE1MRWxlbWVudCkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gb3JpZ2luYWxCYWNrZ3JvdW5kO1xuICAgICAgICAgICAgICAgICAgICAoZWwgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLm91dGxpbmUgPSBvcmlnaW5hbE91dGxpbmU7XG4gICAgICAgICAgICAgICAgfSwgMzAwMCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIC8vIOmrmOS6ruS4jeWQjOeahOWFg+e0oOexu+Wei1xuICAgICAgICBoaWdobGlnaHRFbGVtZW50KCd0YWJsZScsICdyZ2JhKDI1NSwgMCwgMCwgMC4yKScpO1xuICAgICAgICBoaWdobGlnaHRFbGVtZW50KCdbcm9sZT1cImdyaWRcIl0nLCAncmdiYSgwLCAyNTUsIDAsIDAuMiknKTtcbiAgICAgICAgaGlnaGxpZ2h0RWxlbWVudCgnLmNlbGwtY29udGVudCwgLndhZmZsZS1jZWxsLWNvbnRlbnQnLCAncmdiYSgwLCAwLCAyNTUsIDAuMiknKTtcbiAgICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign6LCD6K+VRE9N57uT5p6E5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgc2hvd1RvYXN0KCfosIPor5Xov4fnqIvlh7rplJknLCAnZXJyb3InKTtcbiAgICB9XG59XG5cbi8vIOaJq+aPj+WPr+ingeWNleWFg+agvFxuZnVuY3Rpb24gc2NhblZpc2libGVDZWxscygpIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygn5byA5aeL5omr5o+P5Y+v6KeB5Y2V5YWD5qC8Li4uJyk7XG4gICAgICAgIFxuICAgICAgICAvLyAxLiDojrflj5bop4blj6PlsLrlr7hcbiAgICAgICAgY29uc3Qgdmlld3BvcnRXaWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICBjb25zdCB2aWV3cG9ydEhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKGDop4blj6PlsLrlr7g6ICR7dmlld3BvcnRXaWR0aH14JHt2aWV3cG9ydEhlaWdodH1gKTtcbiAgICAgICAgXG4gICAgICAgIC8vIDIuIOWIm+W7uuS4gOS4quimhuebluWxguadpeaYvuekuuaJq+aPj+i/m+W6plxuICAgICAgICBjb25zdCBvdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIG92ZXJsYXkuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgICAgIHRvcDogMDtcbiAgICAgICAgICAgIGxlZnQ6IDA7XG4gICAgICAgICAgICB3aWR0aDogMTAwJTtcbiAgICAgICAgICAgIGhlaWdodDogMTAwJTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHJnYmEoMCwgMCwgMCwgMC43KTtcbiAgICAgICAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogMjBweDtcbiAgICAgICAgYDtcbiAgICAgICAgb3ZlcmxheS5pbm5lckhUTUwgPSBgPGRpdj7miavmj4/ljZXlhYPmoLzkuK0uLi4gPHNwYW4gaWQ9XCJzY2FuLXByb2dyZXNzXCI+MCU8L3NwYW4+PC9kaXY+YDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdmVybGF5KTtcbiAgICAgICAgXG4gICAgICAgIC8vIDMuIOiOt+WPluihqOagvOWuueWZqFxuICAgICAgICBjb25zdCBzaGVldHNDb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc2hlZXRzLXZpZXdwb3J0JykgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW3JvbGU9XCJncmlkXCJdJykgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keTtcbiAgICAgICAgXG4gICAgICAgIC8vIDQuIOWIm+W7uue7k+aenOWtmOWCqOWZqFxuICAgICAgICBjb25zdCBjZWxsc0RhdGE6IHt0ZXh0OiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyLCBlbGVtZW50OiBIVE1MRWxlbWVudH1bXSA9IFtdO1xuICAgICAgICBcbiAgICAgICAgLy8gNS4g5omn6KGM5omr5o+PXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgLy8g5L2/55So5rex5bqm5LyY5YWI5pCc57Si6YGN5Y6GRE9NXG4gICAgICAgICAgICBjb25zdCB3YWxrRE9NID0gKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBkZXB0aCA9IDApID0+IHtcbiAgICAgICAgICAgICAgICAvLyDmo4Dmn6XmmK/lkKblj6/og73mmK/ljZXlhYPmoLxcbiAgICAgICAgICAgICAgICBjb25zdCBtYXliZUNlbGwgPSBpc0NlbGxFbGVtZW50KGVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIOiOt+WPluWFg+e0oOWcqOmhtemdouS4iueahOS9jee9rlxuICAgICAgICAgICAgICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzVmlzaWJsZSA9IHJlY3Qud2lkdGggPiAwICYmIHJlY3QuaGVpZ2h0ID4gMCAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlY3QucmlnaHQgPiAwICYmIHJlY3QubGVmdCA8IHZpZXdwb3J0V2lkdGggJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlY3QuYm90dG9tID4gMCAmJiByZWN0LnRvcCA8IHZpZXdwb3J0SGVpZ2h0O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIOWmguaenOaYr+WPr+ingeeahOWNleWFg+agvOWFg+e0oO+8jOiusOW9leWFtuS/oeaBr1xuICAgICAgICAgICAgICAgIGlmIChtYXliZUNlbGwgJiYgaXNWaXNpYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleHQgPSBlbGVtZW50LnRleHRDb250ZW50IHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICBpZiAodGV4dC50cmltKCkpIHsgLy8g5Y+q6K6w5b2V6Z2e56m65Y2V5YWD5qC8XG4gICAgICAgICAgICAgICAgICAgICAgICBjZWxsc0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dDogdGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB4OiByZWN0LmxlZnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeTogcmVjdC50b3AsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudDogZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g6YCS5b2S5aSE55CG5a2Q5YWD57SgXG4gICAgICAgICAgICAgICAgaWYgKGRlcHRoIDwgMTApIHsgLy8g6ZmQ5Yi26YCS5b2S5rex5bqmXG4gICAgICAgICAgICAgICAgICAgIEFycmF5LmZyb20oZWxlbWVudC5jaGlsZHJlbikuZm9yRWFjaChjaGlsZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3YWxrRE9NKGNoaWxkIGFzIEhUTUxFbGVtZW50LCBkZXB0aCArIDEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDmo4Dmn6XlhYPntKDmmK/lkKblj6/og73mmK/ljZXlhYPmoLxcbiAgICAgICAgICAgIGNvbnN0IGlzQ2VsbEVsZW1lbnQgPSAoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBib29sZWFuID0+IHtcbiAgICAgICAgICAgICAgICAvLyDmo4Dmn6XluLjop4HnmoTljZXlhYPmoLznibnlvoFcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ3JvbGUnKSA9PT0gJ2dyaWRjZWxsJykgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdjZWxsLWNvbnRlbnQnKSkgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCd3YWZmbGUtY2VsbC1jb250ZW50JykpIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIOajgOafpeWFg+e0oOagt+W8j+eJueW+gVxuICAgICAgICAgICAgICAgIGNvbnN0IHN0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0eWxlLmRpc3BsYXkgPT09ICd0YWJsZS1jZWxsJykgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g5qOA5p+l5YWD57Sg5bC65a+45piv5ZCm5YOP5Y2V5YWD5qC8XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlY3Qud2lkdGggPiAyMCAmJiByZWN0LndpZHRoIDwgMzAwICYmIFxuICAgICAgICAgICAgICAgICAgICByZWN0LmhlaWdodCA+IDE1ICYmIHJlY3QuaGVpZ2h0IDwgMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuacieaWh+acrOWGheWuueWSjOi+ueahhlxuICAgICAgICAgICAgICAgICAgICBpZiAoKGVsZW1lbnQudGV4dENvbnRlbnQgfHwgJycpLnRyaW0oKSAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAgIChzdHlsZS5ib3JkZXIgfHwgc3R5bGUuYm9yZGVyQm90dG9tIHx8IHN0eWxlLmJvcmRlclJpZ2h0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5omn6KGM5omr5o+PXG4gICAgICAgICAgICB3YWxrRE9NKHNoZWV0c0NvbnRhaW5lciBhcyBIVE1MRWxlbWVudCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGDmiavmj4/lrozmiJDvvIzmib7liLAgJHtjZWxsc0RhdGEubGVuZ3RofSDkuKrlj6/og73nmoTljZXlhYPmoLxgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gNi4g5aSE55CG5omr5o+P57uT5p6cXG4gICAgICAgICAgICBpZiAoY2VsbHNEYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyDmjInlnoLnm7TkvY3nva7mjpLluo/vvIznjJzmtYvooYxcbiAgICAgICAgICAgICAgICBjZWxsc0RhdGEuc29ydCgoYSwgYikgPT4gYS55IC0gYi55KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDlsJ3or5Xor4bliKvooYxcbiAgICAgICAgICAgICAgICBjb25zdCByb3dUaHJlc2hvbGQgPSAxMDsgLy8g5ZCM5LiA6KGM55qE5Y2V5YWD5qC85Z6C55u05L2N572u5beu5byC5bqU5bCP5LqO6L+Z5Liq5YC8XG4gICAgICAgICAgICAgICAgY29uc3Qgcm93czogdHlwZW9mIGNlbGxzRGF0YVtdID0gW107XG4gICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRSb3c6IHR5cGVvZiBjZWxsc0RhdGEgPSBbXTtcbiAgICAgICAgICAgICAgICBsZXQgbGFzdFkgPSBjZWxsc0RhdGFbMF0ueTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjZWxsc0RhdGEuZm9yRWFjaChjZWxsID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKE1hdGguYWJzKGNlbGwueSAtIGxhc3RZKSA+IHJvd1RocmVzaG9sZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5byA5aeL5paw55qE5LiA6KGMXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJvdy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5wdXNoKGN1cnJlbnRSb3cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnRSb3cgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RZID0gY2VsbC55O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRSb3cucHVzaChjZWxsKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDmt7vliqDmnIDlkI7kuIDooYxcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFJvdy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJvd3MucHVzaChjdXJyZW50Um93KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g5oyJ5rC05bmz5L2N572u5o6S5bqP5q+P5LiA6KGMXG4gICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJvdy5zb3J0KChhLCBiKSA9PiBhLnggLSBiLngpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDor4bliKvlh7ogJHtyb3dzLmxlbmd0aH0g6KGM5pWw5o2uYCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g6L2s5o2i5Li65LqM57u05pWw57uE5qC85byPXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHJvd3MubWFwKHJvdyA9PiByb3cubWFwKGNlbGwgPT4gY2VsbC50ZXh0KSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+acgOe7iOaVsOaNrjonLCBkYXRhKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDkv53lrZjlubbmmL7npLrnu5PmnpxcbiAgICAgICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoe1xuICAgICAgICAgICAgICAgICAgICBzaGVldERhdGE6IEpTT04uc3RyaW5naWZ5KGRhdGEpXG4gICAgICAgICAgICAgICAgfSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKG92ZXJsYXkpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoYOaIkOWKn+ivu+WPluihqOagvOaVsOaNru+8jOWFsSAke2RhdGEubGVuZ3RofSDooYxgLCAnc3VjY2VzcycpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8g5pi+56S65LiA5Liq566A5Y2V55qE6aKE6KeIXG4gICAgICAgICAgICAgICAgICAgIHNob3dUYWJsZVByZXZpZXcoZGF0YSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQob3ZlcmxheSk7XG4gICAgICAgICAgICAgICAgc2hvd1RvYXN0KCfmnKrog73or4bliKvku7vkvZXljZXlhYPmoLzmlbDmja4nLCAnZXJyb3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgMTAwKTtcbiAgICAgICAgXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign5omr5o+P5Y2V5YWD5qC85aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOehruS/neenu+mZpOimhuebluWxglxuICAgICAgICBjb25zdCBvdmVybGF5ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZGl2W3N0eWxlKj1cInBvc2l0aW9uOiBmaXhlZFwiXVtzdHlsZSo9XCJ6LWluZGV4OiAxMDAwMFwiXScpO1xuICAgICAgICBpZiAob3ZlcmxheSAmJiBvdmVybGF5LnBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgIG92ZXJsYXkucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChvdmVybGF5KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgc2hvd1RvYXN0KCfmiavmj4/ov4fnqIvlh7rplJknLCAnZXJyb3InKTtcbiAgICB9XG59XG5cbi8vIOaYvuekuuihqOagvOmihOiniFxuZnVuY3Rpb24gc2hvd1RhYmxlUHJldmlldyhkYXRhOiBzdHJpbmdbXVtdKSB7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgd2lkdGg6IDgwJTtcbiAgICAgICAgbWF4LXdpZHRoOiA4MDBweDtcbiAgICAgICAgbWF4LWhlaWdodDogODB2aDtcbiAgICAgICAgb3ZlcmZsb3cteTogYXV0bztcbiAgICBgO1xuICAgIFxuICAgIC8vIOagh+mimOWSjOWFs+mXreaMiemSrlxuICAgIGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGhlYWRlci5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDE1cHg7XG4gICAgYDtcbiAgICBcbiAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyk7XG4gICAgdGl0bGUudGV4dENvbnRlbnQgPSAn6KGo5qC85pWw5o2u6aKE6KeIJztcbiAgICB0aXRsZS5zdHlsZS5tYXJnaW4gPSAnMCc7XG4gICAgXG4gICAgY29uc3QgY2xvc2VCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBjbG9zZUJ1dHRvbi50ZXh0Q29udGVudCA9ICfDlyc7XG4gICAgY2xvc2VCdXR0b24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgYmFja2dyb3VuZDogbm9uZTtcbiAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgY29sb3I6ICM2NjY7XG4gICAgYDtcbiAgICBjbG9zZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgIH0pO1xuICAgIFxuICAgIGhlYWRlci5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gICAgaGVhZGVyLmFwcGVuZENoaWxkKGNsb3NlQnV0dG9uKTtcbiAgICBkaWFsb2cuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcbiAgICBcbiAgICAvLyDliJvlu7rooajmoLzpooTop4hcbiAgICBjb25zdCB0YWJsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RhYmxlJyk7XG4gICAgdGFibGUuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgd2lkdGg6IDEwMCU7XG4gICAgICAgIGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7XG4gICAgYDtcbiAgICBcbiAgICAvLyDmt7vliqDooajlpLTvvIjlpoLmnpzmnInvvIlcbiAgICBpZiAoZGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IHRoZWFkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGhlYWQnKTtcbiAgICAgICAgY29uc3QgaGVhZGVyUm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndHInKTtcbiAgICAgICAgXG4gICAgICAgIGRhdGFbMF0uZm9yRWFjaChjZWxsID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGgnKTtcbiAgICAgICAgICAgIHRoLnRleHRDb250ZW50ID0gY2VsbDtcbiAgICAgICAgICAgIHRoLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgICAgICAgICAgcGFkZGluZzogOHB4O1xuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6ICNmMmYyZjI7XG4gICAgICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgI2RkZDtcbiAgICAgICAgICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xuICAgICAgICAgICAgYDtcbiAgICAgICAgICAgIGhlYWRlclJvdy5hcHBlbmRDaGlsZCh0aCk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGhlYWQuYXBwZW5kQ2hpbGQoaGVhZGVyUm93KTtcbiAgICAgICAgdGFibGUuYXBwZW5kQ2hpbGQodGhlYWQpO1xuICAgIH1cbiAgICBcbiAgICAvLyDmt7vliqDooajmoLzlhoXlrrlcbiAgICBjb25zdCB0Ym9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3Rib2R5Jyk7XG4gICAgXG4gICAgLy8g5aaC5p6c5pyJ6KGo5aS077yM5LuO56ys5LqM6KGM5byA5aeL5re75Yqg5pWw5o2uXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJyk7XG4gICAgICAgIFxuICAgICAgICBkYXRhW2ldLmZvckVhY2goY2VsbCA9PiB7XG4gICAgICAgICAgICBjb25zdCB0ZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJyk7XG4gICAgICAgICAgICB0ZC50ZXh0Q29udGVudCA9IGNlbGw7XG4gICAgICAgICAgICB0ZC5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgICAgICAgIHBhZGRpbmc6IDhweDtcbiAgICAgICAgICAgICAgICBib3JkZXI6IDFweCBzb2xpZCAjZGRkO1xuICAgICAgICAgICAgYDtcbiAgICAgICAgICAgIHJvdy5hcHBlbmRDaGlsZCh0ZCk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdGJvZHkuYXBwZW5kQ2hpbGQocm93KTtcbiAgICB9XG4gICAgXG4gICAgdGFibGUuYXBwZW5kQ2hpbGQodGJvZHkpO1xuICAgIGRpYWxvZy5hcHBlbmRDaGlsZCh0YWJsZSk7XG4gICAgXG4gICAgLy8g5re75Yqg5oyJ6ZKuXG4gICAgY29uc3QgYnV0dG9uQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgYnV0dG9uQ29udGFpbmVyLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIG1hcmdpbi10b3A6IDE1cHg7XG4gICAgICAgIHRleHQtYWxpZ246IHJpZ2h0O1xuICAgIGA7XG4gICAgXG4gICAgY29uc3QgYW5hbHl6ZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgIGFuYWx5emVCdXR0b24udGV4dENvbnRlbnQgPSAn5YiG5p6Q5pWw5o2uJztcbiAgICBhbmFseXplQnV0dG9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBhZGRpbmc6IDhweCAxNXB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiAjMDA3M2U2O1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgYDtcbiAgICBhbmFseXplQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgIHNob3dEYXRhQW5hbHlzaXNEaWFsb2coZGF0YSk7XG4gICAgfSk7XG4gICAgXG4gICAgYnV0dG9uQ29udGFpbmVyLmFwcGVuZENoaWxkKGFuYWx5emVCdXR0b24pO1xuICAgIGRpYWxvZy5hcHBlbmRDaGlsZChidXR0b25Db250YWluZXIpO1xuICAgIFxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcbn1cblxuLy8g5b2T5paH5qGj5Yqg6L295a6M5oiQ5pe25Yid5aeL5YyWXG5pZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2NvbXBsZXRlJykge1xuICAgIGluaXRpYWxpemUoKTtcbn0gZWxzZSB7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBpbml0aWFsaXplKTtcbn1cblxuLy8g5Yib5bu6IEpRTCDmn6Xor6Llr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIG9wZW5KcWxEaWFsb2coKSB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgIGA7XG5cbiAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwO1wiPui+k+WFpSBKUUwg5p+l6K+iPC9oMz5cbiAgICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj48L3RleHRhcmVhPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcIj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxcIiBzdHlsZT1cIm1hcmdpbi1yaWdodDogMTBweDtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzdWJtaXRcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgYDtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgIC8vIOa3u+WKoOS6i+S7tuebkeWQrOWZqFxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWwnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJtaXQnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGpxbCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanFsJykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XG4gICAgICAgIGlmIChqcWwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGlja2V0cycsIHRpY2tldHMpO1xuICAgICAgICAgICAgICAgIGlmICh0aWNrZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmllbGRzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGZpZWxkcy5qb2luKCdcXHQnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkRGF0YSA9IFtoZWFkZXJzLCAuLi50aWNrZXRzLm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgXG4gICAgICAgICAgICAgICAgICAgICAgfSkpLm1hcCh0aWNrZXQgPT4gZmllbGRzLm1hcChmaWVsZCA9PiB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0pLmpvaW4oJ1xcdCcpKV0uam9pbignXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkRGF0YScsIGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0ppcmEg5pWw5o2u5bey5aSN5Yi25Yiw5Ymq6LS05p2/Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDlsJ3or5Xnm7TmjqXlnKjlvZPliY3miZPlvIDnmoRHb29nbGUgU2hlZXRz5Lit5o+S5YWl5pWw5o2uXG4gICAgICAgICAgICAgICAgaW5zZXJ0VGlja2V0c1RvQWN0aXZlU2hlZXQodGlja2V0cywgZW52Q29uZmlnKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgYWxlcnQoJ+afpeivouWksei0pTogJyArIGVycm9yKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG4vLyDnm7TmjqXlnKjlvZPliY3miZPlvIDnmoRHb29nbGUgU2hlZXRz5Lit5o+S5YWl5pWw5o2uXG5hc3luYyBmdW5jdGlvbiBpbnNlcnRUaWNrZXRzVG9BY3RpdmVTaGVldCh0aWNrZXRzOiBKaXJhVGlja2V0W10sIGVudkNvbmZpZzogYW55KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKCF0aWNrZXRzIHx8IHRpY2tldHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+ayoeacieaVsOaNruWPr+aPkuWFpScpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coJ+WHhuWkh+WQkUdvb2dsZSBTaGVldHPkuK3mj5LlhaXmlbDmja4uLi4nKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOiOt+WPlua0u+WKqOWNleWFg+agvFxuICAgICAgICBjb25zdCBhY3RpdmVDZWxsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2FyaWEtc2VsZWN0ZWQ9XCJ0cnVlXCJdJyk7XG4gICAgICAgIGlmICghYWN0aXZlQ2VsbCkge1xuICAgICAgICAgICAgLy8g5aaC5p6c5rKh5pyJ6YCJ5oup55qE5Y2V5YWD5qC877yM5byV5a+855So5oi36YCJ5oup5LiA5Liq5Y2V5YWD5qC8XG4gICAgICAgICAgICBzaG93R3VpZGVEaWFsb2codGlja2V0cywgZW52Q29uZmlnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5bCd6K+V5L2/55SoR29vZ2xlIFNoZWV0cyBET00gQVBJ55u05o6l5o+S5YWl5pWw5o2uXG4gICAgICAgIGlmIChhd2FpdCBpbnNlcnREYXRhVmlhU2hlZXRzRG9tQXBpKHRpY2tldHMsIGVudkNvbmZpZykpIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pWw5o2u5bey5oiQ5Yqf5o+S5YWl6KGo5qC8JywgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5aaC5p6c55u05o6l5o+S5YWl5aSx6LSl77yM5Zue6YCA5Yiw5Ymq6LS05p2/5pa55rOVXG4gICAgICAgIC8vIOaYvuW8j+inpuWPkeWkjeWItumAieS4reeahOihqOWktO+8iOWmguaenOacie+8iVxuICAgICAgICBhd2FpdCBjb3B5U2VsZWN0ZWRIZWFkZXJzKCk7XG4gICAgICAgIFxuICAgICAgICAvLyDmo4Dmn6XmmK/lkKblrZjlnKjooajlpLRcbiAgICAgICAgY29uc3QgZXhpc3RpbmdIZWFkZXJzID0gYXdhaXQgZ2V0RXhpc3RpbmdIZWFkZXJzKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfojrflj5bliLDnmoTooajlpLQ6JywgZXhpc3RpbmdIZWFkZXJzKTtcbiAgICAgICAgXG4gICAgICAgIGxldCBmaWVsZHMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICBsZXQgdXNlRXhpc3RpbmdIZWFkZXJzID0gZmFsc2U7XG4gICAgICAgIFxuICAgICAgICBpZiAoZXhpc3RpbmdIZWFkZXJzICYmIGV4aXN0aW5nSGVhZGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygn5qOA5rWL5Yiw546w5pyJ6KGo5aS0OicsIGV4aXN0aW5nSGVhZGVycyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOWinuW8uuihqOWktOWMuemFjemAu+i+kVxuICAgICAgICAgICAgY29uc3QgdmFsaWRIZWFkZXJzID0gZmluZFZhbGlkSmlyYUhlYWRlcnMoZXhpc3RpbmdIZWFkZXJzLCB0aWNrZXRzWzBdKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHZhbGlkSGVhZGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZmllbGRzID0gdmFsaWRIZWFkZXJzO1xuICAgICAgICAgICAgICAgIHVzZUV4aXN0aW5nSGVhZGVycyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+S9v+eUqOeOsOacieihqOWktDonLCBmaWVsZHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ+aJvuS4jeWIsOacieaViOeahEppcmHlrZfmrrXljLnphY3vvIzlsIbkvb/nlKjpu5jorqTlrZfmrrUnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5qih5ouf57KY6LS05pON5L2cIC0g6aaW5YWI5bCG5qC85byP5YyW55qE5pWw5o2u5L+d5a2Y5Yiw5Ymq6LS05p2/XG4gICAgICAgIGxldCBmb3JtYXR0ZWREYXRhO1xuICAgICAgICBcbiAgICAgICAgaWYgKHVzZUV4aXN0aW5nSGVhZGVycykge1xuICAgICAgICAgICAgLy8g5LuF5L2/55So5pWw5o2u77yM5LiN5YyF5ZCr6KGo5aS0XG4gICAgICAgICAgICBmb3JtYXR0ZWREYXRhID0gdGlja2V0cy5tYXAodGlja2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAgICAgIGtleTogYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgXG4gICAgICAgICAgICB9KSkubWFwKHRpY2tldCA9PiBmaWVsZHMubWFwKGhlYWRlciA9PiB7XG4gICAgICAgICAgICAgICAgLy8g5bCd6K+V5LiN5ZCM55qE5a2X5q615ZCN56ew5qC85byP77yI5Y6f5aeL5qC85byP44CB5bCP5YaZ44CB5peg56m65qC877yJXG4gICAgICAgICAgICAgICAgY29uc3QgZmllbGROYW1lID0gaGVhZGVyLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gdGlja2V0W2ZpZWxkTmFtZSBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tldFtmaWVsZE5hbWUucmVwbGFjZSgvXFxzKy9nLCAnJykgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnJztcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5pig5bCE5a2X5q61ICR7aGVhZGVyfSAtPiAke2ZpZWxkTmFtZX0sIOWAvDpgLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICAgICAgfSkuam9pbignXFx0JykpLmpvaW4oJ1xcbicpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8g5YyF5ZCr6KGo5aS05ZKM5pWw5o2uXG4gICAgICAgICAgICBjb25zdCBoZWFkZXJzID0gZmllbGRzLmpvaW4oJ1xcdCcpO1xuICAgICAgICAgICAgZm9ybWF0dGVkRGF0YSA9IFtoZWFkZXJzLCAuLi50aWNrZXRzLm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICAgICAga2V5OiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWBcbiAgICAgICAgICAgIH0pKS5tYXAodGlja2V0ID0+IGZpZWxkcy5tYXAoZmllbGQgPT4gdGlja2V0W2ZpZWxkIGFzIGtleW9mIEppcmFUaWNrZXRdKS5qb2luKCdcXHQnKSldLmpvaW4oJ1xcbicpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zb2xlLmxvZygn5qC85byP5YyW5pWw5o2u5qC35L6LOicsIGZvcm1hdHRlZERhdGEuc3BsaXQoJ1xcbicpWzBdKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWwhuaVsOaNruWkjeWItuWIsOWJqui0tOadv1xuICAgICAgICBhd2FpdCBjb3B5VG9DbGlwYm9hcmQoZm9ybWF0dGVkRGF0YSk7XG4gICAgICAgIFxuICAgICAgICAvLyDmqKHmi5/nspjotLTmk43kvZxcbiAgICAgICAgaWYgKCFhdHRlbXB0QXV0b1Bhc3RlKGFjdGl2ZUNlbGwpKSB7XG4gICAgICAgICAgICAvLyDlpoLmnpzoh6rliqjnspjotLTlpLHotKXvvIzmj5DnpLrnlKjmiLfmiYvliqjnspjotLRcbiAgICAgICAgICAgIHNob3dQYXN0ZUluc3RydWN0aW9ucygpO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign5o+S5YWl5pWw5o2u5Yiw6KGo5qC85aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgc2hvd1RvYXN0KCfmj5LlhaXmlbDmja7lpLHotKXvvIzor7fmo4Dmn6XmjqfliLblj7DplJnor68nLCAnZXJyb3InKTtcbiAgICB9XG59XG5cbi8vIOWwneivleS9v+eUqEdvb2dsZSBTaGVldHMgRE9NIEFQSeebtOaOpeaPkuWFpeaVsOaNrlxuYXN5bmMgZnVuY3Rpb24gaW5zZXJ0RGF0YVZpYVNoZWV0c0RvbUFwaSh0aWNrZXRzOiBKaXJhVGlja2V0W10sIGVudkNvbmZpZzogYW55KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc29sZS5sb2coJ+WwneivleS9v+eUqEdvb2dsZSBTaGVldHMgRE9NIEFQSeaPkuWFpeaVsOaNri4uLicpO1xuICAgICAgICBcbiAgICAgICAgLy8g5qOA5p+l5piv5ZCm5ZyoR29vZ2xlIFNoZWV0c+eOr+Wig+S4rVxuICAgICAgICBpZiAoIXdpbmRvdy5sb2NhdGlvbi5ocmVmLmluY2x1ZGVzKCdkb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzJykpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybign6Z2eR29vZ2xlIFNoZWV0c+eOr+Wig++8jOaXoOazleS9v+eUqERPTSBBUEknKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g6I635Y+W5rS75Yqo5Y2V5YWD5qC85L2N572uXG4gICAgICAgIGNvbnN0IGFjdGl2ZUNlbGwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbYXJpYS1zZWxlY3RlZD1cInRydWVcIl0nKSBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgaWYgKCFhY3RpdmVDZWxsKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+acquaJvuWIsOa0u+WKqOWNleWFg+agvCcpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDlsJ3or5Xojrflj5bljZXlhYPmoLzlnZDmoIdcbiAgICAgICAgY29uc3QgY2VsbENvb3JkaW5hdGVzID0gZ2V0Q2VsbENvb3JkaW5hdGVzKGFjdGl2ZUNlbGwpO1xuICAgICAgICBpZiAoIWNlbGxDb29yZGluYXRlcykge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfml6Dms5Xojrflj5bljZXlhYPmoLzlnZDmoIcnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ+W9k+WJjea0u+WKqOWNleWFg+agvOWdkOaghzonLCBjZWxsQ29vcmRpbmF0ZXMpO1xuICAgICAgICBcbiAgICAgICAgLy8g6I635Y+W6KGo5aS0XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBhd2FpdCBnZXRFeGlzdGluZ0hlYWRlcnMoKTtcbiAgICAgICAgY29uc3QgZmllbGRzID0gaGVhZGVycyAmJiBoZWFkZXJzLmxlbmd0aCA+IDAgXG4gICAgICAgICAgICA/IGZpbmRWYWxpZEppcmFIZWFkZXJzKGhlYWRlcnMsIHRpY2tldHNbMF0pIFxuICAgICAgICAgICAgOiBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICBcbiAgICAgICAgY29uc29sZS5sb2coJ+WwhuS9v+eUqOS7peS4i+Wtl+autTonLCBmaWVsZHMpO1xuICAgICAgICBcbiAgICAgICAgLy8g6K6/6ZeuR29vZ2xlIFNoZWV0c+W6lOeUqOWunuS+i1xuICAgICAgICAvLyDms6jmhI/vvJrov5nmmK/kuIDnp43or5XmjqLmgKfmlrnms5XvvIzkvp3otZbkuo5Hb29nbGUgU2hlZXRz55qE5YaF6YOoQVBJXG4gICAgICAgIGNvbnN0IHNoZWV0c0FwcCA9IGdldFNoZWV0c0FwcEluc3RhbmNlKCk7XG4gICAgICAgIGlmICghc2hlZXRzQXBwKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ+aXoOazleiuv+mXrkdvb2dsZSBTaGVldHPlupTnlKjlrp7kvosnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5bCd6K+V5o+S5YWl5pWw5o2uXG4gICAgICAgIGlmICh0eXBlb2Ygc2hlZXRzQXBwLmluc2VydERhdGEgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdHRlZERhdGEgPSB0aWNrZXRzLm1hcCh0aWNrZXQgPT4gXG4gICAgICAgICAgICAgICAgZmllbGRzLm1hcChmaWVsZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWVsZCA9PT0gJ2tleScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRpY2tldFtmaWVsZCBhcyBrZXlvZiBKaXJhVGlja2V0XSB8fCAnJztcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc2hlZXRzQXBwLmluc2VydERhdGEoY2VsbENvb3JkaW5hdGVzLnJvdywgY2VsbENvb3JkaW5hdGVzLmNvbCwgZm9ybWF0dGVkRGF0YSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygn6YCa6L+HU2hlZXRz5bqU55So5a6e5L6L5oiQ5Yqf5o+S5YWl5pWw5o2uJyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5aaC5p6c5peg5rOV55u05o6l5o+S5YWl77yM5bCd6K+V6Kem5Y+R5pys5py65LqL5Lu2XG4gICAgICAgIGlmIChpbmplY3REYXRhVmlhTmF0aXZlRXZlbnRzKGFjdGl2ZUNlbGwsIHRpY2tldHMsIGZpZWxkcywgZW52Q29uZmlnKSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ+mAmui/h+acrOacuuS6i+S7tuaIkOWKn+aPkuWFpeaVsOaNricpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUud2Fybign5peg5rOV5L2/55SoR29vZ2xlIFNoZWV0cyBET00gQVBJ5o+S5YWl5pWw5o2uJyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfkvb/nlKhHb29nbGUgU2hlZXRzIERPTSBBUEnmj5LlhaXmlbDmja7lpLHotKU6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vLyDojrflj5bljZXlhYPmoLzlnZDmoIdcbmZ1bmN0aW9uIGdldENlbGxDb29yZGluYXRlcyhjZWxsOiBIVE1MRWxlbWVudCk6IHtyb3c6IG51bWJlciwgY29sOiBudW1iZXJ9IHwgbnVsbCB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g5bCd6K+V5LuO5Y2V5YWD5qC85bGe5oCn5oiW5pWw5o2u5bGe5oCn5Lit6I635Y+W5Z2Q5qCHXG4gICAgICAgIGNvbnN0IHJvd0F0dHIgPSBjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1yb3ctaW5kZXgnKSB8fCBjZWxsLmdldEF0dHJpYnV0ZSgncm93LWluZGV4Jyk7XG4gICAgICAgIGNvbnN0IGNvbEF0dHIgPSBjZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1jb2wtaW5kZXgnKSB8fCBjZWxsLmdldEF0dHJpYnV0ZSgnY29sLWluZGV4Jyk7XG4gICAgICAgIFxuICAgICAgICBpZiAocm93QXR0ciAmJiBjb2xBdHRyKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHJvdzogcGFyc2VJbnQocm93QXR0ciwgMTApLFxuICAgICAgICAgICAgICAgIGNvbDogcGFyc2VJbnQoY29sQXR0ciwgMTApXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDlsJ3or5Xku47moLflvI/kuK3op6PmnpDlnZDmoIdcbiAgICAgICAgY29uc3Qgc3R5bGUgPSBjZWxsLmdldEF0dHJpYnV0ZSgnc3R5bGUnKTtcbiAgICAgICAgaWYgKHN0eWxlKSB7XG4gICAgICAgICAgICBjb25zdCByb3dNYXRjaCA9IHN0eWxlLm1hdGNoKC90b3A6XFxzKihcXGQrKXB4Lyk7XG4gICAgICAgICAgICBjb25zdCBjb2xNYXRjaCA9IHN0eWxlLm1hdGNoKC9sZWZ0OlxccyooXFxkKylweC8pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAocm93TWF0Y2ggJiYgY29sTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAvLyDov5nph4zpnIDopoHmoLnmja7lrp7pmYXnmoTljZXlhYPmoLzlpKflsI/ov5vooYzosIPmlbRcbiAgICAgICAgICAgICAgICBjb25zdCByb3dIZWlnaHQgPSAyMTsgLy8g6buY6K6k6KGM6auYXG4gICAgICAgICAgICAgICAgY29uc3QgY29sV2lkdGggPSAxMjA7IC8vIOm7mOiupOWIl+WuvVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHJvdzogTWF0aC5mbG9vcihwYXJzZUludChyb3dNYXRjaFsxXSwgMTApIC8gcm93SGVpZ2h0KSxcbiAgICAgICAgICAgICAgICAgICAgY29sOiBNYXRoLmZsb29yKHBhcnNlSW50KGNvbE1hdGNoWzFdLCAxMCkgLyBjb2xXaWR0aClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDlsJ3or5Xku47niLblhYPntKDmiJblhbPogZTlhYPntKDojrflj5blnZDmoIdcbiAgICAgICAgY29uc3QgcGFyZW50ID0gY2VsbC5jbG9zZXN0KCdbZGF0YS1yb3ctaW5kZXhdLCBbZGF0YS1jb2wtaW5kZXhdJyk7XG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJvd0F0dHIgPSBwYXJlbnQuZ2V0QXR0cmlidXRlKCdkYXRhLXJvdy1pbmRleCcpO1xuICAgICAgICAgICAgY29uc3QgY29sQXR0ciA9IHBhcmVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtY29sLWluZGV4Jyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChyb3dBdHRyICYmIGNvbEF0dHIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByb3c6IHBhcnNlSW50KHJvd0F0dHIsIDEwKSxcbiAgICAgICAgICAgICAgICAgICAgY29sOiBwYXJzZUludChjb2xBdHRyLCAxMClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfojrflj5bljZXlhYPmoLzlnZDmoIflpLHotKU6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8vIOiOt+WPlkdvb2dsZSBTaGVldHPlupTnlKjlrp7kvotcbmZ1bmN0aW9uIGdldFNoZWV0c0FwcEluc3RhbmNlKCk6IGFueSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g5bCd6K+V6YCa6L+H5YWo5bGA5Y+Y6YeP6K6/6ZeuU2hlZXRz5bqU55So5a6e5L6LXG4gICAgICAgIC8vIOazqOaEj++8mui/meaYr+WfuuS6jkdvb2dsZSBTaGVldHPlhoXpg6jlrp7njrDnmoTor5XmjqLmgKfmlrnms5VcbiAgICAgICAgcmV0dXJuICh3aW5kb3cgYXMgYW55KS5TSEVFVFNfQVBQIHx8IFxuICAgICAgICAgICAgICAgKHdpbmRvdyBhcyBhbnkpLmdvb2dsZT8uc2hlZXRzPy5hcHAgfHwgXG4gICAgICAgICAgICAgICAod2luZG93IGFzIGFueSkuU2hlZXRzQXBwIHx8IFxuICAgICAgICAgICAgICAgbnVsbDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfojrflj5ZTaGVldHPlupTnlKjlrp7kvovlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8vIOmAmui/h+acrOacuuS6i+S7tuazqOWFpeaVsOaNrlxuZnVuY3Rpb24gaW5qZWN0RGF0YVZpYU5hdGl2ZUV2ZW50cyhhY3RpdmVDZWxsOiBIVE1MRWxlbWVudCwgdGlja2V0czogSmlyYVRpY2tldFtdLCBmaWVsZHM6IHN0cmluZ1tdLCBlbnZDb25maWc6IGFueSk6IGJvb2xlYW4ge1xuICAgIHRyeSB7XG4gICAgICAgIC8vIOWIm+W7uuaVsOaNrui+k+WFpeS6i+S7tlxuICAgICAgICAvLyDov5nmmK/kuIDnp43or5XmjqLmgKfmlrnms5XvvIzmqKHmi5/nlKjmiLflnKjljZXlhYPmoLzkuK3ovpPlhaXmlbDmja5cbiAgICAgICAgY29uc3Qgc3RhcnRFZGl0ID0gbmV3IE1vdXNlRXZlbnQoJ2RibGNsaWNrJywge1xuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNhbmNlbGFibGU6IHRydWUsXG4gICAgICAgICAgICB2aWV3OiB3aW5kb3dcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBhY3RpdmVDZWxsLmRpc3BhdGNoRXZlbnQoc3RhcnRFZGl0KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOajgOafpeaYr+WQpui/m+WFpee8lui+keaooeW8j1xuICAgICAgICBjb25zdCBlZGl0Qm94ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNlbGwtaW5wdXQsIC53YWZmbGUtZm9ybXVsYS1pbnB1dCcpO1xuICAgICAgICBpZiAoIWVkaXRCb3gpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybign5peg5rOV6L+b5YWl5Y2V5YWD5qC857yW6L6R5qih5byPJyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOaPkOS6pOesrOS4gOS4quaVsOaNruS9nOS4uua1i+ivlVxuICAgICAgICBjb25zdCB0ZXN0RGF0YSA9IHRpY2tldHNbMF1bZmllbGRzWzBdIGFzIGtleW9mIEppcmFUaWNrZXRdIHx8ICcnO1xuICAgICAgICAoZWRpdEJveCBhcyBIVE1MSW5wdXRFbGVtZW50KS52YWx1ZSA9IHRlc3REYXRhO1xuICAgICAgICBcbiAgICAgICAgLy8g6Kem5Y+R6L6T5YWl5LqL5Lu2XG4gICAgICAgIGVkaXRCb3guZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2lucHV0Jywge1xuICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgIGNhbmNlbGFibGU6IHRydWVcbiAgICAgICAgfSkpO1xuICAgICAgICBcbiAgICAgICAgLy8g6Kem5Y+R5Zue6L2m6ZSu5o+Q5LqkXG4gICAgICAgIGNvbnN0IGVudGVyRXZlbnQgPSBuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHtcbiAgICAgICAgICAgIGtleTogJ0VudGVyJyxcbiAgICAgICAgICAgIGNvZGU6ICdFbnRlcicsXG4gICAgICAgICAgICBrZXlDb2RlOiAxMyxcbiAgICAgICAgICAgIHdoaWNoOiAxMyxcbiAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICBjYW5jZWxhYmxlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgZWRpdEJveC5kaXNwYXRjaEV2ZW50KGVudGVyRXZlbnQpO1xuICAgICAgICBcbiAgICAgICAgLy8g6L+Z6YeM55CG6K665LiK5bqU6K+l57un57ut5Li65YW25LuW5Y2V5YWD5qC85rOo5YWl5pWw5o2uXG4gICAgICAgIC8vIOS9hueUseS6juWkjeadguaAp+WSjOWPr+mdoOaAp+mXrumimO+8jOi/memHjOi/lOWbnmZhbHNl6K6p5Ye95pWw5Zue6YCA5Yiw5Ymq6LS05p2/5pa55rOVXG4gICAgICAgIGNvbnNvbGUubG9nKCfljZXlhYPmoLznvJbovpHmtYvor5XmiJDlip/vvIzkvYblrozmlbTmlbDmja7ms6jlhaXpnIDopoHmm7TlpI3mnYLnmoTlrp7njrAnKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+mAmui/h+acrOacuuS6i+S7tuazqOWFpeaVsOaNruWksei0pTonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8vIOivu+WPluW9k+WJjUdvb2dsZSBTaGVldOS4reeahOaVsOaNrlxuYXN5bmMgZnVuY3Rpb24gcmVhZFNoZWV0RGF0YSgpOiBQcm9taXNlPHN0cmluZ1tdW10+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZygn5bCd6K+V6K+75Y+W5b2T5YmNR29vZ2xlIFNoZWV05pWw5o2uLi4uJyk7XG4gICAgICAgIFxuICAgICAgICAvLyDmo4Dmn6XmmK/lkKblnKhHb29nbGUgU2hlZXRz546v5aKD5LitXG4gICAgICAgIGlmICghd2luZG93LmxvY2F0aW9uLmhyZWYuaW5jbHVkZXMoJ2RvY3MuZ29vZ2xlLmNvbS9zcHJlYWRzaGVldHMnKSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfpnZ5Hb29nbGUgU2hlZXRz546v5aKD77yM5peg5rOV6K+75Y+W5pWw5o2uJyk7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOiusOW9lURPTee7k+aehO+8jOW4ruWKqeiwg+ivlVxuICAgICAgICBjb25zb2xlLmxvZygn5b2T5YmNR29vZ2xlIFNoZWV0cyBET03nu5PmnoQ6Jywge1xuICAgICAgICAgICAgJ3RhYmxl5YWD57SgJzogZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndGFibGUsIGRpdltyb2xlPVwiZ3JpZFwiXScpLmxlbmd0aCxcbiAgICAgICAgICAgICflj6/op4HljZXlhYPmoLwnOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY2VsbC1jb250ZW50LCAud2FmZmxlLWNlbGwtY29udGVudCwgZGl2W3JvbGU9XCJncmlkY2VsbFwiXScpLmxlbmd0aCxcbiAgICAgICAgICAgICfooYzlhYPntKAnOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcucm93LWhlYWRlci13cmFwcGVyLCBkaXZbcm9sZT1cInJvd1wiXScpLmxlbmd0aFxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOaWueazlTE6IOWwneivlemAmui/h+mAieaLqeaJgOacieWPr+ingeWNleWFg+agvOW5tuWkjeWItuadpeiOt+WPluaVsOaNrlxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ+WwneivleaWueazlTE6IOmAmui/h+mAieaLqeWSjOWkjeWIticpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDmn6Xmib7lvZPliY3pgInkuK3nmoTljZXlhYPmoLzvvIzlpoLmnpzmsqHmnInvvIzlsJ3or5XpgInmi6nnrKzkuIDkuKrljZXlhYPmoLxcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRTZWxlY3Rpb24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdbYXJpYS1zZWxlY3RlZD1cInRydWVcIl0nKTtcbiAgICAgICAgICAgIGlmICghY3VycmVudFNlbGVjdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfmsqHmnInpgInkuK3nmoTljZXlhYPmoLzvvIzlsJ3or5XpgInmi6nnrKzkuIDkuKrljZXlhYPmoLwnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXJzdENlbGwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY2VsbC1jb250ZW50LCAud2FmZmxlLWNlbGwtY29udGVudCwgZGl2W3JvbGU9XCJncmlkY2VsbFwiXScpO1xuICAgICAgICAgICAgICAgIGlmIChmaXJzdENlbGwpIHtcbiAgICAgICAgICAgICAgICAgICAgKGZpcnN0Q2VsbCBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOmAieaLqeaJgOacieWGheWuueW/q+aNt+mUriAoQ3RybCtBKVxuICAgICAgICAgICAgZG9jdW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHtcbiAgICAgICAgICAgICAgICBrZXk6ICdhJyxcbiAgICAgICAgICAgICAgICBjb2RlOiAnS2V5QScsXG4gICAgICAgICAgICAgICAgY3RybEtleTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOetieW+hemAieaLqeaTjeS9nOWujOaIkFxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDMwMCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDlpI3liLbliLDliarotLTmnb8gKEN0cmwrQylcbiAgICAgICAgICAgIGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7XG4gICAgICAgICAgICAgICAga2V5OiAnYycsXG4gICAgICAgICAgICAgICAgY29kZTogJ0tleUMnLFxuICAgICAgICAgICAgICAgIGN0cmxLZXk6IHRydWUsXG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDnrYnlvoXlpI3liLbmk43kvZzlrozmiJBcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAzMDApKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5Yib5bu65Li05pe25YWD57Sg5Lul6I635Y+W5Ymq6LS05p2/5YaF5a65XG4gICAgICAgICAgICBjb25zdCB0ZW1wSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuICAgICAgICAgICAgdGVtcElucHV0LnN0eWxlLnBvc2l0aW9uID0gJ2ZpeGVkJztcbiAgICAgICAgICAgIHRlbXBJbnB1dC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0ZW1wSW5wdXQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0ZW1wSW5wdXQuZm9jdXMoKTtcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBkb2N1bWVudC5leGVjQ29tbWFuZCgncGFzdGUnKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCfnspjotLTlkb3ku6Tnu5Pmnpw6Jywgc3VjY2Vzcyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSB0ZW1wSW5wdXQudmFsdWU7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygn6I635Y+W5Yiw55qE5YaF5a656ZW/5bqmOicsIGNvbnRlbnQgPyBjb250ZW50Lmxlbmd0aCA6IDApO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRlbXBJbnB1dCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOa4hemZpOmAieaLqVxuICAgICAgICAgICAgd2luZG93LmdldFNlbGVjdGlvbigpPy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGNvbnRlbnQgJiYgY29udGVudC50cmltKCkpIHtcbiAgICAgICAgICAgICAgICAvLyDop6PmnpBUU1bmoLzlvI/mlbDmja5cbiAgICAgICAgICAgICAgICBjb25zdCByb3dzID0gY29udGVudC5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOaWueazlTHmiJDlip86IOiOt+WPluWIsCR7cm93cy5sZW5ndGh96KGM5pWw5o2uYCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHJvd3MubWFwKHJvdyA9PiByb3cuc3BsaXQoJ1xcdCcpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfmlrnms5UxOiDlpI3liLblhoXlrrnkuLrnqbonKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfmlrnms5Ux6YCa6L+H6YCJ5oup5ZKM5aSN5Yi26K+75Y+W5pWw5o2u5aSx6LSlOicsIGUpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDmlrnms5UyOiDlsJ3or5Xkvb/nlKhuYXZpZ2F0b3JDbGlwYm9hcmQgQVBJXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygn5bCd6K+V5pa55rOVMjog5L2/55SobmF2aWdhdG9yLmNsaXBib2FyZCcpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAobmF2aWdhdG9yLmNsaXBib2FyZCAmJiBuYXZpZ2F0b3IuY2xpcGJvYXJkLnJlYWRUZXh0KSB7XG4gICAgICAgICAgICAgICAgLy8g5YWI5bCd6K+V55SoQ3RybCtB5YWo6YCJXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHtcbiAgICAgICAgICAgICAgICAgICAga2V5OiAnYScsXG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICdLZXlBJyxcbiAgICAgICAgICAgICAgICAgICAgY3RybEtleTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMzAwKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g5YaN55SoQ3RybCtD5aSN5Yi2XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHtcbiAgICAgICAgICAgICAgICAgICAga2V5OiAnYycsXG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICdLZXlDJyxcbiAgICAgICAgICAgICAgICAgICAgY3RybEtleTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMzAwKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g5LuO5Ymq6LS05p2/6K+75Y+WXG4gICAgICAgICAgICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQucmVhZFRleHQoKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAodGV4dCAmJiB0ZXh0LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyDop6PmnpBUU1bmoLzlvI/mlbDmja5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93cyA9IHRleHQuc3BsaXQoJ1xcbicpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg5pa55rOVMuaIkOWKnzog6I635Y+W5YiwJHtyb3dzLmxlbmd0aH3ooYzmlbDmja5gKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHJvd3MubWFwKHJvdyA9PiByb3cuc3BsaXQoJ1xcdCcpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfmlrnms5UyOiDliarotLTmnb/lhoXlrrnkuLrnqbonKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign5pa55rOVMjogbmF2aWdhdG9yLmNsaXBib2FyZCBBUEnkuI3lj6/nlKgnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfmlrnms5Uy6YCa6L+HbmF2aWdhdG9yLmNsaXBib2FyZOivu+WPluaVsOaNruWksei0pTonLCBlKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5pa55rOVMzog5bCd6K+V6YCa6L+HRE9NIEFQSeebtOaOpeivu+WPluWPr+ingeWNleWFg+agvOWGheWuuVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ+WwneivleaWueazlTM6IOmAmui/h0RPTSBBUEnor7vlj5blj6/op4HljZXlhYPmoLwnKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5bCd6K+V5LiN5ZCM55qE6YCJ5oup5Zmo5p2l6I635Y+W5Y2V5YWD5qC8XG4gICAgICAgICAgICBjb25zdCBzZWxlY3RvcnMgPSBbXG4gICAgICAgICAgICAgICAgJy5jZWxsLWNvbnRlbnQnLCBcbiAgICAgICAgICAgICAgICAnLndhZmZsZS1jZWxsLWNvbnRlbnQnLCBcbiAgICAgICAgICAgICAgICAnZGl2W3JvbGU9XCJncmlkY2VsbFwiXScsXG4gICAgICAgICAgICAgICAgJy5ncmlkLWNlbGwnLFxuICAgICAgICAgICAgICAgICcuY2VsbCdcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGxldCB2aXNpYmxlQ2VsbHMgPSBudWxsO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNlbGVjdG9yIG9mIHNlbGVjdG9ycykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNlbGxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XG4gICAgICAgICAgICAgICAgaWYgKGNlbGxzICYmIGNlbGxzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOaJvuWIsOmAieaLqeWZqCAke3NlbGVjdG9yfSDnmoTljZXlhYPmoLw6ICR7Y2VsbHMubGVuZ3RofeS4qmApO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlQ2VsbHMgPSBjZWxscztcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXZpc2libGVDZWxscyB8fCB2aXNpYmxlQ2VsbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfmlrnms5UzOiDmnKrmib7liLDku7vkvZXljZXlhYPmoLzlhYPntKAnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDorrDlvZXlvZPliY3pobXpnaLnu5PmnoRcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn6aG16Z2i57uT5p6EOicsIGRvY3VtZW50LmJvZHkuaW5uZXJIVE1MLnN1YnN0cmluZygwLCAxMDAwKSArICcuLi4nKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDlsJ3or5Xmn6Xmib7ooajmoLznm7jlhbPlhYPntKBcbiAgICAgICAgICAgICAgICBjb25zdCB0YWJsZUVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndGFibGUsIFtyb2xlPVwiZ3JpZFwiXSwgW3JvbGU9XCJ0YWJsZVwiXScpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfooajmoLznm7jlhbPlhYPntKA6JywgdGFibGVFbGVtZW50cy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICh0YWJsZUVsZW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5bCd6K+V55u05o6l5LuO6KGo5qC85YWD57Sg6I635Y+W5pWw5o2uXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpcnN0VGFibGUgPSB0YWJsZUVsZW1lbnRzWzBdIGFzIEhUTUxUYWJsZUVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmaXJzdFRhYmxlLnJvd3MgJiYgZmlyc3RUYWJsZS5yb3dzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGE6IHN0cmluZ1tdW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmlyc3RUYWJsZS5yb3dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gZmlyc3RUYWJsZS5yb3dzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd0RhdGE6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCByb3cuY2VsbHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm93RGF0YS5wdXNoKHJvdy5jZWxsc1tqXS50ZXh0Q29udGVudCB8fCAnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEucHVzaChyb3dEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDmlrnms5UzKOihqOagvOWFg+e0oCnmiJDlip86IOiOt+WPluWIsCR7ZGF0YS5sZW5ndGh96KGM5pWw5o2uYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBjZWxsRGF0YU1hcCA9IG5ldyBNYXA8c3RyaW5nLCB7dGV4dDogc3RyaW5nLCByb3c6IG51bWJlciwgY29sOiBudW1iZXJ9PigpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDlsJ3or5Xor4bliKvljZXlhYPmoLzlnZDmoIdcbiAgICAgICAgICAgIHZpc2libGVDZWxscy5mb3JFYWNoKChjZWxsLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGh0bWxDZWxsID0gY2VsbCBhcyBIVE1MRWxlbWVudDtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXh0ID0gaHRtbENlbGwudGV4dENvbnRlbnQgfHwgJyc7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8g5bCd6K+V5aSa56eN5pa55byP6I635Y+W5Z2Q5qCHXG4gICAgICAgICAgICAgICAgbGV0IHJvdyA9IC0xO1xuICAgICAgICAgICAgICAgIGxldCBjb2wgPSAtMTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyAxLiDku47mlbDmja7lsZ7mgKfojrflj5ZcbiAgICAgICAgICAgICAgICBjb25zdCByb3dBdHRyID0gaHRtbENlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLXJvdycpIHx8IGh0bWxDZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1yb3ctaW5kZXgnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xBdHRyID0gaHRtbENlbGwuZ2V0QXR0cmlidXRlKCdkYXRhLWNvbCcpIHx8IGh0bWxDZWxsLmdldEF0dHJpYnV0ZSgnZGF0YS1jb2wtaW5kZXgnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAocm93QXR0ciAmJiBjb2xBdHRyKSB7XG4gICAgICAgICAgICAgICAgICAgIHJvdyA9IHBhcnNlSW50KHJvd0F0dHIsIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgY29sID0gcGFyc2VJbnQoY29sQXR0ciwgMTApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIDIuIOS7juagt+W8j+S9jee9ruaOqOaWrVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdHlsZSA9IGh0bWxDZWxsLmdldEF0dHJpYnV0ZSgnc3R5bGUnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVjdCA9IGh0bWxDZWxsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0eWxlIHx8IChyZWN0ICYmIHJlY3QudG9wICYmIHJlY3QubGVmdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOS9v+eUqOS9jee9ruiuoeeul+Wkp+iHtOeahOihjOWIl1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdG9wID0gcmVjdC50b3AgfHwgcGFyc2VJbnQoc3R5bGU/Lm1hdGNoKC90b3A6XFxzKihcXGQrKS8pPy5bMV0gfHwgJzAnLCAxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsZWZ0ID0gcmVjdC5sZWZ0IHx8IHBhcnNlSW50KHN0eWxlPy5tYXRjaCgvbGVmdDpcXHMqKFxcZCspLyk/LlsxXSB8fCAnMCcsIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g5Lyw6K6h6KGM5YiX77yI6L+Z6ZyA6KaB5qC55o2u5a6e6ZmF6KGo5qC86LCD5pW077yJXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3dIZWlnaHQgPSAyNTsgLy8g6aKE5Lyw6KGM6auYXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xXaWR0aCA9IDEwMDsgLy8g6aKE5Lyw5YiX5a69XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdyA9IE1hdGguZmxvb3IodG9wIC8gcm93SGVpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbCA9IE1hdGguZmxvb3IobGVmdCAvIGNvbFdpZHRoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDMuIOWfuuS6jue0ouW8leeahOeugOWNleeMnOa1i1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8g6L+Z5piv6Z2e5bi457KX55Wl55qE5Lyw6K6h77yM5Y+v6IO95LiN5YeG56GuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByb3dFc3RpbWF0ZSA9IE1hdGguZmxvb3IoaW5kZXggLyAxMCk7IC8vIOWBh+iuvuavj+ihjOaciTEw5YiXXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xFc3RpbWF0ZSA9IGluZGV4ICUgMTA7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdyA9IHJvd0VzdGltYXRlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sID0gY29sRXN0aW1hdGU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKHJvdyA+PSAwICYmIGNvbCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNlbGxEYXRhTWFwLnNldChgJHtyb3d9LCR7Y29sfWAsIHt0ZXh0LCByb3csIGNvbH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDmlbTnkIbmiJDkuoznu7TmlbDnu4RcbiAgICAgICAgICAgIGlmIChjZWxsRGF0YU1hcC5zaXplID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIOaJvuWHuuacgOWkp+eahOihjOWSjOWIl1xuICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBNYXRoLm1heCguLi5BcnJheS5mcm9tKGNlbGxEYXRhTWFwLnZhbHVlcygpKS5tYXAoY2VsbCA9PiBjZWxsLnJvdykpICsgMTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xzID0gTWF0aC5tYXgoLi4uQXJyYXkuZnJvbShjZWxsRGF0YU1hcC52YWx1ZXMoKSkubWFwKGNlbGwgPT4gY2VsbC5jb2wpKSArIDE7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOajgOa1i+WIsOihqOagvOWwuuWvuDogJHtyb3dzfeihjCB4ICR7Y29sc33liJdgKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDliJvlu7rlubbloavlhYXmlbDmja7mlbDnu4RcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhOiBzdHJpbmdbXVtdID0gQXJyYXkocm93cykuZmlsbCgwKS5tYXAoKCkgPT4gQXJyYXkoY29scykuZmlsbCgnJykpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2VsbCBvZiBBcnJheS5mcm9tKGNlbGxEYXRhTWFwLnZhbHVlcygpKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2VsbC5yb3cgPCBkYXRhLmxlbmd0aCAmJiBjZWxsLmNvbCA8IGRhdGFbMF0ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhW2NlbGwucm93XVtjZWxsLmNvbF0gPSBjZWxsLnRleHQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKGRhdGEubGVuZ3RoID4gMCAmJiBkYXRhWzBdLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOaWueazlTPmiJDlip86IOmAmui/h0RPTSBBUEnojrflj5bliLAke2RhdGEubGVuZ3RofeihjOaVsOaNrmApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybign5pa55rOVMzog5peg5rOV5pW055CG5Y2V5YWD5qC85pWw5o2uJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmlrnms5Uz6K+75Y+W5Y2V5YWD5qC85aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5pa55rOVNDog5bCd6K+V5L2/55SoR29vZ2xlIFNoZWV0cyBBUEkgKOWmguaenOeUqOaIt+W3suaOiOadgylcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCflsJ3or5Xmlrnms5U0OiDpgJrov4fmtojmga/kvKDpgJLkvb/nlKjlkI7lj7DnmoRHb29nbGUgU2hlZXRzIEFQSScpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDmj5Dlj5blvZPliY3ooajmoLxJRFxuICAgICAgICAgICAgY29uc3Qgc3ByZWFkc2hlZXRJZCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmLm1hdGNoKC9cXC9zcHJlYWRzaGVldHNcXC9kXFwvKFthLXpBLVowLTktX10rKS8pPy5bMV07XG4gICAgICAgICAgICBpZiAoc3ByZWFkc2hlZXRJZCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCflvZPliY3ooajmoLxJRDonLCBzcHJlYWRzaGVldElkKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDpgJrov4fmtojmga/kvKDpgJLor7fmsYLlkI7lj7Dojrflj5bmlbDmja5cbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0dFVF9TSEVFVF9EQVRBJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwcmVhZHNoZWV0SWRcbiAgICAgICAgICAgICAgICAgICAgfSwgcmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYOaWueazlTTmiJDlip86IOmAmui/h0FQSeiOt+WPluWIsCR7cmVzcG9uc2UuZGF0YS5sZW5ndGh96KGM5pWw5o2uYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXNwb25zZS5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCfmlrnms5U0OiBBUEnov5Tlm57nqbrmlbDmja7miJbplJnor68nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyDorr7nva7otoXml7bvvIzpgb/lhY3ml6DpmZDnrYnlvoVcbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ+aWueazlTQ6IEFQSeivt+axgui2heaXticpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShbXSk7XG4gICAgICAgICAgICAgICAgICAgIH0sIDUwMDApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ+aWueazlTQ6IOaXoOazleS7jlVSTOaPkOWPluihqOagvElEJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfmlrnms5U05L2/55SoQVBJ5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5omA5pyJ5pa55rOV6YO95aSx6LSl5LqG77yM5o+Q5L6b56m65pWw5o2uXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+aJgOacieivu+WPluaWueazlemDveWksei0pe+8jOaXoOazleiOt+WPluihqOagvOaVsOaNricpO1xuICAgICAgICBzaG93VG9hc3QoJ+aXoOazleivu+WPluihqOagvOaVsOaNru+8jOivt+afpeeci+aOp+WItuWPsOS6huino+ivpuaDhScsICdlcnJvcicpO1xuICAgICAgICByZXR1cm4gW107XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign6K+75Y+W6KGo5qC85pWw5o2u5Li75Ye95pWw5aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbn1cblxuLy8g5bCG5paH5pys5aSN5Yi25Yiw5Ymq6LS05p2/XG5hc3luYyBmdW5jdGlvbiBjb3B5VG9DbGlwYm9hcmQodGV4dDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g56Gu5L+d6aG16Z2i5aSE5LqO54Sm54K554q25oCBXG4gICAgICAgIHdpbmRvdy5mb2N1cygpO1xuICAgICAgICBcbiAgICAgICAgLy8g5Yib5bu65Li05pe25paH5pys5Yy65Z+f5YWD57SgXG4gICAgICAgIGNvbnN0IHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcbiAgICAgICAgdGV4dEFyZWEudmFsdWUgPSB0ZXh0O1xuICAgICAgICB0ZXh0QXJlYS5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XG4gICAgICAgIHRleHRBcmVhLnN0eWxlLmxlZnQgPSAnMCc7XG4gICAgICAgIHRleHRBcmVhLnN0eWxlLnRvcCA9ICcwJztcbiAgICAgICAgdGV4dEFyZWEuc3R5bGUud2lkdGggPSAnMmVtJztcbiAgICAgICAgdGV4dEFyZWEuc3R5bGUuaGVpZ2h0ID0gJzJlbSc7XG4gICAgICAgIHRleHRBcmVhLnN0eWxlLnBhZGRpbmcgPSAnMCc7XG4gICAgICAgIHRleHRBcmVhLnN0eWxlLmJvcmRlciA9ICdub25lJztcbiAgICAgICAgdGV4dEFyZWEuc3R5bGUub3V0bGluZSA9ICdub25lJztcbiAgICAgICAgdGV4dEFyZWEuc3R5bGUuYm94U2hhZG93ID0gJ25vbmUnO1xuICAgICAgICB0ZXh0QXJlYS5zdHlsZS5iYWNrZ3JvdW5kID0gJ3RyYW5zcGFyZW50JztcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0ZXh0QXJlYSk7XG4gICAgICAgIFxuICAgICAgICAvLyDpgInmi6nmlofmnKxcbiAgICAgICAgdGV4dEFyZWEuZm9jdXMoKTtcbiAgICAgICAgdGV4dEFyZWEuc2VsZWN0KCk7XG4gICAgICAgIFxuICAgICAgICAvLyDlsJ3or5Xkvb/nlKggZXhlY0NvbW1hbmQg5aSN5Yi2XG4gICAgICAgIGxldCBzdWNjZXNzID0gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzdWNjZXNzID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdleGVjQ29tbWFuZOmUmeivrzonLCBlcnIpO1xuICAgICAgICAgICAgc3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDlsJ3or5Xkvb/nlKjnjrDku6PnmoTliarotLTmnb9BUEnkvZzkuLrlpIfpgInmlrnmoYhcbiAgICAgICAgaWYgKCFzdWNjZXNzICYmIG5hdmlnYXRvci5jbGlwYm9hcmQgJiYgd2luZG93LmlzU2VjdXJlQ29udGV4dCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyDnrYnlvoXnhKbngrnojrflj5ZcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KHRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+S9v+eUqENsaXBib2FyZCBBUEnlpI3liLbmiJDlip8nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0NsaXBib2FyZCBBUEnplJnor686JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIDEwMCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdDbGlwYm9hcmQgQVBJ6ZSZ6K+vOicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOWuieWFqOenu+mZpOS4tOaXtuWFg+e0oFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnModGV4dEFyZWEpKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0ZXh0QXJlYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCfnp7vpmaTkuLTml7blhYPntKDlpLHotKXvvIzov5nmmK/mraPluLjnmoQ6JywgZXJyKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHNob3dUb2FzdCgn5pWw5o2u5bey5aSN5Yi25Yiw5Ymq6LS05p2/77yM6K+35Zyo5Y2V5YWD5qC85Lit5oyJIEN0cmwrViDnspjotLQnLCAnc3VjY2VzcycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2hvd1RvYXN0KCfml6Dms5Xoh6rliqjlpI3liLbmlbDmja7vvIzor7fmiYvliqjpgInmi6nlubblpI3liLYnLCAnZXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3M7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign5aSN5Yi25Yiw5Ymq6LS05p2/6ZSZ6K+vOicsIGVycm9yKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOehruS/nea4heeQhlxuICAgICAgICBjb25zdCB0ZW1wRWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ZXh0YXJlYVtzdHlsZSo9XCJwb3NpdGlvbjogZml4ZWRcIl0nKTtcbiAgICAgICAgdGVtcEVsZW1lbnRzLmZvckVhY2goZWwgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhlbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChlbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlbC5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsLnJlbW92ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIC8vIOW/veeVpeenu+mZpOmUmeivr1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8vIOWwneivleiHquWKqOeymOi0tFxuZnVuY3Rpb24gYXR0ZW1wdEF1dG9QYXN0ZSh0YXJnZXRFbGVtZW50OiBFbGVtZW50KTogYm9vbGVhbiB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g6IGa54Sm55uu5qCH5YWD57SgXG4gICAgICAgICh0YXJnZXRFbGVtZW50IGFzIEhUTUxFbGVtZW50KS5mb2N1cygpO1xuICAgICAgICBcbiAgICAgICAgLy8g5bCd6K+V55u05o6l5qih5oufQ3RybCtW6ZSuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0YXJnZXRFbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IFxuICAgICAgICAgICAgICAgIGtleTogJ3YnLCBcbiAgICAgICAgICAgICAgICBjb2RlOiAnS2V5VicsXG4gICAgICAgICAgICAgICAgY3RybEtleTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlIFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybign6ZSu55uY5LqL5Lu25YiG5Y+R5aSx6LSlOicsIGVycik7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOWwneivleS9v+eUqGV4ZWNDb21tYW5kXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ3Bhc3RlJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdleGVjQ29tbWFuZOeymOi0tOWksei0pTonLCBlcnIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign6Ieq5Yqo57KY6LS05aSx6LSlOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuLy8g5pi+56S657KY6LS06K+05piOXG5mdW5jdGlvbiBzaG93UGFzdGVJbnN0cnVjdGlvbnMoKSB7XG4gICAgLy8g5Yib5bu65oyH5Luk5a+56K+d5qGGXG4gICAgY29uc3QgaW5zdHJ1Y3Rpb25zID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29uc3QgZGlhbG9nSWQgPSAncGFzdGUtaW5zdHJ1Y3Rpb25zLWRpYWxvZy0nICsgRGF0ZS5ub3coKTtcbiAgICBpbnN0cnVjdGlvbnMuaWQgPSBkaWFsb2dJZDtcbiAgICBcbiAgICBpbnN0cnVjdGlvbnMuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgbGVmdDogNTAlO1xuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgICAgICB3aWR0aDogMzUwcHg7XG4gICAgYDtcblxuICAgIGluc3RydWN0aW9ucy5pbm5lckhUTUwgPSBgXG4gICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7XCI+57KY6LS05pWw5o2uPC9oMz5cbiAgICAgICAgPHA+SmlyYeaVsOaNruW3suWkjeWItuWIsOWJqui0tOadv+OAguivt+aMieeFp+S7peS4i+atpemqpOWujOaIkOeymOi0tO+8mjwvcD5cbiAgICAgICAgPG9sIHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMjBweDsgcGFkZGluZy1sZWZ0OiAyMHB4O1wiPlxuICAgICAgICAgICAgPGxpPuehruS/neihqOagvOS4reacieS4gOS4qumAieS4reeahOWNleWFg+agvDwvbGk+XG4gICAgICAgICAgICA8bGk+5oyJIEN0cmwrViDmiJYgQ29tbWFuZCtWIOeymOi0tOaVsOaNrjwvbGk+XG4gICAgICAgIDwvb2w+XG4gICAgICAgIDxkaXYgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcIj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjbG9zZS0ke2RpYWxvZ0lkfVwiPuaIkeefpemBk+S6hjwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICBgO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChpbnN0cnVjdGlvbnMpO1xuXG4gICAgLy8g5re75Yqg5LqL5Lu255uR5ZCs5ZmoXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGNsb3NlLSR7ZGlhbG9nSWR9YCk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhpbnN0cnVjdGlvbnMpKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGluc3RydWN0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnN0cnVjdGlvbnMucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuLy8g5Yib5bu655So5oi35oyH5Y2X5a+56K+d5qGGXG5mdW5jdGlvbiBzaG93R3VpZGVEaWFsb2codGlja2V0czogSmlyYVRpY2tldFtdLCBlbnZDb25maWc6IGFueSkge1xuICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnN0IGRpYWxvZ0lkID0gJ2d1aWRlLWRpYWxvZy0nICsgRGF0ZS5ub3coKTtcbiAgICBkaWFsb2cuaWQgPSBkaWFsb2dJZDtcbiAgICBcbiAgICBkaWFsb2cuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgcG9zaXRpb246IGZpeGVkO1xuICAgICAgICB0b3A6IDUwJTtcbiAgICAgICAgbGVmdDogNTAlO1xuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZSgtNTAlLCAtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7XG4gICAgICAgIHBhZGRpbmc6IDIwcHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDhweDtcbiAgICAgICAgYm94LXNoYWRvdzogMCAycHggMTBweCByZ2JhKDAsMCwwLDAuMSk7XG4gICAgICAgIHotaW5kZXg6IDEwMDAwO1xuICAgICAgICB3aWR0aDogNDUwcHg7XG4gICAgYDtcblxuICAgIGRpYWxvZy5pbm5lckhUTUwgPSBgXG4gICAgICAgIDxoMyBzdHlsZT1cIm1hcmdpbi10b3A6IDA7XCI+5o+S5YWlSmlyYeaVsOaNruWIsOihqOagvDwvaDM+XG4gICAgICAgIDxwPumcgOimgeaJp+ihjOS7peS4i+atpemqpO+8mjwvcD5cbiAgICAgICAgPG9sIHN0eWxlPVwibWFyZ2luLWJvdHRvbTogMjBweDsgcGFkZGluZy1sZWZ0OiAyMHB4O1wiPlxuICAgICAgICAgICAgPGxpPuivt+WFiOWcqOihqOagvOS4remAieaLqeS4gOS4quWNleWFg+agvOS9nOS4uui1t+eCuTwvbGk+XG4gICAgICAgICAgICA8bGk+5aaC5p6c6KGo5qC856ys5LiA6KGM5pyJ5qCH6aKY77yM6K+356Gu5L+d5qCH6aKY5YyF5ZCr5LiOSmlyYeWtl+auteWvueW6lOeahOWQjeensDwvbGk+XG4gICAgICAgICAgICA8bGk+54K55Ye7XCLnu6fnu61cIuWQju+8jOaVsOaNruWwhuiiq+WkjeWItuWIsOWJqui0tOadvzwvbGk+XG4gICAgICAgICAgICA8bGk+54S25ZCO5Zyo6YCJ5Lit55qE5Y2V5YWD5qC85oyJIEN0cmwrViAo5oiWIENvbW1hbmQrVikg57KY6LS0PC9saT5cbiAgICAgICAgPC9vbD5cbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XCI+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsLSR7ZGlhbG9nSWR9XCIgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDEwcHg7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiY29udGludWUtJHtkaWFsb2dJZH1cIj7nu6fnu608L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgYDtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgIC8vIOa3u+WKoOS6i+S7tuebkeWQrOWZqFxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGBjYW5jZWwtJHtkaWFsb2dJZH1gKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGlmIChkb2N1bWVudC5ib2R5LmNvbnRhaW5zKGRpYWxvZykpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpYWxvZy5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYGNvbnRpbnVlLSR7ZGlhbG9nSWR9YCk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyhkaWFsb2cpKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkaWFsb2cucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOagvOW8j+WMluaVsOaNruW5tuWkjeWItuWIsOWJqui0tOadv1xuICAgICAgICBjb25zdCBmaWVsZHMgPSBbJ2tleScsICdzdW1tYXJ5JywgJ3N0YXR1cycsICdhc3NpZ25lZScsICdyZXBvcnRlciddO1xuICAgICAgICBjb25zdCBoZWFkZXJzID0gZmllbGRzLmpvaW4oJ1xcdCcpO1xuICAgICAgICBjb25zdCBmb3JtYXR0ZWREYXRhID0gW2hlYWRlcnMsIC4uLnRpY2tldHMubWFwKHRpY2tldCA9PiAoe1xuICAgICAgICAgICAgLi4udGlja2V0LFxuICAgICAgICAgICAga2V5OiBgPUhZUEVSTElOSyhcIiR7ZW52Q29uZmlnLkpJUkFfQkFTRV9VUkx9L2Jyb3dzZS8ke3RpY2tldC5rZXl9XCIsIFwiJHt0aWNrZXQua2V5fVwiKWBcbiAgICAgICAgfSkpLm1hcCh0aWNrZXQgPT4gZmllbGRzLm1hcChmaWVsZCA9PiB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0pLmpvaW4oJ1xcdCcpKV0uam9pbignXFxuJyk7XG4gICAgICAgIFxuICAgICAgICBjb3B5VG9DbGlwYm9hcmQoZm9ybWF0dGVkRGF0YSk7XG4gICAgfSk7XG59XG5cbi8vIOiOt+WPluihqOagvOS4reW3suWtmOWcqOeahOihqOWktFxuZnVuY3Rpb24gZ2V0RXhpc3RpbmdIZWFkZXJzKCk6IHN0cmluZ1tdIHtcbiAgICB0cnkge1xuICAgICAgICAvLyDlsJ3or5Xojrflj5booajmoLznrKzkuIDooYzkvZzkuLrooajlpLRcbiAgICAgICAgY29uc3QgaGVhZGVyQ2VsbHMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5yb3ctaGVhZGVyLXdyYXBwZXJbc3R5bGUqPVwidG9wOiAwXCJdIH4gLmNlbGwtY29udGVudCA+IC5jZWxsLWJvcmRlcicpKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghaGVhZGVyQ2VsbHMgfHwgaGVhZGVyQ2VsbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvLyDlsJ3or5Xlhbbku5bpgInmi6nlmahcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0Um93Q2VsbHMgPSBBcnJheS5mcm9tKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5ncmlkLXJvd1tzdHlsZSo9XCJ0b3A6IDBcIl0gLmNlbGwtY29udGVudCcpKTtcbiAgICAgICAgICAgIGlmIChmaXJzdFJvd0NlbGxzICYmIGZpcnN0Um93Q2VsbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaXJzdFJvd0NlbGxzLm1hcChjZWxsID0+IGNlbGwudGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOWwneivleebtOaOpeiOt+WPluaJgOacieWPr+ingeeahOWNleWFg+agvOWGheWuuVxuICAgICAgICAgICAgY29uc3QgYWxsVmlzaWJsZUNlbGxzID0gQXJyYXkuZnJvbShkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcud2FmZmxlLXJvdy13cmFwcGVyID4gZGl2W3N0eWxlKj1cInRvcDogMFwiXSBzcGFuJykpO1xuICAgICAgICAgICAgaWYgKGFsbFZpc2libGVDZWxscyAmJiBhbGxWaXNpYmxlQ2VsbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhbGxWaXNpYmxlQ2VsbHMubWFwKGNlbGwgPT4gY2VsbC50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g6ZKI5a+5Q2FudmFz5riy5p+T55qER29vZ2xlIFNoZWV0c++8jOS9v+eUqOaVsOaNruWxnuaAp+aIluWFtuS7luWPr+iDveeahOmAieaLqeWZqFxuICAgICAgICAgICAgY29uc3QgY2FudmFzSGVhZGVycyA9IGdldENhbnZhc0Jhc2VkSGVhZGVycygpO1xuICAgICAgICAgICAgaWYgKGNhbnZhc0hlYWRlcnMgJiYgY2FudmFzSGVhZGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbnZhc0hlYWRlcnM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOWwneivlemAmui/h0FQSeiOt+WPluihqOWktCAtIOS9v+eUqOWJqui0tOadv+aWueW8j1xuICAgICAgICAgICAgcmV0dXJuIGdldEhlYWRlcnNCeUNsaXBib2FyZCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gaGVhZGVyQ2VsbHMubWFwKGNlbGwgPT4gY2VsbC50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfojrflj5booajlpLTlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxufVxuXG4vLyDlsJ3or5XpgJrov4fliIbmnpBDYW52YXPmuLLmn5PnmoTooajmoLzojrflj5booajlpLRcbmZ1bmN0aW9uIGdldENhbnZhc0Jhc2VkSGVhZGVycygpOiBzdHJpbmdbXSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g5bCd6K+V5p+l5om+56ys5LiA6KGM5Y2V5YWD5qC855qE5pWw5o2uXG4gICAgICAgIGNvbnNvbGUubG9nKCflsJ3or5Xojrflj5ZDYW52YXPmuLLmn5PnmoTooajlpLQuLi4nKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWIm+W7uuS4tOaXtui+k+WFpeWMuuWfn+adpeaNleiOt+eymOi0tOWGheWuuVxuICAgICAgICBjb25zdCB0ZW1wSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuICAgICAgICB0ZW1wSW5wdXQuc3R5bGUucG9zaXRpb24gPSAnZml4ZWQnO1xuICAgICAgICB0ZW1wSW5wdXQuc3R5bGUubGVmdCA9ICctOTk5OTk5cHgnO1xuICAgICAgICB0ZW1wSW5wdXQuc3R5bGUudG9wID0gJy05OTk5OTlweCc7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGVtcElucHV0KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWwneivlemAmui/h+aooeaLn+mUruebmOW/q+aNt+mUruWkjeWItuesrOS4gOihjFxuICAgICAgICAvLyAxLiDpgInmi6nnrKzkuIDooYwgKFNoaWZ0K1NwYWNlKVxuICAgICAgICBjb25zdCBmaXJzdFJvd1NlbGVjdG9yID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZGl2W3N0eWxlKj1cInRvcDogMFwiXScpIHx8IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZ3JpZC1yb3dbc3R5bGUqPVwidG9wOiAwXCJdJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLndhZmZsZS1yb3ctd3JhcHBlciA+IGRpdltzdHlsZSo9XCJ0b3A6IDBcIl0nKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChmaXJzdFJvd1NlbGVjdG9yKSB7XG4gICAgICAgICAgICBmaXJzdFJvd1NlbGVjdG9yLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgeyBidWJibGVzOiB0cnVlIH0pKTtcbiAgICAgICAgICAgIGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IFxuICAgICAgICAgICAgICAgIGtleTogJ1NwYWNlJyxcbiAgICAgICAgICAgICAgICBjb2RlOiAnU3BhY2UnLFxuICAgICAgICAgICAgICAgIHNoaWZ0S2V5OiB0cnVlLFxuICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUgXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOetieW+heS4gOeCueaXtumXtOiuqemAieaLqeeUn+aViFxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gMi4g5bCd6K+V5aSN5Yi2IChDdHJsK0MpXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHsgXG4gICAgICAgICAgICAgICAgICAgIGtleTogJ2MnLFxuICAgICAgICAgICAgICAgICAgICBjb2RlOiAnS2V5QycsXG4gICAgICAgICAgICAgICAgICAgIGN0cmxLZXk6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUgXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIC8vIOetieW+heWkjeWItuaTjeS9nOWujOaIkFxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyAzLiDnspjotLTliLDkuLTml7bovpPlhaXmoYZcbiAgICAgICAgICAgICAgICAgICAgdGVtcElucHV0LmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKCdwYXN0ZScpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gNC4g6Kej5p6Q5b6X5Yiw55qE5YaF5a65XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsaXBib2FyZENvbnRlbnQgPSB0ZW1wSW5wdXQudmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyDlronlhajnp7vpmaTkuLTml7blhYPntKBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnModGVtcElucHV0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0ZW1wSW5wdXQpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcElucHV0LnJlbW92ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoY2xpcGJvYXJkQ29udGVudCAmJiBjbGlwYm9hcmRDb250ZW50LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGNsaXBib2FyZENvbnRlbnQuc3BsaXQoJ1xcdCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+mAmui/h0NhbnZhc+aooeaLn+aTjeS9nOiOt+WPlueahOihqOWktDonLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXJzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSwgMTAwKTtcbiAgICAgICAgICAgIH0sIDEwMCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOWuieWFqOenu+mZpOS4tOaXtuWFg+e0oFxuICAgICAgICBpZiAoZG9jdW1lbnQuYm9keS5jb250YWlucyh0ZW1wSW5wdXQpKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRlbXBJbnB1dCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGVtcElucHV0LnBhcmVudE5vZGUpIHtcbiAgICAgICAgICAgIHRlbXBJbnB1dC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRlbXBJbnB1dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0ZW1wSW5wdXQucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOWmguaenOS4iui/sOaWueazleWksei0pe+8jOWwneivleWIhuaekERPTeS4reWPr+iDveeahOaVsOaNruWxnuaAp1xuICAgICAgICBjb25zdCBjYW52YXNFbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignY2FudmFzJyk7XG4gICAgICAgIGlmIChjYW52YXNFbGVtZW50KSB7XG4gICAgICAgICAgICAvLyDov5nph4zlj6/og73pnIDopoHkvb/nlKjkuIDkupvmm7Tpq5jnuqfnmoTmioDmnK/mnaXop6PmnpBDYW52YXPlhoXlrrlcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCfmib7liLBDYW52YXPlhYPntKDvvIzkvYbml6Dms5Xnm7TmjqXor7vlj5blhoXlrrknKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+iOt+WPlkNhbnZhc+ihqOWktOWksei0pTonLCBlcnJvcik7XG4gICAgICAgIFxuICAgICAgICAvLyDnoa7kv53muIXnkIZcbiAgICAgICAgY29uc3QgdGVtcEVsZW1lbnRzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgndGV4dGFyZWFbc3R5bGUqPVwicG9zaXRpb246IGZpeGVkXCJdJyk7XG4gICAgICAgIHRlbXBFbGVtZW50cy5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnMoZWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZWwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZWwucGFyZW50Tm9kZSkge1xuICAgICAgICAgICAgICAgICAgICBlbC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbC5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAvLyDlv73nlaXnp7vpmaTplJnor69cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gW107XG4gICAgfVxufVxuXG4vLyDmj5DnpLrnlKjmiLfpgInmi6nnrKzkuIDooYzlubblsJ3or5XpgJrov4fliarotLTmnb/ojrflj5booajlpLRcbmZ1bmN0aW9uIGdldEhlYWRlcnNCeUNsaXBib2FyZCgpOiBzdHJpbmdbXSB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8g5pi+56S65o+Q56S66K6p55So5oi35YWI6YCJ5oup6KGo5aS06KGMXG4gICAgICAgIHNob3dUb2FzdCgn6K+35YWI6YCJ5oup6KGo5qC855qE56ys5LiA6KGM77yI6KGo5aS06KGM77yJ77yM54S25ZCO5YaN5qyh5bCd6K+VJywgJ2luZm8nKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOWwneivleiOt+WPluW3sumAieaLqeeahOWGheWuuVxuICAgICAgICBjb25zdCBzZWxlY3RlZENlbGxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtc2VsZWN0ZWQ9XCJ0cnVlXCJdJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKCfmo4DmtYvliLDpgInkuK3ljZXlhYPmoLzmlbDph486Jywgc2VsZWN0ZWRDZWxscy5sZW5ndGgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHNlbGVjdGVkQ2VsbHMgJiYgc2VsZWN0ZWRDZWxscy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyDliJvlu7rkuLTml7bovpPlhaXljLrln5/mnaXojrflj5bliarotLTmnb/lhoXlrrlcbiAgICAgICAgICAgIGNvbnN0IHRlbXBJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJyk7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRlbXBJbnB1dCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIOaooeaLn+WkjeWItuW3sumAieaLqeeahOWGheWuuVxuICAgICAgICAgICAgZG9jdW1lbnQuZXhlY0NvbW1hbmQoJ2NvcHknKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g562J5b6F5LiA54K55pe26Ze056Gu5L+d5aSN5Yi25a6M5oiQXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICB0ZW1wSW5wdXQuZm9jdXMoKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgncGFzdGUnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDop6PmnpDlvpfliLDnmoTlhoXlrrlcbiAgICAgICAgICAgICAgICBjb25zdCBjbGlwYm9hcmRDb250ZW50ID0gdGVtcElucHV0LnZhbHVlO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCfliarotLTmnb/lhoXlrrk6JywgY2xpcGJvYXJkQ29udGVudCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYgKGRvY3VtZW50LmJvZHkuY29udGFpbnModGVtcElucHV0KSkge1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRlbXBJbnB1dCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGVtcElucHV0LnJlbW92ZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAoY2xpcGJvYXJkQ29udGVudCAmJiBjbGlwYm9hcmRDb250ZW50LnRyaW0oKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyDlgYforr7ooajlpLTmmK/ku6XliLbooajnrKbliIbpmpTnmoRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGNsaXBib2FyZENvbnRlbnQuc3BsaXQoJ1xcdCcpLm1hcChoZWFkZXIgPT4gaGVhZGVyLnRyaW0oKS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+mAmui/h+WJqui0tOadv+iOt+WPlueahOihqOWktDonLCBoZWFkZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMTAwKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8g5aaC5p6c5rKh5pyJ5oiQ5Yqf6I635Y+W5Ymq6LS05p2/5YaF5a6577yM5bCd6K+V55u05o6l5LuO6YCJ5Lit55qE5Y2V5YWD5qC85YaF5a656I635Y+WXG4gICAgICAgICAgICBjb25zdCBoZWFkZXJUZXh0czogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIHNlbGVjdGVkQ2VsbHMuZm9yRWFjaChjZWxsID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0ZXh0ID0gKGNlbGwgYXMgSFRNTEVsZW1lbnQpLmlubmVyVGV4dCB8fCAoY2VsbCBhcyBIVE1MRWxlbWVudCkudGV4dENvbnRlbnQgfHwgJyc7XG4gICAgICAgICAgICAgICAgaWYgKHRleHQudHJpbSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGhlYWRlclRleHRzLnB1c2godGV4dC50cmltKCkudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChoZWFkZXJUZXh0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ+S7jumAieS4reWNleWFg+agvOaWh+acrOiOt+WPlueahOihqOWktDonLCBoZWFkZXJUZXh0cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlclRleHRzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDlpoLmnpznlKjmiLfov5jmsqHmnInpgInmi6nooajlpLTooYzvvIzov5Tlm57pu5jorqTnmoRKaXJh5a2X5q61XG4gICAgICAgIGNvbnNvbGUubG9nKCfnlKjmiLfpnIDopoHmiYvliqjpgInmi6nooajlpLTooYwnKTtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ+mAmui/h+WJqui0tOadv+iOt+WPluihqOWktOWksei0pTonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG59XG5cbi8vIOW8uuWItuWkjeWItuW9k+WJjemAieS4reeahOWGheWuueS9nOS4uuihqOWktFxuYXN5bmMgZnVuY3Rpb24gY29weVNlbGVjdGVkSGVhZGVycygpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG4gICAgICAgIGlmIChzZWxlY3Rpb24gJiYgIXNlbGVjdGlvbi5pc0NvbGxhcHNlZCkge1xuICAgICAgICAgICAgLy8g5pyJ6YCJ5oup5YaF5a6555qE5oOF5Ya1XG4gICAgICAgICAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnY29weScpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOWwneivleiOt+WPluW9k+WJjemAieS4reeahOihqOagvOWNleWFg+agvFxuICAgICAgICBjb25zdCBzZWxlY3RlZENlbGxzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW2FyaWEtc2VsZWN0ZWQ9XCJ0cnVlXCJdJyk7XG4gICAgICAgIGlmIChzZWxlY3RlZENlbGxzICYmIHNlbGVjdGVkQ2VsbHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8g5bCd6K+V5qih5ouf5aSN5Yi25pON5L2cXG4gICAgICAgICAgICBkb2N1bWVudC5leGVjQ29tbWFuZCgnY29weScpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCflpI3liLbpgInkuK3ooajlpLTlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vLyDmn6Xmib7mnInmlYjnmoRKaXJh5a2X5q616KGo5aS0XG5mdW5jdGlvbiBmaW5kVmFsaWRKaXJhSGVhZGVycyhoZWFkZXJzOiBzdHJpbmdbXSwgdGlja2V0OiBKaXJhVGlja2V0KTogc3RyaW5nW10ge1xuICAgIGlmICghaGVhZGVycyB8fCBoZWFkZXJzLmxlbmd0aCA9PT0gMCB8fCAhdGlja2V0KSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgXG4gICAgY29uc3QgdmFsaWRIZWFkZXJzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHBvc3NpYmxlSmlyYUZpZWxkcyA9IE9iamVjdC5rZXlzKHRpY2tldCkubWFwKGsgPT4gay50b0xvd2VyQ2FzZSgpKTtcbiAgICBcbiAgICAvLyDmiZPljbDmiYDmnInlj6/og73nmoRKaXJh5a2X5q615ZCN56ew77yM55So5LqO6LCD6K+VXG4gICAgY29uc29sZS5sb2coJ+WPr+iDveeahEppcmHlrZfmrrU6JywgcG9zc2libGVKaXJhRmllbGRzKTtcbiAgICBjb25zb2xlLmxvZygn56Wo5o2u5qC35L6LOicsIHRpY2tldCk7XG4gICAgXG4gICAgaGVhZGVycy5mb3JFYWNoKGhlYWRlciA9PiB7XG4gICAgICAgIGNvbnN0IGhlYWRlckxvd2VyID0gaGVhZGVyLnRvTG93ZXJDYXNlKCkudHJpbSgpO1xuICAgICAgICBcbiAgICAgICAgLy8g5qOA5p+l57K+56Gu5Yy56YWNXG4gICAgICAgIGlmIChwb3NzaWJsZUppcmFGaWVsZHMuaW5jbHVkZXMoaGVhZGVyTG93ZXIpKSB7XG4gICAgICAgICAgICB2YWxpZEhlYWRlcnMucHVzaChoZWFkZXJMb3dlcik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOajgOafpeenu+mZpOepuuagvOWQjuWMuemFjVxuICAgICAgICBjb25zdCBoZWFkZXJOb1NwYWNlID0gaGVhZGVyTG93ZXIucmVwbGFjZSgvXFxzKy9nLCAnJyk7XG4gICAgICAgIGlmIChwb3NzaWJsZUppcmFGaWVsZHMuaW5jbHVkZXMoaGVhZGVyTm9TcGFjZSkpIHtcbiAgICAgICAgICAgIHZhbGlkSGVhZGVycy5wdXNoKGhlYWRlckxvd2VyKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8g5qOA5p+l6YOo5YiG5Yy56YWNXG4gICAgICAgIGZvciAoY29uc3QgZmllbGQgb2YgcG9zc2libGVKaXJhRmllbGRzKSB7XG4gICAgICAgICAgICBpZiAoaGVhZGVyTG93ZXIuaW5jbHVkZXMoZmllbGQpIHx8IGZpZWxkLmluY2x1ZGVzKGhlYWRlckxvd2VyKSkge1xuICAgICAgICAgICAgICAgIHZhbGlkSGVhZGVycy5wdXNoKGhlYWRlckxvd2VyKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhg6YOo5YiG5Yy56YWNOiBcIiR7aGVhZGVyTG93ZXJ9XCIgLT4gXCIke2ZpZWxkfVwiYCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyDnibnmrorlpITnkIbluLjop4HnmoTlrZfmrrXlkI3liKvlkI1cbiAgICAgICAgY29uc3QgZmllbGRBbGlhc2VzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICAgICAgICAgICAna2V5JzogWydpZCcsICd0aWNrZXQnLCAnamlyYScsICdpc3N1ZSddLFxuICAgICAgICAgICAgJ3N1bW1hcnknOiBbJ3RpdGxlJywgJ25hbWUnLCAnZGVzY3JpcHRpb24nLCAn5pGY6KaBJywgJ+agh+mimCddLFxuICAgICAgICAgICAgJ3N0YXR1cyc6IFsnc3RhdGUnLCAn54q25oCBJ10sXG4gICAgICAgICAgICAnYXNzaWduZWUnOiBbJ2Fzc2lnbmVkJywgJ293bmVyJywgJ+i0n+i0o+S6uicsICfnu4/lip7kuronXSxcbiAgICAgICAgICAgICdyZXBvcnRlcic6IFsnY3JlYXRlZCBieScsICdhdXRob3InLCAn5oql5ZGK5Lq6JywgJ+WIm+W7uuS6uiddXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBmb3IgKGNvbnN0IFtmaWVsZCwgYWxpYXNlc10gb2YgT2JqZWN0LmVudHJpZXMoZmllbGRBbGlhc2VzKSkge1xuICAgICAgICAgICAgaWYgKGFsaWFzZXMuc29tZShhbGlhcyA9PiBoZWFkZXJMb3dlci5pbmNsdWRlcyhhbGlhcykpKSB7XG4gICAgICAgICAgICAgICAgdmFsaWRIZWFkZXJzLnB1c2goZmllbGQpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDliKvlkI3ljLnphY06IFwiJHtoZWFkZXJMb3dlcn1cIiAtPiBcIiR7ZmllbGR9XCJgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICAvLyDlpoLmnpzmsqHmnInmnInmlYjlpLTpg6jkvYbmnInovpPlhaXlpLTpg6jvvIzoh7PlsJHkv53nlZnkuIDkupvln7rmnKzlrZfmrrVcbiAgICBpZiAodmFsaWRIZWFkZXJzLmxlbmd0aCA9PT0gMCAmJiBoZWFkZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+acquaJvuWIsOWMuemFjeeahOWtl+aute+8jOS9v+eUqOWfuuacrOWtl+auteaYoOWwhCcpO1xuICAgICAgICAvLyDlsJ3or5XmmKDlsITln7rmnKzlrZfmrrVcbiAgICAgICAgcmV0dXJuIFsna2V5JywgJ3N1bW1hcnknLCAnc3RhdHVzJ10uZmlsdGVyKGYgPT4gcG9zc2libGVKaXJhRmllbGRzLmluY2x1ZGVzKGYpKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHZhbGlkSGVhZGVycztcbn1cblxuLy8g5re75Yqg5pi+56S6IHRvYXN0IOeahOWHveaVsFxuZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2U6IHN0cmluZywgdHlwZSA9ICdpbmZvJykge1xuICAgIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdG9hc3QudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICAgIHRvYXN0LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgYm90dG9tOiAyMHB4O1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICAgICAgYmFja2dyb3VuZDogJHt0eXBlID09PSAnZXJyb3InID8gJ3JnYmEoMjIwLCA1MywgNjksIDAuOSknIDogdHlwZSA9PT0gJ3N1Y2Nlc3MnID8gJ3JnYmEoNDAsIDE2NywgNjksIDAuOSknIDogJ3JnYmEoMCwgMCwgMCwgMC43KSd9O1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIHBhZGRpbmc6IDEwcHggMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNXB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCA1cHggcmdiYSgwLCAwLCAwLCAwLjIpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMTtcbiAgICAgICAgb3BhY2l0eTogMDtcbiAgICAgICAgdHJhbnNpdGlvbjogb3BhY2l0eSAwLjNzIGVhc2U7XG4gICAgYDtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzEnO1xuICAgIH0pO1xuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB0b2FzdC5zdHlsZS5vcGFjaXR5ID0gJzAnO1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQodG9hc3QpO1xuICAgICAgICB9LCAzMDApO1xuICAgIH0sIDMwMDApO1xufVxuXG4vLyDmmL7npLrmlbDmja7liIbmnpDlr7nor53moYZcbmZ1bmN0aW9uIHNob3dEYXRhQW5hbHlzaXNEaWFsb2coZGF0YTogc3RyaW5nW11bXSkge1xuICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIHRvcDogNTAlO1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgei1pbmRleDogMTAwMDE7XG4gICAgICAgIHdpZHRoOiA4MCU7XG4gICAgICAgIG1heC13aWR0aDogODAwcHg7XG4gICAgICAgIG1heC1oZWlnaHQ6IDgwdmg7XG4gICAgICAgIG92ZXJmbG93LXk6IGF1dG87XG4gICAgYDtcblxuICAgIC8vIOWktOmDqOagh+mimOWSjOWFs+mXreaMiemSrlxuICAgIGNvbnN0IGhlYWRlckRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGhlYWRlckRpdi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47XG4gICAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICAgIG1hcmdpbi1ib3R0b206IDE1cHg7XG4gICAgYDtcbiAgICBcbiAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyk7XG4gICAgdGl0bGUudGV4dENvbnRlbnQgPSAn5pWw5o2u5YiG5p6QJztcbiAgICB0aXRsZS5zdHlsZS5tYXJnaW4gPSAnMCc7XG4gICAgXG4gICAgY29uc3QgY2xvc2VCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICBjbG9zZUJ1dHRvbi50ZXh0Q29udGVudCA9ICfDlyc7XG4gICAgY2xvc2VCdXR0b24uc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgYmFja2dyb3VuZDogbm9uZTtcbiAgICAgICAgYm9yZGVyOiBub25lO1xuICAgICAgICBmb250LXNpemU6IDIwcHg7XG4gICAgICAgIGN1cnNvcjogcG9pbnRlcjtcbiAgICAgICAgY29sb3I6ICM2NjY7XG4gICAgYDtcbiAgICBjbG9zZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChkaWFsb2cpO1xuICAgIH0pO1xuICAgIFxuICAgIGhlYWRlckRpdi5hcHBlbmRDaGlsZCh0aXRsZSk7XG4gICAgaGVhZGVyRGl2LmFwcGVuZENoaWxkKGNsb3NlQnV0dG9uKTtcbiAgICBkaWFsb2cuYXBwZW5kQ2hpbGQoaGVhZGVyRGl2KTtcbiAgICBcbiAgICAvLyDln7rmnKznu5/orqHkv6Hmga9cbiAgICBjb25zdCBzdGF0c0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHN0YXRzRGl2LnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIGJhY2tncm91bmQ6ICNmOGY5ZmE7XG4gICAgICAgIHBhZGRpbmc6IDE1cHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgICAgICAgbWFyZ2luLWJvdHRvbTogMTVweDtcbiAgICBgO1xuICAgIFxuICAgIGNvbnN0IGhlYWRlcnMgPSBkYXRhWzBdIHx8IFtdO1xuICAgIGNvbnN0IGRhdGFXaXRob3V0SGVhZGVycyA9IGRhdGEuc2xpY2UoMSk7XG4gICAgXG4gICAgY29uc3Qgcm93Q291bnQgPSBkYXRhV2l0aG91dEhlYWRlcnMubGVuZ3RoO1xuICAgIGNvbnN0IGNvbENvdW50ID0gaGVhZGVycy5sZW5ndGg7XG4gICAgXG4gICAgc3RhdHNEaXYuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDQgc3R5bGU9XCJtYXJnaW4tdG9wOiAwOyBtYXJnaW4tYm90dG9tOiAxMHB4O1wiPuWfuuacrOe7n+iuoTwvaDQ+XG4gICAgICAgIDxwPuaAu+ihjOaVsDogJHtyb3dDb3VudH08L3A+XG4gICAgICAgIDxwPuaAu+WIl+aVsDogJHtjb2xDb3VudH08L3A+XG4gICAgICAgIDxwPuihqOWktDogJHtoZWFkZXJzLmpvaW4oJywgJyl9PC9wPlxuICAgIGA7XG4gICAgXG4gICAgZGlhbG9nLmFwcGVuZENoaWxkKHN0YXRzRGl2KTtcbiAgICBcbiAgICAvLyDliJfliIbmnpBcbiAgICBjb25zdCBjb2x1bW5zRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29sdW1uc0Rpdi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBkaXNwbGF5OiBncmlkO1xuICAgICAgICBncmlkLXRlbXBsYXRlLWNvbHVtbnM6IHJlcGVhdChhdXRvLWZpbGwsIG1pbm1heCgyNTBweCwgMWZyKSk7XG4gICAgICAgIGdhcDogMTVweDtcbiAgICBgO1xuICAgIFxuICAgIC8vIOWIhuaekOavj+S4gOWIl1xuICAgIGhlYWRlcnMuZm9yRWFjaCgoaGVhZGVyLCBjb2xJbmRleCkgPT4ge1xuICAgICAgICBpZiAoIWhlYWRlcikgcmV0dXJuO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY29sdW1uVmFsdWVzID0gZGF0YVdpdGhvdXRIZWFkZXJzLm1hcChyb3cgPT4gcm93W2NvbEluZGV4XSB8fCAnJykuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgICBpZiAoY29sdW1uVmFsdWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgY29sdW1uRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGNvbHVtbkRpdi5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICAgICAgYmFja2dyb3VuZDogI2Y4ZjlmYTtcbiAgICAgICAgICAgIHBhZGRpbmc6IDE1cHg7XG4gICAgICAgICAgICBib3JkZXItcmFkaXVzOiA1cHg7XG4gICAgICAgIGA7XG4gICAgICAgIFxuICAgICAgICAvLyDmo4DmtYvliJfmlbDmja7nsbvlnotcbiAgICAgICAgY29uc3QgaXNOdW1lcmljID0gY29sdW1uVmFsdWVzLmV2ZXJ5KHYgPT4gIWlzTmFOKHBhcnNlRmxvYXQodikpICYmIGlzRmluaXRlKHBhcnNlRmxvYXQodikpKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChpc051bWVyaWMpIHtcbiAgICAgICAgICAgIC8vIOaVsOWAvOWei+WIl1xuICAgICAgICAgICAgY29uc3QgbnVtZXJpY1ZhbHVlcyA9IGNvbHVtblZhbHVlcy5tYXAodiA9PiBwYXJzZUZsb2F0KHYpKTtcbiAgICAgICAgICAgIGNvbnN0IHN1bSA9IG51bWVyaWNWYWx1ZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG4gICAgICAgICAgICBjb25zdCBhdmcgPSBzdW0gLyBudW1lcmljVmFsdWVzLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbnN0IG1heCA9IE1hdGgubWF4KC4uLm51bWVyaWNWYWx1ZXMpO1xuICAgICAgICAgICAgY29uc3QgbWluID0gTWF0aC5taW4oLi4ubnVtZXJpY1ZhbHVlcyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbHVtbkRpdi5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICAgICAgPGg0IHN0eWxlPVwibWFyZ2luLXRvcDogMDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj4ke2hlYWRlcn08L2g0PlxuICAgICAgICAgICAgICAgIDxwPuexu+Weizog5pWw5YC8PC9wPlxuICAgICAgICAgICAgICAgIDxwPuW5s+Wdh+WAvDogJHthdmcudG9GaXhlZCgyKX08L3A+XG4gICAgICAgICAgICAgICAgPHA+5pyA5aSn5YC8OiAke21heH08L3A+XG4gICAgICAgICAgICAgICAgPHA+5pyA5bCP5YC8OiAke21pbn08L3A+XG4gICAgICAgICAgICAgICAgPHA+5oC75ZKMOiAke3N1bS50b0ZpeGVkKDIpfTwvcD5cbiAgICAgICAgICAgICAgICA8cD7pnZ7nqbrlgLzmlbA6ICR7Y29sdW1uVmFsdWVzLmxlbmd0aH08L3A+XG4gICAgICAgICAgICBgO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8g5YiG57G7L+aWh+acrOWei+WIl1xuICAgICAgICAgICAgY29uc3QgdmFsdWVDb3VudHM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcbiAgICAgICAgICAgIGNvbHVtblZhbHVlcy5mb3JFYWNoKHZhbHVlID0+IHtcbiAgICAgICAgICAgICAgICB2YWx1ZUNvdW50c1t2YWx1ZV0gPSAodmFsdWVDb3VudHNbdmFsdWVdIHx8IDApICsgMTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDojrflj5bliY015Liq5pyA5bi46KeB5YC8XG4gICAgICAgICAgICBjb25zdCB0b3BWYWx1ZXMgPSBPYmplY3QuZW50cmllcyh2YWx1ZUNvdW50cylcbiAgICAgICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYlsxXSAtIGFbMV0pXG4gICAgICAgICAgICAgICAgLnNsaWNlKDAsIDUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb2x1bW5EaXYuaW5uZXJIVE1MID0gYFxuICAgICAgICAgICAgICAgIDxoNCBzdHlsZT1cIm1hcmdpbi10b3A6IDA7IG1hcmdpbi1ib3R0b206IDEwcHg7XCI+JHtoZWFkZXJ9PC9oND5cbiAgICAgICAgICAgICAgICA8cD7nsbvlnos6IOaWh+acrC/liIbnsbs8L3A+XG4gICAgICAgICAgICAgICAgPHA+5ZSv5LiA5YC85pWwOiAke09iamVjdC5rZXlzKHZhbHVlQ291bnRzKS5sZW5ndGh9PC9wPlxuICAgICAgICAgICAgICAgIDxwPumdnuepuuWAvOaVsDogJHtjb2x1bW5WYWx1ZXMubGVuZ3RofTwvcD5cbiAgICAgICAgICAgICAgICA8cD7mnIDluLjop4HlgLw6PC9wPlxuICAgICAgICAgICAgICAgIDx1bCBzdHlsZT1cIm1hcmdpbi10b3A6IDVweDsgcGFkZGluZy1sZWZ0OiAyMHB4O1wiPlxuICAgICAgICAgICAgICAgICAgICAke3RvcFZhbHVlcy5tYXAoKFt2YWx1ZSwgY291bnRdKSA9PiBgPGxpPiR7dmFsdWV9OiAke2NvdW50feasoTwvbGk+YCkuam9pbignJyl9XG4gICAgICAgICAgICAgICAgPC91bD5cbiAgICAgICAgICAgIGA7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbHVtbnNEaXYuYXBwZW5kQ2hpbGQoY29sdW1uRGl2KTtcbiAgICB9KTtcbiAgICBcbiAgICBkaWFsb2cuYXBwZW5kQ2hpbGQoY29sdW1uc0Rpdik7XG4gICAgXG4gICAgLy8g5re75Yqg5Yqf6IO95oyJ6ZKu5Yy65Z+fXG4gICAgY29uc3QgYWN0aW9uc0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGFjdGlvbnNEaXYuc3R5bGUuY3NzVGV4dCA9IGBcbiAgICAgICAgbWFyZ2luLXRvcDogMjBweDtcbiAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcbiAgICAgICAgZ2FwOiAxMHB4O1xuICAgIGA7XG4gICAgXG4gICAgLy8g5a+85Ye65YiG5p6Q57uT5p6c5oyJ6ZKuXG4gICAgY29uc3QgZXhwb3J0QnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgZXhwb3J0QnV0dG9uLnRleHRDb250ZW50ID0gJ+WvvOWHuuWIhuaekOe7k+aenCc7XG4gICAgZXhwb3J0QnV0dG9uLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBhZGRpbmc6IDhweCAxNXB4O1xuICAgICAgICBiYWNrZ3JvdW5kOiAjMDA3M2U2O1xuICAgICAgICBjb2xvcjogd2hpdGU7XG4gICAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgYDtcbiAgICBleHBvcnRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGV4cG9ydEFuYWx5c2lzUmVzdWx0cyhkYXRhKTtcbiAgICB9KTtcbiAgICBcbiAgICBhY3Rpb25zRGl2LmFwcGVuZENoaWxkKGV4cG9ydEJ1dHRvbik7XG4gICAgZGlhbG9nLmFwcGVuZENoaWxkKGFjdGlvbnNEaXYpO1xuICAgIFxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcbn1cblxuLy8g5a+85Ye65YiG5p6Q57uT5p6cXG5mdW5jdGlvbiBleHBvcnRBbmFseXNpc1Jlc3VsdHMoZGF0YTogc3RyaW5nW11bXSkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBkYXRhWzBdIHx8IFtdO1xuICAgICAgICBjb25zdCBkYXRhV2l0aG91dEhlYWRlcnMgPSBkYXRhLnNsaWNlKDEpO1xuICAgICAgICBcbiAgICAgICAgLy8g55Sf5oiQ5YiG5p6Q5oql5ZGKXG4gICAgICAgIGxldCByZXBvcnQgPSBgIyDmlbDmja7liIbmnpDmiqXlkYpcXG5cXG5gO1xuICAgICAgICByZXBvcnQgKz0gYCMjIOWfuuacrOS/oeaBr1xcbmA7XG4gICAgICAgIHJlcG9ydCArPSBgLSDmgLvooYzmlbA6ICR7ZGF0YVdpdGhvdXRIZWFkZXJzLmxlbmd0aH1cXG5gO1xuICAgICAgICByZXBvcnQgKz0gYC0g5oC75YiX5pWwOiAke2hlYWRlcnMubGVuZ3RofVxcblxcbmA7XG4gICAgICAgIFxuICAgICAgICByZXBvcnQgKz0gYCMjIOWIl+e7n+iuoVxcblxcbmA7XG4gICAgICAgIFxuICAgICAgICAvLyDliIbmnpDmr4/kuIDliJdcbiAgICAgICAgaGVhZGVycy5mb3JFYWNoKChoZWFkZXIsIGNvbEluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoIWhlYWRlcikgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBjb2x1bW5WYWx1ZXMgPSBkYXRhV2l0aG91dEhlYWRlcnMubWFwKHJvdyA9PiByb3dbY29sSW5kZXhdIHx8ICcnKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgICAgICBpZiAoY29sdW1uVmFsdWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXBvcnQgKz0gYCMjIyAke2hlYWRlcn1cXG5gO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyDmo4DmtYvliJfmlbDmja7nsbvlnotcbiAgICAgICAgICAgIGNvbnN0IGlzTnVtZXJpYyA9IGNvbHVtblZhbHVlcy5ldmVyeSh2ID0+ICFpc05hTihwYXJzZUZsb2F0KHYpKSAmJiBpc0Zpbml0ZShwYXJzZUZsb2F0KHYpKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChpc051bWVyaWMpIHtcbiAgICAgICAgICAgICAgICAvLyDmlbDlgLzlnovliJdcbiAgICAgICAgICAgICAgICBjb25zdCBudW1lcmljVmFsdWVzID0gY29sdW1uVmFsdWVzLm1hcCh2ID0+IHBhcnNlRmxvYXQodikpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1bSA9IG51bWVyaWNWYWx1ZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXZnID0gc3VtIC8gbnVtZXJpY1ZhbHVlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF4ID0gTWF0aC5tYXgoLi4ubnVtZXJpY1ZhbHVlcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgbWluID0gTWF0aC5taW4oLi4ubnVtZXJpY1ZhbHVlcyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmVwb3J0ICs9IGAtIOexu+Weizog5pWw5YC8XFxuYDtcbiAgICAgICAgICAgICAgICByZXBvcnQgKz0gYC0g5bmz5Z2H5YC8OiAke2F2Zy50b0ZpeGVkKDIpfVxcbmA7XG4gICAgICAgICAgICAgICAgcmVwb3J0ICs9IGAtIOacgOWkp+WAvDogJHttYXh9XFxuYDtcbiAgICAgICAgICAgICAgICByZXBvcnQgKz0gYC0g5pyA5bCP5YC8OiAke21pbn1cXG5gO1xuICAgICAgICAgICAgICAgIHJlcG9ydCArPSBgLSDmgLvlkow6ICR7c3VtLnRvRml4ZWQoMil9XFxuYDtcbiAgICAgICAgICAgICAgICByZXBvcnQgKz0gYC0g6Z2e56m65YC85pWwOiAke2NvbHVtblZhbHVlcy5sZW5ndGh9XFxuXFxuYDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8g5YiG57G7L+aWh+acrOWei+WIl1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlQ291bnRzOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge307XG4gICAgICAgICAgICAgICAgY29sdW1uVmFsdWVzLmZvckVhY2godmFsdWUgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZUNvdW50c1t2YWx1ZV0gPSAodmFsdWVDb3VudHNbdmFsdWVdIHx8IDApICsgMTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyDojrflj5bliY015Liq5pyA5bi46KeB5YC8XG4gICAgICAgICAgICAgICAgY29uc3QgdG9wVmFsdWVzID0gT2JqZWN0LmVudHJpZXModmFsdWVDb3VudHMpXG4gICAgICAgICAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiWzFdIC0gYVsxXSlcbiAgICAgICAgICAgICAgICAgICAgLnNsaWNlKDAsIDUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJlcG9ydCArPSBgLSDnsbvlnos6IOaWh+acrC/liIbnsbtcXG5gO1xuICAgICAgICAgICAgICAgIHJlcG9ydCArPSBgLSDllK/kuIDlgLzmlbA6ICR7T2JqZWN0LmtleXModmFsdWVDb3VudHMpLmxlbmd0aH1cXG5gO1xuICAgICAgICAgICAgICAgIHJlcG9ydCArPSBgLSDpnZ7nqbrlgLzmlbA6ICR7Y29sdW1uVmFsdWVzLmxlbmd0aH1cXG5gO1xuICAgICAgICAgICAgICAgIHJlcG9ydCArPSBgLSDmnIDluLjop4HlgLw6XFxuYDtcbiAgICAgICAgICAgICAgICB0b3BWYWx1ZXMuZm9yRWFjaCgoW3ZhbHVlLCBjb3VudF0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVwb3J0ICs9IGAgIC0gJHt2YWx1ZX06ICR7Y291bnR95qyhXFxuYDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXBvcnQgKz0gYFxcbmA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgLy8g5Yib5bu65LiL6L296ZO+5o6lXG4gICAgICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbcmVwb3J0XSwgeyB0eXBlOiAndGV4dC9wbGFpbicgfSk7XG4gICAgICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGEuaHJlZiA9IHVybDtcbiAgICAgICAgYS5kb3dubG9hZCA9ICfmlbDmja7liIbmnpDmiqXlkYoubWQnO1xuICAgICAgICBhLmNsaWNrKCk7XG4gICAgICAgIFxuICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgIHNob3dUb2FzdCgn5YiG5p6Q5oql5ZGK5bey5a+85Ye6JywgJ3N1Y2Nlc3MnKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCflr7zlh7rliIbmnpDnu5PmnpzlpLHotKU6JywgZXJyb3IpO1xuICAgICAgICBzaG93VG9hc3QoJ+WvvOWHuuWIhuaekOe7k+aenOWksei0pScsICdlcnJvcicpO1xuICAgIH1cbn0iXSwibmFtZXMiOlsiZ2V0RW52Q29uZmlnIiwiREVGQVVMVF9KSVJBX0ZJRUxEUyIsImdldEZpZWxkTWFwcGluZyIsInNoZWV0TmFtZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY2hyb21lIiwicnVudGltZSIsInNlbmRNZXNzYWdlIiwidHlwZSIsInJlc3BvbnNlIiwibGFzdEVycm9yIiwiY29uc29sZSIsImVycm9yIiwibWFwcGluZyIsImdldFNoZWV0SGVhZGVycyIsImhlYWRlcnMiLCJmZXRjaEppcmFUaWNrZXRzIiwianFsIiwicmVxdWVzdElkIiwiTWF0aCIsInJhbmRvbSIsInRvU3RyaW5nIiwic3Vic3RyaW5nIiwibWVzc2FnZUxpc3RlbmVyIiwibWVzc2FnZSIsImxvZyIsIm9uTWVzc2FnZSIsInJlbW92ZUxpc3RlbmVyIiwiRXJyb3IiLCJ0aWNrZXRzIiwiYWRkTGlzdGVuZXIiLCJGRVRDSF9KSVJBX1RJQ0tFVFMiLCJzb3VyY2VUYWJJZCIsImVudkNvbmZpZyIsInVybCIsIkpJUkFfQkFTRV9VUkwiLCJlbmNvZGVVUklDb21wb25lbnQiLCJ0YWJzIiwiY3JlYXRlIiwiYWN0aXZlIiwidGFiIiwiaWQiLCJjaGVja1BhZ2VMb2FkIiwiZ2V0IiwidXBkYXRlZFRhYiIsInN0YXR1cyIsInNjcmlwdGluZyIsImV4ZWN1dGVTY3JpcHQiLCJ0YXJnZXQiLCJ0YWJJZCIsImZ1bmMiLCJyb3dzIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsInJvdyIsInRpY2tldCIsImtleSIsInF1ZXJ5U2VsZWN0b3IiLCJ0ZXh0Q29udGVudCIsInRyaW0iLCJzdW1tYXJ5IiwiYXNzaWduZWUiLCJyZXBvcnRlciIsInByaW9yaXR5IiwiY3JlYXRlZCIsInVwZGF0ZWQiLCJkdWVkYXRlIiwiZGVzY3JpcHRpb24iLCJwdXNoIiwicmVzdWx0cyIsInJlc3VsdCIsIm1hcCIsInNwbGl0Iiwic2xpY2UiLCJyZW1vdmUiLCJzZXRUaW1lb3V0Iiwid3JpdGVUaWNrZXRzVG9TaGVldCIsImdldEluZGV4ZWREQkRhdGEiLCJkYXRhYmFzZU5hbWUiLCJzdG9yZU5hbWUiLCJyZXF1ZXN0IiwiaW5kZXhlZERCIiwib3BlbiIsIm9uc3VjY2VzcyIsImV2ZW50IiwiZGIiLCJ0cmFuc2FjdGlvbiIsIm9iamVjdFN0b3JlIiwiZGF0YVJlcXVlc3QiLCJnZXRBbGwiLCJvbmVycm9yIiwiZ2V0TG9jYWxTdG9yYWdlSXRlbSIsImRlZmF1bHRWYWx1ZSIsIkpTT04iLCJwYXJzZSIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJzdHJpbmdpZnkiLCJzZXRMb2NhbFN0b3JhZ2VJdGVtIiwic2V0SXRlbSIsImdldEN1cnJlbnRVc2VySW5mbyIsImV4dGVuc2lvbiIsImV4dGVuc2lvbklkIiwidXNlcm5hbWUiLCJnZXRGb2xkZXJzIiwidGhlbiIsIl9yZWYiLCJkYXRhIiwiZmF2b3JpdGVfZ3JvdXBfaWRzIiwiY29udmVyc2F0aW9uX3NldHMiLCJmb2xkZXJzIiwidGl0bGUiLCJpZHMiLCJmaWx0ZXIiLCJpdGVtIiwiY2F0Y2giLCJnZXRHcm91cHNNYXAiLCJncm91cHMiLCJncm91cHNNYXAiLCJyZWR1Y2UiLCJhY2MiLCJncm91cCIsIm5hbWUiLCJzZXRfYWJicmV2aWF0aW9uIiwiaXNfdGVhbSIsImZvcm1hdERhdGUiLCJkYXRlU3RyaW5nIiwiZGF0ZSIsIkRhdGUiLCJ5ZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsIlN0cmluZyIsImdldE1vbnRoIiwicGFkU3RhcnQiLCJkYXkiLCJnZXREYXRlIiwiaG91cnMiLCJnZXRIb3VycyIsIm1pbnV0ZXMiLCJnZXRNaW51dGVzIiwic2Vjb25kcyIsImdldFNlY29uZHMiLCJ1bmlxQnkiLCJhcnJheSIsInNlZW4iLCJTZXQiLCJrZXlWYWx1ZSIsImhhcyIsImFkZCIsInNob3dUb2FzdCIsIm9uQ2xvc2UiLCJjb250YWluZXIiLCJnZXRFbGVtZW50QnlJZCIsImV4aXN0aW5nVG9hc3QiLCJyZW1vdmVDaGlsZCIsInRvYXN0IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInRvYXN0SW5uZXIiLCJhcHBlbmRDaGlsZCIsInRpbWVyIiwiY29udGFpbnMiLCJjbGVhclRpbWVvdXQiLCJ0cmFuc2Zvcm1Hcm91cExpbmtzIiwiaW5wdXRTdHJpbmciLCJncm91cExpbmtQYXR0ZXJuIiwidHJhbnNmb3JtZWRTdHJpbmciLCJyZXBsYWNlIiwibWF0Y2giLCJncm91cE5hbWUiLCJncm91cElkIiwidHJhbnNmb3JtUG9zdExpbmtzIiwicG9zdExpbmtQYXR0ZXJuIiwiaW5kZXgiLCJwb3N0SWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwiZGVmYXVsdEVudkNvbmZpZyIsIlNDSEVEVUxFRF9JTlRFUlZBTCIsIk51bWJlciIsInByb2Nlc3MiLCJlbnYiLCJBTkFMWVNJU19UWVBFIiwiTExNX1RZUEUiLCJBTkFMWVpFX0JZX0dST1VQIiwiT0xMQU1BX0JBU0VfVVJMIiwiT0xMQU1BX01PREVMIiwiT0xMQU1BX1JFVklFV19NT0RFTCIsIk9MTEFNQV9RVUVSWV9NT0RFTCIsIkRJRllfQVBJX0tFWSIsIkRJRllfUkVWSUVXX0FQSV9LRVkiLCJESUZZX0FQSV9CQVNFX1VSTCIsIk9QRU5BSV9BUElfS0VZIiwiT1BFTkFJX01PREVMIiwiT1BFTkFJX1JFVklFV19NT0RFTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJHUk9RX0FQSV9LRVkiLCJHUk9RX01PREVMIiwiR1JPUV9SRVZJRVdfTU9ERUwiLCJCT1RfQVBJX0JBU0VfVVJMIiwiQk9UX1RPS0VOIiwiQk9UX0lEIiwiQk9UX1RZUEUiLCJURUFNX0lEIiwiRU5BQkxFX0JPVCIsIkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQiLCJFTkFCTEVfQ0hST01BIiwiQ0hST01BX0FQSV9VUkwiLCJDSFJPTUFfUE9SVCIsIkNIUk9NQV9DT0xMRUNUSU9OX05BTUUiLCJKSVJBX1VTRVJOQU1FIiwiSklSQV9BUElfVE9LRU4iLCJzdG9yYWdlIiwibG9jYWwiLCJnZXRVc2VySW5mbyIsImFjY291bnRVRCIsImFjY291bnRJbmZvTGlzdCIsImFjY291bnRJbmZvIiwiZmluZCIsImRpc3BsYXlOYW1lIiwiZW1haWwiLCJmdWxsTmFtZSIsImpvaW4iLCJ0b0xvd2VyQ2FzZSIsInVzZXJJbmZvIiwic2VuZGVyIiwic2VuZFJlc3BvbnNlIiwid2FybiIsIm9wZW5KcWxEaWFsb2ciLCJpbml0aWFsaXplIiwiaHJlZiIsImluY2x1ZGVzIiwiZW5hYmxlU2hlZXRzSW50ZWdyYXRpb24iLCJhZGRGbG9hdGluZ1Rvb2xiYXIiLCJ0b29sYmFyIiwic3R5bGUiLCJjc3NUZXh0IiwiY2xvc2VCdXR0b24iLCJhZGRFdmVudExpc3RlbmVyIiwiYm9keSIsInRpdGxlTGFiZWwiLCJxdWVyeUJ1dHRvbiIsInJlYWRCdXR0b24iLCJyZWFkU2hlZXREYXRhIiwibGVuZ3RoIiwic2V0Iiwic2hlZXREYXRhIiwiYW5hbHl6ZUJ1dHRvbiIsInNob3dEYXRhQW5hbHlzaXNEaWFsb2ciLCJkZWJ1Z0J1dHRvbiIsImRlYnVnR29vZ2xlU2hlZXRzRE9NIiwic2ltcGxlU2NhbkJ1dHRvbiIsInNjYW5WaXNpYmxlQ2VsbHMiLCJlbGVtZW50cyIsInRhYmxlcyIsImdyaWRzIiwiY2VsbHMiLCJjZWxsQ29udGVudHMiLCJzcHJlYWRzaGVldENvbnRhaW5lciIsInNoZWV0c0FwcCIsIlNIRUVUU19BUFAiLCJnb29nbGUiLCJzaGVldHMiLCJhcHAiLCJTaGVldHNBcHAiLCJkaWFsb2ciLCJoZWFkZXIiLCJtYXJnaW4iLCJjb250ZW50IiwiaW5uZXJIVE1MIiwiaGlnaGxpZ2h0RWxlbWVudCIsInNlbGVjdG9yIiwiY29sb3IiLCJlbCIsIm9yaWdpbmFsQmFja2dyb3VuZCIsImJhY2tncm91bmRDb2xvciIsIm9yaWdpbmFsT3V0bGluZSIsIm91dGxpbmUiLCJ2aWV3cG9ydFdpZHRoIiwiaW5uZXJXaWR0aCIsInZpZXdwb3J0SGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJvdmVybGF5Iiwic2hlZXRzQ29udGFpbmVyIiwiY2VsbHNEYXRhIiwid2Fsa0RPTSIsImVsZW1lbnQiLCJkZXB0aCIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsIm1heWJlQ2VsbCIsImlzQ2VsbEVsZW1lbnQiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiaXNWaXNpYmxlIiwid2lkdGgiLCJoZWlnaHQiLCJyaWdodCIsImxlZnQiLCJib3R0b20iLCJ0b3AiLCJ0ZXh0IiwieCIsInkiLCJBcnJheSIsImZyb20iLCJjaGlsZHJlbiIsImNoaWxkIiwiZ2V0QXR0cmlidXRlIiwiY2xhc3NMaXN0IiwiZ2V0Q29tcHV0ZWRTdHlsZSIsImRpc3BsYXkiLCJib3JkZXIiLCJib3JkZXJCb3R0b20iLCJib3JkZXJSaWdodCIsInNvcnQiLCJhIiwiYiIsInJvd1RocmVzaG9sZCIsImN1cnJlbnRSb3ciLCJsYXN0WSIsImNlbGwiLCJhYnMiLCJzaG93VGFibGVQcmV2aWV3IiwicGFyZW50Tm9kZSIsInRhYmxlIiwidGhlYWQiLCJoZWFkZXJSb3ciLCJ0aCIsInRib2R5IiwiaSIsInRkIiwiYnV0dG9uQ29udGFpbmVyIiwicmVhZHlTdGF0ZSIsInZhbHVlIiwiZmllbGRzIiwiZm9ybWF0dGVkRGF0YSIsImZpZWxkIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0IiwiaW5zZXJ0VGlja2V0c1RvQWN0aXZlU2hlZXQiLCJhbGVydCIsImFjdGl2ZUNlbGwiLCJzaG93R3VpZGVEaWFsb2ciLCJpbnNlcnREYXRhVmlhU2hlZXRzRG9tQXBpIiwiY29weVNlbGVjdGVkSGVhZGVycyIsImV4aXN0aW5nSGVhZGVycyIsImdldEV4aXN0aW5nSGVhZGVycyIsInVzZUV4aXN0aW5nSGVhZGVycyIsInZhbGlkSGVhZGVycyIsImZpbmRWYWxpZEppcmFIZWFkZXJzIiwiZmllbGROYW1lIiwiY29weVRvQ2xpcGJvYXJkIiwiYXR0ZW1wdEF1dG9QYXN0ZSIsInNob3dQYXN0ZUluc3RydWN0aW9ucyIsImNlbGxDb29yZGluYXRlcyIsImdldENlbGxDb29yZGluYXRlcyIsImdldFNoZWV0c0FwcEluc3RhbmNlIiwiaW5zZXJ0RGF0YSIsImNvbCIsImluamVjdERhdGFWaWFOYXRpdmVFdmVudHMiLCJyb3dBdHRyIiwiY29sQXR0ciIsInBhcnNlSW50Iiwicm93TWF0Y2giLCJjb2xNYXRjaCIsInJvd0hlaWdodCIsImNvbFdpZHRoIiwiZmxvb3IiLCJwYXJlbnQiLCJjbG9zZXN0Iiwic3RhcnRFZGl0IiwiTW91c2VFdmVudCIsImJ1YmJsZXMiLCJjYW5jZWxhYmxlIiwidmlldyIsImRpc3BhdGNoRXZlbnQiLCJlZGl0Qm94IiwidGVzdERhdGEiLCJFdmVudCIsImVudGVyRXZlbnQiLCJLZXlib2FyZEV2ZW50IiwiY29kZSIsImtleUNvZGUiLCJ3aGljaCIsImN1cnJlbnRTZWxlY3Rpb24iLCJmaXJzdENlbGwiLCJjbGljayIsImN0cmxLZXkiLCJ0ZW1wSW5wdXQiLCJwb3NpdGlvbiIsIm9wYWNpdHkiLCJmb2N1cyIsInN1Y2Nlc3MiLCJleGVjQ29tbWFuZCIsImdldFNlbGVjdGlvbiIsInJlbW92ZUFsbFJhbmdlcyIsImUiLCJyZWFkVGV4dCIsInNlbGVjdG9ycyIsInZpc2libGVDZWxscyIsInRhYmxlRWxlbWVudHMiLCJmaXJzdFRhYmxlIiwicm93RGF0YSIsImoiLCJjZWxsRGF0YU1hcCIsIk1hcCIsImh0bWxDZWxsIiwicm93RXN0aW1hdGUiLCJjb2xFc3RpbWF0ZSIsInNpemUiLCJtYXgiLCJ2YWx1ZXMiLCJjb2xzIiwiZmlsbCIsInNwcmVhZHNoZWV0SWQiLCJ0ZXh0QXJlYSIsInBhZGRpbmciLCJib3hTaGFkb3ciLCJiYWNrZ3JvdW5kIiwic2VsZWN0IiwiZXJyIiwiaXNTZWN1cmVDb250ZXh0IiwidGVtcEVsZW1lbnRzIiwidGFyZ2V0RWxlbWVudCIsImluc3RydWN0aW9ucyIsImRpYWxvZ0lkIiwibm93IiwiaGVhZGVyQ2VsbHMiLCJmaXJzdFJvd0NlbGxzIiwiYWxsVmlzaWJsZUNlbGxzIiwiY2FudmFzSGVhZGVycyIsImdldENhbnZhc0Jhc2VkSGVhZGVycyIsImdldEhlYWRlcnNCeUNsaXBib2FyZCIsImZpcnN0Um93U2VsZWN0b3IiLCJzaGlmdEtleSIsImNsaXBib2FyZENvbnRlbnQiLCJjYW52YXNFbGVtZW50Iiwic2VsZWN0ZWRDZWxscyIsImhlYWRlclRleHRzIiwiaW5uZXJUZXh0Iiwic2VsZWN0aW9uIiwiaXNDb2xsYXBzZWQiLCJwb3NzaWJsZUppcmFGaWVsZHMiLCJPYmplY3QiLCJrZXlzIiwiayIsImhlYWRlckxvd2VyIiwiaGVhZGVyTm9TcGFjZSIsImZpZWxkQWxpYXNlcyIsImFsaWFzZXMiLCJlbnRyaWVzIiwic29tZSIsImFsaWFzIiwiZiIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsImhlYWRlckRpdiIsInN0YXRzRGl2IiwiZGF0YVdpdGhvdXRIZWFkZXJzIiwicm93Q291bnQiLCJjb2xDb3VudCIsImNvbHVtbnNEaXYiLCJjb2xJbmRleCIsImNvbHVtblZhbHVlcyIsIkJvb2xlYW4iLCJjb2x1bW5EaXYiLCJpc051bWVyaWMiLCJldmVyeSIsInYiLCJpc05hTiIsInBhcnNlRmxvYXQiLCJpc0Zpbml0ZSIsIm51bWVyaWNWYWx1ZXMiLCJzdW0iLCJhdmciLCJtaW4iLCJ0b0ZpeGVkIiwidmFsdWVDb3VudHMiLCJ0b3BWYWx1ZXMiLCJjb3VudCIsImFjdGlvbnNEaXYiLCJleHBvcnRCdXR0b24iLCJleHBvcnRBbmFseXNpc1Jlc3VsdHMiLCJyZXBvcnQiLCJfcmVmMiIsImJsb2IiLCJCbG9iIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiZG93bmxvYWQiLCJyZXZva2VPYmplY3RVUkwiXSwic291cmNlUm9vdCI6IiJ9