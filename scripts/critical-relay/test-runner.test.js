'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runPlan, recoveryFor } = require('./test-runner');
const { verifyRun, latchBinding } = require('./evidence-verifier');
const { sourceSnapshot, readJson, atomicJson, hash, digestObject, validatePlan, boundedPath, redact } = require('./test-plan');
const { parseTestOutput } = require('./evidence-parser');
const { makeFixture, passing } = require('./test-support');

const run = fixture => runPlan({ workspaceRoot: fixture.root, planPath: fixture.planPath, expectedPlanDigest: fixture.binding.planDigest });
const check = (fixture, result) => verifyRun(fixture.root, fixture.binding, { runId: result.runId, resultPath: result.resultPath });

test('正式 runner 的心跳與終態可以回讀，且不冒充 CR completion gate', async t => {
  const fixture = makeFixture(t);
  const result = await run(fixture);
  assert.equal(result.outcome, 'PASS');
  const { readRunStatus, latestRunId } = require('./status-heartbeat');
  const status = readRunStatus(fixture.root, result.runId);
  assert.equal(latestRunId(fixture.root), result.runId);
  assert.equal(status.observed, 'TESTS_PASS_GATE_NOT_CONFIRMED');
  assert.equal(status.completedCommands, 1);
  assert.equal(status.totalCommands, 1);
  assert.ok(status.heartbeatSeq >= 3);
  assert.equal(check(fixture, result).canComplete, true);
});

test('正式 runner 遇到失敗，心跳的終態也不能變成 PASS', async t => {
  const fixture = makeFixture(t, ["require('node:test')('中性失敗', () => { throw new Error('expected'); });"]);
  const result = await run(fixture);
  assert.equal(result.outcome, 'FAIL');
  const status = require('./status-heartbeat').readRunStatus(fixture.root, result.runId);
  assert.equal(status.observed, 'RUN_TERMINATED_UNSUCCESSFULLY');
  assert.equal(status.outcome, 'FAIL');
});

test('真實執行、計劃快照、原始事件及回讀全部成功', async t => {
  const fixture = makeFixture(t);
  const result = await run(fixture);
  assert.equal(result.outcome, 'PASS', JSON.stringify(result.commands) + '\n' + fs.readFileSync(path.join(fixture.root, result.commands[0].stderrPath), 'utf8'));
  assert.equal(result.commands[0].counts.total, 1);
  assert.equal(result.recovery.nextAction, 'VERIFY');
  assert.equal(check(fixture, result).canComplete, true);
  assert.equal(fs.existsSync(path.join(fixture.root, '.cr/runner.lock')), false);
});

for (const [name, source, expected] of [
  ['零筆測試', "console.log('沒有註冊測試');", 'ZERO_TESTS'],
  ['全部略過', "require('node:test')('略過', { skip: true }, () => {});", 'FAIL'],
  ['只有空 suite', "require('node:test').describe('空容器', () => {});", 'ZERO_TESTS'],
  ['待完成案例', "require('node:test')('待完成', { todo: true }, () => {});", 'FAIL'],
  ['實際失敗', "require('node:test')('故意失敗', () => { throw new Error('中性反例'); });", 'FAIL'],
  ['程式無法解析', 'invalid syntax !', 'FAIL'],
  ['直接假印成功', "console.log('{\"record\":\"case\",\"status\":\"passed\"}');", 'ZERO_TESTS'],
  ['測試入口不存在', null, 'ENV_BLOCKED']
]) {
  test(`${name}不能成為必要驗證成功`, async t => {
    const fixture = makeFixture(t, [source]);
    const result = await run(fixture);
    assert.equal(result.commands[0].outcome, expected);
    assert.equal(result.outcome, 'FAIL');
    assert.equal(check(fixture, result).canComplete, false);
  });
}

