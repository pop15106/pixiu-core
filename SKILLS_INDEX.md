# PixiuCore 技能索引入口

> 本檔只作為人類導覽，不參與 Session runtime 路由，也不維護第二份完整 Skill 清單。

## 單一真源

- 人類可讀分類索引：[`skills/INDEX.md`](skills/INDEX.md)
- Runtime 語意路由：[`vault/capabilities/capability-manifest.json`](vault/capabilities/capability-manifest.json)
- Router：`node scripts/router/resolve-capabilities.js "<本次需求>"`
- Metadata 驗證：`node scripts/skills/validate-skill-metadata.js skills`

## 目前盤點（2026-07-27）

| 類型 | 數量 | 說明 |
|---|---:|---|
| Canonical Skill 文件 | 90 | `skills/` 下 89 個 `SKILL.md`，加上 `skills/INDEX.md` 路由索引 |
| Portable Skill 發佈目錄 | 87 | `.agents/skills/`；供 OpenAI／Codex 可攜發佈，不是 canonical 真源 |
| Commands | 59 | `commands/*.md` |
| Agents | 27 | `agents/*.md` |
| Workflows | 79 | `.agent/workflows/*.md` |
| Rules | 51 | `rules/**/*.md` |
| Fleet entries | 30 | `fleet.json` |

數量只代表 2026-07-27 的 repository 快照。新增、刪除或搬移能力後，先執行 README 的「快速盤點指令」與 Lazy Loading 驗證，再更新本表。

## 載入原則

正常 Session 只讀 `vault/bootstrap/SESSION-BOOTSTRAP.md`，再執行 Capability Router；不得因閱讀本索引而全文載入所有 Skills。Router 無法執行時，才以 Capability Manifest 作降級索引。
