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
                // await writeTicketsToSheet(tickets);
            } catch (error) {
                alert('查询失败: ' + error);
            }
        }
    });
}

// 添加显示 toast 的函数
function showToast(message: string) {
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