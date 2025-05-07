import { fetchJiraTickets } from './jira';
import { Sheet } from './sheet';
import { JiraTicket } from './types';
import { getEnvConfig } from './utils';

// Main listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('收到消息:', message, '发送者:', sender);

    if (!message || !message.type) {
        console.warn('收到无效消息格式');
        sendResponse({ success: false, error: '无效消息格式' });
        return true;
    }

    const { type } = message;

    if (type === 'OPEN_JIRA_QUERY_DIALOG') {
        openJqlDialog(message.url, message.sheetToken);
        sendResponse({ success: true });
    } else if (type === 'EXPAND_EPIC_TICKETS') {
        if (!message.url || !message.sheetToken) {
            console.error('EXPAND_EPIC_TICKETS 缺少 url 或 sheetToken');
            showToast('缺少必要参数', 'error');
            sendResponse({ success: false, error: '缺少必要参数' });
        } else {
            handleExpandEpicTickets(message.url, message.sheetToken)
                .then(() => sendResponse({ success: true }))
                .catch(error => {
                    console.error('处理 EXPAND_EPIC_TICKETS 时出错:', error);
                    showToast(`展开 Epic 失败: ${error.message || error}`, 'error');
                    sendResponse({ success: false, error: error.message || String(error) });
                });
        }
    } else {
        console.log('未处理的消息类型:', type);
    }

    return true;
});

