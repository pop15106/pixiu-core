---
type: session-recap
date: 2026-05-06
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: portable-path-sync
status: done
tags: [recap, pixiucore, path, sync, portable]
summary: 同步 PixiuCore 與 gravityTest 的 portable path 規則，釐清母體路徑解析與同步邊界。
---

# 2026-05-06 PixiuCore 母體同步與可攜路徑調整

## 背景

使用者要求比較並同步兩份 PixiuCore 母體：

- `C:\Users\7010\Desktop\gravityTest\pixiu-core`
- `C:\PixiuCore`

例外：`fleet.json` 屬於個人註冊檔，可依使用者不同而不一致。

後續補充的硬規則：這份母體會上傳 GitHub 給其他人使用，因此 repo 內不能寫死 `C:\Users\7010...`、`C:\PixiuCore` 或固定的 `Desktop\gravityTest` 路徑。Codex、Claude、Gemini 也都不能依賴固定母體位置。

## 決策

公開 repo 只保留可攜解析規則：

1. 優先使用 `PIXIU_CORE`。
2. 其次使用 `PIXIU_CORE_PATH`。
3. 最後使用 `%USERPROFILE%\.pixiu-core` 作為本機穩定入口。

本機安裝時由 `setup.bat` / `setup_zh.bat` 使用 `%~dp0` 推回目前 clone 的母體根目錄，再交給 `Tools\pixiu-init.ps1` 建立或更新 `%USERPROFILE%\.pixiu-core` junction。

## 已完成

- 兩份母體已同步，排除 `.git` 與 `fleet.json` 後完全一致。
- 掃描公開母體內容，已移除固定 `C:\Users\...`、`C:\PixiuCore`、`Desktop\gravityTest` 路徑。
- `setup.bat` 與 `setup_zh.bat` 改成只偵測自身所在目錄，並呼叫 `Tools\pixiu-init.ps1`。
- `Tools\pixiu-init.ps1` 改成可攜初始化腳本。
- Codex 本機入口改寫：
  - `%USERPROFILE%\.codex\AGENTS.md`
  - `%USERPROFILE%\.codex\instructions.md`
- Claude 本機入口改寫：
  - `%USERPROFILE%\.claude\CLAUDE.md`
  - `%USERPROFILE%\.claude\settings.json`
  - `agents / commands / hooks / rules / scripts` junction 指向 `%USERPROFILE%\.pixiu-core\...`
- Gemini 本機入口改寫：
  - `%USERPROFILE%\.gemini\GEMINI.md`
- 本機使用者環境變數已設定：
  - `PIXIU_CORE=%USERPROFILE%\.pixiu-core`
  - `PIXIU_CORE_PATH=%USERPROFILE%\.pixiu-core`

## 驗證

比對結果：

- `LeftFiles=2373`
- `RightFiles=2373`
- `OnlyLeft=0`
- `OnlyRight=0`
- `Different=0`

固定路徑掃描結果：

- `C:\Users\...`：0 筆
- `C:\PixiuCore`：0 筆
- `Desktop\gravityTest`：0 筆

本機 junction：

- `%USERPROFILE%\.pixiu-core` 指向目前的 gravityTest 版母體。
- Claude 相關 junction 改指向 `%USERPROFILE%\.pixiu-core` 底下的對應資料夾。

## 注意

目前這個 Codex session 的 process environment 仍可能保留舊值，需重開終端機 / Codex / Claude / Gemini 才會讀到新的使用者層級環境變數。

## 備份

主要備份位置：

- `C:\tmp\pixiu-public-portable-backup-20260506-120247`
- `C:\tmp\pixiu-public-portable-backup-20260506-120813`

## 後續原則

任何會進 GitHub 的 PixiuCore 檔案，不應放入個人絕對路徑。若文件需要表達路徑，使用：

- `%PIXIU_CORE%`
- `%PIXIU_CORE_PATH%`
- `%USERPROFILE%`
- `<workspace-root>`
- `<pixiu-core-root>`
- `$PSScriptRoot`
- `%~dp0`

本機產生檔可以含實際路徑，但應優先指向 `%USERPROFILE%\.pixiu-core`，不要直接指向某一次 clone 的絕對位置。