# 语义搜索工具 - 嵌入模型修复说明

## 🔧 问题诊断

### 原始问题
用户反馈：**搜索结果不够准确，检索出来的内容不是特别匹配**

### 根本原因

经过对比 `CloudStorage.ts` 和 `semantic_search.py` 的实现，发现了关键差异：

#### CloudStorage.ts 配置
```typescript
// src/offscreen.ts
embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const result = await model(text, { pooling: 'mean', normalize: true });
```

```typescript
// src/storage/CloudStorage.ts
const queryEmbedding = await getEmbeddingViaOffscreen(query);
queryParams = {
  queryEmbeddings: [queryEmbedding],  // 使用预先计算的向量
  // ...
};
```

#### semantic_search.py 原始配置（❌ 错误）
```python
# 错误：使用 query_texts 让 ChromaDB 使用默认嵌入
query_params = {
    'query_texts': [query],  # ❌ 这会使用 ChromaDB 的默认嵌入
    'n_results': n_results,
    'include': ['documents', 'metadatas', 'distances']
}
```

### 问题分析

1. **ChromaDB 存储的向量**：由 `Xenova/all-MiniLM-L6-v2` 模型生成，配置为 `mean pooling` + `normalize`

2. **Python 工具原始查询方式**：
   - 使用 `query_texts` 参数
   - ChromaDB 会使用其默认的嵌入函数（如果有的话）
   - **不同的嵌入模型/配置导致向量空间不匹配**

3. **结果**：向量在不同的空间中，余弦相似度计算不准确

---

## ✅ 修复方案

### 1. 添加正确的嵌入模型

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# 使用与项目一致的模型
EMBEDDING_MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'
```

**说明**：
- `Xenova/all-MiniLM-L6-v2` (JavaScript) = `sentence-transformers/all-MiniLM-L6-v2` (Python)
- 这是同一个模型的不同实现

### 2. 实现嵌入生成方法

```python
def _load_embedding_model(self):
    """加载嵌入模型（延迟加载）"""
    if self.embedding_model is None:
        self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return self.embedding_model

def _get_embedding(self, text: str) -> np.ndarray:
    """
    生成文本的嵌入向量
    
    与 CloudStorage.ts 中的配置保持一致：
    - 模型: Xenova/all-MiniLM-L6-v2
    - normalize: true (sentence-transformers 默认已归一化)
    """
    model = self._load_embedding_model()
    # sentence-transformers 默认已经进行了 mean pooling 和 normalization
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding
```

### 3. 修改查询方式

```python
# 生成查询的嵌入向量（与 CloudStorage.ts 保持一致）
query_embedding = self._get_embedding(query).tolist()

# 使用 query_embeddings 而不是 query_texts
query_params = {
    'query_embeddings': [query_embedding],  # ✅ 使用预先计算的向量
    'n_results': n_results,
    'include': ['documents', 'metadatas', 'distances']
}
```

### 4. 更新依赖

在 `requirements.txt` 中添加：
```
sentence-transformers>=2.2.0
```

---

## 📊 技术细节对比

| 配置项 | CloudStorage.ts | semantic_search.py (修复后) |
|--------|-----------------|----------------------------|
| 模型 | `Xenova/all-MiniLM-L6-v2` | `sentence-transformers/all-MiniLM-L6-v2` |
| Pooling | `mean` | `mean` (默认) |
| Normalize | `true` | `normalize_embeddings=True` |
| 向量维度 | 384 | 384 |
| 查询参数 | `queryEmbeddings` | `query_embeddings` |
| 距离度量 | cosine | cosine (ChromaDB 默认) |

---

## 🎯 修复效果

### 修复前
- 搜索结果相关性低
- 向量空间不匹配
- 相似度计算不准确

### 修复后
- ✅ 使用相同的嵌入模型和配置
- ✅ 向量在同一空间中
- ✅ 搜索结果准确匹配
- ✅ 相关度评分可靠

---

## 📝 使用说明

### 首次使用

```bash
# 1. 安装依赖（会自动下载模型，约 90MB）
pip install -r requirements.txt

# 2. 首次运行（会初始化模型）
python tools/semantic_search.py "测试查询" --limit 5
```

### 模型下载位置

sentence-transformers 会自动将模型下载到：
- Linux/Mac: `~/.cache/huggingface/hub/`
- Windows: `C:\Users\<用户名>\.cache\huggingface\hub\`

### 离线使用

如果需要在离线环境使用，可以预先下载模型：

```python
from sentence_transformers import SentenceTransformer

# 首次运行会下载模型
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
```

---

## 🔍 验证修复

### 测试步骤

1. **连接到 ChromaDB**：
   ```bash
   python tools/semantic_search.py --list-collections
   ```

2. **执行测试查询**：
   ```bash
   python tools/semantic_search.py "项目进度" --type messages --limit 5
   ```

3. **验证相关度**：
   - 检查返回结果的 `相关度` 分数
   - 确认内容与查询高度相关
   - 相关度应该在 60% 以上

### 预期结果

```
🔍 搜索查询: '项目进度'
📥 正在加载嵌入模型: sentence-transformers/all-MiniLM-L6-v2
✅ 嵌入模型加载成功
📂 目标集合 (1): esone.qiu-messages
  ✓ esone.qiu-messages: 找到 5 条结果

================================================================================
结果 #1 [消息] - 相关度: 87.45%  ✅ 高相关度
================================================================================
内容：讨论 AI 项目的最新进度...
```

---

## 💡 最佳实践

1. **模型一致性**：
   - Python 工具必须使用与项目相同的嵌入模型
   - 配置参数（pooling, normalization）必须一致

2. **向量查询**：
   - 使用 `query_embeddings` 而不是 `query_texts`
   - 确保向量在同一空间中

3. **性能优化**：
   - 嵌入模型使用延迟加载
   - 模型只加载一次，缓存后续使用

4. **错误处理**：
   - 提供清晰的错误提示
   - 指导用户安装必要的依赖

---

## 📚 参考资料

- [sentence-transformers 文档](https://www.sbert.net/)
- [all-MiniLM-L6-v2 模型卡片](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [ChromaDB 查询文档](https://docs.trychroma.com/reference/Collection#query)
- [Xenova/transformers.js](https://github.com/xenova/transformers.js)

---

## ✅ 检查清单

修复完成后，确认以下各项：

- [x] 添加 `sentence-transformers` 依赖
- [x] 实现 `_get_embedding()` 方法
- [x] 修改为使用 `query_embeddings` 参数
- [x] 更新 `requirements.txt`
- [x] 更新使用文档
- [x] 添加模型加载提示
- [x] 测试搜索结果准确性

---

**修复日期**: 2025-10-17  
**修复版本**: v1.0.1  
**影响范围**: 所有语义搜索功能

