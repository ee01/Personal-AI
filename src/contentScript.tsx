import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './container/App';
import { CONTENT_STYLE } from './contentStyle';
import { MARKDOWN_STYLE } from './markdownStyle';
import { ViewModel } from './viewModel';


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
    const { type } = message;

    if (type === 'RADAR-POC-OPEN-PANEL') {
        bootstrap();
        sendResponse({ status: 'done', type });
    }
});