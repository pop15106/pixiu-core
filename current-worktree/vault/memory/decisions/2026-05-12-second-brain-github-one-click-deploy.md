---
type: decision
date: 2026-05-12
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: second-brain-github-one-click-deploy
status: accepted
decision: 第二大腦 GitHub 一鍵部署策略
choice: `second-brain` 可以推到 GitHub，但 repo 內不得保存本機絕對路徑或 API key。部署改採 root `deploy.ps1` 一鍵啟動，並由 `setup-env.ps1` 在部署者本機產生 `.env`，把 Docker Compose 需要的 host path 寫進本機檔案。
summary: 第二大腦 GitHub 一鍵部署策略：`second-brain` 可以推到 GitHub，但 repo 內不得保存本機絕對路徑或 API key。部署改採 root `deploy.ps1` 一鍵啟動，並由 `setup-env.ps…
tags: [decision, second-brain, github, deploy, env, path]
---

# Decision：第二大腦 GitHub 一鍵部署策略

## 決策

`second-brain` 可以推到 GitHub，但 repo 內不得保存本機絕對路徑或 API key。部署改採 root `deploy.ps1` 一鍵啟動，並由 `setup-env.ps1` 在部署者本機產生 `.env`，把 Docker Compose 需要的 host path 寫進本機檔案。

## 原則

- Repo 只保存腳本、compose、README、workflow、`.env.example` 與資料夾骨架。
- `.env`、n8n data、Qdrant data、索引 queue、輸出文件不進版控。
- Docker Compose 需要的 host absolute path 由部署時解析，不寫死在 README / scripts。
- Push / PR 以 `scripts/validate-release.ps1` 擋 secret 與本機路徑。

## 驗證

- `deploy.ps1 -SkipSmokeTest -DryRunIndex -IndexLimit 1` 已在本機非 sandbox 環境通過。
- release validation 已通過。
