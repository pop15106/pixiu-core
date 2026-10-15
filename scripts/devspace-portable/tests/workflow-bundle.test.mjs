import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assembleBundle, verifyBundle, probeBundle, installBundle, rollbackBundle, runtimeFiles } from '../workflow-bundle.mjs';

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
  assert.throws(() => installBundle(f.bundle, f.bin), /EEXIST/);
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
