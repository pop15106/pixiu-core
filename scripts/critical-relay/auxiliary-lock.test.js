'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { acquireAuxiliaryLock, inspectAuxiliaryLock, recoverAuxiliaryLock, withAuxiliaryLock } = require('./auxiliary-lock');
const { digestObject } = require('./test-plan');
const holderPath = path.join(__dirname, 'fixtures/auxiliary-holder.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu 輔助鎖 '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function worker(root, mode, kind, phase, status = {}) {
  const child = spawn(process.execPath, [holderPath, mode, root, kind, phase, status.operationId || '', status.ownerDigest || ''],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', error = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', value => { output += value; });
  child.stderr.on('data', value => { error += value; });
  const ended = once(child, 'exit').then(([code, signal]) => ({ code, signal, output, error }));
  return { child, ended, async paused() {
    const deadline = Date.now() + 15000;
    while (!output.includes('\n')) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(error || '持有程序提早結束');
      if (Date.now() > deadline) throw new Error('等待持有程序逾時');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }, async kill() { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); return ended; } };
}
async function deadHolder(t, root, kind = 'control', phase = 'claim-published') {
  const w = worker(root, 'hold', kind, phase);
  t.after(() => w.kill());
  await w.paused(); await w.kill();
  return inspectAuxiliaryLock(root, kind);
}
function recovery(root, kind, status) {
  return recoverAuxiliaryLock(root, kind, { authorized: true, operationId: status.operationId, ownerDigest: status.ownerDigest });
}

for (const kind of ['control', 'install']) {
  test(`${kind} 正常互斥與釋放不刪除歷史，新持有者不受舊 release 影響`, t => {
    const root = fixture(t);
    const first = acquireAuxiliaryLock(root, kind);
    assert.equal(inspectAuxiliaryLock(root, kind).status, 'HELD_OR_UNKNOWN');
    assert.throws(() => acquireAuxiliaryLock(root, kind), /BUSY/);
    first.release(); first.release();
    assert.equal(inspectAuxiliaryLock(root, kind).status, 'IDLE');
    const second = acquireAuxiliaryLock(root, kind);
    assert.throws(() => first.release(), /OWNERSHIP_CHANGED/);
    assert.equal(inspectAuxiliaryLock(root, kind).operationId, second.identity.operationId);
    second.release();
    assert.equal(inspectAuxiliaryLock(root, kind).chainLength, 2);
  });
  for (const phase of ['owner-prepared', 'owner-published', 'claim-published', 'release-prepared', 'release-published']) {
    test(`${kind} 在 ${phase} 硬終止後仍有明確可恢復狀態`, async t => {
      const root = fixture(t);
      const status = await deadHolder(t, root, kind, phase);
      if (status.status === 'RECOVERY_REQUIRED') {
        const restored = recovery(root, kind, status);
        assert.equal(restored.processesKilled, 0);
        assert.equal(restored.stateChanged, false);
      } else assert.ok(['ABSENT', 'IDLE'].includes(status.status));
      const next = acquireAuxiliaryLock(root, kind); next.release();
      assert.equal(inspectAuxiliaryLock(root, kind).status, 'IDLE');
    });
  }
}

test('活 PID 即使出生時間不同或鎖齡很舊也不得恢復', t => {
  const root = fixture(t);
  const lease = acquireAuxiliaryLock(root, 'control');
  const record = { ...lease.identity, birth: '中性錯誤出生時間', createdAt: '2000-01-01T00:00:00.000Z' };
  // root 與 owner 是同一份硬連結資料；此處僅竄改本案例的中性暫存鎖。
  fs.writeFileSync(path.join(root, '.cr/control.lock'), JSON.stringify(record));
  const status = inspectAuxiliaryLock(root, 'control');
  assert.throws(() => recovery(root, 'control', status), /OWNER_ALIVE_OR_UNKNOWN/);
  assert.equal(inspectAuxiliaryLock(root, 'control').operationId, lease.identity.operationId);
});

