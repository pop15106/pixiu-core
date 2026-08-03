'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  executeAgentLearningRun,
  planAgentLearningRun
} = require('./pipeline');

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function createObservation({ date, topic, sourcePath, verified = false }) {
  return `---\n` +
    `type: agent-observation\n` +
    `date: ${date}\n` +
    `project: PIXIUCORE\n` +
    `system: PIXIUCORE\n` +
    `repo: pixiu-core\n` +
    `topic: ${topic}\n` +
    `status: ${verified ? 'verified' : 'candidate'}\n` +
    `scope: project\n` +
    `source_session: retrospective-from-vault\n` +
    `summary: ${topic} 摘要\n` +
    `tags: [agent-learning, observation]\n` +
    `source_paths:\n` +
    `  - ${sourcePath}\n` +
    `related_notes:\n` +
    `  - vault/context/agent-metacognition-memory-system-plan.md\n` +
    `confidence: 0.55\n` +
    `verified: ${verified ? 'true' : 'false'}\n` +
    `---\n\n` +
    `# Observation - ${topic}\n\n` +
    `## Context\n\n可回查的設定漂移情境。\n\n` +
    `## Action\n\n回讀實際生效設定。\n\n` +
    `## Result\n\n找到宣告與生效狀態的差異。\n\n` +
    `## Why It Happened\n\n可驗證事實與推論已分開。\n\n` +
    `## Recommendation\n\nPromotion destination: promote to instinct after independent verification.\n\n` +
    `## Evidence\n\n- ${sourcePath}\n\n` +
    `## Verification\n\n` +
    `- verifier: manual checklist pending\n` +
    `- result: needs-review\n` +
    `- notes: 尚待獨立驗證。\n`;
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-agent-learning-'));
  writeFile(root, 'vault/context/source-a.md', '# A\n');
  writeFile(root, 'vault/context/source-b.md', '# B\n');
  writeFile(root, 'vault/context/agent-metacognition-memory-system-plan.md', '# Plan\n');
  writeFile(
    root,
    'vault/memory/agent-learning/verifier-reports/verifier-checklist.md',
    '# Verifier Checklist\n\n此檔是操作說明，不是索引文件。\n'
  );
  writeFile(
    root,
    'vault/memory/agent-learning/observations/2026-07-28-first-observation.md',
    createObservation({
      date: '2026-07-28',
      topic: 'first-observation',
      sourcePath: 'vault/context/source-a.md'
    })
  );
  writeFile(
    root,
    'vault/memory/agent-learning/observations/2026-07-28-second-observation.md',
    createObservation({
      date: '2026-07-28',
      topic: 'second-observation',
      sourcePath: 'vault/context/source-b.md'
    })
  );
  return root;
}

function createReview() {
  return {
    schemaVersion: 1,
    verifier: 'codex-manual-review',
    observations: [
      {
        path: 'vault/memory/agent-learning/observations/2026-07-28-first-observation.md',
        result: 'pass',
        destination: 'instinct',
        cluster: 'effective-state-readback',
        notes: '來源可回讀，事實與推論已分離。'
      },
      {
        path: 'vault/memory/agent-learning/observations/2026-07-28-second-observation.md',
        result: 'pass',
        destination: 'instinct',
        cluster: 'effective-state-readback',
        notes: '來源可回讀，範圍維持在專案內。'
      }
    ],
    promotionGroups: [
      {
        cluster: 'effective-state-readback',
        title: 'Effective State Readback',
        summary: '設定或 Hook 行為異常時，先回讀實際生效狀態。',
        trigger: '入口、Hook 或執行狀態彼此不一致。',
        firstMove: '比較實際生效檔、live binding 與 repo 宣告。',
        rationale: '宣告檔與執行中狀態可能獨立漂移。',
        boundaries: '不授權自動修改使用者設定、Hook 或服務。',
        nextTarget: 'sop'
      }
    ]
  };
}