// 创建 JQL 查询对话框
async function openJqlDialog(url: string, sheetToken: string) {
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
        <p style="font-size: 12px; color: #666; margin-top: -5px; margin-bottom: 10px;">请在 <a href="https://jira.ringcentral.com/issues/?jql=" target="_blank">filter 查询页面</a> 配置需要展示的 columns 且设为列表模式。</p>
        <div style="display: flex; justify-content: flex-end;">
            <button id="cancel" style="margin-right: 10px;">取消</button>
            <button id="submit">查询</button>
        </div>
    `;

    document.body.appendChild(dialog);

    // 添加事件监听器
    document.getElementById('cancel')?.addEventListener('click', () => {
        if (document.body.contains(dialog)) {
        document.body.removeChild(dialog);
        }
    });

    document.getElementById('submit')?.addEventListener('click', async () => {
        const jql = (document.getElementById('jql') as HTMLTextAreaElement).value;
        if (jql) {
            try {
                showToast('正在查询 Jira...');
                const tickets = await fetchJiraTickets(jql);
                console.log('tickets', tickets);
                if (!tickets.length) {
                    showToast('没有找到数据', 'warning');
                    if (document.body.contains(dialog)) document.body.removeChild(dialog);
                    return;
                }
                if (!sheetToken) {
                    // 剪切板模式
                    const headers = ['key', 'summary', 'status', 'assignee', 'reporter'];
                    const formattedData = [headers.join('\t'), ...tickets.map(ticket => ({
                        ...ticket,
                        key: `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`
                      })).map(ticket => headers.map(field => ticket[field as keyof JiraTicket] || '').join('\t'))].join('\n');
                    await navigator.clipboard.writeText(formattedData);
                    console.log('formattedData', formattedData);
                    showToast('Jira 数据已复制到剪贴板', 'success');
                } else {
                    // 接口模式
                    if (!url) {
                        showToast('缺少表格 URL', 'error');
                        return;
                    }

                    const sheet = new Sheet(url, sheetToken);
                    try {
                        await sheet.init();
                        const values = await sheet.readSheet();
                        console.log('values', values);
                        const sheetHeaders = await findValidJiraHeaders(sheet);
                        const displayHeaders = ['key', 'summary', 'status', 'assignee', 'reporter']; 

                        const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
                        if (keyColumnIndex === -1) {
                            const inferredKeyIndex = values[0]?.findIndex((header: string) => header.toLowerCase().includes('key') || header.toLowerCase().includes('jira'));
                            if (inferredKeyIndex !== -1 && inferredKeyIndex !== undefined) {
                                sheetHeaders.key = String.fromCharCode(65 + inferredKeyIndex);
                                console.warn(`未在配置中找到 Key 列，已推断为列 ${sheetHeaders.key}`);
                            } else {
                                throw new Error('未找到或无法推断 Jira Key 列，请检查表头或配置');
                            }
                        }

                        const keyToRowMap = new Map<string, number>();
                        values.slice(1).forEach((row: string[], index: number) => { 
                            const keyCell = row[getColumnIndex(sheetHeaders.key!)];
                             let key = '';
                             if (keyCell) {
                                 const match = keyCell.match(/browse\/([A-Z0-9]+-[0-9]+)/i);
                                 if (match && match[1]) {
                                     key = match[1];
                                 } else if (/^[A-Z0-9]+-[0-9]+$/i.test(keyCell.trim())) {
                                     key = keyCell.trim();
                                 }
                             }
                            if (key) {
                                keyToRowMap.set(key, index + 1);
                            }
                        });

                        const operations: TicketOperation[] = tickets.map(ticket => {
                            const existingRowIndex = keyToRowMap.get(ticket.key);
                            return {
                                ticket,
                                type: existingRowIndex !== undefined ? 'update' : 'append',
                                rowIndex: existingRowIndex
                            };
                        });

                        const confirmedOperations = await showConfirmationDialog(operations, displayHeaders, sheetHeaders);
                        
                        if (confirmedOperations.length === 0) {
                            showToast('操作已取消');
                            if (document.body.contains(dialog)) document.body.removeChild(dialog);
                            return;
                        }

                        const updatesData: UpdateData[] = [];
                        const appendData: string[][] = [];
                            const headerValues = Object.values(sheetHeaders).filter((value): value is string => 
                                typeof value === 'string' && value.length > 0
                            );
                            const maxColIndex = getMaxColumnIndex(headerValues);

                        confirmedOperations.forEach(operation => {
                            const row = new Array(maxColIndex).fill('');
                            Object.keys(operation.ticket).forEach(ticketKey => {
                                const columnLetter = (sheetHeaders as Record<string, string>)[ticketKey];
                                if (columnLetter && typeof columnLetter === 'string') {
                                    try {
                                        const colIndex = getColumnIndex(columnLetter);
                                        if (ticketKey === 'key') {
                                            row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${operation.ticket.key}", "${operation.ticket.key}")`;
                                        } else {
                                            row[colIndex] = (operation.ticket as Record<string, any>)[ticketKey] || '';
                                        }
                                    } catch (error) {
                                        console.error(`处理列 ${columnLetter} (字段 ${ticketKey}) 时出错:`, error);
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

                        let updatedCount = 0;
                        let appendedCount = 0;

                        if (updatesData.length > 0) {
                            for (const update of updatesData) {
                                const startColumn = 'A';
                                const range = `${startColumn}${update.rowIndex+1}`; 
                                console.log(`Updating range: ${range}`, update.data)
                                await sheet.writeSheet([update.data], range);
                                updatedCount++;
                            }
                        }

                        if (appendData.length > 0) {
                            const startPosition = `A${values.length + 1}`;
                            console.log(`Appending data starting from: ${startPosition}`, appendData);
                            await sheet.writeSheet(appendData, startPosition);
                            appendedCount = appendData.length;
                        }

                        let toastMessage = '';
                        if (updatedCount > 0) toastMessage += `已更新 ${updatedCount} 条数据。`;
                        if (appendedCount > 0) toastMessage += `已追加 ${appendedCount} 条新数据。`;
                        if (toastMessage === '') toastMessage = '没有需要更新或追加的数据。';
                        
                        showToast(toastMessage.trim(), 'success');

                    } catch (error) {
                        console.error('Google Sheets 操作失败:', error);
                        showToast('Google Sheets 操作失败: ' + (error instanceof Error ? error.message : error), 'error');
                    }
                }
                if (document.body.contains(dialog)) {
                document.body.removeChild(dialog);
                }
            } catch (error) {
                console.error('查询或处理失败: ', error);
                 showToast('查询或处理失败: ' + (error instanceof Error ? error.message : error), 'error');
                 if (document.body.contains(dialog)) document.body.removeChild(dialog);
            }
        } else {
            showToast('请输入 JQL 查询语句', 'warning');
        }
    });
}

