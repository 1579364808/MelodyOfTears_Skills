---
name: upload-markdown-to-lark
description: 将本地 Markdown 文件上传到飞书云文档（创建或更新），处理 Windows 环境下 lark-cli 的 @file 语法兼容性问题。当用户要求将 .md 文件上传到飞书、补充到飞书文档、覆盖飞书文档内容时使用。
---

# Upload Markdown to Lark

将本地 Markdown 文件上传到飞书云文档。核心难点在于 Windows PowerShell 下 `@file` 语法的正确处理方式。

## 工作流

```
收到上传请求
    │
    ├─ 已有 doc_id？──→ 是 ──→ docs +update
    │
    └─ 否 ──→ docs +create → 获取 doc_id → 如有需要再 docs +append
```

## 关键问题：Windows PowerShell 下 @file 的处理

**问题根因**：PowerShell 中 `@` 符号是 splatting 操作符，会导致 `--markdown "@filepath"` 被当作普通字符串而非文件读取。

**正确做法**：使用 `node` 直接调用 lark-cli 的入口脚本，并配合正确的相对路径：

```bash
node <lark-cli-run-js路径> docs +<create|update> --doc <doc_id> --markdown "@./<文件名>" --mode overwrite --as bot
```

**必须满足两个条件**：
1. **用 `node` 直接调用**（绕过 PowerShell wrapper 对 `@` 的干扰）
2. **使用相对路径**（`@./filename.md`，不支持绝对路径 `@C:/...`）

### 文件编码警告（中文场景关键！）

当通过 `@file` 传递的文件（如 JSON 参数文件、Markdown 文件）中包含**中文**时，**必须确保文件为 UTF-8 编码**。PowerShell 的 `Out-File -Encoding ASCII` 或默认输出会截断中文字符，导致飞书 API 收到乱码。

**正确的写入方式**——使用 `write_to_file` 工具（自动 UTF-8）：

```python
# 正确的做法：使用 write_to_file 工具写入 JSON 文件
write_to_file(
    filePath="c:/path/to/rename_data.json",
    content='{"new_title":"DevOps-Gym-首个端到端基准测试-调研报告"}'
)
write_to_file(
    filePath="c:/path/to/rename_params.json",
    content='{"file_token":"xxx","type":"docx"}'
)
```

**错误的做法**——会丢失中文：

```powershell
# ❌ PowerShell Out-File -Encoding ASCII 会截断中文
echo '{"new_title":"中文标题"}' | Out-File -Encoding ASCII data.json

# ❌ 默认输出也非 UTF-8
echo '{"new_title":"中文标题"}' > data.json
```

**原则**：凡涉及通过 `@file` 传递中文内容给 lark-cli 的场景（包括 `--markdown "@./file.md"`、`--data "@./file.json"`、`--params "@./file.json"`），都必须用 `write_to_file` 工具以确保 UTF-8 编码。`write_to_file` 写入的 Markdown 文件本身也是 UTF-8，无需额外处理。

### 查找 lark-cli 的 run.js 路径

```powershell
# lark-cli.ps1 中引用的路径为：
# $basedir/node_modules/@larksuite/cli/scripts/run.js
# $basedir = C:\Users\<用户名>\AppData\Roaming\npm
Get-Command lark-cli | Select-Object Source
```

常见的完整路径：
```
C:\Users\<用户名>\AppData\Roaming\npm\node_modules\@larksuite\cli\scripts\run.js
```

## 操作步骤

### 1. 创建新文档

切换到 Markdown 文件所在目录，然后用 node 直接调用 lark-cli：

```powershell
cd <markdown文件所在目录>

node C:\Users\<用户名>\AppData\Roaming\npm\node_modules\@larksuite\cli\scripts\run.js `
  docs +create `
  --title "<文档标题>" `
  --markdown "@./<文件名>.md" `
  --as bot
```

成功返回示例：
```json
{
  "ok": true,
  "data": { "doc_id": "X5Z2d9sGGo7O3qx6pDCcJzwgnAd" }
}
```

### 2. 覆盖更新已有文档（mode overwrite）

```powershell
cd <markdown文件所在目录>

node C:\Users\<用户名>\AppData\Roaming\npm\node_modules\@larksuite\cli\scripts\run.js `
  docs +update `
  --doc <doc_id> `
  --markdown "@./<文件名>.md" `
  --mode overwrite `
  --as bot
```

### 3. 追加内容到已有文档（mode append）

```powershell
cd <markdown文件所在目录>

node C:\Users\<用户名>\AppData\Roaming\npm\node_modules\@larksuite\cli\scripts\run.js `
  docs +update `
  --doc <doc_id> `
  --markdown "@./<文件名>.md" `
  --mode append `
  --as bot
```

### 4. 验证文档内容

```powershell
lark-cli docs +fetch --doc <doc_id> --as bot --format pretty
```

## 大文件处理策略

当 Markdown 文件很大时（> 数百行/几十 KB），优先尝试**一次性覆盖**。`@file` 语法由 lark-cli 自己读取文件，不受命令行长度限制。

如果一次性覆盖失败（API 超时或报错），则分段处理：
1. 先用 `--mode overwrite` 上传前 N 段
2. 再用 `--mode append` 追加后续段落

## 身份说明

| 身份 | 参数 | 说明 |
|------|------|------|
| Bot | `--as bot` | 需要配置 Bot token，适合自动化场景 |
| 用户 | `--as user` | 需要用户登录，文档归属个人账号 |

## 参考

- lark-cli docs 命令完整参数参见 `references/lark-cli-docs-cmd.md`
