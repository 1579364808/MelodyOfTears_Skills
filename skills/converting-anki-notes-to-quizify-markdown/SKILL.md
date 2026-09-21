---
name: converting-anki-notes-to-quizify-markdown
description: Use when converting or migrating Anki notes to the Quizify Markdown note type — especially when field content contains code/HTML/LaTeX that Anki's rich-text editor mangles, when changing a note type in place while preserving review scheduling (due/interval/ease/review log), when batch-editing notes via an ankimcp/AnkiConnect-style MCP server, or when building card fronts from web page screenshots (e.g. LeetCode problem pages).
---

# Converting Anki Notes to Quizify Markdown

## Overview

Convert an Anki deck's notes to the `Quizify Markdown` note type **in place** (so review scheduling is preserved), converting rich-text HTML or Obsidian Markdown into Quizify's Markdown format, writing via an MCP server (`ankimcp.ai` / AnkiConnect style), and preventing the #1 failure: Anki's rich-text field editor silently corrupting `<`/`>`/`&` in code on every save.

The non-negotiable insight: **store the field content HTML-escaped** (`&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`). Quizify's render path unescapes entities before Markdown parsing (desktop `protect_quizify_source_regions` + mobile `_quizify.js` `Ws`), so cards render identically, while the rich-text editor round-trips entities losslessly. See `reference/pitfalls.md` for the full diagnosis.

## When to use

- Migrating a whole deck from `Basic`/other note types to `Quizify Markdown`
- Fields contain code, generics (`Map<String, List<Integer>>`), comparisons, or LaTeX
- You must keep card scheduling (due/interval/ease/review log)
- Batch-editing many notes through an MCP server
- Building `Front` images from problem pages via browser automation

Do NOT use for: one-off single-card edits (edit by hand), or decks whose content is plain prose (no `<`/`>`/`&` — then escaping is unnecessary and direct field writes are safe).

## Process

1. **Enable the destructive tool.** `change_note_type` is registered but hidden behind the addon config `enabled_destructive_tools`. Add it to `addons21/<mcp-addon>/config.json`, restart Anki, verify with `tools/list` (tool count goes from N to N+1). `scripts/mcp.mjs` has a working JSON-RPC client for the MCP server.
2. **Snapshot first.** Export all notes' fields + per-card scheduling (type/queue/ivl/due) to JSON before any write — this is your backup and your verification baseline. (`scripts/snapshot.mjs` pattern; see the git history of this skill's example workspace.)
3. **Convert content.** HTML → Markdown via turndown + `turndown-plugin-gfm` + custom rules; or Obsidian Markdown cleanup. Both pipelines are in `scripts/convert/`. Key fixes are in `scripts/convert/postfix.mjs` — see pitfalls.
4. **Escape the HTML chars** in the final content (`scripts/convert/escape.mjs`).
5. **Change the note type** with `change_note_type({dry_run:true})` first; check `field_mapping`, `dropped_fields`, `cards_to_remove` — all must be empty/0. Then re-run with `dry_run:false, confirm:true`. Same-name fields (`Front`/`Back`) map automatically.
6. **Write fields** in batches of ~20 with `update_notes` ({id, fields}). Do NOT have the Anki Card Browser open on these notes during the write.
7. **Verify** byte-for-byte: re-read every note and compare Front/Back to your expected content; re-check per-card scheduling against the snapshot (`scripts/verify.mjs`).
8. **Sync.** The note-type change marks the schema modified → the next sync is a one-way full sync overwriting AnkiWeb and other devices. Sync from the device that has the changes.

## Critical pitfalls (the reason this skill exists)

