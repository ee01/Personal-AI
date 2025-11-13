/**
 * 下载 Xenova/all-MiniLM-L6-v2 模型到本地
 * 用于 Chrome Extension Manifest V3 合规
 */

import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 设置缓存目录
const CACHE_DIR = path.join(__dirname, '..', 'static', 'models');
env.cacheDir = CACHE_DIR;

// 确保目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

console.log('📥 开始下载模型: Xenova/all-MiniLM-L6-v2');
console.log('📂 缓存目录:', CACHE_DIR);

async function downloadModel() {
  try {
    // 这会自动下载模型到指定的缓存目录
    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        cache_dir: CACHE_DIR
      }
    );
    
    console.log('✅ 模型下载成功！');
    console.log('📁 模型文件位于:', CACHE_DIR);
    
    // 测试模型
    console.log('\n🧪 测试模型...');
    const output = await extractor('Hello, world!', {
      pooling: 'mean',
      normalize: true
    });
    console.log('✅ 模型测试成功！输出维度:', output.dims);
    
    // 列出下载的文件
    console.log('\n📋 下载的文件列表:');
    const modelPath = path.join(CACHE_DIR, 'Xenova', 'all-MiniLM-L6-v2');
    if (fs.existsSync(modelPath)) {
      const files = fs.readdirSync(modelPath, { recursive: true });
      files.forEach(file => {
        const filePath = path.join(modelPath, file);
        if (fs.statSync(filePath).isFile()) {
          const size = (fs.statSync(filePath).size / 1024).toFixed(2);
          console.log(`  - ${file} (${size} KB)`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ 下载失败:', error);
    process.exit(1);
  }
}

downloadModel();

