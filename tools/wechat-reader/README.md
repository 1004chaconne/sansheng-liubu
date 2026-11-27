# 微信采集端（headless reader）

不启动微信副驾（WechatVibe）界面，直接只读本机微信，供三省六部（StaffDeck）调用。

## 为什么

副驾的界面是给业务员做情感/画像分析的；单证/操作岗只需要"读"。读取能力本身在
`native-reader/wr`（SQLCipher 页面解密 + 读库），与 Electron 无关，所以抽出来做成 MCP。

## 结构

| 文件 | 作用 |
|---|---|
| `wechat_reader_mcp.py` | MCP 服务（stdio，纯标准库；4 个工具） |
| `build-green-pack.cjs` | 组绿色包：便携 Python 运行时 + 读取层闭包 + MCP |

## 4 个工具

| 工具 | 说明 |
|---|---|
| `reader_health` | 自检：账号识别、会话数 |
| `list_sessions` | 会话列表（名字/是否群聊/username） |
| `read_messages` | L1：默认每条 150 字摘要，含金额/单号自动 400 字；带 sender/time/self |
| `read_key_conversation` | L2：原文，`reason` 必填，写 `audit.jsonl` 审计 |

## 分级规则

- L1 默认出本机；L2（原文）需明确理由并留审计，对应"关键对话可出本机给老板看"。
- 只读：不注入 DLL、不改微信库、不发消息。

## 实现要点（踩过的坑）

1. 必须用副驾自带运行时 python（site-packages 有 `wechatauto`）
2. `sys.path` 加 `bridge/` 与 `native-reader/`
3. 独立进程里 Restart Manager 判空 → 手工构造 `ActiveSelection` + monkeypatch `live_source.active_account_snapshot`
4. 首次调用必然"账号未就绪"（密钥内存扫描 ~1.4GB/3 秒）→ 必须重试
5. `WeChatSource` 必须传 `classifier`，否则 `NoneType not callable`
6. stdout 必须 UTF-8 字节直写（Windows 默认 GBK，客户端按 UTF-8 解码会崩）

## 打包

```bash
node build-green-pack.cjs
# 产出 ../wechat-reader-green（含 runtime/python 272MB + reader/）
```
