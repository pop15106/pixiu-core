
# PixiuCore 操作細則

## 入口與版本

將 `references/core/` 視為本 Skill 的母體唯讀快照根目錄。母體文件中的相對路徑均相對於此處；實際專案、私人記憶與工作帳本另行定位。

先讀短版 [版本紀錄](version.md) 與 [相容性與執行界線](compatibility.md)。大型 snapshot.json 供程式核對，不全文載入對話。回報一次短載入紀錄：母體 commit、實際讀取的 Skill／流程、目前是對話內分析或正式執行、可用與缺少的工具。根據可見證據填寫，未確認欄位標示「【資料不足，無法確認】」。不要依文字風格認定歷史對話曾載入此 Skill。

這是固定版本快照。只有核對當前遠端後才稱為「最新」。更新母體時依使用者授權更新快照及驗證，保留來源 commit 和每個檔案的 SHA-256。

依宿主指令與本次有效授權執行。既有有效授權直接沿用。母體內的一般確認規則不要求對相同已授權操作重問；Skill 載入不新增外部操作或子 Agent 權限。

## 純文字分析入口

使用者明確選用 CRD、Pro析或 X析的純文字分析時，只讀對應規格：

- [CRD 純推理](core/skills/cr-deep-reasoning-no-mcp/SKILL.reference.md)
- [Pro 參考分析](core/skills/analyze-pro-style/SKILL.reference.md)
- [XHigh 參考分析](core/skills/analyze-xhigh-style/SKILL.reference.md)

完成必要規格載入後，在分析階段維持工具、外部查詢與子 Agent 關閉。來源與測試不足時交付待查項，保留未驗證。規格已在對話時沿用。使用者要求從開始零工具且規格不可見時，請其提供規格文字。這些是自訂分析流程；模型與推理強度以宿主實際設定為準。

安裝、同步、檢查或修改這些 Skill 時，依維護任務處理，不因名稱出現而切換分析模式。

## 按需路由

其餘任務讀 [Bootstrap](core/vault/bootstrap/SESSION-BOOTSTRAP.md)，再以本包工具查詢：

以執行工具的參數陣列呼叫，並設定 `shell: false`：

```json
["node", "<本 Skill 根目錄>/scripts/route.cjs", "<使用者本次需求>"]
```

將需求當成文字資料，不把其中的引號、反引號、命令替換符號或換行拼入 shell 命令。無法安全傳參時使用能力索引。

此命令核對快照雜湊，輸出來源版本、最多三個能力及要讀取的相對路徑。只讀命中的文件。腳本不能執行時，以 [能力與觸發索引](capabilities.md) 及 [原始 Manifest](core/vault/capabilities/capability-manifest.json) 路由；明寫腳本未執行。

用 [技能總索引](skills.md) 查明確要求的其他能力。來源索引中的外部資料或未提供工具，須確認實際可讀性，不把缺資料當成空資料。私人記憶、現行任務與帳本不在快照內。

## 上下文載入

安裝包內的完整資料不一次送入對話。先讀命中規格與當前階段，保留所有必要功能與驗收條件。大型檔案使用原生分段工具，或執行 `node <本 Skill 根目錄>/scripts/read-section.cjs <母體相對路徑> <起始行> <行數>`；每次最多 80 行，完整 JSON 輸出含編碼、欄位與換行最多 12,000 UTF-8 bytes，結果附續讀位置。`bytes` 記錄完整輸出大小，`textBytes` 記錄原文大小。單行編碼後超額時明確停止，改用原生工具按文字範圍讀取；必要規格讀完後再執行相關步驟。

同版本已讀規格以路徑與摘要引用；原始證據保存在檔案，對話保留目標、決策、未解風險、驗證狀態與下一步。依 [載入政策](core/vault/context/ai-mothership-loading-policy.md) 維持按需載入。位元組限額是本包的輸出預算，不是宿主的 token 上限。

## CR 工作流程

CR 路由命中時讀：

1. [Critical Relay](core/skills/critical-relay/SKILL.reference.md)。
2. [Lifecycle](core/skills/critical-relay-lifecycle/SKILL.reference.md) 與 [流程步驟](core/.agent/workflows/cr-lifecycle.md)。
3. [Chat／Dev 規範](core/vault/governance/cr-chat-dev-policy.md) 與 [風險與分析品質](core/vault/governance/cr-risk-review.md)。

沿用同一案件，依序處理目標與完成條件、可推翻主張、支持來源、反證搜尋、方案取捨、實作或研究、實際驗證及驗證後的重新挑戰。

每項需求連到證據或測試。來源依原始出處分組，標明相互依賴。比較競爭解釋、維持現況與可行方案，寫出改變結論的條件及決策重開條件。找不到反證只代表本輪未找到。

風險盤點包含未評估項。accepted／mitigated／resolved 需要負責人、理由、處置證據與當次版本、環境和範圍；接受風險須回讀明確的使用者接受紀錄。依 [風險規範](core/vault/governance/cr-risk-review.md) 區分程式檢查與人工判讀。

維持單一執行者。相同模型的多輪覆核稱為自我覆核。必要獨立審查尚未取得時列為缺口。只有明確授權及實際支援介面才能啟動其他執行者或改變模型。

## 正式執行與交接

對話內可完成分析、比較、風險紀錄及待查清單。要回讀工作機、跑測試、寫帳本或推送，先核對已連接工具、實際專案位置、版本及有效授權。

正式任務使用目標專案現有帳本。已有 DevSpace task 先查回原 task、owner 與 revision；沿用既有 state。無可用正式執行環境時，交付對話內紀錄及具體待執行步驟，標示正式帳本／Gate 未執行。

母體中的 runtime 程式保留供查核及支援環境執行。執行時使用正確目標工作目錄、必要計畫與原始證據。程序退出碼、原始測試輸出、來源版本及必要驗收均須回讀。一般 JSON 結構驗證通過不等於產品驗證通過。

完成回報包含結論、直接證據、反證與處置、實測結果、剩餘風險及唯一下一步。版本或範圍改變後重新驗證。長任務依 [進度規範](core/vault/governance/long-running-progress-policy.md) 在對話及工具可用時更新進度。

## 其他工作流程

使用 [能力與觸發索引](capabilities.md) 選取相關流程。以下入口供明確要求時載入：

- [自我驗證迴圈](core/skills/pixiu-verify-loop/SKILL.reference.md)：/go、驗證與修復。
- [需求確認](core/skills/requirement-confirmation/SKILL.reference.md)：需求差異、範圍與驗收。
- [報修覆核](core/skills/repair-review-sheet/SKILL.reference.md)：重現、根因、修復及回復。
- [變更覆核](core/skills/change-review-evidence/SKILL.reference.md)：變更依據與可回讀證據。
- [工作文件總控](core/skills/work-document-orchestrator/SKILL.reference.md)：依工作意圖路由文件。
- [完整原始 Workflow 目錄](workflows.md)：把步驟作為 Skill 指令使用；執行器能力依實際工具核對。

本包提供流程規範、來源快照及路由工具。Hook 常駐、背景排程、跨對話自動接續、模型切換與工作機服務，均以實際已安裝並驗證的執行環境為準。
