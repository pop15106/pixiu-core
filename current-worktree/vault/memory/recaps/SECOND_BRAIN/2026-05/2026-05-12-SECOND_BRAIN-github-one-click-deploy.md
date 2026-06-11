---
type: session-recap
date: 2026-05-12
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: github-one-click-deploy
status: done
tags: [recap, session, second-brain, github, deploy, qdrant, n8n, path]
summary: 規劃 second-brain 的 GitHub 一鍵部署流程，整理環境變數、容器啟動與 secret 邊界。
---

# Session Recap：第二大腦 GitHub 化與一鍵部署

## 任務目標

使用者希望把 `second-brain` 推到 GitHub，並整理成可一鍵部署的專案；同時要求不可寫死本機路徑、不可把 secret 寫進 repo。

## 本次完成

1. 新增 repo root 一鍵部署腳本 `deploy.ps1`。
   - 自動建立 `.env` 與 `data/` 目錄。
   - 啟動 Docker Compose 的 n8n / Qdrant。
   - 等待服務 ready。
   - 預設跑 Qdrant smoke test。
   - 可用 `-DryRunIndex -IndexLimit 1` 做不打 NVIDIA API 的索引 dry-run。

2. 調整 `scripts/setup-env.ps1`，移除寫死本機路徑。
   - `SECOND_BRAIN_HOST_PATH` 改由 repo root 自動解析。
   - Pixiu vault 可從 `-PixiuVaultPath`、`-PixiuCorePath`、`PIXIU_CORE`、`PIXIU_CORE_PATH`、`%USERPROFILE%\.pixiu-core` 解析。
   - 找不到 vault 時提示使用者傳入參數，不再假設固定桌面路徑。

3. 補 GitHub release 安全檢查。
   - 新增 `scripts/validate-release.ps1`。
   - 掃描 NVIDIA key pattern、Windows 使用者路徑與舊本機路徑。
   - 檢查 PowerShell scripts parser error。
   - 新增 `.github/workflows/validate.yml`，push / PR 時自動執行。

4. 補 GitHub 友善設定。
   - 新增 `.gitattributes`。
   - 強化 `.gitignore`，排除 `.env`、`out/`、`data/n8n`、`data/qdrant`、索引 queue、pycache 等本機產物。
   - 保留必要 `.gitkeep` 作資料夾骨架。

5. 重寫 `README.md` 成可公開 / 私有 GitHub repo 使用的部署說明。
   - 一鍵部署範例改用 `<path-to-pixiu-core>` / `<path-to-vault>` placeholder。
   - 移除 `C:\Users\7010...` 這類本機硬路徑。
   - 明確寫出 `.env` 只放本機 secret，不進版控。

6. 修正手冊產生器中的硬路徑範例。
   - `scripts/build-operation-manual.py` 改用 `<repo-root>` 與 `<path-to-pixiu-core>\vault`。

## 驗證結果

- `powershell -ExecutionPolicy Bypass -File .\scripts\validate-release.ps1`：通過。
- PowerShell parser 檢查：通過。
- `docker compose --env-file .env config --quiet`：exit 0；Docker config 有權限警告但不影響 compose config 驗證。
- 非 sandbox 執行 `deploy.ps1 -SkipSmokeTest -DryRunIndex -IndexLimit 1`：通過。
  - Qdrant ready：`http://localhost:6333/collections`
  - n8n ready：`http://localhost:5678`
  - dry-run：1 份文件產生 2 chunks，未呼叫 NVIDIA API。
- release scan 未發現實際 NVIDIA key；只有 validate 腳本自己的偵測 regex。

## 重要邊界

- `.env` 是本機設定，不進 GitHub。
- GitHub repo 不保存 NVIDIA API key。
- Docker volume 仍需要 `.env` 寫入本機絕對 host path，這是 Docker Compose 的必要條件；但該路徑由 setup 腳本在部署者本機產生，不寫死在 repo。
- Qdrant index 是可重建資料，不是 source of truth。

## 下次可做

- [ ] 決定 GitHub repo 要放在個人帳號或 organization。
- [ ] 若要真正 push，先建立獨立 Git repo 或把 `second-brain/` subtree 拆出去。
- [ ] 視需要補 `sample.env` 或 GitHub Release 說明。
- [ ] 若要跨平台支援 Linux/macOS，再補 `.sh` 版 deploy script。
