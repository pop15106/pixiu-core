---
name: iam-and-access-control
description: Identity and Access Management covering authentication design, authorization models (RBAC/ABAC), OAuth2/OIDC flows, JWT handling, session management, and privilege escalation prevention. Use when designing auth systems or reviewing access control logic.
origin: cybersecurity-library
source: subdomain identity-access-management in skills/cybersecurity-library/skills/
tags: [security, iam, auth, oauth2, jwt, rbac, session]
---

# IAM & Access Control

> 完整技能庫：`skills/cybersecurity-library/iam-and-access-control/`（共 ~20 個技能）

## 認證設計原則

### 密碼處理
- [ ] 密碼用 **bcrypt**（cost ≥ 12）/ argon2id / scrypt（禁用 MD5, SHA1, SHA256 直接 hash）
- [ ] 密碼長度最小 8 位，建議 12 位以上
- [ ] 支援 passphrase（不強制特殊符號）
- [ ] 密碼重設 token 一次性 + 有效期 ≤ 1 小時

```java
// Java BCrypt 範例
BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
String hashed = encoder.encode(rawPassword);
boolean match = encoder.matches(rawPassword, hashed);
```

### JWT 安全
- [ ] 使用非對稱演算法（RS256 / ES256）生產環境（不用 HS256 共享 secret）
- [ ] 驗證 `iss`, `aud`, `exp` claims
- [ ] Access token 短效（15 min），refresh token 長效（7-30 days）
- [ ] 禁止 `alg: none` 攻擊（明確指定允許的演算法）
- [ ] Token 儲存：`httpOnly` cookie（不放 localStorage）

### Session Management
- [ ] 登入後更換 session ID（防 session fixation）
- [ ] Idle timeout（30 min）+ absolute timeout（8 hr）
- [ ] 登出時 server side invalidate session
- [ ] Session ID 長度 ≥ 128 bits，使用 CSPRNG

## 授權模型

### RBAC（Role-Based Access Control）
適合：角色固定、邊界清晰的系統

```
User → Role(s) → Permission(s) → Resource
```

**Spring Security 範例結構**（依實際 stack 調整）：
```java
@PreAuthorize("hasRole('ADMIN') or hasPermission(#id, 'Document', 'READ')")
public Document getDocument(Long id) { ... }
```

### ABAC（Attribute-Based Access Control）
適合：動態條件、多維度的存取規則

```
Policy: user.department == resource.department AND user.clearance >= resource.sensitivity
```

## 常見授權漏洞

| 漏洞 | 描述 | 防護 |
|------|------|------|
| Vertical Privilege Escalation | 一般用戶存取 admin 功能 | server-side role check |
| Horizontal Privilege Escalation | 存取他人同等級資源 | ownership check |
| Insecure Direct Object Reference | 直接用 DB ID 存取 | 驗證物件所有權 |
| Forced Browsing | 直接存取未連結的 URL | 所有路由都有 auth check |
| JWT Claim Tampering | 修改 payload | 驗證簽章，不信任未驗證 claims |

## OAuth2 / OIDC 安全

- [ ] 使用 `state` 參數防 CSRF
- [ ] 使用 PKCE（Proof Key for Code Exchange）for public clients
- [ ] `redirect_uri` 嚴格白名單（不允許 wildcard）
- [ ] Authorization code 一次性使用
- [ ] 不在 fragment / URL 中傳 access token

## 快速掃描

```bash
# 找沒有 auth check 的路由
grep -rn "@RequestMapping\|@GetMapping\|@PostMapping\|@DeleteMapping" --include="*.java" -l | \
  xargs grep -L "@PreAuthorize\|@Secured\|.hasRole\|.hasAuthority"

# 找可能的 JWT 弱點
grep -rn "none\|HS256\|setSigningKey" --include="*.java"
grep -rn "localStorage.setItem.*token\|sessionStorage.setItem.*token" --include="*.js"

# 找直接使用 MD5/SHA1 做密碼
grep -rn "MessageDigest.getInstance.*MD5\|MessageDigest.getInstance.*SHA-1" --include="*.java"
```

---
*深查：`grep -rl "subdomain: identity-access-management" skills/cybersecurity-library/skills/` → 33 個技能*
