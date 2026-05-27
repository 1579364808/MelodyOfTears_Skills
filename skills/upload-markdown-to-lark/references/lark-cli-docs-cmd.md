# lark-cli docs 命令参考

## docs +create — 创建飞书文档

```
lark-cli docs +create [flags]

Flags:
      --as string             identity type: user | bot (default "user")
      --dry-run               print request without executing
      --folder-token string   parent folder token
  -h, --help                  help for +create
  -q, --jq string             jq expression to filter JSON output
      --markdown string       Markdown content (Lark-flavored) (supports @file, - for stdin)
      --title string          document title
      --wiki-node string      wiki node token
      --wiki-space string     wiki space ID (use my_library for personal library)
```

## docs +update — 更新飞书文档

```
lark-cli docs +update [flags]

Flags:
      --as string                        identity type: user | bot (default "user")
      --doc string                       document URL or token
      --dry-run                          print request without executing
  -h, --help                             help for +update
  -q, --jq string                        jq expression to filter JSON output
      --markdown string                  new content (Lark-flavored Markdown)
                                         (supports @file, - for stdin)
      --mode string                      update mode: append | overwrite | replace_range
                                         | replace_all | insert_before | insert_after
                                         | delete_range
      --new-title string                 also update document title
      --selection-by-title string        title locator (e.g. '## Section')
      --selection-with-ellipsis string   content locator (e.g. 'start...end')
```

## docs +fetch — 获取飞书文档内容

```
lark-cli docs +fetch [flags]

Flags:
      --as string       identity type: user | bot (default "user")
      --doc string      document URL or token
      --dry-run         print request without executing
      --format string   output format: json (default) | pretty | table | ndjson | csv
  -h, --help            help for +fetch
  -q, --jq string       jq expression to filter JSON output
      --limit string    pagination limit
      --offset string   pagination offset
```

## 关键参数说明

- `--markdown`：支持 `@file` 语法从文件读取内容，也支持 `-` 从 stdin 读取
- `--as bot`：使用 bot 身份（需已配置 bot token）
- `--as user`：使用用户身份（需已登录用户）
- `--mode overwrite`：完全替换文档内容
- `--mode append`：在文档末尾追加内容
