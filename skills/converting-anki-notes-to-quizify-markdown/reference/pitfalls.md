# Pitfalls: Anki + Quizify Markdown + MCP 批处理

这些是在真实转换中踩过的坑，按「症状 → 根因 → 修法」组织。每一条都验证过。

## 1. 富文本编辑器往返损坏（最大的坑）

**症状**：字段里的 `Map<Integer, Integer>` 变成 `Map<integer, integer="">`，`new HashMap<>()` 变成 `new HashMap&lt;&gt;()`，末尾多出 `</string,></list` 之类的乱码闭合标签。

**根因**：Anki 的字段编辑器（添加窗口、浏览器编辑器）底层是浏览器的 contenteditable。流程是「字段 HTML 字符串 → 解析成 DOM → 编辑 → 序列化回 HTML」。这个过程不是无损的：

- `<Integer, Integer>` 被当成未知 HTML 标签，解析成 DOM 元素（标签名小写化、剩余文本变成属性）→ 序列化后就是 `<integer, integer="">`
- 文本节点里的 `&` `<` `>` 会被转义成实体
- 未闭合/不规范的标签被自动补全或移动

**注意**：即使用户没有主动编辑，只要在浏览器「笔记」视图里点开一张卡再切到另一张，切换时的自动保存就会触发一次往返。

**修法（数据层，最可靠）**：把字段内容里的 `&` `<` `>` 转义成实体后再存储。依据：

- Quizify 的渲染管线会先把实体还原再解析 Markdown（桌面端 `protect_quizify_source_regions` 里有 `unescape(field_html)`；移动端 `_quizify.js` 的 `Ws()` 里也有一致的替换），所以**卡片渲染完全不变**
- 转义后的内容是富文本编辑器的**不动点**：编辑器加载时把 `&lt;` 解码成 `<` 显示，保存时又转义回 `&lt;`，永不损坏
- 验证方法：写入后用 `notes_info` 逐条回读，与期望内容逐字节比对

**什么时候不用转义**：字段内容不含 `&` `<` `>`（纯散文）时直接写入即可。

**备选修法（编辑器层）**：让浏览器编辑器处于「纯文本模式」。Quizify 插件靠 monkey-patch `globalThis.setPlainTexts` 来强制纯文本，但这依赖 Anki 版本暴露该全局函数——不可靠（本例中就没有生效）。数据层转义不依赖任何编辑器行为，是更稳的选择。

## 2. change_note_type 默认被隐藏

**症状**：`tools/list` 里找不到 `change_note_type`（服务器有 41 个工具而不是 42 个）。

**根因**：ankimcp.ai 的 MCP 插件把破坏性工具藏在 `enabled_destructive_tools` 白名单后面（`addons21/<mcp插件>/config.json`）。

**修法**：

```json
"enabled_destructive_tools": ["change_note_type"]
```

改完**必须完全退出并重启 Anki**（插件只在启动时读配置）。重启后用 `tools/list` 确认工具数 +1。

**为什么值得这么做**：`change_note_type` 走 Anki 原生 `change_notetype_of_notes`，卡片的 id / due / interval / ease / 复习记录全部保留。替代方案「新建 Quizify 笔记 + 删除旧笔记」会把所有复习进度清零。

**前提**：所有要换型的笔记必须是**同一个**旧牌型（工具按索引映射字段，混换会乱）；先 `dry_run: true` 看 `field_mapping` / `dropped_fields` / `cards_to_remove`，再 `confirm: true` 执行。

## 3. turndown 的转义顺序

**症状**：`$\ge target$` 变成 `$\\ge target$`（KaTeX 报错）；`dp[i]` 变成 `dp$$i$$`；`[[回溯总结]]` 被误当成 Quizify 揭示语法。

