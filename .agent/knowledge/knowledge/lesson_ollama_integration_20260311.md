# 經驗記錄：本地 LLM (Ollama) 整合與執行模式

## 📋 任務背景
使用者希望在開發環境中整合本地 LLM (Ollama)，但在初次嘗試下載 Hugging Face 模型時遇到 Error 400 錯誤。隨後在整合過程中，因資安與網路流量考量決定暫緩下載。

## 🛠️ 技術細節：Ollama Error 400 修復
- **問題現象**：執行 `ollama run hf.co/Jackrong/Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-GGUF` 時回傳 `Error 400`。
- **根本原因**：Ollama 在處理來自 Hugging Face (hf.co) 的庫存時，若未指定特定的量化版本標籤 (Tag)，可能會導致請求失敗。
- **解決方案**：必須明確指定量化版本。
    - **正確指令**：
      ```powershell
      & 'C:\Users\7010\AppData\Local\Programs\Ollama\ollama.exe' run hf.co/Jackrong/Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-GGUF:Q4_K_M
      ```
- **連線配置 (OpenAI Compatible)**：
    - **Base URL**: `http://localhost:11434/v1`
    - **Model ID**: `hf.co/Jackrong/Qwen3.5-9B-Claude-4.6-Opus-Reasoning-Distilled-GGUF:Q4_K_M`

## 🤝 執行模式與互動紀錄
### 1. 母艦模式 (Mothership Mode)
- **環境識別**：成功識別 `PIXIU_CORE_PATH` 並導入全域治理架構。
- **Persona 角色**：維持「技術導師 (Tech Lead)」風格，強調穩健的基礎設施建設與「授人以漁」。

### 2. 協作協議 (Collaboration Protocol)
- **資安優先 (Security Awareness)**：
    - 當使用者提出「擔心資安抓網路使用量 (流量監控)」時，Agent 展現出高度的理解與配合。
    - **反應機制**：主動將大流量任務 (5-6GB 模型下載) 列為「暫緩」狀態，轉而處理不消耗外部流量的程式碼分析任務 (BOM 表分析)。
- **敏捷調整 (Execution Agility)**：
    - 任務優先級隨時根據使用者現實環境限制調整。
    - 對話中保持透明度，總結斷點紀錄，確保使用者隨時可以接續進度。

### 3. 反思與收穫
- 對於本地部署的大型資源（如 LLM 模型），應在執行前主動提醒流量成本。
- 本次互動體現了 AI Agent 不僅是程式碼撰寫者，更是具備「環境感知」能力的開發夥伴，能配合企業資安規範靈活調整策略。

---
*記錄時間：2026-03-11*
*記錄者：Antigravity (Pixiu Agent)*
