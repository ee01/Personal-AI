/**
 * 定时消息通用工具方法
 * 
 * 提供定时消息系统的共用功能：
 * - 初始化状态检查
 * - 初始化提示对话框
 * 
 * 供 SnoozeManager 和 AutoReplyHandler 共用
 */

/**
 * 检查定时消息是否已初始化
 */
export async function isScheduledMessagesInitialized(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
    const config = result.scheduledMessagesConfig;
    // 检查配置是否存在且有基本的必要字段（如 sheetId）
    return !!(config && config.sheetId);
  } catch (error) {
    console.error('检查定时消息配置失败', error);
    return false;
  }
}

/**
 * 显示初始化提示对话框
 * @param featureName 功能名称，用于显示在对话框中
 * @returns Promise<boolean> 用户是否选择了前往设置
 */
export function showInitRequiredDialog(featureName = '稍后处理'): Promise<boolean> {
  return new Promise((resolve) => {
    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'scheduled-messages-init-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: scheduled-overlay-in 0.2s ease;
    `;
    
    // 创建对话框
    const dialog = document.createElement('div');
    dialog.className = 'scheduled-messages-init-dialog';
    dialog.style.cssText = `
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 400px;
      width: 90%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: scheduled-dialog-in 0.2s ease;
    `;
    
    dialog.innerHTML = `
      <div style="padding: 20px 24px; border-bottom: 1px solid #f0f0f0;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 28px;">⚙️</span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">需要先初始化定时消息</h3>
        </div>
      </div>
      <div style="padding: 16px 24px;">
        <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.6;">
          使用「${featureName}」功能需要先完成定时消息的初始化设置。
          <br><br>
          点击「前往设置」将打开定时消息管理界面，按照引导完成初始化后即可使用此功能。
        </p>
      </div>
      <div style="padding: 16px 24px; display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid #f0f0f0;">
        <button class="scheduled-init-cancel" style="
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          background: #f0f0f0;
          color: #666;
          transition: background 0.15s;
        ">取消</button>
        <button class="scheduled-init-confirm" style="
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
          color: white;
          transition: box-shadow 0.15s;
        ">前往设置</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // 添加动画样式
    const style = document.createElement('style');
    style.id = 'scheduled-messages-init-dialog-styles';
    style.textContent = `
      @keyframes scheduled-overlay-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scheduled-dialog-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    if (!document.getElementById('scheduled-messages-init-dialog-styles')) {
      document.head.appendChild(style);
    }
    
    // 绑定事件
    const cleanup = () => {
      overlay.remove();
    };
    
    dialog.querySelector('.scheduled-init-cancel')!.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });
    
    dialog.querySelector('.scheduled-init-confirm')!.addEventListener('click', async () => {
      cleanup();
      // 发送消息打开定时消息管理界面
      try {
        await chrome.runtime.sendMessage({ type: 'OPEN_SCHEDULED_MESSAGES' });
      } catch (e) {
        console.error('打开定时消息管理界面失败', e);
      }
      resolve(true);
    });
    
    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });
  });
}

/**
 * 确保定时消息已初始化
 * 如果未初始化，显示提示对话框引导用户初始化
 * @param featureName 功能名称
 * @returns Promise<boolean> 是否已初始化或用户选择去初始化
 */
export async function ensureScheduledMessagesInitialized(featureName = '稍后处理'): Promise<boolean> {
  const initialized = await isScheduledMessagesInitialized();
  if (initialized) {
    return true;
  }
  
  console.log(`${featureName}: 定时消息未初始化，显示提示对话框`);
  await showInitRequiredDialog(featureName);
  return false;
}
