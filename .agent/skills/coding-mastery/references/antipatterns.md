# 反模式警告

## 🔴 致命級（Must Fix）

### God Object / God Function
```python
# ❌ 一個 class 做所有事
class UserManager:
    def create_user(self): ...
    def send_email(self): ...
    def generate_report(self): ...
    def backup_database(self): ...
    def calculate_tax(self): ...
```
**為什麼危險**：違反單一責任，無法測試，無法重用
**修正**：拆分成 UserService、EmailService、ReportService 等

### Callback Hell
```javascript
// ❌ 回調地獄
getUser(id, (user) => {
  getOrders(user.id, (orders) => {
    getItems(orders[0].id, (items) => {
      calculateTotal(items, (total) => {
        // 四層縮排，可讀性歸零
      });
    });
  });
});
```
**修正**：使用 async/await 或 Promise chain

### SQL Injection
```python
# ❌ 字串拼接 SQL
query = f"SELECT * FROM users WHERE name = '{user_input}'"
```
**修正**：永遠使用參數化查詢

---

## 🟡 嚴重級（Should Fix）

### Premature Optimization
```python
# ❌ 在搞清楚瓶頸前就做優化
# 用 bit manipulation 節省 0.001ms，但程式碼沒人看得懂
result = (x >> 1) + (x & 1)  # 什麼鬼？
```
**原則**：先 profiling，再優化真正的瓶頸

### Copy-Paste Programming
```python
# ❌ 同樣的驗證邏輯出現在 5 個地方
def create_user(data):
    if not data.get('email') or '@' not in data['email']:
        raise ValueError("Invalid email")
    ...

def update_user(data):
    if not data.get('email') or '@' not in data['email']:
        raise ValueError("Invalid email")  # 又來了
    ...
```
**修正**：抽取成共用函式 `validate_email()`

### Magic Numbers / Strings
```python
# ❌ 到處都是看不懂的數字
if status == 3:  # 3 是什麼？
    time.sleep(86400)  # 86400 是什麼？
```
**修正**：
```python
STATUS_APPROVED = 3
SECONDS_PER_DAY = 86400
if status == STATUS_APPROVED:
    time.sleep(SECONDS_PER_DAY)
```

---

## 🟢 注意級（Nice to Fix）

### Over-Engineering
**症狀**：
- 為了「未來可能需要」建了 3 層抽象
- 一個簡單 CRUD 用了 15 個 class
- 寫了 Factory 的 Factory 的 Factory

**原則**：YAGNI（You Ain't Gonna Need It）

### Inconsistent Naming
**症狀**：
- `getUserData()` vs `fetch_user_info()` vs `loadUserDetails()`
- 同一個概念 3 種命名方式

**修正**：統一命名慣例，建立團隊 coding style guide

### Comment Smells
```python
# ❌ 註解重複程式碼說的話
i += 1  # i 加 1

# ❌ 過時的註解
# 這個函式會傳送 email（其實早就改成傳 webhook 了）

# ✅ 好的註解：解釋 Why
# 使用重試 3 次是因為第三方 API 在高峰期偶爾超時
```

---

## 偵測清單

產出程式碼前，快速掃描：

| 檢查項目 | 偵測方法 |
|---|---|
| 函式超過 30 行 | 行數檢查 |
| 巢狀超過 3 層 | 縮排檢查 |
| 重複程式碼 | 搜尋相似片段 |
| 硬編碼值 | 搜尋數字和字串常量 |
| 缺少錯誤處理 | 搜尋無 try-catch 的 IO 操作 |
| 不安全的輸入處理 | 搜尋字串拼接 |
