# Pixiu 強化母體 (PixiuCore)

**AI 工具中央母艦** — 統一管理 Claude Code、Gemini Antigravity 的規則、技能與工作流程。

## 🏗️ 架構概覽

PixiuCore 是所有 AI 工具的唯一規則來源。無論你使用 Claude Code 還是 Gemini Antigravity，都從這裡讀取同一套憲法規則與技能庫。

```
C:\PixiuCore\
├── user_rules.md            ← 7 層憲法核心規則（硬閘門）
├── CLAUDE.md                ← Claude Code 全域啟動協議
├── SKILLS_INDEX.md          ← 176 個技能分類索引
├── setup.bat                ← 安裝腳本
├── pack-for-friend.bat      ← 打包分享腳本
└── .agent\
    ├── skills\              ← 176 個技能（/plan、/tdd、/code-review...）
    ├── workflows\           ← 76 個工作流程（/compact、/checkpoint...）
    └── rules\               ← 50 條規則（風格、安全、Token Guardian）
```

**資料流向：**

```
PixiuCore（唯一來源）
    ├─→ Claude Code       透過 additionalDirectories + ~/.claude/CLAUDE.md
    └─→ Gemini Antigravity 透過 ~/.gemini/GEMINI.md（由 setup.bat 生成）
```

---

## 💻 本機安裝（自己使用）

### 步驟一：Clone 母體

```bash
git clone https://github.com/pop15106/pixiu-core C:\PixiuCore
```

### 步驟二：執行安裝腳本

在 `C:\PixiuCore\` 目錄，**右鍵以系統管理員執行** `setup.bat`：

```
C:\PixiuCore\setup.bat
```

安裝腳本自動完成以下四件事：

| 步驟 | 動作 | 結果 |
|------|------|------|
| 1 | 設定 `PIXIU_CORE_PATH` 環境變數 | 其他腳本可找到母體位置 |
| 2 | 建立 `~\.gemini\` 目錄 | Gemini 設定目錄 |
| 3 | 寫入 `~\.gemini\GEMINI.md` | Gemini Antigravity 啟動協議 |
| 4 | 嵌入 `user_rules.md` 規則 | 母體規則注入 Gemini |

安裝完成後**重新啟動終端機**讓環境變數生效。

### 步驟三：設定 Claude Code（additionalDirectories）

在 Claude Code 設定中加入：

```json
{
  "additionalDirectories": ["C:\\PixiuCore"]
}
```

### 步驟四：驗證安裝

開啟 Claude Code，應看到啟動訊息：

```
⚡ Pixiu 強化母體已連線
載入：Pixiu 7 層憲法 + ECC 全集（176 skills · 76 commands · 50 rules）
可用指令：/plan /tdd /code-review /verify /devfleet ...
```

---

## 📦 打包分享給朋友

執行 `pack-for-friend.bat`：

```
C:\PixiuCore\pack-for-friend.bat
```

此腳本會：
1. `git pull` 同步最新版本
2. 打包 `.agent\`、`user_rules.md`、`CLAUDE.md`、`setup.bat` 為 `pixiu-mothership.zip`
3. 輸出到桌面，詢問是否開啟資料夾

朋友收到 zip 後只需：
1. 解壓到任意資料夾（建議 `C:\PixiuCore`）
2. 執行 `setup.bat`
3. 重啟終端機 / Antigravity

---

## 🧠 可用指令（部分）

| 類別 | 指令 |
|------|------|
| 規劃 | `/plan` `/devfleet` `/orchestrate` |
| 開發 | `/tdd` `/build-fix` `/refactor-clean` |
| 審查 | `/code-review` `/rust-review` `/go-review` |
| 維運 | `/deploy` `/verify` `/quality-gate` |
| 記憶 | `/save-session` `/resume-session` `/compact` |
| 學習 | `/learn` `/learn-eval` `/instinct-status` |

完整清單見 [SKILLS_INDEX.md](SKILLS_INDEX.md)。

---

## 📁 關聯專案

- [OpenClaw Manager](https://github.com/miaoxworld/openclaw-manager) — 跨平台 AI Agent 管理桌面應用

---

*Pixiu 強化母體 · 讓所有 AI 工具說同一種語言*
