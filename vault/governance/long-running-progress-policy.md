---
type: governance
date: 2026-09-23
lastVerified: 2026-09-23
project: PIXIUCORE
system: PIXIUCORE
topic: long-running-progress-policy
status: active
tags: [pixiucore, governance, progress, polling, ci, release, automation]
summary: 長時間任務與完整自動接力的可見進度、輪詢心跳、階段切換與 Git／Release 完成驗證規則。
---

# 長時間任務可見進度與輪詢政策

> 本政策只規範「可見進度與輪詢」。它不新增任何寫入、Git push、Release、Deploy、Agent Team 或安全權限，也不取代既有審批閘門。

## 1. 觸發條件

符合下列任一條件時，啟用本政策：

- 使用者說「完整自動接力」。
- 使用者說「自動接力」。
- 工作進入 GitHub Actions。
- 工作進入 CI。
- 工作進入 Build。
- 工作進入 Test。
- 工作進入 Release。
- 工作進入 Deploy。
- 預期等待超過 60 秒。
- 工具提供 process session、run ID、job ID 或 workflow ID，可持續查詢狀態。

只要命中其中一項，就不得長時間完全沒有可見狀態。

## 2. 可見狀態

對使用者回報時使用下列狀態：

- 🟡 **執行中**：工作已開始，正在進行目前階段。
- 🔄 **輪詢中**：背景流程仍在執行，正在查詢最新狀態。
- ✅ **階段完成**：目前階段已完成，準備進入下一階段。
- 🔴 **失敗／修復中**：發現失敗，正在蒐集錯誤或依既有授權範圍修復。
- 🟢 **全部完成**：所有必要階段與驗證都已完成。

狀態文字可依任務補充目前階段、run／job／session ID、已完成項目與下一步，但不得以狀態訊息取代實際驗證。

## 3. 輪詢規則

1. 長時間工作開始前，先回報一次可見狀態。
2. 可輪詢背景流程以 **30–60 秒**為目標間隔查詢一次。
3. 優先使用非阻塞方式，避免單次工具呼叫長時間佔住控制權。
4. 本機長命令若工具提供 session ID，優先保留 session 並用 ID 查詢，而不是反覆重啟命令。
5. GitHub Actions／CI 若提供 run ID、job ID 或 workflow ID，優先使用該 ID 查詢同一執行個體。
6. 階段切換時立即回報，不等待下一個輪詢週期。
7. 同一階段長時間沒有狀態變化，也要保留心跳；心跳至少說明「仍在同一階段」與最後一次已知狀態。
8. 完成必要驗證後，才能結束完整自動接力並回報 🟢 全部完成。
9. 若工具本身阻塞超過目標輪詢間隔，控制權回來後改用可輪詢、較短等待或狀態查詢方式；不得因一次長阻塞而持續靜默。
10. 若平台或工具不支援主動輪詢，必須明確說明限制，並在每次重新取得可用狀態時立即更新。

## 4. 失敗與修復回報

- 一旦確認失敗，立即切換為 🔴 失敗／修復中。
- 回報已確認的錯誤、目前停在哪一階段，以及下一個安全動作。
- 沒有既有寫入或修復授權時，只能做唯讀診斷並回到原有審批閘門。
- 修復後重新進入原階段時，回報新的執行 ID 或重試次數，避免把舊失敗 run 誤認為新 run。

## 5. Git／Release 完成回報

Git、Release、Deploy 類工作完成時，最終回報至少包含：

- **final status**：成功、失敗或部分完成。
- **commit SHA**：本次最終 commit；未產生則明確標示。
- **tag**：本次 tag；未建立則明確標示。
- **release URL / workflow URL**：有建立或執行時提供；沒有則明確標示。
- **assets / delivery verification**：逐項說明必要資產、交付物或部署結果是否已驗證。
- **未完成項目**：任何尚未完成、未驗證或被權限阻擋的項目。

只有 commit、tag、release、assets／delivery 等本次實際要求的必要項目都完成驗證後，才可宣稱整體工作完成。

## 6. Critical Relay 整合

當 Capability Router 同時命中 `critical-reasoning` 與 `execution-progress` 時，完整自動接力必須把 Critical Relay completion gate 納入完成判斷：

1. 先執行原任務的搜尋、分析、實作或驗證。
2. 對核心 claims 執行 CHALLENGE，明確提出可推翻它的條件。
3. 主動執行 COUNTERSEARCH／反例測試，保存 counterEvidence。
4. 重新判斷 claims；有新反證時進入 REASSESS／REPAIR，不因固定輪數停止。
5. VERIFY 通過後仍要執行 RECHALLENGE。
6. 只有 `scripts/critical-relay/critical-relay.js` 的 completion gate 沒有 blocker，才可進入 READY_TO_HANDOFF 或回報 🟢 全部完成。
7. 跨 Session／模型交棒時，保留 canonical Critical Relay state；可放入既有 workflow `contextSnapshot`，不得只交接最終結論而遺失反證與未知項。

Critical Relay 只增加懷疑、反證與完成閘門；它不新增任何 Agent、寫入、push、Release、Deploy 或 Production 權限。

## 7. 權限與安全邊界

本政策不得被解讀為任何額外授權。以下規則維持原狀：

- 寫入審批。
- Git push 審批。
- Release／Deploy 權限。
- Agent Team／subagent 權限。
- 刪檔、依賴、DB、秘密資料與其他安全規則。
- 分階段任務的既有審核門檻。

「完整自動接力」只代表需要持續推進已授權工作並維持可見進度；不代表可以跳過任何 L0 或安全閘門。
