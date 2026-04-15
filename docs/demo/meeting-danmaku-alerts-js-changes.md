# Meeting Danmaku Alerts JS 修改清单

当前已经完成了 `meeting-danmaku-alerts.html` 的 CSS 和 HTML 结构修改（加入了 Idle 状态的图标、四个 Sidebar tabs 的内容、以及 Debug tab 的结构）。

要在真正实施中使功能运转起来，还需要以下剩余的 JavaScript 逻辑修改。

## 1. 录制状态切换 (Two-State Logic)

需要新增全局状态 `captureEnabled` 并在现有的交互逻辑中关联控制。

```javascript
// 【新增】全局状态变量
let captureEnabled = false;

// 【新增】状态切换函数
function toggleCapture() {
  captureEnabled = !captureEnabled;
  const fab = document.getElementById('radarFab');
  const tooltipHeader = document.getElementById('tooltipHeader');
  const tooltipStatusText = document.getElementById('tooltipStatusText');
  const tooltipTime = document.getElementById('tooltipTime');
  const toggleCaptureBtn = document.getElementById('toggleCaptureBtn');
  const panelRecStatus = document.getElementById('panelRecStatus');
  const panelRecTime = document.getElementById('recTime');

  if (captureEnabled) {
    // 进入录制状态
    fab.classList.remove('idle');
    tooltipHeader.classList.remove('idle');
    tooltipStatusText.textContent = 'REC';
    tooltipTime.textContent = '00:00:01'; // 模拟开始计时
    panelRecTime.textContent = '00:00:01';
    toggleCaptureBtn.textContent = '🔘 停止 Capture';
    toggleCaptureBtn.style.background = 'rgba(108,92,231,0.2)';
    toggleCaptureBtn.style.borderColor = 'var(--accent)';
    panelRecStatus.style.display = 'flex';
  } else {
    // 退出为 Ready 状态
    fab.classList.add('idle');
    tooltipHeader.classList.add('idle');
    tooltipStatusText.textContent = 'READY';
    tooltipTime.textContent = '--:--';
    panelRecTime.textContent = '--:--';
    toggleCaptureBtn.textContent = '🔘 开启 Capture';
    toggleCaptureBtn.style.background = 'rgba(255,71,87,0.15)';
    toggleCaptureBtn.style.borderColor = 'var(--rec-red)';
    panelRecStatus.style.display = 'none';
  }
}
```

## 2. Tooltip 的 JS 持久化 (Hover Persistence)

为了解决从 Icon 移动到 Tooltip 时 CSS `:hover` 断裂的问题，删除原有的 `:hover` 逻辑，改为用 JS 定时器接管：

```javascript
// 【新增】Hover 保持控制器
let hoverCloseTimer = null;

function installHoverPersistence() {
  const fab = document.getElementById('radarFab');
  const tooltip = document.getElementById('radarTooltip');
  
  // 鼠标移入 FAB 或 Tooltip 区域
  const handleMouseEnter = () => {
    clearTimeout(hoverCloseTimer);
    fab.classList.add('tooltip-open');
  };

  // 鼠标移出 FAB 或 Tooltip 区域
  const handleMouseLeave = () => {
    clearTimeout(hoverCloseTimer);
    hoverCloseTimer = setTimeout(() => {
      fab.classList.remove('tooltip-open');
    }, 120); // 120ms 的防抖宽容期
  };

  fab.addEventListener('mouseenter', handleMouseEnter);
  fab.addEventListener('mouseleave', handleMouseLeave);
}

// 需在页面加载完毕后调用
// installHoverPersistence();
```

> **注意：** `togglePanel()` 中打开侧边栏时，也应该添加 `fab.classList.remove('tooltip-open');` 以免冲突。

## 3. Sidebar Tab 切换逻辑

实现底部 4 个导航栏的点击切换功能：

```javascript
// 【新增】Tab 切换函数
function switchTab(tabId) {
  // 1. 移除所有的 active
  document.querySelectorAll('.panel-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  
  // 2. 激活点击的目标
  const targetTabBtn = document.querySelector(`.panel-tab[data-tab="${tabId}"]`);
  const targetContent = document.getElementById(`tab-${tabId}`);
  
  if (targetTabBtn) targetTabBtn.classList.add('active');
  if (targetContent) targetContent.classList.add('active');
}
```

## 4. Debug Tab 启用 (dev-only 模式)

通过 URL 参数判断是否要在 UI 中渲染出 debug tab 功能（由于 HTML 里已经写了 Debug tab 内容，这里只需要判定并把它显示在底部导航栏里）。

```javascript
// 【新增】URL 参数检测与 Debug UI 初始化
function initDebugMode() {
  const urlParams = new URLSearchParams(window.location.search);
  const isDebug = urlParams.get('debug') === '1';
  
  const panelTabs = document.getElementById('panelTabs');
  
  if (isDebug) {
    // 动态注入 Debug tab 到导航栏
    const debugTabBtn = document.createElement('div');
    debugTabBtn.className = 'panel-tab';
    debugTabBtn.setAttribute('data-tab', 'debug');
    debugTabBtn.textContent = '调试';
    debugTabBtn.onclick = () => switchTab('debug');
    panelTabs.appendChild(debugTabBtn);
  } else {
    // 生产模式隐藏 HTML 结构里的 tab-debug DOM 
    //（以防万一虽然它默认没有 active class 但最好彻底隐藏）
    const debugContent = document.getElementById('tab-debug');
    if (debugContent) {
      debugContent.style.display = 'none';
      // 避免类名冲突导致它显示
      debugContent.classList.remove('tab-content'); 
    }
  }
}

// 需在页面加载完毕后调用
// initDebugMode();
```

## 5. P0 强提醒多张堆叠策略（根据最新沟通确认）

在现有的 `fireDanmaku('p0')` 逻辑中，虽然已是一个容器（`p0Container`）不断追加 DOM，但是由于默认是绝对居中（`transform: translate(-50%, -50%)` 加固定居中动画），如果连续发多条会**完全重叠**，遮挡视野。

需要修改已有的创建逻辑：
```javascript
// 在原版 fireDanmaku 的 P0 分支中：
const el = document.createElement('div');
el.className = 'p0-alert';
// 1. 提供唯一 ID 方便控制
el.id = 'p0-' + Date.now();

// ... 原有的 innerHTML 填充 ...

// 2. 在 p0Container 里排列，而不是全都局限于一个绝对坐标
// 建议在 CSS 中把 `.p0-container` 改为 display: flex; flex-direction: column; gap: 16px; align-items: center; 
// 然后去掉动画里的 translate(-50%, -50%)，而是靠 flex 的居中。
// 这里给出 JS 中的插入方式：
p0Container.prepend(el); 

// (CSS 需配合调整，避免多个元素堆在一个像素上)
```
