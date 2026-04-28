---
name: java-spring
description: |
  Java 與 Spring Boot 開發規範 Skill。
  任務涉及「java」、「spring」、「backend」、「pom.xml」、「實體」、「Entity」時自動載入。
license: MIT
compatibility: Pixiu Agent / Claude Code / Cursor
metadata:
  author: pixiu
  version: "1.0"
  category: language
---

# Java & Spring Boot Skill - 後端開發規範

> **用途**：確保 Java 專案開發符合版本限制與架構要求。

---

## 🛑 執行前必核條件 (Pre-flight Checks)

1. **確認版本**：在實作或除錯前，務必透過分析 `.xml`（如 `pom.xml`）或其他設定檔，確認當前使用的是 Spring Boot 2.x 還是 3.x，以及對應的 JDK 版本。
2. **依賴分析**：如果引入新的技術棧（如 Database Migration, Cache），必須確保與現有相依性沒有版本衝突。

## 🛠️ 開發與架構規範

### 封裝與分層架構 (Layered Architecture)

- **Controller 盡量輕量**：只負責接收 Request、回傳 Response，不包含業務邏輯。
- **Entity 與 DTO 嚴格區分**：絕對不能將直接對應資料庫的 `@Entity` 或原生 DAO 物件透過 Controller 暴露（防止過度暴露資訊或意外綁定）。必須轉換為 Response DTO。
- **Service 專注業務**：所有交易管理 (`@Transactional`) 與業務規則判斷保留在 Service 層。

### 🚨 Jakarta EE vs Java EE

- 請根據讀取到的 Spring Boot 版本決定匯入的命名空間：
  - **Spring Boot 2.x**：使用 `javax.*` (例如 `javax.persistence.*`, `javax.validation.*`)
  - **Spring Boot 3.x 以上**：**必須**使用 `jakarta.*`。嚴禁混用。

### ⚠️ 例外處理與日誌 (Exception & Logging)

- 攔截底層例外並重新包裝成自定義的 `CustomException`，切勿將系統的 StackTrace 直接拋回給前端。
- 重要的第三方呼叫或資料庫異動，必須在拋出例外前將相關參數與錯誤記錄在日誌中（例如使用 `@Slf4j`）。

### 寫法慣例

- 使用 `Optional<T>` 避免 NullPointerException，不要直接返回 null。
- 盡量使用 lombok 的 `@Data`, `@Builder`, `@NoArgsConstructor`, `@AllArgsConstructor` 以減少 boilerplate 代碼。
- 採用 Constructor Injection（建構子注入）而非 `@Autowired` Field Injection。
