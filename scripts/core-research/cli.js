#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  mkdir,
  readFile,
  writeFile,
} = require('node:fs/promises');

const {
  appendEvaluationEvent,
  buildEvaluationTask,
  deriveEvaluationStates,
  evaluateRepositoryCandidate,
  importCandidates,
  listLatestCandidates,
  readEvaluationLedger,
  readRegistry,
  recordHumanApproval,
  scanCandidateWorkspace,
  selectWeeklyCandidates,
  verifyEvaluationTask,
  writeEvaluationReview,
  writeWeeklyReport,
} = require('./index');

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      throw createError('ARGUMENT_INVALID', `不支援的參數：${token}`);
    }
    const key = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw createError('ARGUMENT_REQUIRED', `${token} 缺少值`);
    }
    if (Object.hasOwn(options, key)) {
      throw createError('ARGUMENT_INVALID', `${token} 不可重複`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, key) {
  const value = options[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError('ARGUMENT_REQUIRED', `缺少 --${key}`);
  }
  return value;
}

function assertAllowedOptions(options, allowedKeys) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) {
      throw createError('ARGUMENT_INVALID', `不支援的參數：--${key}`);
    }
  }
}

function parseNumberOption(options, key, fallback) {
  if (!Object.hasOwn(options, key)) return fallback;
  const value = Number(options[key]);
  if (!Number.isFinite(value)) {
    throw createError('ARGUMENT_INVALID', `--${key} 必須是數字`);
  }
  return value;
}

