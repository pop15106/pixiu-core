---
name: security-review
description: Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, or implementing payment/sensitive features. Provides comprehensive, tech-stack agnostic security checklist and patterns.
origin: ECC
---

# Security Review Skill

> **Tech-stack 原則**：本 skill 提供通用安全模式。程式碼範例僅為示意，實作時請依當前專案技術棧（Java / Node.js / Python / Go 等）選擇對應寫法。

## When to Activate

- 實作 authentication 或 authorization
- 處理 user input 或 file upload
- 建立新 API endpoint
- 使用 secrets 或 credentials
- 實作付款功能
- 儲存或傳輸敏感資料
- 整合第三方 API

---

## 1. Secrets Management

### 原則（所有技術棧通用）
```
❌ 禁止：在原始碼中寫死任何 secret（API key、password、token、cert）
✅ 必要：所有 secret 從環境變數或 secret manager 取得
✅ 必要：啟動時驗證 secret 存在
✅ 必要：.env / config 含 secret 的檔案加入 .gitignore
```

### 示意寫法（依 stack 調整）
```
# 環境變數取用的模式（各語言通用概念）
DB_PASSWORD = 從環境變數取得("DB_PASSWORD")
if DB_PASSWORD 不存在:
    拋出錯誤 "DB_PASSWORD not configured"
```

```java
// Java 範例
String dbPassword = System.getenv("DB_PASSWORD");
if (dbPassword == null) throw new IllegalStateException("DB_PASSWORD not configured");
```

```javascript
// Node.js 範例（依實際 framework 調整）
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY not configured');
```

### 驗證清單
- [ ] 無硬編碼 API key、token、password
- [ ] 所有 secret 在環境變數
- [ ] Secret 檔案在 `.gitignore`
- [ ] Git history 無洩漏（用 `gitleaks` / `trufflehog` 掃描）
- [ ] Production secret 在 CI/CD secret store 或 Vault

---

## 2. Input Validation

### 原則
```
所有來自外部的輸入（用戶提交、API request、URL 參數、檔案）都視為不可信任。
驗證策略：whitelist（允許清單）優先於 blacklist（拒絕清單）。
```

### 驗證維度
1. **型別**：字串 / 數字 / 日期 / 布林
2. **長度 / 範圍**：最大最小值
3. **格式**：email、URL、UUID、電話
4. **業務規則**：狀態機、前後關係

### 示意（各 stack 套用對應 validator）
```
schema = {
    email: 字串 + email 格式,
    name: 字串 + 長度 1-100,
    age: 整數 + 範圍 0-150
}
result = validate(schema, user_input)
if 驗證失敗: return 400 + 錯誤描述（不洩漏 stack 資訊）
```

**技術棧對應**：
| Stack | 驗證工具 |
|-------|---------|
| Java Spring | Bean Validation (`@Valid`, `@NotNull`, `@Size`) |
| Java 手動 | Apache Commons Validator |
| Node.js | `zod` / `joi` / `express-validator` |
| Python | `pydantic` / `marshmallow` / `cerberus` |
| Go | `go-playground/validator` |

### File Upload 驗證（通用）
- [ ] 大小限制（建議 ≤ 10MB，依需求調整）
- [ ] MIME type 白名單（同時驗證 magic bytes，不只靠副檔名）
- [ ] 儲存路徑不含 `../`（防 path traversal）
- [ ] 上傳後用 UUID 或 hash 重新命名

### 驗證清單
- [ ] 所有 user input 有 schema 驗證
- [ ] File upload 有大小 + type + extension 三重檢查
- [ ] 無直接將 user input 塞入 DB query / shell command / template
- [ ] 錯誤訊息不洩漏內部資訊

---

## 3. SQL Injection Prevention

### 原則
```
❌ 禁止：字串拼接組 SQL
✅ 必要：參數化查詢 / prepared statement
✅ 必要：ORM 也要注意 raw query 用法
```

