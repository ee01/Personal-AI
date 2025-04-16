import { fetchJiraTickets } from './googleSheets';
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
                
                // 尝试直接在当前打开的Google Sheets中插入数据
                // insertTicketsToActiveSheet(tickets, envConfig);
            } catch (error) {
                alert('查询失败: ' + error);
            }
        }
    });
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
