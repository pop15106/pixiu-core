'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { verifySnapshot } = require('./verify-snapshot.cjs');
const root = path.resolve(__dirname, '..');
try {
  const snapshot = verifySnapshot(root);
  const core = path.join(root, 'references/core');
  const { safeResolveFromFile } = require(path.join(core, 'scripts/router/resolve-capabilities.js'));
  const result = safeResolveFromFile(process.argv[2] || '',
    path.join(core, 'vault/capabilities/capability-manifest.json'));
  const files = result.filesToLoad || [];
  const available = new Set(snapshot.files.map(item => item.path));
  const stored = new Map(snapshot.files.map(item => [item.path, item.storagePath || item.path]));
  const bundled = files.filter(item => available.has(item));
  const external = files.filter(item => !available.has(item));
  // 外部記憶與工具資料只回報依賴，不從快照猜測目前內容。
  console.log(JSON.stringify({ ...result, sourceCommit: snapshot.sourceCommit,
    integrity: 'PASS', filesToLoad: bundled.map(item => 'references/core/' + stored.get(item)),
    externalReferences: external, execution: 'routing-only' }, null, 2));
  if (result.degraded) process.exitCode = 2;
} catch (error) { console.error(error.message); process.exitCode = 2; }
