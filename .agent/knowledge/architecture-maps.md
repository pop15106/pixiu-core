---
type: knowledge
date: 2026-05-27
topic: architecture-maps
source: awesome-architecture (github.com/mehdihadeli/awesome-software-architecture)
summary: 21 個架構模板速查（16 經典 + 5 AI-native），供 architect agent 設計決策時引用。
tags: [architecture, patterns, ai-native, ddd, cqrs, microservices, reference]
readAt: when-relevant
applyTo: 系統設計、架構選型、ADR
---

# Architecture Maps — 架構模板速查

> 設計新系統或重構時，先對照這份地圖選定模板，再進 ADR。

---

## Part A：16 個經典架構模板

### 1. Layered Architecture（分層架構）
```
Presentation → Application → Domain → Infrastructure
```
- **適用**：CRUD 系統、傳統企業應用、MVC Web App
- **優點**：直覺、易懂、IDE/框架支援好
- **缺點**：容易變成 Big Ball of Mud；Domain 被 Infrastructure 污染
- **警示**：超過 50K LOC 時考慮升級到 Hexagonal

### 2. Hexagonal Architecture（六角架構 / Ports & Adapters）
```
外部系統 → [Adapter] → Port → [Domain Core] → Port → [Adapter] → 外部系統
```
- **適用**：需要高可測試性；需要換 DB / 換 API / 換 UI 而不動 Domain
- **核心概念**：Domain 不依賴任何框架；所有外部依賴透過 Port 抽象
- **Java 對應**：Interface 作為 Port，Spring Bean 作為 Adapter

### 3. Clean Architecture
```
Entities → Use Cases → Interface Adapters → Frameworks & Drivers
```
- **適用**：長期維護的企業系統；多前端（Web + Mobile + CLI）共用同一 Domain
- **依賴方向**：永遠向內（外層依賴內層，內層不知道外層存在）
- **與 Hexagonal 區別**：Clean 強調 Use Case 層；Hexagonal 強調 Port 隔離

### 4. Domain-Driven Design（DDD）
```
Bounded Context → Aggregate → Entity / Value Object → Domain Event
```
- **適用**：複雜業務邏輯；多個子系統有不同語言（Ubiquitous Language）
- **戰術設計**：Aggregate Root 控制一致性邊界；Repository 只操作 Aggregate
- **戰略設計**：Context Map（ACL / Shared Kernel / Customer-Supplier）
- **反模式**：貧血模型（Anemic Domain Model）— Entity 只有 getter/setter

### 5. CQRS（Command Query Responsibility Segregation）
```
Command → Write Model → Event → Read Model（Projection）← Query
```
- **適用**：讀寫比例差距大（讀 >> 寫）；複雜查詢需要非規化 View
- **最小化版本**：同一 DB，僅分離 Service；不一定需要 Event Sourcing
- **完整版**：Write DB（規化）+ Read DB（非規化）+ Event Bus 同步

### 6. Event Sourcing
```
Command → Aggregate → Event（append-only store）→ State（replay）
```
- **適用**：需要完整 audit trail；需要時間旅行（replay 到任意時間點）
- **配合**：通常與 CQRS 搭配使用
- **注意**：Event schema 演化困難；不適合簡單 CRUD

### 7. Event-Driven Architecture（EDA）
```
Producer → Event Broker（Kafka/RabbitMQ）→ Consumer（多個）
```
- **適用**：解耦微服務；非同步處理；Fan-out 通知
- **模式**：Choreography（各自訂閱）vs Orchestration（中央協調）
- **保證**：At-least-once delivery + Idempotency consumer

### 8. Microservices
```
API Gateway → [Service A] [Service B] [Service C]
                   ↓           ↓           ↓
               [DB-A]      [DB-B]      [DB-C]
```
- **適用**：獨立部署需求；不同服務不同技術棧；大型團隊（Conway's Law）
- **邊界切法**：依 Bounded Context（DDD）或業務能力（Business Capability）
- **反模式**：Nano-services（太細）、分散式 Monolith（共用 DB）

