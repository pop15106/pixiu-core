# Coding Style

## Style Application Context（最高優先）

**規則套用情境由操作類型決定：**

```
你正在：
├─ 建立全新檔案？        → 套用以下 Pixiu 風格規範
├─ 在既有檔案新增程式碼？ → 完全配合該檔案既有風格（含語法版本）
└─ 修改既有程式碼？       → 完全配合被修改那段的既有風格
```

### 修改或擴充既有檔案時
- **完全配合現有風格**，即使不符合 Pixiu 規範（含 ES5 `var`、單/雙引號、縮排、語法版本）
- 禁止因「風格不一致」修改你未被要求改的行
- 禁止順便加 type hints、docstring、quote 統一、whitespace 調整
- 每一行改動必須能直接對應使用者的需求

### 例外
- 若既有風格涉及**安全漏洞**（如 SQL 拼接、硬編碼 secret），可提出但不得自行修改

---

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```
// Pseudocode
WRONG:  modify(original, field, value) → changes original in-place
CORRECT: update(original, field, value) → returns new copy with change
```

Rationale: Immutable data prevents hidden side effects, makes debugging easier, and enables safe concurrency.

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context on the server side
- Never silently swallow errors

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values (use constants or config)
- [ ] No mutation (immutable patterns used)