test('Verifier 通過後更新 observation 並建立獨立報告', () => {
  const root = createFixture();
  const result = executeAgentLearningRun({
    corePath: root,
    review: createReview(),
    now: new Date('2026-07-28T02:00:00.000Z')
  });

  assert.equal(result.verifiedObservations.length, 2);
  const updated = fs.readFileSync(
    path.join(root, 'vault/memory/agent-learning/observations/2026-07-28-first-observation.md'),
    'utf8'
  );
  assert.match(updated, /^status: verified$/m);
  assert.match(updated, /^verified: true$/m);
  assert.match(updated, /- verifier: codex-manual-review/);
  assert.match(updated, /- result: pass/);

  const reportPath = path.join(
    root,
    'vault/memory/agent-learning/verifier-reports/2026-07-28-first-observation-verification.md'
  );
  assert.equal(fs.existsSync(reportPath), true);
  assert.match(fs.readFileSync(reportPath, 'utf8'), /result: pass/);
});

test('兩筆獨立 verified observations 才能產生 instinct 與 promote candidate', () => {
  const root = createFixture();
  const result = executeAgentLearningRun({
    corePath: root,
    review: createReview(),
    now: new Date('2026-07-28T02:00:00.000Z')
  });

  assert.deepEqual(result.instincts, [
    'vault/memory/agent-learning/instincts/2026-07-28-effective-state-readback.md'
  ]);
  assert.deepEqual(result.promoteCandidates, [
    'vault/memory/agent-learning/promote-candidates/2026-07-28-effective-state-readback-candidate.md'
  ]);

  const instinct = fs.readFileSync(path.join(root, ...result.instincts[0].split('/')), 'utf8');
  assert.match(instinct, /supporting_observations:/);
  assert.match(instinct, /first-observation/);
  assert.match(instinct, /second-observation/);
  assert.match(instinct, /不授權自動修改使用者設定/);
});

test('單一 observation 不得升級成 instinct', () => {
  const root = createFixture();
  const review = createReview();
  review.observations = review.observations.slice(0, 1);

  assert.throws(
    () => planAgentLearningRun({
      corePath: root,
      review,
      now: new Date('2026-07-28T02:00:00.000Z')
    }),
    /至少需要兩筆通過驗證的 observation/
  );
});

test('缺失或越界 source_paths 時 fail closed', () => {
  const root = createFixture();
  const observationPath = path.join(
    root,
    'vault/memory/agent-learning/observations/2026-07-28-first-observation.md'
  );
  const unsafe = fs.readFileSync(observationPath, 'utf8')
    .replace('vault/context/source-a.md', '../outside.md');
  fs.writeFileSync(observationPath, unsafe, 'utf8');

  assert.throws(
    () => planAgentLearningRun({
      corePath: root,
      review: createReview(),
      now: new Date('2026-07-28T02:00:00.000Z')
    }),
    /source_paths 不合法/
  );
});

test('Phase 5 manifest 只索引 verified observations 與治理產物', () => {
  const root = createFixture();
  writeFile(
    root,
    'vault/memory/agent-learning/consolidation-runs/recap-deadbeef.json',
    '{"status":"complete"}\n'
  );
  const result = executeAgentLearningRun({
    corePath: root,
    review: createReview(),
    now: new Date('2026-07-28T02:00:00.000Z')
  });

  const manifest = JSON.parse(fs.readFileSync(path.join(root, ...result.manifestPath.split('/')), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.documents.filter((item) => item.type === 'agent-observation').length, 2);
  assert.equal(manifest.documents.some((item) => item.path.includes('consolidation-runs')), false);
  assert.equal(manifest.documents.some((item) => item.type === 'agent-instinct'), true);
  assert.equal(manifest.documents.some((item) => item.type === 'agent-verifier-report'), true);
  assert.equal(manifest.documents.some((item) => item.type === 'agent-promote-candidate'), true);
});

test('相同 review 重跑保持冪等', () => {
  const root = createFixture();
  const input = {
    corePath: root,
    review: createReview(),
    now: new Date('2026-07-28T02:00:00.000Z')
  };
  const first = executeAgentLearningRun(input);
  const second = executeAgentLearningRun(input);

  assert.deepEqual(second.verifiedObservations, first.verifiedObservations);
  assert.deepEqual(second.instincts, first.instincts);
  assert.deepEqual(second.promoteCandidates, first.promoteCandidates);
  assert.equal(second.changedFiles, 0);
});
