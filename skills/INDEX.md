---
disable-model-invocation: true
name: skills-index
description: "PixiuCore manual Skill routing index; use only when auditing or locating Skills by category."
type: skills-index
date: 2026-09-04
project: PIXIUCORE
topic: skills-index
status: active
summary: skills/ 目錄手動索引：12 個高優先路由能力＋81 個參考能力；正常 Session 一律先走 Capability Router，不全文常駐本索引。
---

# Skills 索引（單一真源）

> 用法：正常 Session 先執行 `scripts/router/resolve-capabilities.js`，只讀 Router 回傳的 Skill。只有盤點、人工查找或 Router 降級時才讀本索引。
> 高優先路由層：常見 Pixiu 工作流，仍須由 Router 或明確語意觸發，不在 Session 啟動時全文常駐。
> 參考層：標記 `disable-model-invocation: true`，由 Router、人工索引或使用者 `/名稱` 手動觸發。
> 維護：新增／刪除 Skill 時同步更新本表與 Capability Manifest；根目錄 `SKILLS_INDEX.md` 只作導覽與當期盤點，不作 runtime 路由。

## 高優先路由層（12）

| Skill | 什麼情境用 |
|---|---|
| `change-review-evidence` | 併版／正式變更前建立 source-backed 覆核證據包：逐檔逐 Change Block diff 與修改原因、跨層與環境契約檢查；指定範圍含 UI 時預設產 DOCX 並附 Before/After；另含驗證證據及 SA/PM 覆核紀錄。 |
| `repair-review-sheet` | 報修／事故／異常發生後、正式修正前建立覆核單：分離回報與事實、重現與根因證據、active path / blast radius、Repair Scope、資料修復、環境一致性、測試與回復方案；無 UI 預設 MD，有 UI 預設 DOCX。 |
| `requirement-confirmation` | 將 SA/PM 模糊口語需求、使用者自然語言理解與後續追加／變更整理成版本化可覆核需求：保留 Requirement Delta，重算受影響程式／DB／驗收／測試／覆核；無 UI 預設 MD，有 UI 預設 DOCX。 |
| `claude-code-auto-mode-policy` | Pixiu 專用 Claude Code Auto mode 授權政策 |
| `legacy-java-flow-tracing` | Use when tracing legacy Java, Servlet, Spring, Vue, PCLMS, PEPIS, PISSO, PTWCS, report, SQ |
| `opus-behavior-core` | 將 Claude Opus 4.7 的系統級行為模式抽象為「認知／資訊／行動／溝通／安全」五層可移植規則，供任意 Agent（Cursor、Windsurf、Copilot、Gem |
| `pixiu-agent-router` | Route PixiuCore agent definitions into Codex workflows. Use when the user asks for Pixiu a |
| `pixiu-session-recap` | Pixiu 版 Session Recap |
| `pixiu-verify-loop` | Pixiu 版端對端自我驗證迴圈（仿 Boris /go） |
| `second-brain-health-check` | Use when checking whether the second brain is usable, when query-second-brain-nvidia.ps1 f |
| `system-documentation` | 以原始碼、設定、Schema、Runtime、實際畫面與可追溯需求為證據，產出操作手冊、受測文件、As-Is 功能規格、To-Be 需求/變更規格、模組解說、交接文件，並支援忠實 UI 還原與 DOCX/PDF QA。 |
| `verification-loop` | A comprehensive verification system for Claude Code sessions. |

## 參考層（81）

