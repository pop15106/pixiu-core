# 編碼大師 — 重構範例

## 情境：重構一個混亂的使用者驗證函式

### Before（重構前）

```python
def check(d):
    if d['email'] != None and d['email'] != '':
        if '@' in d['email']:
            if d['password'] != None and d['password'] != '':
                if len(d['password']) >= 8:
                    if d['age'] != None:
                        if d['age'] >= 18:
                            return True
                        else:
                            return False
                    else:
                        return False
                else:
                    return False
            else:
                return False
        else:
            return False
    else:
        return False
```

**問題分析**：
1. ❌ 函式名 `check` 毫無意義
2. ❌ 參數 `d` 沒有型別提示
3. ❌ 巢狀 7 層，可讀性歸零
4. ❌ `!= None and != ''` 重複寫法
5. ❌ 沒有錯誤訊息，呼叫方不知道為什麼失敗
6. ❌ 魔術數字 8 和 18
7. ❌ 沒有文件

### After（重構後）

```python
from dataclasses import dataclass
from typing import Optional

# 常數化魔術數字
MIN_PASSWORD_LENGTH = 8
MIN_AGE = 18

@dataclass
class ValidationError:
    """驗證失敗的結構化錯誤。"""
    field: str
    message: str

@dataclass
class UserRegistration:
    """使用者註冊資料。"""
    email: str
    password: str
    age: Optional[int] = None

def validate_registration(data: UserRegistration) -> list[ValidationError]:
    """驗證使用者註冊資料。
    
    Returns:
        空列表代表驗證通過，否則包含所有驗證錯誤。
    
    設計決策：回傳所有錯誤而非第一個錯誤，
    讓前端可以一次顯示所有問題，提升使用者體驗。
    """
    errors: list[ValidationError] = []
    
    # Email 驗證（Early return pattern 避免深層巢狀）
    if not data.email:
        errors.append(ValidationError("email", "Email 不可為空"))
    elif "@" not in data.email:
        errors.append(ValidationError("email", "Email 格式不正確"))
    
    # 密碼驗證
    if not data.password:
        errors.append(ValidationError("password", "密碼不可為空"))
    elif len(data.password) < MIN_PASSWORD_LENGTH:
        errors.append(ValidationError(
            "password", 
            f"密碼至少需要 {MIN_PASSWORD_LENGTH} 個字元"
        ))
    
    # 年齡驗證
    if data.age is None:
        errors.append(ValidationError("age", "年齡為必填"))
    elif data.age < MIN_AGE:
        errors.append(ValidationError(
            "age", 
            f"必須年滿 {MIN_AGE} 歲才能註冊"
        ))
    
    return errors
```

### 重構摘要

| 面向 | Before | After |
|---|---|---|
| 可讀性 | 7 層巢狀 | 平坦結構，每項驗證獨立 |
| 命名 | `check(d)` | `validate_registration(data: UserRegistration)` |
| 型別安全 | 無 | dataclass + type hints |
| 回傳值 | `True/False` | 結構化錯誤列表（所有錯誤一次返回） |
| 可維護性 | 加新驗證要改巢狀結構 | 直接加一個 `if` 區塊 |
| 可測試性 | 只能測通過/不通過 | 可以測每種錯誤類型 |
| 常數管理 | 魔術數字 8, 18 | `MIN_PASSWORD_LENGTH`, `MIN_AGE` |