test('前一套失敗仍執行後面獨立測試；依賴項保持未執行', async t => {
  const fixture = makeFixture(t, ["require('node:test')('失敗', () => { throw new Error('失敗'); });", passing, passing], plan => {
    plan.commands[2].dependsOn = ['command-0'];
  });
  const result = await run(fixture);
  assert.deepEqual(result.commands.map(item => item.outcome), ['FAIL', 'PASS', 'NOT_RUN']);
  assert.equal(result.outcome, 'FAIL');
});

test('巢狀案例只計算葉節點，空 suite 不充當測試', async t => {
  const fixture = makeFixture(t, ["const { test, describe } = require('node:test'); describe('外層', () => { test('子一', () => {}); test('子二', () => {}); });"]);
  const result = await run(fixture);
  assert.equal(result.outcome, 'PASS');
  assert.equal(result.commands[0].counts.total, 2);
  assert.equal(check(fixture, result).canComplete, true);
});

test('逾時程序留下 TIMEOUT 並釋放執行鎖', async t => {
  const fixture = makeFixture(t, ["require('node:test')('永遠等待', async () => { await new Promise(resolve => setTimeout(resolve, 60000)); });"], plan => {
    plan.commands[0].timeoutMs = 700;
  });
  const result = await run(fixture);
  assert.equal(result.commands[0].outcome, 'TIMEOUT');
  assert.equal(result.outcome, 'FAIL');
  assert.equal(fs.existsSync(path.join(fixture.root, '.cr/runner.lock')), false);
});

test('執行中取消不產生假成功', async t => {
  const fixture = makeFixture(t, ["require('node:test')('等待取消', async () => { await new Promise(resolve => setTimeout(resolve, 60000)); });"]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 700);
  try {
    const result = await runPlan({ workspaceRoot: fixture.root, planPath: fixture.planPath, signal: controller.signal });
    assert.equal(result.commands[0].outcome, 'CANCELLED');
    assert.equal(result.outcome, 'FAIL');
  } finally { clearTimeout(timer); }
});

test('執行前取消也會有每項明確結果', async t => {
  const fixture = makeFixture(t, [passing, passing]);
  const controller = new AbortController(); controller.abort();
  const result = await runPlan({ workspaceRoot: fixture.root, planPath: fixture.planPath, signal: controller.signal });
  assert.deepEqual(result.commands.map(item => item.outcome), ['CANCELLED', 'CANCELLED']);
});

test('測試自己修改來源會使該輪證據失效', async t => {
  const fixture = makeFixture(t, ["require('node:test')('來源改變', () => require('node:fs').writeFileSync('new-source.txt', '只寫入中性暫存 fixture')); "]);
  const result = await run(fixture);
  assert.equal(result.commands[0].outcome, 'PASS');
  assert.equal(result.outcome, 'SOURCE_CHANGED');
  assert.equal(check(fixture, result).canComplete, false);
});

test('執行後新增未追蹤檔案也會使來源核對失敗', async t => {
  const fixture = makeFixture(t);
  const result = await run(fixture);
  fs.writeFileSync(path.join(fixture.root, 'untracked.txt'), '中性新增');
  assert.match(check(fixture, result).blockingReasons.join(' '), /受測來源/);
});

