# Gemini Connection Protocol

Gemini 以低 Token 模式連結 PixiuCore。

## Session 啟動

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. 讀取 `vault/bootstrap/SESSION-BOOTSTRAP.md`。
3. 讀取 `vault/capabilities/capability-manifest.json`，依本次需求選擇最多 3 個 Capability。
4. 只讀 Manifest 指向的 Skill、Context 與 Governance。

一般 Session 不全文載入 `user_rules.md`、identity、`memory-summary.md`、recap、decisions、全部 Skills、Workflows、Hooks 或 Agents。若工具不支援 Skill 或 Hook，退化為「Bootstrap＋Manifest＋手動讀取命中文件」。

## Gemini 邊界

- 研究與發想結果必須回到正式文件、repo 原始碼或第一手來源驗證。
- Agent Team 或跨模型派工需使用者明確同意。
- Recap、舊決策與跨 Session 工作先讀 `vault/memory/SESSION-INDEX.md`。
- 完成前執行最小充分驗證並回報未確認事項。

Capability 路由：

```powershell
node scripts/router/resolve-capabilities.js "<本次需求>"
```

完整制度按需從 `vault/governance/INDEX.md` 路由。
