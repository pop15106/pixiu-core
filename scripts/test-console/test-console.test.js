#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createTestRegistry } = require('./test-registry');
const {
  ActiveRunError,
  UnknownModuleError,
  createRunManager
} = require('./run-manager');
const { createTestConsoleServer } = require('./server');
const {
  findConflictMarkers,
  findCredentialLikeValues
} = require('./repository-safety');

function createFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-test-console-'));
  const files = [
    'scripts/core-evolution/test/alpha.test.js',
    'scripts/core-evolution/test/beta.test.js',
    'scripts/hooks/pixiu-deterministic-capture.test.js',
    'scripts/hooks/pixiu-auto-recap.test.js',
    'scripts/performance/run-lazy-loading-tests.ps1',
    'scripts/devspace-portable/tests/run-tests.ps1',
    'scripts/test-console/repository-safety.js'
  ];
  for (const relativePath of files) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, '// fixture\n', 'utf8');
  }
  return root;
}

function createDeferredExecutor() {
  const pending = [];
  const executor = (step, { onOutput }) => {
    let resolvePromise;
    let cancelled = false;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    const record = {
      step,
      finish(exitCode = 0) {
        if (cancelled) {
          resolvePromise({ exitCode: null, signal: 'SIGTERM', cancelled: true });
          return;
        }
        onOutput(`完成 ${step.id}\n`);
        resolvePromise({ exitCode, signal: null, cancelled: false });
      }
    };
    pending.push(record);
    return {
      promise,
      cancel() {
        cancelled = true;
        record.finish();
      }
    };
  };
  return { executor, pending };
}

async function waitFor(predicate, timeoutMs = 2000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('等待條件逾時');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('Registry 只公開固定模組並正確展開整合順序', () => {
  const root = createFixtureRoot();
  const registry = createTestRegistry(root);
  const modules = registry.list();

  assert.deepEqual(
    modules.map((module) => module.id),
    [
      'core-evolution',
      'manual-recap',
      'auto-recap',
      'lazy-loading',
      'devspace-oneclick',
      'repository-safety',
      'integration-all'
    ]
  );
  assert.equal(modules.some((module) => 'steps' in module), false);

  const steps = registry.resolveSteps('integration-all');
  assert.deepEqual(
    steps.map((step) => step.moduleId),
    [
      'core-evolution',
      'manual-recap',
      'auto-recap',
      'lazy-loading',
      'devspace-oneclick',
      'repository-safety'
    ]
  );
  assert.equal(steps.every((step) => step.cwd === root), true);
  assert.equal(steps.every((step) => !step.shell), true);
});

test('Registry 在必要測試入口缺失時 fail closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-test-console-missing-'));
  assert.throws(() => createTestRegistry(root), /缺少必要測試入口/);
});

test('Registry 以明確檔案清單執行 Core Evolution，不依賴 shell glob', () => {
  const root = createFixtureRoot();
  const registry = createTestRegistry(root);
  const [step] = registry.resolveSteps('core-evolution');

  assert.equal(step.executable, process.execPath);
  assert.deepEqual(step.args.slice(0, 2), ['--test', path.join(root, 'scripts/core-evolution/test/alpha.test.js')]);
  assert.equal(step.args.at(-1), path.join(root, 'scripts/core-evolution/test/beta.test.js'));
});

test('Run Manager 拒絕未知模組與同時執行第二個工作', async () => {
  const root = createFixtureRoot();
  const registry = createTestRegistry(root);
  const deferred = createDeferredExecutor();
  const manager = createRunManager({ registry, executeStep: deferred.executor });

  assert.throws(() => manager.start('missing'), UnknownModuleError);
  const first = manager.start('manual-recap');
  assert.throws(() => manager.start('auto-recap'), ActiveRunError);

  await waitFor(() => deferred.pending.length === 1);
  deferred.pending[0].finish(0);
  const completed = await manager.waitForCompletion(first.id);
  assert.equal(completed.status, 'passed');
  assert.match(completed.log, /完成 manual-recap/);
  assert.equal('definition' in completed.steps[0], false);
  assert.equal('executable' in completed.steps[0], false);
  assert.equal('args' in completed.steps[0], false);
});

test('整合測試依序執行並在第一個失敗步驟停止', async () => {
  const root = createFixtureRoot();
  const registry = createTestRegistry(root);
  const seen = [];
  const manager = createRunManager({
    registry,
    executeStep(step, { onOutput }) {
      seen.push(step.moduleId);
      onOutput(`${step.moduleId}\n`);
      return {
        promise: Promise.resolve({
          exitCode: step.moduleId === 'auto-recap' ? 9 : 0,
          signal: null,
          cancelled: false
        }),
        cancel() {}
      };
    }
  });

  const run = manager.start('integration-all');
  const completed = await manager.waitForCompletion(run.id);
  assert.equal(completed.status, 'failed');
  assert.equal(completed.exitCode, 9);
  assert.deepEqual(seen, ['core-evolution', 'manual-recap', 'auto-recap']);
  assert.equal(completed.steps[3].status, 'pending');
});