for (const [name, mutate] of [
  ['刪除輸出檔', (root, record) => fs.unlinkSync(path.join(root, record.commands[0].stdoutPath))],
  ['竄改原始輸出', (root, record) => fs.appendFileSync(path.join(root, record.commands[0].stdoutPath), '假內容')],
  ['零筆統計宣告', (root, record) => { record.commands[0].counts = { total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0 }; }],
  ['失敗統計卻宣告成功', (root, record) => { record.commands[0].counts.failed = 1; }],
  ['刪除必要結果', (root, record) => { record.commands = []; }],
  ['重複結果', (root, record) => { record.commands.push(record.commands[0]); }],
  ['錯誤 runId', (root, record) => { record.commands[0].runId = '錯誤'; }],
  ['非零結束碼', (root, record) => { record.commands[0].exitCode = 1; }],
  ['實際參數遭改寫', (root, record) => { record.commands[0].argv[0] = '--no-warnings'; }],
  ['實際執行檔遭替換', (root, record) => { record.commands[0].executable = 'another-node'; }],
  ['工作目錄遭替換', (root, record) => { record.commands[0].cwd = 'other-root'; }],
  ['事件 checkpoint 遺失', (root, record) => { fs.unlinkSync(path.join(root, record.commands[0].stdoutPath.replace('.stdout.jsonl', '.progress.json'))); }],
  ['事件 checkpoint 未完成', (root, record) => {
    const progressPath = record.commands[0].stdoutPath.replace('.stdout.jsonl', '.progress.json');
    const progress = readJson(root, progressPath); progress.complete = false; atomicJson(root, progressPath, progress);
  }],
  ['未完成結果', (root, record) => { record.outcome = 'RUNNING'; record.endedAt = null; }],
  ['證據越界', (root, record) => { record.commands[0].stdoutPath = '../outside'; }],
  ['證據種類替換', (root, record) => { record.commands[0].evidenceKind = 'build'; }],
  ['工具版本不符', (root, record) => { record.commands[0].tool.version = 'v0.0.0'; }]
]) {
  test(`${name}會在回讀閘門被拒絕`, async t => {
    const fixture = makeFixture(t);
    const result = await run(fixture);
    assert.equal(result.outcome, 'PASS', '反例注入前必須先有有效成功基準');
    assert.equal(check(fixture, result).canComplete, true);
    const record = readJson(fixture.root, result.resultPath);
    mutate(fixture.root, record);
    atomicJson(fixture.root, result.resultPath, record);
    assert.equal(check(fixture, result).canComplete, false);
  });
}

test('即使重算輸出雜湊，內部案例與 summary 矛盾仍被拒絕', async t => {
  const fixture = makeFixture(t);
  const result = await run(fixture);
  const record = readJson(fixture.root, result.resultPath);
  const command = record.commands[0];
  const target = path.join(fixture.root, command.stdoutPath);
  const records = fs.readFileSync(target, 'utf8').trim().split('\n').map(JSON.parse);
  records.find(item => item.record === 'case').status = 'failed';
  const content = records.map(item => JSON.stringify(item)).join('\n') + '\n';
  fs.writeFileSync(target, content);
  command.stdoutDigest = hash(content);
  atomicJson(fixture.root, result.resultPath, record);
  assert.equal(check(fixture, result).canComplete, false);
});

test('事前計劃指紋不符時不啟動測試', async t => {
  const fixture = makeFixture(t);
  await assert.rejects(runPlan({ workspaceRoot: fixture.root, planPath: fixture.planPath, expectedPlanDigest: 'a'.repeat(64) }), /計劃指紋/);
  assert.equal(fs.existsSync(path.join(fixture.root, '.cr')), false);
});

test('改動必要清單或降級模式無法沿用既有 binding', t => {
  const fixture = makeFixture(t);
  const state = { mode: 'FULL_AUTOMATIC_RELAY', executionContractRequired: true,
    executionContract: { schemaVersion: 'pixiu.cr-execution.v2', verificationBinding: fixture.binding } };
  assert.deepEqual(latchBinding(fixture.root, state), fixture.binding);
  const legacy = structuredClone(state); legacy.executionContract.schemaVersion = 'pixiu.cr-execution.v1';
  assert.throws(() => latchBinding(fixture.root, legacy), /遷移/);
  assert.throws(() => latchBinding(fixture.root, { mode: 'general' }, fixture.binding), /不可降級/);
  fixture.plan.commands[0].required = false;
  fixture.plan.commands[0].optionalReason = '反例';
  fs.writeFileSync(path.join(fixture.root, fixture.planPath), JSON.stringify(fixture.plan));
  assert.throws(() => latchBinding(fixture.root, state, fixture.binding));
});