interface JiraHeaders {
    key?: string;
    summary?: string;
    description?: string;
    issuetype?: string;
    priority?: string;
    assignee?: string;
    reporter?: string;
    labels?: string;
    components?: string;
    fixVersions?: string;
    affectsVersions?: string;
    linkedIssues?: string;
    epicLink?: string;
    sprint?: string;
    storyPoints?: string;
    status?: string;
    [key: string]: string | undefined;
}

interface UpdateData {
    rowIndex: number;
    data: string[];
}

interface TicketOperation {
    ticket: JiraTicket;
    type: 'update' | 'append';
    rowIndex?: number;
}

// 查找有效的Jira字段表头
async function findValidJiraHeaders(sheet: Sheet): Promise<JiraHeaders> {
    try {
        let headerMapping: { [key: string]: string } = {};
        const customFieldMapping: { [key: string]: string } = {};
        
        try {
            const configData = await sheet.readConfigSheet();
            console.log('configData', configData);
            if (configData && configData.length >= 2) {
                const sheetHeaderIndex = configData[0].findIndex((h: string) => h.toLowerCase().includes('sheet column'));
                const jiraFieldIndex = configData[0].findIndex((h: string) => h.toLowerCase().includes('jira field'));

                if (sheetHeaderIndex === -1 || jiraFieldIndex === -1) {
                    console.warn('配置表中未找到 "Sheet Header" 或 "Jira Field" 列，将使用默认别名');
                    throw new Error('Invalid config sheet headers');
                }

                for (let i = 1; i < configData.length; i++) {
                    const row = configData[i];
                    if (row.length > Math.max(sheetHeaderIndex, jiraFieldIndex)) {
                        const sheetHeader = row[sheetHeaderIndex]?.trim().toLowerCase();
                        let jiraField = row[jiraFieldIndex]?.trim();

                        if (sheetHeader && jiraField) {
                            if (jiraField.toLowerCase() === 'jira key' || jiraField.toLowerCase() === 'key') {
                                jiraField = 'key';
                            }
                            headerMapping[sheetHeader] = jiraField;
                            if (jiraField.toLowerCase().startsWith('customfield_')) {
                                customFieldMapping[sheetHeader] = jiraField;
                            }
                        }
                    }
                }
                 console.log('从配置表加载的映射:', headerMapping);
            } else {
                 console.warn('配置表数据为空或格式不正确，将使用默认别名');
                 throw new Error('配置表数据为空或格式不正确');
            }
        } catch (error) {
            console.warn('读取配置表失败，将使用默认字段别名:', error);
            headerMapping = {
                'key': 'key',
                'jira': 'key',
                'jira key': 'key',
                'jira link': 'key',
                'jira id': 'key',
                'id': 'key',
                'issue key': 'key',
                'summary': 'summary',
                'title': 'summary',
                '概要': 'summary',
                'description': 'description',
                '描述': 'description',
                'type': 'issuetype',
                'issue type': 'issuetype',
                '类型': 'issuetype',
                'priority': 'priority',
                '优先级': 'priority',
                'assignee': 'assignee',
                '经办人': 'assignee',
                'reporter': 'reporter',
                '报告人': 'reporter',
                'status': 'status',
                '状态': 'status',
                'labels': 'labels',
                'label': 'labels',
                '标签': 'labels',
                'components': 'components',
                'component': 'components',
                '模块': 'components',
                'fix versions': 'fixVersions',
                'fix version': 'fixVersions',
                '修复版本': 'fixVersions',
                'affects versions': 'affectsVersions',
                'affect version': 'affectsVersions',
                '影响版本': 'affectsVersions',
                'linked issues': 'linkedIssues',
                '关联问题': 'linkedIssues',
                'epic link': 'epicLink',
                'epic': 'epicLink',
                'sprint': 'sprint',
                '冲刺': 'sprint',
                'story points': 'storyPoints',
                'story point': 'storyPoints',
                '故事点': 'storyPoints'
            };
        }

        const headers = await sheet.getHeaders();
        console.log('Sheet Headers:', headers);
        const validHeaders: JiraHeaders = {};

        const knownFields = [
            'key', 'summary', 'description', 'issuetype', 'priority', 
            'assignee', 'reporter', 'status', 'labels', 'components', 
            'fixVersions', 'affectsVersions', 'linkedIssues', 'epicLink', 
            'sprint', 'storyPoints'
        ];

        headers.forEach((header: string, index: number) => {
            if (!header) return;
            const headerLower = header.trim().toLowerCase();
            const columnLetter = String.fromCharCode(65 + index);
            
            if (headerMapping[headerLower]) {
                 const jiraField = headerMapping[headerLower];
                 if (!validHeaders[jiraField]) {
                     validHeaders[jiraField] = columnLetter;
                     console.log(`配置/别名匹配: "${header}" -> "${jiraField}" (列 ${columnLetter})`);
                 } else {
                      console.warn(`列 ${columnLetter} ("${header}") 的别名 "${headerLower}" 与列 ${validHeaders[jiraField]} 冲突，都指向 "${jiraField}"。将使用第一个匹配。`);
                 }
                 return;
            }

            const directMatch = knownFields.find(field => field.toLowerCase() === headerLower);
            if (directMatch) {
                 if (!validHeaders[directMatch]) {
                    validHeaders[directMatch] = columnLetter;
                    console.log(`直接字段名匹配: "${header}" -> "${directMatch}" (列 ${columnLetter})`);
                 } else {
                    console.warn(`列 ${columnLetter} ("${header}") 的直接匹配与列 ${validHeaders[directMatch]} 冲突，都指向 "${directMatch}"。将使用第一个匹配。`);
                 }
                 return; 
            }
            
        });

        if (!validHeaders.key) {
             console.warn("未能自动映射 'key' 列。请检查表头或在配置表中明确指定 'key' 或 'Jira Key'。");
        }

        console.log('最终有效表头映射:', validHeaders);
        return validHeaders;
    } catch (error) {
        console.error('查找有效 Jira 标题时出错:', error);
        showToast('查找表头映射时出错: ' + (error instanceof Error ? error.message : error), 'error')
        throw error;
    }
}

