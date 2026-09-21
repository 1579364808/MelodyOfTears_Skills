# scripts/ — 可复用工具

这些脚本来自一次真实的 98 条 LeetCode 笔记转 Quizify Markdown 的迁移。它们不是模板，是跑通过的实现。

## 依赖

- Node 22+
- `convert/` 需要在工作目录 `npm i turndown turndown-plugin-gfm`
- `screenshot.mjs` 需要全局安装的 `playwright`（`npm root -g` 下）+ 本机 Chrome/Edge。路径不对时用 `PW_PATH=/path/to/playwright` 覆盖。
- 所有连 Anki 的脚本都用 `mcp.mjs`（JSON-RPC over Streamable HTTP）。MCP 地址可用 `ANKI_MCP_URL` 覆盖，默认 `http://127.0.0.1:3141/`。

## 文件

| 文件 | 用途 |
| --- | --- |
| `mcp.mjs` | 极简 MCP 客户端：`mcpCall(name, args)`、`listTools()`。封装了 `structuredContent`/`content[0].text` 两层解析。 |
| `snapshot.mjs` | `node snapshot.mjs <deckName>` → 写 `snapshot.json`（备份全部字段 + 记录每张卡的调度状态）。**转换前必跑。** |
| `convert/convert.mjs` | HTML → Quizify Markdown。含 hljs 代码外壳的两种形态剥离、表格转 GFM、彩色 span → `==高亮==`。导出入口：`convertNote(note)`。 |
| `convert/postfix.mjs` | turndown 输出的事后修复：LaTeX `\(...\)`/`\[...\]` → `$`/`$$`、Obsidian 双链转纯文本、`1\.` 还原、标题层级归一化。**顺序很关键，见 reference/pitfalls.md #3。** |
| `convert/enhance.mjs` | 把含代码的小节折成 Quizify `:::` 折叠块。`enhance(md, { onlyCodeTitled: true })` 只折叠标题像代码的小节。 |
| `convert/escape.mjs` | 把 `&` `<` `>` 转义成实体，使内容在富文本编辑器往返时不变（防损）。附 `hasBareHtmlChars` 校验。 |
| `screenshot.mjs` | `node screenshot.mjs <problem-list.json> [num...]` → 逐题截图到 `shots/`，截图前校验页面标题以题号开头。 |
| `verify.mjs` | `node verify.mjs <deckName> <expected.json> [snapshot.json]` → 逐条回读比对字段 + 对照调度快照。 |

## 典型流程

```bash
node snapshot.mjs "Leetcode Hot 100"          # 1. 备份 + 调度基线
# ... 用 convert/ 把内容转成 final-anki.json ...
node apply.mjs                                 # 2. 写入（见下）
node verify.mjs "Leetcode Hot 100" final-anki.json snapshot.json
```

`apply.mjs` 没有通用化——它太贴具体任务了。需要时参照 `mcp.mjs` 自己写一个：核心是 `update_notes({ notes: [{id, fields:{Front, Back}}] })`，分批 ≤100 条，写前关掉卡片浏览器。