| Pitfall | Symptom | Fix |
|---|---|---|
| Rich-text editor round-trip | `Map<Integer, Integer>` → `Map<integer, integer="">`; `new HashMap<>()` → `new HashMap&lt;&gt;()`; junk tags like `</string,>` appear | **Escape `&`/`<`/`>` in the stored field.** Also: never open these notes in the Card Browser's rich-text editor. |
| `change_note_type` not in `tools/list` | tool missing | Add it to `enabled_destructive_tools` in the addon config, restart Anki. Without it, "rebuild notes" loses all review scheduling. |
| turndown escaping order | `\(` → `$...$` broken, `dp[i]` turned into `$$i$$`, `[[A]]` mangled | Convert LaTeX `\(...\)`/`\[...\]` **before** collapsing turndown's doubled backslashes; strip Obsidian `[[A\|B]]`/`[[A]]` **before** math rules. Build such regexes with `String.fromCharCode(92)` — never hand-write backslashes through shell/JSON. |
| hljs code wrappers, 2 variants | code lost or one `<pre>` per line | Parse with a real DOM (domino); canonicalize every `div.highlight` into one `pre` (see `scripts/convert/convert.mjs`). |
| Obsidian `[[A\|B]]` wikilinks | Quizify treats `[[题干\|\|答案]]` as a click-to-reveal | Convert to plain text before writing. |
| `get_media_files_names` false positives | files "exist" but images are missing | It reads Anki's media **DB**, not the disk. Check `collection.media.db2` (table `media`, `csum IS NULL`/`mtime=0` = deleted) and the actual `collection.media/` folder. |
| leetcode.cn anti-bot | curl/node-fetch get an 8KB JS challenge page after ~70 requests | Use a real browser (Playwright, `channel: 'chrome'`), sequential, with delays; verify each page's `<title>` matches the expected problem number before capturing. |
| MCP tool shape quirks | "data must have required property 'notes'" | `notes_info` takes `notes` (array of ids); the payload is under `structuredContent` or `content[0].text`; `add_note` returns `note_id` (snake_case). |

## Quick reference

- Deck note search: `find_notes({query:'deck:"Leetcode Hot 100"', limit:200})`
- Read fields: `notes_info({notes:[...]})`
- Change type: `change_note_type({note_ids, new_model_name:'Quizify Markdown', dry_run, confirm})`
- Write fields: `update_notes({notes:[{id, fields:{Front, Back}}]})` (≤100/batch)
- Upload media: `store_media_file({filename, path})` — local path supported; Anki may dedupe by content hash
- Card scheduling: `cards_stats({deck})` returns type/queue/ivl/dueToday per card

## Reusable scripts

All in `scripts/`, runnable with plain Node 22+ (needs `npm i turndown turndown-plugin-gfm` in the working dir; screenshots need a global `playwright` install + Chrome/Edge present):

- `scripts/mcp.mjs` — minimal MCP JSON-RPC client (`call(name, args)`)
- `scripts/convert/convert.mjs` — HTML → Markdown (hljs-unwrapping, tables, colored spans → `==highlight==`)
- `scripts/convert/postfix.mjs` — the escaping-order fixes (LaTeX, wikilinks, `1\.`, headings)
- `scripts/convert/escape.mjs` — final `&`/`<`/`>` escaping for editor-safe storage
- `scripts/convert/enhance.mjs` — fold code sections into Quizify `:::` collapsibles
- `scripts/screenshot.mjs` — problem-page screenshots with per-page title verification
- `scripts/verify.mjs` — byte-for-byte field + scheduling comparison against a snapshot

## Verification checklist

- [ ] All target notes are `Quizify Markdown` type
- [ ] Every field re-read and compared byte-for-byte with expected content
- [ ] Every card keeps its id, due date, interval, ease (compare to the pre-change snapshot)
- [ ] No bare `<`/`>`/`&` left in stored fields
- [ ] Front images resolve to files that exist in `collection.media/`
- [ ] A card renders correctly in the Reviewer (code shows `<Integer>`, not `&lt;`)

## Actual effect (example)

A 98-note LeetCode deck of `Basic` cards with hljs-highlighted HTML backs (1.48MB) → 98 `Quizify Markdown` notes (374KB), 33 review cards kept their exact intervals, 486 code blocks converted, 96 problem-page screenshots attached to fronts, 0 cards lost.