async function readInputJson(inputPath) {
  let text;
  try {
    text = await readFile(inputPath, 'utf8');
  } catch {
    throw createError('INPUT_FILE_READ_FAILED', `無法讀取輸入檔：${inputPath}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw createError('INPUT_JSON_INVALID', '輸入檔不是有效 JSON');
  }
}

async function writeJsonFile(outputPath, value) {
  const resolved = path.resolve(outputPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return resolved;
}

async function runImport(options) {
  assertAllowedOptions(options, ['input', 'registry', 'imported-at']);
  const inputPath = path.resolve(requireOption(options, 'input'));
  const registryPath = path.resolve(requireOption(options, 'registry'));
  const input = await readInputJson(inputPath);
  const candidates = Array.isArray(input) ? input : [input];
  const result = await importCandidates({
    registryPath,
    candidates,
    importedAt: options['imported-at'],
  });

  process.stdout.write(
    `完成：匯入 ${result.imported.length} 項，重複 ${result.duplicates.length} 項，Registry：${registryPath}\n`,
  );
}

async function runWeeklySelect(options) {
  assertAllowedOptions(options, [
    'registry',
    'output',
    'now',
    'days',
    'minimum-score',
    'limit',
    'per-category',
  ]);
  const registryPath = path.resolve(requireOption(options, 'registry'));
  const outputDir = path.resolve(requireOption(options, 'output'));
  const events = await readRegistry(registryPath);
  const candidates = listLatestCandidates(events);
  const selection = selectWeeklyCandidates(candidates, {
    now: options.now,
    days: parseNumberOption(options, 'days', 7),
    minimumScore: parseNumberOption(options, 'minimum-score', 70),
    totalLimit: parseNumberOption(options, 'limit', 5),
    perCategoryLimit: parseNumberOption(options, 'per-category', 2),
  });
  const report = await writeWeeklyReport({ outputDir, selection });

  process.stdout.write(
    `完成：考慮 ${selection.statistics.considered} 項，入選 ${selection.statistics.selected} 項，排除 ${selection.statistics.rejected} 項，報告：${report.files.report}\n`,
  );
}

function selectedItemsFromInput(input) {
  const items = Array.isArray(input) ? input : input?.items;
  if (!Array.isArray(items)) {
    throw createError('SELECTED_INPUT_INVALID', 'selected 輸入必須是陣列或含 items 陣列');
  }
  return items;
}

async function runPrepareEvaluations(options) {
  assertAllowedOptions(options, [
    'selected',
    'output',
    'state-root',
    'artifact-root',
    'ledger',
    'created-at',
  ]);
  const selectedPath = path.resolve(requireOption(options, 'selected'));
  const outputDir = path.resolve(requireOption(options, 'output'));
  const stateRoot = path.resolve(requireOption(options, 'state-root'));
  const artifactRoot = path.resolve(requireOption(options, 'artifact-root'));
  const ledgerPath = path.resolve(requireOption(options, 'ledger'));
  const items = selectedItemsFromInput(await readInputJson(selectedPath));
  const states = deriveEvaluationStates(await readEvaluationLedger(ledgerPath));
  const prepared = [];
  const skipped = [];

  await mkdir(outputDir, { recursive: true });
  for (const selectionEntry of items) {
    const sourceDecision = evaluateRepositoryCandidate(selectionEntry);
    if (sourceDecision.decision !== 'CHECKOUT_ALLOWED') {
      skipped.push({
        candidateId: selectionEntry?.candidate?.candidateId || null,
        decision: sourceDecision.decision,
        reasonCodes: sourceDecision.reasonCodes,
      });
      continue;
    }

    const task = buildEvaluationTask({
      selectionEntry,
      stateRoot,
      artifactRoot,
      createdAt: options['created-at'],
    });
    const taskDir = path.join(outputDir, task.taskId);
    const taskPath = await writeJsonFile(path.join(taskDir, 'task.json'), task);
    if (!states[task.taskId]) {
      await appendEvaluationEvent({
        ledgerPath,
        task,
        eventType: 'EVALUATION_PREPARED',
        eventAt: options['created-at'],
        payload: {
          taskPath,
          artifactDir: task.artifactDir,
          worktreePath: task.workspace.worktreePath,
        },
      });
    }
    prepared.push({
      taskId: task.taskId,
      taskPath,
      artifactDir: task.artifactDir,
      worktreePath: task.workspace.worktreePath,
      checkoutPlan: task.checkoutPlan,
    });
  }

  const summaryPath = await writeJsonFile(path.join(outputDir, 'prepare-summary.json'), {
    schemaVersion: 'pixiu.core-research/evaluation-prepare-summary-v1',
    generatedAt: options['created-at'] || new Date().toISOString(),
    prepared,
    skipped,
  });
  process.stdout.write(
    `完成：建立 ${prepared.length} 個評估任務，跳過 ${skipped.length} 項，摘要：${summaryPath}\n`,
  );
}

async function runEvaluateWorkspace(options) {
  assertAllowedOptions(options, ['task', 'workspace', 'output', 'scanned-at']);
  const taskPath = path.resolve(requireOption(options, 'task'));
  const workspacePath = path.resolve(requireOption(options, 'workspace'));
  const outputPath = path.resolve(requireOption(options, 'output'));
  const task = verifyEvaluationTask(await readInputJson(taskPath));
  const evidence = await scanCandidateWorkspace({
    task,
    workspacePath,
    scannedAt: options['scanned-at'],
  });
  await writeJsonFile(outputPath, evidence);
  process.stdout.write(`完成：工作區掃描證據：${outputPath}\n`);
}

function countHighFindings(workspaceEvidence) {
  let count = 0;
  for (const check of Object.values(workspaceEvidence.checks || {})) {
    count += (check.findings || []).filter((finding) => (
      String(finding.severity || '').toUpperCase() === 'HIGH'
    )).length;
  }
  return count;
}

async function runRecordEvidence(options) {
  assertAllowedOptions(options, [
    'task',
    'workspace-evidence',
    'sandbox-evidence',
    'output',
    'ledger',
    'recorded-at',
  ]);
  const task = verifyEvaluationTask(await readInputJson(path.resolve(requireOption(options, 'task'))));
  const workspaceEvidence = await readInputJson(
    path.resolve(requireOption(options, 'workspace-evidence')),
  );
  const sandboxEvidence = await readInputJson(
    path.resolve(requireOption(options, 'sandbox-evidence')),
  );
  const outputDir = path.resolve(requireOption(options, 'output'));
  const ledgerPath = path.resolve(requireOption(options, 'ledger'));
  const report = await writeEvaluationReview({
    task,
    workspaceEvidence,
    sandboxEvidence,
    outputDir,
  });

  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'WORKSPACE_SCANNED',
    eventAt: options['recorded-at'] || workspaceEvidence.scannedAt,
    payload: {
      scannedFiles: workspaceEvidence.statistics?.scannedFiles || 0,
      highFindings: countHighFindings(workspaceEvidence),
    },
  });
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'EVIDENCE_RECORDED',
    eventAt: options['recorded-at'] || sandboxEvidence.recordedAt,
    payload: {
      sandboxStatus: sandboxEvidence.status,
      concerns: report.concerns,
      recommendation: report.recommendation,
      files: report.files,
    },
  });
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'REVIEW_READY',
    eventAt: options['recorded-at'] || sandboxEvidence.recordedAt,
    payload: {
      reviewState: 'AWAITING_APPROVAL',
      sourceReviewState: report.reviewState,
    },
  });

  process.stdout.write(
    `完成：評估證據已記錄，建議 ${report.recommendation}，狀態 AWAITING_APPROVAL，報告：${report.files.securityReport}\n`,
  );
}

async function runApprove(options) {
  assertAllowedOptions(options, [
    'ledger',
    'task-id',
    'decision',
    'by',
    'comment',
    'decided-at',
  ]);
  const event = await recordHumanApproval({
    ledgerPath: path.resolve(requireOption(options, 'ledger')),
    taskId: requireOption(options, 'task-id'),
    decision: requireOption(options, 'decision'),
    actor: requireOption(options, 'by'),
    comment: requireOption(options, 'comment'),
    decidedAt: options['decided-at'],
  });
  process.stdout.write(
    `完成：${event.taskId} → ${event.payload.resultState}\n`,
  );
}

async function runEvaluationStatus(options) {
  assertAllowedOptions(options, ['ledger', 'output']);
  const ledgerPath = path.resolve(requireOption(options, 'ledger'));
  const events = await readEvaluationLedger(ledgerPath);
  const payload = {
    schemaVersion: 'pixiu.core-research/evaluation-status-v1',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    tasks: deriveEvaluationStates(events),
  };
  if (options.output) {
    const outputPath = await writeJsonFile(path.resolve(options.output), payload);
    process.stdout.write(`完成：評估狀態：${outputPath}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function run(argv = process.argv.slice(2)) {
  const [command, ...optionArgs] = argv;
  if (!command) {
    throw createError(
      'COMMAND_REQUIRED',
      '請指定 import、weekly-select、prepare-evaluations、evaluate-workspace、record-evidence、approve 或 evaluation-status',
    );
  }
  const options = parseOptions(optionArgs);

  if (command === 'import') return runImport(options);
  if (command === 'weekly-select') return runWeeklySelect(options);
  if (command === 'prepare-evaluations') return runPrepareEvaluations(options);
  if (command === 'evaluate-workspace') return runEvaluateWorkspace(options);
  if (command === 'record-evidence') return runRecordEvidence(options);
  if (command === 'approve') return runApprove(options);
  if (command === 'evaluation-status') return runEvaluationStatus(options);
  throw createError('COMMAND_UNSUPPORTED', `不支援的命令：${command}`);
}

function formatError(error) {
  const code = error?.code || 'CORE_RESEARCH_FAILED';
  const message = String(error?.message || '執行失敗').replace(/\r?\n/g, ' ').trim();
  return `CORE_RESEARCH_ERROR ${code}: ${message}`;
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${formatError(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  run,
  parseOptions,
  formatError,
};
