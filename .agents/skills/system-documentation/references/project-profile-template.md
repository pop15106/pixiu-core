# Project Profile Template

`system-documentation` 是通用 Skill；專案特殊事實放在 Project Profile 或 repo 既有文件。Profile 可以是一次性分析筆記，也可以由專案自行保存。

## 建議欄位

```yaml
systemName: <系統名稱>
repoRoots:
  - <repo path>
frameworks:
  backend: <framework>
  frontend: <framework / JSP / template>
entrypoints:
  - <menu / route / url / batch>
uiShellOwner: <portal / same repo / external shell>
uiAssetRoots:
  - <css path>
  - <image path>
schemaSources:
  - <DDL / CSV / metadata path>
runtimeEvidenceSources:
  - <actual screenshot / log / test environment>
knownAliases:
  <business name>: <code / module name>
documentConstraints:
  - <language / format / security / redaction>
notes:
  - <confirmed project-specific facts>
```

## Profile Rule

- Profile 只記「已確認」的專案事實。
- 不確定值用 `unknown` / `needs-verification`，不要猜。
- 敏感資訊（密碼、Token、個資）不要寫入 Profile。
- Project Profile 不應複製整個通用 Skill。
- 通用方法改在 `skills/system-documentation/`；專案差異改 Profile。

## UI Shell Example

若功能頁在舊 Portal 中：

```yaml
uiShellOwner: external-portal
runtimeEvidenceSources:
  - actual portal screenshot
uiAssetRoots:
  - repo/src/main/webapp/css
  - repo/src/main/webapp/img
notes:
  - 外層 Portal 以實際畫面為最高依據
  - 內頁以功能 repo 的 JSP/CSS/JS 為依據
```

## Schema Example

若專案附 CSV Schema：

```yaml
schemaSources:
  - docs/schema/tables.csv
  - docs/schema/columns.csv
  - docs/schema/triggers.csv
```

分析時把 Table / Column / Trigger 對回實際 Action / Service / DAO / SQL；不要只把 CSV 轉成表格就稱為功能規格。
