import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './container/App';
import { CONTENT_STYLE } from './contentStyle';
import { MARKDOWN_STYLE } from './markdownStyle';
import { ViewModel } from './viewModel';
import { fetchUserData } from './metadata';
import { CONFIG_LOCAL_STORAGE_KEY } from './constants';
import { getLocalStorageItem, getCurrentUserInfo } from './storage';


// Insert the CSS styles into the DOM
function insertRadarPocCss(styles: string, id: string) {
    // 检查是否已存在具有指定 ID 的样式表
    if (document.getElementById(id)) {
      return; // 如果已存在，直接返回
    }
  
    // 如果不存在，创建并插入新的样式表
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.id = id; // 设置唯一的 ID
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}

function bootstrap() {
    insertRadarPocCss(MARKDOWN_STYLE, 'radar-poc-markdown-style');
    insertRadarPocCss(CONTENT_STYLE, 'radar-poc-content-style');

    const appMainSection = document.getElementById('app-main-section');
    const containerDiv = `<div id="radar-poc-container"></div>`; 
    appMainSection.insertAdjacentHTML('beforeend', containerDiv);
    const container = appMainSection.querySelector('#radar-poc-container');
    const vm = new ViewModel();

    ReactDOM.render(
        // @ts-ignore
        <App vm={vm} />,
        container
    );
}

// Main listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message, '发送者:', sender);

    if (!message || !message.type) {
        console.warn('收到无效消息格式');
        return;
    }

    const { type } = message;

    if (type === 'GET_USER_INFO') {
        console.log('处理 GET_USER_INFO 消息');
        const userInfo = getUserInfoInRCTab();
        console.log('获取到的用户信息:', userInfo);
        sendResponse({ success: true, data: {
            fullName: userInfo.fullName,
            username: userInfo.username,
            userEmail: userInfo.email,
            extensionId: userInfo.extensionId,
        } });
        return true;
    }

    if (type === 'RADAR-POC-OPEN-PANEL') {
        console.log('处理 RADAR-POC-OPEN-PANEL 消息');
        bootstrap();
        sendResponse({ status: 'done', type });
    }

    if (type === 'FETCH_USER_MESSAGES') {
        console.log('处理 FETCH_USER_MESSAGES 消息，参数:', message);
        const { startTime } = message;
        const configStr = localStorage.getItem(CONFIG_LOCAL_STORAGE_KEY);
        const config = configStr ? JSON.parse(configStr) : {
            selectGroupNames: "",
            enableMessage: true,
            enableSms: false,
            enableVoicemail: false,
            enableCallTranscript: false,
            enableCalendar: false,
            enableCandidateQuestions: false,
            selectFolderGroupIds: "",
            username: "",
            extensionId: "",
            apiKey: "",
            model: "4o"
        };
        
        // 确保必要的参数存在
        if (!startTime) {
            console.error('缺少必要的参数:', { startTime, config });
            sendResponse({ success: false, error: '缺少必要的参数' });
            return true;
        }

        // 执行数据获取
        console.log('执行数据获取', startTime, config);
        fetchUserData(startTime, config)
            .then(data => {
                console.log('数据获取成功:', data);
                sendResponse({ success: true, data });
            })
            .catch(error => {
                console.error('数据获取失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道开启
    }

    return true; // 为所有消息保持消息通道开启
});

function getUserInfoInRCTab() {
    const accountUD = getLocalStorageItem('global.account.UD', '');
    const accountInfoList = getLocalStorageItem('global.account.ACCOUNT_SESSION_DATA_LIST', {});
  
    const accountInfo = accountUD ? accountInfoList[accountUD] : accountInfoList.find((item:any) => item.displayName != '');
    console.log('accountInfoList', accountInfoList, accountInfo);
    if (accountInfo) return {
      extensionId: accountInfo.extensionId,
      email: accountInfo.email,
      fullName: accountInfo.displayName,
      username: accountInfo.email ? accountInfo.email.trim().split('@')[0] : accountInfo.displayName.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
    }
  
    const userInfo = getCurrentUserInfo();
    return {
      extensionId: userInfo.extensionId,
      fullName: userInfo.username,
      username: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, ''),
      email: userInfo.username.trim().split(' ').join('.').toLowerCase().replace(/[^a-z0-9_\-.]/g, '') + '@ringcentral.com'
    };
  }
