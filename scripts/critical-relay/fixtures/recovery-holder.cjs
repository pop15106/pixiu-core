'use strict';

// 本檔僅建立中性測試程序，讓測試真實終止它並驗證恢復流程。
const fs = require('node:fs');
const { acquireRunLock } = require('../run-recovery');
const { boundedPath, atomicJson } = require('../test-plan');
const { createRunJournal } = require('../run-journal');
const [root, runId, mode = 'running'] = process.argv.slice(2);
const lock = acquireRunLock(root, runId);
const runPath = `.cr/runs/${runId}`;
if (mode !== 'init-only') {
  fs.mkdirSync(boundedPath(root, runPath, { mustExist: false }), { recursive: true });
  atomicJson(root, `${runPath}/result.json`, { schemaVersion: 'pixiu.test-run.v1', runId,
    executionOwner: lock.identity, outcome: 'RUNNING', currentCommandId: 'sample', startedAt: new Date().toISOString(),
    endedAt: null, commands: [{ commandId: 'earlier', outcome: 'PASS', fixture: true }] });
  const journal = createRunJournal(root, runPath, 'sample');
  journal.append('{"schemaVersion":"pixiu.node-events.v1","record":"case","name":"中性已完成事件","status":"passed","ordinal":1}\n', 'stdout');
  journal.append('{"record":"unfinished', 'stdout');
}
process.send?.({ ready: true, runId });
setInterval(() => {}, 1000);
