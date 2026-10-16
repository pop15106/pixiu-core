import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import lockTools from '../../critical-relay/auxiliary-lock.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assembleBundle, verifyBundle, probeBundle, installBundle, rollbackBundle, resumeBundleTransition, runtimeFiles } from '../workflow-bundle.mjs';
const { inspectAuxiliaryLock, recoverAuxiliaryLock } = lockTools;

const repo = fileURLToPath(new URL('../../../', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu 套件驗收 '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bundle = path.join(root, 'package');
  const bin = path.join(root, 'bin');
  assembleBundle(repo, bundle);
  fs.mkdirSync(bin);
  return { root, bundle, bin };
}
function importInstalled(bin) {
  const url = pathToFileURL(path.join(bin, 'DevSpace.WorkflowStore.mjs')).href;
  const script = `const m=await import(${JSON.stringify(url)}); console.log(JSON.stringify({loaded:typeof m.createWorkflowController==='function',digest:m.workflowBundleDigest}));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: bin, encoding: 'utf8', windowsHide: true, timeout: 15000 }));
}

test('乾淨套件依賴完整，回讀實際載入位置與 v2 schema', t => {
  const f = fixture(t);
  const manifest = verifyBundle(f.bundle);
  const probe = probeBundle(f.bundle);
  assert.equal(manifest.files.length, runtimeFiles.length);
  assert.equal(probe.executionSchema, 'pixiu.cr-execution.v2');
  assert.ok(probe.loadedModule.startsWith(pathToFileURL(f.bundle).href));
  assert.equal(probe.contentDigest, manifest.contentDigest);
  assert.throws(() => assembleBundle(repo, f.bundle), /DESTINATION_EXISTS/);
});

test('獨立套件驗證器拒絕竄改內容前不會先執行鎖模組', t => {
  const f = fixture(t);
  const prepared = path.join(f.root, 'workflow-runtime');
  fs.renameSync(f.bundle, prepared);
  const tool = path.join(f.root, 'workflow-bundle.mjs');
  fs.copyFileSync(path.join(repo, 'scripts/devspace-portable/workflow-bundle.mjs'), tool);
  const marker = path.join(f.root, 'unexpected-load.txt');
  // 中性副作用只寫入本案例的暫存目錄，用來驗證 hash 檢查的先後順序。
  fs.appendFileSync(path.join(prepared, 'scripts/critical-relay/auxiliary-lock.js'),
    `\nrequire('node:fs').writeFileSync(${JSON.stringify(marker)}, 'neutral verifier fixture');\n`);
  const result = spawnSync(process.execPath, [tool, 'verify', prepared], { cwd: f.root, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /BUNDLE_HASH_MISMATCH/);
  assert.equal(fs.existsSync(marker), false);
});

test('缺少任何 runtime 模組都阻擋套件與安裝', t => {
  const f = fixture(t);
  const name = 'scripts/critical-relay/evidence-verifier.js';
  fs.unlinkSync(path.join(f.bundle, name));
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'export const original=true;\n');
  assert.throws(() => verifyBundle(f.bundle));
  assert.throws(() => installBundle(f.bundle, f.bin));
  assert.equal(fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'utf8'), 'export const original=true;\n');
});

test('篡改或多出檔案時不能靠檔名齊全通過', t => {
  const f = fixture(t);
  const target = path.join(f.bundle, runtimeFiles[0]);
  const original = fs.readFileSync(target);
  fs.appendFileSync(target, '\n// 中性篡改\n');
  assert.throws(() => verifyBundle(f.bundle), /HASH_MISMATCH/);
  fs.writeFileSync(target, original);
  fs.writeFileSync(path.join(f.bundle, 'secret.txt'), '中性非預期資料');
  assert.throws(() => verifyBundle(f.bundle), /FILE_SET/);
});

test('升級與回復保留原模組、ledger 及設定，重裝同版不重複切換', t => {
  const f = fixture(t);
  const previous = 'export const original=true;\n';
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), previous);
  const sentinels = ['workflow-state.json', 'config.json', 'auth.json'];
  for (const name of sentinels) fs.writeFileSync(path.join(f.bin, name), '中性設定，不是實際憑證');
  const installed = installBundle(f.bundle, f.bin);
  assert.equal(installed.Changed, true);
  const probe = importInstalled(f.bin);
  assert.equal(probe.loaded, true);
  assert.equal(probe.digest, installed.contentDigest);
  assert.equal(installBundle(f.bundle, f.bin).Changed, false);
  const restored = rollbackBundle(f.bin, installed.receiptId);
  assert.equal(restored.restarted, false);
  assert.equal(fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'utf8'), previous);
  for (const name of sentinels) assert.equal(fs.readFileSync(path.join(f.bin, name), 'utf8'), '中性設定，不是實際憑證');
});

test('回復時目標被另一操作修改則拒絕覆蓋', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'export const old=true;');
  const installed = installBundle(f.bundle, f.bin);
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'export const another=true;');
  assert.throws(() => rollbackBundle(f.bin, installed.receiptId), /TARGET_CHANGED/);
  assert.equal(fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'utf8'), 'export const another=true;');
});

test('原備份被修改則拒絕回復，保留現行新版本', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'export const old=true;');
  const installed = installBundle(f.bundle, f.bin);
  fs.writeFileSync(path.join(f.bin, 'workflow-receipts', installed.receiptId, 'previous.mjs'), '篡改');
  assert.throws(() => rollbackBundle(f.bin, installed.receiptId), /BACKUP_CHANGED/);
  assert.equal(importInstalled(f.bin).loaded, true);
});

test('既有安裝鎖與 junction 都不能被覆蓋或跟隨', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.bin, 'workflow-install.lock'), '其他操作');
  assert.throws(() => installBundle(f.bundle, f.bin), /INVALID_OR_LEGACY/);
  assert.equal(fs.readFileSync(path.join(f.bin, 'workflow-install.lock'), 'utf8'), '其他操作');
  fs.unlinkSync(path.join(f.bin, 'workflow-install.lock'));
  const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(f.bin, 'workflow-releases'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => installBundle(f.bundle, f.bin), /LINK_BLOCKED/);
});

test('從安裝後完整依賴包可執行中性 Node 驗證，不借用開發 checkout', async t => {
  const f = fixture(t);
  const installed = installBundle(f.bundle, f.bin);
  const modulePath = path.join(f.bin, 'workflow-releases', installed.contentDigest, 'scripts/critical-relay/test-runner.js');
  const { default: runner } = await import(pathToFileURL(modulePath).href);
  const project = path.join(f.root, '測試專案'); fs.mkdirSync(project);
  const git = args => execFileSync('git', args, { cwd: project, windowsHide: true, stdio: 'pipe' });
  git(['init', '--quiet']);
  fs.writeFileSync(path.join(project, '.gitignore'), '/.cr/\n');
  fs.writeFileSync(path.join(project, 'sample.test.js'), "require('node:test')('中性案例', () => require('node:assert/strict').equal(1,1));");
  const plan = { schemaVersion: 'pixiu.test-plan.v1', id: 'bundle-test', revision: 1, profile: 'local-only',
    criteria: [{ id: 'criterion-one', requiredEvidenceKinds: ['test'] }],
    commands: [{ id: 'test-one', adapter: 'node-test', file: 'sample.test.js', evidenceKind: 'test', required: true, timeoutMs: 15000, criterionRefs: ['criterion-one'] }] };
  fs.writeFileSync(path.join(project, 'plan.json'), JSON.stringify(plan));
  git(['add', '.']);
  git(['-c', 'user.name=CR Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=NUL', 'commit', '--quiet', '-m', '中性驗收']);
  const result = await runner.runPlan({ workspaceRoot: project, planPath: 'plan.json' });
  assert.equal(result.outcome, 'PASS');
  const { default: verifier } = await import(pathToFileURL(path.join(path.dirname(modulePath), 'evidence-verifier.js')).href);
  const { default: planner } = await import(pathToFileURL(path.join(path.dirname(modulePath), 'test-plan.js')).href);
  assert.equal(verifier.verifyRun(project, planner.bindPlan(project, 'plan.json'), result).canComplete, true);
});

async function killAtTransition(f, mode, phase, receiptId = '') {
  const holder = fileURLToPath(new URL('./workflow-transition-holder.mjs', import.meta.url));
  const child = spawn(process.execPath, [holder, mode, f.bundle, f.bin, phase, receiptId],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', error = '';
  child.stdout.on('data', value => { output += value; });
  child.stderr.on('data', value => { error += value; });
  const ended = once(child, 'exit');
  try {
    const deadline = Date.now() + 20000;
    while (!output.includes('\n')) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(error || '套件測試程序提早結束');
      if (Date.now() > deadline) throw new Error('等待套件中斷點逾時');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const status = inspectAuxiliaryLock(f.bin, 'install');
    assert.throws(() => recoverAuxiliaryLock(f.bin, 'install', { ...status, authorized: true }), /OWNER_ALIVE_OR_UNKNOWN/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await ended;
  }
  const status = inspectAuxiliaryLock(f.bin, 'install');
  assert.equal(status.status, 'RECOVERY_REQUIRED');
  return { status, notice: JSON.parse(output.trim().split('\n')[0]) };
}

for (const phase of ['receipt-written', 'pending-written', 'pointer-switched', 'committed']) {
  test(`安裝在 ${phase} 真正硬終止後先恢復鎖，再按原交易處理入口`, async t => {
    const f = fixture(t);
    const previous = 'export const previous=true;\n';
    fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), previous);
    fs.writeFileSync(path.join(f.bin, 'workflow-state.json'), '中性 ledger 保留資料');
    const { status, notice } = await killAtTransition(f, 'install', phase);
    const beforeRecovery = fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'));
    recoverAuxiliaryLock(f.bin, 'install', { ...status, authorized: true });
    assert.deepEqual(fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs')), beforeRecovery);
    if (phase === 'receipt-written') {
      assert.equal(beforeRecovery.toString(), previous);
      assert.equal(fs.existsSync(path.join(f.bin, 'workflow-transition.pending.json')), false);
      assert.equal(installBundle(f.bundle, f.bin).Changed, true);
    } else {
      assert.throws(() => installBundle(f.bundle, f.bin), /TRANSITION_PENDING/);
      assert.throws(() => resumeBundleTransition(f.bin, { transactionId: notice.transactionId }), /AUTHORIZATION/);
      const resumed = resumeBundleTransition(f.bin, { authorized: true, transactionId: notice.transactionId });
      assert.equal(resumed.transactionId, notice.transactionId);
      assert.equal(fs.existsSync(path.join(f.bin, 'workflow-transition.pending.json')), false);
    }
    assert.equal(importInstalled(f.bin).loaded, true);
    assert.equal(fs.readFileSync(path.join(f.bin, 'workflow-state.json'), 'utf8'), '中性 ledger 保留資料');
  });
}

for (const phase of ['pending-written', 'pointer-switched']) {
  test(`回復在 ${phase} 真正硬終止後只恢復同一份原入口`, async t => {
    const f = fixture(t);
    const previous = 'export const previous=true;\n';
    fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), previous);
    const installed = installBundle(f.bundle, f.bin);
    const { status, notice } = await killAtTransition(f, 'rollback', phase, installed.receiptId);
    recoverAuxiliaryLock(f.bin, 'install', { ...status, authorized: true });
    const resumed = resumeBundleTransition(f.bin, { authorized: true, transactionId: notice.transactionId });
    assert.equal(resumed.action, 'rollback');
    assert.equal(fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'utf8'), previous);
  });
}

test('切換中斷後有其他人改入口，恢復拒絕覆蓋並保留 pending', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'export const old=true;');
  assert.throws(() => installBundle(f.bundle, f.bin, step => { if (step === 'pending-written') throw new Error('中性中斷'); }), /中斷/);
  const marker = JSON.parse(fs.readFileSync(path.join(f.bin, 'workflow-transition.pending.json'), 'utf8'));
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'export const someoneElse=true;');
  assert.throws(() => resumeBundleTransition(f.bin, { authorized: true, transactionId: marker.transactionId }), /TARGET_CHANGED/);
  assert.equal(fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'utf8'), 'export const someoneElse=true;');
  assert.equal(fs.existsSync(path.join(f.bin, 'workflow-transition.pending.json')), true);
});

test('入口 rename 注入磁碟錯誤後保留原入口，可恢復同一交易', t => {
  const f = fixture(t);
  const previous = 'export const previous=true;\n';
  const target = path.join(f.bin, 'DevSpace.WorkflowStore.mjs');
  fs.writeFileSync(target, previous);
  const original = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (to === target) throw Object.assign(new Error('中性磁碟滿'), { code: 'ENOSPC' });
    return original(from, to);
  };
  try { assert.throws(() => installBundle(f.bundle, f.bin), /磁碟滿/); } finally { fs.renameSync = original; }
  assert.equal(fs.readFileSync(target, 'utf8'), previous);
  const marker = JSON.parse(fs.readFileSync(path.join(f.bin, 'workflow-transition.pending.json'), 'utf8'));
  resumeBundleTransition(f.bin, { authorized: true, transactionId: marker.transactionId });
  assert.equal(importInstalled(f.bin).loaded, true);
});

test('切換後寫入終態失敗，恢復不再切換入口且舊備份保持不變', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'), 'export const previous=true;');
  assert.throws(() => installBundle(f.bundle, f.bin, step => { if (step === 'pointer-switched') throw new Error('中性 EIO'); }), /EIO/);
  const before = fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs'));
  const marker = JSON.parse(fs.readFileSync(path.join(f.bin, 'workflow-transition.pending.json'), 'utf8'));
  const result = resumeBundleTransition(f.bin, { authorized: true, transactionId: marker.transactionId });
  assert.equal(result.Changed, false);
  assert.deepEqual(fs.readFileSync(path.join(f.bin, 'DevSpace.WorkflowStore.mjs')), before);
});

test('套件模組在真實載入 PID 留下可對應 digest 的紀錄',t=>{
  const f=fixture(t);
  const entry=path.join(f.bundle,'scripts/devspace-portable/DevSpace.WorkflowStore.mjs');
  const child=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(pathToFileURL(entry).href)});console.log(process.pid);`],{encoding:'utf8',windowsHide:true});
  assert.equal(child.status,0,child.stderr);
  const receipt=child.stderr.trim().split('\n').map(line=>JSON.parse(line)).find(x=>x.event==='pixiu.cr.runtime.loaded');
  assert.equal(receipt.pid,Number(child.stdout.trim()));assert.equal(receipt.bundleDigest,verifyBundle(f.bundle).contentDigest);
  assert.equal(receipt.loadedModule,pathToFileURL(entry).href);
});

