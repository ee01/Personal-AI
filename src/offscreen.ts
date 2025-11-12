// 处理嵌入请求
import { pipeline, env } from '@xenova/transformers';

// 配置 transformers.js 使用本地文件，禁用远程加载
// 这是为了符合 Chrome Extension Manifest V3 的要求，不允许加载远程托管代码
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;

// 设置本地模型路径
env.localModelPath = '/models/';

// 强制使用打包在扩展内的 WASM 文件
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/';
}

let embeddingModel: any = null;

// 初始化模型
async function initModel() {
  if (!embeddingModel) {
    console.log('正在初始化嵌入模型...');
    try {
      embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        // 强制本地加载
        local_files_only: true,
      });
      console.log('嵌入模型初始化成功');
    } catch (error) {
      console.error('嵌入模型初始化失败:', error);
    }
  }
  return embeddingModel;
}

// 生成嵌入向量
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = await initModel();
    if (!model) {
      console.error('模型未初始化');
      return new Array(384).fill(0);
    }
    
    const result = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  } catch (error) {
    console.error('生成嵌入失败:', error);
    return new Array(384).fill(0);
  }
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message) => {
  console.log('离屏文档收到消息:', message.type);
  
  if (message.type === 'GET_EMBEDDING') {
    (async () => {
      const embedding = await generateEmbedding(message.text);
      chrome.runtime.sendMessage({
        type: 'EMBEDDING_RESULT',
        requestId: message.requestId,
        embedding: embedding
      });
    })();
  }
  
  return false; // 不需要保持消息通道开启
});

console.log('离屏文档脚本已加载'); 