function getColumnIndex(column: string): number {
    if (!column || typeof column !== 'string' || !/^[A-Z]+$/.test(column.toUpperCase())) {
        throw new Error(`无效的列标识符: "${column}"`);
    }
    const upperColumn = column.toUpperCase();
    let index = 0;
    for (let i = 0; i < upperColumn.length; i++) {
        index = index * 26 + (upperColumn.charCodeAt(i) - 64);
    }
    return index - 1;
}

function getMaxColumnIndex(columnLetters: string[]): number {
     if (!columnLetters || !Array.isArray(columnLetters) || columnLetters.length === 0) {
         return 0;
     }
     const validLetters = columnLetters.filter(h => typeof h === 'string' && /^[A-Z]+$/.test(h.toUpperCase()));
     if (validLetters.length === 0) {
        return 0;
    }
     const indices = validLetters.map(col => getColumnIndex(col));
     return Math.max(...indices) + 1;
}

// 显示确认弹窗
async function showConfirmationDialog(
    operations: TicketOperation[],
    displayHeaders: string[],
    sheetHeaders: JiraHeaders
): Promise<TicketOperation[]> {
    return new Promise((resolve) => {
        const dialog = document.createElement('div');
        dialog.id = 'jiraConfirmationDialog';
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
            width: 800px;
            max-width: 90vw;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;

        const columnsToUpdate = displayHeaders
            .filter(field => sheetHeaders[field as keyof JiraHeaders])
            .map(field => field);

        const updateCount = operations.filter(op => op.type === 'update').length;
        const appendCount = operations.filter(op => op.type === 'append').length;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; flex-shrink: 0;">确认数据操作</h3>
            <div style="margin-bottom: 15px; flex-shrink: 0;">
                <div style="margin-bottom: 10px;">
                    <strong>将要操作的列：</strong> 
                    <span style="color: #666;">${columnsToUpdate.join(', ')}</span>
                </div>
                <div style="color: #666;">
                    <div>更新现有数据：${updateCount} 条</div>
                    <div>新增数据：${appendCount} 条</div>
                </div>
            </div>
            <div style="margin-bottom: 10px; flex-shrink: 0;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="selectAllTickets" checked style="margin-right: 5px;">
                    全选/取消全选
                </label>
            </div>
             <div style="flex-grow: 1; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; margin-bottom: 15px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
                        <tr>
                            <th style="padding: 8px; text-align: left; width: 50px;">选择</th>
                            <th style="padding: 8px; text-align: left; width: 80px;">操作</th>
                            ${displayHeaders.map(header => `<th style="padding: 8px; text-align: left;">${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${operations.map((op, index) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 8px;">
                                    <input type="checkbox" class="ticket-checkbox" data-index="${index}" checked>
                                </td>
                                <td style="padding: 8px;">
                                    <span style="color: ${op.type === 'update' ? '#f0ad4e' : '#5cb85c'}; font-weight: bold;">
                                        ${op.type === 'update' ? '更新' : '新增'}
                                    </span>
                                </td>
                                ${displayHeaders.map(field => {
                                    let value = op.ticket[field as keyof JiraTicket] || '';
                                    if (value.length > 100) value = value.substring(0, 97) + '...'; 
                                    return `<td style="padding: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${op.ticket[field as keyof JiraTicket] || ''}">${value}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                <button id="cancelOperation" style="padding: 6px 12px; background: #eee; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">取消</button>
                <button id="confirmOperation" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">确认 (${operations.length})</button> 
            </div>
        `;

        document.body.appendChild(dialog);

        const selectAllCheckbox = document.getElementById('selectAllTickets') as HTMLInputElement;
        const ticketCheckboxes = dialog.getElementsByClassName('ticket-checkbox') as HTMLCollectionOf<HTMLInputElement>;
        const confirmButton = document.getElementById('confirmOperation') as HTMLButtonElement;

        const updateConfirmButtonCount = () => {
            const selectedCount = Array.from(ticketCheckboxes).filter(cb => cb.checked).length;
            confirmButton.textContent = `确认 (${selectedCount})`;
            confirmButton.disabled = selectedCount === 0;
        };

        selectAllCheckbox.addEventListener('change', () => {
            Array.from(ticketCheckboxes).forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
            updateConfirmButtonCount();
        });

        Array.from(ticketCheckboxes).forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                selectAllCheckbox.checked = Array.from(ticketCheckboxes).every(cb => cb.checked);
                updateConfirmButtonCount();
            });
        });

        document.getElementById('cancelOperation')?.addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve([]);
        });

        confirmButton.addEventListener('click', () => {
            const selectedOperations = Array.from(ticketCheckboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => operations[parseInt(checkbox.dataset.index || '0')]);
            
            document.body.removeChild(dialog);
            resolve(selectedOperations);
        });

        updateConfirmButtonCount(); 
    });
}

// 添加显示 toast 的函数
function showToast(message: string, type = 'info') {
    const existingToasts = document.querySelectorAll(`.jira-toast-${type}`);
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `jira-toast-${type}`;
    toast.textContent = message;
    let backgroundColor = 'rgba(0, 0, 0, 0.7)';
    if (type === 'error') backgroundColor = 'rgba(220, 53, 69, 0.9)';
    else if (type === 'success') backgroundColor = 'rgba(40, 167, 69, 0.9)';
    else if (type === 'warning') backgroundColor = 'rgba(255, 193, 7, 0.9)';

    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${backgroundColor};
        color: ${type === 'warning' ? 'black' : 'white'};
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

// 新增：处理展开 Epic Tickets 的函数
async function handleExpandEpicTickets(sheetUrl: string, token: string) {
    showToast('开始查找 Epic 并获取子任务...');
    const envConfig = await getEnvConfig();
    const sheet = new Sheet(sheetUrl, token);
    
    try {
        await sheet.init();
        const values = await sheet.readSheet();
        if (!values || values.length === 0) {
            showToast('表格为空或无法读取', 'error');
            return;
        }
        const sheetHeaders = await findValidJiraHeaders(sheet);

        // 找到 key 列的索引
        const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
        if (keyColumnIndex === -1) {
            throw new Error('未找到 Jira Key 列，请检查表头或配置');
        }
        console.log('Jira Key 列索引:', keyColumnIndex);

        const epicsToExpand: { epicKey: string; epicSummary: string; rowIndex: number; subTickets: JiraTicket[] }[] = [];

        // 遍历表格查找 Epic Key 并查询子任务
        // 从第二行开始，跳过表头
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            const keyCellContent = row[keyColumnIndex];
            
            // 尝试从 HYPERLINK 或纯文本中提取 key
            let epicKey = '';
            if (keyCellContent) {
                const match = keyCellContent.match(/browse\/([A-Z0-9]+-[0-9]+)/i); // 提取 browse/ 后面的 Key
                 if (match && match[1]) {
                     epicKey = match[1];
                 } else if (/^[A-Z0-9]+-[0-9]+$/i.test(keyCellContent.trim())) { // 如果是纯 Key
                    epicKey = keyCellContent.trim();
                 }
            }


            if (epicKey) {
                console.log(`找到 Key: ${epicKey} 在行 ${i + 1}`);
                const jql = `issueFunction in issuesInEpics("key = ${epicKey}")`;
                try {
                    const subTickets = await fetchJiraTickets(jql);
                    if (subTickets.length > 0) {
                        console.log(`Epic ${epicKey} 有 ${subTickets.length} 个子任务`);
                        // 尝试获取 Epic 的概要信息（如果其他列存在）
                        const summaryColumnIndex = sheetHeaders.summary ? getColumnIndex(sheetHeaders.summary) : -1;
                        const epicSummary = summaryColumnIndex !== -1 && row[summaryColumnIndex] ? row[summaryColumnIndex] : epicKey; // Default to key if summary missing
                        
                        epicsToExpand.push({ 
                            epicKey, 
                            epicSummary: epicSummary,
                            rowIndex: i, // 0-based index
                            subTickets 
                        });
                    } else {
                         console.log(`Epic ${epicKey} 没有子任务或不是 Epic`);
                    }
                } catch (fetchError: Error | any) { // Specify type for fetchError
                    console.error(`查询 Epic ${epicKey} 的子任务失败:`, fetchError);
                    // 选择性地通知用户或继续处理下一个
                    showToast(`查询 ${epicKey} 子任务失败: ${fetchError.message || fetchError}`, 'error'); // Show error message
                }
            } else {
                // console.log(`行 ${i + 1} 未找到有效的 Key`);
            }
        }

        if (epicsToExpand.length === 0) {
            showToast('未找到任何包含子任务的 Epic', 'info');
            return;
        }

        showToast(`找到 ${epicsToExpand.length} 个 Epic 包含子任务，准备确认操作...`);

        // --- 下一步: 修改确认对话框并处理插入/分组 ---
        console.log('准备确认的 Epics:', epicsToExpand);
        
        const confirmedEpics = await showEpicConfirmationDialog(epicsToExpand);
        
        if (confirmedEpics && confirmedEpics.length > 0) {
            await insertSubTickets(sheet, confirmedEpics, sheetHeaders, envConfig.JIRA_BASE_URL);
            showToast(`已成功展开 ${confirmedEpics.length} 个 Epic 的子任务`, 'success');
        } else {
            showToast('操作已取消', 'info');
        }
        
        // 临时占位符，表示流程进行到这里
        showToast('子任务查找完成，确认、插入和分组功能待实现', 'warning');


    } catch (error: Error | any) { // Specify type for error
        console.error('处理 Epic 展开时出错:', error);
        showToast('处理 Epic 展开时出错: ' + (error.message || error), 'error'); // Use error.message if available
        throw error; // Re-throw error to be caught by the caller
    }
}

// Epic 确认对话框
async function showEpicConfirmationDialog(
    epics: { epicKey: string; epicSummary: string; rowIndex: number; subTickets: JiraTicket[] }[]
): Promise<typeof epics> {
    return new Promise((resolve) => {
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
            width: 800px;
            max-width: 90vw;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; flex-shrink: 0;">确认展开 Epic</h3>
            <div style="margin-bottom: 15px; flex-shrink: 0;">
                <div style="color: #666;">
                    找到 ${epics.length} 个包含子任务的 Epic
                </div>
            </div>
            <div style="margin-bottom: 10px; flex-shrink: 0;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="selectAllEpics" checked style="margin-right: 5px;">
                    全选/取消全选
                </label>
            </div>
            <div style="flex-grow: 1; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; margin-bottom: 15px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: #f5f5f5; z-index: 1;">
                        <tr>
                            <th style="padding: 8px; text-align: left; width: 50px;">选择</th>
                            <th style="padding: 8px; text-align: left;">Epic</th>
                            <th style="padding: 8px; text-align: left;">子任务数量</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${epics.map((epic, index) => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 8px;">
                                    <input type="checkbox" class="epic-checkbox" data-index="${index}" checked>
                                </td>
                                <td style="padding: 8px;">
                                    ${epic.epicKey} - ${epic.epicSummary}
                                </td>
                                <td style="padding: 8px;">
                                    ${epic.subTickets.length} 个子任务
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; flex-shrink: 0;">
                <button id="cancelOperation" style="padding: 6px 12px; background: #eee; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">取消</button>
                <button id="confirmOperation" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">确认</button>
            </div>
        `;

        document.body.appendChild(dialog);

        const selectAllCheckbox = document.getElementById('selectAllEpics') as HTMLInputElement;
        const epicCheckboxes = dialog.getElementsByClassName('epic-checkbox') as HTMLCollectionOf<HTMLInputElement>;
        const confirmButton = document.getElementById('confirmOperation') as HTMLButtonElement;

        selectAllCheckbox.addEventListener('change', () => {
            Array.from(epicCheckboxes).forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
        });

        Array.from(epicCheckboxes).forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                selectAllCheckbox.checked = Array.from(epicCheckboxes).every(cb => cb.checked);
            });
        });

        document.getElementById('cancelOperation')?.addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve([]);
        });

        confirmButton.addEventListener('click', () => {
            const selectedEpics = Array.from(epicCheckboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => epics[parseInt(checkbox.dataset.index || '0')]);
            
            document.body.removeChild(dialog);
            resolve(selectedEpics);
        });
    });
}