test('授權、操作 ID 與完整內容指紋都必須一致', async t => {
  const root = fixture(t);
  const status = await deadHolder(t, root);
  assert.throws(() => recoverAuxiliaryLock(root, 'control', { operationId: status.operationId, ownerDigest: status.ownerDigest }), /AUTHORIZATION/);
  assert.throws(() => recovery(root, 'control', { ...status, ownerDigest: 'a'.repeat(64) }), /TARGET_CHANGED/);
  assert.equal(inspectAuxiliaryLock(root, 'control').ownerDigest, status.ownerDigest);
  recovery(root, 'control', status);
});

test('兩個恢復程序競爭同一世代只有一個成功，舊請求不會動到新鎖', async t => {
  const root = fixture(t);
  const status = await deadHolder(t, root);
  const a = worker(root, 'recover', 'control', '', status);
  const b = worker(root, 'recover', 'control', '', status);
  t.after(() => a.kill()); t.after(() => b.kill());
  const results = await Promise.all([a.ended, b.ended]);
  assert.deepEqual(results.map(item => item.code).sort(), [0, 2]);
  const next = acquireAuxiliaryLock(root, 'control');
  assert.throws(() => recovery(root, 'control', status), /TARGET_CHANGED/);
  assert.equal(inspectAuxiliaryLock(root, 'control').operationId, next.identity.operationId);
  next.release();
});

test('恢復者本身遭硬終止，可依新世代身分恢復，不產生第二把死鎖', async t => {
  const root = fixture(t);
  const original = await deadHolder(t, root);
  const w = worker(root, 'recover', 'control', 'claim-published', original);
  t.after(() => w.kill());
  await w.paused(); await w.kill();
  const interrupted = inspectAuxiliaryLock(root, 'control');
  assert.notEqual(interrupted.operationId, original.operationId);
  recovery(root, 'control', interrupted);
  assert.equal(inspectAuxiliaryLock(root, 'control').chainLength, 3);
  assert.equal(inspectAuxiliaryLock(root, 'control').status, 'IDLE');
});

test('舊版不完整鎖或未知紀錄保持阻擋，不猜所有權', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.cr'));
  const target = path.join(root, '.cr/control.lock');
  for (const content of ['', '{', JSON.stringify({ pid: process.pid })]) {
    fs.writeFileSync(target, content);
    assert.throws(() => acquireAuxiliaryLock(root, 'control'), /INVALID_OR_LEGACY/);
    assert.equal(fs.readFileSync(target, 'utf8'), content);
  }
});

test('鎖紀錄被移往不同工作區或被改成他人所有權時拒絕', async t => {
  const root = fixture(t);
  const status = await deadHolder(t, root);
  const owner = path.join(root, `.cr/control.lock.chain/${status.operationId}.owner.json`);
  const changed = JSON.parse(fs.readFileSync(owner, 'utf8')); changed.owner = '不同測試使用者';
  fs.writeFileSync(owner, JSON.stringify(changed));
  assert.throws(() => recovery(root, 'control', status), /IDENTITY|OWNER_CHANGED/);
});

test('寫入前失敗不持有鎖，主要錯誤不被釋放錯誤覆蓋', t => {
  const root = fixture(t);
  const diskError = Object.assign(new Error('中性磁碟滿注入'), { code: 'ENOSPC' });
  assert.throws(() => acquireAuxiliaryLock(root, 'control', { onStep(step) { if (step === 'owner-prepared') throw diskError; } }), /磁碟滿/);
  assert.equal(inspectAuxiliaryLock(root, 'control').status, 'ABSENT');
  assert.throws(() => withAuxiliaryLock(root, 'control', lease => {
    lease.release();
    const other = acquireAuxiliaryLock(root, 'control'); other.release();
    throw diskError;
  }), error => error === diskError && /OWNERSHIP_CHANGED/.test(error.releaseError));
});

