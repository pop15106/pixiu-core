---
type: reference-context
date: 2026-05-15
project: PCLMS
system: PCLMS
repo: PCLMS_AP
topic: tech-stack
status: reference
summary: 提供 PCLMS 相關任務的技術棧與架構決定背景，供後續設計與 tracing 使用。
tags: [pclms, tech-stack, reference-context]
readAt: when-relevant
applyTo: 技術選型、架構決策
---

# Tech Stack — 技術棧與架構決定紀錄

> 記錄已確認的技術選型與架構決定。
> 做新決定時先查這裡，避免重複討論已確認的事。

## 已確認技術棧

### 後端
| 項目 | 技術 | 備註 |
|------|------|------|
| 語言 | Java | <!-- TODO: 確認版本 --> |
| 框架 | Spring MVC | servlet 架構 |
| 建置 | Maven | pclms_mvn |
| 設定 | xdao.xml | DAO 層設定 |

### 前端
| 項目 | 技術 | 備註 |
|------|------|------|
| 框架 | <!-- TODO --> | 待確認 |
| 打包 | <!-- TODO --> | 待確認 |

### 開發環境
| 項目 | 技術 |
|------|------|
| OS | Windows 11 |
| Shell | Git Bash |
| IDE | VSCode（含 Claude Code 擴充）|
| AI | Claude Code + Gemini CLI + Codex |

## 架構決定紀錄（ADR）

### ADR-001：Pixiu Vault 放置位置
- **日期**：2026-04-16
- **決定**：vault 放在 `%PIXIU_CORE%\vault\`
- **原因**：全域共用、所有接線母體的專案自動繼承、不綁定特定專案
- **替代方案**：放在各專案內（被否決，因為需要重複設定）

---
_新增 ADR 時，請依格式追加在最下方。_
