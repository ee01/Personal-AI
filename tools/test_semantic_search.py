#!/usr/bin/env python3
"""
test_semantic_search.py - 语义搜索工具测试脚本

用于测试 semantic_search.py 的核心功能
"""

import sys
from semantic_search import SemanticSearcher

def test_connection():
    """测试连接功能"""
    print("=" * 60)
    print("测试 1: 连接到 ChromaDB")
    print("=" * 60)
    
    searcher = SemanticSearcher(host="localhost", port=8000)
    
    if searcher.connect():
        print("✅ 连接成功")
        print(f"发现 {len(searcher.collections)} 个集合")
        return searcher
    else:
        print("❌ 连接失败")
        return None

def test_list_collections(searcher):
    """测试列出集合功能"""
    print("\n" + "=" * 60)
    print("测试 2: 列出集合")
    print("=" * 60)
    
    # 测试列出所有集合
    all_colls = searcher.list_collections('all')
    print(f"\n所有集合 ({len(all_colls)}):")
    for coll in all_colls[:5]:  # 只显示前5个
        print(f"  - {coll}")
    if len(all_colls) > 5:
        print(f"  ... 还有 {len(all_colls) - 5} 个集合")
    
    # 测试按类型过滤
    message_colls = searcher.list_collections('messages')
    print(f"\n消息集合 ({len(message_colls)}):")
    for coll in message_colls[:3]:
        print(f"  - {coll}")
    
    entity_colls = searcher.list_collections('entities')
    print(f"\n实体集合 ({len(entity_colls)}):")
    for coll in entity_colls[:3]:
        print(f"  - {coll}")
    
    webpage_colls = searcher.list_collections('webpages')
    print(f"\n网页集合 ({len(webpage_colls)}):")
    for coll in webpage_colls[:3]:
        print(f"  - {coll}")
    
    print("\n✅ 集合列表测试通过")

def test_search(searcher):
    """测试搜索功能"""
    print("\n" + "=" * 60)
    print("测试 3: 执行搜索")
    print("=" * 60)
    
    # 测试基础搜索
    query = "项目"
    print(f"\n搜索查询: '{query}'")
    
    try:
        results = searcher.search(
            query=query,
            collection_type='messages',
            n_results=2
        )
        
        if results:
            total = sum(len(items) for items in results.values())
            print(f"✅ 搜索成功，找到 {total} 条结果")
            
            # 显示结果摘要
            for coll_name, items in results.items():
                print(f"\n集合: {coll_name}")
                for i, item in enumerate(items, 1):
                    print(f"  {i}. 相关度: {item['relevance']:.2%}")
                    print(f"     内容: {item['document'][:100]}...")
        else:
            print("⚠️ 没有找到结果")
            
    except Exception as e:
        print(f"❌ 搜索失败: {e}")
        import traceback
        traceback.print_exc()

def test_format_results(searcher):
    """测试结果格式化"""
    print("\n" + "=" * 60)
    print("测试 4: 结果格式化")
    print("=" * 60)
    
    # 创建测试数据
    test_message = {
        'id': 'test-msg-001',
        'relevance': 0.85,
        'distance': 0.15,
        'document': '这是一条测试消息，讨论项目进度更新',
        'metadata': {
            'sender': '张三',
            'timestamp': 1697520000000,
            'teamName': '开发团队',
            'summary': '项目进度更新讨论',
            'entities': '{"people": [{"name": "张三"}], "projects": [{"name": "AI项目"}]}'
        }
    }
    
    test_entity = {
        'id': 'test-entity-001',
        'relevance': 0.92,
        'distance': 0.08,
        'document': 'AI 项目 - 使用机器学习技术的智能推荐系统',
        'metadata': {
            'name': 'AI 项目',
            'type': 'Project',
            'created': 1697000000000,
            'properties': '{"status": "进行中", "team": "研发部"}'
        }
    }
    
    test_webpage = {
        'id': 'test-webpage-001',
        'relevance': 0.78,
        'distance': 0.22,
        'document': 'React 官方文档 - Hooks 使用指南',
        'metadata': {
            'title': 'React Hooks 指南',
            'url': 'https://react.dev/hooks',
            'domain': 'react.dev',
            'contentCategory': '技术文档',
            'extractedAt': 1697520000000
        }
    }
    
    print("\n消息格式化测试:")
    print(searcher.format_message_result(test_message, 1))
    
    print("\n实体格式化测试:")
    print(searcher.format_entity_result(test_entity, 1))
    
    print("\n网页格式化测试:")
    print(searcher.format_webpage_result(test_webpage, 1))
    
    print("\n✅ 格式化测试通过")

def main():
    """主测试函数"""
    print("🧪 开始测试 semantic_search.py")
    print("")
    
    # 测试连接
    searcher = test_connection()
    
    if not searcher:
        print("\n❌ 无法连接到 ChromaDB，跳过后续测试")
        print("请确保 ChromaDB 服务正在运行: docker-compose up -d")
        sys.exit(1)
    
    # 测试列出集合
    test_list_collections(searcher)
    
    # 测试搜索
    test_search(searcher)
    
    # 测试格式化（不需要连接）
    test_format_results(searcher)
    
    print("\n" + "=" * 60)
    print("✅ 所有测试完成！")
    print("=" * 60)

if __name__ == "__main__":
    main()