### 9. Service Mesh
```
Service A → [Sidecar Proxy] ←→ [Sidecar Proxy] → Service B
                  ↓                    ↓
            [Control Plane（Istio/Linkerd）]
```
- **適用**：微服務數量 > 20；需要統一的 mTLS、流量控制、可觀測性
- **功能**：Service Discovery、Load Balancing、Circuit Breaker、Observability

### 10. Strangler Fig Pattern（絞殺者模式）
```
舊系統 ← [Facade/Proxy] ← 請求
新系統 ← [Facade/Proxy] ← 請求（逐步切換）
```
- **適用**：遺留系統漸進式重構；不允許大爆炸重寫
- **流程**：識別切面 → 建 Facade → 新實作 → 切流量 → 廢棄舊模組

### 11. Saga Pattern（分散式事務）
```
Choreography Saga: Svc A → Event → Svc B → Event → Svc C
Orchestration Saga: Saga Orchestrator → Svc A → Svc B → Svc C
```
- **適用**：跨微服務的長事務（無法用 2PC）
- **補償**：每個步驟都有對應的 Compensating Transaction
- **選擇**：Choreography 更鬆耦合；Orchestration 更易 debug

### 12. CQRS + Outbox Pattern
```
Command → Aggregate → DB Transaction {
    Update aggregate state
    Insert to Outbox table
} → CDC/Poller → Event Broker
```
- **適用**：確保 DB 寫入和 Event 發布的原子性（at-least-once）
- **解決**：Two-phase commit 的可靠性問題

### 13. BFF（Backend for Frontend）
```
Web SPA → [BFF-Web] → Microservices
Mobile  → [BFF-Mobile] → Microservices
```
- **適用**：多個前端有不同數據需求；避免 Generic API 的 over/under fetching
- **注意**：BFF 不應有業務邏輯，只做 aggregation / transformation

### 14. API Gateway Pattern
```
Client → API Gateway → [Auth] [Rate Limit] [Routing] → 後端服務
```
- **功能**：認證授權、速率限制、SSL termination、請求路由、協議轉換
- **選擇**：Kong / AWS API GW / Spring Cloud Gateway / Nginx

### 15. Sidecar / Ambassador Pattern
```
[App Container] + [Sidecar Container] = Pod
Sidecar 負責：logging、proxy、config reload、mTLS
```
- **適用**：Kubernetes 環境；不想修改 App 卻要加橫切功能

### 16. Pipe and Filter
```
Input → [Filter A] → [Filter B] → [Filter C] → Output
```
- **適用**：數據處理 Pipeline（ETL、圖片處理、訊息轉換）
- **Java 對應**：Stream API、Chain of Responsibility、Spring Batch

---

## Part B：5 個 AI-Native 架構模板

### AI-1. RAG（Retrieval-Augmented Generation）
```
Query → [Embedding Model] → Vector Search → [Context Chunks]
                                                    ↓
Query + Context → [LLM] → Response
```
- **適用**：知識問答、文件搜索、客服機器人（需要最新或私有知識）
- **關鍵決策**：
  - Chunk size（512~2048 tokens）
  - Embedding model（OpenAI / BGE / Cohere）
  - Vector store（Pinecone / Weaviate / pgvector / Qdrant）
  - Retrieval strategy（Semantic / Keyword / Hybrid / HyDE）
- **進階**：Reranking（Cross-encoder）、Self-RAG、Corrective RAG

### AI-2. Agent Loop（ReAct / Tool-Use）
```
User Input → LLM（Reason）→ Tool Call → Observation → LLM（Reason）→ ... → Final Answer
```
- **適用**：需要多步驟推理、外部工具呼叫（搜尋、計算、DB 查詢）
- **模式**：ReAct（Reason + Act）、CoT（Chain of Thought）、ToT（Tree of Thoughts）
- **安全**：Tool 結果不可直接信任（Prompt Injection 防護）；敏感操作需 Human-in-the-Loop

