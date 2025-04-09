import { fetchJiraTickets, writeTicketsToSheet } from './googleSheets';
import { JiraTicket } from './types';
import { getEnvConfig } from './utils';

// Main listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message, '发送者:', sender);

    if (!message || !message.type) {
        console.warn('收到无效消息格式');
        return;
    }

    const { type } = message;

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
        chrome.storage.local.get(['enableSheetsIntegration'], (result) => {
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
        const sheetsApp = (window as any).SHEETS_APP || 
                        (window as any).google?.sheets?.app || 
                        (window as any).SheetsApp;
        
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
        const highlightElement = (selector: string, color: string) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                const originalBackground = (el as HTMLElement).style.backgroundColor;
                const originalOutline = (el as HTMLElement).style.outline;
                
                (el as HTMLElement).style.backgroundColor = color;
                (el as HTMLElement).style.outline = `2px solid ${color}`;
                
                setTimeout(() => {
                    (el as HTMLElement).style.backgroundColor = originalBackground;
                    (el as HTMLElement).style.outline = originalOutline;
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
        const sheetsContainer = document.querySelector('#sheets-viewport') || 
                               document.querySelector('[role="grid"]') || 
                               document.body;
        
        // 4. 创建结果存储器
        const cellsData: {text: string, x: number, y: number, element: HTMLElement}[] = [];
        
        // 5. 执行扫描
        setTimeout(() => {
            // 使用深度优先搜索遍历DOM
            const walkDOM = (element: HTMLElement, depth = 0) => {
                // 检查是否可能是单元格
                const maybeCell = isCellElement(element);
                
                // 获取元素在页面上的位置
                const rect = element.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 && 
                                 rect.right > 0 && rect.left < viewportWidth &&
                                 rect.bottom > 0 && rect.top < viewportHeight;
                
                // 如果是可见的单元格元素，记录其信息
                if (maybeCell && isVisible) {
                    const text = element.textContent || '';
                    if (text.trim()) { // 只记录非空单元格
                        cellsData.push({
                            text: text,
                            x: rect.left,
                            y: rect.top,
                            element: element
                        });
                    }
                }
                
                // 递归处理子元素
                if (depth < 10) { // 限制递归深度
                    Array.from(element.children).forEach(child => {
                        walkDOM(child as HTMLElement, depth + 1);
                    });
                }
            };
            
            // 检查元素是否可能是单元格
            const isCellElement = (element: HTMLElement): boolean => {
                // 检查常见的单元格特征
                if (element.getAttribute('role') === 'gridcell') return true;
                if (element.classList.contains('cell-content')) return true;
                if (element.classList.contains('waffle-cell-content')) return true;
                
                // 检查元素样式特征
                const style = window.getComputedStyle(element);
                if (style.display === 'table-cell') return true;
                
                // 检查元素尺寸是否像单元格
                const rect = element.getBoundingClientRect();
                if (rect.width > 20 && rect.width < 300 && 
                    rect.height > 15 && rect.height < 100) {
                    // 检查是否有文本内容和边框
                    if ((element.textContent || '').trim() && 
                        (style.border || style.borderBottom || style.borderRight)) {
                        return true;
                    }
                }
                
                return false;
            };
            
            // 执行扫描
            walkDOM(sheetsContainer as HTMLElement);
            
            console.log(`扫描完成，找到 ${cellsData.length} 个可能的单元格`);
            
            // 6. 处理扫描结果
            if (cellsData.length > 0) {
                // 按垂直位置排序，猜测行
                cellsData.sort((a, b) => a.y - b.y);
                
                // 尝试识别行
                const rowThreshold = 10; // 同一行的单元格垂直位置差异应小于这个值
                const rows: typeof cellsData[] = [];
                let currentRow: typeof cellsData = [];
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
function showTablePreview(data: string[][]) {
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
    const envConfig = await getEnvConfig();
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
        const jql = (document.getElementById('jql') as HTMLTextAreaElement).value;
        if (jql) {
            try {
                const tickets = await fetchJiraTickets(jql);
                console.log('tickets', tickets);
                if (tickets.length > 0) {
                    const fields = ['key', 'summary', 'status', 'assignee', 'reporter'];
                    const headers = fields.join('\t');
                    const formattedData = [headers, ...tickets.map(ticket => ({
                        ...ticket,
                        key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
                      })).map(ticket => fields.map(field => ticket[field as keyof JiraTicket]).join('\t'))].join('\n');
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
async function insertTicketsToActiveSheet(tickets: JiraTicket[], envConfig: any) {
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
                const value = ticket[fieldName as keyof JiraTicket] || 
                              ticket[fieldName.replace(/\s+/g, '') as keyof JiraTicket] || 
                              '';
                console.log(`映射字段 ${header} -> ${fieldName}, 值:`, value);
                return value;
            }).join('\t')).join('\n');
        } else {
            // 包含表头和数据
            const headers = fields.join('\t');
            formattedData = [headers, ...tickets.map(ticket => ({
                ...ticket,
                key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
            })).map(ticket => fields.map(field => ticket[field as keyof JiraTicket]).join('\t'))].join('\n');
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
async function insertDataViaSheetsDomApi(tickets: JiraTicket[], envConfig: any): Promise<boolean> {
    try {
        console.log('尝试使用Google Sheets DOM API插入数据...');
        
        // 检查是否在Google Sheets环境中
        if (!window.location.href.includes('docs.google.com/spreadsheets')) {
            console.warn('非Google Sheets环境，无法使用DOM API');
            return false;
        }
        
        // 获取活动单元格位置
        const activeCell = document.querySelector('[aria-selected="true"]') as HTMLElement;
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
        const fields = headers && headers.length > 0 
            ? findValidJiraHeaders(headers, tickets[0]) 
            : ['key', 'summary', 'status', 'assignee', 'reporter'];
        
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
            const formattedData = tickets.map(ticket => 
                fields.map(field => {
                    if (field === 'key') {
                        return `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`;
                    }
                    return ticket[field as keyof JiraTicket] || '';
                })
            );
            
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
function getCellCoordinates(cell: HTMLElement): {row: number, col: number} | null {
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
function getSheetsAppInstance(): any {
    try {
        // 尝试通过全局变量访问Sheets应用实例
        // 注意：这是基于Google Sheets内部实现的试探性方法
        return (window as any).SHEETS_APP || 
               (window as any).google?.sheets?.app || 
               (window as any).SheetsApp || 
               null;
    } catch (error) {
        console.error('获取Sheets应用实例失败:', error);
        return null;
    }
}

// 通过本机事件注入数据
function injectDataViaNativeEvents(activeCell: HTMLElement, tickets: JiraTicket[], fields: string[], envConfig: any): boolean {
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
        const testData = tickets[0][fields[0] as keyof JiraTicket] || '';
        (editBox as HTMLInputElement).value = testData;
        
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
async function readSheetData(): Promise<string[][]> {
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
                    (firstCell as HTMLElement).click();
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
            const selectors = [
                '.cell-content', 
                '.waffle-cell-content', 
                'div[role="gridcell"]',
                '.grid-cell',
                '.cell'
            ];
            
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
                    const firstTable = tableElements[0] as HTMLTableElement;
                    if (firstTable.rows && firstTable.rows.length > 0) {
                        const data: string[][] = [];
                        for (let i = 0; i < firstTable.rows.length; i++) {
                            const row = firstTable.rows[i];
                            const rowData: string[] = [];
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
            
            const cellDataMap = new Map<string, {text: string, row: number, col: number}>();
            
            // 尝试识别单元格坐标
            visibleCells.forEach((cell, index) => {
                const htmlCell = cell as HTMLElement;
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
                    
                    if (style || (rect && rect.top && rect.left)) {
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
                    cellDataMap.set(`${row},${col}`, {text, row, col});
                }
            });
            
            // 整理成二维数组
            if (cellDataMap.size > 0) {
                // 找出最大的行和列
                const rows = Math.max(...Array.from(cellDataMap.values()).map(cell => cell.row)) + 1;
                const cols = Math.max(...Array.from(cellDataMap.values()).map(cell => cell.col)) + 1;
                
                console.log(`检测到表格尺寸: ${rows}行 x ${cols}列`);
                
                // 创建并填充数据数组
                const data: string[][] = Array(rows).fill(0).map(() => Array(cols).fill(''));
                
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
                return new Promise((resolve) => {
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
async function copyToClipboard(text: string): Promise<boolean> {
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
function attemptAutoPaste(targetElement: Element): boolean {
    try {
        // 聚焦目标元素
        (targetElement as HTMLElement).focus();
        
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
function showGuideDialog(tickets: JiraTicket[], envConfig: any) {
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
        })).map(ticket => fields.map(field => ticket[field as keyof JiraTicket]).join('\t'))].join('\n');
        
        copyToClipboard(formattedData);
    });
}

// 获取表格中已存在的表头
function getExistingHeaders(): string[] {
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
function getCanvasBasedHeaders(): string[] {
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
        const firstRowSelector = document.querySelector('div[style*="top: 0"]') || 
                                document.querySelector('.grid-row[style*="top: 0"]') ||
                                document.querySelector('.waffle-row-wrapper > div[style*="top: 0"]');
        
        if (firstRowSelector) {
            firstRowSelector.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
function getHeadersByClipboard(): string[] {
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
            const headerTexts: string[] = [];
            selectedCells.forEach(cell => {
                const text = (cell as HTMLElement).innerText || (cell as HTMLElement).textContent || '';
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
async function copySelectedHeaders(): Promise<boolean> {
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
function findValidJiraHeaders(headers: string[], ticket: JiraTicket): string[] {
    if (!headers || headers.length === 0 || !ticket) {
        return [];
    }
    
    const validHeaders: string[] = [];
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
        const fieldAliases: Record<string, string[]> = {
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
function showToast(message: string, type = 'info') {
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
function showDataAnalysisDialog(data: string[][]) {
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
            const valueCounts: Record<string, number> = {};
            columnValues.forEach(value => {
                valueCounts[value] = (valueCounts[value] || 0) + 1;
            });
            
            // 获取前5个最常见值
            const topValues = Object.entries(valueCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            columnDiv.innerHTML = `
                <h4 style="margin-top: 0; margin-bottom: 10px;">${header}</h4>
                <p>类型: 文本/分类</p>
                <p>唯一值数: ${Object.keys(valueCounts).length}</p>
                <p>非空值数: ${columnValues.length}</p>
                <p>最常见值:</p>
                <ul style="margin-top: 5px; padding-left: 20px;">
                    ${topValues.map(([value, count]) => `<li>${value}: ${count}次</li>`).join('')}
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
function exportAnalysisResults(data: string[][]) {
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
                const valueCounts: Record<string, number> = {};
                columnValues.forEach(value => {
                    valueCounts[value] = (valueCounts[value] || 0) + 1;
                });
                
                // 获取前5个最常见值
                const topValues = Object.entries(valueCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);
                
                report += `- 类型: 文本/分类\n`;
                report += `- 唯一值数: ${Object.keys(valueCounts).length}\n`;
                report += `- 非空值数: ${columnValues.length}\n`;
                report += `- 最常见值:\n`;
                topValues.forEach(([value, count]) => {
                    report += `  - ${value}: ${count}次\n`;
                });
                report += `\n`;
            }
        });
        
        // 创建下载链接
        const blob = new Blob([report], { type: 'text/plain' });
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