test('有 test 證據也不能滿足 UI 驗收種類', async t => {
  const fixture = makeFixture(t, [passing], plan => { plan.criteria[0].requiredEvidenceKinds = ['ui']; });
  const result = await run(fixture);
  assert.equal(result.outcome, 'PASS');
  assert.match(check(fixture, result).blockingReasons.join(' '), /證據種類/);
});

test('既有鎖拒絕重複啟動且不刪除他人的鎖', async t => {
  const fixture = makeFixture(t);
  fs.mkdirSync(path.join(fixture.root, '.cr'));
  fs.writeFileSync(path.join(fixture.root, '.cr/runner.lock'), '中性鎖');
  await assert.rejects(run(fixture), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(fixture.root, '.cr/runner.lock'), 'utf8'), '中性鎖');
});

test('Windows junction 或符號連結不可越出證據根目錄', t => {
  const fixture = makeFixture(t);
  const other = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'pixiu-outside-'));
  t.after(() => fs.rmSync(other, { recursive: true, force: true }));
  fs.writeFileSync(path.join(other, 'sample.txt'), '中性外部資料');
  fs.symlinkSync(other, path.join(fixture.root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => boundedPath(fixture.root, 'linked/sample.txt'), /連結/);
});

test('敏感環境不傳入子程序，已知 token 日誌在保存前去敏', async t => {
  const fixture = makeFixture(t, ["const test = require('node:test'); const assert = require('node:assert/strict'); test('去敏', () => { assert.equal(process.env.CR_FAKE_SECRET, undefined); console.log('password=fixture-password-1234'); console.log('ghp_fixtureToken1234567890'); });"]);
  process.env.CR_FAKE_SECRET = '僅測試程序的中性假值';
  t.after(() => { delete process.env.CR_FAKE_SECRET; });
  const result = await run(fixture);
  const output = fs.readFileSync(path.join(fixture.root, result.commands[0].stdoutPath), 'utf8');
  assert.equal(result.outcome, 'PASS');
  assert.doesNotMatch(output, /fixture-password-1234|ghp_fixtureToken1234567890/);
  assert.match(output, /REDACTED/);
});

test('相同失敗兩次改為 REASSESS，重放同一 run 不增加次數', () => {
  const first = { runId: 'one', outcome: 'FAIL', commands: [{ commandId: 'command-0', outcome: 'FAIL', failures: [{ name: '案例', status: 'failed' }] }] };
  const a = recoveryFor(first, [], { authorizedRepair: true });
  assert.equal(a.nextAction, 'REPAIR');
  const b = recoveryFor({ ...first, runId: 'two' }, [a, a], { authorizedRepair: true });
  assert.equal(b.nextAction, 'REASSESS');
  assert.equal(b.consecutiveFailures, 2);
  const c = recoveryFor({ ...first, runId: 'two' }, [a, b], { authorizedRepair: true });
  assert.equal(c.consecutiveFailures, 2);
});

test('無效計劃、命令注入與循環依賴被拒絕', t => {
  const { plan } = makeFixture(t);
  for (const mutate of [p => { p.commands[0].adapter = 'shell'; }, p => { p.commands[0].file = '../bad.js'; },
    p => { p.commands[0].dependsOn = ['command-0']; }, p => { p.commands.push(p.commands[0]); },
    p => { p.commands[0].required = false; }, p => { p.criteria = []; }]) {
    const changed = structuredClone(plan); mutate(changed);
    assert.throws(() => validatePlan(changed));
  }
});

test('截斷或無效事件不能通過解析', () => {
  for (const raw of ['', 'not json', '{}', '{"schemaVersion":"pixiu.node-events.v1","record":"log"}\n']) {
    assert.throws(() => parseTestOutput(raw));
  }
});

test('超量輸出受控停止，不產生假成功', async t => {
  const fixture = makeFixture(t, ["require('node:test')('大量中性輸出', () => { process.stdout.write('x'.repeat(5 * 1024 * 1024)); });"]);
  const result = await run(fixture);
  assert.equal(result.commands[0].outcome, 'OUTPUT_LIMIT');
  assert.equal(result.outcome, 'FAIL');
});