test('Run Manager 限制日誌大小並可取消執行中工作', async () => {
  const root = createFixtureRoot();
  const registry = createTestRegistry(root);
  const deferred = createDeferredExecutor();
  const manager = createRunManager({
    registry,
    executeStep: deferred.executor,
    maxLogChars: 24
  });

  const run = manager.start('manual-recap');
  await waitFor(() => deferred.pending.length === 1);
  manager.appendLog(run.id, '123456789012345678901234567890');
  manager.cancel(run.id);
  const completed = await manager.waitForCompletion(run.id);

  assert.equal(completed.status, 'cancelled');
  assert.ok(completed.log.length <= 24);
});

test('HTTP API 提供健康、模組清單並保護寫入型操作', async (t) => {
  const root = createFixtureRoot();
  const registry = createTestRegistry(root);
  const manager = createRunManager({
    registry,
    executeStep(step, { onOutput }) {
      onOutput(`${step.id}\n`);
      return {
        promise: Promise.resolve({ exitCode: 0, signal: null, cancelled: false }),
        cancel() {}
      };
    }
  });
  const app = createTestConsoleServer({
    rootDir: root,
    registry,
    runManager: manager,
    token: 'test-token',
    staticRoot: path.join(__dirname, 'public')
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${origin}/healthz`).then((response) => response.json());
  assert.equal(health.status, 'ready');

  const modules = await fetch(`${origin}/api/modules`).then((response) => response.json());
  assert.equal(modules.modules.length, 7);
  assert.equal(modules.modules.some((module) => 'steps' in module), false);

  const forbidden = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ moduleId: 'manual-recap' })
  });
  assert.equal(forbidden.status, 403);

  const accepted = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-pixiu-test-token': 'test-token'
    },
    body: JSON.stringify({ moduleId: 'manual-recap' })
  });
  assert.equal(accepted.status, 202);
  const acceptedBody = await accepted.json();
  const completed = await manager.waitForCompletion(acceptedBody.run.id);
  assert.equal(completed.status, 'passed');

  const unknown = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-pixiu-test-token': 'test-token'
    },
    body: JSON.stringify({ moduleId: 'arbitrary-command' })
  });
  assert.equal(unknown.status, 404);
});

test('HTTP API 拒絕跨來源、錯誤 JSON 與過大 body', async (t) => {
  const root = createFixtureRoot();
  const registry = createTestRegistry(root);
  const manager = createRunManager({ registry, executeStep: createDeferredExecutor().executor });
  const app = createTestConsoleServer({
    rootDir: root,
    registry,
    runManager: manager,
    token: 'test-token',
    maxBodyBytes: 32,
    staticRoot: path.join(__dirname, 'public')
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;

  const crossOrigin = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://example.com',
      'x-pixiu-test-token': 'test-token'
    },
    body: JSON.stringify({ moduleId: 'manual-recap' })
  });
  assert.equal(crossOrigin.status, 403);

  const invalidJson = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-pixiu-test-token': 'test-token'
    },
    body: '{'
  });
  assert.equal(invalidJson.status, 400);

  const tooLarge = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-pixiu-test-token': 'test-token'
    },
    body: JSON.stringify({ moduleId: 'x'.repeat(100) })
  });
  assert.equal(tooLarge.status, 413);
});

test('Repository Safety 能辨識衝突標記與高可信憑證樣式', () => {
  assert.deepEqual(findConflictMarkers('ok\n<<<<<<< HEAD\nvalue\n=======\nother\n>>>>>>> branch\n'), [2, 4, 6]);
  assert.equal(findConflictMarkers('const divider = "======";\n').length, 0);
  const credentialFixture = `const key = "sk-${'1'.repeat(24)}";\n`;
  assert.equal(findCredentialLikeValues(credentialFixture).length, 1);
  assert.equal(findCredentialLikeValues('const pattern = /sk-[A-Za-z0-9]+/;\n').length, 0);
});

test('靜態 UI 包含模組、整合測試、狀態與日誌契約', () => {
  const publicRoot = path.join(__dirname, 'public');
  const html = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(publicRoot, 'app.js'), 'utf8');
  const style = fs.readFileSync(path.join(publicRoot, 'styles.css'), 'utf8');

  assert.match(html, /id="module-grid"/);
  assert.match(html, /id="integration-run"/);
  assert.match(html, /id="run-log"/);
  assert.match(html, /PixiuCore 測試控制台/);
  assert.match(script, /X-Pixiu-Test-Token/);
  assert.match(script, /\/api\/modules/);
  assert.match(script, /\/api\/runs/);
  assert.match(style, /\.module-card/);
});
