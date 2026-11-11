---
name: verification-loop
description: 驗證共用檢查清單。依專案實際工具執行建置、型別、測試、安全及差異覆核；授權與修復行為依 pixiu-verify-loop。
origin: ECC / Pixiu
version: 0.3.0
language: zh-TW
---

# 驗證共用檢查清單

先讀 `skills/pixiu-verify-loop/SKILL.md` 判定本次授權。這份清單不自行授予修復、推送或啟動 Agent 的權限。

## 依修改範圍選擇檢查

| 項目 | 執行依據 | 成功證據 |
| --- | --- | --- |
| 建置 | 實際 pom.xml、Gradle、package scripts 或其他建置設定 | 完整命令、exitCode=0、產物檢查 |
| 型別／Lint | 專案既有設定與工具 | 結果及未處理項目 |
| 單元／整合 | 本次需求與受影響依賴 | 正常、錯誤、邊界及回歸結果 |
| UI／API | 真實操作流程與請求內容 | 操作紀錄、請求／回應及必要截圖 |
| 安全 | 改動涉及的輸入、授權、憑證與依賴 | diff 覆核或既有掃描工具結果 |
| 交付差異 | 明確 baseSha、目標版本及新增檔案 | 完整範圍清單與未預期變更檢查 |

Java 版本等技術限制以專案設定為準，通用技能不硬套版本、框架或虛構指令。沿用既有 coverage 門檻；沒有量測就標 NOT_MEASURED，不自行宣稱百分比。

## 分段驗證

先跑改動對應的小測試，再跑受影響回歸；每個最小可交付單位都有驗收證據。修正或收斂後重驗。只要輸入版本不同，就重新核對測試結果。

保存真實命令的 exit code，再截取輸出摘要。避免以 `command | head`、`command | tail` 的最後成功碼掩蓋測試失敗。命令找不到、測試零筆或測試工具不可用，保留原始結果並標記 NOT_RUN／FAIL。

已授權修復的紅燈依 `pixiu-verify-loop` 進 REPAIR；唯讀審核保持唯讀。單一 Agent 依序讀取 diff 做自我覆核，有獨立覆核要求時照實保留缺口。

## v2 事前計劃與證據回讀

完整交付使用 `scripts/critical-relay/README.md` 的 v2 入口：先固定必要計劃，再執行與保存原始事件。正式完成入口回讀 run、統計、檔案指紋與目前 Git 工作區。必要測試不能在失敗後刪除或改為非必要；測試數為零、全部略過或來源改變時保持未完成。一般 build／document／UI／API 驗證需要自己的 adapter，不能套用 Node 通過數假冒。

公共核心按 `resourcePolicy` 區分公開必要檔與本機私人脈絡。私人內容不納入公共測試；指定能力真的需要私人內容時，另列缺少的前置資料。

## 證據與完成

測試紀錄至少包含 command、exitCode、outputRef、headSha、changeDigest、測試數及各結果。headSha 和 changeDigest 對應實際受驗收版本；changeDigest 涵蓋新增檔案，排除自身證據檔時明確記錄範圍。

PASS、FAIL、NOT_RUN 與 N/A 分開列出，N/A 附理由；必要驗收未執行就維持未完成。文件型任務驗證 read-back、連結、編碼與發布一致性，不假裝做了 UI 操作。

CR 任務在 VERIFY 之後進 RECHALLENGE，再跑 completion gate。完成報告列出變更、驗證、剩餘風險、commit、push 與 CI 狀態。測試輸出含秘密資料時遮蔽敏感值再留存。
