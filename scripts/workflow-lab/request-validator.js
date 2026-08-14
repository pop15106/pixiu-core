#!/usr/bin/env node
'use strict';

const { createWorkflowCatalog } = require('./workflow-catalog');

const LIMITS = Object.freeze({
  requirementChars: 50000,
  businessLogicChars: 100000,
  expectedOutcomeChars: 20000,
  constraintCount: 100,
  sensitiveTermCount: 200,
  acceptanceCriteriaCount: 200,
  collectionItemChars: 10000,
  artifactBytes: 500000
});

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const ENUMS = Object.freeze({
  mode: new Set(['offline', 'live']),
  inputMode: new Set(['need-to-know', 'raw-pass-through']),
  selectionMode: new Set(['single', 'partial', 'full']),
  fixtureMode: new Set(['strict', 'assisted-fixture']),
  testScenario: new Set(['green', 'qa-red', 'checker-red', 'canary-leak', 'delayed'])
});

class WorkflowRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkflowRequestError';
    this.code = code;
  }
}

function assertEnum(name, value) {
  if (!ENUMS[name].has(value)) {
    throw new WorkflowRequestError(
      `INVALID_WORKFLOW_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`,
      `${name} 值不允許：${value}`
    );
  }
}

function normalizeText(value, limit, fieldName) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new WorkflowRequestError('INVALID_WORKFLOW_TEXT', `${fieldName} 必須是字串`);
  }
  const normalized = value.trim();
  if (normalized.length > limit) {
    throw new WorkflowRequestError('WORKFLOW_INPUT_TOO_LARGE', `${fieldName} 超過字數上限`);
  }
  return normalized;
}

function normalizeStringArray(value, limit, fieldName) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new WorkflowRequestError('INVALID_WORKFLOW_COLLECTION', `${fieldName} 必須是陣列`);
  }
  if (value.length > limit) {
    throw new WorkflowRequestError('WORKFLOW_COLLECTION_TOO_LARGE', `${fieldName} 超過數量上限`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw new WorkflowRequestError('INVALID_WORKFLOW_COLLECTION', `${fieldName}[${index}] 必須是字串`);
    }
    const normalized = item.trim();
    if (normalized.length > LIMITS.collectionItemChars) {
      throw new WorkflowRequestError('WORKFLOW_INPUT_TOO_LARGE', `${fieldName}[${index}] 超過字數上限`);
    }
    return normalized;
  }).filter(Boolean);
}

