#!/usr/bin/env python3
"""
message_manager.py - ChromaDB 消息管理工具

功能：
- 通过 messageId 或语义搜索查找消息
- 预览消息详情
- 删除消息
- 编辑消息内容和元数据
"""

import chromadb
import argparse
import json
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

# 导入语义搜索模块（可选依赖）
sys.path.append(str(Path(__file__).parent))
try:
    from semantic_search import SemanticSearcher
    SEMANTIC_SEARCH_AVAILABLE = True
except ImportError as e:
    SEMANTIC_SEARCH_AVAILABLE = False
    SEMANTIC_SEARCH_ERROR = str(e)
    print(f"⚠️ 警告: 语义搜索功能不可用 ({e})")
    print("提示: 安装依赖以启用语义搜索: pip install sentence-transformers")
    print("通过 ID 查找功能仍然可用。\n")

# ChromaDB 服务配置
DEFAULT_CHROMA_HOST = "10.32.56.212"
DEFAULT_CHROMA_PORT = 8000


class MessageManager:
    """消息管理器"""
    
    def __init__(self, host: str = DEFAULT_CHROMA_HOST, port: int = DEFAULT_CHROMA_PORT):
        """初始化管理器"""
        self.host = host
        self.port = port
        self.client = None
        self.searcher = None
        
        # 如果语义搜索可用，创建搜索器
        if SEMANTIC_SEARCH_AVAILABLE:
            self.searcher = SemanticSearcher(host=host, port=port)
        
    def connect(self) -> bool:
        """连接到 ChromaDB 服务"""
        try:
            print(f"🔌 正在连接 ChromaDB ({self.host}:{self.port})...")
            self.client = chromadb.HttpClient(host=self.host, port=self.port)
            
            # 测试连接
            collections = self.client.list_collections()
            print(f"✅ 连接成功！发现 {len(collections)} 个集合")
            
            # 同时连接语义搜索器（如果可用）
            if self.searcher:
                self.searcher.connect()
            return True
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            print("请确保 ChromaDB 服务正在运行：docker-compose up -d")
            return False
    
    def get_message_by_id(
        self,
        message_id: str,
        username: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        通过 messageId 获取消息
        
        Args:
            message_id: 消息ID
            username: 用户名（可选，如果不提供则搜索所有消息集合）
            
        Returns:
            消息数据字典，如果未找到则返回 None
        """
        if not self.client:
            raise Exception("未连接到 ChromaDB，请先调用 connect()")
        
        # 确定要搜索的集合
        if username:
            collections = [f"{username}-messages"]
        else:
            # 获取所有消息集合
            all_collections = self.client.list_collections()
            collections = [c.name for c in all_collections if c.name.endswith('-messages')]
        
        print(f"🔍 在 {len(collections)} 个集合中搜索消息 ID: {message_id}")
        
        for coll_name in collections:
            try:
                collection = self.client.get_collection(name=coll_name)
                result = collection.get(
                    ids=[message_id],
                    include=['documents', 'metadatas', 'embeddings']
                )
                
                # 检查是否找到结果 - 使用 len() 而不是直接判断数组真值
                if result.get('ids') is not None and len(result['ids']) > 0:
                    # 安全地提取数据，避免数组比较问题
                    documents = result.get('documents')
                    metadatas = result.get('metadatas')
                    embeddings = result.get('embeddings')
                    
                    message = {
                        'collection': coll_name,
                        'id': result['ids'][0],
                        'document': documents[0] if documents is not None and len(documents) > 0 else '',
                        'metadata': metadatas[0] if metadatas is not None and len(metadatas) > 0 else {},
                        'embedding': embeddings[0] if embeddings is not None and len(embeddings) > 0 else None
                    }
                    print(f"✅ 在集合 {coll_name} 中找到消息")
                    return message
            except Exception as e:
                print(f"  ⚠️ 搜索集合 {coll_name} 时出错: {e}")
                continue
        
        print(f"❌ 未找到消息 ID: {message_id}")
        return None
    
    def search_messages(
        self,
        query: str,
        username: Optional[str] = None,
        n_results: int = 10,
        filter_metadata: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        通过语义搜索查找消息
        
        Args:
            query: 搜索查询
            username: 用户名（可选）
            n_results: 返回结果数量
            filter_metadata: 元数据过滤条件
            
        Returns:
            消息列表
        """
        if not self.searcher:
            print("❌ 语义搜索功能不可用")
            print("提示: 安装依赖以启用: pip install sentence-transformers")
            return []
        
        print(f"🔍 语义搜索: '{query}'")
        
        # 使用语义搜索器搜索
        results = self.searcher.search(
            query=query,
            collection_type='messages',
            username=username,
            n_results=n_results,
            filter_metadata=filter_metadata
        )
        
        # 转换结果格式
        messages = []
        for coll_name, items in results.items():
            for item in items:
                message = {
                    'collection': coll_name,
                    'id': item['id'],
                    'document': item['document'],
                    'metadata': item['metadata'],
                    'relevance': item['relevance']
                }
                messages.append(message)
        
        # 按相关度排序
        messages.sort(key=lambda x: x['relevance'], reverse=True)
        
        return messages
    
    def display_message(self, message: Dict[str, Any], index: Optional[int] = None):
        """显示消息详情"""
        metadata = message.get('metadata', {})
        
        lines = [
            f"\n{'='*80}",
        ]
        
        if index is not None:
            lines.append(f"消息 #{index}")
        else:
            lines.append(f"消息详情")
        
        if 'relevance' in message:
            lines.append(f"相关度: {message['relevance']:.2%}")
        
        lines.append(f"{'='*80}")
        lines.append(f"集合: {message['collection']}")
        lines.append(f"ID: {message['id']}")
        
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
        document = message.get('document', '')
        if document:
            lines.append(f"\n💬 内容:")
            # 显示完整内容
            for line in document.split('\n'):
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
        
        # 其他元数据
        if metadata.get('sentiment'):
            lines.append(f"\n情感: {metadata['sentiment']}")
        if metadata.get('priority'):
            lines.append(f"优先级: {metadata['priority']}")
        
        print('\n'.join(lines))
    
    def delete_message(
        self,
        message: Dict[str, Any],
        confirm: bool = True
    ) -> bool:
        """
        删除消息
        
        Args:
            message: 消息数据
            confirm: 是否需要确认
            
        Returns:
            是否删除成功
        """
        if not self.client:
            raise Exception("未连接到 ChromaDB")
        
        if confirm:
            print(f"\n⚠️ 确认删除以下消息？")
            self.display_message(message)
            response = input("\n输入 'yes' 或 'y' 确认删除: ").strip().lower()
            if response not in ['yes', 'y']:
                print("❌ 取消删除")
                return False
        
        try:
            collection = self.client.get_collection(name=message['collection'])
            collection.delete(ids=[message['id']])
            print(f"✅ 消息已删除: {message['id']}")
            return True
        except Exception as e:
            print(f"❌ 删除失败: {e}")
            return False
    
    def update_message(
        self,
        message: Dict[str, Any],
        new_document: Optional[str] = None,
        new_metadata: Optional[Dict[str, Any]] = None,
        confirm: bool = True
    ) -> bool:
        """
        更新消息
        
        Args:
            message: 消息数据
            new_document: 新的文档内容（可选）
            new_metadata: 新的元数据（可选）
            confirm: 是否需要确认
            
        Returns:
            是否更新成功
        """
        if not self.client:
            raise Exception("未连接到 ChromaDB")
        
        if not new_document and not new_metadata:
            print("❌ 必须提供 new_document 或 new_metadata")
            return False
        
        if confirm:
            print(f"\n⚠️ 确认更新以下消息？")
            self.display_message(message)
            
            if new_document:
                print(f"\n📝 新内容:")
                print(f"  {new_document}")
            
            if new_metadata:
                print(f"\n🔧 新元数据:")
                print(f"  {json.dumps(new_metadata, ensure_ascii=False, indent=2)}")
            
            response = input("\n输入 'yes' 或 'y' 确认更新: ").strip().lower()
            if response not in ['yes', 'y']:
                print("❌ 取消更新")
                return False
        
        try:
            collection = self.client.get_collection(name=message['collection'])
            
            # 准备更新参数
            update_params = {'ids': [message['id']]}
            
            if new_document:
                update_params['documents'] = [new_document]
            
            if new_metadata:
                # 合并现有元数据和新元数据
                merged_metadata = {**message.get('metadata', {}), **new_metadata}
                update_params['metadatas'] = [merged_metadata]
            
            # 如果更新了文档内容，需要重新生成嵌入向量
            if new_document:
                if self.searcher:
                    # 使用语义搜索器生成嵌入
                    embedding = self.searcher._get_embedding(new_document)
                    update_params['embeddings'] = [embedding.tolist()]
                else:
                    print("⚠️ 警告: 无法生成新的嵌入向量（语义搜索不可用）")
                    print("消息内容将被更新，但语义搜索可能无法找到此消息")
            
            collection.update(**update_params)
            print(f"✅ 消息已更新: {message['id']}")
            return True
        except Exception as e:
            print(f"❌ 更新失败: {e}")
            return False
    
    def batch_delete_messages(
        self,
        messages: List[Dict[str, Any]],
        confirm: bool = True
    ) -> int:
        """
        批量删除消息
        
        Args:
            messages: 消息列表
            confirm: 是否需要确认
            
        Returns:
            成功删除的消息数量
        """
        if not messages:
            print("❌ 没有要删除的消息")
            return 0
        
        if confirm:
            print(f"\n⚠️ 确认删除以下 {len(messages)} 条消息？")
            for i, message in enumerate(messages, 1):
                self.display_message(message, index=i)
            
            response = input(f"\n输入 'yes' 或 'y' 确认删除所有 {len(messages)} 条消息: ").strip().lower()
            if response not in ['yes', 'y']:
                print("❌ 取消删除")
                return 0
        
        success_count = 0
        for message in messages:
            if self.delete_message(message, confirm=False):
                success_count += 1
        
        print(f"\n✅ 成功删除 {success_count}/{len(messages)} 条消息")
        return success_count


def interactive_mode(manager: MessageManager, username: Optional[str] = None):
    """交互式模式"""
    print("\n" + "="*80)
    print("📱 消息管理工具 - 交互模式")
    print("="*80)
    
    # 检查语义搜索是否可用
    if not SEMANTIC_SEARCH_AVAILABLE:
        print("\n⚠️ 注意: 语义搜索功能不可用（缺少依赖）")
        print("只能使用通过 ID 查找功能")
        print("安装依赖以启用语义搜索: pip install sentence-transformers\n")
    
    while True:
        print("\n请选择操作：")
        print("  1. 通过 ID 查找消息")
        if SEMANTIC_SEARCH_AVAILABLE:
            print("  2. 语义搜索消息")
        else:
            print("  2. 语义搜索消息 (不可用 - 缺少依赖)")
        print("  3. 退出")
        
        choice = input("\n请输入选项 (1/2/3): ").strip()
        
        if choice == '1':
            # 通过 ID 查找
            message_id = input("请输入消息 ID: ").strip()
            if not message_id:
                print("❌ 消息 ID 不能为空")
                continue
            
            message = manager.get_message_by_id(message_id, username)
            if not message:
                continue
            
            manager.display_message(message)
            
            # 操作菜单
            while True:
                print("\n请选择操作：")
                print("  1. 删除此消息")
                print("  2. 编辑此消息")
                print("  3. 返回")
                
                action = input("\n请输入选项 (1/2/3): ").strip()
                
                if action == '1':
                    manager.delete_message(message)
                    break
                elif action == '2':
                    print("\n编辑消息内容（留空则不修改）：")
                    new_content = input().strip()
                    
                    print("\n是否修改元数据？(y/n): ")
                    if input().strip().lower() == 'y':
                        print("请输入新的元数据 (JSON 格式)：")
                        try:
                            new_metadata = json.loads(input().strip())
                            manager.update_message(
                                message,
                                new_document=new_content if new_content else None,
                                new_metadata=new_metadata
                            )
                        except json.JSONDecodeError:
                            print("❌ JSON 格式错误")
                    else:
                        if new_content:
                            manager.update_message(message, new_document=new_content)
                    break
                elif action == '3':
                    break
                else:
                    print("❌ 无效选项")
        
        elif choice == '2':
            # 语义搜索
            if not SEMANTIC_SEARCH_AVAILABLE:
                print("❌ 语义搜索功能不可用，请安装依赖: pip install sentence-transformers")
                continue
            
            query = input("请输入搜索查询: ").strip()
            if not query:
                print("❌ 查询不能为空")
                continue
            
            n_results = input("返回结果数量 (默认 10): ").strip()
            n_results = int(n_results) if n_results.isdigit() else 10
            
            messages = manager.search_messages(query, username, n_results)
            
            if not messages:
                print("❌ 未找到匹配的消息")
                continue
            
            print(f"\n✅ 找到 {len(messages)} 条消息")
            for i, message in enumerate(messages, 1):
                manager.display_message(message, index=i)
            
            # 操作菜单
            while True:
                print("\n请选择操作：")
                print("  1. 删除单条消息")
                print("  2. 批量删除所有搜索结果")
                print("  3. 编辑单条消息")
                print("  4. 返回")
                
                action = input("\n请输入选项 (1/2/3/4): ").strip()
                
                if action == '1':
                    index = input(f"请输入要删除的消息编号 (1-{len(messages)}): ").strip()
                    if index.isdigit() and 1 <= int(index) <= len(messages):
                        manager.delete_message(messages[int(index) - 1])
                    else:
                        print("❌ 无效编号")
                elif action == '2':
                    manager.batch_delete_messages(messages)
                    break
                elif action == '3':
                    index = input(f"请输入要编辑的消息编号 (1-{len(messages)}): ").strip()
                    if index.isdigit() and 1 <= int(index) <= len(messages):
                        message = messages[int(index) - 1]
                        print("\n编辑消息内容（留空则不修改）：")
                        new_content = input().strip()
                        
                        print("\n是否修改元数据？(y/n): ")
                        if input().strip().lower() == 'y':
                            print("请输入新的元数据 (JSON 格式)：")
                            try:
                                new_metadata = json.loads(input().strip())
                                manager.update_message(
                                    message,
                                    new_document=new_content if new_content else None,
                                    new_metadata=new_metadata
                                )
                            except json.JSONDecodeError:
                                print("❌ JSON 格式错误")
                        else:
                            if new_content:
                                manager.update_message(message, new_document=new_content)
                    else:
                        print("❌ 无效编号")
                elif action == '4':
                    break
                else:
                    print("❌ 无效选项")
        
        elif choice == '3':
            print("\n👋 再见！")
            break
        
        else:
            print("❌ 无效选项")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='ChromaDB 消息管理工具 - 查找、删除、编辑消息',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:

1. 交互式模式（推荐）：
  %(prog)s --interactive
  %(prog)s -i --user esone.qiu

2. 通过 ID 查找消息：
  %(prog)s --id MESSAGE_ID
  %(prog)s --id MESSAGE_ID --user esone.qiu

3. 语义搜索并删除：
  %(prog)s --search "要删除的内容" --delete
  %(prog)s --search "项目讨论" --user esone.qiu --delete

4. 语义搜索并编辑：
  %(prog)s --search "要编辑的内容" --edit
  %(prog)s --id MESSAGE_ID --edit --content "新内容"

5. 批量删除：
  %(prog)s --search "垃圾消息" --batch-delete --limit 100
        """
    )
    
    # 查找参数
    parser.add_argument('-i', '--interactive', action='store_true', help='交互式模式（推荐）')
    parser.add_argument('--id', help='消息 ID')
    parser.add_argument('--search', help='语义搜索查询')
    parser.add_argument('-u', '--user', help='用户名 (例如: esone.qiu)')
    parser.add_argument('-n', '--limit', type=int, default=10, help='搜索结果数量 (默认: 10)')
    parser.add_argument('-w', '--where', type=str, help='元数据过滤条件 (JSON格式)')
    
    # 操作参数
    parser.add_argument('--delete', action='store_true', help='删除找到的消息')
    parser.add_argument('--batch-delete', action='store_true', help='批量删除所有搜索结果')
    parser.add_argument('--edit', action='store_true', help='编辑消息')
    parser.add_argument('--content', help='新的消息内容（用于编辑）')
    parser.add_argument('--metadata', help='新的元数据 (JSON格式，用于编辑)')
    parser.add_argument('--no-confirm', action='store_true', help='跳过确认提示（危险！）')
    
    # 连接参数
    parser.add_argument('--host', default=DEFAULT_CHROMA_HOST, help=f'ChromaDB 主机 (默认: {DEFAULT_CHROMA_HOST})')
    parser.add_argument('--port', type=int, default=DEFAULT_CHROMA_PORT, help=f'ChromaDB 端口 (默认: {DEFAULT_CHROMA_PORT})')
    
    args = parser.parse_args()
    
    # 创建管理器
    manager = MessageManager(host=args.host, port=args.port)
    
    # 连接到服务
    if not manager.connect():
        sys.exit(1)
    
    # 交互式模式
    if args.interactive:
        interactive_mode(manager, args.user)
        sys.exit(0)
    
    # 命令行模式
    if not args.id and not args.search:
        print("❌ 请提供 --id 或 --search 参数，或使用 --interactive 进入交互模式")
        parser.print_help()
        sys.exit(1)
    
    # 检查语义搜索依赖
    if args.search and not SEMANTIC_SEARCH_AVAILABLE:
        print("❌ 语义搜索功能不可用")
        print(f"错误: {SEMANTIC_SEARCH_ERROR}")
        print("\n请安装依赖:")
        print("  pip install sentence-transformers")
        print("\n或使用通过 ID 查找:")
        print("  python tools/message_manager.py --id MESSAGE_ID")
        sys.exit(1)
    
    try:
        messages = []
        
        # 通过 ID 查找
        if args.id:
            message = manager.get_message_by_id(args.id, args.user)
            if message:
                messages = [message]
        
        # 语义搜索
        elif args.search:
            filter_metadata = None
            if args.where:
                try:
                    filter_metadata = json.loads(args.where)
                except json.JSONDecodeError as e:
                    print(f"❌ where 参数 JSON 格式错误: {e}")
                    sys.exit(1)
            
            messages = manager.search_messages(
                args.search,
                args.user,
                args.limit,
                filter_metadata
            )
        
        if not messages:
            print("❌ 未找到消息")
            sys.exit(1)
        
        # 显示消息
        print(f"\n✅ 找到 {len(messages)} 条消息")
        for i, message in enumerate(messages, 1):
            manager.display_message(message, index=i)
        
        # 执行操作
        confirm = not args.no_confirm
        
        if args.batch_delete:
            manager.batch_delete_messages(messages, confirm=confirm)
        elif args.delete:
            if len(messages) == 1:
                manager.delete_message(messages[0], confirm=confirm)
            else:
                print(f"\n⚠️ 找到 {len(messages)} 条消息，请使用 --batch-delete 批量删除")
        elif args.edit:
            if len(messages) != 1:
                print(f"\n❌ 编辑操作只能作用于单条消息，但找到了 {len(messages)} 条")
                sys.exit(1)
            
            new_content = args.content
            new_metadata = None
            if args.metadata:
                try:
                    new_metadata = json.loads(args.metadata)
                except json.JSONDecodeError as e:
                    print(f"❌ metadata 参数 JSON 格式错误: {e}")
                    sys.exit(1)
            
            manager.update_message(messages[0], new_content, new_metadata, confirm=confirm)
    
    except Exception as e:
        print(f"\n❌ 操作失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
