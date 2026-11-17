---
paths:
  - "**/*.java"
  - "**/*.jsp"
  - "**/*Mapper.xml"
  - "**/*.sql"
---
# Java Coding Style（維運中的舊系統）

> 本檔延伸 [common/coding-style.md](../common/coding-style.md)，針對 PCLMS／PFTZC／PTWCS 這類 Servlet、Struts、Spring、DAO 加 Oracle Stored Procedure 的既有系統。新建的 Java 17 專案另用 `skills/java-coding-standards`。

## 先跟著既有程式

- 版本、框架、寫法一律以專案現況為準：先讀 `pom.xml`／`build.gradle`／`WEB-INF/lib`，不要假設 Java 版本或引入新框架。
- 修改時沿用同一檔案的命名、例外處理、交易邊界與 log 寫法，不順手重構。
- 註解使用繁體中文。

## 原值比對

- 字串比對先比原始值。不要默默做 HTML 解碼（`&amp;` 與 `&`）、trim、去前導零（`00127` 與 `127`），也不要把 NULL 與空字串視為相同。
- 業務代碼、報單號、料號用 `equals` 精確比較；要改成數字或忽略大小寫比較前，先確認業務規則。
- 顯示層或批次有做轉換時，在程式或文件寫明轉換發生在哪一層。

## Java 呼叫 Stored Procedure

- SP 新增、刪除或調整參數時，同一次變更必須同步修改所有 Java 呼叫端，並核對參數名稱、順序、型別與預設值。
- 測試環境的 SP 變更要等呼叫端也通過測試再上線；只改 SP 會造成收檔或交易失敗。
- 例外、rollback 與回傳碼要追到呼叫端；只有 catch 沒有再 throw，不能當作成功。

## SQL

- 動態條件一律用參數綁定（`PreparedStatement`、MyBatis `#{}`），不要字串拼接；`${}` 只用於已白名單檢查的欄位名。
- `UPDATE`／`DELETE` 先寫 `SELECT` 確認筆數，WHERE 條件要包含完整主鍵或明細鍵。
- 交易內的多表寫入要確認主檔、明細與 SENDLOG／歷史表的寫入順序與 commit 位置。

## 機密

- 連線字串與密碼放設定檔外部或環境變數，不要寫進原始碼或 `jdbc:oracle:thin:user/password@...`。
