---
name: recap
description: Persist an explicit Pixiu recap through the manual recap helper so the recap file and memory summary stay aligned.
origin: Pixiu
version: 0.1.0
---

# /recap

## Purpose

Create a formal manual recap entry and write it through `scripts/hooks/pixiu-manual-recap.js`.

## 行為合約

收到 `/recap` 時，必須：

1. 先整理本次正式 recap 內容，不得只在對話中輸出短摘要。
2. 把 `relative_path` 與完整 `content` JSON 送進 `scripts/hooks/pixiu-manual-recap.js`。
3. 由 helper 固定依序執行：寫 recap 原件 → 更新 `vault/memory/memory-summary.md` → deterministic Phase 2 capture。
4. 寫入前先完成 recap schema、敏感資訊、summary 相容性與 observation metadata 預檢；任一步失敗就 fail closed。
5. 同路徑同內容視為冪等重跑；同路徑不同內容必須拒絕，不得覆蓋正式 recap 原件。
6. CLI 失敗時必須 non-zero exit，且只輸出穩定的通用錯誤，不得回顯 raw stdin、本機絕對路徑或內部檔名。

## Usage

```bash
node scripts/hooks/pixiu-manual-recap.js
```

Send JSON on stdin with:

- `relative_path`: path under `vault/memory/recaps/`
- `content`: full recap markdown to persist

Example:

```json
{
  "relative_path": "母體/2026-07/2026-07-26-母體-內容.md",
  "content": "---\ntype: session-recap\n..."
}
```

## Notes

- This is the explicit command entry for manual recap persistence.
- The helper is responsible for writing the recap, syncing `vault/memory/memory-summary.md`, and triggering deterministic Phase 2 capture.
- Formal capture accepts only strict `type: session-recap` + `recap_mode: manual` frontmatter and the canonical `<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md` layout.
- `source_paths` is required and non-empty; every entry must be an existing, readable path relative to PixiuCore. Missing or invalid evidence rejects the whole workflow before durable writes.
