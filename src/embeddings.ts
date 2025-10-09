// 创建新文件处理嵌入相关功能
const pendingEmbeddingRequests: Map<string, { resolve: (value: number[]) => void, reject: (reason: any) => void }> = new Map();

// 创建离屏文档
export async function createOffscreenDocument() {
  try {
    // 检查是否已经存在离屏文档
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      console.log('离屏文档已存在');
      return;
    }
    
    console.log('创建离屏文档...');
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: '需要使用 WebAssembly 来运行嵌入模型'
    });
    console.log('离屏文档创建成功');
  } catch (error) {
    console.error('创建离屏文档失败:', error);
  }
}

// 通过离屏文档获取嵌入向量
export async function getEmbeddingViaOffscreen(text: string): Promise<number[]> {
  const isBackground = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;
  if (isBackground) {
    return await getEmbeddingInBackground(text);
  } else {
    const result = await chrome.runtime.sendMessage({
      type: 'EXEC_EMBEDDING_REQUEST',
      text
    });
    return result;
  }
}
export async function getEmbeddingInBackground(text: string): Promise<number[]> {
  try {
    await createOffscreenDocument();
    
    // 生成唯一请求ID
    const requestId = Date.now().toString() + Math.random().toString().slice(2);
    
    // 创建Promise并存储
    const resultPromise = new Promise<number[]>((resolve, reject) => {
      pendingEmbeddingRequests.set(requestId, { resolve, reject });
      
      // 设置超时
      setTimeout(() => {
        if (pendingEmbeddingRequests.has(requestId)) {
          pendingEmbeddingRequests.delete(requestId);
          reject(new Error('获取嵌入向量超时'));
        }
      }, 30000); // 30秒超时
    });
    
    // 发送消息到离屏文档
    chrome.runtime.sendMessage({
      type: 'GET_EMBEDDING',
      requestId,
      text
    });
    
    return resultPromise;
  } catch (error) {
    console.error('通过离屏文档获取嵌入向量失败:', error);
    return new Array(384).fill(0);
  }
}

// 处理嵌入结果
export function handleEmbeddingResult(message: any) {
  if (message.type === 'EMBEDDING_RESULT') {
    const requestId = message.requestId;
    const pendingRequest = pendingEmbeddingRequests.get(requestId);
    
    if (pendingRequest) {
      pendingEmbeddingRequests.delete(requestId);
      pendingRequest.resolve(message.embedding);
    }
  }
}