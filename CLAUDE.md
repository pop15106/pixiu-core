# Claude Connection Protocol

Claude 以低 Token 模式連結 PixiuCore。

## Session 啟動

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. 讀取 `vault/bootstrap/SESSION-BOOTSTRAP.md`。
3. 執行 `node scripts/router/resolve-capabilities.js "<本次需求>"`。
4. 只讀 Router 回傳的 `filesToLoad`；最多 3 個 Capability。

Router 無法執行時才以 `vault/capabilities/capability-manifest.json` 降級路由。一般 Session 不全文載入 `user_rules.md`、identity、`memory-summary.md`、recap、decisions、全部 Skills、Workflows、Hooks 或 Agents。需要治理原文、舊決策或特定工作流時再按需載入。

## Claude 邊界

- Hooks 以 `ECC_HOOK_PROFILE=minimal|standard|strict` 控制成本。
- `/devfleet`、`/multi-plan`、`/orchestrate` 或其他 Agent Team 能力需使用者明確同意。
- 子 Agent 只接收精簡任務包，不重讀完整母體。
- 完成前重讀修改檔、檢查差異並執行最小充分驗證。

Capability 路由：

```powershell
node scripts/router/resolve-capabilities.js "<本次需求>"
```

完整制度按需從 `vault/governance/INDEX.md` 路由。
