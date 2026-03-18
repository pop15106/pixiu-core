# 設計模式速查

## 建立型模式（Creational）

### Factory Pattern
**何時用**：需要根據條件建立不同類型的物件
```python
def create_parser(file_type: str) -> Parser:
    parsers = {"json": JsonParser, "xml": XmlParser, "csv": CsvParser}
    return parsers[file_type]()
```

### Builder Pattern
**何時用**：物件建構參數多且有可選項
```typescript
const query = new QueryBuilder()
  .select("name", "email")
  .from("users")
  .where("active", true)
  .limit(10)
  .build();
```

### Singleton Pattern
**何時用**：全域只需一個實例（DB 連線池、設定管理）
**⚠️ 注意**：容易被濫用，優先考慮依賴注入

---

## 結構型模式（Structural）

### Adapter Pattern
**何時用**：整合不同介面的第三方程式碼
```python
class LegacyPrinter:
    def print_old(self, text): ...

class PrinterAdapter:
    def __init__(self, legacy: LegacyPrinter):
        self._legacy = legacy
    def print(self, text):
        self._legacy.print_old(text)
```

### Facade Pattern
**何時用**：簡化複雜子系統的介面
```typescript
class PaymentFacade {
  async processPayment(order: Order): Promise<Receipt> {
    const validation = await this.validator.validate(order);
    const payment = await this.gateway.charge(order.amount);
    const receipt = await this.receipts.generate(payment);
    return receipt;
  }
}
```

---

## 行為型模式（Behavioral）

### Strategy Pattern
**何時用**：同一行為有多種實現方式，需要在運行時切換
```python
class SortStrategy(Protocol):
    def sort(self, data: list) -> list: ...

class QuickSort:
    def sort(self, data: list) -> list: ...

class MergeSort:
    def sort(self, data: list) -> list: ...
```

### Observer Pattern
**何時用**：一對多通知機制
**典型場景**：事件系統、狀態管理、pub/sub

### Command Pattern
**何時用**：需要封裝操作以支持 undo/redo、佇列、日誌
**典型場景**：文字編輯器操作、交易處理

---

## 選擇建議

| 問題 | 推薦模式 |
|---|---|
| 「根據類型建立不同物件」 | Factory |
| 「建構參數太多太複雜」 | Builder |
| 「我要整合不同介面」 | Adapter |
| 「這個子系統太複雜，我要簡化」 | Facade |
| 「同一件事有多種做法」 | Strategy |
| 「狀態改變要通知很多人」 | Observer |
| 「我要支持 undo/redo」 | Command |
