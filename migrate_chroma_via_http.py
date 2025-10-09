#!/usr/bin/env python3
"""
migrate_chroma_via_http.py

功能：
- 从本地 Chroma v1 数据库读取所有 collection 数据
- 通过 HTTP API 写入运行中的 Chroma 服务
- 确保迁移的数据能被应用程序正确访问
"""

import chromadb
from pathlib import Path
import time

# ---------------- 配置 ----------------
# v1 数据库路径（旧数据库）
v1_folder = Path("./chroma-data-v1")
# Chroma HTTP 服务地址
chroma_host = "localhost"
chroma_port = "8000"

# 已迁移 collection 列表（可以根据需要调整）
migrated_collections = [
    # "patricia.li-messages",
    # "default-user-userprofiles", 
    # "default-user-documents",
    # "esone.qiu-webpages",
    # "esone.qiu-graph-entities",
    # "esone.qiu-documents",
    # "default-user-projects",
    # "messages",
    # "amy.huang-messages",
    # "jen.jiang-messages",
    # "zong.zheng-messages",
    # "esone.qiu-userprofiles",
    # "zora.zheng-messages",
    # "default-user-graph-entities",
    # "vanessa.zheng-messages",
    # "danny.zhou-messages",
    # "radar-poc-messages",
    # "default-user-webpages",
    # "esone.qiu-memories",
    # "nicole.zheng-messages",
    # "julie.wang-messages",
    # "esone.qiu-projects",
    # "sophia.lin-messages",
    # 暂时移除 esone.qiu-messages 以便重新迁移
    # "esone.qiu-messages",
]

def check_chroma_service():
    """检查 Chroma 服务是否运行"""
    try:
        client = chromadb.HttpClient(host=chroma_host, port=chroma_port)
        collections = client.list_collections()
        print(f"✅ Chroma 服务运行正常，当前有 {len(collections)} 个集合")
        return True
    except Exception as e:
        print(f"❌ Chroma 服务连接失败: {e}")
        print("请确保 Chroma 服务正在运行：docker-compose up -d")
        return False

