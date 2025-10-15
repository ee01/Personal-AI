#!/usr/bin/env python3
"""
查询 esone.qiu-graph-entities collection 中 relatedData.conversations 的统计信息
"""

import chromadb
import json
from collections import defaultdict

# 生产环境 ChromaDB 地址
chroma_host = "10.32.56.212"
chroma_port = 8000

def query_conversations():
    """查询 conversations 数据统计"""
    try:
        # 连接生产环境 ChromaDB
        print(f"正在连接生产环境 ChromaDB ({chroma_host}:{chroma_port})...")
        client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
        
        # 测试连接
        collections = client.list_collections()
        print(f"✅ 已连接到 ChromaDB，当前有 {len(collections)} 个集合")
        print(f"集合列表: {[c.name for c in collections]}")
        
        # 获取 esone.qiu-graph-entities 集合
        collection_name = "esone.qiu-graph-entities"
        print(f"\n正在查询集合: {collection_name}")
        
        collection = client.get_collection(name=collection_name)
        
        # 获取所有数据
        print("正在获取所有实体数据...")
        result = collection.get(
            include=['metadatas']
        )
        
        if not result['ids'] or not result['metadatas']:
            print("❌ 集合中没有数据")
            return
        
        total_count = len(result['ids'])
        print(f"📊 总共有 {total_count} 个实体")
        
        # 统计 conversations 数量
        zero_conversations = 0  # conversations 为空或 null 的数量
        has_conversations = 0   # conversations 有数据的数量
        conversations_stats = defaultdict(int)  # 按 conversations 数量分组统计
        
        # 按实体类型统计
        entity_type_stats = defaultdict(lambda: {
            'total': 0,
            'with_conversations': 0,
            'without_conversations': 0,
            'conversations_distribution': defaultdict(int)
        })
        
        entities_with_zero = []  # 存储没有 conversations 的实体信息
        entities_with_data = []  # 存储有 conversations 的实体信息
        
        print("\n正在分析 conversations 数据...")
        for i, (entity_id, metadata) in enumerate(zip(result['ids'], result['metadatas'])):
            if i % 100 == 0 and i > 0:
                print(f"  已处理 {i}/{total_count} 个实体...")
            
            # 获取实体信息
            entity_name = metadata.get('name', entity_id)
            entity_type = metadata.get('type', 'unknown')
            
            # 统计实体类型总数
            entity_type_stats[entity_type]['total'] += 1
            
            # 获取 relatedData
            related_data_str = metadata.get('relatedData', '{}')
            
            try:
                # 解析 relatedData JSON
                if isinstance(related_data_str, str):
                    related_data = json.loads(related_data_str)
                else:
                    related_data = related_data_str
                
                conversations = related_data.get('conversations', [])
                
                # 检查 conversations 是否为空
                if not conversations or conversations is None or (isinstance(conversations, list) and len(conversations) == 0):
                    zero_conversations += 1
                    entity_type_stats[entity_type]['without_conversations'] += 1
                    entities_with_zero.append({
                        'id': entity_id,
                        'name': entity_name,
                        'type': entity_type
                    })
                else:
                    has_conversations += 1
                    conv_count = len(conversations) if isinstance(conversations, list) else 1
                    conversations_stats[conv_count] += 1
                    entity_type_stats[entity_type]['with_conversations'] += 1
                    entity_type_stats[entity_type]['conversations_distribution'][conv_count] += 1
                    entities_with_data.append({
                        'id': entity_id,
                        'name': entity_name,
                        'type': entity_type,
                        'conversations_count': conv_count
                    })
                    
            except json.JSONDecodeError as e:
                print(f"⚠️ 解析 relatedData 失败 (实体ID: {entity_id}): {e}")
                zero_conversations += 1
                entity_type_stats[entity_type]['without_conversations'] += 1
                entities_with_zero.append({
                    'id': entity_id,
                    'name': entity_name,
                    'type': entity_type,
                    'error': 'JSON解析失败'
                })
            except Exception as e:
                print(f"⚠️ 处理实体失败 (实体ID: {entity_id}): {e}")
                zero_conversations += 1
                entity_type_stats[entity_type]['without_conversations'] += 1
        
        # 打印统计结果
        print("\n" + "="*80)
        print("📊 总体统计结果")
        print("="*80)
        print(f"总实体数: {total_count}")
        print(f"conversations 为空或 null 的实体数: {zero_conversations} ({zero_conversations/total_count*100:.2f}%)")
        print(f"conversations 有数据的实体数: {has_conversations} ({has_conversations/total_count*100:.2f}%)")
        
        if conversations_stats:
            print("\n按 conversations 数量分布:")
            for count in sorted(conversations_stats.keys()):
                entity_count = conversations_stats[count]
                print(f"  {count} 个 conversations: {entity_count} 个实体")
        
        # 打印按实体类型的统计
        print("\n" + "="*80)
        print("📊 按实体类型统计")
        print("="*80)
        
        # 按总数排序
        sorted_types = sorted(entity_type_stats.items(), key=lambda x: x[1]['total'], reverse=True)
        
        for entity_type, stats in sorted_types:
            total = stats['total']
            with_conv = stats['with_conversations']
            without_conv = stats['without_conversations']
            
            print(f"\n【{entity_type}】")
            print(f"  总数: {total}")
            print(f"  有 conversations: {with_conv} ({with_conv/total*100:.1f}%)")
            print(f"  无 conversations: {without_conv} ({without_conv/total*100:.1f}%)")
            
            if stats['conversations_distribution']:
                print(f"  conversations 数量分布:")
                for conv_count in sorted(stats['conversations_distribution'].keys()):
                    count = stats['conversations_distribution'][conv_count]
                    print(f"    {conv_count} 个: {count} 个实体")
        
        # 打印示例数据
        print("\n" + "="*60)
        print("📝 没有 conversations 的实体示例 (前10个)")
        print("="*60)
        for entity in entities_with_zero[:10]:
            error_msg = f" [错误: {entity.get('error')}]" if 'error' in entity else ""
            print(f"- [{entity['type']}] {entity['name']} (ID: {entity['id']}){error_msg}")
        
        if len(entities_with_zero) > 10:
            print(f"... 还有 {len(entities_with_zero) - 10} 个实体未显示")
        
        print("\n" + "="*60)
        print("📝 有 conversations 的实体示例 (前10个)")
        print("="*60)
        for entity in entities_with_data[:10]:
            print(f"- [{entity['type']}] {entity['name']} (ID: {entity['id']}) - {entity['conversations_count']} 个 conversations")
        
        if len(entities_with_data) > 10:
            print(f"... 还有 {len(entities_with_data) - 10} 个实体未显示")
        
        # 保存详细数据到文件
        print("\n💾 保存详细数据到文件...")
        
        # 转换 entity_type_stats 为可序列化的格式
        entity_type_stats_serializable = {}
        for entity_type, stats in entity_type_stats.items():
            entity_type_stats_serializable[entity_type] = {
                'total': stats['total'],
                'with_conversations': stats['with_conversations'],
                'without_conversations': stats['without_conversations'],
                'conversations_distribution': dict(stats['conversations_distribution'])
            }
        
        output_data = {
            'summary': {
                'total_count': total_count,
                'zero_conversations': zero_conversations,
                'has_conversations': has_conversations,
                'conversations_stats': dict(conversations_stats),
                'entity_type_stats': entity_type_stats_serializable
            },
            'entities_with_zero': entities_with_zero,
            'entities_with_data': entities_with_data
        }
        
        # 保存到 tools 目录
        output_file = 'tools/conversations_analysis.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 详细数据已保存到 {output_file}")
        
        # 同时保存一个可读性更好的文本报告
        report_file = 'tools/conversations_analysis_report.txt'
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("="*80 + "\n")
            f.write("ChromaDB esone.qiu-graph-entities Collection 分析报告\n")
            f.write("="*80 + "\n\n")
            
            f.write("【总体统计】\n")
            f.write(f"总实体数: {total_count}\n")
            f.write(f"有 conversations 的实体: {has_conversations} ({has_conversations/total_count*100:.2f}%)\n")
            f.write(f"无 conversations 的实体: {zero_conversations} ({zero_conversations/total_count*100:.2f}%)\n\n")
            
            if conversations_stats:
                f.write("【Conversations 数量分布】\n")
                for count in sorted(conversations_stats.keys()):
                    entity_count = conversations_stats[count]
                    f.write(f"  {count} 个 conversations: {entity_count} 个实体\n")
                f.write("\n")
            
            f.write("="*80 + "\n")
            f.write("【按实体类型统计】\n")
            f.write("="*80 + "\n\n")
            
            for entity_type, stats in sorted_types:
                total = stats['total']
                with_conv = stats['with_conversations']
                without_conv = stats['without_conversations']
                
                f.write(f"【{entity_type}】\n")
                f.write(f"  总数: {total}\n")
                f.write(f"  有 conversations: {with_conv} ({with_conv/total*100:.1f}%)\n")
                f.write(f"  无 conversations: {without_conv} ({without_conv/total*100:.1f}%)\n")
                
                if stats['conversations_distribution']:
                    f.write(f"  Conversations 数量分布:\n")
                    for conv_count in sorted(stats['conversations_distribution'].keys()):
                        count = stats['conversations_distribution'][conv_count]
                        f.write(f"    {conv_count} 个: {count} 个实体\n")
                f.write("\n")
        
        print(f"✅ 文本报告已保存到 {report_file}")
        
    except Exception as e:
        print(f"❌ 查询失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔍 开始查询 esone.qiu-graph-entities 的 conversations 数据\n")
    query_conversations()
    print("\n✨ 查询完成!")