**根因**：turndown 会把文本节点里的 `\` 翻倍（`\(x\)` → `\\(x\\)`）、把 `[`/`]` 变成 `\[`/`\]`、把数字后的 `.` 变成 `\.`。如果你在折叠反斜杠之后才处理 `\(...\)` 或 `\[\[...\]\]`，就和它自己产生的转义无法区分。

**修法（顺序很重要）**：

1. 先把 `\(...\)` → `$...$`、`\[...\]` → `$$...$$`（此时 `\(` 在原文里是**两个**反斜杠）
2. 再处理 `\[\[A\]\]`（双链的转义形态）和 `[[A]]`
3. 最后折叠反斜杠：`s.split(String.fromCharCode(92).repeat(2)).join(String.fromCharCode(92))`
4. 最后才把 `\.` 还原成 `.`（行首数字后的要保留转义以免变成列表）

**关键技巧**：这类含反斜杠的正则**一律用 `new RegExp` + `String.fromCharCode(92)` 拼接**，不要手写反斜杠字面量——反斜杠会在「工具调用 JSON → 文件 → JS 字符串 → 正则」的每一层被吃掉一级，极难排查。`postfix.mjs` 里就是这么写的。

## 4. hljs 高亮代码块的两种外壳

从 Typora/网页复制的高亮代码，HTML 里两种形态都存在：

- **A**：`<pre><code class="language-java"><center><table><tbody><tr><td><div class="highlight"><pre> 代码（含 \n）`
- **B**：`<table><tbody><tr><td><div class="highlight"><pre> 第 1 行 </pre><pre> 第 2 行 </pre>...`（表格在 `<pre>` 外，每行一个 `<pre>`）

**修法**：用 DOM 解析器（domino）而不是正则处理嵌套 `<pre>`；对 B 形态，合并同一 `div.highlight` 里的多个 `<pre>` 文本（按 `\n` 拼接）；语言从 `code[class*="language-"]` 提取；对没有语言标记的代码块，用启发式（多行 + 含 `;{}` + 含 `class/public/int/return` 等关键字）标记为 `java`。

## 5. Obsidian 双链与 Quizify 语法冲突

Quizify 的 `[[题干||答案]]` 是点击揭示语法。Obsidian 的 `[[目标|显示]]` / `[[笔记]]` 会被误解析。

**修法**：转换时把 `[[A|B]]` → `B`、`[[A]]` → `A`（纯文本）。

## 6. get_media_files_names 会误报

**症状**：工具说图片存在，但卡片里图是裂的。

**根因**：这个工具读的是 Anki 的媒体**数据库**（`collection.media.db2`），不是磁盘。文件从磁盘上没了（被杀软/清理工具/手动删掉）但 DB 记录还在时，它就会误报。

**修法**：两个都查——DB 里 `media` 表的 `csum IS NULL`（或 `mtime=0`）表示已删除；磁盘上 `collection.media/` 里要有真实文件。恢复渠道：AnkiWeb 同步拉回，或 `collection.media.trash` 回收站。

## 7. leetcode.cn 的反爬

**症状**：批量抓取到 ~70 次后，所有请求都返回一个 8KB 的 JS 挑战页（`function check()`），没有 `<title>`。

**修法**：换用真实浏览器（Playwright + 系统 Chrome/Edge，`channel: 'chrome'`），顺序访问 + 请求间隔；每次截图前先校验 `document.title` 以「题号.」开头、且最终 URL 仍指向目标 problem——不满足就重截，不要写进去。

## 8. MCP 工具的参数/返回形态

- `notes_info` 的参数名是 `notes`（数字数组），不是 `note_ids`；响应主体在 `structuredContent`（或 `content[0].text` 里的 JSON 字符串）
- `add_note` 返回 `note_id`（蛇形），不是 `noteId`——判成功时用 `res.note_id || res.noteId`
- 批量写用 `update_notes`（≤100 条/批），单条用 `update_note_fields`
- 写入期间**不要让用户在卡片浏览器里打开这些笔记**，否则编辑器可能用旧内容回写覆盖你的写入

## 9. 二次转义（改已有笔记时最容易犯）

**症状**：改完一条笔记，卡片上直接显示 `&lt;` 这样的字面文本。

**根因**：字段里存的**已经是转义态**（`&lt;` / `&gt;` / `&amp;`）。如果拿着整篇文档再跑一遍 `escapeForAnki()`，`&lt;` 就变成 `&amp;lt;`，而渲染端只解一层。

**修法**：**拼接，不要重转义**——保留原文（已是转义态）不动，只对**新写的那段**跑 `escapeForAnki()`，然后拼起来：

```js
const head = currentBack.slice(0, currentBack.indexOf(':::\n\n') + 5); // 原样保留
const newBack = head + escapeForAnki(tailClean);                        // 只转新内容
```

写前用 `hasBareHtmlChars()` 卡一道，并检查不存在 `&amp;lt;`。

## 10. 把「源码区」误判成渲染坏了

**症状**：用 `present_card` 取渲染后的答案，发现 `:::` 原封不动、`<details>` 不存在、公式没变成 KaTeX，以为折叠和公式坏了。

**根因**：返回的 `answer` HTML 里装的是**Markdown 源码**（放在 `data-qz` 区域）。折叠和 KaTeX 是客户端 `_quizify.js` 运行时做的，服务端渲染不会出现 `<details>`。

**修法**——做对照实验，而不是凭单张卡下结论：从同一个牌组里另取一张**未改动的**卡，比对同样的属性。若对照卡也一样，那就是插件的统一行为。真正有意义的断言只有一条：**单层转义**（正确 `List&lt;int[]&gt;`，坏了是 `List&amp;lt;int[]&amp;gt;`）。

## 11. 误以为编辑字段重置了调度

**症状**：改完字段后发现卡片是 `type=3 / queue=1`（重学/学习中），怀疑被重置了。

**真相**：`update_notes` 写字段**不碰调度**——不加 `revlog` 行，`type`/`queue`/`ivl`/`factor`/`reps`/`lapses` 都不变。

**修法**：只读查库对账（先复制 `collection.anki2`，Anki 持锁）：

```sql
SELECT id, nid, type, queue, due, ivl, factor, reps, lapses FROM cards WHERE nid = ?;
SELECT id, ease, ivl, lastIvl, type FROM revlog WHERE cid = ? ORDER BY id DESC LIMIT 5;
```

先看 `revlog` 的时间戳：处于重学状态的卡，多半是**用户自己**刚按了「重来」，不是你改坏的。