### 各技術棧對應
```java
// Java JDBC
PreparedStatement ps = conn.prepareStatement("SELECT * FROM users WHERE email = ?");
ps.setString(1, userEmail);

// Java MyBatis
// ✅ #{email}  → 參數化
// ❌ ${email}  → 字串替換，有 injection 風險

// Java JPA
@Query("SELECT u FROM User u WHERE u.email = :email")
User findByEmail(@Param("email") String email);
```

```javascript
// Node.js / pg
await pool.query('SELECT * FROM users WHERE email = $1', [userEmail]);
```

```python
# Python / SQLAlchemy
stmt = text("SELECT * FROM users WHERE email = :email")
result = db.execute(stmt, {"email": user_email})
```

### 驗證清單
- [ ] 所有 DB 查詢使用參數化查詢
- [ ] 無字串拼接 SQL
- [ ] ORM raw query 也已審查
- [ ] NoSQL（MongoDB 等）查詢也做 sanitize

---

## 4. Authentication & Authorization

### 密碼儲存
```
✅ 使用：bcrypt（cost ≥ 12）/ argon2id / scrypt
❌ 禁止：MD5、SHA1、SHA256 直接 hash 密碼（無 salt）
```

### Token / Session 安全
```
- Session token：httpOnly cookie（禁止 localStorage）
- Session ID：登入後重新生成（防 session fixation）
- JWT：短效 access token（15min-1hr）+ 長效 refresh token
- JWT storage：httpOnly cookie（不放 localStorage / sessionStorage）
```

### Authorization 模式
```
每個需要保護的操作必須在 server side 驗證：
1. 是否已認證（authenticated）？
2. 是否有權限（authorized）？
3. 是否為自己的資源（ownership）？
```

```java
// Spring Security 範例
@PreAuthorize("hasRole('ADMIN') or #userId == authentication.principal.id")
public UserData getUser(Long userId) { ... }
```

### 驗證清單
- [ ] 密碼使用強 hash 算法
- [ ] Token 儲存在 httpOnly cookie
- [ ] 所有路由有 authentication check
- [ ] 所有資源有 ownership / authorization check
- [ ] Session 管理安全（登入後換 ID、登出時 invalidate）

---

## 5. XSS Prevention

### 原則
```
- 所有輸出到 HTML 的 user content 必須做 encoding（依 context）
- HTML context → HTML encode
- JS context → JS encode
- URL context → URL encode
- CSS context → CSS encode
```

### 技術棧對應
| Stack | 方式 |
|-------|------|
| Java Thymeleaf | `th:text`（自動 encode），避免 `th:utext` |
| Java JSP | `<c:out>` 或 JSTL fn:escapeXml |
| React | JSX 自動 encode（避免 `dangerouslySetInnerHTML`）|
| Vue | `{{ }}` 自動 encode（避免 `v-html`）|
| 需要 HTML 輸出 | 用 DOMPurify / sanitize-html / jsoup sanitize |

### Content Security Policy（HTTP header）
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

### 驗證清單
- [ ] User content 輸出時有 encoding
- [ ] 無未防護的 `innerHTML` / `v-html` / `th:utext`
- [ ] CSP header 設定
- [ ] 必須用 raw HTML 輸出的地方有 sanitize

---

## 6. CSRF Protection

### 原則
```
所有狀態變更操作（POST / PUT / PATCH / DELETE）需要 CSRF 保護。
```

### 方式
- **Synchronizer Token Pattern**：Server 生成 token 嵌入表單，提交時驗證
- **Double Submit Cookie**：Cookie 和 request header 都帶相同 token
- **SameSite Cookie**：`SameSite=Strict` 或 `Lax`（現代瀏覽器支援）

| Stack | 工具 |
|-------|------|
| Spring Security | 內建 CSRF protection（預設啟用）|
| Node.js Express | `csurf` middleware |
| Django | 內建 CSRF middleware |

