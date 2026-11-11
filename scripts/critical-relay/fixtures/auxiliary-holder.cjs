'use strict';

const fs = require('node:fs');
const { acquireAuxiliaryLock, recoverAuxiliaryLock } = require('../auxiliary-lock');
const [mode, root, kind, phase, operationId, ownerDigest] = process.argv.slice(2);
function onStep(step, identity) {
  if (step !== phase) return;
  // 只在測試建立的獨立程序暫停；主控測試只終止這個已保存的 PID。
  fs.writeSync(1, JSON.stringify({ step, operationId: identity?.operationId || null }) + '\n');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  throw new Error('FIXTURE_HOLDER_TIMEOUT');
}
try {
  if (mode === 'hold') {
    const lease = acquireAuxiliaryLock(root, kind, { onStep });
    lease.release();
    console.log(JSON.stringify({ released: true }));
  } else if (mode === 'recover') {
    console.log(JSON.stringify(recoverAuxiliaryLock(root, kind, { authorized: true, operationId, ownerDigest, onStep })));
  } else if (mode === 'migrate') {
    const { migrateFallback } = require('../plan-migration');
    const options = JSON.parse(fs.readFileSync(require('node:path').join(root, 'approval.json'), 'utf8'));
    console.log(JSON.stringify(migrateFallback(root, { ...options, authorized: true }, onStep)));
  } else throw new Error('FIXTURE_MODE_INVALID');
} catch (error) { console.error(error.message); process.exitCode = 2; }
