import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './container/App';
import { CONTENT_STYLE } from './contentStyle';
import { MARKDOWN_STYLE } from './markdownStyle';
import { ViewModel } from './viewModel';
import { fetchUserData } from './metadata';
import { CONFIG_LOCAL_STORAGE_KEY } from './constants';


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

    if (type === 'GET_CONFIG') {
        console.log('处理 GET_CONFIG 消息');
        const configStr = localStorage.getItem(CONFIG_LOCAL_STORAGE_KEY);
        const config = configStr ? JSON.parse(configStr) : null;
        console.log('获取到的配置:', config);
        sendResponse({ success: true, config });
        return true;
    }

    if (type === 'RADAR-POC-OPEN-PANEL') {
        console.log('处理 RADAR-POC-OPEN-PANEL 消息');
        bootstrap();
        sendResponse({ status: 'done', type });
    }

    if (type === 'FETCH_USER_DATA') {
        console.log('处理 FETCH_USER_DATA 消息，参数:', message);
        const { startTime, config } = message;
        
        // 确保必要的参数存在
        if (!startTime || !config) {
            console.error('缺少必要的参数:', { startTime, config });
            sendResponse({ success: false, error: '缺少必要的参数' });
            return true;
        }

        // 执行数据获取
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