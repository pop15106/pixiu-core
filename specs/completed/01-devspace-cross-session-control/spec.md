> **English summary:** Add durable, scope-safe handoff and review workflows to DevSpace Web with selectable execution policies.

# DevSpace 跨 Session 工作接力與監督

## 背景

現有 DevSpace 已能讓 ChatGPT Web 操作 workspace 並啟動本地 Agent，但工作責任、handoff、review 與每次執行政策沒有跨 session 的共同真相來源。詳見 `docs/DESIGN.md`。

## User stories

- 身為使用者，我可以在 Web GPT 建立限定單一 session、同專案或跨專案的工作。
- 身為下一個 session，我可以看到可接手工作並 acknowledgment，而不必依賴前一段聊天記憶。
- 身為工作發起者，我可以要求另一個 session/Agent 監督，且 reviewer 不能與 producer 相同。
- 身為使用者，我可以選模型、推理強度、Deep Research 與 Pro mode，並知道實際是否生效。

## 驗收條件

1. 同一 revision 的並行 claim 只有一個成功；stale revision 被拒絕。
2. 同一 idempotency key 重試不新增事件。
3. `single_session`、`same_project`、`cross_project` 都拒絕越界操作。
4. handoff 缺少 context、deliverables、open items 或 required next action 時被拒絕；目標接手者必須 acknowledge。
5. review 綁定固定 revision，reviewer 與 producer 不同；未通過 review 的必審工作不能完成。
6. 每個 run 同時保存 requested/effective policy；Deep Research/Pro 不得靜默降級。
7. Web GPT 可透過 DevSpace MCP 直接 create/list/update/run/sync。
8. DevSpace Agent run 可使用選定 model 與 reasoning effort，並可同步 Agent status/output。
9. ledger hash chain 可重播出相同 task state；竄改或截斷造成不一致時拒絕 mutation。
10. 不修改現有 watchdog 與 watchdog tests，且既有 portable tests 維持通過。

## 非功能需求

- 只使用 Node.js 與現有 DevSpace 依賴，不新增套件。
- 所有寫入採窄範圍本機 state directory；不得寫入任意 project path。
- MCP 輸入有長度、enum、路徑來源與角色邊界驗證。
- 安裝 patch 僅支援已鎖定的 DevSpace 1.0.4，遇未知 drift fail closed。
