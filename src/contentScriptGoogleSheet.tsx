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

// 创建带预填值的 JQL 查询对话框（用于错误恢复等场景）
function openJqlDialogWithValues(url: string, sheetToken: string, jql: string, keepDataSameAsJql: boolean, keepOrderSameAsJql: boolean) {
    openJqlDialog(url, sheetToken).then(() => {
        // 对话框创建后填入之前的值
        setTimeout(() => {
            const jqlTextarea = document.getElementById('jql') as HTMLTextAreaElement;
            const dataCheckbox = document.getElementById('keepDataSameAsJql') as HTMLInputElement;
            const orderContainer = document.getElementById('orderContainer');
            const orderCheckbox = document.getElementById('keepOrderSameAsJql') as HTMLInputElement;
            
            if (jqlTextarea) {
                jqlTextarea.value = jql;
                jqlTextarea.focus();
            }
            if (keepDataSameAsJql && dataCheckbox) {
                dataCheckbox.checked = true;
                if (orderContainer) {
                    orderContainer.style.display = 'flex';
                }
                if (keepOrderSameAsJql && orderCheckbox) {
                    orderCheckbox.checked = true;
                }
            }
        }, 100);
    });
}

// 创建 JQL 查询对话框
async function openJqlDialog(url: string, sheetToken: string) {
    const _envConfig = await getEnvConfig();
    
    // 先创建对话框并显示（使用默认值）
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
        <div style="position: relative;">
            <button id="closeDialog" style="position: absolute; top: -10px; right: -10px; background: transparent; color: grey; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1; padding: 0;">&times;</button>
            <h3 style="margin-top: 0;">输入 JQL 添加 JIRA 数据到表格</h3>
        </div>
        <textarea id="jql" style="width: 100%; height: 100px; margin-bottom: 10px;" placeholder="filter=xxxx"></textarea>
        <p style="font-size: 12px; color: #666; margin-top: -5px; margin-bottom: 10px;">请在 <a href="https://jira.ringcentral.com/issues/?jql=" target="_blank">filter 查询页面</a> 配置需要展示的 columns 且设为列表模式。</p>
        <div id="syncContainer" style="margin-bottom: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">
            <label style="display: flex; align-items: flex-start; cursor: pointer; margin-bottom: 8px;">
                <input type="checkbox" id="keepDataSameAsJql" style="margin-right: 8px; margin-top: 3px;">
                <span style="font-size: 13px;">
                    <strong>保持数据一致</strong><br>
                    <span style="color: #856404; font-size: 12px;">⚠️ 启用后，表格中不在 JQL 查询结果中的数据行将被移除</span>
                </span>
            </label>
            <label id="orderContainer" style="display: none; align-items: flex-start; cursor: pointer; margin-left: 24px;">
                <input type="checkbox" id="keepOrderSameAsJql" style="margin-right: 8px; margin-top: 3px;">
                <span style="font-size: 13px;">
                    <strong>同时使用 JQL 排序</strong><br>
                    <span style="color: #856404; font-size: 12px;">📋 调整表格行顺序与 JQL 查询结果一致</span>
                </span>
            </label>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <button id="configMapping" style="background: #6c757d; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">配置表头JIRA映射</button>
            <div style="display: flex; gap: 10px;">
                <button id="updateExisting" style="background: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">刷新表数据</button>
                <button id="submit" style="background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">查询</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
    
    // 聚焦到 JQL 输入框
    const jqlTextarea = document.getElementById('jql') as HTMLTextAreaElement;
    if (jqlTextarea) {
        jqlTextarea.focus();
    }
    
    // 异步加载配置并更新对话框内容
    if (sheetToken && url) {
        (async () => {
            try {
                const sheet = await Sheet.fromUrl(url, sheetToken);
                const configData = await sheet.readConfigSheet();
                const globalSettings = parseGlobalSettings(configData);
                console.log('加载的全局设置:', globalSettings);
                
                // 更新 JQL 输入框
                if (globalSettings.defaultJql) {
                    const jqlTextarea = document.getElementById('jql') as HTMLTextAreaElement;
                    if (jqlTextarea && !jqlTextarea.value) {
                        jqlTextarea.value = globalSettings.defaultJql;
                        // 将光标移到文本末尾
                        jqlTextarea.setSelectionRange(globalSettings.defaultJql.length, globalSettings.defaultJql.length);
                    }
                }
                
                // 更新同步选项勾选状态
                const dataCheckbox = document.getElementById('keepDataSameAsJql') as HTMLInputElement;
                const orderContainer = document.getElementById('orderContainer');
                const orderCheckbox = document.getElementById('keepOrderSameAsJql') as HTMLInputElement;
                if (globalSettings.keepDataSameAsJql && dataCheckbox) {
                    dataCheckbox.checked = true;
                    // 显示排序选项
                    if (orderContainer) {
                        orderContainer.style.display = 'flex';
                    }
                    // 如果配置了保持顺序一致，则勾选
                    if (globalSettings.keepOrderSameAsJql && orderCheckbox) {
                        orderCheckbox.checked = true;
                    }
                }
            } catch (error) {
                console.warn('读取配置表失败，使用默认设置:', error);
            }
        })();
    }

    // 添加关闭对话框事件监听器
    document.getElementById('closeDialog')?.addEventListener('click', () => {
        if (document.body.contains(dialog)) {
            document.body.removeChild(dialog);
        }
    });
    
    // 当"保持数据一致"勾选状态变化时，切换"同时使用 JQL 排序"的显示
    document.getElementById('keepDataSameAsJql')?.addEventListener('change', (e) => {
        const orderContainer = document.getElementById('orderContainer');
        const orderCheckbox = document.getElementById('keepOrderSameAsJql') as HTMLInputElement;
        if (orderContainer) {
            if ((e.target as HTMLInputElement).checked) {
                orderContainer.style.display = 'flex';
            } else {
                orderContainer.style.display = 'none';
                // 取消勾选排序选项
                if (orderCheckbox) {
                    orderCheckbox.checked = false;
                }
            }
        }
    });

    document.getElementById('submit')?.addEventListener('click', async () => {
        const jql = (document.getElementById('jql') as HTMLTextAreaElement).value;
        const dataCheckbox = document.getElementById('keepDataSameAsJql') as HTMLInputElement;
        const orderCheckbox = document.getElementById('keepOrderSameAsJql') as HTMLInputElement;
        const keepDataSameAsJql = dataCheckbox?.checked || false;
        const keepOrderSameAsJql = orderCheckbox?.checked || false;
        if (jql) {
            // 保存配置到配置表（填了 JQL 就存储，各选项根据勾选状态存储）
            if (sheetToken && url) {
                saveGlobalSettingsToConfig(url, sheetToken, {
                    defaultJql: jql,
                    keepDataSameAsJql,
                    keepOrderSameAsJql
                }).catch(err => console.warn('保存配置失败:', err));
            }
            if (document.body.contains(dialog)) document.body.removeChild(dialog);
            try {
                await handleFetchJiraTicketsToSheet(jql, url, sheetToken, keepDataSameAsJql, keepOrderSameAsJql);
            } catch (error) {
                console.error('查询或处理失败: ', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                showToast('查询或处理失败: ' + errorMessage, 'error');
                
                // 如果是登录错误，重新打开对话框并带入之前的输入
                if (errorMessage.includes('需要登录')) {
                    setTimeout(() => {
                        openJqlDialogWithValues(url, sheetToken, jql, keepDataSameAsJql, keepOrderSameAsJql);
                    }, 1000);
                }
            }
        } else {
            showToast('请输入 JQL 查询语句', 'warning');
        }
    });

    // 添加更新现有 tickets 的事件监听器
    document.getElementById('updateExisting')?.addEventListener('click', async () => {
        if (!sheetToken || !url) {
            showToast('缺少表格 URL 或 token', 'error');
            return;
        }

        try {
            showToast('正在读取表格数据...');
            if (document.body.contains(dialog)) document.body.removeChild(dialog);
            const sheet = await Sheet.fromUrl(url, sheetToken);
            const values = await sheet.readSheet('FORMULA'); // 使用公式格式读取，保持超链接
            const metadata = await findValidJiraHeaders(sheet);
            const sheetHeaders = metadata.columnMapping;
            const globalSettings = metadata.globalSettings;

            // 使用全局设置中的 headerRow（1-based）
            const headerRowIndex = globalSettings.headerRow - 1; // 转为 0-based 索引
            const dataStartRowIndex = headerRowIndex + 1; // 数据从表头下一行开始
            console.log(`使用配置: 表头行=${globalSettings.headerRow}, 数据起始行=${dataStartRowIndex + 1}`);

            if (!values || values.length <= dataStartRowIndex) {
                showToast('表格为空或只有表头', 'warning');
                return;
            }

            // 获取所有现有的 Jira keys
            const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
            if (keyColumnIndex === -1) {
                showToast('未找到 Jira Key 列', 'error');
                return;
            }

            const existingKeys: string[] = [];
            // 从数据起始行开始遍历（跳过表头之前的行和表头行）
            values.slice(dataStartRowIndex).forEach((row: string[]) => {
                const keyCell = row[keyColumnIndex];
                if (keyCell) {
                    const match = keyCell.match(/browse\/([A-Z0-9]+-[0-9]+)/i);
                    if (match && match[1]) {
                        existingKeys.push(match[1]);
                    } else if (/^[A-Z0-9]+-[0-9]+$/i.test(keyCell.trim())) {
                        existingKeys.push(keyCell.trim());
                    }
                }
            });

            if (existingKeys.length === 0) {
                showToast('未找到有效的 Jira tickets', 'warning');
                return;
            }

            // 构建 JQL 查询
            const jql = `key in (${existingKeys.join(',')})`;
            handleFetchJiraTicketsToSheet(jql, url, sheetToken);
        } catch (error) {
            console.error('更新现有 tickets 失败:', error);
            showToast('更新失败: ' + (error instanceof Error ? error.message : error), 'error');
            if (document.body.contains(dialog)) document.body.removeChild(dialog);
        }
    });

    // 添加配置表头JIRA映射的事件监听器
    document.getElementById('configMapping')?.addEventListener('click', async () => {
        if (!sheetToken || !url) {
            showToast('缺少表格 URL 或 token', 'error');
            return;
        }

        try {
            showToast('正在检查配置表...');
            if (document.body.contains(dialog)) document.body.removeChild(dialog);
            const sheet = await Sheet.fromUrl(url, sheetToken);
            const sheetName = sheet.getSheetName();
            const configSheetName = `${sheetName}_config`;
            
            // 检查配置表是否存在
            const sheetId = Sheet.extractSheetId(url);
            if (!sheetId) {
                showToast('无法提取 Sheet ID', 'error');
                return;
            }
            
            const sheets = await Sheet.getSheetNames(sheetToken, sheetId);
            const configSheet = sheets.find((s: any) => s.properties.title === configSheetName);
            
            if (configSheet) {
                // 配置表存在，切换到该表
                const configGid = configSheet.properties.sheetId;
                const newUrl = url.replace(/gid=\d+/, `gid=${configGid}`);
                window.location.href = newUrl;
                showToast('正在切换到配置表...', 'success');
            } else {
                // 配置表不存在，创建新表
                showToast('配置表不存在，正在创建...');
                
                // 获取当前表的索引，以便在其右边创建配置表
                const currentGid = Sheet.extractGid(url);
                const currentSheet = sheets.find((s: any) => s.properties.sheetId.toString() === currentGid);
                const currentSheetIndex = currentSheet ? currentSheet.properties.index : undefined;
                
                const newSheetGid = await createConfigSheet(sheetToken, sheetId, configSheetName, currentSheetIndex);
                showToast('配置表创建成功，正在切换...', 'success');
                
                // 切换到新创建的配置表
                const baseUrl = url.split('#')[0].split('?')[0];
                const newUrl = `${baseUrl}#gid=${newSheetGid}`;
                window.location.href = newUrl;
            }
        } catch (error) {
            console.error('配置表头JIRA映射失败:', error);
            showToast('操作失败: ' + (error instanceof Error ? error.message : error), 'error');
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

interface GlobalSettings {
    headerRow: number;  // 表头所在行号（1-based），默认为 1
    defaultJql: string; // 默认 JQL 查询语句
    keepDataSameAsJql: boolean; // 是否保持表内容与 JQL 查询结果一致
    keepOrderSameAsJql: boolean; // 是否保持表内容顺序与 JQL 查询结果一致
}

interface JiraFieldMetadata {
    columnMapping: JiraHeaders;
    fieldTypes: { [jiraField: string]: string };
    globalSettings: GlobalSettings;
    jiraFieldToSheetHeader: { [jiraField: string]: string };  // Jira Field -> Sheet Column 名称的映射
}

interface UpdateData {
    rowIndex: number;
    columnUpdates: { [columnIndex: number]: string };
}

interface TicketOperation {
    ticket: JiraTicket;
    type: 'update' | 'append' | 'remove';
    rowIndex?: number;
}

// 从配置表解析全局设置
function parseGlobalSettings(configData: string[][]): GlobalSettings {
    const defaultSettings: GlobalSettings = {
        headerRow: 1,
        defaultJql: '',
        keepDataSameAsJql: false,
        keepOrderSameAsJql: false
    };
    
    if (!configData || configData.length < 1) {
        return defaultSettings;
    }
    
    // 查找 "Global Settings" 列的索引
    const headerRow = configData[0];
    const globalSettingsIndex = headerRow.findIndex((h: string) => 
        h && h.toLowerCase().includes('global settings')
    );
    
    if (globalSettingsIndex === -1) {
        console.log('配置表中未找到 Global Settings 区域，使用默认值');
        return defaultSettings;
    }
    
    const valueIndex = globalSettingsIndex + 1; // Value 列在 Global Settings 列的右边
    
    // 遍历配置表行，解析全局设置
    for (let i = 1; i < configData.length; i++) {
        const row = configData[i];
        if (!row || row.length <= globalSettingsIndex) continue;
        
        const settingName = row[globalSettingsIndex]?.trim().toLowerCase();
        const settingValue = row[valueIndex]?.trim();
        
        if (!settingName) continue;
        
        if (settingName === 'header row') {
            const rowNum = parseInt(settingValue, 10);
            if (!isNaN(rowNum) && rowNum >= 1) {
                defaultSettings.headerRow = rowNum;
                console.log(`全局设置: Header Row = ${rowNum}`);
            }
        } else if (settingName === 'default jql' || settingName === 'jql') {
            defaultSettings.defaultJql = settingValue || '';
            console.log(`全局设置: Default JQL = ${settingValue}`);
        } else if (settingName === 'keep data same as jql' || settingName === 'sync with jql' || settingName === 'sync mode') {
            // 兼容旧配置名
            defaultSettings.keepDataSameAsJql = settingValue?.toLowerCase() === 'true' || settingValue === '1' || settingValue?.toLowerCase() === 'yes';
            console.log(`全局设置: Keep data same as JQL = ${defaultSettings.keepDataSameAsJql}`);
        } else if (settingName === 'keep order same as jql') {
            defaultSettings.keepOrderSameAsJql = settingValue?.toLowerCase() === 'true' || settingValue === '1' || settingValue?.toLowerCase() === 'yes';
            console.log(`全局设置: Keep order same as JQL = ${defaultSettings.keepOrderSameAsJql}`);
        }
    }
    
    return defaultSettings;
}

// 保存全局设置到配置表
async function saveGlobalSettingsToConfig(
    sheetUrl: string, 
    token: string, 
    settings: { defaultJql?: string; keepDataSameAsJql?: boolean; keepOrderSameAsJql?: boolean }
): Promise<void> {
    try {
        const sheet = await Sheet.fromUrl(sheetUrl, token);
        const sheetName = sheet.getSheetName();
        const configSheetName = `${sheetName}_config`;
        const sheetId = Sheet.extractSheetId(sheetUrl);
        
        if (!sheetId) {
            console.warn('无法提取 Sheet ID，跳过保存配置');
            return;
        }
        
        // 检查配置表是否存在
        const sheets = await Sheet.getSheetNames(token, sheetId);
        const configSheet = sheets.find((s: any) => s.properties.title === configSheetName);
        
        if (!configSheet) {
            // 配置表不存在，不创建，跳过保存
            console.warn('配置表不存在，跳过保存配置');
            return;
        }
        
        // 读取现有配置
        const configUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${configSheetName}`;
        const res = await fetch(configUrl, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const configJson = await res.json();
        const configData: string[][] = configJson.values || [];
        
        if (configData.length < 1) {
            console.warn('配置表为空，跳过保存配置');
            return;
        }
        
        // 查找 Global Settings 列
        const headerRow = configData[0];
        let globalSettingsIndex = headerRow.findIndex((h: string) => 
            h && h.toLowerCase().includes('global settings')
        );
        
        // 如果没有 Global Settings 列，添加到表头末尾
        if (globalSettingsIndex === -1) {
            console.log('配置表中未找到 Global Settings 区域，将添加...');
            // 找到表头中最后一个非空列的位置
            let lastNonEmptyCol = 0;
            for (let i = headerRow.length - 1; i >= 0; i--) {
                if (headerRow[i] && headerRow[i].trim()) {
                    lastNonEmptyCol = i;
                    break;
                }
            }
            // 空一列作为分隔，然后添加 Global Settings
            globalSettingsIndex = lastNonEmptyCol + 2;
            
            // 添加 Global Settings 表头
            const gsHeaderRange = `${configSheetName}!${indexToColumnLetter(globalSettingsIndex)}1:${indexToColumnLetter(globalSettingsIndex + 1)}1`;
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${gsHeaderRange}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ values: [['Global Settings', 'Value']] })
            });
            
            // 更新 configData 以反映新添加的列
            configData[0] = [...headerRow, '', 'Global Settings', 'Value'];
        }
        
        const valueIndex = globalSettingsIndex + 1;
        
        // 定义需要的配置项
        const requiredSettings: Array<{ key: string; aliases: string[]; settingKey: 'defaultJql' | 'keepDataSameAsJql' | 'keepOrderSameAsJql' }> = [
            { key: 'default jql', aliases: ['jql'], settingKey: 'defaultJql' },
            { key: 'keep data same as jql', aliases: ['sync with jql', 'sync mode'], settingKey: 'keepDataSameAsJql' },
            { key: 'keep order same as jql', aliases: [], settingKey: 'keepOrderSameAsJql' }
        ];
        
        // 构建更新请求
        const updates: Array<{ range: string; values: string[][] }> = [];
        const foundSettings = new Set<string>();
        
        // 遍历配置行，找到需要更新的设置
        for (let i = 1; i < configData.length; i++) {
            const row = configData[i];
            if (!row || row.length <= globalSettingsIndex) continue;
            
            const settingName = row[globalSettingsIndex]?.trim().toLowerCase();
            if (!settingName) continue;
            
            for (const reqSetting of requiredSettings) {
                if (settingName === reqSetting.key || reqSetting.aliases.includes(settingName)) {
                    foundSettings.add(reqSetting.key);
                    const value = settings[reqSetting.settingKey];
                    if (value !== undefined) {
                        const displayValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
                        updates.push({
                            range: `${configSheetName}!${indexToColumnLetter(valueIndex)}${i + 1}`,
                            values: [[displayValue]]
                        });
                    }
                    break;
                }
            }
        }
        
        // 检查是否有缺失的配置项，需要添加
        const missingSettings: Array<{ name: string; value: string }> = [];
        for (const reqSetting of requiredSettings) {
            if (!foundSettings.has(reqSetting.key)) {
                const value = settings[reqSetting.settingKey];
                if (value !== undefined) {
                    const displayValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
                    // 格式化配置名：首字母大写
                    const formattedName = reqSetting.key.split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ');
                    missingSettings.push({ name: formattedName, value: displayValue });
                }
            }
        }
        
        // 如果有缺失的配置项，追加到 Global Settings 区域
        if (missingSettings.length > 0) {
            // 找到 Global Settings 区域最后一个有内容的行
            let lastGsRow = 0;
            for (let i = 1; i < configData.length; i++) {
                const row = configData[i];
                if (row && row.length > globalSettingsIndex && row[globalSettingsIndex]?.trim()) {
                    lastGsRow = i;
                }
            }
            
            // 追加缺失的配置项
            for (let j = 0; j < missingSettings.length; j++) {
                const rowNum = lastGsRow + 1 + j + 1; // +1 因为行号从1开始，再+1因为在最后一行之后
                updates.push({
                    range: `${configSheetName}!${indexToColumnLetter(globalSettingsIndex)}${rowNum}:${indexToColumnLetter(valueIndex)}${rowNum}`,
                    values: [[missingSettings[j].name, missingSettings[j].value]]
                });
            }
            console.log('添加缺失的配置项:', missingSettings);
        }
        
        if (updates.length > 0) {
            const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
            await fetch(batchUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                })
            });
            console.log('已保存全局设置到配置表:', settings);
        }
    } catch (error) {
        console.error('保存全局设置失败:', error);
    }
}

// 查找有效的Jira字段表头
async function findValidJiraHeaders(sheet: Sheet): Promise<JiraFieldMetadata> {
    try {
        let headerMapping: { [key: string]: string } = {};
        const customFieldMapping: { [key: string]: string } = {};
        const fieldTypes: { [jiraField: string]: string } = {};
        const jiraFieldToSheetHeader: { [jiraField: string]: string } = {};  // Jira Field -> Sheet Column 原始名称
        let globalSettings: GlobalSettings = { headerRow: 1, defaultJql: '', keepDataSameAsJql: false, keepOrderSameAsJql: false };
        
        try {
            const configData = await sheet.readConfigSheet();
            console.log('configData', configData);
            
            // 解析全局设置
            globalSettings = parseGlobalSettings(configData);
            console.log('全局设置:', globalSettings);
            
            if (configData && configData.length >= 2) {
                const sheetHeaderIndex = configData[0].findIndex((h: string) => h.toLowerCase().includes('sheet column'));
                const jiraFieldIndex = configData[0].findIndex((h: string) => h.toLowerCase().includes('jira field'));
                const fieldTypeIndex = configData[0].findIndex((h: string) => h.toLowerCase().includes('field type'));

                if (sheetHeaderIndex === -1 || jiraFieldIndex === -1) {
                    console.warn('配置表中未找到 "Sheet Header" 或 "Jira Field" 列，将使用默认别名');
                    throw new Error('Invalid config sheet headers');
                }

                for (let i = 1; i < configData.length; i++) {
                    const row = configData[i];
                    if (row.length > Math.max(sheetHeaderIndex, jiraFieldIndex)) {
                        const sheetHeaderOriginal = row[sheetHeaderIndex]?.trim();  // 保留原始大小写用于显示
                        const sheetHeader = sheetHeaderOriginal?.toLowerCase();
                        let jiraField = row[jiraFieldIndex]?.trim();
                        const fieldType = fieldTypeIndex !== -1 ? row[fieldTypeIndex]?.trim().toLowerCase() : '';

                        if (sheetHeader && jiraField) {
                            if (jiraField.toLowerCase() === 'jira key' || jiraField.toLowerCase() === 'key') {
                                jiraField = 'key';
                            }
                            headerMapping[sheetHeader] = jiraField;
                            // 存储 Jira Field -> Sheet Column 原始名称的映射
                            jiraFieldToSheetHeader[jiraField] = sheetHeaderOriginal;
                            if (fieldType) {
                                fieldTypes[jiraField] = fieldType;
                            }
                            if (jiraField.toLowerCase().startsWith('customfield_')) {
                                customFieldMapping[sheetHeader] = jiraField;
                            }
                        }
                    }
                }
                 console.log('从配置表加载的映射:', headerMapping);
                 console.log('从配置表加载的字段类型:', fieldTypes);
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

        // 使用全局设置中的 headerRow 来读取表头
        const values = await sheet.readSheet();
        const headerRowIndex = globalSettings.headerRow - 1; // 转为 0-based 索引
        
        if (!values || values.length <= headerRowIndex) {
            throw new Error(`表格数据不足，无法读取第 ${globalSettings.headerRow} 行的表头`);
        }
        
        const headers = values[headerRowIndex] as string[];
        console.log(`Sheet Headers (第 ${globalSettings.headerRow} 行):`, headers);
        
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
            const columnLetter = indexToColumnLetter(index);
            
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
        console.log('字段类型映射:', fieldTypes);
        console.log('Jira 字段到表头映射:', jiraFieldToSheetHeader);
        return { columnMapping: validHeaders, fieldTypes, globalSettings, jiraFieldToSheetHeader };
    } catch (error) {
        console.error('查找有效 Jira 标题时出错:', error);
        showToast('查找表头映射时出错: ' + (error instanceof Error ? error.message : error), 'error')
        throw error;
    }
}

// 将列索引转换为列字母（支持多字母，如 AA, AB 等）
function indexToColumnLetter(index: number): string {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
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

// 将列索引按连续范围分组
function groupConsecutiveColumns(columnIndices: number[]): { start: number; end: number }[] {
    if (columnIndices.length === 0) return [];
    
    // 排序列索引
    const sorted = columnIndices.sort((a, b) => a - b);
    const ranges: { start: number; end: number }[] = [];
    
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            // 连续的列，扩展当前范围
            end = sorted[i];
        } else {
            // 非连续，保存当前范围并开始新范围
            ranges.push({ start, end });
            start = sorted[i];
            end = sorted[i];
        }
    }
    
    // 添加最后一个范围
    ranges.push({ start, end });
    
    return ranges;
}

// 获取操作类型对应的颜色
function getOperationColor(type: 'update' | 'append' | 'remove'): string {
    switch (type) {
        case 'update': return '#f0ad4e';
        case 'append': return '#5cb85c';
        case 'remove': return '#dc3545';
        default: return '#666';
    }
}

// 获取操作类型对应的文本
function getOperationText(type: 'update' | 'append' | 'remove'): string {
    switch (type) {
        case 'update': return '更新';
        case 'append': return '新增';
        case 'remove': return '移除';
        default: return '未知';
    }
}

// Jira 字段名称映射（用于显示友好名称）
const jiraFieldDisplayNames: { [key: string]: string } = {
    'key': 'Jira Key',
    'summary': '概要 (Summary)',
    'description': '描述 (Description)',
    'issuetype': '类型 (Issue Type)',
    'priority': '优先级 (Priority)',
    'assignee': '经办人 (Assignee)',
    'reporter': '报告人 (Reporter)',
    'status': '状态 (Status)',
    'labels': '标签 (Labels)',
    'components': '模块 (Components)',
    'fixVersions': '修复版本 (Fix Versions)',
    'affectsVersions': '影响版本 (Affects Versions)',
    'linkedIssues': '关联问题 (Linked Issues)',
    'epicLink': 'Epic Link',
    'sprint': '冲刺 (Sprint)',
    'storyPoints': '故事点 (Story Points)',
    'created': '创建时间 (Created)',
    'updated': '更新时间 (Updated)',
    'duedate': '截止日期 (Due Date)'
};

// 检测缺失的 Jira 字段
function findMissingJiraFields(
    tickets: JiraTicket[],
    sheetHeaders: JiraHeaders
): string[] {
    if (tickets.length === 0) {
        return [];
    }

    // 获取表格中配置的所有字段（排除 key，因为 key 是必须存在的）
    const configuredFields = Object.keys(sheetHeaders).filter(field => 
        sheetHeaders[field as keyof JiraHeaders] && field !== 'key'
    );

    // 检查所有 ticket 中有哪些字段是存在的（非空值）
    const missingFields: string[] = [];
    
    configuredFields.forEach(field => {
        // 检查该字段在所有 tickets 中是否都是空的
        const allEmpty = tickets.every(ticket => {
            const value = (ticket as Record<string, any>)[field];
            return value === undefined || value === null || value === '';
        });
        
        if (allEmpty) {
            missingFields.push(field);
        }
    });

    return missingFields;
}

interface ConfirmationResult {
    operations: TicketOperation[];
    dialogElement: HTMLDivElement | null;  // null 表示用户取消，对话框已关闭
}

// 显示确认弹窗
async function showConfirmationDialog(
    operations: TicketOperation[],
    displayHeaders: string[],
    sheetHeaders: JiraHeaders,
    missingFields: string[] = [],
    jiraBaseUrl = '',
    jql = '',
    jiraFieldToSheetHeader: { [jiraField: string]: string } = {},
    actualSheetHeaders: string[] = []  // 新增：实际的表头列名
): Promise<ConfirmationResult> {
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

        // 生成友好的列名显示
        const columnsToUpdateDisplay = displayHeaders
            .filter(field => sheetHeaders[field as keyof JiraHeaders])
            .map(field => {
                const columnLetter = sheetHeaders[field as keyof JiraHeaders];
                if (!columnLetter) return field;
                
                // 查找该列对应的实际表头名称
                const colIndex = getColumnIndex(columnLetter);
                const actualHeaderName = actualSheetHeaders[colIndex];
                
                // 优先使用实际表头名称，其次使用配置中的映射，最后使用 Jira 字段名
                return actualHeaderName || jiraFieldToSheetHeader[field] || jiraFieldDisplayNames[field] || field;
            });

        const updateCount = operations.filter(op => op.type === 'update').length;
        const appendCount = operations.filter(op => op.type === 'append').length;
        const removeCount = operations.filter(op => op.type === 'remove').length;

        // 生成缺失字段警告 HTML
        const jqlUrl = `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql)}&wildcardFlag=true`;
        const missingFieldsWarningHtml = missingFields.length > 0 ? `
            <div style="margin-bottom: 15px; padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; flex-shrink: 0;">
                <div style="display: flex; align-items: flex-start; gap: 8px;">
                    <span style="font-size: 18px;">⚠️</span>
                    <div>
                        <div style="font-weight: bold; color: #856404; margin-bottom: 6px;">
                            以下字段在 Jira 查询结果中缺失，数据无法同步：
                        </div>
                        <div style="color: #856404; margin-bottom: 8px;">
                            ${missingFields.map(field => {
                                // 优先使用配置表中的 Sheet Column 名称，其次使用预定义的友好名称，最后使用原始字段名
                                const displayName = jiraFieldToSheetHeader[field] || jiraFieldDisplayNames[field] || field;
                                return `<span style="display: inline-block; background: #ffeeba; padding: 2px 8px; border-radius: 3px; margin: 2px 4px 2px 0; font-size: 13px;">${displayName}</span>`;
                            }).join('')}
                        </div>
                        <div style="font-size: 12px; color: #856404;">
                            请前往 Jira 的 
                            <a href="${jqlUrl}" target="_blank" style="color: #0056b3; text-decoration: underline;">filter 查询页面</a>，
                            点击 <strong>Columns</strong> 按钮配置显示对应的列，然后重新查询。
                        </div>
                    </div>
                </div>
            </div>
        ` : '';

        dialog.innerHTML = `
            <h3 style="margin-top: 0; flex-shrink: 0;">确认数据操作</h3>
            ${missingFieldsWarningHtml}
            <div style="margin-bottom: 15px; flex-shrink: 0;">
                <div style="margin-bottom: 10px;">
                    <strong>将要操作的列：</strong> 
                    <span style="color: #666;">${columnsToUpdateDisplay.join(', ')}</span>
                </div>
                <div style="color: #666;">
                    <div>更新现有数据：<span style="color: #f0ad4e; font-weight: bold;">${updateCount}</span> 条</div>
                    <div>新增数据：<span style="color: #5cb85c; font-weight: bold;">${appendCount}</span> 条</div>
                    ${removeCount > 0 ? `<div>移除数据：<span style="color: #dc3545; font-weight: bold;">${removeCount}</span> 条 <span style="color: #dc3545; font-size: 12px;">⚠️ 这些行将从表格中删除</span></div>` : ''}
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
                            ${columnsToUpdateDisplay.map(header => `<th style="padding: 8px; text-align: left;">${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${operations.map((op, index) => `
                            <tr style="border-bottom: 1px solid #eee; ${op.type === 'remove' ? 'background: #fff5f5;' : ''}">
                                <td style="padding: 8px;">
                                    <input type="checkbox" class="ticket-checkbox" data-index="${index}" checked>
                                </td>
                                <td style="padding: 8px;">
                                    <span style="color: ${getOperationColor(op.type)}; font-weight: bold;">
                                        ${getOperationText(op.type)}
                                    </span>
                                </td>
                                ${displayHeaders.map(field => {
                                    let value = op.ticket[field as keyof JiraTicket] || '';
                                    if (value.length > 100) value = value.substring(0, 97) + '...'; 
                                    return `<td style="padding: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; ${op.type === 'remove' ? 'text-decoration: line-through; color: #999;' : ''}" title="${op.ticket[field as keyof JiraTicket] || ''}">${value}</td>`;
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
            resolve({ operations: [], dialogElement: null });
        });

        confirmButton.addEventListener('click', () => {
            const selectedOperations = Array.from(ticketCheckboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => operations[parseInt(checkbox.dataset.index || '0')]);
            
            // 不在这里关闭对话框，由调用者在操作成功后关闭
            // 禁用按钮防止重复点击
            confirmButton.disabled = true;
            confirmButton.textContent = '处理中...';
            const cancelButton = document.getElementById('cancelOperation') as HTMLButtonElement;
            if (cancelButton) cancelButton.disabled = true;
            
            resolve({ operations: selectedOperations, dialogElement: dialog });
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

// 从 Jira 查询 tickets 并更新到 Google Sheet
async function handleFetchJiraTicketsToSheet(jql: string, sheetUrl: string, sheetToken: string, keepDataSameAsJql = false, keepOrderSameAsJql = false) {
    showToast('正在查询 Jira...');
    const envConfig = await getEnvConfig();
    const tickets = await fetchJiraTickets(jql);
    console.log('tickets', tickets);
    if (!tickets.length && !keepDataSameAsJql) {
        showToast('没有找到数据', 'warning');
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
        if (!sheetUrl) {
            throw new Error("缺少表格 URL");
        }

        const sheet = await Sheet.fromUrl(sheetUrl, sheetToken);
        try {
            const values = await sheet.readSheet('FORMULA'); // 使用公式格式读取，保持超链接
            console.log('values', values);
            const metadata = await findValidJiraHeaders(sheet);
            const sheetHeaders = metadata.columnMapping;
            const fieldTypes = metadata.fieldTypes;
            const globalSettings = metadata.globalSettings;
            // const jiraFieldToSheetHeader = metadata.jiraFieldToSheetHeader;
            
            // 根据实际映射的字段动态生成 displayHeaders
            const displayHeaders = Object.keys(sheetHeaders).filter(field => sheetHeaders[field as keyof JiraHeaders]); 

            // 使用全局设置中的 headerRow（1-based）
            const headerRowIndex = globalSettings.headerRow - 1; // 转为 0-based 索引
            const dataStartRowIndex = headerRowIndex + 1; // 数据从表头下一行开始
            console.log(`使用配置: 表头行=${globalSettings.headerRow}, 数据起始行=${dataStartRowIndex + 1}`);

            const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
            if (keyColumnIndex === -1) {
                const headerRow = values[headerRowIndex];
                const inferredKeyIndex = headerRow?.findIndex((header: string) => header.toLowerCase().includes('key') || header.toLowerCase().includes('jira'));
                if (inferredKeyIndex !== -1 && inferredKeyIndex !== undefined) {
                    sheetHeaders.key = indexToColumnLetter(inferredKeyIndex);
                    console.warn(`未在配置中找到 Key 列，已推断为列 ${sheetHeaders.key}`);
                } else {
                    throw new Error('未找到或无法推断 Jira Key 列，请检查表头或配置');
                }
            }

            const keyToRowMap = new Map<string, number>();
            const existingTicketsInfo = new Map<string, { rowIndex: number; rowData: string[] }>();
            // 从数据起始行开始遍历（跳过表头之前的行和表头行）
            values.slice(dataStartRowIndex).forEach((row: string[], index: number) => { 
                const keyCell = row[keyColumnIndex];
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
                    // 行索引 = 数据起始行索引 + 当前遍历索引（0-based）
                    const rowIndex = dataStartRowIndex + index;
                    keyToRowMap.set(key, rowIndex);
                    existingTicketsInfo.set(key, { rowIndex, rowData: row });
                }
            });

            // 查询结果中的 ticket keys
            const jqlTicketKeys = new Set(tickets.map(t => t.key));

            const operations: TicketOperation[] = tickets.map(ticket => {
                const existingRowIndex = keyToRowMap.get(ticket.key);
                return {
                    ticket,
                    type: existingRowIndex !== undefined ? 'update' : 'append',
                    rowIndex: existingRowIndex
                };
            });

            // 如果启用了保持数据一致模式，找出需要移除的 tickets
            if (keepDataSameAsJql) {
                existingTicketsInfo.forEach((info, key) => {
                    if (!jqlTicketKeys.has(key)) {
                        // 构建一个用于显示的 ticket 对象
                        const summaryColumnIndex = sheetHeaders.summary ? getColumnIndex(sheetHeaders.summary) : -1;
                        const statusColumnIndex = sheetHeaders.status ? getColumnIndex(sheetHeaders.status) : -1;
                        const assigneeColumnIndex = sheetHeaders.assignee ? getColumnIndex(sheetHeaders.assignee) : -1;
                        const reporterColumnIndex = sheetHeaders.reporter ? getColumnIndex(sheetHeaders.reporter) : -1;
                        const issuetypeColumnIndex = sheetHeaders.issuetype ? getColumnIndex(sheetHeaders.issuetype) : -1;
                        const priorityColumnIndex = sheetHeaders.priority ? getColumnIndex(sheetHeaders.priority) : -1;
                        
                        const ticketToRemove: JiraTicket = {
                            key: key,
                            summary: summaryColumnIndex !== -1 ? (info.rowData[summaryColumnIndex] || '') : '',
                            status: statusColumnIndex !== -1 ? (info.rowData[statusColumnIndex] || '') : '',
                            assignee: assigneeColumnIndex !== -1 ? (info.rowData[assigneeColumnIndex] || '') : '',
                            reporter: reporterColumnIndex !== -1 ? (info.rowData[reporterColumnIndex] || '') : '',
                            issuetype: issuetypeColumnIndex !== -1 ? (info.rowData[issuetypeColumnIndex] || '') : '',
                            priority: priorityColumnIndex !== -1 ? (info.rowData[priorityColumnIndex] || '') : ''
                        };
                        
                        operations.push({
                            ticket: ticketToRemove,
                            type: 'remove',
                            rowIndex: info.rowIndex
                        });
                    }
                });
            }

            // 检测缺失的 Jira 字段
            const missingFields = findMissingJiraFields(tickets, sheetHeaders);
            if (missingFields.length > 0) {
                console.warn('检测到以下字段在 Jira 查询结果中缺失:', missingFields);
            }

            // 获取实际的表头数据用于显示
            const actualSheetHeaders = values[headerRowIndex] as string[];

            const confirmResult = await showConfirmationDialog(
                operations, 
                displayHeaders, 
                sheetHeaders, 
                missingFields,
                envConfig.JIRA_BASE_URL || '',
                jql,
                metadata.jiraFieldToSheetHeader,
                actualSheetHeaders
            );
            
            const confirmedOperations = confirmResult.operations;
            const dialogElement = confirmResult.dialogElement;
            
            if (confirmedOperations.length === 0) {
                showToast('操作已取消');
                return; // 用户取消，对话框已关闭
            }
            
            // 辅助函数：关闭对话框
            const closeDialog = () => {
                if (dialogElement && document.body.contains(dialogElement)) {
                    document.body.removeChild(dialogElement);
                }
            };

            const updatesData: UpdateData[] = [];
            const appendData: string[][] = [];
                const headerValues = Object.values(sheetHeaders).filter((value): value is string => 
                    typeof value === 'string' && value.length > 0
                );
                const maxColIndex = getMaxColumnIndex(headerValues);

            confirmedOperations.forEach(operation => {
                if (operation.type === 'update' && operation.rowIndex !== undefined) {
                    // 对于更新操作，收集需要更新的列数据
                    const columnUpdates: { [columnIndex: number]: string } = {};
                    
                    Object.keys(operation.ticket).forEach(ticketKey => {
                        const columnLetter = (sheetHeaders as Record<string, string>)[ticketKey];
                        if (columnLetter && typeof columnLetter === 'string') {
                            try {
                                const colIndex = getColumnIndex(columnLetter);
                                const fieldValue = (operation.ticket as Record<string, any>)[ticketKey] || '';
                                
                                // 检查字段类型，如果是 issuekey 类型，格式化为 HYPERLINK
                                if (fieldTypes[ticketKey] === 'issuekey' && fieldValue) {
                                    // 提取 issue key（可能包含链接或纯文本）
                                    let issueKey = fieldValue;
                                    const match = fieldValue.match(/([A-Z0-9]+-[0-9]+)/i);
                                    if (match && match[1]) {
                                        issueKey = match[1];
                                    }
                                    columnUpdates[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${issueKey}", "${issueKey}")`;
                                } else if (ticketKey === 'key') {
                                    columnUpdates[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${operation.ticket.key}", "${operation.ticket.key}")`;
                                } else {
                                    columnUpdates[colIndex] = fieldValue;
                                }
                            } catch (error) {
                                console.error(`处理列 ${columnLetter} (字段 ${ticketKey}) 时出错:`, error);
                            }
                        }
                    });

                    updatesData.push({
                        rowIndex: operation.rowIndex,
                        columnUpdates
                    });
                } else if (operation.type === 'append') {
                    // 只对新增操作创建完整行数据（跳过 'remove' 类型）
                    const row = new Array(maxColIndex).fill('');
                    Object.keys(operation.ticket).forEach(ticketKey => {
                        const columnLetter = (sheetHeaders as Record<string, string>)[ticketKey];
                        if (columnLetter && typeof columnLetter === 'string') {
                            try {
                                const colIndex = getColumnIndex(columnLetter);
                                const fieldValue = (operation.ticket as Record<string, any>)[ticketKey] || '';
                                
                                // 检查字段类型，如果是 issuekey 类型，格式化为 HYPERLINK
                                if (fieldTypes[ticketKey] === 'issuekey' && fieldValue) {
                                    // 提取 issue key（可能包含链接或纯文本）
                                    let issueKey = fieldValue;
                                    const match = fieldValue.match(/([A-Z0-9]+-[0-9]+)/i);
                                    if (match && match[1]) {
                                        issueKey = match[1];
                                    }
                                    row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${issueKey}", "${issueKey}")`;
                                } else if (ticketKey === 'key') {
                                    row[colIndex] = `=HYPERLINK("${envConfig.JIRA_BASE_URL}/browse/${operation.ticket.key}", "${operation.ticket.key}")`;
                                } else {
                                    row[colIndex] = fieldValue;
                                }
                            } catch (error) {
                                console.error(`处理列 ${columnLetter} (字段 ${ticketKey}) 时出错:`, error);
                            }
                        }
                    });
                    appendData.push(row);
                }
                // 'remove' 类型的操作在这里跳过，由后面的删除逻辑单独处理
            });

            // 收集需要删除的行（按行号从大到小排序，以便从后往前删除）
            const rowsToDelete = confirmedOperations
                .filter(op => op.type === 'remove' && op.rowIndex !== undefined)
                .map(op => op.rowIndex as number)
                .sort((a, b) => b - a);

            console.log('更新数据:', updatesData);
            console.log('追加数据:', appendData);
            console.log('删除行:', rowsToDelete);

            let updatedCount = 0;
            let appendedCount = 0;
            let removedCount = 0;

            // 1. 先执行更新操作（使用原始行号，删除前行号是正确的）
            if (updatesData.length > 0) {
                // 使用批量更新，避免超出 rate limit
                const batchUpdates = updatesData.map(update => {
                    // 将需要更新的列按连续范围分组
                    const columnRanges = groupConsecutiveColumns(Object.keys(update.columnUpdates).map(Number));
                    
                    return columnRanges.map(range => {
                        const startColumn = String.fromCharCode(65 + range.start);
                        const endColumn = String.fromCharCode(65 + range.end);
                        const rangeName = range.start === range.end 
                            ? `${startColumn}${update.rowIndex + 1}`
                            : `${startColumn}${update.rowIndex + 1}:${endColumn}${update.rowIndex + 1}`;
                        
                        // 构建该范围内的数据
                        const rangeData = [];
                        for (let col = range.start; col <= range.end; col++) {
                            rangeData.push(update.columnUpdates[col] || '');
                        }
                        
                        return { range: rangeName, values: [rangeData] };
                    });
                }).flat();
                
                console.log(`批量更新 ${batchUpdates.length} 个范围，涉及 ${updatesData.length} 行数据`);
                await sheet.batchUpdateValues(batchUpdates);
                updatedCount = updatesData.length;
            }

            // 2. 再执行追加操作（追加到末尾，不受删除影响）
            if (appendData.length > 0) {
                const startPosition = `A${values.length + 1}`;
                console.log(`Appending data starting from: ${startPosition}`, appendData);
                await sheet.writeSheet(appendData, startPosition);
                appendedCount = appendData.length;
            }

            // 3. 最后执行删除操作（从后往前删除，避免行号变化相互影响）
            if (rowsToDelete.length > 0) {
                try {
                    for (const rowIndex of rowsToDelete) {
                        await sheet.deleteDimension('ROWS', rowIndex, rowIndex + 1);
                        console.log(`已删除行 ${rowIndex + 1}`);
                    }
                    removedCount = rowsToDelete.length;
                } catch (error) {
                    console.error('删除行失败:', error);
                    showToast('删除行失败: ' + (error instanceof Error ? error.message : error), 'error');
                }
            }

            // 4. 如果需要保持顺序一致，执行排序操作（使用行移动，保留格式）
            let reorderedCount = 0;
            if (keepOrderSameAsJql && tickets.length > 0) {
                try {
                    showToast('正在调整行顺序...');
                    
                    // 重新读取表格数据（因为前面的操作可能已经改变了数据）
                    const currentValues = await sheet.readSheet('FORMULA');
                    if (currentValues && currentValues.length > dataStartRowIndex) {
                        // 获取 JQL 结果中的 ticket 顺序
                        const jqlOrder = tickets.map(t => t.key);
                        
                        // 提取数据行及其当前行索引（跳过表头）
                        const dataRows = currentValues.slice(dataStartRowIndex);
                        
                        // 构建 key 到当前行索引的映射（0-based，相对于数据起始行）
                        const keyToCurrentIndex = new Map<string, number>();
                        const rowsWithoutKeyIndices: number[] = [];
                        
                        dataRows.forEach((row: string[], index: number) => {
                            const keyCell = row[keyColumnIndex];
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
                                keyToCurrentIndex.set(key, index);
                            } else {
                                rowsWithoutKeyIndices.push(index);
                            }
                        });
                        
                        // 构建目标顺序的索引数组
                        const targetOrder: number[] = [];
                        jqlOrder.forEach(key => {
                            const currentIndex = keyToCurrentIndex.get(key);
                            if (currentIndex !== undefined) {
                                targetOrder.push(currentIndex);
                                keyToCurrentIndex.delete(key);
                            }
                        });
                        
                        // 把不在 JQL 结果中但有 key 的行追加到末尾
                        keyToCurrentIndex.forEach((index) => {
                            targetOrder.push(index);
                        });
                        
                        // 把没有 key 的行追加到末尾
                        targetOrder.push(...rowsWithoutKeyIndices);
                        
                        // 使用行移动来重新排序（保留格式）
                        // 策略：从第一个位置开始，把应该在那个位置的行移动过来
                        const sheetGid = sheet.getGid();
                        const numericGid = sheetGid ? parseInt(sheetGid) : 0;
                        
                        // 创建当前位置到目标位置的映射
                        // currentPositions[i] 表示当前在位置 i 的行原本的索引
                        const currentPositions = dataRows.map((_, i) => i);
                        
                        let moveCount = 0;
                        for (let targetPos = 0; targetPos < targetOrder.length; targetPos++) {
                            const targetIndex = targetOrder[targetPos];
                            // 找到目标索引当前在哪个位置
                            const currentPos = currentPositions.indexOf(targetIndex);
                            
                            if (currentPos !== targetPos) {
                                // 需要移动：把 currentPos 行移动到 targetPos
                                const fromRow = dataStartRowIndex + currentPos; // 0-based sheet row
                                const toRow = dataStartRowIndex + targetPos;
                                
                                await sheet.moveRow(fromRow, toRow, numericGid);
                                moveCount++;
                                
                                // 更新 currentPositions 以反映移动
                                const movedValue = currentPositions.splice(currentPos, 1)[0];
                                currentPositions.splice(targetPos, 0, movedValue);
                            }
                        }
                        
                        reorderedCount = moveCount;
                        if (moveCount > 0) {
                            console.log(`已移动 ${moveCount} 行以重新排序`);
                        }
                    }
                } catch (error) {
                    console.error('排序失败:', error);
                    showToast('排序失败: ' + (error instanceof Error ? error.message : error), 'error');
                }
            }

            let toastMessage = '';
            if (updatedCount > 0) toastMessage += `已更新 ${updatedCount} 条数据。`;
            if (appendedCount > 0) toastMessage += `已追加 ${appendedCount} 条新数据。`;
            if (removedCount > 0) toastMessage += `已移除 ${removedCount} 条数据。`;
            if (reorderedCount > 0) toastMessage += `已按 JQL 顺序排列 ${reorderedCount} 行。`;
            if (toastMessage === '') toastMessage = '没有需要更新、追加或移除的数据。';
            
            // 操作成功，关闭对话框
            closeDialog();
            showToast(toastMessage.trim(), 'success');

        } catch (error) {
            console.error('Google Sheets 操作失败:', error);
            // 操作失败，恢复对话框按钮状态，不关闭对话框
            const dialogEl = document.getElementById('jiraConfirmationDialog') as HTMLDivElement;
            if (dialogEl) {
                const confirmBtn = dialogEl.querySelector('#confirmOperation') as HTMLButtonElement;
                const cancelBtn = dialogEl.querySelector('#cancelOperation') as HTMLButtonElement;
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    const ticketCheckboxes = dialogEl.getElementsByClassName('ticket-checkbox') as HTMLCollectionOf<HTMLInputElement>;
                    const selectedCount = Array.from(ticketCheckboxes).filter(cb => cb.checked).length;
                    confirmBtn.textContent = `确认 (${selectedCount})`;
                }
                if (cancelBtn) {
                    cancelBtn.disabled = false;
                }
            }
            showToast('Google Sheets 操作失败: ' + (error instanceof Error ? error.message : error), 'error');
        }
    }
}

// 新增：处理展开 Epic Tickets 的函数
async function handleExpandEpicTickets(sheetUrl: string, token: string) {
    showToast('开始查找 Epic 并获取子任务...');
    const envConfig = await getEnvConfig();
    const sheet = await Sheet.fromUrl(sheetUrl, token);
    
    try {
        const values = await sheet.readSheet('FORMULA'); // 使用公式格式读取，保持超链接
        if (!values || values.length === 0) {
            showToast('表格为空或无法读取', 'error');
            return;
        }
        const metadata = await findValidJiraHeaders(sheet);
        const sheetHeaders = metadata.columnMapping;
        const globalSettings = metadata.globalSettings;

        // 使用全局设置中的 headerRow（1-based）
        const headerRowIndex = globalSettings.headerRow - 1; // 转为 0-based 索引
        const dataStartRowIndex = headerRowIndex + 1; // 数据从表头下一行开始
        console.log(`使用配置: 表头行=${globalSettings.headerRow}, 数据起始行=${dataStartRowIndex + 1}`);

        // 找到 key 列的索引
        const keyColumnIndex = sheetHeaders.key ? getColumnIndex(sheetHeaders.key) : -1;
        if (keyColumnIndex === -1) {
            throw new Error('未找到 Jira Key 列，请检查表头或配置');
        }
        console.log('Jira Key 列索引:', keyColumnIndex);

        const epicsToExpand: { epicKey: string; epicSummary: string; rowIndex: number; subTickets: JiraTicket[] }[] = [];

        // 遍历表格查找 Epic Key 并查询子任务
        // 从数据起始行开始遍历（跳过表头之前的行和表头行）
        for (let i = dataStartRowIndex; i < values.length; i++) {
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

// 创建配置表
async function createConfigSheet(token: string, sheetId: string, configSheetName: string, currentSheetIndex?: number): Promise<number> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    
    // 构建 addSheet 请求的 properties
    const sheetProperties: { title: string; index?: number } = {
        title: configSheetName
    };
    
    // 如果提供了当前表的索引，则在其右边（index + 1）创建配置表
    if (currentSheetIndex !== undefined) {
        sheetProperties.index = currentSheetIndex + 1;
    }
    
    // 首先创建新的 sheet
    const addSheetRequest = {
        requests: [{
            addSheet: {
                properties: sheetProperties
            }
        }]
    };
    
    const addSheetResponse = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(addSheetRequest)
    });
    
    if (!addSheetResponse.ok) {
        const error = await addSheetResponse.json();
        throw new Error(`创建配置表失败: ${error.error?.message || '未知错误'}`);
    }
    
    // 获取新创建的 sheet 的 gid
    const addSheetResult = await addSheetResponse.json();
    const newSheetId = addSheetResult.replies[0].addSheet.properties.sheetId;
    
    // 准备配置数据，参考 Code.js 中的示例
    // 列布局：A-I 为主配置，J 为空分隔，K-S 为链接配置，T 为空分隔，U-V 为全局设置
    const configData = [
        ["Sheet Column", "JIRA Field", "Sync mode", "Field type", "Change as adding?", "Prefix", "Suffix", "Format function", "Back format", "", "Sheet Column - link ticket", "JIRA Field", "Sync mode", "Field type", "Change as adding?", "Prefix", "Suffix", "Format function", "Back format", "", "Global Settings", "Value"],
        ["JIRA", "JIRA key", "", "", "", "", "", "", "", "", "UX Ticket", "link key", "", "", "", "", "", "", "", "", "Header Row", "1"],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Default JQL", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Keep data same as JQL", "false"],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Keep order same as JQL", "false"],
        ["Title", "summary", "Back", "text"],
        ["Type", "issuetype", "Back", "text"],
        ["Label", "labels", "To", "list", "Yes"],
        ["Component", "components", "Back", "list", "No"],
        ["Release", "fixVersions", "Back", "list", "No", "", "", "{value}=='Video Wishlist'?{value}:'mThor '+{value}", '{value}.split(",").map(re => re.replace(/[^\\d]*/, "").replace(/.*\\W(\\d+\\.\\d+\\.\\d+)/, "$1")).reduce((aggr, cur) => aggr>cur?aggr:cur, -Infinity)'],
        ["Affect versions", "versions", "Back", "list", "No", "mThor "],
        ["Due date", "duedate", "Back", "date"],
        ["BV", "customfield_10423", "Back", "text"],
        ["Priority", "priority", "Back", "text"],
        ["Sprint", "customfield_10652", "Back", "list", "No"],
        ["Team", "customfield_17553", "Back", "list", "No"],
        ["Story Point", "customfield_10422", "Back", "text"],
        ["SDK Story Point", "customfield_24666", "Back", "text"],
        ["Vertical Track", "customfield_24174", "Back", "list"],
        ["Assignee", "assignee", "Back", "list", "", "", "", "{value}.toLowerCase().replace(' ', '.')"],
        ["Reporter", "reporter", "Back", "list", "", "", "", "{value}.toLowerCase().replace(' ', '.')"],
        ["Local PM", "customfield_24893", "Back", "list", "", "", "", "{value}.toLowerCase().replace(' ', '.')"],
        ["Dev estimate", "customfield_25757", "Back", "text"],
        ["QA estimate", "customfield_25958", "Back", "text"],
        ["Target start", "customfield_18350", "Back", "date"],
        ["Target end", "customfield_18351", "Back", "date"],
        ["Exist on Production", "customfield_10570", "Back", "text"],
        ["Affect customers", "customfield_13250", "Back", "text"],
        ["DEA", "customfield_26055", "Back", "list", "No"],
        ["UX Ticket", "depends on", "Back", "link"],
        ["INIT", "customfield_15751", "Back", "issuekey"],
        ["Status", "status", "Back", "text"]
    ];
    
    // 写入配置数据到新创建的 sheet
    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${configSheetName}!A1?valueInputOption=USER_ENTERED`;
    const writeResponse = await fetch(writeUrl, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: configData })
    });
    
    if (!writeResponse.ok) {
        const error = await writeResponse.json();
        throw new Error(`写入配置数据失败: ${error.error?.message || '未知错误'}`);
    }
    
    // 设置第一行为粗体
    const formatRequest = {
        requests: [{
            repeatCell: {
                range: {
                    sheetId: newSheetId,
                    startRowIndex: 0,
                    endRowIndex: 1
                },
                cell: {
                    userEnteredFormat: {
                        textFormat: {
                            bold: true
                        }
                    }
                },
                fields: 'userEnteredFormat.textFormat.bold'
            }
        }]
    };
    
    const formatResponse = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formatRequest)
    });
    
    if (!formatResponse.ok) {
        console.warn('设置格式失败，但配置表已创建');
    }
    
    // 返回新创建的 sheet 的 gid
    return newSheetId;
}
