"""
migrate_chroma_v1_to_v3.py

功能：
- 从 Chroma v1 数据库读取所有 collection 数据
- 写入 Chroma v3 数据库
- 完全本地操作，不依赖 LangChain 或 OpenAIEmbeddings
"""

import chromadb
from pathlib import Path

# ---------------- 配置 ----------------
# v1 数据库路径（旧数据库）
v1_folder = Path("./chroma-data-v1")
# v3 数据目录（新的）
v3_folder = Path("./chroma-data")

# 如果 v3 数据库不存在，会自动创建
v3_folder.mkdir(parents=True, exist_ok=True)

# ---------------- 已迁移 collection 列表 ----------------
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
    "default-user-messages",
    # "nicole.zheng-messages",
    # "julie.wang-messages",
    # "esone.qiu-projects",
    "esone.qiu-messages",
    # "sophia.lin-messages",
    # 如果已经迁移过其他 collection，也可以继续加在这里
]

# ---------------- 连接 v1 数据库 ----------------
print("连接 v1 数据库...")
client_v1 = chromadb.PersistentClient(path=str(v1_folder))
# 获取 v1 所有 collection 名
v1_collections = client_v1.list_collections()
if not v1_collections:
    raise RuntimeError(f"未在 {v1_folder} 中找到任何 collection")
print(f"找到 v1 collections: {[c.name for c in v1_collections]}")

# ---------------- 连接 v3 数据库 ----------------
print("连接 v3 数据库...")
client_v3 = chromadb.PersistentClient(path=str(v3_folder))

# ---------------- 遍历迁移 ----------------
for coll in v1_collections:
    name = coll.name
    if name in migrated_collections:
        print(f"⏭️ 已迁移过 collection {name}，跳过")
        continue
    print(f"迁移 collection: {name}")

    # v1 collection
    col_v1 = client_v1.get_collection(name)
    # 获取全部数据，去掉 ids
    data = col_v1.get(include=["documents", "metadatas", "embeddings"])
    print(f"读取到 {len(data['ids'])} 条数据")
    if len(data["ids"]) == 0:
        print(f"⚠️ collection {name} 数据为空，跳过")
        continue

    # v3 collection
    col_v3 = client_v3.get_or_create_collection(name=name)

    # 添加数据到 v3
    col_v3.add(
        ids=data["ids"],
        embeddings=data["embeddings"],
        documents=data["documents"],
        metadatas=data["metadatas"],
    )

    print(f"✅ collection {name} 迁移完成，条数: {len(data['ids'])}")

# ---------------- 保存 ----------------
# client_v3.persist()  # v3 不需要手动 persist
print("🎉 所有 collection 已迁移到 v3 数据库！")
