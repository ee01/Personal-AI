#!/usr/bin/env python3
"""
semantic_search.py - ChromaDB 语义搜索工具

功能：
- 使用自然语言查询 ChromaDB 中的相似数据
- 支持多种数据类型：messages（消息）、entities（实体）、webpages（网页）
- 支持跨用户、跨集合搜索
- 提供详细的搜索结果展示
"""

import chromadb
import argparse
import json
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional
from collections import defaultdict
from sentence_transformers import SentenceTransformer
import numpy as np

# ChromaDB 服务配置
DEFAULT_CHROMA_HOST = "10.32.56.212"
DEFAULT_CHROMA_PORT = 8000

# 嵌入模型配置（与 CloudStorage.ts 保持一致）
EMBEDDING_MODEL_NAME = 'sentence-transformers/all-MiniLM-L6-v2'

class SemanticSearcher:
    """语义搜索器"""
    
    def __init__(self, host: str = DEFAULT_CHROMA_HOST, port: int = DEFAULT_CHROMA_PORT):
        """初始化搜索器"""
        self.host = host
        self.port = port
        self.client = None
        self.collections = []
        self.embedding_model = None
        
    def _load_embedding_model(self):
        """加载嵌入模型（延迟加载）"""
        if self.embedding_model is None:
            print(f"📥 正在加载嵌入模型: {EMBEDDING_MODEL_NAME}")
            try:
                self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
                print("✅ 嵌入模型加载成功")
            except Exception as e:
                print(f"❌ 加载嵌入模型失败: {e}")
                print("提示: 请确保已安装 sentence-transformers: pip install sentence-transformers")
                raise
        return self.embedding_model
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """
        生成文本的嵌入向量
        
        与 CloudStorage.ts 中的配置保持一致：
        - 模型: Xenova/all-MiniLM-L6-v2 (对应 sentence-transformers/all-MiniLM-L6-v2)
        - normalize: true (sentence-transformers 默认已归一化)
        """
        model = self._load_embedding_model()
        # sentence-transformers 默认已经进行了 mean pooling 和 normalization
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding
        
    def connect(self) -> bool:
        """连接到 ChromaDB 服务"""
        try:
            print(f"🔌 正在连接 ChromaDB ({self.host}:{self.port})...")
            self.client = chromadb.HttpClient(host=self.host, port=self.port)
            
            # 测试连接并获取集合列表
            self.collections = self.client.list_collections()
            print(f"✅ 连接成功！发现 {len(self.collections)} 个集合")
            return True
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            print("请确保 ChromaDB 服务正在运行：docker-compose up -d")
            return False
    
    def list_collections(self, collection_type: Optional[str] = None) -> List[str]:
        """
        列出所有可用的集合
        
        Args:
            collection_type: 集合类型过滤 ('messages', 'entities', 'webpages', 'all')
        """
        if not self.client:
            return []
        
        all_collections = [c.name for c in self.collections]
        
        if not collection_type or collection_type == 'all':
            return all_collections
        
        # 根据类型过滤集合
        type_map = {
            'messages': '-messages',
            'entities': '-graph-entities',
            'webpages': '-webpages',
            'projects': '-projects',
            'documents': '-documents'
        }
        
        suffix = type_map.get(collection_type, '')
        if suffix:
            return [c for c in all_collections if c.endswith(suffix)]
        
        return all_collections
    
    def search(
        self,
        query: str,
        collection_names: Optional[List[str]] = None,
        collection_type: Optional[str] = None,
        n_results: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        执行语义搜索
        
        Args:
            query: 自然语言查询
            collection_names: 指定要搜索的集合名称列表
            collection_type: 集合类型 ('messages', 'entities', 'webpages')
            n_results: 返回结果数量
            filter_metadata: 元数据过滤条件
            
        Returns:
            按集合组织的搜索结果字典
        """
        if not self.client:
            raise Exception("未连接到 ChromaDB，请先调用 connect()")
        
        # 确定要搜索的集合
        if collection_names:
            target_collections = collection_names
        elif collection_type:
            target_collections = self.list_collections(collection_type)
        else:
            # 默认搜索所有 messages、entities 和 webpages 集合
            target_collections = (
                self.list_collections('messages') +
                self.list_collections('entities') +
                self.list_collections('webpages')
            )
        
        if not target_collections:
            print("⚠️ 没有找到匹配的集合")
            return {}
        
        print(f"\n🔍 搜索查询: '{query}'")
        print(f"📂 目标集合 ({len(target_collections)}): {', '.join(target_collections)}")
        print(f"📊 每个集合返回 {n_results} 条结果")
        
        results = {}
        
        # 生成查询的嵌入向量（与 CloudStorage.ts 保持一致）
        query_embedding = self._get_embedding(query).tolist()
        
        for coll_name in target_collections:
            try:
                collection = self.client.get_collection(name=coll_name)
                
                # 构建查询参数 - 使用 query_embeddings 而不是 query_texts
                # 这与 CloudStorage.ts 中的 queryEmbeddings 参数一致
                query_params = {
                    'query_embeddings': [query_embedding],
                    'n_results': n_results,
                    'include': ['documents', 'metadatas', 'distances']
                }
                
                if filter_metadata:
                    query_params['where'] = filter_metadata
                
                # 执行查询
                result = collection.query(**query_params)
                
                # 处理结果
                if result['ids'] and result['ids'][0]:
                    processed_results = []
                    for i, doc_id in enumerate(result['ids'][0]):
                        item = {
                            'id': doc_id,
                            'distance': result['distances'][0][i] if result['distances'] else None,
                            'relevance': 1 - (result['distances'][0][i] if result['distances'] else 0),
                            'document': result['documents'][0][i] if result['documents'] else '',
                            'metadata': result['metadatas'][0][i] if result['metadatas'] else {}
                        }
                        processed_results.append(item)
                    
                    results[coll_name] = processed_results
                    print(f"  ✓ {coll_name}: 找到 {len(processed_results)} 条结果")
                else:
                    print(f"  ○ {coll_name}: 无结果")
                    
            except Exception as e:
                print(f"  ✗ {coll_name}: 查询失败 - {e}")
        
        return results
    
    def format_message_result(self, item: Dict[str, Any], index: int) -> str:
        """格式化消息结果"""
        metadata = item.get('metadata', {})
        
        # 基础信息
        lines = [
            f"\n{'='*80}",
            f"结果 #{index} [消息] - 相关度: {item['relevance']:.2%}",
            f"{'='*80}"
        ]
        
        # 消息ID
        lines.append(f"ID: {item['id']}")
        
        # 时间信息
        timestamp = metadata.get('timestamp') or metadata.get('datetime')
        if timestamp:
            try:
                if isinstance(timestamp, (int, float)):
                    dt = datetime.fromtimestamp(timestamp / 1000 if timestamp > 10000000000 else timestamp)
                    lines.append(f"时间: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
            except:
                lines.append(f"时间: {timestamp}")
        
        # 发送者和团队
        if metadata.get('sender'):
            lines.append(f"发送者: {metadata['sender']}")
        if metadata.get('teamName'):
            lines.append(f"团队: {metadata['teamName']}")
        
        # 摘要
        if metadata.get('summary'):
            lines.append(f"\n📝 摘要:")
            lines.append(f"  {metadata['summary']}")
        
        # 内容
        document = item.get('document', '')
        if document and document != metadata.get('summary', ''):
            lines.append(f"\n💬 内容:")
            # 限制内容长度
            content = document[:500] + '...' if len(document) > 500 else document
            for line in content.split('\n'):
                lines.append(f"  {line}")
        
        # 实体信息
        entities_str = metadata.get('entities')
        if entities_str:
            try:
                entities = json.loads(entities_str) if isinstance(entities_str, str) else entities_str
                if entities:
                    lines.append(f"\n🏷️ 实体:")
                    if entities.get('people'):
                        people = [p['name'] if isinstance(p, dict) else p for p in entities['people']]
                        lines.append(f"  人员: {', '.join(people)}")
                    if entities.get('projects'):
                        projects = [p['name'] if isinstance(p, dict) else p for p in entities['projects']]
                        lines.append(f"  项目: {', '.join(projects)}")
                    if entities.get('topics'):
                        topics = [t['name'] if isinstance(t, dict) else t for t in entities['topics']]
                        lines.append(f"  主题: {', '.join(topics)}")
            except:
                pass
        
        # 情感和优先级
        extra = []
        if metadata.get('sentiment'):
            extra.append(f"情感: {metadata['sentiment']}")
        if metadata.get('priority'):
            extra.append(f"优先级: {metadata['priority']}")
        if extra:
            lines.append(f"\n📊 {' | '.join(extra)}")
        
        return '\n'.join(lines)
    
    def format_entity_result(self, item: Dict[str, Any], index: int) -> str:
        """格式化实体结果"""
        metadata = item.get('metadata', {})
        
        lines = [
            f"\n{'='*80}",
            f"结果 #{index} [实体] - 相关度: {item['relevance']:.2%}",
            f"{'='*80}"
        ]
        
        # 基础信息
        lines.append(f"ID: {item['id']}")
        lines.append(f"名称: {metadata.get('name', 'N/A')}")
        lines.append(f"类型: {metadata.get('type', 'N/A')}")
        
        # 描述
        document = item.get('document', '')
        if document:
            lines.append(f"\n📖 描述:")
            content = document[:500] + '...' if len(document) > 500 else document
            for line in content.split('\n'):
                lines.append(f"  {line}")
        
        # 属性
        properties_str = metadata.get('properties')
        if properties_str:
            try:
                properties = json.loads(properties_str) if isinstance(properties_str, str) else properties_str
                if properties and isinstance(properties, dict):
                    lines.append(f"\n🔧 属性:")
                    for key, value in list(properties.items())[:10]:  # 最多显示10个属性
                        if isinstance(value, (str, int, float, bool)):
                            lines.append(f"  {key}: {value}")
            except:
                pass
        
        # 关联数据
        related_data_str = metadata.get('relatedData')
        if related_data_str:
            try:
                related_data = json.loads(related_data_str) if isinstance(related_data_str, str) else related_data_str
                if related_data:
                    lines.append(f"\n🔗 关联数据:")
                    if related_data.get('conversations'):
                        lines.append(f"  会话: {len(related_data['conversations'])} 条")
                    if related_data.get('webpages'):
                        lines.append(f"  网页: {len(related_data['webpages'])} 个")
                    if related_data.get('projects'):
                        lines.append(f"  项目: {len(related_data['projects'])} 个")
            except:
                pass
        
        # 时间信息
        if metadata.get('created'):
            try:
                created = metadata['created']
                if isinstance(created, (int, float)):
                    dt = datetime.fromtimestamp(created / 1000 if created > 10000000000 else created)
                    lines.append(f"\n创建时间: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
            except:
                pass
        
        return '\n'.join(lines)
    
    def format_webpage_result(self, item: Dict[str, Any], index: int) -> str:
        """格式化网页结果"""
        metadata = item.get('metadata', {})
        
        lines = [
            f"\n{'='*80}",
            f"结果 #{index} [网页] - 相关度: {item['relevance']:.2%}",
            f"{'='*80}"
        ]
        
        # 基础信息
        lines.append(f"ID: {item['id']}")
        if metadata.get('title'):
            lines.append(f"标题: {metadata['title']}")
        if metadata.get('url'):
            lines.append(f"URL: {metadata['url']}")
        if metadata.get('domain'):
            lines.append(f"域名: {metadata['domain']}")
        
        # 内容
        document = item.get('document', '')
        if document:
            lines.append(f"\n📄 内容:")
            content = document[:500] + '...' if len(document) > 500 else document
            for line in content.split('\n'):
                lines.append(f"  {line}")
        
        # 分类和相关性
        if metadata.get('contentCategory'):
            lines.append(f"\n分类: {metadata['contentCategory']}")
        if metadata.get('contentRelevance'):
            lines.append(f"相关性: {metadata['contentRelevance']}")
        
        # 提取的信息
        extra_info = []
        if metadata.get('projects'):
            try:
                projects = json.loads(metadata['projects']) if isinstance(metadata['projects'], str) else metadata['projects']
                extra_info.append(f"项目: {', '.join(projects)}")
            except:
                pass
        
        if metadata.get('people'):
            try:
                people = json.loads(metadata['people']) if isinstance(metadata['people'], str) else metadata['people']
                extra_info.append(f"人员: {', '.join(people)}")
            except:
                pass
        
        if metadata.get('tags'):
            try:
                tags = json.loads(metadata['tags']) if isinstance(metadata['tags'], str) else metadata['tags']
                extra_info.append(f"标签: {', '.join(tags)}")
            except:
                pass
        
        if extra_info:
            lines.append(f"\n🏷️ {' | '.join(extra_info)}")
        
        # 提取时间
        if metadata.get('extractedAt'):
            try:
                extracted = metadata['extractedAt']
                if isinstance(extracted, (int, float)):
                    dt = datetime.fromtimestamp(extracted / 1000 if extracted > 10000000000 else extracted)
                    lines.append(f"\n提取时间: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
            except:
                pass
        
        return '\n'.join(lines)
    
    def display_results(self, results: Dict[str, List[Dict[str, Any]]], output_format: str = 'text'):
        """
        展示搜索结果
        
        Args:
            results: 搜索结果字典
            output_format: 输出格式 ('text' 或 'json')
        """
        if not results:
            print("\n❌ 没有找到任何结果")
            return
        
        total_results = sum(len(items) for items in results.values())
        print(f"\n✅ 共找到 {total_results} 条结果，分布在 {len(results)} 个集合中")
        
        if output_format == 'json':
            # JSON 格式输出
            print("\n" + json.dumps(results, ensure_ascii=False, indent=2))
            return
        
        # 文本格式输出
        for coll_name, items in results.items():
            print(f"\n{'#'*80}")
            print(f"# 集合: {coll_name} ({len(items)} 条结果)")
            print(f"{'#'*80}")
            
            # 判断集合类型
            if '-messages' in coll_name:
                formatter = self.format_message_result
            elif '-graph-entities' in coll_name or '-entities' in coll_name:
                formatter = self.format_entity_result
            elif '-webpages' in coll_name:
                formatter = self.format_webpage_result
            else:
                # 通用格式
                formatter = lambda item, idx: (
                    f"\n{'='*80}\n"
                    f"结果 #{idx} - 相关度: {item['relevance']:.2%}\n"
                    f"{'='*80}\n"
                    f"ID: {item['id']}\n"
                    f"\n内容:\n{item.get('document', 'N/A')}\n"
                    f"\n元数据:\n{json.dumps(item.get('metadata', {}), ensure_ascii=False, indent=2)}"
                )
            
            for i, item in enumerate(items, 1):
                print(formatter(item, i))
    
    def save_results(self, results: Dict[str, List[Dict[str, Any]]], output_file: str):
        """保存搜索结果到文件"""
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"\n💾 结果已保存到: {output_file}")
        except Exception as e:
            print(f"\n❌ 保存结果失败: {e}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='ChromaDB 语义搜索工具 - 使用自然语言查询相似数据',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 搜索所有消息
  %(prog)s "项目进度更新"
  
  # 搜索特定类型
  %(prog)s "张三" --type entities
  
  # 搜索指定集合
  %(prog)s "前端开发" --collections esone.qiu-messages esone.qiu-entities
  
  # 指定返回数量
  %(prog)s "API 接口" --limit 20
  
  # 保存结果到文件
  %(prog)s "数据库设计" --output results.json
  
  # 使用远程服务器
  %(prog)s "会议纪要" --host 10.32.56.212 --port 8000
  
  # 列出所有集合
  %(prog)s --list-collections
        """
    )
    
    # 查询参数
    parser.add_argument('query', nargs='?', help='自然语言查询')
    parser.add_argument('-t', '--type', choices=['messages', 'entities', 'webpages', 'all'],
                        help='数据类型 (messages/entities/webpages/all)')
    parser.add_argument('-c', '--collections', nargs='+', help='指定要搜索的集合名称')
    parser.add_argument('-n', '--limit', type=int, default=10, help='每个集合返回结果数量 (默认: 10)')
    
    # 输出参数
    parser.add_argument('-f', '--format', choices=['text', 'json'], default='text',
                        help='输出格式 (text/json, 默认: text)')
    parser.add_argument('-o', '--output', help='保存结果到文件')
    
    # 连接参数
    parser.add_argument('--host', default=DEFAULT_CHROMA_HOST, help=f'ChromaDB 主机 (默认: {DEFAULT_CHROMA_HOST})')
    parser.add_argument('--port', type=int, default=DEFAULT_CHROMA_PORT, help=f'ChromaDB 端口 (默认: {DEFAULT_CHROMA_PORT})')
    
    # 工具参数
    parser.add_argument('--list-collections', action='store_true', help='列出所有可用集合')
    
    args = parser.parse_args()
    
    # 创建搜索器
    searcher = SemanticSearcher(host=args.host, port=args.port)
    
    # 连接到服务
    if not searcher.connect():
        sys.exit(1)
    
    # 列出集合
    if args.list_collections:
        print("\n📚 可用集合:")
        collections = searcher.list_collections('all')
        
        # 按类型分组
        grouped = defaultdict(list)
        for coll in collections:
            if '-messages' in coll:
                grouped['消息 (Messages)'].append(coll)
            elif '-graph-entities' in coll or '-entities' in coll:
                grouped['实体 (Entities)'].append(coll)
            elif '-webpages' in coll:
                grouped['网页 (Webpages)'].append(coll)
            elif '-projects' in coll:
                grouped['项目 (Projects)'].append(coll)
            elif '-documents' in coll:
                grouped['文档 (Documents)'].append(coll)
            else:
                grouped['其他 (Others)'].append(coll)
        
        for category, colls in sorted(grouped.items()):
            print(f"\n{category} ({len(colls)}):")
            for coll in sorted(colls):
                print(f"  - {coll}")
        
        sys.exit(0)
    
    # 执行搜索
    if not args.query:
        print("❌ 请提供查询内容或使用 --list-collections 查看可用集合")
        parser.print_help()
        sys.exit(1)
    
    try:
        results = searcher.search(
            query=args.query,
            collection_names=args.collections,
            collection_type=args.type,
            n_results=args.limit
        )
        
        # 展示结果
        searcher.display_results(results, output_format=args.format)
        
        # 保存结果
        if args.output:
            searcher.save_results(results, args.output)
            
    except Exception as e:
        print(f"\n❌ 搜索失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