def migrate_data():
    """执行数据迁移"""
    # 检查服务状态
    if not check_chroma_service():
        return False
    
    # 批量操作选项
    print("\n🔧 批量操作设置:")
    print("  1. 逐个确认 (i/interactive) - 对每个集合单独询问操作")
    print("  2. 全部追加 (a/append-all) - 对所有集合都追加数据")
    print("  3. 全部清空重导 (c/clear-all) - 对所有集合都清空重新导入")
    print("  4. 全部跳过 (s/skip-all) - 跳过所有已存在的集合")
    batch_mode = input("请选择批量操作模式 (i/a/c/s): ").strip().lower()
    
    if batch_mode in ['a', 'append-all']:
        default_action = 'append'
        print("📝 批量模式：所有集合都将追加数据")
    elif batch_mode in ['c', 'clear-all']:
        default_action = 'clear'
        print("🗑️ 批量模式：所有集合都将清空重新导入")
    elif batch_mode in ['s', 'skip-all']:
        default_action = 'skip'
        print("⏭️ 批量模式：跳过所有已存在的集合")
    else:
        default_action = None
        print("🤝 交互模式：将逐个询问每个集合的操作")
    
    print("=" * 50)
    
    # ---------------- 连接 v1 数据库 ----------------
    print("连接 v1 数据库...")
    try:
        client_v1 = chromadb.PersistentClient(path=str(v1_folder))
        v1_collections = client_v1.list_collections()
        if not v1_collections:
            raise RuntimeError(f"未在 {v1_folder} 中找到任何 collection")
        print(f"找到 v1 collections: {[c.name for c in v1_collections]}")
    except Exception as e:
        print(f"❌ 连接 v1 数据库失败: {e}")
        return False

    # ---------------- 连接 HTTP 客户端 ----------------
    print("连接 Chroma HTTP 服务...")
    try:
        client_http = chromadb.HttpClient(host=chroma_host, port=8000)
        print("✅ HTTP 客户端连接成功")
    except Exception as e:
        print(f"❌ HTTP 客户端连接失败: {e}")
        return False

    # ---------------- 遍历迁移 ----------------
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for coll in v1_collections:
        name = coll.name
        if name in migrated_collections:
            print(f"⏭️ 已迁移过 collection {name}，跳过")
            skip_count += 1
            continue
            
        print(f"\n🔄 开始迁移 collection: {name}")
        
        try:
            # 从 v1 读取数据
            col_v1 = client_v1.get_collection(name)
            data = col_v1.get(include=["documents", "metadatas", "embeddings"])
            print(f"📖 读取到 {len(data['ids'])} 条数据")
            
            if len(data["ids"]) == 0:
                print(f"⚠️ collection {name} 数据为空，跳过")
                skip_count += 1
                continue

            # 创建或获取 HTTP collection
            try:
                # 先尝试获取现有集合
                col_http = client_http.get_collection(name=name)
                existing_count = col_http.count()
                print(f"📊 目标集合已存在，当前有 {existing_count} 条数据")
                
                if existing_count > 0:
                    # 根据批量模式决定操作
                    if default_action == 'append':
                        response = 'a'
                        print("📝 批量模式：追加数据到现有集合")
                    elif default_action == 'clear':
                        response = 'c'
                        print("🗑️ 批量模式：清空重新导入")
                    elif default_action == 'skip':
                        response = 's'
                        print("⏭️ 批量模式：跳过此集合")
                    else:
                        # 交互模式
                        print(f"⚠️ 目标集合 {name} 已有数据，请选择操作：")
                        print("  1. 追加数据 (a/append) - 将新数据添加到现有数据中")
                        print("  2. 清空重新导入 (c/clear) - 删除现有数据，重新导入")
                        print("  3. 跳过此集合 (s/skip) - 不做任何操作")
                        response = input("请选择 (a/c/s): ").strip().lower()
                    
                    if response in ['a', 'append']:
                        print("📝 将追加数据到现有集合")
                        # 获取现有数据的 ID 列表，避免重复添加
                        existing_data = col_http.get(include=["ids"])
                        existing_ids = set(existing_data["ids"])
                        print(f"🔍 检测到现有 {len(existing_ids)} 条数据，将过滤重复项")
                        
                        # 过滤掉已存在的数据
                        new_indices = []
                        for i, doc_id in enumerate(data["ids"]):
                            if doc_id not in existing_ids:
                                new_indices.append(i)
                        
                        if not new_indices:
                            print("ℹ️ 没有新数据需要添加，所有数据都已存在")
                            skip_count += 1
                            continue
                        
                        # 只保留新数据
                        data["ids"] = [data["ids"][i] for i in new_indices]
                        if data["documents"]:
                            data["documents"] = [data["documents"][i] for i in new_indices]
                        if data["metadatas"]:
                            data["metadatas"] = [data["metadatas"][i] for i in new_indices]
                        if data["embeddings"] is not None:
                            data["embeddings"] = data["embeddings"][new_indices]
                        
                        print(f"✅ 过滤后有 {len(data['ids'])} 条新数据需要添加")
                    elif response in ['c', 'clear']:
                        # 删除现有集合并重新创建
                        client_http.delete_collection(name=name)
                        col_http = client_http.create_collection(name=name)
                        print("🗑️ 已清空现有数据")
                    else:  # 's', 'skip' 或其他默认跳过
                        print("⏭️ 跳过此集合")
                        skip_count += 1
                        continue
                        
            except Exception as e:
                # 集合不存在，尝试创建新的
                try:
                    col_http = client_http.create_collection(name=name)
                    print("✨ 创建新集合")
                except Exception as create_error:
                    if "already exists" in str(create_error).lower():
                        # 集合已存在，尝试获取现有集合
                        try:
                            col_http = client_http.get_collection(name=name)
                            print("📊 获取到现有集合")
                        except Exception as get_error:
                            print(f"❌ 无法获取集合 {name}: {get_error}")
                            error_count += 1
                            continue
                    else:
                        print(f"❌ 创建集合 {name} 失败: {create_error}")
                        error_count += 1
                        continue

            # 批量添加数据（如果数据量大，分批处理）
            batch_size = 100
            total_items = len(data["ids"])
            
            for i in range(0, total_items, batch_size):
                end_idx = min(i + batch_size, total_items)
                batch_ids = data["ids"][i:end_idx]
                batch_documents = data["documents"][i:end_idx] if data["documents"] is not None and len(data["documents"]) > 0 else None
                batch_metadatas = data["metadatas"][i:end_idx] if data["metadatas"] is not None and len(data["metadatas"]) > 0 else None
                batch_embeddings = data["embeddings"][i:end_idx] if data["embeddings"] is not None and len(data["embeddings"]) > 0 else None
                
                print(f"📤 上传批次 {i//batch_size + 1}/{(total_items + batch_size - 1)//batch_size} ({len(batch_ids)} 条)")
                
                # 构建参数字典，只包含非 None 的参数
                add_params = {"ids": batch_ids}
                if batch_documents is not None:
                    add_params["documents"] = batch_documents
                if batch_metadatas is not None:
                    add_params["metadatas"] = batch_metadatas
                if batch_embeddings is not None:
                    # 将 numpy 数组转换为列表
                    if hasattr(batch_embeddings, 'tolist'):
                        add_params["embeddings"] = batch_embeddings.tolist()
                    else:
                        add_params["embeddings"] = batch_embeddings
                
                col_http.add(**add_params)
                
                # 短暂延迟，避免过快请求
                time.sleep(0.1)

            print(f"✅ collection {name} 迁移完成，共 {total_items} 条数据")
            success_count += 1
            
        except Exception as e:
            print(f"❌ 迁移 collection {name} 失败: {e}")
            error_count += 1
            continue

    # ---------------- 迁移总结 ----------------
    print(f"\n🎉 迁移完成！")
    print(f"✅ 成功: {success_count} 个集合")
    print(f"⏭️ 跳过: {skip_count} 个集合")
    print(f"❌ 失败: {error_count} 个集合")
    
    # 验证迁移结果
    print(f"\n🔍 验证迁移结果...")
    try:
        final_collections = client_http.list_collections()
        print(f"HTTP 服务中现有 {len(final_collections)} 个集合:")
        for i, coll in enumerate(final_collections, 1):
            try:
                count = client_http.get_collection(coll.name).count()
                print(f"  {i}. {coll.name}: {count} 条数据")
            except Exception as e:
                print(f"  {i}. {coll.name}: 无法获取数据条数 ({e})")
    except Exception as e:
        print(f"❌ 验证失败: {e}")
    
    return success_count > 0

if __name__ == "__main__":
    print("🚀 开始通过 HTTP API 迁移 Chroma 数据...")
    print("=" * 50)
    
    success = migrate_data()
    
    if success:
        print("\n✅ 迁移成功！现在应用程序应该能够访问到迁移的数据了。")
    else:
        print("\n❌ 迁移失败，请检查错误信息并重试。")
