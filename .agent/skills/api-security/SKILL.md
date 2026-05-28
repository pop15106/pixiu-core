---
name: api-security
description: API security review covering authentication, authorization, rate limiting, input validation, mass assignment, and API-specific vulnerabilities (BOLA, BFLA, excessive data exposure). Use when reviewing REST/GraphQL/gRPC endpoints.
origin: cybersecurity-library
source: subdomain api-security in skills/cybersecurity-library/skills/
tags: [security, api, rest, graphql, owasp-api]
---

# API Security

> 完整技能庫：`skills/cybersecurity-library/api-security/`（共 ~28 個技能）

## OWASP API Security Top 10 檢查

### API1 - Broken Object Level Authorization (BOLA/IDOR)
- [ ] 每個 API 呼叫都驗證呼叫者對目標物件的所有權
- [ ] 不依賴 client 傳來的 user_id（從 token 中取）
- [ ] 批次查詢 endpoint 有 ownership filter

### API2 - Broken Authentication
- [ ] Token 過期時間合理（access: 15min~1hr, refresh: 7-30days）
- [ ] Token 黑名單機制（登出、密碼重設後 invalidate）
- [ ] API Key 有輪換機制，不在 URL 中傳遞

### API3 - Broken Object Property Level Authorization
- [ ] 禁止 mass assignment（只允許 whitelist 欄位更新）
- [ ] 回應欄位過濾（不回傳內部欄位如 `is_admin`, `role`）

### API4 - Unrestricted Resource Consumption
- [ ] Rate limiting（依 endpoint 分級：認證 > 搜尋 > 一般）
- [ ] Pagination 強制上限（禁止 `limit=99999`）
- [ ] 檔案上傳大小限制
- [ ] 計算密集操作有 timeout

### API5 - Broken Function Level Authorization (BFLA)
- [ ] Admin endpoint 有 role check（不只 auth check）
- [ ] HTTP method 限制（GET-only endpoint 不接受 POST）
- [ ] 功能型權限（不只資源型）

### API6 - Unrestricted Access to Sensitive Business Flows
- [ ] 高敏感流程（付款、密碼重設）有額外驗證
- [ ] 防爬蟲 / 自動化操作的業務邏輯保護

### API7 - Server Side Request Forgery (SSRF)
- [ ] URL 參數有白名單過濾（禁止 `file://`, `localhost`, `169.254.x.x`）
- [ ] Webhook URL 驗證

### API8 - Security Misconfiguration
- [ ] CORS 設定精確（不用 `*`，明確列出 allowed origins）
- [ ] 錯誤回應格式統一，不洩漏 framework 版本
- [ ] OpenAPI/Swagger 在 prod 不對外開放

### API9 - Improper Inventory Management
- [ ] API 版本控制，舊版有下線計畫
- [ ] `/api/v1` 舊版不繼承 `/api/v2` 的安全修復

### API10 - Unsafe Consumption of APIs
- [ ] 第三方 API 回應做 validation（不信任外部資料）
- [ ] 外部 API timeout / retry 有上限

## 常見技術棧實作對應

| 需求 | Java/Spring | Node/Express |
|------|-------------|--------------|
| Rate limit | `bucket4j` + Redis | `express-rate-limit` |
| Input validate | Bean Validation (`@Valid`) | `joi` / `zod` |
| Auth filter | `OncePerRequestFilter` | middleware chain |
| CORS | `CorsConfigurationSource` | `cors()` middleware |

## 快速掃描

```bash
# 找缺少 @PreAuthorize / @Secured 的 Controller
grep -rn "@RequestMapping\|@GetMapping\|@PostMapping" --include="*.java" -l | \
  xargs grep -L "@PreAuthorize\|@Secured\|@RolesAllowed"

# 找 SSRF 風險點
grep -rn "RestTemplate\|HttpClient\|WebClient\|fetch\|axios" --include="*.java" --include="*.js"

# 找 mass assignment 風險（直接 bind request body）
grep -rn "@RequestBody\|ModelAttribute" --include="*.java"
```

---
*深查：`grep -rl "subdomain: api-security" skills/cybersecurity-library/skills/` → 28 個技能*
