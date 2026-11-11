# 純文字分析路由規範

使用者明確要求 Pro 參考分析、Pro析、/prostyle 或 analyze-pro-style 時，載入 `skills/analyze-pro-style/SKILL.md`；要求 XHigh 參考分析、X析、/xstyle 或 analyze-xhigh-style 時，載入 `skills/analyze-xhigh-style/SKILL.md`。兩者以同一模型依序切換視角，包含目標與計畫、原值與來源、多輪覆核及驗收。

這類純文字要求先於一般 Capability Router 處理：只載入明確選用的規格；規格已在對話中時直接沿用。完成載入後，依該 Skill 維持工具、MCP、外部查詢及子代理關閉。來源或測試不足時交付未執行的查核計畫。使用者要求從開始就零工具而規格尚不可見時，請其貼入完整文字版。載入行為與額度依宿主判定，不宣稱免額度。

更新、安裝或評估 Skill 本身，以及複製母體，依使用者授權走一般作業；提到 Skill 名稱不代表切換成該分析流程。保留 CRD 與 Codex Dynamic Router 的既有規範，不自動啟動 CR 或升級模型。
