---
type: session-recap
date: 2026-04-27
project: DOCX_TOOLING
system: PIXIUCORE
repo: Playground,pixiu-core
topic: make-docx-skillization
status: done
tags: [recap, session, docx, skill]
summary: 整理 DOCX 產生流程並規劃 make-docx 技能化，讓文件輸出可重複操作。
---

# Session Recap：DOCX 文件產生與 make-docx 技能化

## 🎯 任務目標與背景

使用者先要求將「每月 FTP 抓訊息、確認單量、同步 Excel 給主管」整理成需求規格與方案，再要求產出排版良好、含表格的 `.docx` 文件。產檔過程中遇到 PowerShell 管線中文編碼問題，使用者要求將本次問題與使用工具沉澱為 skill、可重複腳本、母體記憶與 Obsidian recap。

## ✅ 本次完成

1. 產出 Word 文件：`%USERPROFILE%\Documents\Playground\FTP訊息單量彙整自動化需求規格書.docx`。
2. 建立 workspace 產檔腳本：`%USERPROFILE%\Documents\Playground\generate_ftp_requirement_docx.py`。
3. 更新母體 `make-docx` skill，加入 reusable requirement DOCX tool 與 Windows UTF-8 guardrails。
4. 新增母體可重複工具：`%PIXIU_CORE%\skills\make-docx\scripts\make_requirement_docx.py`。
5. 將 PowerShell 中文編碼踩坑寫入 `%PIXIU_CORE%\vault\after-action\2026-04-27-docx-powershell-encoding.md`。
6. 建立決策紀錄：`%PIXIU_CORE%\vault\memory\decisions\2026-04-27-DOCX產生工具鏈標準化.md`。

## 🔄 進行中

- 目前步驟：已完成技能化與記憶同步。
- 整體進度：5 / 5 Phase 完成。
- 各 Phase 狀態：
  - Phase 1 補跑 Word 產檔：完成
  - Phase 2 讀取 skill 建立規範：完成
  - Phase 3 製作可重用文件產生工具：完成
  - Phase 4 寫回母體 skill 與問題紀錄：完成
  - Phase 5 執行 recap 並同步 Obsidian：完成
- 卡點：PowerShell 管線傳中文至 `python -` 會造成亂碼；已改用 UTF-8 檔案作為標準做法。

## 📐 當前規劃完整內容

架構設計：

- `make-docx` skill 繼續作為所有 Word 文件產生的入口。
- 對需求規格書這類高重複文件，新增 `scripts/make_requirement_docx.py`。
- 文件內容可由內建 sample 或 UTF-8 JSON spec 驅動。
- 中文內容不再透過 PowerShell pipe 傳給 Python，改由 UTF-8 檔案承載。

關鍵指令：

```powershell
python %PIXIU_CORE%\skills\make-docx\scripts\make_requirement_docx.py --sample ftp-monthly-message-report --output docs\FTP訊息單量彙整自動化需求規格書.docx
python %PIXIU_CORE%\skills\make-docx\scripts\make_requirement_docx.py --spec-json docs\spec.json --output docs\需求規格書.docx
```

驗證方式：

- 執行原始 workspace 腳本並確認 DOCX 成功輸出。
- 後續應用時需檢查輸出檔存在且大小大於 0。

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|----------|------|
| DOCX 產生方式 | Python 檔案 + python-docx | PowerShell pipe 到 `python -` | PowerShell 管線造成中文亂碼與非法檔名。 |
| 母體沉澱位置 | 更新既有 `make-docx` skill | 新增重複 skill | 母體已有 `make-docx`，更新既有能力比較乾淨。 |
| 可重用工具 | 新增 `scripts/make_requirement_docx.py` | 只保留一次性腳本 | 需求規格文件會重複出現，工具化可降低重寫成本。 |

## ⚠️ 發現的問題 / 踩坑

- PowerShell here-string pipe 到 Python 時，中文可能變成亂碼。
- 即使設定 `$OutputEncoding`，本次環境仍出現 `中文測試` 亂碼。
- 中文檔名變成問號會導致 Windows `OSError: [Errno 22] Invalid argument`。
- Node REPL MCP 因本機 Node 版本為 v16.20.2，低於需求 v22.22.0，無法使用該路徑處理文件。

## 📌 下次 session 要做的事

- [ ] 若再產生 DOCX，優先使用 `make-docx` skill 與 `scripts/make_requirement_docx.py`。
- [ ] 若要移除 workspace 的一次性腳本，需由使用者明確確認後再刪除。
- [ ] 若要讓工具支援更多文件類型，可擴充 JSON schema 的區塊型別。

## 💡 補充筆記

本次對母體的改動屬於框架級回寫：skill、script、after-action、decision、recap、memory-summary 均已同步。

產生時間：2026-04-27 10:38:53

## 補充驗證紀錄

- 可重用工具已產出 `docx_tool_validation.docx`，檔案大小大於 0。
- `quick_validate.py` 因 bundled Python 缺 `yaml` 套件未能執行完成；已用 frontmatter 與必要段落檢查替代。

