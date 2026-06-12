---
type: after-action
date: 2026-04-27
project: DOCX_TOOLING
system: PIXIUCORE
repo: Playground
topic: docx-powershell-encoding
status: done
summary: 記錄 PowerShell 管線造成中文 DOCX 編碼污染的根因與後續修法。
tags: [docx, encoding, powershell, python-docx, pixiu]
---

# DOCX 產生中文編碼問題

## 背景

使用者要求產出一份排版良好、含表格的 Word 需求規格書。初始做法是透過 PowerShell here-string 將 Python 程式碼 pipe 到 bundled Python 的 `python -` 執行，並使用 `python-docx` 產生文件。

## 碰到的問題

- PowerShell 管線傳遞中文時發生編碼破壞。
- 測試 `中文測試` 輸出變成亂碼。
- DOCX 輸出檔名中的中文被轉成問號，導致 Windows 路徑變成 `FTP??????????????.docx`，最後 `OSError: [Errno 22] Invalid argument`。

## 當次修正

- 改用 `apply_patch` 建立 UTF-8 `.py` 檔。
- 直接執行 Python 檔案，不再透過 PowerShell 管線傳遞中文原始碼。
- 使用 bundled Python 與 `python-docx` 成功產出：
  - `%USERPROFILE%\Documents\Playground\FTP訊息單量彙整自動化需求規格書.docx`

## 工具紀錄

- `load_workspace_dependencies`：確認文件處理工具狀態。
- `install_workspace_dependencies`：安裝 bundled runtime。
- bundled Python：`%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`
- Python 套件：`python-docx`
- `apply_patch`：建立 UTF-8 腳本，避開 PowerShell 管線編碼問題。

## 後續標準

以後遇到「中文 DOCX / Word 文件產生」：

1. 優先使用 UTF-8 `.py` 或 UTF-8 JSON 規格檔。
2. 不把含中文的大段程式碼用 PowerShell pipe 給 `python -`。
3. 使用 `%PIXIU_CORE%\skills\make-docx\scripts\make_requirement_docx.py` 作為可重複工具。
4. 產檔後檢查檔案存在與大小。

## 追加驗證紀錄

- 新增的 `make_requirement_docx.py` 已用 `--sample ftp-monthly-message-report` 實際產出測試文件：
  - `%USERPROFILE%\Documents\Playground\docx_tool_validation.docx`
- `skill-creator/scripts/quick_validate.py` 執行時因目前 bundled Python 缺少 `yaml` 套件而失敗：
  - `ModuleNotFoundError: No module named 'yaml'`
- 已改用最小手動驗證補足：
  - `SKILL.md` 具有 frontmatter。
  - `name: make-docx` 與 `description:` 存在。
  - `Reusable Requirement DOCX Tool` 與 `Windows UTF-8 Guardrails` 段落存在。
  - 產出的 DOCX 檔案大小大於 0。

