# Pixiu Vault Backup 20260611-182601

This repository is a vault-only safety backup created before integrating PixiuCore branches.

Contents:

- `current-worktree/vault/`: the vault currently present on disk at backup time.
- `branch-snapshots/master/vault/`: vault snapshot from `master`.
- `branch-snapshots/codex-rescue-pixiu-structure/vault/`: vault snapshot from `codex/rescue-pixiu-structure`.
- `branch-snapshots/test_branch/vault/`: vault snapshot from `test_branch`.
- `branch-snapshots/yongding-adjusted/vault/`: vault snapshot from `永碇調整版`.

Important consistency note:

- `yongding-adjusted` does not contain `vault/identity/founder-profile.md` or `vault/identity/agent-persona.md`.
- The integration branch must preserve those identity files from another source.
