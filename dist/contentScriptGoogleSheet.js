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
/* harmony export */   fetchJiraTickets: () => (/* binding */ fetchJiraTickets),
/* harmony export */   getFieldMapping: () => (/* binding */ getFieldMapping),
/* harmony export */   getSheetHeaders: () => (/* binding */ getSheetHeaders),
/* harmony export */   writeTicketsToSheet: () => (/* binding */ writeTicketsToSheet)
/* harmony export */ });
/// <reference types="@types/google-apps-script" />

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

// 从配置表中读取字段映射
async function getFieldMapping(sheetName) {
  const configSheetName = `${sheetName}_config`;
  const spreadsheet = window.google?.sheets?.spreadsheets?.getActiveSpreadsheet();
  const configSheet = spreadsheet?.getSheetByName(configSheetName);
  if (!configSheet) {
    return DEFAULT_JIRA_FIELDS;
  }
  const range = configSheet.getDataRange();
  const values = range.getValues();
  const mapping = {};
  for (const [header, field] of values) {
    if (header && field) {
      mapping[header] = field;
    }
  }
  return mapping;
}

// 获取当前工作表的表头
function getSheetHeaders(sheet) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  return range.getValues()[0];
}

// 从 Jira 页面抓取数据
async function fetchJiraTickets(jql) {
  return new Promise((resolve, reject) => {
    // 创建一个唯一的 ID 用于标识这次请求
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

// 将 Jira tickets 写入 Google Sheet
async function writeTicketsToSheet(tickets) {
  // 获取当前工作表
  const sheet = window.google?.sheets?.spreadsheets?.getActiveSheet();
  if (!sheet) {
    throw new Error('无法获取当前工作表');
  }

  // 获取工作表名称
  const sheetName = sheet.getName();

  // 获取字段映射
  const fieldMapping = await getFieldMapping(sheetName);

  // 获取表头
  const headers = getSheetHeaders(sheet);

  // 如果表头为空，使用默认字段
  if (headers.length === 0 || headers[0] === '') {
    const headerValues = [Object.keys(fieldMapping)];
    sheet.getRange(1, 1, 1, headerValues[0].length).setValues(headerValues);
  }

  // 准备数据
  const data = tickets.map(ticket => {
    return headers.map(header => {
      const field = fieldMapping[header];
      return ticket[field] || '';
    });
  });

  // 写入数据
  const startRow = sheet.getLastRow() + 1;
  if (data.length > 0) {
    sheet.getRange(startRow, 1, data.length, headers.length).setValues(data);
  }
}

// 创建 JQL 查询对话框
function createJqlDialog() {
  const html = HtmlService.createHtmlOutput(`
    <div style="padding: 20px;">
      <h3>输入 JQL 查询</h3>
      <textarea id="jql" style="width: 100%; height: 100px; margin-bottom: 10px;"></textarea>
      <button onclick="submitJql()">查询</button>
    </div>
    <script>
      function submitJql() {
        const jql = document.getElementById('jql').value;
        google.script.run
          .withSuccessHandler(() => google.script.host.close())
          .withFailureHandler((error) => alert('Error: ' + error))
          .processJqlQuery(jql);
      }
    </script>
  `).setWidth(400).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Jira 查询');
}

// 处理 JQL 查询
async function processJqlQuery(jql) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const tickets = await fetchJiraTickets(jql);
  await writeTicketsToSheet(tickets);
}

// 添加菜单项
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Jira 工具').addItem('查询 Jira Tickets', 'createJqlDialog').addToUi();
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
function openJqlDialog() {
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
        await (0,_googleSheets__WEBPACK_IMPORTED_MODULE_0__.writeTicketsToSheet)(tickets);
        document.body.removeChild(dialog);
      } catch (error) {
        alert('查询失败: ' + error);
      }
    }
  });
}
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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O0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7RUFFREosUUFBUSxDQUFDSyxJQUFJLENBQUNDLFdBQVcsQ0FBQ1AsTUFBTSxDQUFDOztFQUVqQztFQUNBQyxRQUFRLENBQUNPLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQU07SUFDL0RSLFFBQVEsQ0FBQ0ssSUFBSSxDQUFDSSxXQUFXLENBQUNWLE1BQU0sQ0FBQztFQUNyQyxDQUFDLENBQUM7RUFFRkMsUUFBUSxDQUFDTyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUVDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxZQUFZO0lBQ3JFLE1BQU1sRSxHQUFHLEdBQUkwRCxRQUFRLENBQUNPLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBeUJHLEtBQUs7SUFDekUsSUFBSXBFLEdBQUcsRUFBRTtNQUNMLElBQUk7UUFDQSxNQUFNa0IsT0FBTyxHQUFHLE1BQU1uQiwrREFBZ0IsQ0FBQ0MsR0FBRyxDQUFDO1FBQzNDLE1BQU1xQixrRUFBbUIsQ0FBQ0gsT0FBTyxDQUFDO1FBQ2xDd0MsUUFBUSxDQUFDSyxJQUFJLENBQUNJLFdBQVcsQ0FBQ1YsTUFBTSxDQUFDO01BQ3JDLENBQUMsQ0FBQyxPQUFPekMsS0FBSyxFQUFFO1FBQ1pxRCxLQUFLLENBQUMsUUFBUSxHQUFHckQsS0FBSyxDQUFDO01BQzNCO0lBQ0o7RUFDSixDQUFDLENBQUM7QUFDTixDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvZ29vZ2xlU2hlZXRzLnRzIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9kZWZpbmUgcHJvcGVydHkgZ2V0dGVycyIsIndlYnBhY2s6Ly9wZXJzb25hbC1haS93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3BlcnNvbmFsLWFpL3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vcGVyc29uYWwtYWkvLi9zcmMvY29udGVudFNjcmlwdEdvb2dsZVNoZWV0LnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSB0eXBlcz1cIkB0eXBlcy9nb29nbGUtYXBwcy1zY3JpcHRcIiAvPlxuaW1wb3J0IHsgSmlyYVRpY2tldCB9IGZyb20gJy4vdHlwZXMnO1xuXG4vLyDpu5jorqTnmoQgSmlyYSDlrZfmrrXphY3nva5cbmNvbnN0IERFRkFVTFRfSklSQV9GSUVMRFMgPSB7XG4gICdLZXknOiAna2V5JyxcbiAgJ1N1bW1hcnknOiAnc3VtbWFyeScsXG4gICdTdGF0dXMnOiAnc3RhdHVzJyxcbiAgJ0Fzc2lnbmVlJzogJ2Fzc2lnbmVlJyxcbiAgJ1JlcG9ydGVyJzogJ3JlcG9ydGVyJyxcbiAgJ1ByaW9yaXR5JzogJ3ByaW9yaXR5JyxcbiAgJ0NyZWF0ZWQnOiAnY3JlYXRlZCcsXG4gICdVcGRhdGVkJzogJ3VwZGF0ZWQnLFxuICAnRHVlIERhdGUnOiAnZHVlZGF0ZScsXG4gICdEZXNjcmlwdGlvbic6ICdkZXNjcmlwdGlvbidcbn07XG5cbi8vIOS7jumFjee9ruihqOS4reivu+WPluWtl+auteaYoOWwhFxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEZpZWxkTWFwcGluZyhzaGVldE5hbWU6IHN0cmluZyk6IFByb21pc2U8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4ge1xuICBjb25zdCBjb25maWdTaGVldE5hbWUgPSBgJHtzaGVldE5hbWV9X2NvbmZpZ2A7XG4gIGNvbnN0IHNwcmVhZHNoZWV0ID0gKHdpbmRvdyBhcyBhbnkpLmdvb2dsZT8uc2hlZXRzPy5zcHJlYWRzaGVldHM/LmdldEFjdGl2ZVNwcmVhZHNoZWV0KCk7XG4gIGNvbnN0IGNvbmZpZ1NoZWV0ID0gc3ByZWFkc2hlZXQ/LmdldFNoZWV0QnlOYW1lKGNvbmZpZ1NoZWV0TmFtZSk7XG4gIFxuICBpZiAoIWNvbmZpZ1NoZWV0KSB7XG4gICAgcmV0dXJuIERFRkFVTFRfSklSQV9GSUVMRFM7XG4gIH1cblxuICBjb25zdCByYW5nZSA9IGNvbmZpZ1NoZWV0LmdldERhdGFSYW5nZSgpO1xuICBjb25zdCB2YWx1ZXMgPSByYW5nZS5nZXRWYWx1ZXMoKTtcbiAgXG4gIGNvbnN0IG1hcHBpbmc6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgZm9yIChjb25zdCBbaGVhZGVyLCBmaWVsZF0gb2YgdmFsdWVzKSB7XG4gICAgaWYgKGhlYWRlciAmJiBmaWVsZCkge1xuICAgICAgbWFwcGluZ1toZWFkZXJdID0gZmllbGQ7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4gbWFwcGluZztcbn1cblxuLy8g6I635Y+W5b2T5YmN5bel5L2c6KGo55qE6KGo5aS0XG5leHBvcnQgZnVuY3Rpb24gZ2V0U2hlZXRIZWFkZXJzKHNoZWV0OiBhbnkpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHJhbmdlID0gc2hlZXQuZ2V0UmFuZ2UoMSwgMSwgMSwgc2hlZXQuZ2V0TGFzdENvbHVtbigpKTtcbiAgcmV0dXJuIHJhbmdlLmdldFZhbHVlcygpWzBdO1xufVxuXG4vLyDku44gSmlyYSDpobXpnaLmipPlj5bmlbDmja5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaEppcmFUaWNrZXRzKGpxbDogc3RyaW5nKTogUHJvbWlzZTxKaXJhVGlja2V0W10+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyDliJvlu7rkuIDkuKrllK/kuIDnmoQgSUQg55So5LqO5qCH6K+G6L+Z5qyh6K+35rGCXG4gICAgICAgIGNvbnN0IHJlcXVlc3RJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZyg3KTtcbiAgICAgICAgXG4gICAgICAgIC8vIOebkeWQrOadpeiHqiBiYWNrZ3JvdW5kIHNjcmlwdCDnmoTmtojmga9cbiAgICAgICAgY29uc3QgbWVzc2FnZUxpc3RlbmVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ0pJUkFfVElDS0VUU19SRVNVTFQnICYmIG1lc3NhZ2UucmVxdWVzdElkID09PSByZXF1ZXN0SWQpIHtcbiAgICAgICAgICAgICAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIobWVzc2FnZUxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICBpZiAobWVzc2FnZS5lcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKG1lc3NhZ2UuZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UudGlja2V0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKG1lc3NhZ2VMaXN0ZW5lcik7XG4gICAgICAgIFxuICAgICAgICAvLyDlj5HpgIHmtojmga/nu5kgYmFja2dyb3VuZCBzY3JpcHQg5p2l5Yib5bu65paw5qCH562+6aG1XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcbiAgICAgICAgICAgIHR5cGU6ICdGRVRDSF9KSVJBX1RJQ0tFVFMnLFxuICAgICAgICAgICAganFsLFxuICAgICAgICAgICAgcmVxdWVzdElkXG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuXG4vLyDlsIYgSmlyYSB0aWNrZXRzIOWGmeWFpSBHb29nbGUgU2hlZXRcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3cml0ZVRpY2tldHNUb1NoZWV0KHRpY2tldHM6IEppcmFUaWNrZXRbXSkge1xuICAvLyDojrflj5blvZPliY3lt6XkvZzooahcbiAgY29uc3Qgc2hlZXQgPSAod2luZG93IGFzIGFueSkuZ29vZ2xlPy5zaGVldHM/LnNwcmVhZHNoZWV0cz8uZ2V0QWN0aXZlU2hlZXQoKTtcbiAgaWYgKCFzaGVldCkge1xuICAgIHRocm93IG5ldyBFcnJvcign5peg5rOV6I635Y+W5b2T5YmN5bel5L2c6KGoJyk7XG4gIH1cblxuICAvLyDojrflj5blt6XkvZzooajlkI3np7BcbiAgY29uc3Qgc2hlZXROYW1lID0gc2hlZXQuZ2V0TmFtZSgpO1xuICBcbiAgLy8g6I635Y+W5a2X5q615pig5bCEXG4gIGNvbnN0IGZpZWxkTWFwcGluZyA9IGF3YWl0IGdldEZpZWxkTWFwcGluZyhzaGVldE5hbWUpO1xuICBcbiAgLy8g6I635Y+W6KGo5aS0XG4gIGNvbnN0IGhlYWRlcnMgPSBnZXRTaGVldEhlYWRlcnMoc2hlZXQpO1xuICBcbiAgLy8g5aaC5p6c6KGo5aS05Li656m677yM5L2/55So6buY6K6k5a2X5q61XG4gIGlmIChoZWFkZXJzLmxlbmd0aCA9PT0gMCB8fCBoZWFkZXJzWzBdID09PSAnJykge1xuICAgIGNvbnN0IGhlYWRlclZhbHVlcyA9IFtPYmplY3Qua2V5cyhmaWVsZE1hcHBpbmcpXTtcbiAgICBzaGVldC5nZXRSYW5nZSgxLCAxLCAxLCBoZWFkZXJWYWx1ZXNbMF0ubGVuZ3RoKS5zZXRWYWx1ZXMoaGVhZGVyVmFsdWVzKTtcbiAgfVxuICBcbiAgLy8g5YeG5aSH5pWw5o2uXG4gIGNvbnN0IGRhdGEgPSB0aWNrZXRzLm1hcCh0aWNrZXQgPT4ge1xuICAgIHJldHVybiBoZWFkZXJzLm1hcChoZWFkZXIgPT4ge1xuICAgICAgY29uc3QgZmllbGQgPSBmaWVsZE1hcHBpbmdbaGVhZGVyXTtcbiAgICAgIHJldHVybiB0aWNrZXRbZmllbGQgYXMga2V5b2YgSmlyYVRpY2tldF0gfHwgJyc7XG4gICAgfSk7XG4gIH0pO1xuICBcbiAgLy8g5YaZ5YWl5pWw5o2uXG4gIGNvbnN0IHN0YXJ0Um93ID0gc2hlZXQuZ2V0TGFzdFJvdygpICsgMTtcbiAgaWYgKGRhdGEubGVuZ3RoID4gMCkge1xuICAgIHNoZWV0LmdldFJhbmdlKHN0YXJ0Um93LCAxLCBkYXRhLmxlbmd0aCwgaGVhZGVycy5sZW5ndGgpLnNldFZhbHVlcyhkYXRhKTtcbiAgfVxufVxuXG4vLyDliJvlu7ogSlFMIOafpeivouWvueivneahhlxuZnVuY3Rpb24gY3JlYXRlSnFsRGlhbG9nKCkge1xuICBjb25zdCBodG1sID0gSHRtbFNlcnZpY2UuY3JlYXRlSHRtbE91dHB1dChgXG4gICAgPGRpdiBzdHlsZT1cInBhZGRpbmc6IDIwcHg7XCI+XG4gICAgICA8aDM+6L6T5YWlIEpRTCDmn6Xor6I8L2gzPlxuICAgICAgPHRleHRhcmVhIGlkPVwianFsXCIgc3R5bGU9XCJ3aWR0aDogMTAwJTsgaGVpZ2h0OiAxMDBweDsgbWFyZ2luLWJvdHRvbTogMTBweDtcIj48L3RleHRhcmVhPlxuICAgICAgPGJ1dHRvbiBvbmNsaWNrPVwic3VibWl0SnFsKClcIj7mn6Xor6I8L2J1dHRvbj5cbiAgICA8L2Rpdj5cbiAgICA8c2NyaXB0PlxuICAgICAgZnVuY3Rpb24gc3VibWl0SnFsKCkge1xuICAgICAgICBjb25zdCBqcWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnanFsJykudmFsdWU7XG4gICAgICAgIGdvb2dsZS5zY3JpcHQucnVuXG4gICAgICAgICAgLndpdGhTdWNjZXNzSGFuZGxlcigoKSA9PiBnb29nbGUuc2NyaXB0Lmhvc3QuY2xvc2UoKSlcbiAgICAgICAgICAud2l0aEZhaWx1cmVIYW5kbGVyKChlcnJvcikgPT4gYWxlcnQoJ0Vycm9yOiAnICsgZXJyb3IpKVxuICAgICAgICAgIC5wcm9jZXNzSnFsUXVlcnkoanFsKTtcbiAgICAgIH1cbiAgICA8L3NjcmlwdD5cbiAgYClcbiAgICAuc2V0V2lkdGgoNDAwKVxuICAgIC5zZXRIZWlnaHQoMjAwKTtcbiAgXG4gIFNwcmVhZHNoZWV0QXBwLmdldFVpKCkuc2hvd01vZGFsRGlhbG9nKGh0bWwsICdKaXJhIOafpeivoicpO1xufVxuXG4vLyDlpITnkIYgSlFMIOafpeivolxuYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0pxbFF1ZXJ5KGpxbDogc3RyaW5nKSB7XG4gIGNvbnN0IHNoZWV0ID0gU3ByZWFkc2hlZXRBcHAuZ2V0QWN0aXZlU2hlZXQoKTtcbiAgY29uc3QgdGlja2V0cyA9IGF3YWl0IGZldGNoSmlyYVRpY2tldHMoanFsKTtcbiAgYXdhaXQgd3JpdGVUaWNrZXRzVG9TaGVldCh0aWNrZXRzKTtcbn1cblxuLy8g5re75Yqg6I+c5Y2V6aG5XG5mdW5jdGlvbiBvbk9wZW4oKSB7XG4gIGNvbnN0IHVpID0gU3ByZWFkc2hlZXRBcHAuZ2V0VWkoKTtcbiAgdWkuY3JlYXRlTWVudSgnSmlyYSDlt6XlhbcnKVxuICAgIC5hZGRJdGVtKCfmn6Xor6IgSmlyYSBUaWNrZXRzJywgJ2NyZWF0ZUpxbERpYWxvZycpXG4gICAgLmFkZFRvVWkoKTtcbn0gIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQgeyBmZXRjaEppcmFUaWNrZXRzLCB3cml0ZVRpY2tldHNUb1NoZWV0IH0gZnJvbSAnLi9nb29nbGVTaGVldHMnO1xuXG4vLyBNYWluIGxpc3RlbmVyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1lc3NhZ2UsIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ+aUtuWIsOa2iOaBrzonLCBtZXNzYWdlLCAn5Y+R6YCB6ICFOicsIHNlbmRlcik7XG5cbiAgICBpZiAoIW1lc3NhZ2UgfHwgIW1lc3NhZ2UudHlwZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+aUtuWIsOaXoOaViOa2iOaBr+agvOW8jycpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgeyB0eXBlIH0gPSBtZXNzYWdlO1xuXG4gICAgaWYgKHR5cGUgPT09ICdPUEVOX0pJUkFfUVVFUllfRElBTE9HJykge1xuICAgICAgICBvcGVuSnFsRGlhbG9nKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7IC8vIOS4uuaJgOaciea2iOaBr+S/neaMgea2iOaBr+mAmumBk+W8gOWQr1xufSk7XG5cbi8vIOWIm+W7uiBKUUwg5p+l6K+i5a+56K+d5qGGXG5mdW5jdGlvbiBvcGVuSnFsRGlhbG9nKCkge1xuICAgIGNvbnN0IGRpYWxvZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGRpYWxvZy5zdHlsZS5jc3NUZXh0ID0gYFxuICAgICAgICBwb3NpdGlvbjogZml4ZWQ7XG4gICAgICAgIHRvcDogNTAlO1xuICAgICAgICBsZWZ0OiA1MCU7XG4gICAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlKC01MCUsIC01MCUpO1xuICAgICAgICBiYWNrZ3JvdW5kOiB3aGl0ZTtcbiAgICAgICAgcGFkZGluZzogMjBweDtcbiAgICAgICAgYm9yZGVyLXJhZGl1czogOHB4O1xuICAgICAgICBib3gtc2hhZG93OiAwIDJweCAxMHB4IHJnYmEoMCwwLDAsMC4xKTtcbiAgICAgICAgei1pbmRleDogMTAwMDA7XG4gICAgICAgIHdpZHRoOiA0MDBweDtcbiAgICBgO1xuXG4gICAgZGlhbG9nLmlubmVySFRNTCA9IGBcbiAgICAgICAgPGgzIHN0eWxlPVwibWFyZ2luLXRvcDogMDtcIj7ovpPlhaUgSlFMIOafpeivojwvaDM+XG4gICAgICAgIDx0ZXh0YXJlYSBpZD1cImpxbFwiIHN0eWxlPVwid2lkdGg6IDEwMCU7IGhlaWdodDogMTAwcHg7IG1hcmdpbi1ib3R0b206IDEwcHg7XCI+PC90ZXh0YXJlYT5cbiAgICAgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6IGZsZXg7IGp1c3RpZnktY29udGVudDogZmxleC1lbmQ7XCI+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwiY2FuY2VsXCIgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDEwcHg7XCI+5Y+W5raIPC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uIGlkPVwic3VibWl0XCI+5p+l6K+iPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgIGA7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRpYWxvZyk7XG5cbiAgICAvLyDmt7vliqDkuovku7bnm5HlkKzlmahcbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FuY2VsJyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgfSk7XG5cbiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc3VibWl0Jyk/LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBqcWwgPSAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2pxbCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQpLnZhbHVlO1xuICAgICAgICBpZiAoanFsKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpY2tldHMgPSBhd2FpdCBmZXRjaEppcmFUaWNrZXRzKGpxbCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgd3JpdGVUaWNrZXRzVG9TaGVldCh0aWNrZXRzKTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpYWxvZyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGFsZXJ0KCfmn6Xor6LlpLHotKU6ICcgKyBlcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn0iXSwibmFtZXMiOlsiREVGQVVMVF9KSVJBX0ZJRUxEUyIsImdldEZpZWxkTWFwcGluZyIsInNoZWV0TmFtZSIsImNvbmZpZ1NoZWV0TmFtZSIsInNwcmVhZHNoZWV0Iiwid2luZG93IiwiZ29vZ2xlIiwic2hlZXRzIiwic3ByZWFkc2hlZXRzIiwiZ2V0QWN0aXZlU3ByZWFkc2hlZXQiLCJjb25maWdTaGVldCIsImdldFNoZWV0QnlOYW1lIiwicmFuZ2UiLCJnZXREYXRhUmFuZ2UiLCJ2YWx1ZXMiLCJnZXRWYWx1ZXMiLCJtYXBwaW5nIiwiaGVhZGVyIiwiZmllbGQiLCJnZXRTaGVldEhlYWRlcnMiLCJzaGVldCIsImdldFJhbmdlIiwiZ2V0TGFzdENvbHVtbiIsImZldGNoSmlyYVRpY2tldHMiLCJqcWwiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsInJlcXVlc3RJZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInN1YnN0cmluZyIsIm1lc3NhZ2VMaXN0ZW5lciIsIm1lc3NhZ2UiLCJ0eXBlIiwiY2hyb21lIiwicnVudGltZSIsIm9uTWVzc2FnZSIsInJlbW92ZUxpc3RlbmVyIiwiZXJyb3IiLCJFcnJvciIsInRpY2tldHMiLCJhZGRMaXN0ZW5lciIsInNlbmRNZXNzYWdlIiwid3JpdGVUaWNrZXRzVG9TaGVldCIsImdldEFjdGl2ZVNoZWV0IiwiZ2V0TmFtZSIsImZpZWxkTWFwcGluZyIsImhlYWRlcnMiLCJsZW5ndGgiLCJoZWFkZXJWYWx1ZXMiLCJPYmplY3QiLCJrZXlzIiwic2V0VmFsdWVzIiwiZGF0YSIsIm1hcCIsInRpY2tldCIsInN0YXJ0Um93IiwiZ2V0TGFzdFJvdyIsImNyZWF0ZUpxbERpYWxvZyIsImh0bWwiLCJIdG1sU2VydmljZSIsImNyZWF0ZUh0bWxPdXRwdXQiLCJzZXRXaWR0aCIsInNldEhlaWdodCIsIlNwcmVhZHNoZWV0QXBwIiwiZ2V0VWkiLCJzaG93TW9kYWxEaWFsb2ciLCJwcm9jZXNzSnFsUXVlcnkiLCJvbk9wZW4iLCJ1aSIsImNyZWF0ZU1lbnUiLCJhZGRJdGVtIiwiYWRkVG9VaSIsInNlbmRlciIsInNlbmRSZXNwb25zZSIsImNvbnNvbGUiLCJsb2ciLCJ3YXJuIiwib3BlbkpxbERpYWxvZyIsImRpYWxvZyIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInN0eWxlIiwiY3NzVGV4dCIsImlubmVySFRNTCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsImdldEVsZW1lbnRCeUlkIiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlbW92ZUNoaWxkIiwidmFsdWUiLCJhbGVydCJdLCJzb3VyY2VSb290IjoiIn0=