#!/usr/bin/env node
'use strict';

/**
 * install-to-codex.js — 生成本機 Codex 治理 hooks 接線（可攜）
 *
 * 作用：讀母體內的 hooks.template.json，把佔位符換成「這台機器」的實際
 *       node 路徑與母體 bridge 路徑，生成 %USERPROFILE%\.codex\hooks.json。
 * 可攜：node 路徑用 process.execPath 動態取得（不寫死）；母體路徑用
 *       PIXIU_CORE / PIXIU_CORE_PATH / 從腳本位置反推（三層 fallback）。
 * 冪等：重跑覆寫，覆寫前備份既有 hooks.json。
 *
 * 用法：
 *   node scripts/setup/install-to-codex.js            # 寫到 %USERPROFILE%\.codex\hooks.json
 *   node scripts/setup/install-to-codex.js <目標路徑>  # 指定輸出（測試用）
 */

const fs = require('fs');
const path = require('path');

function resolveCore() {
  for (const c of [process.env.PIXIU_CORE, process.env.PIXIU_CORE_PATH]) {
    if (c && fs.existsSync(path.join(c, 'user_rules.md'))) return path.resolve(c);
  }
  const fromScript = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(fromScript, 'user_rules.md'))) return fromScript;
  throw new Error('找不到母體：請設 PIXIU_CORE 環境變數，或從母體 repo 內執行本腳本。');
}

const toPosix = p => String(p).replace(/\\/g, '/');
const toWin = p => String(p).replace(/\//g, '\\');
const quoteExecutable = value => `"${String(value).replace(/"/g, '\\"')}"`;

function generate({ core, nodeExe, target }) {
  const bridge = path.join(core, 'scripts', 'codex-bridge', 'pixiu-global-hook-bridge.js');
  if (!fs.existsSync(bridge)) throw new Error('找不到 bridge：' + bridge);
  const templatePath = path.join(core, 'scripts', 'codex-bridge', 'hooks.template.json');
  if (!fs.existsSync(templatePath)) throw new Error('找不到 template：' + templatePath);

  // 在物件層替換（不在 JSON 文字層），讓 stringify 正確轉義 Windows 路徑的反斜線
  const config = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const nPosix = quoteExecutable(toPosix(nodeExe));
  const nWin = quoteExecutable(toWin(nodeExe));
  const bPosix = toPosix(bridge);
  const bWin = toWin(bridge);
  for (const ev of Object.keys(config.hooks || {})) {
    for (const group of config.hooks[ev]) {
      for (const h of group.hooks || []) {
        if (h.command) h.command = h.command.split('__NODE__').join(nPosix).split('__BRIDGE__').join(bPosix);
        if (h.commandWindows) h.commandWindows = h.commandWindows.split('__NODE_WIN__').join(nWin).split('__BRIDGE_WIN__').join(bWin);
      }
    }
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
    fs.copyFileSync(target, `${target}.${stamp}.bak`);
  }
  fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return target;
}

if (require.main === module) {
  try {
    const core = resolveCore();
    const target = process.argv[2] ||
      path.join(process.env.USERPROFILE || process.env.HOME || '.', '.codex', 'hooks.json');
    const out = generate({ core, nodeExe: process.execPath, target });
    process.stdout.write(`已生成 Codex hooks 接線：${out}\n母體：${core}\nnode：${process.execPath}\n`);
  } catch (err) {
    process.stderr.write(`[install-to-codex] ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { generate, quoteExecutable, resolveCore, toPosix, toWin };
