# Pixiu 母艦技能索引目錄 (SKILLS_INDEX)

> 176+ skills · 76 slash commands · 50 rules
> 標注 🔵 = 任何 AI 工具可用（Gemini/Cursor/Windsurf 等）
> 標注 🟣 = 需要 Claude Code 才能使用

---

## 🤖 專業代理 Agents 🟣

*位於 `C:\PixiuCore\.agent\skills\`，透過 `additionalDirectories` 載入*

| 代理 | 功能 | 觸發時機 |
|------|------|----------|
| `planner` | 複雜功能規劃、架構決策 | 要求實作新功能時自動觸發 |
| `architect` | 系統架構、擴展性設計 | 規劃新系統或大型重構 |
| `tdd-guide` | 測試驅動開發，80%+ 覆蓋率 | 寫新功能或修 bug |
| `code-reviewer` | 品質、安全性、可維護性審查 | 每次改 code 後必用 |
| `security-reviewer` | OWASP Top 10、SSRF、注入漏洞 | 碰到 user input、認證、API |
| `build-error-resolver` | TypeScript/JS 建置錯誤修復 | build 失敗時 |
| `refactor-cleaner` | 死碼清除、重複程式碼整合 | 重構時 |
| `e2e-runner` | E2E 測試生成與執行（Playwright）| 寫 E2E 測試 |
| `database-reviewer` | PostgreSQL 查詢優化、Supabase | 寫 SQL 或設計 Schema |
| `doc-updater` | 文件與 codemap 更新 | 完成功能後 |
| `docs-lookup` | 即時查詢函式庫文件（Context7）| 問 API 用法 |
| `chief-of-staff` | Email/Slack/LINE 訊息分類、草擬回覆 | 管理多管道通訊 |
| `loop-operator` | 自主 agent 迴圈監控與介入 | 長時間 agent 任務 |
| `harness-optimizer` | agent harness 設定優化 | 調整 AI 設定 |
| `go-reviewer` | Go 慣用模式、並發安全 | Go 專案 |
| `cpp-reviewer` | C++ 記憶體安全、現代 C++ | C++ 專案 |
| `rust-reviewer` | 所有權、生命週期、unsafe | Rust 專案 |
| `kotlin-reviewer` | Kotlin/Android/KMP、協程安全 | Kotlin 專案 |
| `java-reviewer` | Java/Spring Boot、JPA、安全 | Java 專案 |
| `python-reviewer` | PEP 8、型別提示、安全性 | Python 專案 |
| `cpp-build-resolver` | C++ CMake 編譯錯誤修復 | C++ build 失敗 |
| `go-build-resolver` | Go vet 警告修復 | Go build 失敗 |
| `rust-build-resolver` | cargo 編譯、借用檢查器錯誤 | Rust build 失敗 |
| `kotlin-build-resolver` | Kotlin/Gradle 建置錯誤 | Kotlin build 失敗 |
| `java-build-resolver` | Java/Maven/Gradle 建置錯誤 | Java build 失敗 |

---

## 🧠 知識型 Skills（規則與框架）

### 🔵 通用型（Gemini/任何工具可用）

| 技能 | 功能 |
|------|------|
| `bdi-mental-states.skill` | BDI 認知模型推理框架（信念-慾望-意圖）|
| `brainstorming.skill` | 系統化腦力激盪規則 |
| `context-optimization.skill` | 上下文壓縮優化，減少 token 浪費（Gemini 尤其需要）|
| `systematic-debugging.skill` | 系統化 debug 流程 |
| `verification-before-completion.skill` | 完成前必做驗證清單 |
| `writing-plans.skill` | 計畫文件撰寫規範 |
| `naming-convention.skill` | 命名規範（變數、函數、檔案）|
| `error-handling.skill` | 錯誤處理模式與規範 |
| `performance.skill` | 效能優化規則 |
| `security.skill` | 安全開發規範（通用）|
| `research.skill` | 研究任務執行框架 |
| `visualization.skill` | 資料視覺化規範 |
| `ui-design.skill` | UI 設計規範 |
| `api-design.skill` | API 設計規範 |
| `tdd-workflow.skill` | TDD 工作流程規範 |
| `code-review.skill` | 程式碼審查規範（通用）|
| `tech-stack.skill` | 技術棧選擇規範 |
| `payment.skill` | 支付系統整合規範 |
| `db-schema.skill` | 資料庫 Schema 設計規範 |
| `md-to-docx.skill` | Markdown 轉 Word 規範 |
| `python-patterns.skill` | Python 設計模式 |
| `typescript-patterns.skill` | TypeScript 設計模式 |
| `java-spring.skill` | Spring Boot 架構規範 |
| `UxSoul-extractor.skill` | UX 靈魂萃取、用戶體驗深度分析 |
| `skill-acquisition.skill` | 遇到不會的事：本地查找→外部查找→審核→安裝 |

### 🟣 Claude Code 進階 Skills

| 技能 | 功能 |
|------|------|
| `claude-api-cost.skill` | Claude API 成本優化 |

---

## 🏗 架構與語言模式（ECC 進階庫）

### 🔵 後端框架
- `springboot-patterns`, `django-patterns`, `laravel-patterns`
- `kotlin-ktor-patterns`, `kotlin-exposed-patterns`, `jpa-patterns`
- `postgres-patterns`, `api-design`, `backend-patterns`
- `bun-runtime`, `nextjs-turbopack`

### 🔵 移動端與前端
- `android-clean-architecture`, `compose-multiplatform-patterns`
- `swiftui-patterns`, `frontend-patterns`, `frontend-slides`
- `swift-actor-persistence`, `swift-concurrency-6-2`

### 🔵 AI 與認知工程
- `thinking-engine`, `metacognition-core`, `reasoning-engine`
- `context-architect`, `iterative-retrieval`, `prompt-optimizer`
- `agentic-engineering`, `ai-first-engineering`, `autonomous-loops`

### 🔵 商業運營與研究
- `market-research`, `deep-research`, `exa-search`
- `inventory-demand-planning`, `logistics-exception-management`
- `energy-procurement`, `customs-trade-compliance`

---

## ⚡ Workflows（Slash Commands）🟣

*位於 `~/.claude/commands/`（junction → `C:\PixiuCore\.agent\workflows\`）*
*Gemini 用戶無法使用 slash commands，但知識型 skills 的內容已嵌入 GEMINI.md*

### 規劃與架構
| 指令 | 功能 |
|------|------|
| `/plan` | 列計畫、評風險、等確認後才動手 |
| `/multi-plan` | 多模型協作規劃 |
| `/orchestrate` | 多 agent 順序協作 |
| `/devfleet` | 平行 Claude Code agents 執行 |
| `/model-route` | 根據任務路由到適合模型 |

### 程式碼品質
| 指令 | 功能 |
|------|------|
| `/tdd` | 測試驅動開發 |
| `/code-review` | 程式碼審查 |
| `/security-review` | 安全性審查 |
| `/verify` | 驗證實作是否符合需求 |
| `/quality-gate` | 品質閘門檢查 |
| `/refactor-clean` | 重構與清理死碼 |

### 語言專屬
| 語言 | 指令 |
|------|------|
| Go | `/go-build` `/go-test` `/go-review` |
| C++ | `/cpp-build` `/cpp-test` `/cpp-review` |
| Rust | `/rust-build` `/rust-test` `/rust-review` |
| Kotlin | `/kotlin-build` `/kotlin-test` `/kotlin-review` |
| Python | `/python-review` |

### Session 管理
`/save-session` · `/resume-session` · `/sessions` · `/checkpoint`

### 文件
`/docs` · `/update-docs` · `/update-codemaps` · `/init-docs`

### 技能管理
`/skill-create` · `/skill-health` · `/learn` · `/learn-eval`
`/instinct-status` · `/instinct-export` · `/instinct-import`

---

## 📊 統計總覽

| 類別 | 數量 | 需要 Claude Code |
|------|------|:---:|
| Agents（主動型）| 25 | 🟣 |
| 通用 Skills（知識型）| 25 | 🔵 |
| ECC 進階 Skills | 100+ | 🔵/🟣 混合 |
| Workflows（slash commands）| 76 | 🟣 |
| Rules | 50 | 🔵 |
| **合計** | **176+ skills · 76 commands** | |

---

*最後更新：2026-03-18 | 母艦：Pixiu + ECC Full Profile*