### AI-3. Multi-Agent Orchestration
```
Orchestrator Agent
    ├── Specialist Agent A（研究）
    ├── Specialist Agent B（撰寫）
    └── Specialist Agent C（審查）
```
- **適用**：複雜任務分解；並行執行；角色專業化（Pixiu Fleet 即此模式）
- **協調方式**：
  - Orchestrator-Workers（中央調度）
  - Peer-to-Peer（agents 互相呼叫）
  - Blackboard（共享狀態空間）
- **Pixiu 實作**：Claude（主力）+ Gemini（前端/UI）+ Codex（審計/安全）共用 vault 知識庫

### AI-4. LLM Gateway / Router Pattern
```
Request → [LLM Router] → {
    Simple query → Haiku（快、便宜）
    Complex reasoning → Opus（慢、準）
    Code generation → Claude Code
    Vision → GPT-4V
}
```
- **適用**：多模型混合使用；成本優化；能力路由
- **路由策略**：Rule-based（token count）、Classifier-based（任務類型）、Cascading（先用小模型）

### AI-5. Skill-as-External-State（SkillOpt 模式）
```
Agent ←→ Skill Documents（外部可訓練狀態）
              ↑
        Edit Budget Controller
              ↑
        Validation Gate（自動測試）
              ↑
        Rejected-Edit Buffer（slow update）
```
- **適用**：Agent skill 需要根據執行結果持續優化
- **核心**：Skill 文件不是靜態的 — 它是「外部可微調的參數」
- **詳細實作**：見 `skill-opt` agent 和 skill

---

## Part C：選型速查矩陣

| 場景 | 推薦架構 | 備注 |
|------|---------|------|
| CRUD Web App（< 10K users）| Layered | 快速開發 |
| 複雜業務邏輯 | DDD + Hexagonal | 保護 Domain |
| 讀多寫少（報表系統）| CQRS | 讀寫分離 |
| 完整 audit trail | Event Sourcing + CQRS | 複雜度高 |
| 微服務解耦 | EDA + Saga | 處理分散式事務 |
| 遺留系統重構 | Strangler Fig | 漸進式 |
| 多前端 | BFF | 避免 over-fetching |
| 知識問答 AI | RAG | 私有知識 |
| 多步驟 AI 任務 | Agent Loop | Tool-Use |
| 大型 AI 系統 | Multi-Agent | 角色分工 |
| AI 成本優化 | LLM Router | 小模型先過濾 |
| Skill 持續優化 | SkillOpt | 見 skill-opt |

---

## Part D：9 章架構教程摘要

| 章節 | 主題 | 核心概念 |
|------|------|---------|
| Ch1 | 架構思維 | 架構 = 難以改變的決策；推遲決策到最後責任時刻 |
| Ch2 | 模組化設計 | SRP、高內聚低耦合、Package by Feature vs by Layer |
| Ch3 | DDD 戰術 | Aggregate、Entity、Value Object、Domain Event、Repository |
| Ch4 | DDD 戰略 | Bounded Context、Context Map、Ubiquitous Language |
| Ch5 | 分散式系統 | CAP 定理、最終一致性、Saga、Outbox |
| Ch6 | 可觀測性 | Logs + Metrics + Traces（三柱）、Structured Logging |
| Ch7 | 安全架構 | Defence in Depth、Zero Trust、Threat Modeling（STRIDE）|
| Ch8 | 效能設計 | Cache-Aside、Write-Through、CDN、DB Index 策略 |
| Ch9 | AI-Native 設計 | RAG、Agent Loop、Multi-Agent、LLM Gateway、SkillOpt |

---

*來源：awesome-architecture (mehdihadeli) + Anthropic Agent SDK patterns + SkillOpt (arxiv:2605.23904)*
*新增架構決定時，請在 `vault/context/tech-stack.md` 的 ADR 區段追加。*