test('schema3 已安裝套件升級保留 adapter/core 並拒絕原檔損毀',async t=>{
  const {upgradeSessionBundle,baselineDigests}=await import('../prepare-session-workflow-cr.mjs');
  const {sessionWorkflowFiles}=await import('../workflow-bundle.mjs');
  const {createHash}=await import('node:crypto');const hash=value=>createHash('sha256').update(value).digest('hex');
  const f=fixture(t),entry=path.join(f.bundle,'scripts/devspace-portable/DevSpace.WorkflowStore.mjs');
  // 中性封裝 fixture 僅測套件升級完整性；實際 schema3 ledger 另以該機 runtime 驗證。
  fs.writeFileSync(entry,fs.readFileSync(entry,'utf8').replace("'workflow-store-v1-cr-v2',[1]","'session-workflow-v3-cr-v1',[1,2,3]"));
  for(const name of ['SessionWorkflow.Core.mjs','SessionWorkflow.DevSpaceProjectResolver.mjs'])fs.writeFileSync(path.join(f.bundle,'scripts/devspace-portable',name),'export const fixture = true;\n');
  fs.copyFileSync(path.join(repo,'scripts/devspace-portable/SessionWorkflow.CrBridge.mjs'),path.join(f.bundle,'scripts/devspace-portable/SessionWorkflow.CrBridge.mjs'));
  const manifest=JSON.parse(fs.readFileSync(path.join(f.bundle,'WORKFLOW-BUNDLE.json')));
  manifest.compatibilityProfile='session-workflow-v3-cr-v1';manifest.baselineDigests=baselineDigests;
  manifest.files=sessionWorkflowFiles.map(file=>{const bytes=fs.readFileSync(path.join(f.bundle,file));return {path:file,sha256:hash(bytes),length:bytes.length};});
  manifest.contentDigest=hash(JSON.stringify(manifest.files.map(x=>[x.path,x.sha256])));fs.writeFileSync(path.join(f.bundle,'WORKFLOW-BUNDLE.json'),JSON.stringify(manifest));
  const before=hash(fs.readFileSync(entry)),upgraded=path.join(f.root,'upgraded');upgradeSessionBundle(repo,f.bundle,upgraded);
  assert.equal(hash(fs.readFileSync(path.join(upgraded,'scripts/devspace-portable/DevSpace.WorkflowStore.mjs'))),before);
  assert.equal(verifyBundle(upgraded).previousBundleDigest,manifest.contentDigest);
  fs.appendFileSync(entry,'// tampered');assert.throws(()=>upgradeSessionBundle(repo,f.bundle,path.join(f.root,'rejected')),/HASH_MISMATCH/);
});
