---
type: recap
date: 2026-05-15
project: PCLMS_BK
system: PCLMS
repo: PCLMS_BK_new
topic: local-orapass-l8-db-test
status: verified-local
tags: [pclms, pclms-bk, oracle, orapass, l8, local-test]
summary: 驗證 PCLMS_BK 本機 orapass 與 L8 DB 連線條件，確認可行性與限制。
---

# PCLMS_BK local 讀營運 orapass 測 L8 DB 連線

## 背景

目標是在本機啟動 `pclms_bk` 的 L8 接收流程，驗證 local JVM 是否能讀取放在本機的營運 `orapass`，並透過這份 `orapass` 連到營運 DB。

本機 `orapass` 放置位置：

```text
C:\APCLMS\def\orapass
```

## DB 連線結論

已確認 local 可以讀取本機營運 `orapass`，並以 `PFTZBPool / P04A / pftzbmgr` 成功連上營運 DB。

成功訊號：

```text
[DBTEST] connect success, label=PFTZB, connectionId=PFTZBPool, authFile=/APCLMS/def/orapass, applicationId=P04A, authUser=pftzbmgr
```

注意：本次 recap 不保存任何密碼、orapass 密文或解密結果。

## 重要追查過程

1. 一開始只改 `pftzDS` 時，`DbFactory.open("PFTZBPool")` 仍會在初始化過程碰到其他 datasource，導致 `T04A/T01A/T13A` 對不上營運 `orapass` 而出現 `TvEncrypt.decode(null)`。

2. 檢查 `orapass` 檔案格式後，確認沒有 BOM、Tab、全形空白或欄位數異常。

3. 反編譯 `B64Hash-1.0.0.jar` 後確認 `TvEncrypt` 不是 DES/AES，而是 Trade-Van 自家 Base64 混淆格式：明文先 Base64，再每隔固定位置插入隨機大寫字母；decode 時移除插入字元後再 Base64 decode。

4. 最終採用暫時方案：把 `env/local/conf/xdao.xml` 的四個 datasource 都對齊營運 alias，讓整個 xdao 初始化流程不會被其他 datasource 拖垮。

## 暫時修改內容

只修改 local 設定與 DB 初始化 log：

```text
PCLMS_BK_new/JAVA/pclms_bp/env/local/conf/xdao.xml
PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/download/base/ConnectSupplier.java
```

`local xdao.xml` 暫時對齊：

```text
pclmsDS   -> P04A / pclmssrv
pftzDS    -> P04A / pftzbmgr
stagingDS -> P01A / pngsc4pclmssrv
PDCCUDS   -> P13A / pdccu4pclmssrv
```

`ConnectSupplier` 新增 `DBTEST` log，內容只印：

```text
connectionId
authFile
applicationId
authUser
entryFound
decodeSuccess
connect success/fail
```

不印密碼、不印 orapass 內容。

## 測試指令

```powershell
cd C:\Users\7010\Desktop\gravityTest\PCLMS_BK_new\JAVA\pclms_bp
mvn -q -DskipTests compile
java -cp "target\classes;target\lib\*" com.tradevan.sct.ClRecvL8 4 L8
```

## 目前下一關

DB 已成功後，流程繼續進到 JMS / dequeue。後續錯誤已變成本機目錄不存在：

```text
deq_dir is not set right
\PCLMS\TMP\REVFIL\L8 is either not there or not a directory
```

已在本機建立：

```text
C:\PCLMS\TMP\REVFIL\L8
C:\PCLMS\TMP\REVERR\L8
C:\PCLMS\TMP\REVOK\L8
C:\PCLMS\log
C:\PCLMS\LOG
```

下一次重跑 `ClRecvL8` 時，如果 queue 有 L8 訊息，應會進入實際 dequeue 與檔案落地測試。

## 測完後要回復

1. 還原 `env/local/conf/xdao.xml`，避免 local 長期指向營運 DB。

2. 移除或收斂 `ConnectSupplier.java` 的 `DBTEST` log，避免測試 log 被帶進正式分支。

3. 不要 commit `C:\APCLMS\def\orapass`，也不要把 orapass 內容貼到 log 或文件。

4. 清理本機 `C:\PCLMS\TMP\REVFIL\L8`、`REVERR\L8`、`REVOK\L8` 內測試產物。

