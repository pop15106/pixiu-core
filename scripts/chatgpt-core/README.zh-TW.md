# ChatGPT 母體適配

`scripts/chatgpt-core/template/` 是個人 PixiuCore Skill 的版本化範本。母體原文與規格由已提交的 Git archive 匯入，產生的 `references/core/` 只存於個人 Skill 的候選版或已安裝版，避免母體反覆包入自己的快照。

## 三層分工

GitHub 保留完整母體與版本。ChatGPT 的單一 Skill 保存固定版本快照，主入口只做路由與必要邊界說明。對話使用短指令選取流程，再按需讀取規格。

原始 Workflow 轉為 Skill 可讀取的步驟，不需要另外宣稱宿主具備原生 Workflow 執行器。依賴服務、排程或外部工具的步驟，仍按實際可用能力執行。完整原文隨候選安裝包接受相同平台檢查；安全掃描拒絕時保留候選版並查核原因。

## 安裝與同步

1. 依宿主 Skill Creator 流程在實際個人技能目錄初始化 `pixiu-core`，再複製本目錄的 `template/` 內容。
2. 將母體變更驗證並提交，記錄完整 40 字元 commit。使用 `git -c core.autocrlf=false archive` 與該 commit 建立封存，保持跨平台位元組一致；納入入口文件、`vault/bootstrap`、`vault/capabilities`、`vault/governance`、`vault/context`、`vault/sop`、`vault/templates`、`rules`、`.agent/workflows`、`commands`、`skills/INDEX.md`、第一層技能目錄，以及 `scripts/router`、`scripts/critical-relay`、`scripts/codex-native-core`、`scripts/chatgpt-core`。
3. 在實際個人 Skill 執行 `python scripts/import-snapshot.py --archive <archive.tar.gz> --commit <完整 commit>`。匯入器核對 Git archive 內的 commit 與適配範本的實際位元組，排除母體標記的本機私人資料與第三方大型子模組。快照已有未保存修改時先停止，由維護者處理。
4. 執行 `node scripts/verify-snapshot.cjs`、`node --test scripts/skill.test.cjs`、`python3 scripts/import-snapshot.test.py`，並依宿主工具驗證 Skill 格式。以實際觸發詞檢查 `scripts/route.cjs`，確認能力、外部依賴與版本。
5. 將個人 Skill 的變更同步至宿主指定的技能儲存庫，等待服務登錄後回讀確認。只有本機檔案完成時，回報為已準備；遠端登錄及來源雜湊核對完成後，才回報已安裝。

更新時先更新本範本、提交母體，再依上述步驟重建固定版本快照。保留既有其他個人技能。

匯入器先驗證封存路徑與檔名對照，拒絕目的地的符號連結、Windows 目錄連結及特殊檔案。新內容與索引先在本 Skill 內的暫存目錄完整產生，再交換目錄；交換失敗時還原舊副本，還原失敗則保留備份路徑供維護者處理。來源已有未保存修改時停止。這些檢查用來避免寫到錯誤位置或遺失舊快照，不能取代平台安全審查。

嵌入技能的 `SKILL.md` 以 `SKILL.reference.md` 儲存，保留原始內容並在 snapshot.json 記錄路徑對照。只有最外層入口使用 `SKILL.md`，符合一次安裝一個 Skill 的服務規則。分段工具仍接受母體原始路徑；`node scripts/materialize-source.cjs` 可在新暫存目錄完整還原原始檔名與位元組，供需要標準來源樹的工具使用。

## 上下文與相容性

- 主入口只處理路由、版本與執行邊界；`references/version.md` 是短版版本紀錄，完整 `snapshot.json` 由程式驗證。
- 一次選擇最多三個能力。大型來源使用分段工具，每次最多 80 行；完整 JSON 輸出含跳脫字元、欄位及結尾換行最多 12,000 UTF-8 bytes。`bytes` 記錄完整輸出大小，`textBytes` 記錄原文大小，`nextLine` 指向續讀位置。單行編碼後超額時明確停止，改用原生工具按文字範圍讀取；必要規格讀完後才執行對應步驟。
- 同版本內容引用章節與摘要，證據原文留在檔案；bytes 預算與宿主 token 上限分開記錄。
- 原始 Workflow 保留為可讀取的操作規格，由 Skill 路由與執行。正式帳本、測試、工作機服務及外部寫入仍需實際工具、工作區和有效授權。
- 模型切換、Hooks、排程、背景接續、推播及 DevSpace 服務不會由文字 Skill 自動提供。各項能力以當次環境的實際支援為準。
