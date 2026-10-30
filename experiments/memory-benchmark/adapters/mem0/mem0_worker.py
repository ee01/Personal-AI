#!/usr/bin/env python3
"""JSON-lines RPC worker for Mem0 OSS (harness scheme C). One request per line on stdin."""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any

os.environ.setdefault("MEM0_TELEMETRY", "false")

memory = None


def mem0_config(qdrant_path: str, collection: str) -> dict[str, Any]:
    base_url = os.environ.get("OPENAI_API_BASE_URL", "https://openrouter.ai/api/v1")
    api_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("OPENROUTER_API_KEY", "")
    model = os.environ.get("OPENAI_MODEL", "z-ai/glm-5.3-flash")
    return {
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": collection,
                "path": qdrant_path,
                "embedding_model_dims": 1024,
            },
        },
        "llm": {
            "provider": "openai",
            "config": {
                "model": model,
                "temperature": 0,
                "openai_base_url": base_url,
                "api_key": api_key,
            },
        },
        "embedder": {
            "provider": "ollama",
            "config": {
                "model": "bge-m3",
                "embedding_dims": 1024,
                "ollama_base_url": os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
            },
        },
    }


def ensure_memory(qdrant_path: str, collection: str):
    global memory
    if memory is not None:
        return memory
    from mem0 import Memory

    Path(qdrant_path).mkdir(parents=True, exist_ok=True)
    memory = Memory.from_config(mem0_config(qdrant_path, collection))
    return memory


def respond(req_id: Any, ok: bool, result: Any = None, error: str | None = None) -> None:
    payload = {"id": req_id, "ok": ok}
    if ok:
        payload["result"] = result
    else:
        payload["error"] = error
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle(req: dict[str, Any]) -> None:
    req_id = req.get("id")
    cmd = req.get("cmd")
    try:
        if cmd == "ping":
            respond(req_id, True, {"pong": True})
            return
        if cmd == "init":
            qdrant_path = req["qdrant_path"]
            collection = req["collection"]
            ensure_memory(qdrant_path, collection)
            respond(req_id, True, {"ready": True})
            return
        m = ensure_memory(req.get("qdrant_path", os.environ["MEM0_QDRANT_PATH"]), req.get("collection", os.environ["MEM0_COLLECTION"]))

        if cmd == "add":
            user_id = req["user_id"]
            text = req["text"]
            metadata = req.get("metadata") or {}
            infer = req.get("infer", True)
            messages = [{"role": "user", "content": text}]
            added = m.add(messages, user_id=user_id, metadata=metadata, infer=infer)
            respond(req_id, True, added)
            return
        if cmd == "search":
            user_id = req["user_id"]
            query = req["query"]
            limit = int(req.get("limit", 5))
            hits = m.search(query, filters={"user_id": user_id}, limit=limit)
            respond(req_id, True, hits)
            return
        if cmd == "delete":
            memory_id = req["memory_id"]
            m.delete(memory_id)
            respond(req_id, True, {"deleted": memory_id})
            return
        if cmd == "delete_all":
            user_id = req["user_id"]
            m.delete_all(user_id=user_id)
            respond(req_id, True, {"user_id": user_id})
            return
        if cmd == "get_all":
            user_id = req["user_id"]
            items = m.get_all(filters={"user_id": user_id})
            respond(req_id, True, items)
            return
        if cmd == "shutdown":
            respond(req_id, True, {"shutdown": True})
            return
        respond(req_id, False, error=f"unknown_cmd:{cmd}")
    except Exception as exc:
        respond(req_id, False, error=f"{type(exc).__name__}:{exc}\n{traceback.format_exc()}")


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            respond(None, False, error=f"json:{exc}")
            continue
        handle(req)
        if req.get("cmd") == "shutdown":
            break


if __name__ == "__main__":
    main()
