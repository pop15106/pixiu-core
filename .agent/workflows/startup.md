---
description: 啟動 PTWCS 專案的前後端服務
---

# PTWCS 專案啟動指南

## 環境設定（首次啟動前）

### 修改資料庫密碼

將 `application-local.properties` 的 `spring.datasource.password` 值改成：

```
spring.datasource.password=Zus9FZ89VbXMYazP9oSeCg==
```

---

## 後端啟動

### 方法 1：Eclipse IDE

1. 開啟 **Debug Configurations**
2. 選擇 **Java Application** → **PTWCS_STARTUP**
3. 點擊 **Debug**

### 方法 2：VS Code / Antigravity

1. 按 **F5** 開啟 Run and Debug
2. 選擇 **PTWCS_STARTUP**
3. 開始 Debug

### 方法 3：命令列

```powershell
cd ptwcs_ap
mvn spring-boot:run "-Dspring-boot.run.profiles=local"
```

---

## 前端啟動

```powershell
cd ptwcs_ap\view\ptwcs_react
npm install   # 第一次執行需要
npm start
```

---

## 存取位址

- **後端 API**：<http://localhost:8014/APTWCS>
- **前端**：依 npm start 輸出的位址（通常是 <http://localhost:3000）>

---

## 前端編譯與部署

### Step 1：編譯前端

```powershell
cd ptwcs_ap\view\ptwcs_react
npm run build
```

> 編譯產出位置：`ptwcs_ap\view\ptwcs_react\build\`

### Step 2：複製到後端 webapp

```powershell
# 清除舊檔並複製新檔
Remove-Item -Recurse -Force "ptwcs_ap\src\main\webapp\*"
Copy-Item -Recurse -Force "ptwcs_ap\view\ptwcs_react\build\*" "ptwcs_ap\src\main\webapp\"
```

### Step 3：推送 Git，走 CI/CD

```powershell
git add .
git commit -m "build: 更新前端靜態資源"
git push
```
>