#!/usr/bin/env node
'use strict';
/**
 * 组「微信采集端」绿色包（给同事机，无需装副驾界面）
 * ==========================================================
 * 产出：wechat-reader-green/  （整个目录拷走即用）
 *   runtime/python/          便携 Python 3.14（含 wechatauto/cryptography/zstandard/psutil）
 *   reader/                  读取层源码 + MCP 服务
 *     wechat_reader_mcp.py
 *     bridge/*.py            只拷依赖闭包
 *     native-reader/wr/*.py
 *   run.cmd                  手动自检（不接平台时用）
 *   安装说明.txt
 *
 * 不打包：Electron 界面、Lark/模型等与读微信无关的模块
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SRC_CLIENT = 'D:/VB-B机开发包/WechatVibe-transfer';
const SRC_RUNTIME = path.join(SRC_CLIENT, '.local/portable-builds/build-fhdv7m_9/client/runtime/python');
const OUT = path.resolve(__dirname, '..', 'wechat-reader-green');
const READER = path.join(OUT, 'reader');

const BRIDGE_FILES = [
  'wechat_source.py', 'live_source.py', 'cache_source.py', 'windows_file_owners.py',
  'backend_contracts.py', 'history_browser.py', 'image_key.py', 'wx_file.py', 'chat_server.py',
];
const WR_DIR = path.join(SRC_CLIENT, 'native-reader', 'wr');

function say(m) { console.log(m); }
function must(p, label) { if (!fs.existsSync(p)) throw new Error(`缺少${label}：${p}`); }

must(SRC_RUNTIME, '便携运行时');
must(WR_DIR, 'wr 读取层');
must(path.join(__dirname, 'wechat_reader_mcp.py'), 'MCP 服务');

say('[1] 清空输出目录 ' + OUT);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(READER, { recursive: true });

say('[2] 拷贝便携运行时（272MB，约 1-2 分钟）...');
// robocopy 的退出码 0-7 都算成功（1=已复制文件），必须自己判，不能用 execFileSync
{
  const dest = path.join(OUT, 'runtime/python');
  const r = spawnSync('robocopy', [SRC_RUNTIME, dest, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/R:1', '/W:1'], { encoding: 'buffer', maxBuffer: 1024 * 1024 * 16 });
  const code = r.status;
  if (code === null || code > 7) {
    throw new Error('robocopy 失败 code=' + code + ' ' + (r.stderr ? r.stderr.toString().slice(0, 300) : ''));
  }
  if (!fs.existsSync(path.join(dest, 'python.exe'))) throw new Error('复制后没找到 python.exe');
}
say('    完成');

say('[3] 拷贝读取层源码（只带依赖闭包）...');
fs.mkdirSync(path.join(READER, 'bridge'), { recursive: true });
for (const f of BRIDGE_FILES) {
  const from = path.join(SRC_CLIENT, 'bridge', f);
  if (!fs.existsSync(from)) { say('    ⚠️ 跳过缺失模块 ' + f); continue; }
  fs.copyFileSync(from, path.join(READER, 'bridge', f));
}
fs.mkdirSync(path.join(READER, 'native-reader/wr'), { recursive: true });
for (const f of fs.readdirSync(WR_DIR)) {
  if (f === '__pycache__' || f.endsWith('.pyc')) continue;
  fs.copyFileSync(path.join(WR_DIR, f), path.join(READER, 'native-reader/wr', f));
}
fs.copyFileSync(path.join(__dirname, 'wechat_reader_mcp.py'), path.join(READER, 'wechat_reader_mcp.py'));

say('[4] 写启动脚本与说明...');
fs.writeFileSync(path.join(OUT, 'run.cmd'), [
  '@echo off',
  'title WeChat Reader Selfcheck',
  'cd /d "%~dp0"',
  'set "PYTHONIOENCODING=utf-8"',
  'set "PYTHONUTF8=1"',
  'echo 自检：读取本机微信会话（只读）',
  'echo {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}| "runtime\\python\\python.exe" "reader\\wechat_reader_mcp.py"',
  'echo {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"reader_health","arguments":{}}}| "runtime\\python\\python.exe" "reader\\wechat_reader_mcp.py"',
  'pause',
].join('\r\n'), 'utf8');

fs.writeFileSync(path.join(OUT, '安装说明.txt'), [
  '微信采集端（绿色包）',
  '==================',
  '作用：不启动微信副驾界面，直接只读本机微信（会话/消息/关键对话），供三省六部调用。',
  '',
  '前提：',
  '1. 本机已安装并登录 Windows 微信（Weixin 4.x）',
  '2. 微信保持运行（密钥需要从进程内存只读扫描，首次约 3 秒）',
  '',
  '验证（不接平台也能测）：',
  '  双击 run.cmd → 看到 "ok": true 和会话数即成功',
  '',
  '接入三省六部（StaffDeck）：',
  '  工具页 → MCP 服务器 → 新建，填：',
  '    传输：stdio',
  `  命令：<本包路径>\\runtime\\python\\python.exe`,
  `  参数：<本包路径>\\reader\\wechat_reader_mcp.py`,
  '  桶：微信',
  '',
  '只读声明：不注入 DLL、不改微信数据库、不发消息。',
  '分级：默认 L1（每条 150 字摘要）；关键对话 L2 原文会写本地 audit.jsonl 审计。',
].join('\r\n'), 'utf8');

say('');
say('✅ 绿色包已生成：' + OUT);
say('   运行时：' + path.join(OUT, 'runtime/python'));
say('   入口：' + path.join(READER, 'wechat_reader_mcp.py'));