### 驗證清單
- [ ] 所有狀態變更 endpoint 有 CSRF 保護
- [ ] Cookie 設定 `SameSite=Strict` 或 `Lax`
- [ ] AJAX 請求帶 CSRF token header

---

## 7. Rate Limiting

### 分級策略
```
登入 / 密碼重設：最嚴格（5次/15min per IP）
API 一般操作：中等（100次/15min）
搜尋 / 計算密集：較嚴格（10次/min）
```

| Stack | 工具 |
|-------|------|
| Java Spring | `bucket4j` + Redis / `resilience4j` |
| Node.js | `express-rate-limit` + Redis |
| Python FastAPI | `slowapi` |
| Nginx / 反向代理 | `limit_req_zone` |

### 驗證清單
- [ ] 所有 API endpoint 有 rate limit
- [ ] 認證相關 endpoint 有更嚴格的限制
- [ ] Rate limit 用 IP + user ID 雙重維度
- [ ] 429 回應不洩漏內部資訊

---

## 8. Sensitive Data Exposure

### Log 安全
```
❌ 禁止：log.info("User login: email={}, password={}", email, password)
✅ 必要：log.info("User login: email={}, userId={}", email, userId)

敏感欄位：password、token、cardNumber、ssn、cvv → 從 log 移除或 mask
```

### Error Response
```
❌ 禁止：回傳 stack trace、DB error message、內部路徑給 client
✅ 必要：generic error message（"An error occurred"）給 client
✅ 必要：詳細錯誤只在 server log（帶 correlation ID）
```

### 驗證清單
- [ ] Log 中無 password / token / secret
- [ ] Client error response 為 generic message
- [ ] Stack trace 不對外暴露
- [ ] DB schema / 版本資訊不在 response 中

---

## 9. Dependency Security

```bash
# Java Maven
mvn org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=7

# Node.js
npm audit --audit-level=high

# Python
pip-audit

# 多語言（CI/CD 推薦）
trivy fs . --severity HIGH,CRITICAL
```

### 驗證清單
- [ ] 依賴版本鎖定（lock file commit 到 git）
- [ ] 無已知高危弱點（CVSS ≥ 7）
- [ ] CI/CD 中有依賴掃描 step
- [ ] 定期更新（Dependabot / Renovate 自動化）

---

## Pre-Deployment 完整清單

- [ ] **Secrets**：無硬編碼，全在環境變數
- [ ] **Input Validation**：所有 user input 有驗證
- [ ] **SQL Injection**：所有查詢參數化
- [ ] **XSS**：輸出有 encoding，有 CSP
- [ ] **CSRF**：保護已啟用
- [ ] **Authentication**：token 安全儲存
- [ ] **Authorization**：server side role check
- [ ] **Rate Limiting**：所有 endpoint 已設定
- [ ] **HTTPS**：production 已強制
- [ ] **Security Headers**：CSP、X-Frame-Options、HSTS 設定
- [ ] **Error Handling**：無敏感資料外洩
- [ ] **Logging**：無敏感資料記錄
- [ ] **Dependencies**：已掃描，無高危弱點
- [ ] **File Uploads**：大小 + 類型驗證

---

## 深查域技能

| 場景 | 載入路徑 |
|------|---------|
| Web 應用安全（OWASP 詳查）| `.agent/skills/web-application-security/SKILL.md` |
| API 安全（OWASP API Top 10）| `.agent/skills/api-security/SKILL.md` |
| IAM / OAuth / JWT | `.agent/skills/iam-and-access-control/SKILL.md` |
| DevSecOps / CI/CD / Container | `.agent/skills/devsecops/SKILL.md` |
| CVE 分析 / 弱點管理 | `.agent/skills/vulnerability-management/SKILL.md` |
| 754-skill 完整資安庫 | `skills/cybersecurity-library/` |

---

**記住**：安全不是選項。依當前專案的實際技術棧給出具體建議，不要預設特定 framework。