| Skill | 什麼情境用 |
|---|---|
| `ai-regression-testing` | Regression testing strategies for AI-assisted development. Sandbox-mode API testing withou |
| `android-clean-architecture` | Clean Architecture patterns for Android and Kotlin Multiplatform projects — module structu |
| `api-design` | REST API design patterns including resource naming, status codes, pagination, filtering, e |
| `article-writing` | Write articles, guides, blog posts, tutorials, newsletter issues, and other long-form cont |
| `backend-patterns` | Backend architecture patterns, API design, database optimization, and server-side best pra |
| `banini` | 巴逆逆（8zz）反指標追蹤器 — 抓取 Threads 貼文並進行台股反指標分析 |
| `bun-runtime` | Bun as runtime, package manager, bundler, and test runner. When to choose Bun vs Node, mig |
| `claude-api` | Anthropic Claude API patterns for Python and TypeScript. Covers Messages API, streaming, t |
| `coding-standards` | Universal coding standards, best practices, and patterns for TypeScript, JavaScript, React |
| `compose-multiplatform-patterns` | Compose Multiplatform and Jetpack Compose patterns for KMP projects — state management, na |
| `configure-ecc` | Interactive installer for Everything Claude Code — guides users through selecting and inst |
| `content-engine` | Create platform-native content systems for X, LinkedIn, TikTok, YouTube, newsletters, and  |
| `continuous-learning` | Automatically extract reusable patterns from Claude Code sessions and save them as learned |
| `continuous-learning-v2` | Instinct-based learning system that observes sessions via hooks, creates atomic instincts  |
| `cpp-coding-standards` | C++ coding standards based on the C++ Core Guidelines (isocpp.github.io). Use when writing |
| `cpp-testing` | Use only when writing/updating/fixing C++ tests, configuring GoogleTest/CTest, diagnosing  |
| `crosspost` | Multi-platform content distribution across X, LinkedIn, Threads, and Bluesky. Adapts conte |
| `ctf-kit` | CTF 逆向工程解題工具箱 — 聚焦 Windows 應用程式驗證繞過 |
| `deep-research` | Multi-source deep research using firecrawl and exa MCPs. Searches the web, synthesizes fin |
| `django-patterns` | Django architecture patterns, REST API design with DRF, ORM best practices, caching, signa |
| `django-tdd` | Django testing strategies with pytest-django, TDD methodology, factory_boy, mocking, cover |
| `django-verification` | Verification loop for Django projects: migrations, linting, tests with coverage, security  |
| `dmux-workflows` | Multi-agent orchestration using dmux (tmux pane manager for AI agents). Patterns for paral |
| `documentation-lookup` | Use up-to-date library and framework docs via Context7 MCP instead of training data. Activ |
| `e2e-testing` | Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, arti |
| `eval-harness` | Formal evaluation framework for Claude Code sessions implementing eval-driven development  |
| `exa-search` | Neural search via Exa MCP for web, code, and company research. Use when the user needs web |
| `fal-ai-media` | Unified media generation via fal.ai MCP — image, video, and audio. Covers text-to-image (N |
| `frontend-patterns` | Frontend development patterns for React, Next.js, state management, performance optimizati |
| `frontend-slides` | Create stunning, animation-rich HTML presentations from scratch or by converting PowerPoin |
| `goal-engineer` | Use when the user wants to AUTHOR an unattended, goal-driven evaluator-optimizer loop of t |
| `golang-patterns` | Idiomatic Go patterns, best practices, and conventions for building robust, efficient, and |
| `golang-testing` | Go testing patterns including table-driven tests, subtests, benchmarks, fuzzing, and test  |
| `investor-materials` | Create and update pitch decks, one-pagers, investor memos, accelerator applications, finan |
| `investor-outreach` | Draft cold emails, warm intro blurbs, follow-ups, update emails, and investor communicatio |
| `iterative-retrieval` | Pattern for progressively refining context retrieval to solve the subagent context problem |
| `java-coding-standards` | Java coding standards for Spring Boot services: naming, immutability, Optional usage, stre |
| `job-radar` | kc_job_radar 求職雷達遙控指令 |
| `job-scout` | 求職前公司與職位篩選工具。當使用者提到想投履歷、考慮某公司、評估某職缺、或想了解某公司值不值得去時觸發。輸入公司名稱（必要）+ 職位名稱（選填），輸出綜合評估與建議。 |
| `kotlin-coroutines-flows` | Kotlin Coroutines and Flow patterns for Android and KMP — structured concurrency, Flow ope |
| `kotlin-exposed-patterns` | JetBrains Exposed ORM patterns including DSL queries, DAO pattern, transactions, HikariCP  |
| `kotlin-ktor-patterns` | Ktor server patterns including routing DSL, plugins, authentication, Koin DI, kotlinx.seri |
| `kotlin-patterns` | Idiomatic Kotlin patterns, best practices, and conventions for building robust, efficient, |
| `kotlin-testing` | Kotlin testing patterns with Kotest, MockK, coroutine testing, property-based testing, and |
| `laravel-patterns` | Laravel architecture patterns, routing/controllers, Eloquent ORM, service layers, queues,  |
| `laravel-tdd` | Test-driven development for Laravel with PHPUnit and Pest, factories, database testing, fa |
| `laravel-verification` | Verification loop for Laravel projects: env checks, linting, static analysis, tests with c |
| `llm-benchmark` | 本地 LLM Benchmark 工具 |
| `llm-wiki-lint` | Use when the user wants to lint a repo following the Karpathy LLM Wiki pattern (raw/ + wik |
| `make-docx` | 以固定的 Pixiu 風格（藍色標題、彩色表格、風險框、程式碼佐證、流程圖、自動目錄）產生 DOCX 技術文件 |
| `market-research` | Conduct market research, competitive analysis, investor due diligence, and industry intell |
| `mcp-server-patterns` | Build MCP servers with Node/TypeScript SDK — tools, resources, prompts, Zod validation, st |
| `md2pdf` | Convert Markdown to publication-ready A4 PDF with automatic ASCII-to-Mermaid conversion, C |
| `memory-lint` | Use when the user wants to lint a Claude Code memory directory (~/.claude/memory or custom |
| `nextjs-turbopack` | Next.js 16+ and Turbopack — incremental bundling, FS caching, dev speed, and when to use T |
| `perl-patterns` | Modern Perl 5.36+ idioms, best practices, and conventions for building robust, maintainabl |
| `perl-testing` | Perl testing patterns using Test2::V0, Test::More, prove runner, mocking, coverage with De |
| `plankton-code-quality` | Write-time code quality enforcement using Plankton — auto-formatting, linting, and Claude- |
| `prd-create` | Use when user wants to draft a PRD (Product Requirements Document) from raw input (meeting |
| `prep-repo` | Prepare a project for GitHub: README, commit conventions, sensitive data scan, broken link |
| `project-guidelines-example` | Example project-specific skill template based on a real production application. |
| `python-patterns` | Pythonic idioms, PEP 8 standards, type hints, and best practices for building robust, effi |
| `python-testing` | Python testing strategies using pytest, TDD methodology, fixtures, mocking, parametrizatio |
| `repo-scan` | GitHub 開源專案安全掃描工具 |
| `rewrite-tone` | Rewrite Markdown files with a conversational, humorous, self-deprecating tone. Turns dry t |
| `rust-patterns` | Idiomatic Rust patterns, ownership, error handling, traits, concurrency, and best practice |
| `rust-testing` | Rust testing patterns including unit tests, integration tests, async testing, property-bas |
| `searxng` | Privacy-respecting metasearch using your local SearXNG instance. Search the web, images, n |
| `security-review` | Use this skill when adding authentication, handling user input, working with secrets, crea |
| `skill-cron` | 排程推播管理器 — 註冊/管理需定時執行並推送 Telegram 通知的 skill |
| `skill-opt` | Optimize, improve, or evolve a SKILL.md document based on execution feedback. Use when a s |
| `skill-stocktake` | Use when auditing Claude skills and commands for quality. Supports Quick Scan (changed ski |
| `spec` | Spec-driven 開發流程 — 從模糊需求到驗收結案 |
| `spec-improve` | Review and improve existing spec-driven development artifacts. Use when the user asks to o |
| `springboot-patterns` | Spring Boot architecture patterns, REST API design, layered services, data access, caching |
| `springboot-tdd` | Test-driven development for Spring Boot using JUnit 5, Mockito, MockMvc, Testcontainers, a |
| `springboot-verification` | Verification loop for Spring Boot projects: build, static analysis, tests with coverage, s |
| `strategic-compact` | Suggests manual context compaction at logical intervals to preserve context through task p |
| `tdd-workflow` | Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test- |
| `video-editing` | AI-assisted video editing workflows for cutting, structuring, and augmenting real footage. |
| `x-api` | X/Twitter API integration for posting tweets, threads, reading timelines, search, and anal |
