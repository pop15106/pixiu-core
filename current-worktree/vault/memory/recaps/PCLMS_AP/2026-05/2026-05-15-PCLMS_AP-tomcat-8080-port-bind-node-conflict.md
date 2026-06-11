---
type: session-recap
date: 2026-05-15
project: PCLMS_AP
system: PCLMS
repo: PCLMS_AP
topic: tomcat-8080-port-bind-node-conflict
status: verified-local
tags: [recap, pclms, tomcat, port-8080, node, bindexception, local-debug]
summary: 排查 PCLMS_AP 啟動時 Tomcat 8080 與 Node 服務衝突，確認實際 port bind 來源。
---

# 2026-05-15 PCLMS_AP 本機 Tomcat 8080 Port 衝突排查

## 背景

使用者在 `PCLMS_AP` 本機啟動 Tomcat Maven plugin 時，出現：

- `java.net.BindException: Address already in use: JVM_Bind <null>:8080`
- `Failed to initialize connector [Connector[HTTP/1.1-8080]]`

目標是先確認根因，再排除本機 `8080` 佔用，讓 PCLMS 可重新啟動。

## 調查過程

1. 先確認這次錯誤是 Tomcat connector 在 bind `8080` 時失敗，不是 Spring context 初始化主因。
2. 檢查 repo 設定，確認 `JAVA/pclms_mvn/pom.xml` 的 `tomcat7-maven-plugin` 寫死：
   - `path=/pclms_web`
   - `port=8080`
3. 檢查 `WEB-INF/web.xml`，確認 `HostHeaderFilter` 的 `allowedHost` 也包含：
   - `localhost:8080`
   - `127.0.0.1:8080`
4. 用 `netstat -ano` 驗證本機 `8080` 確實被其他程序佔用。
5. 追到佔用程序為 `PID 12600`，程序名是 `node`。

## 根因

本次啟動失敗的直接根因是：

- PCLMS 本機 Tomcat 固定使用 `8080`
- 同時間已有另一個 `node` 程序先占住本機 `0.0.0.0:8080`
- 因此 Tomcat 無法 bind 成功，拋出 `BindException`

這不是 PCLMS 程式碼邏輯錯誤，也不是 Spring bean 初始化錯誤。

## 處理動作

1. 先用一般權限嘗試停止 `PID 12600`
   - 結果：`Access is denied`
2. 之後用提升權限停止該 `node` 程序
3. 再次驗證 `netstat -ano | findstr 8080`
   - 已無 `0.0.0.0:8080 LISTENING`
   - 僅剩一條本機程序對遠端 `172.20.25.161:8080` 的外連線，這不會阻止本機 Tomcat 綁定 `8080`

## 結論

本次問題已收斂為單純的本機 port 衝突，且衝突程序已清除。

當下結論：

- `PCLMS_AP` 可重新嘗試執行 `tomcat7:run`
- 若之後仍啟動失敗，應視為新的錯誤訊號，不能再沿用這次 `8080` 衝突結論

## 後續提醒

1. 若未來想改用 `8081` 或其他 port，不能只改 `pom.xml`
2. 需一併調整 `WEB-INF/web.xml` 中 `HostHeaderFilter` 的 `allowedHost`
3. 若再次遇到 `8080` 衝突，優先檢查是否有前端 dev server、Node 工具或其他本機 Tomcat 還在背景執行

## 相關檔案

- `JAVA/pclms_mvn/pom.xml`
- `JAVA/pclms_mvn/src/main/webapp/WEB-INF/web.xml`
