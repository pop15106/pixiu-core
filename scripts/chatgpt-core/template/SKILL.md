---
name: pixiu-core
description: 使用 PixiuCore 母體規範與可查核版本，按需載入 CR 研究、設計、開發、全流程、風險盤點、驗收與交接，以及母體工作流程。使用者要求 PixiuCore、載入或同步母體、開 CR、建立正式 CR、CR 完整自動接力、CR 風險盤點／審查、CRD 或明確選用母體的 /go、需求確認、報修與變更覆核時使用。單純提到 CR 字母或否定啟動時依原任務處理；一般問題不強制開啟 CR。
---

# PixiuCore 母體

## 版本與載入

本包的 `references/core/` 是母體唯讀快照根目錄；母體相對路徑以此解析。先讀短版 [版本紀錄](references/version.md)。大型 snapshot.json 供程式核對，不全文載入對話。首次使用回報母體版本、實際讀取的規格，以及對話內分析／正式執行狀態。未讀取的內容標示未確認；歷史對話是否載入須有紀錄佐證。

這是固定版本。核對遠端後才稱為最新。更新時驗證來源 commit 與檔案雜湊。遵守宿主及使用者本次指令，沿用有效授權；Skill 載入不增加外部操作或子 Agent 權限。

## 選擇流程

1. 明確要求純文字 Pro析／/prostyle、X析／/xstyle 或 CRD 時，直接讀對應的 [Pro](references/core/skills/analyze-pro-style/SKILL.md)、[XHigh](references/core/skills/analyze-xhigh-style/SKILL.md) 或 [CRD](references/core/skills/cr-deep-reasoning-no-mcp/SKILL.md)。載入後依規格關閉工具與子代理。已讀規格直接沿用；從開始要求零工具而規格不可見時請使用者貼入。維護、安裝或討論 Skill 不切換分析模式。
2. 其餘任務讀 [Bootstrap](references/core/vault/bootstrap/SESSION-BOOTSTRAP.md)，執行 `node <本 Skill 根目錄>/scripts/route.cjs "<本次需求>"`。只載入輸出的最多三個能力。不能執行時用 [能力與觸發索引](references/capabilities.md)；明寫路由腳本未執行。
3. CR 命中時讀 [CR](references/core/skills/critical-relay/SKILL.md)、[Lifecycle](references/core/skills/critical-relay-lifecycle/SKILL.md)、[流程](references/core/.agent/workflows/cr-lifecycle.md)、[Chat／Dev 規範](references/core/vault/governance/cr-chat-dev-policy.md) 及 [風險規範](references/core/vault/governance/cr-risk-review.md)。沿用同一案件，完成主張、支持與反證、取捨、實測、重新挑戰及風險驗收。
4. 其他母體功能依 [技能索引](references/core/skills/INDEX.md) 與 [Workflow 索引](references/workflows.md) 選取原文。外部資料缺失時明列依賴，保持可完成部分的既定流程。

## 上下文預算

包內保存完整功能，按當前任務與階段載入。大型文件使用原生分段工具，或 `node <本 Skill 根目錄>/scripts/read-section.cjs <母體相對路徑> <起始行> <行數>`；單次最多 80 行、12,000 UTF-8 bytes，附續讀位置。必要規格需續讀完才執行對應步驟。

同版本已讀內容以路徑、章節與摘要引用。原始證據保存在檔案；對話保留目標、決策、未解風險、驗證狀態及下一步。依 [載入政策](references/core/vault/context/ai-mothership-loading-policy.md) 執行。位元組限額不是宿主的 token 上限。

## 執行與完成

需要工具、帳本、文件、推送或交接時，讀 [相容性](references/compatibility.md) 與 [操作細則](references/usage.md)，核對實際工具、工作區、版本及既有授權。用目標專案原帳本及真實證據；分別回報對話內分析、正式帳本登錄、程式 Gate、實際產品驗證與遠端結果。

風險接受須回讀明確使用者紀錄；處置證據綁定當次版本、環境與範圍。來源按原始出處分組；同模型多輪覆核稱為自我覆核。維持單一執行者，缺少必要獨立審查時列為缺口。

模型切換、Hooks、背景排程、自動接續、主動推播與工作機服務，均須有實際可用的宿主或工具支援。未執行項保持未驗證。版本或範圍變更後重新驗證。
