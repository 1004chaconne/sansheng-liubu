#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""wechat_reader_mcp —— 微信「轻量采集端」：不启动副驾界面，直接只读本机微信。

为什么存在：副驾的界面是给业务员做情感/画像分析用的，单证/操作岗用不上；
但"读微信"这件事本身只需要 native-reader 那层（SQLCipher 解密 + 读库）。

实现要点（踩过的坑，别改回去）：
1. 必须用副驾自带的运行时 python 启动（site-packages 里有 wechatauto）。
2. sys.path 要加副驾的 bridge/ 与 native-reader/。
3. 独立进程里 Restart Manager 查文件占用恒为空 → 手工构造 ActiveSelection
   并 monkeypatch live_source.active_account_snapshot（见 _patch_locator）。
4. 首次读取必然"账号未就绪"（后台密钥扫描 1.4GB / 约 3 秒）→ 必须重试。
5. stdout 必须写 UTF-8 字节（Windows 默认 GBK，客户端按 UTF-8 解码会崩）。

分级（对应"原文不出本机"改成"分级上报"）：
  L1 默认 → read_messages(include_text=False)：只给每条前 20 字 + 统计
  L2 关键 → read_key_conversation()：给原文窗口，并写本地审计日志
只读：不注入、不改库、不发消息。
"""
import json
import os
import sys
import time
import datetime

# ---------- 1. 定位副驾读取层 ----------
BASE = os.environ.get("WECHATVIBE_BASE") or r"D:\VB-B机开发包\WechatVibe-transfer"
for rel in ("bridge", "native-reader"):
    p = os.path.join(BASE, rel)
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

AUDIT_FILE = os.environ.get("WECHAT_READER_AUDIT") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "audit.jsonl")

_src = None          # 长驻读取器：避免每次调用都重扫 1.4GB 内存
_last_error = ""


def _wechat_procs(psutil):
    out = []
    for p in psutil.process_iter(["pid", "name", "create_time"]):
        try:
            if (p.info.get("name") or "").lower() in ("weixin.exe", "wechat.exe"):
                out.append((p.info["pid"], p.info["create_time"]))
        except Exception:
            continue
    return tuple(sorted(out))


def _patch_locator():
    """跳过 Restart Manager 的文件占用判定：用「账号目录 + 微信进程」手工构造选择器。"""
    import psutil
    import live_source
    from wr import discovery
    from pathlib import Path

    accounts = discovery.discover_account_dirs()
    if not accounts:
        raise RuntimeError("没找到微信账号目录（微信是否登录过？）")
    # discover 返回的 path 指向 db_storage，ActiveSelection 要的是它的父目录
    account_dir = Path(accounts[0].path).resolve().parent
    procs = _wechat_procs(psutil)
    if not procs:
        raise RuntimeError("微信没在运行")
    sel = live_source.ActiveSelection(account_dir, procs)
    live_source.active_account_snapshot = lambda: sel
    return account_dir, procs


def _ensure_source():
    """首次/失效时重建读取器；首次读取自带重试（后台密钥扫描）。"""
    global _src, _last_error
    if _src is not None:
        return _src
    _patch_locator()
    from wechat_source import WeChatSource
    # 🔴 classifier 必须传：渲染消息时会调 self.classifier(...)，为 None 就 TypeError
    try:
        from chat_server import classify as _classify
    except Exception:
        def _classify(kind, content):
            return kind, content
    src = WeChatSource(classifier=_classify)
    last = None
    for attempt in range(1, 31):
        try:
            with src.request_scope():
                src.identity()
            _src = src
            return _src
        except Exception as exc:
            last = exc
            if attempt in (1, 10, 20, 30):
                time.sleep(1.2)
            else:
                time.sleep(0.6)
    _last_error = "%s: %s" % (type(last).__name__, last)
    raise RuntimeError("读取器未就绪（%s）" % _last_error)


def _audit(tool, user, detail):
    try:
        rec = {"at": datetime.datetime.now().isoformat(sep=" "), "tool": tool,
               "user": user, "detail": detail}
        with open(AUDIT_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception:
        pass


def _as_list(window):
    try:
        return list(window)
    except Exception:
        return []


def _as_dict(m):
    """消息可能是 dict，也可能是有属性的对象（MessageWindow 的元素形态随上游变化）。"""
    if isinstance(m, dict):
        return m
    out = {}
    for key in ("id", "text", "kind", "type", "time", "timestamp", "create_time", "created_at",
                "sender", "from", "sender_name", "senderId", "senderName", "side", "talker",
                "attaches", "is_self", "senderAvatar"):
        try:
            out[key] = getattr(m, key)
        except Exception:
            continue
    if not out:
        try:
            out = dict(m)
        except Exception:
            out = {"text": str(m)}
    return out


def _fmt_time(value):
    """微信时间戳是毫秒字符串，转成可读的本地时间。"""
    try:
        ms = int(value)
        return datetime.datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(value) if value is not None else None


MONEY_TOKENS = ("usd", "rmb", "cny", "¥", "元", "美金", "美金", "票", "单号", "订舱", "箱", "kg", "cbm", "方")


def _auto_limit(text, base):
    """含金额/单号/箱量的消息，L1 也要给足字数——截断掉的数字比不给更危险。"""
    low = text.lower()
    if any(tok in low for tok in MONEY_TOKENS):
        return max(base, 400)
    return base


def _msg_brief(m, text_limit=150):
    m = _as_dict(m)
    text = (m.get("text") or "")
    if not isinstance(text, str):
        text = str(text)
    # 群聊正文常带 "wxid://n" 前缀，去掉（发送人另有字段）
    sender_id = m.get("senderId") or m.get("sender")
    if sender_id and text.startswith(str(sender_id)):
        text = text[len(str(sender_id)):].lstrip(":：\n ")
    limit = _auto_limit(text, text_limit)
    truncated = len(text) > limit
    return {
        "id": m.get("id"),
        "at": _fmt_time(m.get("time") or m.get("timestamp") or m.get("create_time")),
        "sender": m.get("senderName") or m.get("sender_name") or m.get("sender") or m.get("from"),
        "senderId": sender_id,
        "self": (m.get("side") == "self") or (m.get("is_self") is True),
        "kind": m.get("kind"),
        "type": m.get("type"),
        "text": (text[:limit] + "…") if truncated else text,
        "truncated": truncated,
        "chars": len(text),
    }


# ---------- 工具 ----------
def tool_reader_health(args):
    src = _ensure_source()
    with src.request_scope():
        ident = src.identity()
        rows = src.sessions()
    return {"ok": True, "identity": ident,
            "sessions": len((rows or {}).get("sessions") or []) if isinstance(rows, dict) else len(rows or []),
            "auditFile": AUDIT_FILE}


def tool_list_sessions(args):
    query = str(args.get("query") or "").strip().lower()
    limit = int(args.get("limit") or 40)
    include_groups = args.get("include_groups", True) is not False
    src = _ensure_source()
    with src.request_scope():
        data = src.sessions()
    rows = (data.get("sessions") if isinstance(data, dict) else data) or []
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        if not include_groups and r.get("isGroup"):
            continue
        name = str(r.get("name") or "")
        user = str(r.get("username") or r.get("user") or "")
        if query and query not in name.lower() and query not in user.lower():
            continue
        out.append({"user": user, "name": name, "isGroup": bool(r.get("isGroup"))})
        if len(out) >= limit:
            break
    return {"total": len(rows), "returned": len(out), "sessions": out,
            "note": "user 字段直接传给 read_messages / read_key_conversation。"}


def tool_read_messages(args):
    user = str(args.get("user") or "").strip()
    if not user:
        raise RuntimeError("user 必填（先用 list_sessions 拿）")
    limit = min(int(args.get("limit") or 30), 200)
    include_text = args.get("include_text") is True     # L1 默认只给前 20 字
    src = _ensure_source()
    with src.request_scope():
        window = src.messages(user, limit)
    msgs = _as_list(window)
    max_chars = int(args.get("max_chars") or 150)
    briefs = [_msg_brief(m, 100000 if include_text else max_chars) for m in msgs]
    if include_text:
        _audit("read_messages(L2 原文)", user, {"count": len(briefs), "limit": limit})
    return {"user": user, "count": len(briefs), "level": "L2" if include_text else "L1",
            "messages": briefs,
            "note": ("含原文，已写审计日志。" if include_text else
                     "L1：每条截到 %d 字（含金额/单号会自动放宽到 400 字）。需要完整原文用 read_key_conversation（会审计）。" % max_chars)}


def tool_read_key_conversation(args):
    user = str(args.get("user") or "").strip()
    reason = str(args.get("reason") or "").strip()
    if not user:
        raise RuntimeError("user 必填")
    if not reason:
        raise RuntimeError("reason 必填：说明为什么必须出原文（会写进审计日志）")
    limit = min(int(args.get("limit") or 40), 200)
    src = _ensure_source()
    with src.request_scope():
        window = src.messages(user, limit)
    msgs = _as_list(window)
    out = [_msg_brief(m, 2000) for m in msgs]
    _audit("read_key_conversation(L2 原文)", user, {"count": len(out), "reason": reason})
    return {"user": user, "count": len(out), "level": "L2", "reason": reason,
            "messages": out, "note": "已按「关键对话」出原文，审计已记录。"}


TOOLS = [
    {"name": "reader_health", "title": "采集端自检",
     "description": "检查微信采集端是否就绪（账号是否识别、会话数）。只读。",
     "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "list_sessions", "title": "列微信会话",
     "description": "列出本机微信会话（名字/是否群聊/username）。只读。先用它拿 user。",
     "inputSchema": {"type": "object", "properties": {
         "query": {"type": "string", "description": "按名字包含过滤"},
         "limit": {"type": "integer", "default": 40},
         "include_groups": {"type": "boolean", "default": True}},
         "additionalProperties": False}},
    {"name": "read_messages", "title": "读会话消息(L1摘要)",
     "description": "读某会话最近消息。默认每条 150 字摘要（L1），带发送人/时间/是否本人；"
                    "include_text=true 才给全文（L2，会审计）。",
     "inputSchema": {"type": "object", "properties": {
         "user": {"type": "string", "description": "从 list_sessions 拿"},
         "limit": {"type": "integer", "default": 30},
         "max_chars": {"type": "integer", "default": 150,
                       "description": "L1 每条最多多少字（金额/单号会自动放宽到 400）"},
         "include_text": {"type": "boolean", "default": False}},
         "required": ["user"], "additionalProperties": False}},
    {"name": "read_key_conversation", "title": "读关键对话(L2原文)",
     "description": "读某会话最近的原文（L2：会写本地审计日志）。只用于主管明确要求查看的关键对话，"
                    "reason 必须写清用途。",
     "inputSchema": {"type": "object", "properties": {
         "user": {"type": "string"},
         "reason": {"type": "string", "description": "为什么需要原文（写进审计）"},
         "limit": {"type": "integer", "default": 40}},
         "required": ["user", "reason"], "additionalProperties": False}},
]
IMPL = {
    "reader_health": tool_reader_health,
    "list_sessions": tool_list_sessions,
    "read_messages": tool_read_messages,
    "read_key_conversation": tool_read_key_conversation,
}


def _write(obj):
    # 🔴 UTF-8 字节直写：Windows 默认 GBK 会让客户端 UTF-8 解码崩在中文首字节
    sys.stdout.buffer.write(json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8") + b"\n")
    sys.stdout.buffer.flush()


def main():
    try:
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        mid, method = req.get("id"), req.get("method")
        if mid is None and method and str(method).startswith("notifications/"):
            continue
        try:
            if method == "initialize":
                result = {"protocolVersion": "2024-11-05", "capabilities": {"tools": {}},
                          "serverInfo": {"name": "wechat-reader", "version": "0.1.0"}}
            elif method == "tools/list":
                result = {"tools": TOOLS}
            elif method == "tools/call":
                params = req.get("params") or {}
                name = params.get("name")
                fn = IMPL.get(name)
                if fn is None:
                    raise RuntimeError("未知工具：%s" % name)
                payload = fn(params.get("arguments") or {})
                result = {"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False, default=str)}],
                          "isError": False}
            elif method in ("ping",):
                result = {}
            else:
                _write({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "method not found"}})
                continue
            _write({"jsonrpc": "2.0", "id": mid, "result": result})
        except Exception as exc:
            _write({"jsonrpc": "2.0", "id": mid, "result": {
                "content": [{"type": "text", "text": "调用失败：%s: %s" % (type(exc).__name__, str(exc)[:300])}],
                "isError": True}})


if __name__ == "__main__":
    main()
