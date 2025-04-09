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
        // await writeTicketsToSheet(tickets);
      } catch (error) {
        alert('查询失败: ' + error);
      }
    }
  });
}

// 添加显示 toast 的函数
function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.7);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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TCxRQUFRLENBQUN3TCxJQUFJLENBQUMzRSxXQUFXLENBQUNKLEtBQUssQ0FBQztFQUNoQzBGLHFCQUFxQixDQUFDLE1BQU07SUFDeEIxRixLQUFLLENBQUM0RSxLQUFLLENBQUNlLE9BQU8sR0FBRyxHQUFHO0VBQzdCLENBQUMsQ0FBQztFQUNGNUssVUFBVSxDQUFDLE1BQU07SUFDYmlGLEtBQUssQ0FBQzRFLEtBQUssQ0FBQ2UsT0FBTyxHQUFHLEdBQUc7SUFDekI1SyxVQUFVLENBQUMsTUFBTTtNQUNieEIsUUFBUSxDQUFDd0wsSUFBSSxDQUFDaEYsV0FBVyxDQUFDQyxLQUFLLENBQUM7SUFDcEMsQ0FBQyxFQUFFLEdBQUcsQ0FBQztFQUNYLENBQUMsRUFBRSxJQUFJLENBQUM7QUFDWixDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvZ29vZ2xlU2hlZXRzLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpLy4vc3JjL3N0b3JhZ2UudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvdXRpbHMudHMiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL2RlZmluZSBwcm9wZXJ0eSBnZXR0ZXJzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS8uL3NyYy9jb250ZW50U2NyaXB0R29vZ2xlU2hlZXQudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEppcmFUaWNrZXQgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGdldEVudkNvbmZpZyB9IGZyb20gJy4vdXRpbHMnO1xuXG4vLyDpu5jorqTnmoQgSmlyYSDlrZfmrrXphY3nva5cbmNvbnN0IERFRkFVTFRfSklSQV9GSUVMRFMgPSB7XG4gICdLZXknOiAna2V5JyxcbiAgJ1N1bW1hcnknOiAnc3VtbWFyeScsXG4gICdTdGF0dXMnOiAnc3RhdHVzJyxcbiAgJ0Fzc2lnbmVlJzogJ2Fzc2lnbmVlJyxcbiAgJ1JlcG9ydGVyJzogJ3JlcG9ydGVyJyxcbiAgJ1ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgJ0NyZWF0ZWQnOiAnY3JlYXRlZCcsXG4gICdVcGRhdGVkJzogJ3VwZGF0ZWQnLFxuICAnRHVlIERhdGUnOiAnZHVlZGF0ZScsXG4gICdEZXNjcmlwdGlvbic6ICdkZXNjcmlwdGlvbidcbn07XG5cbi8vIOS7jiBHb29nbGUgU2hlZXRzIOiOt+WPluaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEZpZWxkTWFwcGluZyhzaGVldE5hbWU6IHN0cmluZyk6IFByb21pc2U8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgIHR5cGU6ICdHRVRfU0hFRVRfQ09ORklHJyxcbiAgICAgIHNoZWV0TmFtZTogc2hlZXROYW1lXG4gICAgfSwgcmVzcG9uc2UgPT4ge1xuICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCfojrflj5bphY3nva7lpLHotKU6JywgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgcmVzb2x2ZShERUZBVUxUX0pJUkFfRklFTERTKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmVzb2x2ZShyZXNwb25zZT8ubWFwcGluZyB8fCBERUZBVUxUX0pJUkFfRklFTERTKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbi8vIOiOt+WPluW9k+WJjeW3peS9nOihqOeahOihqOWktFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNoZWV0SGVhZGVycygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgdHlwZTogJ0dFVF9TSEVFVF9IRUFERVJTJ1xuICAgIH0sIHJlc3BvbnNlID0+IHtcbiAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcign6I635Y+W6KGo5aS05aSx6LSlOicsIGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgIHJlamVjdChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXNvbHZlKHJlc3BvbnNlPy5oZWFkZXJzIHx8IFtdKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbi8vIOS7jiBKaXJhIOmhtemdouaKk+WPluaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoSmlyYVRpY2tldHMoanFsOiBzdHJpbmcpOiBQcm9taXNlPEppcmFUaWNrZXRbXT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZyg3KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOebkeWQrOadpeiHqiBiYWNrZ3JvdW5kIHNjcmlwdCDnmoTmtojmga9cbiAgICAgICAgY29uc3QgbWVzc2FnZUxpc3RlbmVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ21lc3NhZ2UxMTEnLCBtZXNzYWdlKTtcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdKSVJBX1RJQ0tFVFNfUkVTVUxUJyAmJiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gcmVxdWVzdElkKSB7XG4gICAgICAgICAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgICAgICAgICAgaWYgKG1lc3NhZ2UuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtZXNzYWdlLmVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLnRpY2tldHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgIFxuICAgICAgICAvLyDlj5HpgIHmtojmga/nu5kgYmFja2dyb3VuZCBzY3JpcHQg5p2l5Yib5bu65paw5qCH562+6aG1XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdGRVRDSF9KSVJBX1RJQ0tFVFMnLFxuICAgICAgICAgICAganFsLFxuICAgICAgICAgICAgcmVxdWVzdElkXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDnhLblkI7lnKggRkVUQ0hfSklSQV9USUNLRVRTIOWHveaVsOS4reS9v+eUqCBzb3VyY2VUYWJJZFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEZFVENIX0pJUkFfVElDS0VUUyhqcWw6IHN0cmluZywgcmVxdWVzdElkOiBzdHJpbmcsIHNvdXJjZVRhYklkOiBudW1iZXIpIHtcbiAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gIGNvbnN0IHVybCA9IGAke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9pc3N1ZXMvP2pxbD0ke2VuY29kZVVSSUNvbXBvbmVudChqcWwpfWA7XG4gICAgICAgIFxuICAvLyDliJvlu7rmlrDmoIfnrb7pobVcbiAgY2hyb21lLnRhYnMuY3JlYXRlKHsgdXJsLCBhY3RpdmU6IGZhbHNlIH0sICh0YWIpID0+IHtcbiAgICAgIGlmICghdGFiLmlkKSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgdHlwZTogJ0pJUkFfVElDS0VUU19SRVNVTFQnLFxuICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgIGVycm9yOiAn5peg5rOV5Yib5bu65qCH562+6aG1J1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8g562J5b6F6aG16Z2i5Yqg6L295a6M5oiQXG4gICAgICBjb25zdCBjaGVja1BhZ2VMb2FkID0gKCkgPT4ge1xuICAgICAgICAgIGNocm9tZS50YWJzLmdldCh0YWIuaWQhLCAodXBkYXRlZFRhYikgPT4ge1xuICAgICAgICAgICAgICBpZiAodXBkYXRlZFRhYi5zdGF0dXMgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgICAgICAgICAgICAgIC8vIOazqOWFpeWGheWuueiEmuacrFxuICAgICAgICAgICAgICAgICAgY2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHsgdGFiSWQ6IHRhYi5pZCEgfSxcbiAgICAgICAgICAgICAgICAgICAgICBmdW5jOiAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvd3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCd0ci5pc3N1ZXJvdycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm93cy5mb3JFYWNoKHJvdyA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aWNrZXQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5OiByb3cucXVlcnlTZWxlY3RvcignLmlzc3Vla2V5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5zdW1tYXJ5Jyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiByb3cucXVlcnlTZWxlY3RvcignLnN0YXR1cycpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2lnbmVlOiByb3cucXVlcnlTZWxlY3RvcignLmFzc2lnbmVlJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZXI6IHJvdy5xdWVyeVNlbGVjdG9yKCcucmVwb3J0ZXInKT8udGV4dENvbnRlbnQ/LnRyaW0oKSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogcm93LnF1ZXJ5U2VsZWN0b3IoJy5wcmlvcml0eScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcuY3JlYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZWQ6IHJvdy5xdWVyeVNlbGVjdG9yKCcudXBkYXRlZCcpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGR1ZWRhdGU6IHJvdy5xdWVyeVNlbGVjdG9yKCcuZHVlZGF0ZScpPy50ZXh0Q29udGVudD8udHJpbSgpIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiByb3cucXVlcnlTZWxlY3RvcignLmRlc2NyaXB0aW9uJyk/LnRleHRDb250ZW50Py50cmltKCkgfHwgJydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGlja2V0cztcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9LCAocmVzdWx0cykgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzWzBdLnJlc3VsdCA9IHJlc3VsdHNbMF0ucmVzdWx0Lm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAuLi50aWNrZXQsXG4gICAgICAgICAgICAgICAgICAgICAgc3VtbWFyeTogdGlja2V0LnN1bW1hcnkuc3BsaXQoJ1xcbicpLnNsaWNlKC0xKVswXS50cmltKCksXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2Uoc291cmNlVGFiSWQsIHtcbiAgICAgICAgICAgICAgICAgICAgLy8g5Y+R6YCB57uT5p6c5Zue5rqQ5qCH562+6aG1XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnSklSQV9USUNLRVRTX1JFU1VMVCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aWNrZXRzOiByZXN1bHRzWzBdLnJlc3VsdFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIOWFs+mXrSBKaXJhIOagh+etvumhtVxuICAgICAgICAgICAgICAgICAgICBjaHJvbWUudGFicy5yZW1vdmUodGFiLmlkISk7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoY2hlY2tQYWdlTG9hZCwgMTAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgY2hlY2tQYWdlTG9hZCgpO1xuICB9KTtcbn1cblxuLy8g5bCGIEppcmEgdGlja2V0cyDlhpnlhaUgR29vZ2xlIFNoZWV0XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVUaWNrZXRzVG9TaGVldCh0aWNrZXRzOiBKaXJhVGlja2V0W10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XG4gICAgICB0eXBlOiAnV1JJVEVfVElDS0VUUycsXG4gICAgICB0aWNrZXRzOiB0aWNrZXRzXG4gICAgfSwgcmVzcG9uc2UgPT4ge1xuICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCflhpnlhaXmlbDmja7lpLHotKU6JywgY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKTtcbiAgICAgICAgcmVqZWN0KGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHJlc29sdmUoKTtcbiAgICB9KTtcbiAgfSk7XG59IiwiZXhwb3J0IGZ1bmN0aW9uIGdldEluZGV4ZWREQkRhdGEoZGF0YWJhc2VOYW1lOiBzdHJpbmcsIHN0b3JlTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oZGF0YWJhc2VOYW1lKTtcbiAgICBcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoZXZlbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgdHJhbnNhY3Rpb24gPSBkYi50cmFuc2FjdGlvbihbc3RvcmVOYW1lXSwgJ3JlYWRvbmx5Jyk7XG4gICAgICAgICAgICBjb25zdCBvYmplY3RTdG9yZSA9IHRyYW5zYWN0aW9uLm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XG4gICAgICAgICAgICBjb25zdCBkYXRhUmVxdWVzdCA9IG9iamVjdFN0b3JlLmdldEFsbCgpO1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25zdWNjZXNzID0gKGV2ZW50OiBhbnkpID0+IHtcbiAgICAgICAgICAgIHJlc29sdmUoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XG4gICAgICAgICAgICB9O1xuICAgIFxuICAgICAgICAgICAgZGF0YVJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH07XG4gICAgXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9IChldmVudDogYW55KSA9PiB7XG4gICAgICAgICAgICByZWplY3QoZXZlbnQudGFyZ2V0LmVycm9yKTtcbiAgICAgICAgfTtcbiAgICB9KTtcbn1cblxuXG5leHBvcnQgY29uc3QgZ2V0TG9jYWxTdG9yYWdlSXRlbSA9IChrZXk6IHN0cmluZywgZGVmYXVsdFZhbHVlOiBhbnkpID0+IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbShrZXkpIHx8IEpTT04uc3RyaW5naWZ5KGRlZmF1bHRWYWx1ZSkpO1xufTtcblxuZXhwb3J0IGNvbnN0IHNldExvY2FsU3RvcmFnZUl0ZW0gPSAoa2V5OiBzdHJpbmcsIGRlZmF1bHRWYWx1ZTogYW55KSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oa2V5LCBKU09OLnN0cmluZ2lmeShkZWZhdWx0VmFsdWUpKTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDdXJyZW50VXNlckluZm8oKSB7XG4gICAgY29uc3QgeyBleHRlbnNpb246IGV4dGVuc2lvbklkIH0gPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdvd25FeHRlbnNpb24nLCB7fSk7XG4gICAgY29uc3QgdXNlcm5hbWUgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdkaXNwbGF5TmFtZScsICdyYWRhci1wb2MnKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBleHRlbnNpb25JZCxcbiAgICAgICAgdXNlcm5hbWVcbiAgICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Rm9sZGVycygpIHtcbiAgICByZXR1cm4gZ2V0SW5kZXhlZERCRGF0YSgnR2xpcCcsICdwcm9maWxlJykudGhlbigoW2RhdGFdKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmYXZvcml0ZV9ncm91cF9pZHMgPSBkYXRhPy5mYXZvcml0ZV9ncm91cF9pZHMgfHwgW107XG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25fc2V0cyA9IGRhdGE/LmNvbnZlcnNhdGlvbl9zZXRzIHx8IFtdO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3QgZm9sZGVycyA9IFt7dGl0bGU6ICcgJywgaWRzOiBbXX0se3RpdGxlOiAnZmF2b3JpdGUnLCBpZHM6IGZhdm9yaXRlX2dyb3VwX2lkc30sIC4uLmNvbnZlcnNhdGlvbl9zZXRzLmZpbHRlcihpdGVtID0+IGl0ZW0udHlwZSA9PT0gJ2ZvbGRlcicpXVxuICAgICAgICAgICAgcmV0dXJuIGZvbGRlcnM7XG4gICAgICAgIH0pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0R3JvdXBzTWFwKCkge1xuICAgIHJldHVybiBnZXRJbmRleGVkREJEYXRhKCdHbGlwJywgJ2dyb3VwJykudGhlbigoZ3JvdXBzKSA9PiB7XG4gICAgICAgIGNvbnN0IGdyb3Vwc01hcCA9IGdyb3Vwcy5yZWR1Y2UoKGFjYzogYW55LCBncm91cDogYW55KSA9PiB7XG4gICAgICAgICAgICBhY2NbZ3JvdXAuaWRdID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLnNldF9hYmJyZXZpYXRpb24sXG4gICAgICAgICAgICAgICAgaXNfdGVhbTogZ3JvdXAuaXNfdGVhbVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sIHt9KTtcblxuICAgICAgICByZXR1cm4gZ3JvdXBzTWFwO1xuICAgIH0pO1xufSIsImltcG9ydCB7IGdldEN1cnJlbnRVc2VySW5mbywgZ2V0TG9jYWxTdG9yYWdlSXRlbSB9IGZyb20gXCIuL3N0b3JhZ2VcIjtcblxuLy8g546v5aKD6YWN572u57G75Z6L5a6a5LmJXG5leHBvcnQgaW50ZXJmYWNlIEVudkNvbmZpZ1R5cGUge1xuICBTQ0hFRFVMRURfSU5URVJWQUw6IG51bWJlcjtcbiAgQU5BTFlTSVNfVFlQRTogc3RyaW5nO1xuICBBTkFMWVpFX0JZX0dST1VQOiBib29sZWFuO1xuICBMTE1fVFlQRTogc3RyaW5nO1xuICBPTExBTUFfQkFTRV9VUkw6IHN0cmluZztcbiAgT0xMQU1BX01PREVMOiBzdHJpbmc7XG4gIE9MTEFNQV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgT0xMQU1BX1FVRVJZX01PREVMOiBzdHJpbmc7XG4gIERJRllfQVBJX0tFWTogc3RyaW5nO1xuICBESUZZX1JFVklFV19BUElfS0VZOiBzdHJpbmc7XG4gIERJRllfQVBJX0JBU0VfVVJMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfS0VZOiBzdHJpbmc7XG4gIE9QRU5BSV9NT0RFTDogc3RyaW5nO1xuICBPUEVOQUlfUkVWSUVXX01PREVMOiBzdHJpbmc7XG4gIE9QRU5BSV9BUElfQkFTRV9VUkw6IHN0cmluZztcbiAgR1JPUV9BUElfS0VZOiBzdHJpbmc7XG4gIEdST1FfTU9ERUw6IHN0cmluZztcbiAgR1JPUV9SRVZJRVdfTU9ERUw6IHN0cmluZztcbiAgQk9UX0FQSV9CQVNFX1VSTDogc3RyaW5nO1xuICBCT1RfVE9LRU46IHN0cmluZztcbiAgQk9UX0lEOiBzdHJpbmc7XG4gIEJPVF9UWVBFOiBzdHJpbmc7XG4gIFRFQU1fSUQ6IHN0cmluZztcbiAgRU5BQkxFX0JPVDogYm9vbGVhbjtcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogYm9vbGVhbjtcbiAgRU5BQkxFX0NIUk9NQTogYm9vbGVhbjtcbiAgQ0hST01BX0FQSV9VUkw6IHN0cmluZztcbiAgQ0hST01BX1BPUlQ6IG51bWJlcjtcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogc3RyaW5nO1xuICAvLyBKSVJB55u45YWz6YWN572uXG4gIEpJUkFfQkFTRV9VUkw/OiBzdHJpbmc7XG4gIEpJUkFfVVNFUk5BTUU/OiBzdHJpbmc7XG4gIEpJUkFfQVBJX1RPS0VOPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gICAgXG4gICAgY29uc3QgeWVhciA9IGRhdGUuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBtb250aCA9IFN0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpO1xuICAgIGNvbnN0IGRheSA9IFN0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBob3VycyA9IFN0cmluZyhkYXRlLmdldEhvdXJzKCkpLnBhZFN0YXJ0KDIsICcwJyk7XG4gICAgY29uc3QgbWludXRlcyA9IFN0cmluZyhkYXRlLmdldE1pbnV0ZXMoKSkucGFkU3RhcnQoMiwgJzAnKTtcbiAgICBjb25zdCBzZWNvbmRzID0gU3RyaW5nKGRhdGUuZ2V0U2Vjb25kcygpKS5wYWRTdGFydCgyLCAnMCcpO1xuICBcbiAgICByZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9ICR7aG91cnN9OiR7bWludXRlc306JHtzZWNvbmRzfWA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxQnkoYXJyYXk6IGFueVtdLCBrZXk6IHN0cmluZykge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0KCk7XG4gICAgcmV0dXJuIGFycmF5LmZpbHRlcihpdGVtID0+IHtcbiAgICAgIGNvbnN0IGtleVZhbHVlID0gaXRlbVtrZXldO1xuICAgICAgaWYgKHNlZW4uaGFzKGtleVZhbHVlKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWVuLmFkZChrZXlWYWx1ZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgb25DbG9zZT86ICgpID0+IHZvaWQpIHtcbiAgLy8g6I635Y+W5oiW5Yib5bu65a655Zmo5YWD57SgXG4gIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyYWRhci1wb2MtcmVzdWx0Jyk7XG4gIGlmICghY29udGFpbmVyKSByZXR1cm5cblxuICAvLyDnp7vpmaTnjrDmnInnmoQgVG9hc3Qg5YWD57SgXG4gIGNvbnN0IGV4aXN0aW5nVG9hc3QgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignLnJhZGFyLXBvYy10b2FzdCcpO1xuICBpZiAoZXhpc3RpbmdUb2FzdCkge1xuICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChleGlzdGluZ1RvYXN0KTtcbiAgfVxuXG4gIC8vIOWIm+W7uuaWsOeahCBUb2FzdCDlhYPntKBcbiAgY29uc3QgdG9hc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gYHJhZGFyLXBvYy10b2FzdCByYWRhci1wb2MtdG9hc3QtJHt0eXBlfWA7XG5cbiAgY29uc3QgdG9hc3RJbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b2FzdElubmVyLmNsYXNzTmFtZSA9ICdyYWRhci1wb2MtdG9hc3QtaW5uZXInO1xuICB0b2FzdElubmVyLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblxuICB0b2FzdC5hcHBlbmRDaGlsZCh0b2FzdElubmVyKTtcbiAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvYXN0KTtcblxuICAvLyDorr7nva7lrprml7blmajlnKggMyDnp5LlkI7lhbPpl60gVG9hc3RcbiAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICBpZiAoY29udGFpbmVyLmNvbnRhaW5zKHRvYXN0KSkge1xuICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICB9XG4gICAgaWYgKG9uQ2xvc2UpIHtcbiAgICAgIG9uQ2xvc2UoKTtcbiAgICB9XG4gIH0sIDMwMDApO1xuXG4gIC8vIOi/lOWbnuS4gOS4quWHveaVsOS7peS+v+aJi+WKqOWFs+mXrSBUb2FzdFxuICByZXR1cm4gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgaWYgKGNvbnRhaW5lci5jb250YWlucyh0b2FzdCkpIHtcbiAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZCh0b2FzdCk7XG4gICAgfVxuICAgIGlmIChvbkNsb3NlKSB7XG4gICAgICBvbkNsb3NlKCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtR3JvdXBMaW5rcyhpbnB1dFN0cmluZzogc3RyaW5nKSB7XG4gIGNvbnN0IGdyb3VwTGlua1BhdHRlcm4gPSAvXFxbZ3JvdXA6KC4rKTooXFxkKylcXF0vZztcbiAgY29uc3QgdHJhbnNmb3JtZWRTdHJpbmcgPSBpbnB1dFN0cmluZy5yZXBsYWNlKGdyb3VwTGlua1BhdHRlcm4sIChtYXRjaCwgZ3JvdXBOYW1lLCBncm91cElkKSA9PiB7XG4gICAgcmV0dXJuIGBbJHtncm91cE5hbWV9XSgvbWVzc2FnZXMvJHtncm91cElkfSlgO1xuICB9KTtcbiAgcmV0dXJuIHRyYW5zZm9ybWVkU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNmb3JtUG9zdExpbmtzKGlucHV0U3RyaW5nOiBzdHJpbmcpIHtcbiAgY29uc3QgcG9zdExpbmtQYXR0ZXJuID0gL1xcW3Bvc3Q6KFxcZCspXFxdL2c7XG4gIGxldCBpbmRleCA9IDE7XG4gIGNvbnN0IHRyYW5zZm9ybWVkU3RyaW5nID0gaW5wdXRTdHJpbmcucmVwbGFjZShwb3N0TGlua1BhdHRlcm4sIChtYXRjaCwgcG9zdElkKSA9PiB7XG4gICAgcmV0dXJuIGBbWyR7aW5kZXgrK31dXSgvbCR7d2luZG93LmxvY2F0aW9uLnBhdGhuYW1lfS8ke3Bvc3RJZH0pYDtcbiAgfSk7XG4gIHJldHVybiB0cmFuc2Zvcm1lZFN0cmluZztcbn1cblxuLy8g6buY6K6k546v5aKD6YWN572uXG5leHBvcnQgY29uc3QgZGVmYXVsdEVudkNvbmZpZzogRW52Q29uZmlnVHlwZSA9IHtcbiAgU0NIRURVTEVEX0lOVEVSVkFMOiBOdW1iZXIocHJvY2Vzcy5lbnYuU0NIRURVTEVEX0lOVEVSVkFMKSB8fCAxMjAsXG4gIEFOQUxZU0lTX1RZUEU6IHByb2Nlc3MuZW52LkFOQUxZU0lTX1RZUEUgfHwgXCJmaWx0ZXJcIixcbiAgTExNX1RZUEU6IHByb2Nlc3MuZW52LkxMTV9UWVBFIHx8IFwiZGlmeVwiLFxuICBBTkFMWVpFX0JZX0dST1VQOiBwcm9jZXNzLmVudi5BTkFMWVpFX0JZX0dST1VQID09PSBcInRydWVcIixcbiAgT0xMQU1BX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5PTExBTUFfQkFTRV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjExNDM0XCIsXG4gIE9MTEFNQV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX01PREVMIHx8IFwiZGVlcHNlZWstcjFcIixcbiAgT0xMQU1BX1JFVklFV19NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1JFVklFV19NT0RFTCB8fCBcImxsYW1hMy4xXCIsXG4gIE9MTEFNQV9RVUVSWV9NT0RFTDogcHJvY2Vzcy5lbnYuT0xMQU1BX1FVRVJZX01PREVMIHx8IFwibGxhbWEzLjFcIixcbiAgRElGWV9BUElfS0VZOiBwcm9jZXNzLmVudi5ESUZZX0FQSV9LRVkgfHwgXCJcIixcbiAgRElGWV9SRVZJRVdfQVBJX0tFWTogcHJvY2Vzcy5lbnYuRElGWV9SRVZJRVdfQVBJX0tFWSB8fCBcIlwiLFxuICBESUZZX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuRElGWV9BUElfQkFTRV9VUkwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9LRVk6IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZIHx8IFwiXCIsXG4gIE9QRU5BSV9NT0RFTDogcHJvY2Vzcy5lbnYuT1BFTkFJX01PREVMIHx8IFwiXCIsXG4gIE9QRU5BSV9SRVZJRVdfTU9ERUw6IHByb2Nlc3MuZW52Lk9QRU5BSV9SRVZJRVdfTU9ERUwgfHwgXCJcIixcbiAgT1BFTkFJX0FQSV9CQVNFX1VSTDogcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9CQVNFX1VSTCB8fCBcIlwiLFxuICBHUk9RX0FQSV9LRVk6IHByb2Nlc3MuZW52LkdST1FfQVBJX0tFWSB8fCBcIlwiLFxuICBHUk9RX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX01PREVMIHx8IFwiXCIsXG4gIEdST1FfUkVWSUVXX01PREVMOiBwcm9jZXNzLmVudi5HUk9RX1JFVklFV19NT0RFTCB8fCBcIlwiLFxuICBCT1RfQVBJX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5CT1RfQVBJX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly9ib3RtYW4uaW50LnJjbGFiZW52LmNvbS92MlwiLFxuICBCT1RfVE9LRU46IHByb2Nlc3MuZW52LkJPVF9UT0tFTiB8fCBcIlwiLFxuICBCT1RfSUQ6IHByb2Nlc3MuZW52LkJPVF9JRCB8fCBcIjQ3MDAzNzIwMjBAMzc0Mzk1MTAuYm90LmdsaXAubmV0XCIsXG4gIEJPVF9UWVBFOiBwcm9jZXNzLmVudi5CT1RfVFlQRSB8fCBcInVzZXJcIixcbiAgVEVBTV9JRDogcHJvY2Vzcy5lbnYuVEVBTV9JRCB8fCBcIlwiLFxuICBFTkFCTEVfQk9UOiBwcm9jZXNzLmVudi5FTkFCTEVfQk9UID09PSBcInRydWVcIixcbiAgTExNX1JFVklFV19CRUZPUkVfU0VORDogcHJvY2Vzcy5lbnYuTExNX1JFVklFV19CRUZPUkVfU0VORCA9PT0gXCJ0cnVlXCIsXG4gIEVOQUJMRV9DSFJPTUE6IHByb2Nlc3MuZW52LkVOQUJMRV9DSFJPTUEgPT09IFwidHJ1ZVwiLFxuICBDSFJPTUFfQVBJX1VSTDogcHJvY2Vzcy5lbnYuQ0hST01BX0FQSV9VUkwgfHwgXCJodHRwOi8vbG9jYWxob3N0OjgwMDBcIixcbiAgQ0hST01BX1BPUlQ6IE51bWJlcihwcm9jZXNzLmVudi5DSFJPTUFfUE9SVCkgfHwgODAwMCxcbiAgQ0hST01BX0NPTExFQ1RJT05fTkFNRTogcHJvY2Vzcy5lbnYuQ0hST01BX0NPTExFQ1RJT05fTkFNRSB8fCBcIlwiLFxuICBKSVJBX0JBU0VfVVJMOiBwcm9jZXNzLmVudi5KSVJBX0JBU0VfVVJMIHx8IFwiXCIsXG4gIEpJUkFfVVNFUk5BTUU6IHByb2Nlc3MuZW52LkpJUkFfVVNFUk5BTUUgfHwgXCJcIixcbiAgSklSQV9BUElfVE9LRU46IHByb2Nlc3MuZW52LkpJUkFfQVBJX1RPS0VOIHx8IFwiXCIsXG59O1xuXG4vLyDojrflj5bnjq/looPphY3nva7vvIzlpoLmnpzlj6/og73nmoTor53ku44gc3RvcmFnZSDojrflj5bvvIzlkKbliJnku44gcHJvY2Vzcy5lbnYg6I635Y+WXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RW52Q29uZmlnKCk6IFByb21pc2U8RW52Q29uZmlnVHlwZT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgZW52Q29uZmlnIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydlbnZDb25maWcnXSk7XG4gICAgaWYgKGVudkNvbmZpZykge1xuICAgICAgLy8g5bCG5a2Y5YKo55qE6YWN572u5LiO6buY6K6k6YWN572u5ZCI5bm277yM56Gu5L+d5paw5aKe55qE6YWN572u6aG55Lmf5Lya6KKr5YyF5ZCrXG4gICAgICByZXR1cm4geyAuLi5kZWZhdWx0RW52Q29uZmlnLCAuLi5lbnZDb25maWcgfTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcign6I635Y+W6YWN572u5aSx6LSlOicsIGVycm9yKTtcbiAgfVxuICBcbiAgLy8g5aaC5p6c6I635Y+W5aSx6LSl5oiW5rKh5pyJ5L+d5a2Y55qE6YWN572u77yM6L+U5Zue6buY6K6k5YC8XG4gIHJldHVybiBkZWZhdWx0RW52Q29uZmlnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXNlckluZm8oKSB7XG4gIGNvbnN0IGFjY291bnRVRCA9IGdldExvY2FsU3RvcmFnZUl0ZW0oJ2dsb2JhbC5hY2NvdW50LlVEJywgJycpO1xuICBjb25zdCBhY2NvdW50SW5mb0xpc3QgPSBnZXRMb2NhbFN0b3JhZ2VJdGVtKCdnbG9iYWwuYWNjb3VudC5BQ0NPVU5UX1NFU1NJT05fREFUQV9MSVNUJywge30pO1xuXG4gIGNvbnN0IGFjY291bnRJbmZvID0gYWNjb3VudFVEID8gYWNjb3VudEluZm9MaXN0W2FjY291bnRVRF0gOiBhY2NvdW50SW5mb0xpc3QuZmluZCgoaXRlbTphbnkpID0+IGl0ZW0uZGlzcGxheU5hbWUgIT0gJycpO1xuICBjb25zb2xlLmxvZygnYWNjb3VudEluZm9MaXN0JywgYWNjb3VudEluZm9MaXN0LCBhY2NvdW50SW5mbyk7XG4gIGlmIChhY2NvdW50SW5mbykgcmV0dXJuIHtcbiAgICBleHRlbnNpb25JZDogYWNjb3VudEluZm8uZXh0ZW5zaW9uSWQsXG4gICAgZW1haWw6IGFjY291bnRJbmZvLmVtYWlsLFxuICAgIGZ1bGxOYW1lOiBhY2NvdW50SW5mby5kaXNwbGF5TmFtZSxcbiAgICB1c2VybmFtZTogYWNjb3VudEluZm8uZW1haWwgPyBhY2NvdW50SW5mby5lbWFpbC50cmltKCkuc3BsaXQoJ0AnKVswXSA6IGFjY291bnRJbmZvLmRpc3BsYXlOYW1lLnRyaW0oKS5zcGxpdCgnICcpLmpvaW4oJy4nKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05X1xcLS5dL2csICcnKSxcbiAgfVxuXG4gIGNvbnN0IHVzZXJJbmZvID0gZ2V0Q3VycmVudFVzZXJJbmZvKCk7XG4gIHJldHVybiB7XG4gICAgZXh0ZW5zaW9uSWQ6IHVzZXJJbmZvLmV4dGVuc2lvbklkLFxuICAgIGZ1bGxOYW1lOiB1c2VySW5mby51c2VybmFtZSxcbiAgICB1c2VybmFtZTogdXNlckluZm8udXNlcm5hbWUudHJpbSgpLnNwbGl0KCcgJykuam9pbignLicpLnRvTG93ZXJDYXNlKCkucmVwbGFjZSgvW15hLXowLTlfXFwtLl0vZywgJycpLFxuICAgIGVtYWlsOiB1c2VySW5mby51c2VybmFtZS50cmltKCkuc3BsaXQoJyAnKS5qb2luKCcuJykudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOV9cXC0uXS9nLCAnJykgKyAnQHJpbmdjZW50cmFsLmNvbSdcbiAgfTtcbn1cblxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgeyBmZXRjaEppcmFUaWNrZXRzLCB3cml0ZVRpY2tldHNUb1NoZWV0IH0gZnJvbSAnLi9nb29nbGVTaGVldHMnO1xuaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0RW52Q29uZmlnIH0gZnJvbSAnLi91dGlscyc7XG5cbi8vIE1haW4gbGlzdGVuZXJcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBjb25zb2xlLmxvZygn5pS25Yiw5raI5oGvOicsIG1lc3NhZ2UsICflj5HpgIHogIU6Jywgc2VuZGVyKTtcblxuICAgIGlmICghbWVzc2FnZSB8fCAhbWVzc2FnZS50eXBlKSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign5pS25Yiw5peg5pWI5raI5oGv5qC85byPJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB7IHR5cGUgfSA9IG1lc3NhZ2U7XG5cbiAgICBpZiAodHlwZSA9PT0gJ09QRU5fSklSQV9RVUVSWV9ESUFMT0cnKSB7XG4gICAgICAgIG9wZW5KcWxEaWFsb2coKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTsgLy8g5Li65omA5pyJ5raI5oGv5L+d5oyB5raI5oGv6YCa6YGT5byA5ZCvXG59KTtcblxuLy8g5Yib5bu6IEpRTCDmn6Xor6Llr7nor53moYZcbmFzeW5jIGZ1bmN0aW9uIG9wZW5KcWxEaWFsb2coKSB7XG4gICAgY29uc3QgZW52Q29uZmlnID0gYXdhaXQgZ2V0RW52Q29uZmlnKCk7XG4gICAgY29uc3QgZGlhbG9nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgZGlhbG9nLnN0eWxlLmNzc1RleHQgPSBgXG4gICAgICAgIHBvc2l0aW9uOiBmaXhlZDtcbiAgICAgICAgdG9wOiA1MCU7XG4gICAgICAgIGxlZnQ6IDUwJTtcbiAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICBib3JkZXItcmFkaXVzOiA4cHg7XG4gICAgICAgIGJveC1zaGFkb3c6IDAgMnB4IDEwcHggcmdiYSgwLDAsMCwwLjEpO1xuICAgICAgICB6LWluZGV4OiAxMDAwMDtcbiAgICAgICAgd2lkdGg6IDQwMHB4O1xuICAgIGA7XG5cbiAgICBkaWFsb2cuaW5uZXJIVE1MID0gYFxuICAgICAgICA8aDMgc3R5bGU9XCJtYXJnaW4tdG9wOiAwO1wiPui+k+WFpSBKUUwg5p+l6K+iPC9oMz5cbiAgICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj48L3RleHRhcmVhPlxuICAgICAgICA8ZGl2IHN0eWxlPVwiZGlzcGxheTogZmxleDsganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcIj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJjYW5jZWxcIiBzdHlsZT1cIm1hcmdpbi1yaWdodDogMTBweDtcIj7lj5bmtog8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCJzdWJtaXRcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgYDtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGlhbG9nKTtcblxuICAgIC8vIOa3u+WKoOS6i+S7tuebkeWQrOWZqFxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW5jZWwnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdWJtaXQnKT8uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGpxbCA9IChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanFsJykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCkudmFsdWU7XG4gICAgICAgIGlmIChqcWwpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndGlja2V0cycsIHRpY2tldHMpO1xuICAgICAgICAgICAgICAgIGlmICh0aWNrZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmllbGRzID0gWydrZXknLCAnc3VtbWFyeScsICdzdGF0dXMnLCAnYXNzaWduZWUnLCAncmVwb3J0ZXInXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IGZpZWxkcy5qb2luKCdcXHQnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkRGF0YSA9IFtoZWFkZXJzLCAuLi50aWNrZXRzLm1hcCh0aWNrZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnRpY2tldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGtleTogYD1IWVBFUkxJTksoXCIke2VudkNvbmZpZy5KSVJBX0JBU0VfVVJMfS9icm93c2UvJHt0aWNrZXQua2V5fVwiLCBcIiR7dGlja2V0LmtleX1cIilgXG4gICAgICAgICAgICAgICAgICAgICAgfSkpLm1hcCh0aWNrZXQgPT4gZmllbGRzLm1hcChmaWVsZCA9PiB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0pLmpvaW4oJ1xcdCcpKV0uam9pbignXFxuJyk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZm9ybWF0dGVkRGF0YScsIGZvcm1hdHRlZERhdGEpO1xuICAgICAgICAgICAgICAgICAgICBzaG93VG9hc3QoJ0ppcmEg5pWw5o2u5bey5aSN5Yi25Yiw5Ymq6LS05p2/Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoZGlhbG9nKTtcbiAgICAgICAgICAgICAgICAvLyBhd2FpdCB3cml0ZVRpY2tldHNUb1NoZWV0KHRpY2tldHMpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBhbGVydCgn5p+l6K+i5aSx6LSlOiAnICsgZXJyb3IpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbi8vIOa3u+WKoOaYvuekuiB0b2FzdCDnmoTlh73mlbBcbmZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgICB0b2FzdC5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIGJvdHRvbTogMjBweDtcbiAgICAgICAgbGVmdDogNTAlO1xuICAgICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVgoLTUwJSk7XG4gICAgICAgIGJhY2tncm91bmQ6IHJnYmEoMCwgMCwgMCwgMC43KTtcbiAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICBwYWRkaW5nOiAxMHB4IDIwcHg7XG4gICAgICAgIGJvcmRlci1yYWRpdXM6IDVweDtcbiAgICAgICAgYm94LXNoYWRvdzogMCAycHggNXB4IHJnYmEoMCwgMCwgMCwgMC4yKTtcbiAgICAgICAgei1pbmRleDogMTAwMDE7XG4gICAgICAgIG9wYWNpdHk6IDA7XG4gICAgICAgIHRyYW5zaXRpb246IG9wYWNpdHkgMC4zcyBlYXNlO1xuICAgIGA7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b2FzdCk7XG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgdG9hc3Quc3R5bGUub3BhY2l0eSA9ICcxJztcbiAgICB9KTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgdG9hc3Quc3R5bGUub3BhY2l0eSA9ICcwJztcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRvYXN0KTtcbiAgICAgICAgfSwgMzAwKTtcbiAgICB9LCAzMDAwKTtcbn0iXSwibmFtZXMiOlsiZ2V0RW52Q29uZmlnIiwiREVGQVVMVF9KSVJBX0ZJRUxEUyIsImdldEZpZWxkTWFwcGluZyIsInNoZWV0TmFtZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY2hyb21lIiwicnVudGltZSIsInNlbmRNZXNzYWdlIiwidHlwZSIsInJlc3BvbnNlIiwibGFzdEVycm9yIiwiY29uc29sZSIsImVycm9yIiwibWFwcGluZyIsImdldFNoZWV0SGVhZGVycyIsImhlYWRlcnMiLCJmZXRjaEppcmFUaWNrZXRzIiwianFsIiwicmVxdWVzdElkIiwiTWF0aCIsInJhbmRvbSIsInRvU3RyaW5nIiwic3Vic3RyaW5nIiwibWVzc2FnZUxpc3RlbmVyIiwibWVzc2FnZSIsImxvZyIsIm9uTWVzc2FnZSIsInJlbW92ZUxpc3RlbmVyIiwiRXJyb3IiLCJ0aWNrZXRzIiwiYWRkTGlzdGVuZXIiLCJGRVRDSF9KSVJBX1RJQ0tFVFMiLCJzb3VyY2VUYWJJZCIsImVudkNvbmZpZyIsInVybCIsIkpJUkFfQkFTRV9VUkwiLCJlbmNvZGVVUklDb21wb25lbnQiLCJ0YWJzIiwiY3JlYXRlIiwiYWN0aXZlIiwidGFiIiwiaWQiLCJjaGVja1BhZ2VMb2FkIiwiZ2V0IiwidXBkYXRlZFRhYiIsInN0YXR1cyIsInNjcmlwdGluZyIsImV4ZWN1dGVTY3JpcHQiLCJ0YXJnZXQiLCJ0YWJJZCIsImZ1bmMiLCJyb3dzIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsInJvdyIsInRpY2tldCIsImtleSIsInF1ZXJ5U2VsZWN0b3IiLCJ0ZXh0Q29udGVudCIsInRyaW0iLCJzdW1tYXJ5IiwiYXNzaWduZWUiLCJyZXBvcnRlciIsInByaW9yaXR5IiwiY3JlYXRlZCIsInVwZGF0ZWQiLCJkdWVkYXRlIiwiZGVzY3JpcHRpb24iLCJwdXNoIiwicmVzdWx0cyIsInJlc3VsdCIsIm1hcCIsInNwbGl0Iiwic2xpY2UiLCJyZW1vdmUiLCJzZXRUaW1lb3V0Iiwid3JpdGVUaWNrZXRzVG9TaGVldCIsImdldEluZGV4ZWREQkRhdGEiLCJkYXRhYmFzZU5hbWUiLCJzdG9yZU5hbWUiLCJyZXF1ZXN0IiwiaW5kZXhlZERCIiwib3BlbiIsIm9uc3VjY2VzcyIsImV2ZW50IiwiZGIiLCJ0cmFuc2FjdGlvbiIsIm9iamVjdFN0b3JlIiwiZGF0YVJlcXVlc3QiLCJnZXRBbGwiLCJvbmVycm9yIiwiZ2V0TG9jYWxTdG9yYWdlSXRlbSIsImRlZmF1bHRWYWx1ZSIsIkpTT04iLCJwYXJzZSIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJzdHJpbmdpZnkiLCJzZXRMb2NhbFN0b3JhZ2VJdGVtIiwic2V0SXRlbSIsImdldEN1cnJlbnRVc2VySW5mbyIsImV4dGVuc2lvbiIsImV4dGVuc2lvbklkIiwidXNlcm5hbWUiLCJnZXRGb2xkZXJzIiwidGhlbiIsIl9yZWYiLCJkYXRhIiwiZmF2b3JpdGVfZ3JvdXBfaWRzIiwiY29udmVyc2F0aW9uX3NldHMiLCJmb2xkZXJzIiwidGl0bGUiLCJpZHMiLCJmaWx0ZXIiLCJpdGVtIiwiY2F0Y2giLCJnZXRHcm91cHNNYXAiLCJncm91cHMiLCJncm91cHNNYXAiLCJyZWR1Y2UiLCJhY2MiLCJncm91cCIsIm5hbWUiLCJzZXRfYWJicmV2aWF0aW9uIiwiaXNfdGVhbSIsImZvcm1hdERhdGUiLCJkYXRlU3RyaW5nIiwiZGF0ZSIsIkRhdGUiLCJ5ZWFyIiwiZ2V0RnVsbFllYXIiLCJtb250aCIsIlN0cmluZyIsImdldE1vbnRoIiwicGFkU3RhcnQiLCJkYXkiLCJnZXREYXRlIiwiaG91cnMiLCJnZXRIb3VycyIsIm1pbnV0ZXMiLCJnZXRNaW51dGVzIiwic2Vjb25kcyIsImdldFNlY29uZHMiLCJ1bmlxQnkiLCJhcnJheSIsInNlZW4iLCJTZXQiLCJrZXlWYWx1ZSIsImhhcyIsImFkZCIsInNob3dUb2FzdCIsIm9uQ2xvc2UiLCJjb250YWluZXIiLCJnZXRFbGVtZW50QnlJZCIsImV4aXN0aW5nVG9hc3QiLCJyZW1vdmVDaGlsZCIsInRvYXN0IiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInRvYXN0SW5uZXIiLCJhcHBlbmRDaGlsZCIsInRpbWVyIiwiY29udGFpbnMiLCJjbGVhclRpbWVvdXQiLCJ0cmFuc2Zvcm1Hcm91cExpbmtzIiwiaW5wdXRTdHJpbmciLCJncm91cExpbmtQYXR0ZXJuIiwidHJhbnNmb3JtZWRTdHJpbmciLCJyZXBsYWNlIiwibWF0Y2giLCJncm91cE5hbWUiLCJncm91cElkIiwidHJhbnNmb3JtUG9zdExpbmtzIiwicG9zdExpbmtQYXR0ZXJuIiwiaW5kZXgiLCJwb3N0SWQiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsInBhdGhuYW1lIiwiZGVmYXVsdEVudkNvbmZpZyIsIlNDSEVEVUxFRF9JTlRFUlZBTCIsIk51bWJlciIsInByb2Nlc3MiLCJlbnYiLCJBTkFMWVNJU19UWVBFIiwiTExNX1RZUEUiLCJBTkFMWVpFX0JZX0dST1VQIiwiT0xMQU1BX0JBU0VfVVJMIiwiT0xMQU1BX01PREVMIiwiT0xMQU1BX1JFVklFV19NT0RFTCIsIk9MTEFNQV9RVUVSWV9NT0RFTCIsIkRJRllfQVBJX0tFWSIsIkRJRllfUkVWSUVXX0FQSV9LRVkiLCJESUZZX0FQSV9CQVNFX1VSTCIsIk9QRU5BSV9BUElfS0VZIiwiT1BFTkFJX01PREVMIiwiT1BFTkFJX1JFVklFV19NT0RFTCIsIk9QRU5BSV9BUElfQkFTRV9VUkwiLCJHUk9RX0FQSV9LRVkiLCJHUk9RX01PREVMIiwiR1JPUV9SRVZJRVdfTU9ERUwiLCJCT1RfQVBJX0JBU0VfVVJMIiwiQk9UX1RPS0VOIiwiQk9UX0lEIiwiQk9UX1RZUEUiLCJURUFNX0lEIiwiRU5BQkxFX0JPVCIsIkxMTV9SRVZJRVdfQkVGT1JFX1NFTkQiLCJFTkFCTEVfQ0hST01BIiwiQ0hST01BX0FQSV9VUkwiLCJDSFJPTUFfUE9SVCIsIkNIUk9NQV9DT0xMRUNUSU9OX05BTUUiLCJKSVJBX1VTRVJOQU1FIiwiSklSQV9BUElfVE9LRU4iLCJzdG9yYWdlIiwibG9jYWwiLCJnZXRVc2VySW5mbyIsImFjY291bnRVRCIsImFjY291bnRJbmZvTGlzdCIsImFjY291bnRJbmZvIiwiZmluZCIsImRpc3BsYXlOYW1lIiwiZW1haWwiLCJmdWxsTmFtZSIsImpvaW4iLCJ0b0xvd2VyQ2FzZSIsInVzZXJJbmZvIiwic2VuZGVyIiwic2VuZFJlc3BvbnNlIiwid2FybiIsIm9wZW5KcWxEaWFsb2ciLCJkaWFsb2ciLCJzdHlsZSIsImNzc1RleHQiLCJpbm5lckhUTUwiLCJib2R5IiwiYWRkRXZlbnRMaXN0ZW5lciIsInZhbHVlIiwibGVuZ3RoIiwiZmllbGRzIiwiZm9ybWF0dGVkRGF0YSIsImZpZWxkIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3JpdGVUZXh0IiwiYWxlcnQiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJvcGFjaXR5Il0sInNvdXJjZVJvb3QiOiIifQ==