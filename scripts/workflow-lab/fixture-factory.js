#!/usr/bin/env node
'use strict';

function splitRules(value) {
  return String(value || '')
    .split(/\r?\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createSyntheticArtifacts(options = {}) {
  const { request, redactor } = options;
  if (!request || !redactor) {
    throw new TypeError('建立 Assisted Fixture 需要 request 與 redactor');
  }

  const normalizedRequirement = redactor.redactText(
    request.requirement || request.businessLogic || '合成測試需求'
  );
  const translatedBusinessRules = splitRules(redactor.redactText(request.businessLogic))
    .concat(request.businessLogic ? [] : ['輸入有效時執行合成測試流程']);
  const acceptanceCriteria = request.acceptanceCriteria.length > 0
    ? [...request.acceptanceCriteria]
    : [`完成並驗證：${normalizedRequirement}`];

  const translated = {
    synthetic: true,
    normalizedRequirement,
    translatedBusinessRules,
    expectedOutcome: redactor.redactText(request.expectedOutcome),
    sourceMode: request.inputMode
  };
  const pm = {
    synthetic: true,
    problemStatement: normalizedRequirement,
    goal: redactor.redactText(request.expectedOutcome) || normalizedRequirement,
    scope: [normalizedRequirement],
    outOfScope: ['未經核准的需求擴張'],
    functionalRequirements: [normalizedRequirement],
    nonFunctionalRequirements: ['可驗證', '可回滾', '敏感資訊遮罩'],
    acceptanceCriteria,
    unknowns: [],
    dependencies: [],
    risks: [...request.constraints]
  };
  const sa = {
    synthetic: true,
    asIs: ['Assisted Fixture 現況流程'],
    businessRules: translatedBusinessRules,
    dataFlow: ['輸入 → 驗證 → 執行 → 結果'],
    callChain: [],
    impactScope: ['目標功能模組'],
    rootCause: null,
    unverified: ['未讀取真實專案原始碼'],
    options: [{ id: 'minimal', pros: ['改動小'], cons: ['Fixture 不代表真實分析'] }],
    regressionRisks: ['Live SA 需依來源驗證']
  };
  const sd = {
    synthetic: true,
    toBe: ['依需求建立可驗證技術流程'],
    architectureBoundaries: ['輸入', '核心邏輯', '驗證'],
    designContract: {
      input: 'validated-request',
      output: 'verified-result',
      errors: ['INVALID_INPUT', 'EXECUTION_FAILED']
    },
    allowedFiles: [],
    implementationPlan: ['先測試', '最小實作', '完整驗證'],
    testStrategy: ['unit', 'integration', 'main-path'],
    rollbackPlan: ['保留隔離 Worktree', '不 Push', '不 Merge'],
    adr: { decision: '最小可驗證實作', alternatives: ['直接修改原 checkout（否決）'] }
  };
  const pg = {
    synthetic: true,
    worktreeRequired: true,
    allowedFiles: [],
    forbiddenOperations: ['push', 'merge', 'deploy', 'db-write', 'dependency-change'],
    changedFiles: [],
    diffSummary: 'Assisted Fixture 未修改程式',
    buildResult: 'not-run',
    testResult: 'not-run'
  };
  const qa = {
    synthetic: true,
    verdict: 'GREEN',
    testMatrix: ['Acceptance Criteria', 'Business Rules', 'Design Contract', 'PG Evidence'],
    passed: 4,
    failed: 0,
    skipped: 0,
    defects: [],
    adversarialProbes: ['null', 'long-input', 'special-characters']
  };
  const documentation = {
    synthetic: true,
    summary: normalizedRequirement,
    sections: ['PM Requirement', 'SA Analysis', 'SD Design', 'PG Implementation', 'QA Result'],
    qaVerdict: 'GREEN',
    deploymentAllowed: false
  };

  return {
    'translated-requirement-v1': translated,
    'workflow-route-v1': {
      synthetic: true,
      moduleSequence: [...request.moduleSequence],
      mode: request.mode,
      inputMode: request.inputMode,
      approvals: [],
      pgRequiresWorktree: request.moduleSequence.includes('pg')
    },
    'pm-artifact-v1': pm,
    'checker-result-v1': {
      synthetic: true,
      verdict: 'GREEN',
      missingFields: []
    },
    'sa-artifact-v1': sa,
    'sd-artifact-v1': sd,
    'pg-artifact-v1': pg,
    'qa-artifact-v1': qa,
    'approval-result-v1': {
      synthetic: true,
      approved: true,
      source: 'assisted-fixture'
    },
    'documentation-artifact-v1': documentation,
    'memory-candidate-v1': {
      synthetic: true,
      recapCandidate: normalizedRequirement,
      decisionCandidates: [],
      observationCandidates: [],
      writeToVault: false
    },
    'need-to-know-report-v1': {
      synthetic: true,
      selectedModules: [...request.moduleSequence],
      visibleArtifactTypes: [],
      rawRequirementVisible: false,
      rawBusinessLogicVisible: false
    }
  };
}

module.exports = {
  createSyntheticArtifacts
};
