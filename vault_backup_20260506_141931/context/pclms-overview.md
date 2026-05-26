---
type: context
readAt: when-relevant
applyTo: PCLMS 相關任務
---

# PCLMS 系統概覽

> 當任務涉及 PCLMS 時必讀。
> 請使用者補充標記 `<!-- TODO -->` 的欄位。

## 系統定位

**PCLMS（抵押品管理系統）** — 金融業後台系統
- 性質：企業內部系統，非對外產品
- 重要性：高（涉及金融交易與擔保品計算）
- 維護階段：迭代維護，非重寫

## 模組架構

| 模組 | 路徑 | 職責 |
|------|------|------|
| **AP** | `PCLMS_AP/` | <!-- TODO: AP 模組說明 --> |
| **BK** | `PCLMS_BK_new/` | Java 後端（Spring MVC、Maven） |
| **FD** | `PCLMS_FD/` | <!-- TODO: 前端框架與說明 --> |
| **LIBS** | `PCLMS_LIBS_new/` | 共用函式庫 |

## 後端關鍵服務層（已知）

| 服務 | 檔案 | 說明 |
|------|------|------|
| CalBalanceService | `CalBalanceServiceImpl.java` | 餘額計算 |
| GoodsBalanceService | `GoodsBalanceServiceImpl.java` | 商品餘額 |
| GrntService | `GrntServiceImpl.java` | 保證相關 |
| OutNMonthsService | `OutNMonthsServiceImpl.java` | 月份到期處理 |

## 分支策略

```
feature/xxx → r_sit → r_uat → master
```

- `master`：正式環境
- `r_uat`：UAT 測試環境
- `r_sit`：SIT 測試環境
- `feature/*`：功能開發分支

## 技術約束

- DB schema 不可大改（需特別審核）
- 現有 servlet 架構維持
- 安全性為第一優先

## 待補充

- [ ] AP 模組實際職責：___
- [ ] FD 前端框架：___
- [ ] DB 類型與版本：___
- [ ] 部署方式：___
- [ ] 外部系統介接：___