test('預設必要計劃與 CI 共用入口保持接線一致', () => {
  const root = path.resolve(__dirname, '../..');
  const plan = validatePlan(readJson(root, 'scripts/critical-relay/public-core.plan.json'));
  assert.equal(plan.commands.length, 14);
  for (const command of plan.commands) {
    assert.equal(command.required, true);
    assert.equal(fs.statSync(boundedPath(root, command.file)).isFile(), true);
  }
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/critical-relay.yml'), 'utf8');
  assert.match(workflow, /run: node scripts\/critical-relay\/test-runner\.js/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /path: \.cr\/runs\//);
});

test('控制鎖仍在使用時證據閘門阻擋，正常釋放後可回讀同一輪', async t => {
  const fixture = makeFixture(t);
  const result = await run(fixture);
  assert.equal(check(fixture, result).canComplete, true);
  const { acquireAuxiliaryLock } = require('./auxiliary-lock');
  const lease = acquireAuxiliaryLock(fixture.root, 'control');
  try {
    const checked = check(fixture, result);
    assert.equal(checked.canComplete, false);
    assert.match(checked.blockingReasons.join(' '), /控制鎖/);
  } finally { lease.release(); }
  assert.equal(check(fixture, result).canComplete, true);
});

test('未初始化子模組只記錄固定 commit，指標改變會影響來源指紋', t => {
  const fixture = makeFixture(t);
  fs.mkdirSync(path.join(fixture.root, 'optional-module'));
  const firstSha = fixture.git(['rev-parse', 'HEAD']).toString().trim();
  fixture.git(['update-index', '--add', '--cacheinfo', `160000,${firstSha},optional-module`]);
  const first = sourceSnapshot(fixture.root);
  assert.deepEqual(first.submodules, [{ path: 'optional-module', commit: firstSha, initialized: false }]);
  fixture.git(['update-index', '--cacheinfo', `160000,${'a'.repeat(40)},optional-module`]);
  assert.notEqual(sourceSnapshot(fixture.root).changeDigest, first.changeDigest);
  fs.writeFileSync(path.join(fixture.root, 'optional-module/unverified.txt'), '中性未確認內容');
  assert.throws(() => sourceSnapshot(fixture.root), /未初始化子模組/);
});

test('已初始化子模組的未提交修改會阻擋來源驗證', t => {
  const fixture = makeFixture(t);
  const modulePath = path.join(fixture.root, 'local-module');
  fs.mkdirSync(modulePath);
  const subGit = args => fixture.git(['-C', modulePath, ...args]);
  subGit(['init', '--quiet']);
  fs.writeFileSync(path.join(modulePath, 'sample.txt'), '中性子模組');
  subGit(['add', '.']);
  subGit(['-c', 'user.name=CR Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=NUL',
    'commit', '--quiet', '-m', '子模組測試基準']);
  const sha = subGit(['rev-parse', 'HEAD']).toString().trim();
  fixture.git(['update-index', '--add', '--cacheinfo', `160000,${sha},local-module`]);
  assert.equal(sourceSnapshot(fixture.root).submodules[0].initialized, true);
  fs.writeFileSync(path.join(modulePath, 'sample.txt'), '已變更');
  assert.throws(() => sourceSnapshot(fixture.root), /未提交內容/);
});

test('必要命令依賴未初始化子模組時仍保持 ENV_BLOCKED', async t => {
  const fixture = makeFixture(t, [null], plan => { plan.commands[0].file = 'optional-module/required.test.js'; });
  fs.mkdirSync(path.join(fixture.root, 'optional-module'));
  const sha = fixture.git(['rev-parse', 'HEAD']).toString().trim();
  fixture.git(['update-index', '--add', '--cacheinfo', `160000,${sha},optional-module`]);
  const result = await run(fixture);
  assert.equal(result.commands[0].outcome, 'ENV_BLOCKED');
  assert.equal(result.outcome, 'FAIL');
});