for (const [method, code] of [['writeFileSync', 'ENOSPC'], ['fsyncSync', 'EIO'], ['linkSync', 'EXDEV']]) {
  test(`真實檔案操作 ${method} 注入 ${code} 時不發布半份鎖`, t => {
    const root = fixture(t);
    const original = fs[method];
    const injected = Object.assign(new Error(`中性 ${code}`), { code });
    fs[method] = () => { throw injected; };
    try { assert.throws(() => acquireAuxiliaryLock(root, 'control'), error => error === injected); }
    finally { fs[method] = original; }
    assert.equal(inspectAuxiliaryLock(root, 'control').status, 'ABSENT');
    const lease = acquireAuxiliaryLock(root, 'control'); lease.release();
  });
}

test('釋放 fsync 失敗保持持有狀態，修復 I/O 後可重試原持有者釋放', t => {
  const root = fixture(t);
  const lease = acquireAuxiliaryLock(root, 'install');
  const original = fs.fsyncSync;
  fs.fsyncSync = () => { throw Object.assign(new Error('中性 I/O 錯誤'), { code: 'EIO' }); };
  try { assert.throws(() => lease.release(), /I\/O/); } finally { fs.fsyncSync = original; }
  assert.equal(inspectAuxiliaryLock(root, 'install').status, 'HELD_OR_UNKNOWN');
  lease.release();
  assert.equal(inspectAuxiliaryLock(root, 'install').status, 'IDLE');
});

test('不接受非同步臨界區；一般函式回傳 Promise 時也不提早釋放', t => {
  const root = fixture(t);
  assert.throws(() => withAuxiliaryLock(root, 'control', async () => {}), /SYNCHRONOUS/);
  assert.equal(inspectAuxiliaryLock(root, 'control').status, 'ABSENT');
  assert.throws(() => withAuxiliaryLock(root, 'control', () => Promise.resolve()), /ASYNC_RESULT/);
  assert.equal(inspectAuxiliaryLock(root, 'control').status, 'HELD_OR_UNKNOWN');
  assert.throws(() => acquireAuxiliaryLock(root, 'control'), /BUSY/);
});

for (const phase of ['binding-written', 'state-written']) {
  test(`實際計劃遷移於 ${phase} 硬終止後，先恢復 control 再完成同一交易`, async t => {
    const { makeFixture } = require('./test-support');
    const { initializeFallback } = require('./relay-evidence');
    const { resumeMigration } = require('./plan-migration');
    const f = makeFixture(t);
    initializeFallback(f.root, f.planPath);
    const next = { ...f.plan, revision: 2, parentDigest: f.binding.planDigest };
    fs.writeFileSync(path.join(f.root, 'next-plan.json'), JSON.stringify(next));
    fs.writeFileSync(path.join(f.root, 'approval.json'), JSON.stringify({ newPlanPath: 'next-plan.json',
      expectedOldDigest: f.binding.planDigest, expectedNewDigest: digestObject(next),
      reason: '中性故障注入測試升版', approvalRef: 'fixture:auxiliary-lock.test' }));
    const w = worker(f.root, 'migrate', 'control', phase); t.after(() => w.kill());
    await w.paused(); await w.kill();
    const marker = JSON.parse(fs.readFileSync(path.join(f.root, '.cr/migration-pending.json'), 'utf8'));
    const status = inspectAuxiliaryLock(f.root, 'control');
    assert.equal(status.status, 'RECOVERY_REQUIRED');
    const before = fs.readFileSync(path.join(f.root, '.cr/state.json'));
    assert.throws(() => resumeMigration(f.root, { authorized: true, migrationId: marker.migrationId }), /BUSY/);
    recovery(f.root, 'control', status);
    assert.deepEqual(fs.readFileSync(path.join(f.root, '.cr/state.json')), before);
    resumeMigration(f.root, { authorized: true, migrationId: marker.migrationId });
    const state = JSON.parse(fs.readFileSync(path.join(f.root, '.cr/state.json'), 'utf8'));
    assert.equal(state.executionContract.verificationBinding.planDigest, digestObject(next));
    assert.equal(state.executionContract.verification, null);
    assert.equal(state.phase, 'REASSESS');
  });
}
