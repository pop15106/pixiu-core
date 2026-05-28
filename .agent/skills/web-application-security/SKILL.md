---
name: web-application-security
description: Web application security review covering OWASP Top 10, injection, XSS, CSRF, broken auth, IDOR, business logic flaws. Use when reviewing web endpoints, form handlers, session management, or auth flows.
origin: cybersecurity-library
source: subdomain web-application-security in skills/cybersecurity-library/skills/
tags: [security, web, owasp, injection, xss, csrf]
---

# Web Application Security

> 完整技能庫位置：`skills/cybersecurity-library/web-application-security/`
> 本檔為快速參考摘要；深查時請直接載入上方完整技能庫。

## 核心檢查清單

### Injection（注入攻擊）
- [ ] 所有 DB 查詢使用參數化查詢或 ORM（禁止字串拼接 SQL）
- [ ] OS command 呼叫不含使用者輸入；必要時用白名單過濾
- [ ] LDAP / XPath / NoSQL 查詢同樣需要參數化
- [ ] Template injection：禁止將使用者輸入直接塞入 template 字串

**技術棧對應（依實際 stack 套用）**：
| Stack | 參數化方式 |
|-------|-----------|
| Java / JDBC | `PreparedStatement` + `?` |
| Java / MyBatis | `#{}` 語法（非 `${}` |
| Java / JPA | `@Query` + `:param` |
| Node.js / pg | `$1, $2` 佔位符 |
| Python / SQLAlchemy | `text()` + `bindparams` |

### XSS（跨站腳本）
- [ ] 所有輸出做 HTML encode（依 context：HTML / JS / URL / CSS）
- [ ] CSP header 設定，禁止 `unsafe-inline`（或有 nonce）
- [ ] 使用 DOMPurify / 框架內建 sanitize（React JSX、Thymeleaf `th:text`）
- [ ] `innerHTML`, `document.write`, `eval` 使用前必須 audit

### CSRF
- [ ] 所有狀態變更操作（POST/PUT/DELETE）驗證 CSRF token
- [ ] Cookie 設定 `SameSite=Strict` 或 `Lax`
- [ ] Double-submit cookie 或 synchronizer token pattern

### Broken Authentication
- [ ] Session ID 登入後重新生成（session fixation 防護）
- [ ] 密碼用 bcrypt / argon2 / scrypt（不用 MD5/SHA1）
- [ ] 登入失敗不提示「密碼錯誤」vs「帳號不存在」
- [ ] 實作帳號鎖定 / 指數退避（exponential backoff）
- [ ] 敏感操作需 re-authentication

### IDOR / 存取控制
- [ ] 每個 API endpoint 都有 authorization check（不依賴前端隱藏）
- [ ] 物件 ID 不可猜測（用 UUID 或驗證所有權）
- [ ] Horizontal privilege escalation：確認使用者只能存取自己的資源
- [ ] Vertical privilege escalation：role check 在 server side

### 敏感資料暴露
- [ ] HTTPS everywhere + HSTS header
- [ ] 錯誤回應不洩漏 stack trace / DB schema / 版本資訊
- [ ] Log 不含密碼、token、PII
- [ ] API 回應欄位最小化（不回傳不必要的 DB 欄位）

### Business Logic Flaws
- [ ] 數量 / 金額欄位驗證（負數、超大值、浮點精度）
- [ ] 狀態機驗證（訂單流程不可跳步）
- [ ] Race condition：並發操作用 DB-level locking
- [ ] 批次操作上限（防止 mass assignment）

## 快速掃描命令

```bash
# 搜尋潛在注入點
grep -rn "executeQuery\|executeUpdate\|createStatement" --include="*.java"
grep -rn "eval\|innerHTML\|document\.write" --include="*.js"

# 搜尋硬編碼密碼/token
grep -rn "password\s*=\s*['\"]" --include="*.java" --include="*.properties"
grep -rn "secret\s*=\s*['\"]" --include="*.java" --include="*.yml"

# 搜尋不安全的隨機數
grep -rn "new Random()\|Math.random()" --include="*.java"
```

## 嚴重度速查

| 漏洞 | 嚴重度 | 立即處置 |
|------|--------|---------|
| SQL Injection | CRITICAL | 停止部署，修復後重審 |
| Auth bypass | CRITICAL | 停止部署 |
| IDOR（大量資料暴露）| HIGH | 本 sprint 修復 |
| Stored XSS | HIGH | 本 sprint 修復 |
| CSRF（狀態變更）| HIGH | 本 sprint 修復 |
| Reflected XSS | MEDIUM | 下個 sprint |
| 資訊洩漏（error msg）| MEDIUM | 下個 sprint |

---
*深查：`grep -rl "subdomain: web-application-security" skills/cybersecurity-library/skills/` → 42 個技能*
