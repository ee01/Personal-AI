/**
 * Snooze UI - 悬浮菜单和时间选择器界面
 * 
 * UI 结构：
 * - 悬停 1.5 秒后显示工具栏（左侧"稍后处理"文字按钮 + 右侧 icon）
 * - 点击"稍后处理"按钮默认触发 1 小时后提醒
 * - hover "稍后处理"按钮时显示快速选项下拉菜单
 * - icon 仅作为视觉标识，不可点击
 */

import { 
  MessageInfo, 
  extractMessageInfo, 
  getQuickOptions, 
  formatRemindTime,
  createSnoozeReminder,
  showSuccessToast,
  showErrorToast
} from './SnoozeManager';

// 全局状态
let currentMenu: HTMLElement | null = null;
let currentPicker: HTMLElement | null = null;
const _hoverTimeout: ReturnType<typeof setTimeout> | null = null; // eslint-disable-line
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let isHoveringTrigger = false;
let isHoveringMenu = false;
let isPickerOpen = false;  // 标记时间选择器是否打开
let currentMessageElement: HTMLElement | null = null;

// 处理过的消息元素
const processedMessages = new WeakSet<HTMLElement>();

/**
 * 注入样式
 */
function injectStyles() {
  if (document.getElementById('snooze-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'snooze-styles';
  style.textContent = `
    /* ===== Snooze 工具栏容器 ===== */
    .snooze-toolbar {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      gap: 0;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 100000;
      pointer-events: none;
    }
    
    .snooze-toolbar.visible {
      opacity: 1;
      pointer-events: auto;
    }
    
    /* ===== 稍后处理文字按钮 ===== */
    .snooze-text-btn {
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 500;
      color: #2196F3;
      background: rgba(33, 150, 243, 0.08);
      border: 1px solid rgba(33, 150, 243, 0.2);
      border-radius: 4px 0 0 4px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .snooze-text-btn:hover {
      background: rgba(33, 150, 243, 0.15);
      border-color: rgba(33, 150, 243, 0.4);
    }
    
    .snooze-text-btn:active {
      background: rgba(33, 150, 243, 0.25);
    }
    
    /* ===== 自动答复按钮 ===== */
    .auto-reply-btn {
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 500;
      color: #ee5a5a;
      background: rgba(238, 90, 90, 0.08);
      border: 1px solid rgba(238, 90, 90, 0.2);
      border-left: none;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .auto-reply-btn:hover {
      background: rgba(238, 90, 90, 0.15);
      border-color: rgba(238, 90, 90, 0.4);
    }
    
    .auto-reply-btn:active {
      background: rgba(238, 90, 90, 0.25);
    }
    
    /* ===== Icon 标识 ===== */
    .snooze-icon {
      width: 24px;
      height: 24px;
      border-radius: 0 4px 4px 0;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(238, 90, 90, 0.3);
      border-left: none;
    }
    
    .snooze-icon img {
      width: 14px;
      height: 14px;
      filter: brightness(0) invert(1);
    }
    
    /* ===== Snooze 快速菜单（紧凑版） ===== */
    .snooze-menu {
      position: fixed;
      z-index: 999999;
      min-width: 120px;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 
                  0 1px 4px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #333;
      overflow: hidden;
      animation: snooze-menu-in 0.12s ease-out;
      padding: 4px 0;
    }
    
    @keyframes snooze-menu-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* ===== 快速选项（精简版） ===== */
    .snooze-quick-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      cursor: pointer;
      transition: all 0.1s ease;
      white-space: nowrap;
    }
    
    .snooze-quick-option:hover {
      background: #fff5f5;
      color: #ee5a5a;
    }
    
    .snooze-quick-option:active {
      background: #ffecec;
    }
    
    .snooze-quick-option-icon {
      font-size: 12px;
      width: 16px;
      text-align: center;
    }
    
    .snooze-quick-option-label {
      font-size: 12px;
      color: inherit;
    }
    
    /* 分隔线 */
    .snooze-divider {
      height: 1px;
      background: #f0f0f0;
      margin: 4px 8px;
    }
    
    /* 自定义选项 */
    .snooze-custom-option {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      cursor: pointer;
      transition: background 0.1s ease;
      color: #888;
      font-size: 12px;
    }
    
    .snooze-custom-option:hover {
      background: #f8f8f8;
      color: #666;
    }
    
    /* ===== 自定义时间选择器 ===== */
    .snooze-picker {
      position: fixed;
      z-index: 9999999;
      width: 280px;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      animation: snooze-menu-in 0.15s ease-out;
    }
    
    .snooze-picker-header {
      padding: 12px 14px;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .snooze-picker-back {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      opacity: 0.9;
      transition: opacity 0.15s;
      font-size: 12px;
    }
    
    .snooze-picker-back:hover {
      opacity: 1;
    }
    
    .snooze-picker-title {
      font-weight: 600;
      font-size: 13px;
    }
    
    .snooze-picker-body {
      padding: 14px;
    }
    
    .snooze-input-group {
      margin-bottom: 12px;
    }
    
    .snooze-input-label {
      display: block;
      font-size: 11px;
      font-weight: 500;
      color: #666;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .snooze-input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 13px;
      color: #333;
      background: #fafafa;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }
    
    .snooze-input:focus {
      outline: none;
      border-color: #ee5a5a;
      background: #fff;
      box-shadow: 0 0 0 2px rgba(238, 90, 90, 0.1);
    }
    
    .snooze-preview {
      padding: 10px;
      background: #f8f8f8;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    
    .snooze-preview-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 2px;
    }
    
    .snooze-preview-time {
      font-size: 14px;
      font-weight: 500;
      color: #ee5a5a;
    }
    
    .snooze-picker-footer {
      display: flex;
      gap: 8px;
      padding: 0 14px 14px;
    }
    
    .snooze-btn {
      flex: 1;
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .snooze-btn-cancel {
      background: #f0f0f0;
      color: #666;
    }
    
    .snooze-btn-cancel:hover {
      background: #e5e5e5;
    }
    
    .snooze-btn-confirm {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
      color: white;
    }
    
    .snooze-btn-confirm:hover {
      box-shadow: 0 2px 8px rgba(238, 90, 90, 0.4);
    }
    
    .snooze-btn-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* ===== Toast 提示 ===== */
    .snooze-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      padding: 10px 16px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      z-index: 99999999;
      opacity: 0;
      transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    
    .snooze-toast-success {
      background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
      color: white;
    }
    
    .snooze-toast-error {
      background: linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%);
      color: white;
    }
    
    .snooze-toast-icon {
      font-size: 14px;
      font-weight: 600;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * 隐藏菜单
 */
function hideMenu() {
  if (currentMenu) {
    currentMenu.remove();
    currentMenu = null;
  }
}

/**
 * 隐藏时间选择器
 */
function hidePicker() {
  if (currentPicker) {
    currentPicker.remove();
    currentPicker = null;
  }
  isPickerOpen = false;
}

/**
 * 隐藏所有 UI（菜单和选择器）
 */
function hideAllUI() {
  hideMenu();
  hidePicker();
}

/**
 * 隐藏工具栏
 */
function hideToolbar() {
  if (currentMessageElement) {
    const toolbar = currentMessageElement.querySelector('.snooze-toolbar');
    if (toolbar) {
      toolbar.classList.remove('visible');
    }
  }
}

/**
 * 延迟隐藏菜单和工具栏
 */
function scheduleHide() {
  // 如果时间选择器打开，不隐藏任何东西
  if (isPickerOpen) return;
  
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
  hideTimeout = setTimeout(() => {
    if (!isHoveringTrigger && !isHoveringMenu && !isPickerOpen) {
      hideMenu();
      hideToolbar();
    }
  }, 200);
}

/**
 * 取消隐藏
 */
function cancelHide() {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

/**
 * 显示时间选择器
 */
async function showTimePicker(messageInfo: MessageInfo, anchorRect: DOMRect) {
  // 标记选择器打开
  isPickerOpen = true;
  
  // 移除当前菜单但不隐藏工具栏
  hideMenu();
  
  const picker = document.createElement('div');
  picker.className = 'snooze-picker';
  
  const now = new Date();
  const tomorrow9am = new Date();
  tomorrow9am.setDate(tomorrow9am.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);
  
  // 格式化为 input datetime-local 需要的格式
  const formatForInput = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  
  let selectedDate = tomorrow9am;
  
  picker.innerHTML = `
    <div class="snooze-picker-header">
      <div class="snooze-picker-back">
        <span>← 返回</span>
      </div>
      <span class="snooze-picker-title">自定义时间</span>
    </div>
    <div class="snooze-picker-body">
      <div class="snooze-input-group">
        <label class="snooze-input-label">选择日期和时间</label>
        <input type="datetime-local" class="snooze-input snooze-datetime-input" value="${formatForInput(selectedDate)}" min="${formatForInput(now)}">
      </div>
      <div class="snooze-preview">
        <div class="snooze-preview-label">将在以下时间提醒您：</div>
        <div class="snooze-preview-time">${formatRemindTime(selectedDate)}</div>
      </div>
    </div>
    <div class="snooze-picker-footer">
      <button class="snooze-btn snooze-btn-cancel">取消</button>
      <button class="snooze-btn snooze-btn-confirm">确认</button>
    </div>
  `;
  
  document.body.appendChild(picker);
  currentPicker = picker;
  
  // 定位
  const pickerRect = picker.getBoundingClientRect();
  let left = anchorRect.right - pickerRect.width;
  let top = anchorRect.bottom + 4;
  
  // 边界检测
  if (left < 10) left = 10;
  if (top + pickerRect.height > window.innerHeight - 10) {
    top = anchorRect.top - pickerRect.height - 4;
  }
  
  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;
  
  // 绑定事件
  const datetimeInput = picker.querySelector('.snooze-datetime-input') as HTMLInputElement;
  const previewTime = picker.querySelector('.snooze-preview-time')!;
  const confirmBtn = picker.querySelector('.snooze-btn-confirm') as HTMLButtonElement;
  
  datetimeInput.addEventListener('change', () => {
    selectedDate = new Date(datetimeInput.value);
    previewTime.textContent = formatRemindTime(selectedDate);
  });
  
  // 阻止 datetime-local 的点击事件冒泡
  datetimeInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  picker.querySelector('.snooze-picker-back')!.addEventListener('click', () => {
    hidePicker();
    // 返回时重新显示菜单
    if (currentMessageElement) {
      const toolbar = currentMessageElement.querySelector('.snooze-toolbar');
      if (toolbar) {
        showQuickMenu(messageInfo, toolbar as HTMLElement);
      }
    }
  });
  
  picker.querySelector('.snooze-btn-cancel')!.addEventListener('click', () => {
    hideAllUI();
    hideToolbar();
  });
  
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '创建中...';
    
    const success = await createSnoozeReminder({
      messageInfo,
      remindAt: selectedDate
    });
    
    // 如果成功，隐藏 UI；如果失败，恢复按钮状态
    if (success) {
      hideAllUI();
      hideToolbar();
      showSuccessToast(`已设置提醒：${formatRemindTime(selectedDate)}`);
    } else {
      // 恢复按钮状态
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认';
      showErrorToast('创建提醒失败，请稍后重试');
    }
  });
  
  // 点击选择器外部不自动关闭（只能通过按钮关闭）
  picker.addEventListener('mouseenter', () => {
    cancelHide();
  });
  
  picker.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

/**
 * 显示快速菜单
 */
async function showQuickMenu(messageInfo: MessageInfo, anchorElement: HTMLElement) {
  hideMenu();
  
  const menu = document.createElement('div');
  menu.className = 'snooze-menu';
  
  const quickOptions = getQuickOptions();
  
  // 精简的菜单，不包含消息预览
  menu.innerHTML = `
    ${quickOptions.map(opt => {
      const time = opt.getTime();
      return `
        <div class="snooze-quick-option" data-time="${time.getTime()}">
          <span class="snooze-quick-option-icon">${opt.icon}</span>
          <span class="snooze-quick-option-label">${opt.label}</span>
        </div>
      `;
    }).join('')}
    <div class="snooze-divider"></div>
    <div class="snooze-custom-option">
      <span class="snooze-quick-option-icon">📅</span>
      <span>自定义...</span>
    </div>
  `;
  
  document.body.appendChild(menu);
  currentMenu = menu;
  
  // 定位菜单（在按钮下方，左对齐）
  const anchorRect = anchorElement.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  
  let left = anchorRect.left; // 左对齐到按钮
  let top = anchorRect.bottom + 4;
  
  // 边界检测
  if (left < 10) left = 10;
  if (left + menuRect.width > window.innerWidth - 10) {
    left = window.innerWidth - menuRect.width - 10;
  }
  if (top + menuRect.height > window.innerHeight - 10) {
    top = anchorRect.top - menuRect.height - 4;
  }
  
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  
  // 绑定快速选项点击
  menu.querySelectorAll('.snooze-quick-option').forEach(opt => {
    opt.addEventListener('click', async (e) => {
      e.stopPropagation();
      const timestamp = parseInt((opt as HTMLElement).dataset.time!);
      const remindAt = new Date(timestamp);
      
      // 禁用菜单
      menu.style.pointerEvents = 'none';
      menu.style.opacity = '0.7';
      
      const success = await createSnoozeReminder({
        messageInfo,
        remindAt
      });
      
      // 如果成功，隐藏 UI；如果失败，恢复菜单状态
      if (success) {
        hideAllUI();
        hideToolbar();
        showSuccessToast(`已设置提醒：${formatRemindTime(remindAt)}`);
      } else {
        // 恢复菜单状态
        menu.style.pointerEvents = '';
        menu.style.opacity = '';
        showErrorToast('创建提醒失败，请稍后重试');
      }
    });
  });
  
  // 绑定自定义选项点击
  menu.querySelector('.snooze-custom-option')!.addEventListener('click', (e) => {
    e.stopPropagation();
    showTimePicker(messageInfo, anchorRect);
  });
  
  // 鼠标事件
  menu.addEventListener('mouseenter', () => {
    isHoveringMenu = true;
    cancelHide();
  });
  
  menu.addEventListener('mouseleave', () => {
    isHoveringMenu = false;
    scheduleHide();
  });
}

/**
 * 处理消息元素
 */
function processMessageElement(messageElement: HTMLElement) {
  if (processedMessages.has(messageElement)) return;
  
  // 排除 reply 输入框 - 检查自身或父级是否包含 .conversation-reply-inline-input
  if (messageElement.classList.contains('conversation-reply-inline-input') ||
      messageElement.querySelector('.conversation-reply-inline-input') ||
      messageElement.closest('.conversation-reply-inline-input')) {
    return;
  }
  
  // 找到实际的消息卡片容器
  const cardWrapper = messageElement.classList.contains('conversation-card-wrapper')
    ? messageElement
    : messageElement.querySelector('.conversation-card-wrapper') as HTMLElement;
  
  if (!cardWrapper) {
    // 如果找不到 wrapper，可能是 conversation-card 本身
    const conversationCard = messageElement.closest('.conversation-card');
    if (!conversationCard) return;
  }
  
  const targetElement = cardWrapper || messageElement;
  
  // 检查是否已处理
  if (processedMessages.has(targetElement)) return;
  processedMessages.add(targetElement);
  
  // 确保目标元素有定位上下文
  const computedStyle = window.getComputedStyle(targetElement);
  if (computedStyle.position === 'static') {
    targetElement.style.position = 'relative';
  }
  
  // 创建工具栏容器
  const iconUrl = chrome.runtime.getURL('icons/icon16.png');
  const toolbar = document.createElement('div');
  toolbar.className = 'snooze-toolbar';
  toolbar.innerHTML = `
    <span class="snooze-text-btn">稍后处理</span>
    <span class="auto-reply-btn">自动答复</span>
    <div class="snooze-icon">
      <img src="${iconUrl}" alt="Snooze" />
    </div>
  `;
  
  // 将工具栏添加到消息卡片
  targetElement.appendChild(toolbar);
  
  let showTriggerTimeout: ReturnType<typeof setTimeout> | null = null;
  let messageInfo: MessageInfo | null = null;
  
  // 监听消息卡片的悬浮事件
  const conversationCard = targetElement.closest('.conversation-card') || targetElement;
  
  conversationCard.addEventListener('mouseenter', () => {
    currentMessageElement = targetElement;
    
    // 取消之前的隐藏计划
    cancelHide();
    
    // 1.5 秒后显示工具栏
    if (showTriggerTimeout) {
      clearTimeout(showTriggerTimeout);
    }
    showTriggerTimeout = setTimeout(() => {
      toolbar.classList.add('visible');
    }, 1500);
  });
  
  conversationCard.addEventListener('mouseleave', (e: MouseEvent) => {
    if (showTriggerTimeout) {
      clearTimeout(showTriggerTimeout);
      showTriggerTimeout = null;
    }
    
    // 检查鼠标是否移动到了工具栏或菜单上
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToToolbar = relatedTarget?.closest('.snooze-toolbar');
    const isMovingToMenu = relatedTarget?.closest('.snooze-menu');
    const isMovingToPicker = relatedTarget?.closest('.snooze-picker');
    
    if (isMovingToToolbar || isMovingToMenu || isMovingToPicker) {
      // 移动到工具栏或菜单，不隐藏
      return;
    }
    
    // 立即隐藏工具栏（除非时间选择器打开）
    if (!isPickerOpen) {
      toolbar.classList.remove('visible');
      hideMenu();
    }
  });
  
  // 工具栏悬浮事件
  toolbar.addEventListener('mouseenter', () => {
    isHoveringTrigger = true;
    cancelHide();
    toolbar.classList.add('visible');
  });
  
  toolbar.addEventListener('mouseleave', () => {
    isHoveringTrigger = false;
    scheduleHide();
  });
  
  // 文字按钮点击：默认 1 小时后提醒
  const textBtn = toolbar.querySelector('.snooze-text-btn') as HTMLElement;
  
  textBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    console.log('🔔 Snooze: 点击稍后处理按钮（1小时后提醒）');
    
    // 获取消息信息
    if (!messageInfo) {
      messageInfo = await extractMessageInfo(targetElement);
    }
    
    if (!messageInfo) {
      showErrorToast('无法获取消息信息');
      return;
    }
    
    // 禁用按钮
    textBtn.style.pointerEvents = 'none';
    textBtn.style.opacity = '0.6';
    
    // 1 小时后提醒
    const remindAt = new Date();
    remindAt.setHours(remindAt.getHours() + 1);
    
    const success = await createSnoozeReminder({
      messageInfo,
      remindAt
    });
    
    // 如果成功，隐藏 UI；如果失败，恢复按钮状态
    if (success) {
      hideAllUI();
      hideToolbar();
      showSuccessToast(`已设置提醒：${formatRemindTime(remindAt)}`);
    } else {
      // 恢复按钮状态
      textBtn.style.pointerEvents = '';
      textBtn.style.opacity = '';
      showErrorToast('创建提醒失败，请稍后重试');
    }
  });
  
  // 文字按钮悬浮：显示快速菜单
  textBtn.addEventListener('mouseenter', async () => {
    // 取消隐藏
    cancelHide();
    
    // 获取消息信息
    if (!messageInfo) {
      messageInfo = await extractMessageInfo(targetElement);
    }
    
    if (messageInfo) {
      showQuickMenu(messageInfo, textBtn); // 传入 textBtn 而不是 toolbar
    }
  });
  
  // 文字按钮移出：检查是否移动到快速菜单，如果不是则隐藏菜单
  textBtn.addEventListener('mouseleave', (e: MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const isMovingToMenu = relatedTarget?.closest('.snooze-menu');
    
    // 如果不是移动到快速菜单，则隐藏菜单
    if (!isMovingToMenu) {
      hideMenu();
    }
  });
  
  // 自动答复按钮点击处理
  const autoReplyBtn = toolbar.querySelector('.auto-reply-btn') as HTMLElement;
  
  // 自动答复按钮悬浮：隐藏快速菜单
  autoReplyBtn.addEventListener('mouseenter', () => {
    hideMenu();
  });
  
  autoReplyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    // 获取消息信息
    if (!messageInfo) {
      messageInfo = await extractMessageInfo(targetElement);
    }
    
    if (!messageInfo) {
      showErrorToast('无法获取消息信息');
      return;
    }
    
    // 发送消息给 background 打开自动答复配置窗口
    try {
      await chrome.runtime.sendMessage({
        type: 'OPEN_AUTO_REPLY_CONFIG',
        data: {
          sender: messageInfo.senderName,
          groupId: messageInfo.groupId,
          groupName: messageInfo.groupName,
          content: messageInfo.content,
          messageId: messageInfo.id
        }
      });
      
      hideAllUI();
      hideToolbar();
      showSuccessToast('正在打开自动答复配置...');
    } catch (error) {
      console.error('打开自动答复配置失败:', error);
      showErrorToast('打开配置失败，请稍后重试');
    }
  });
  
  console.log('🔔 Snooze: 已为消息添加工具栏', targetElement.getAttribute('data-id'));
}

/**
 * 扫描并处理页面中的消息
 */
function scanAndProcessMessages(container?: Element) {
  const root = container || document.body;
  
  // 跳过 Snooze 相关元素
  if (root instanceof HTMLElement && 
      (root.classList.contains('snooze-menu') || 
       root.classList.contains('snooze-picker') ||
       root.classList.contains('snooze-toolbar') ||
       root.classList.contains('snooze-toast'))) {
    return;
  }
  
  // 根据实际 RingCentral DOM 结构，主要选择器：
  const selectors = [
    '.conversation-card-wrapper[data-id]',
    '.conversation-card',
    '[data-name="conversation-card"]',
  ];
  
  const processedInThisRound = new Set<HTMLElement>();
  
  for (const selector of selectors) {
    try {
      const messages = root.querySelectorAll(selector);
      messages.forEach(msg => {
        if (msg instanceof HTMLElement && !processedInThisRound.has(msg)) {
          const parentProcessed = Array.from(processedInThisRound).some(
            processed => processed.contains(msg) || msg.contains(processed)
          );
          if (!parentProcessed) {
            processedInThisRound.add(msg);
            processMessageElement(msg);
          }
        }
      });
    } catch (e) {
      console.log('Snooze: selector error', e);
    }
  }
}

/**
 * 初始化 Snooze 功能
 */
export function initSnooze() {
  console.log('🔔 Snooze: 开始初始化...');
  
  // 检查是否在 RingCentral 页面
  if (!window.location.href.includes('app.ringcentral.com')) {
    console.log('🔔 Snooze: 不是 RingCentral 页面，跳过初始化');
    return;
  }
  
  // 注入样式
  injectStyles();
  console.log('🔔 Snooze: 样式已注入');
  
  // 初始扫描（延迟更长时间等待页面加载）
  setTimeout(() => {
    console.log('🔔 Snooze: 开始初始扫描...');
    scanAndProcessMessages();
    
    const messages = document.querySelectorAll('.conversation-card-wrapper[data-id]');
    console.log(`🔔 Snooze: 找到 ${messages.length} 条消息`);
  }, 2000);
  
  // 再次扫描
  setTimeout(() => {
    console.log('🔔 Snooze: 第二次扫描...');
    scanAndProcessMessages();
  }, 5000);
  
  // 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) {
          hasNewNodes = true;
          scanAndProcessMessages(node);
        }
      });
    });
    if (hasNewNodes) {
      scanAndProcessMessages();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // 点击页面其他区域时，如果不是在选择器打开状态，隐藏菜单
  document.addEventListener('click', (e) => {
    if (isPickerOpen) return;  // 选择器打开时不处理
    
    const target = e.target as HTMLElement;
    if (!target.closest('.snooze-menu') && 
        !target.closest('.snooze-toolbar') &&
        !target.closest('.snooze-picker')) {
      hideMenu();
    }
  });
  
  console.log('✅ Snooze: 初始化完成');
}
