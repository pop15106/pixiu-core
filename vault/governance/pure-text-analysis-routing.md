# 純文字分析路由規範

使用者明確要求 Pro 參考分析、Pro析、/prostyle 或 analyze-pro-style 時，載入 `skills/analyze-style/SKILL.md` 與 `skills/analyze-style/references/pro.md`；要求 XHigh 參考分析、X析、/xstyle 或 analyze-xhigh-style 時，載入同一份 SKILL.md 與 `references/xhigh.md`。兩種模式（2026-11 由兩個 Skill 合併為 `analyze-style`）以同一模型依序切換視角，包含目標與計畫、原值與來源、多輪覆核及驗收。

這類純文字要求先於一般 Capability Router 處理：只載入明確選用的規格；規格已在對話中時直接沿用。完成載入後，依該 Skill 維持工具、MCP、外部查詢及子代理關閉。來源或測試不足時交付未執行的查核計畫。使用者要求從開始就零工具而規格尚不可見時，請其貼入完整文字版。載入行為與額度依宿主判定，不宣稱免額度。

Claude Code 改用 `.claude/skills/analyze-style/`：分層與查核規則相同，但分析時可唯讀取證（讀檔、搜尋、git 歷史、唯讀查詢），不修改檔案、不啟動子代理；規格識別為 `pro-evidence-20261117-r1`／`xhigh-evidence-20261117-r1`。

更新、安裝或評估 Skill 本身，以及複製母體，依使用者授權走一般作業；提到 Skill 名稱不代表切換成該分析流程。保留 CRD 與 Codex Dynamic Router 的既有規範，不自動啟動 CR 或升級模型。
