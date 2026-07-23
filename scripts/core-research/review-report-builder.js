'use strict';

const path = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');

const { verifyEvaluationTask } = require('./evaluation-task-builder');
const { validateSandboxEvidence } = require('./sandbox-evidence');

const DISPOSITION_RANK = Object.freeze({
  Reject: 0,
  Reference: 1,
  Extract: 2,
  'Integrate Proposed': 3,
});

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '/')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function capDisposition(disposition, maximum) {
  return DISPOSITION_RANK[disposition] > DISPOSITION_RANK[maximum]
    ? maximum
    : disposition;
}

function validateWorkspaceEvidence(task, evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw createError('WORKSPACE_EVIDENCE_INVALID', 'workspace evidence 必須是物件');
  }
  if (evidence.schemaVersion !== 'pixiu.core-research/workspace-evidence-v1') {
    throw createError('WORKSPACE_EVIDENCE_INVALID', 'workspace evidence Schema 不支援');
  }
  if (evidence.taskId !== task.taskId || evidence.taskDigest !== task.integrity.value) {
    throw createError('WORKSPACE_EVIDENCE_TASK_MISMATCH', 'workspace evidence 與 Task 不一致');
  }
  const checkNames = ['license', 'secret', 'static', 'supplyChain', 'promptInjection'];
  for (const checkName of checkNames) {
    const check = evidence.checks?.[checkName];
    if (!check || !Array.isArray(check.findings) || typeof check.status !== 'string') {
      throw createError('WORKSPACE_EVIDENCE_INVALID', `${checkName} check 格式不合法`);
    }
  }
  return evidence;
}

function flattenFindings(workspaceEvidence) {
  const rows = [];
  for (const [checkName, check] of Object.entries(workspaceEvidence.checks)) {
    for (const finding of check.findings) {
      rows.push({
        checkName,
        code: String(finding.code || 'UNKNOWN_FINDING'),
        severity: String(finding.severity || 'UNKNOWN').toUpperCase(),
        path: String(finding.path || '.'),
        line: Number.isInteger(finding.line) ? finding.line : 1,
        summary: String(finding.summary || ''),
      });
    }
  }
  return rows;
}

function deriveRecommendation(task, findings, sandboxEvidence) {
  if (sandboxEvidence.status === 'FAIL') return 'Reject';
  if (findings.some((finding) => finding.severity === 'HIGH')) return 'Reject';
  if (sandboxEvidence.status === 'SKIPPED_UNAVAILABLE' || findings.length > 0) {
    return capDisposition(task.score.disposition, 'Extract');
  }
  return task.score.disposition;
}

function deriveConcerns(findings, sandboxEvidence) {
  const concerns = [...sandboxEvidence.concerns];
  if (findings.some((finding) => finding.severity === 'HIGH')) {
    concerns.push('HIGH_SECURITY_FINDINGS');
  } else if (findings.length > 0) {
    concerns.push('SECURITY_FINDINGS_PRESENT');
  }
  return [...new Set(concerns)];
}

function buildSecurityReport(task, findings, sandboxEvidence, recommendation, concerns) {
  const lines = [
    '# 候選安全評估報告',
    '',
    `- Task：${escapeMarkdown(task.taskId)}`,
    `- 候選：${escapeMarkdown(task.candidate.title)}`,
    `- 來源：${escapeMarkdown(task.source.canonicalUri)}`,
    `- Commit：${escapeMarkdown(task.source.commitSha)}`,
    `- License：${escapeMarkdown(task.source.license)}`,
    `- Sandbox：${escapeMarkdown(sandboxEvidence.status)}`,
    `- 建議：${escapeMarkdown(recommendation)}`,
    `- 狀態：AWAITING_APPROVAL`,
    '',
    '## 風險摘要',
    '',
    ...(concerns.length > 0 ? concerns.map((item) => `- ${escapeMarkdown(item)}`) : ['- 無']),
    '',
    '## 掃描發現',
    '',
    '| 類型 | 原因碼 | 嚴重度 | 路徑 | 行號 | 摘要 |',
    '|---|---|---|---|---:|---|',
  ];
  if (findings.length === 0) {
    lines.push('| — | — | — | — | — | 無發現 |');
  } else {
    for (const finding of findings) {
      lines.push(`| ${escapeMarkdown(finding.checkName)} | ${escapeMarkdown(finding.code)} | ${escapeMarkdown(finding.severity)} | ${escapeMarkdown(finding.path)} | ${finding.line} | ${escapeMarkdown(finding.summary)} |`);
    }
  }
  lines.push(
    '',
    '## Sandbox 證據',
    '',
    `- 結果：${escapeMarkdown(sandboxEvidence.status)}`,
    `- 命令：${sandboxEvidence.command ? escapeMarkdown(sandboxEvidence.command.join(' ')) : '未執行'}`,
    `- 網路隔離：${sandboxEvidence.networkIsolated}`,
    `- 可取得秘密：${sandboxEvidence.secretsAvailable}`,
    `- 限定工作區：${sandboxEvidence.workspaceOnly}`,
    '',
    '## 執行邊界',
    '',
    '- 本報告不代表已核准整合。',
    '- 不得直接修改 master、Push、Merge 或部署。',
    '- `APPROVED_FOR_PLAN` 只允許另開正式實作計畫。',
    '',
  );
  return lines.join('\n');
}

