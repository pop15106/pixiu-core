> **English summary:** Track implementation and verification of DevSpace cross-session workflow control.

# 任務清單

**Status:** VERIFIED

- [x] 建立 ledger、scope、handoff、review、revision 與 idempotency 的測試
- [x] 實作 workflow controller 與 hash-chained persistence
- [x] 實作 requested/effective policy 與本地 Agent adapter
- [x] 暴露 DevSpace MCP create/list/update/run/sync tools
- [x] 接入 OneClick module install、environment 與安全 patch lifecycle
- [x] 更新操作文件且不碰 watchdog 既有修改
- [x] 跑完整測試與獨立 Agent 驗收

## Notes

- 2026-08-12：使用者已明確允許 Agent Team 品質模式與直接實作。
- 2026-08-12：主 worktree 的 watchdog/README/tests 有既存修改，本功能在 detached 隔離 worktree 開發並避開重疊檔案。
- 2026-08-12：portable suite 105/105、workflow Node tests 11/11、獨立 Agent acceptance PASS。
- 2026-08-12：實際 DevSpace 1.0.4 已更新；MCP session 建立 200、工具呼叫 200、stderr 為空。
