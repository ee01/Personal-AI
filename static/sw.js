// Service Worker for Personal AI Memory Interface
// 版本号，用于缓存管理
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `personal-ai-memory-${CACHE_VERSION}`;

// 需要缓存的静态资源
const STATIC_ASSETS = [
  './memory.html',
  './memory.js',
  './pwa-manifest.json',
  './pwa-init.js',
  './icons/icon16.png',
  './icons/icon32.png',
  './icons/icon48.png',
  './icons/icon128.png'
];

// 安装事件 - 缓存核心资源
self.addEventListener('install', (event) => {
  console.log('Service Worker 安装中...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存核心资源...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('核心资源缓存完成');
        // 强制激活新的 Service Worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('缓存资源失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('Service Worker 激活中...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('personal-ai-memory-')) {
              console.log('删除旧缓存:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker 激活完成');
        // 立即控制所有客户端
        return self.clients.claim();
      })
  );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }
  
  // 对于记忆界面相关的请求，使用缓存优先策略
  if (shouldCacheFirst(request)) {
    event.respondWith(cacheFirstStrategy(request));
  } 
  // 对于数据API请求，使用网络优先策略
  else if (isApiRequest(request)) {
    event.respondWith(networkFirstStrategy(request));
  }
  // 其他请求使用默认的网络优先策略
  else {
    event.respondWith(networkFirstStrategy(request));
  }
});

// 判断是否应该使用缓存优先策略
function shouldCacheFirst(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // 静态资源使用缓存优先
  const staticExtensions = ['.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico'];
  const isStaticAsset = staticExtensions.some(ext => pathname.endsWith(ext));
  
  // 记忆界面的主要文件
  const isMemoryAsset = pathname.includes('memory') || pathname.includes('pwa-manifest') || pathname.includes('pwa-init');
  
  return isStaticAsset || isMemoryAsset;
}

// 判断是否是API请求
function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') || 
         request.headers.get('content-type') === 'application/json';
}

// 缓存优先策略
async function cacheFirstStrategy(request) {
  try {
    // 首先尝试从缓存获取
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('从缓存返回:', request.url);
      return cachedResponse;
    }
    
    // 缓存中没有，从网络获取
    const networkResponse = await fetch(request);
    
    // 如果网络请求成功，更新缓存
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      console.log('缓存新资源:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('缓存优先策略失败:', error);
    
    // 如果是HTML请求且网络失败，返回离线页面
    if (request.destination === 'document') {
      const offlineResponse = await caches.match('./memory.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// 网络优先策略
async function networkFirstStrategy(request) {
  try {
    // 首先尝试网络请求
    const networkResponse = await fetch(request);
    
    // 如果网络请求成功且是GET请求，更新缓存
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.log('网络请求失败，尝试缓存:', request.url);
    
    // 网络失败，尝试从缓存获取
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('从缓存返回:', request.url);
      return cachedResponse;
    }
    
    // 如果是HTML请求，返回离线页面
    if (request.destination === 'document') {
      const offlineResponse = await caches.match('./memory.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// 监听消息事件（用于与主应用通信）
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      }).catch((error) => {
        event.ports[0].postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'CACHE_STATS':
      getCacheStats().then((stats) => {
        event.ports[0].postMessage(stats);
      });
      break;
      
    default:
      console.log('未知消息类型:', type);
  }
});

// 清理所有缓存
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  const deletePromises = cacheNames
    .filter(name => name.startsWith('personal-ai-memory-'))
    .map(name => caches.delete(name));
    
  await Promise.all(deletePromises);
  console.log('所有缓存已清理');
}

// 获取缓存统计信息
async function getCacheStats() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    let totalSize = 0;
    const entries = [];
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const size = response.headers.get('content-length') || 0;
        totalSize += parseInt(size) || 0;
        entries.push({
          url: request.url,
          size: parseInt(size) || 0,
          type: response.headers.get('content-type') || 'unknown'
        });
      }
    }
    
    return {
      version: CACHE_VERSION,
      totalEntries: entries.length,
      totalSize,
      entries
    };
  } catch (error) {
    console.error('获取缓存统计失败:', error);
    return {
      version: CACHE_VERSION,
      totalEntries: 0,
      totalSize: 0,
      entries: [],
      error: error.message
    };
  }
}

// 后台同步（如果支持）
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    console.log('后台同步事件:', event.tag);
    
    if (event.tag === 'sync-memory-data') {
      event.waitUntil(syncMemoryData());
    }
  });
}

// 同步记忆数据
async function syncMemoryData() {
  try {
    console.log('开始同步记忆数据...');
    
    // 这里可以添加与后端同步的逻辑
    // 例如：上传离线时产生的数据，下载最新的更新等
    
    // 通知所有客户端同步完成
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now()
      });
    });
    
    console.log('记忆数据同步完成');
  } catch (error) {
    console.error('同步记忆数据失败:', error);
  }
}

// 推送通知（如果支持）
if ('push' in self.registration) {
  self.addEventListener('push', (event) => {
    const options = {
      body: '您的记忆系统有新的更新',
      icon: '/icons/icon128.png',
      badge: '/icons/icon48.png',
      tag: 'memory-update',
      actions: [
        {
          action: 'view',
          title: '查看'
        },
        {
          action: 'dismiss',
          title: '忽略'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('Personal AI 记忆系统', options)
    );
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
      event.waitUntil(
        self.clients.openWindow('./memory.html')
      );
    }
  });
}

console.log('Service Worker 脚本加载完成');