// 插入子任务
async function insertSubTickets(
    sheet: Sheet,
    epics: { epicKey: string; epicSummary: string; rowIndex: number; subTickets: JiraTicket[] }[],
    sheetHeaders: JiraHeaders,
    jiraBaseUrl: string
) {
    // 按行号从大到小排序，这样插入时不会影响后续的行号
    const sortedEpics = [...epics].sort((a, b) => b.rowIndex - a.rowIndex);
    
    for (const epic of sortedEpics) {
        const insertRowIndex = epic.rowIndex + 2; // +2 因为 rowIndex 是 0-based，且我们要插在 Epic 行的下方
        const displayHeaders = ['key', 'summary', 'status', 'assignee', 'reporter'];
        const maxColIndex = getMaxColumnIndex(Object.values(sheetHeaders).filter((value): value is string => 
            typeof value === 'string' && value.length > 0
        ));

        // 先插入空行
        const rowsToInsert = epic.subTickets.length;
        if (rowsToInsert > 0) {
            try {
                await sheet.insertDimension('ROWS', insertRowIndex - 1, insertRowIndex - 1 + rowsToInsert);
                console.log(`已在行 ${insertRowIndex} 插入 ${rowsToInsert} 个空行`);
            } catch (error) {
                console.error('插入空行失败:', error);
                showToast(`插入空行失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
                continue;
            }
        }

        const subTicketRows = epic.subTickets.map(ticket => {
            const row = new Array(maxColIndex).fill('');
            displayHeaders.forEach(field => {
                const columnLetter = sheetHeaders[field as keyof JiraTicket];
                if (columnLetter && typeof columnLetter === 'string') {
                    const colIndex = getColumnIndex(columnLetter);
                    if (field === 'key') {
                        row[colIndex] = `=HYPERLINK("${jiraBaseUrl}/browse/${ticket.key}", "${ticket.key}")`;
                    } else {
                        row[colIndex] = ticket[field as keyof JiraTicket] || '';
                    }
                }
            });
            return row;
        });

        // 写入子任务数据
        const startPosition = `A${insertRowIndex}`;
        await sheet.writeSheet(subTicketRows, startPosition);
        console.log(`已在行 ${insertRowIndex} 写入 ${subTicketRows.length} 个子任务`);
    }
}
