---
name: go
description: 依本次授權啟動 Pixiu 自我驗證；單一 Agent 依序實測、覆核、修復重驗，完成後按授權交付或推送。
origin: Pixiu
version: 0.2.0
---

# /go — Pixiu 驗證入口

讀取目前 checkout 的 `skills/pixiu-verify-loop/SKILL.md`；當目前專案不是 PixiuCore 時，使用已確認的 PIXIU_CORE 路徑。載入技能前核對來源，避免全域舊副本覆蓋本次指定版本。

## 行為契約

1. 從原始需求、既有專案慣例及程式碼建立可驗收條件；清楚標記假設。一般可逆細節可自主決定，業務語意或不可逆決策缺資料才確認。
2. 核對本次授權：唯讀審核保持唯讀；已授權實作／修復可在範圍內處理紅燈。相同失敗兩次無新證據先診斷，不原樣重試。
3. 單一 Agent 依序執行實測、重新讀取 diff、自我覆核與必要重驗；不以 /simplify 或角色切換暗中啟動其他 Agent，也不將自我覆核說成獨立審查。
4. CR 任務留下 VERIFY → RECHALLENGE、實際工具輸出與可驗證 state。執行 completion gate；非零 exit code 表示未完成。
5. 驗收通過後，已有本次 push 授權就直接推送；無授權則交付本機差異及 PR 內容草稿。Release、Deploy、DB 寫入、刪檔與額外 Agent 各自檢查授權。
6. 推送前重查遠端 SHA，保留他人提交；推送後讀回 SHA 與 CI 狀態。失敗、未執行及等待中如實區分。

## 參數

- `quick`：只跑指定實測；不將未執行的全套驗收標綠。
- `full`：實測、覆核、修復重驗及交付，預設使用本模式。
- `pr-only`：整理現有證據與 PR 內容草稿；缺少目前版本的驗證時標為未驗證，不推送。
- `dry-run`：只列規劃命令與 criteria，保留未執行狀態。

## 交接

沿用本次任務 ledger；無 ledger 時在授權專案 `.cr/` 保存 state、實測紀錄與 handoff。記錄目前 Git 版本、變更指紋、已完成項目、尚未驗收項目、失敗軌跡及唯一下一步；恢復時重新核對 Git。

此指令不切換模型、不啟動背景 Agent、不修改全域模型設定。推理強度只依實際 adapter 支援與授權處理，未確認的 actual 值保持 null。
