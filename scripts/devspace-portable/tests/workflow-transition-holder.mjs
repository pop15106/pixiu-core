import fs from 'node:fs';
import { installBundle, rollbackBundle } from '../workflow-bundle.mjs';
const [mode, bundle, bin, phase, receiptId] = process.argv.slice(2);
function pause(step, value) {
  if (step !== phase) return;
  // 主測試只終止這個由暫存驗收建立的程序；此階段不啟動外部子程序。
  fs.writeSync(1, JSON.stringify({ step, transactionId: value.transactionId, receiptId: value.receiptId }) + '\n');
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  throw new Error('FIXTURE_TRANSITION_TIMEOUT');
}
try {
  const result = mode === 'install' ? installBundle(bundle, bin, pause) : rollbackBundle(bin, receiptId, pause);
  console.log(JSON.stringify(result));
} catch (error) { console.error(error.message); process.exitCode = 2; }