function buildIntegrationSpec(task, findings, recommendation, concerns) {
  const highFindings = findings.filter((finding) => finding.severity === 'HIGH');
  return [
    '# 整合 Spec 草案',
    '',
    `- Task：${escapeMarkdown(task.taskId)}`,
    `- 候選：${escapeMarkdown(task.candidate.title)}`,
    `- 原始建議：${escapeMarkdown(task.score.disposition)}`,
    `- 評估後建議：${escapeMarkdown(recommendation)}`,
    `- 核准狀態：AWAITING_APPROVAL`,
    '',
    '## 目標',
    '',
    escapeMarkdown(task.candidate.summary),
    '',
    '## 可萃取能力',
    '',
    ...task.candidate.categories.map((category) => `- ${escapeMarkdown(category)}`),
    '',
    '## 建議整合方式',
    '',
    recommendation === 'Integrate Proposed'
      ? '- 可進入正式實作計畫，但仍需人工核准與重新 TDD。'
      : recommendation === 'Extract'
        ? '- 僅萃取概念，以 PixiuCore 自有程式重新實作。'
        : recommendation === 'Reference'
          ? '- 只保留為設計參考，不執行外部程式碼。'
          : '- 拒絕導入；保留報告作為風險證據。',
    '',
    '## 主要風險',
    '',
    ...(concerns.length > 0 ? concerns.map((item) => `- ${escapeMarkdown(item)}`) : ['- 無已知阻擋風險']),
    ...(highFindings.map((finding) => `- ${escapeMarkdown(finding.code)}：${escapeMarkdown(finding.path)}:${finding.line}`)),
    '',
    '## 驗收條件',
    '',
    '- [ ] 正式實作必須位於新的 feature branch／worktree。',
    '- [ ] 不直接複製未審查外部程式碼；Extract 採自有實作。',
    '- [ ] 所有安全發現有對應修正或明確拒絕理由。',
    '- [ ] 既有核心測試與新增測試全數通過。',
    '- [ ] 人工核准後才可開始正式實作。',
    '',
  ].join('\n');
}

async function writeEvaluationReview({
  task: inputTask,
  workspaceEvidence: inputWorkspaceEvidence,
  sandboxEvidence: inputSandboxEvidence,
  outputDir,
} = {}) {
  if (typeof outputDir !== 'string' || outputDir.trim() === '') {
    throw createError('EVALUATION_REPORT_INPUT_INVALID', 'outputDir 不可為空');
  }
  const task = verifyEvaluationTask(inputTask);
  const workspaceEvidence = validateWorkspaceEvidence(task, inputWorkspaceEvidence);
  const sandboxEvidence = validateSandboxEvidence(task, inputSandboxEvidence);
  const findings = flattenFindings(workspaceEvidence);
  const concerns = deriveConcerns(findings, sandboxEvidence);
  const recommendation = deriveRecommendation(task, findings, sandboxEvidence);
  const reviewState = concerns.length > 0 ? 'REVIEW_READY_WITH_CONCERNS' : 'REVIEW_READY';
  const resolvedOutputDir = path.resolve(outputDir);
  const files = Object.freeze({
    evidence: path.join(resolvedOutputDir, 'evidence.json'),
    securityReport: path.join(resolvedOutputDir, 'security-report.md'),
    integrationSpec: path.join(resolvedOutputDir, 'integration-spec.md'),
  });
  const payload = {
    schemaVersion: 'pixiu.core-research/evaluation-review-v1',
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    generatedAt: sandboxEvidence.recordedAt,
    reviewState,
    recommendation,
    concerns,
    findingSummary: {
      total: findings.length,
      high: findings.filter((item) => item.severity === 'HIGH').length,
      medium: findings.filter((item) => item.severity === 'MEDIUM').length,
      low: findings.filter((item) => item.severity === 'LOW').length,
    },
    workspaceEvidence,
    sandboxEvidence,
  };

  await mkdir(resolvedOutputDir, { recursive: true });
  await Promise.all([
    writeFile(files.evidence, serializeJson(payload), 'utf8'),
    writeFile(
      files.securityReport,
      buildSecurityReport(task, findings, sandboxEvidence, recommendation, concerns),
      'utf8',
    ),
    writeFile(
      files.integrationSpec,
      buildIntegrationSpec(task, findings, recommendation, concerns),
      'utf8',
    ),
  ]);

  return Object.freeze({
    outputDir: resolvedOutputDir,
    files,
    reviewState,
    recommendation,
    concerns: Object.freeze([...concerns]),
    findingSummary: Object.freeze({ ...payload.findingSummary }),
  });
}

module.exports = {
  writeEvaluationReview,
};
