---
type: agent-instinct
date: 2026-06-05
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: git-safe-directory-boundary
status: active
summary: 在 Codex sandbox 讀 PixiuCore git 狀態時，若遇到 dubious ownership，優先用單次 `git -c safe.directory=<path>`，不要直接改全域 Git 設定。
tags: [agent-learning, instinct, git, safe-directory, sandbox, pixiucore]
confidence: high
supporting_observations:
  - 2026-05-04-pixiucore-readme-update
  - 2026-06-05-vault-cleanup-audit
contradicting_observations: []
---

# Instinct - Git safe.directory 邊界

## Trigger

當 PixiuCore repo 位於使用者帳號底下，但目前 agent shell 使用 sandbox 身分執行 git，出現：

- `fatal: detected dubious ownership`
- `safe.directory`
- sandbox 使用者與 repo owner 不同

## First Move

1. 對單次唯讀 Git 查詢使用 `git -c safe.directory=<repo-path> -C <repo-path> ...`。
2. 不要未經使用者確認就執行 `git config --global --add safe.directory ...`。
3. 回報 repo 狀態時，明確說明是 sandbox owner 邊界，不代表 repo 壞掉。

## Rationale

PixiuCore 是母體 repo，Git 全域設定會影響使用者整台機器。單次 `-c safe.directory` 能完成狀態盤點，又不會擴大設定面。

## Boundaries

- 若使用者明確要求永久信任該 repo，可另提全域設定方案。
- 若要 commit / stage / push，仍需先確認工作樹範圍，因為目前母體 repo 可能有大量既有未提交變更。

## Evidence Base

- `vault/memory/recaps/2026-05-04-142717-PixiuCore-README更新.md`
- 本次 2026-06-05 vault 整理盤點中，普通 `git status` 再次觸發 dubious ownership，單次 `-c safe.directory` 可讀狀態。

## Promotion Rule

若這條規則在三次以上 PixiuCore 維護任務中都被證實必要，升格成 `vault/sop/pixiucore-git-maintenance.md`。
