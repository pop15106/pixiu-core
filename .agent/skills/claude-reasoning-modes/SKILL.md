---
name: claude-reasoning-modes
description: 萃取 Claude AI 的 8 大核心運作模式（深度思考、思維鏈推理、自我修正、任務分解、安全護欄、成品驅動、上下文管理、後設意識），提供可直接注入專案的 System Prompt 範本與導入指南。
---

# Claude AI 運作模式 Skill

## 📖 總覽

本 Skill 提供 Claude AI 的 core思維模式分析與可操作的導入方案，讓你的專案中任何 AI 助手都能遵循這套高品質工作模式。

## 📁 檔案結構

```
claude-reasoning-modes/
├── SKILL.md                        ← 你正在看的入口文件
├── claude_reasoning_modes.md       ← 8 大核心模式的完整分析

└── claude_integration_guide.md     ← 3 種導入方式的操作指南
```

## 🚀 快速啟動

### 被 AI 自動載入時

AI 助手讀取本 Skill 後，應自動套用以下行為：

1. **思考前先拆解**：遇到複雜問題時，先拆成子問題再推理
2. **推理有錨點**：每個結論必須引用事實依據（行號、錯誤訊息、設定值）
3. **輸出前自審**：產出程式碼前檢查邊界值、失敗路徑、回歸風險
4. **三段式工作流**：PLANNING → EXECUTION → VERIFICATION，階段間需用戶閘門
5. **安全護欄常駐**：禁止硬編碼密鑰、禁止毀滅性操作、高風險操作需確認

### 手動使用時

在對話中輸入以下指令之一：

> 「請載入 claude-reasoning-modes skill，用深度思考模式分析這個 Bug。」

> 「參考 claude-reasoning-modes 的自我修正檢查清單，審查我剛寫的程式碼。」

## 🔗 與 Architect Protocol 的關係

本 Skill 是 `architect-protocol` 的**互補強化層**，不取代它。兩者共存時的分層：

- **底層**：安全護欄（本 Skill 的模式 0）
- **流程層**：Architect Protocol 的模組 1-5
- **品質層**：本 Skill 的深度思考 + 思維鏈 + 自我修正
- **溝通層**：本 Skill 的成品驅動 + 上下文管理

## 📚 延伸閱讀

- [完整模式分析](claude_reasoning_modes.md)
- [導入指南](claude_integration_guide.md)
