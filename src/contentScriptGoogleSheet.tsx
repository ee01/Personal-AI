import { fetchJiraTickets } from './jira';
import { Sheet } from './sheet';
import { JiraTicket } from './types';
import { getEnvConfig } from './utils';

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

    const { type } = message;

    if (type === 'OPEN_JIRA_QUERY_DIALOG') {
        openJqlDialog(message.url, message.sheetToken);
        url = message.url;
        sheetToken = message.sheetToken;
    }

    return true; // 为所有消息保持消息通道开启
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
                      })).map(ticket => headers.map(field => ticket[field as keyof JiraTicket]).join('\t'))].join('\n');
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
                    const sheet = new Sheet(url, sheetToken);
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
                        const keyToRowMap = new Map<string, number>();
                        values.forEach((row: string[], index: number) => {
                            const key = row[keyColumnIndex]?.replace(/.*"([^"]+)".*/, '$1'); // 提取超链接中的 key
                            if (key) {
                                keyToRowMap.set(key, index);
                            }
                        });

                        // 分离需要更新和需要追加的数据
                        const updatesData: UpdateData[] = [];
                        const appendData: string[][] = [];

                        // 格式化每个 ticket 的数据
                        tickets.forEach(ticket => {
                            const headerValues = Object.values(sheetHeaders).filter((value): value is string => 
                                typeof value === 'string' && value.length > 0
                            );
                            const maxColIndex = getMaxColumnIndex(headerValues);
                            const row = new Array(maxColIndex).fill('');

                            // 填充数据
                            headers.forEach(field => {
                                const columnIndex = sheetHeaders[field as keyof JiraTicket];
                                if (columnIndex && typeof columnIndex === 'string') {
                                    try {
                                        const colIndex = getColumnIndex(columnIndex);
                                        if (field === 'key') {
                                            row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${ticket.key}", "${ticket.key}")`;
                                        } else {
                                            row[colIndex] = ticket[field as keyof JiraTicket] || '';
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

interface JiraHeaders {
    summary: string;
    description: string;
    issueType: string;
    priority: string;
    assignee: string;
    reporter: string;
    labels: string;
    components: string;
    fixVersions: string;
    affectsVersions: string;
    linkedIssues: string;
    epicLink: string;
    sprint: string;
    storyPoints: string;
    customFields: { [key: string]: string };
}

interface UpdateData {
    rowIndex: number;
    data: string[];
}

// 查找有效的Jira字段表头
async function findValidJiraHeaders(sheet: Sheet): Promise<JiraTicket> {
    try {
        let headerMapping: { [key: string]: string } = {};
        
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
        const validHeaders: JiraTicket = {
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
            status: '',
        };

        // 遍历所有列标题，查找匹配的 Jira 字段
        headers.forEach((header: string, index: number) => {
            const headerLower = header.toLowerCase();
            const columnLetter = String.fromCharCode(65 + index);
            
            // 检查是否在配置映射中存在匹配
            for (const [configKey, jiraField] of Object.entries(headerMapping)) {
                if (headerLower.includes(configKey)) {
                    console.log(`别名匹配: "${headerLower}" -> "${jiraField}" (列 ${columnLetter})`);
                    (validHeaders as any)[jiraField] = columnLetter;
                    break;
                } else if (Object.keys(validHeaders).includes(headerLower)) {
                    console.log(`字段匹配: "${headerLower}" (列 ${columnLetter})`);
                    (validHeaders as any)[headerLower] = columnLetter;
                    break;
                }
            }

            // 检查是否直接匹配字段名
            for (const field of Object.keys(validHeaders)) {
                if (headerLower === field.toLowerCase()) {
                    console.log(`直接匹配: "${headerLower}" -> "${field}" (列 ${columnLetter})`);
                    (validHeaders as any)[field] = columnLetter;
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

function getColumnIndex(column: string): number {
    if (!column || typeof column !== 'string' || column.length === 0) {
        throw new Error('无效的列标识');
    }
    const upperColumn = column.toUpperCase();
    return upperColumn.charCodeAt(0) - 65;
}

function getMaxColumnIndex(headers: string[]): number {
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
        return 0;
    }
    const validHeaders = headers.filter(h => typeof h === 'string' && h.length > 0);
    return Math.max(...validHeaders.map(col => col.toUpperCase().charCodeAt(0) - 64));
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
