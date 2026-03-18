---
name: safety-guardrails
description: Agent 護欄與防呆補丁（確保遵循最小改動、不擴張需求之原則）
version: 1.0.0
type: safety
---

# 🛡️ 系統護欄與防呆補丁 (Safety Guardrails)

在調用或觸發其他 `.agent/skills/` 或 `.agent/workflows/` 時，**必須**優先遵守本防呆補丁。

## 💥 護欄一：高放射性技能之 Tag Isolation (針對重構與 UI)

**受管制技能：**
- `performance.skill.md`
- `ui-design.skill.md`
- `context-optimization.skill.md`
- `db-schema.skill.md`

**管制條款 [Requires Explicit Authorization]：**
當 Agent 執行前述涉及「效能調優」、「新 UI 設計」、「系統性重構」之技能時，**若非為修復導致系統崩潰的致命 Bug**，則：
1. **禁止直接修改原始碼**。
2. 所有改善提案皆必須轉化為「純文字建議」或生成 `.md` 分析報告。
3. 產生報告後暫停行動，取得使用者的「明確核可 (Explicit Approval)」後方可進行實作。
4. 在任何情況下，皆須遵守「最小改動範圍」的鐵律。

## 👁️ 護欄二：UX 相關任務之保護鎖定 (針對 UxSoul-scan)

**受管制工作流與技能：**
- `UxSoul-scan.md`
- `UxSoul-extractor.skill.md`

**管制條款 [Read-Only Bounds]：**
此類技能與工作流性質屬於「檢索與分析（Read-Only）」。
1. **禁止未授權改動**：掃描並發現使用者體驗問題後，Agent **絕對禁止**在沒有使用者具體指令的情況下，擅自修改前端畫面或底層邏輯代碼。
2. 掃描結果僅能產生為 `UX_Report.md` 或類似格式供使用者審查。
3. 未經指示前，嚴禁提供「擴張需求」的發散性實作（例如：擅加新特效、改變原有既定的路由規劃）。

## ⚠️ 護欄三：具體的高風險操作量化定義 (針對 Debugging)

**受管制技能：**
- `systematic-debugging.skill.md`
- `security.skill.md`

**管制條款 [High-Risk Execution Block]：**
除錯過程中，若判定需要進行修改，下列情況視為「**高風險操作**」，必須停止並取得使用者同意才能執行：
1. **結構變更**：任何針對 Database Schema 的 `ALTER`, `DROP` 建議或實作。
2. **大規模抹除**：刪除或取代現有代碼總計**超過 30 行**。
3. **介面變動**：修改已有的核心對外 API 簽名 (Signature) 或 Payload 模型設定。
4. **重大狀態重置**：清除關鍵快取、重置現有資料庫等會影響既有測試資料/環境的動作。

---
> 🧠 **Agent 自我檢核提示 (Verification)**: 
> 當您即將發佈一個包含代碼改寫的 Tool Call 時，請先自問：這是否踩到了護欄？如果是，回到思考層面改為「提案詢問」。