function cloneArtifactValue(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }
  if (['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new WorkflowRequestError('INVALID_INPUT_ARTIFACTS', 'inputArtifacts 不允許非有限數值');
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new WorkflowRequestError('INVALID_INPUT_ARTIFACTS', 'inputArtifacts 只允許可序列化資料');
  }
  if (seen.has(value)) {
    throw new WorkflowRequestError('INVALID_INPUT_ARTIFACTS', 'inputArtifacts 不允許循環參照');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => cloneArtifactValue(item, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new WorkflowRequestError('INVALID_INPUT_ARTIFACTS', 'inputArtifacts 只允許一般物件');
    }
    const result = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new WorkflowRequestError('INVALID_INPUT_ARTIFACTS', `inputArtifacts 包含禁止鍵：${key}`);
      }
      result[key] = cloneArtifactValue(value[key], seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function normalizeInputArtifacts(value, catalog) {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkflowRequestError('INVALID_INPUT_ARTIFACTS', 'inputArtifacts 必須是物件');
  }
  const knownTypes = new Set();
  for (const module of catalog.list()) {
    for (const type of catalog.get(module.id).produces) {
      knownTypes.add(type);
    }
  }
  const cloned = {};
  for (const [type, artifactValue] of Object.entries(value)) {
    if (!knownTypes.has(type)) {
      throw new WorkflowRequestError('UNKNOWN_INPUT_ARTIFACT', `未知 Artifact 類型：${type}`);
    }
    cloned[type] = cloneArtifactValue(artifactValue);
  }
  const bytes = Buffer.byteLength(JSON.stringify(cloned), 'utf8');
  if (bytes > LIMITS.artifactBytes) {
    throw new WorkflowRequestError('INPUT_ARTIFACTS_TOO_LARGE', 'inputArtifacts 超過大小上限');
  }
  return cloned;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function normalizeWorkflowRequest(input = {}, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WorkflowRequestError('INVALID_WORKFLOW_REQUEST', 'WorkflowRequest 必須是物件');
  }

  const catalog = options.catalog || createWorkflowCatalog();
  const mode = input.mode || 'offline';
  const inputMode = input.inputMode || 'need-to-know';
  const selectionMode = input.selectionMode || 'partial';
  const fixtureMode = input.fixtureMode || 'strict';
  const testScenario = input.testScenario || 'green';
  assertEnum('mode', mode);
  assertEnum('inputMode', inputMode);
  assertEnum('selectionMode', selectionMode);
  assertEnum('fixtureMode', fixtureMode);
  assertEnum('testScenario', testScenario);

  const requirement = normalizeText(input.requirement, LIMITS.requirementChars, 'requirement');
  const businessLogic = normalizeText(input.businessLogic, LIMITS.businessLogicChars, 'businessLogic');
  const expectedOutcome = normalizeText(input.expectedOutcome, LIMITS.expectedOutcomeChars, 'expectedOutcome');
  if (!requirement && !businessLogic) {
    throw new WorkflowRequestError('WORKFLOW_INPUT_REQUIRED', '需求與商業邏輯至少填一項');
  }

  const constraints = normalizeStringArray(input.constraints, LIMITS.constraintCount, 'constraints');
  const sensitiveTerms = normalizeStringArray(input.sensitiveTerms, LIMITS.sensitiveTermCount, 'sensitiveTerms');
  const acceptanceCriteria = normalizeStringArray(
    input.acceptanceCriteria,
    LIMITS.acceptanceCriteriaCount,
    'acceptanceCriteria'
  );
  const inputArtifacts = normalizeInputArtifacts(input.inputArtifacts, catalog);

  let moduleSequence;
  if (input.moduleSequence === undefined) {
    if (selectionMode === 'full') {
      moduleSequence = [...catalog.defaultSequence];
    } else if (selectionMode === 'single') {
      moduleSequence = ['translator'];
    } else {
      moduleSequence = ['translator', 'pm'];
    }
  } else if (!Array.isArray(input.moduleSequence) || input.moduleSequence.length === 0) {
    throw new WorkflowRequestError('INVALID_WORKFLOW_SEQUENCE', 'moduleSequence 至少需要一個模組');
  } else {
    moduleSequence = input.moduleSequence.map((moduleId) => {
      if (typeof moduleId !== 'string' || !moduleId.trim()) {
        throw new WorkflowRequestError('INVALID_WORKFLOW_SEQUENCE', 'moduleSequence 必須是非空字串陣列');
      }
      return moduleId.trim();
    });
  }

  const seen = new Set();
  for (const moduleId of moduleSequence) {
    if (!catalog.get(moduleId)) {
      throw new WorkflowRequestError('UNKNOWN_WORKFLOW_MODULE', `找不到工作流模組：${moduleId}`);
    }
    if (seen.has(moduleId)) {
      throw new WorkflowRequestError('DUPLICATE_WORKFLOW_MODULE', `工作流模組重複：${moduleId}`);
    }
    seen.add(moduleId);
  }

  const advancedOrder = Boolean(input.advancedOrder);
  const allowUnsafeOrder = Boolean(input.allowUnsafeOrder);
  try {
    catalog.validateSequence(moduleSequence, { advancedOrder, allowUnsafeOrder, fixtureMode });
  } catch (error) {
    throw new WorkflowRequestError('INVALID_WORKFLOW_SEQUENCE', error.message);
  }

  const requiresApproval = [];
  if (inputMode === 'raw-pass-through' && !input.rawPassThroughApproved) {
    requiresApproval.push({ kind: 'raw-pass-through', message: '原文直通需要人工核准' });
  }
  if (allowUnsafeOrder && !input.unsafeOrderApproved) {
    requiresApproval.push({ kind: 'unsafe-order', message: '不安全模組順序需要人工核准' });
  }

  const project = input.project && typeof input.project === 'object' && !Array.isArray(input.project)
    ? {
        source: typeof input.project.source === 'string' ? input.project.source : 'manual',
        path: typeof input.project.path === 'string' ? input.project.path.trim() : ''
      }
    : { source: 'manual', path: '' };

  return deepFreeze({
    mode,
    inputMode,
    selectionMode,
    fixtureMode,
    testScenario,
    requirement,
    businessLogic,
    expectedOutcome,
    constraints,
    sensitiveTerms,
    acceptanceCriteria,
    inputArtifacts,
    project,
    moduleSequence,
    advancedOrder,
    allowUnsafeOrder,
    rawPassThroughApproved: Boolean(input.rawPassThroughApproved),
    unsafeOrderApproved: Boolean(input.unsafeOrderApproved),
    requiresApproval
  });
}

module.exports = {
  LIMITS,
  WorkflowRequestError,
  normalizeWorkflowRequest
};
