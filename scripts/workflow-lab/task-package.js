#!/usr/bin/env node
'use strict';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function cloneSafe(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }
  if (['string', 'number', 'boolean'].includes(typeof value)) {
    return value;
  }
  if (typeof value !== 'object') {
    throw new TypeError('Task Package 只允許可序列化資料');
  }
  if (seen.has(value)) {
    throw new TypeError('Task Package 不允許循環參照');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => cloneSafe(item, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Task Package 只允許一般物件');
    }
    const result = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new TypeError(`Task Package 包含禁止鍵：${key}`);
      }
      result[key] = cloneSafe(value[key], seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
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

function requireArtifact(artifacts, type, moduleId) {
  const artifact = artifacts[type];
  if (!artifact) {
    throw new Error(`模組 ${moduleId} 缺少必要 Artifact：${type}`);
  }
  return artifact;
}

function pickObjectFields(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source && Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = cloneSafe(source[field]);
    }
  }
  return result;
}

function buildAllowedInputs(moduleId, request, artifacts) {
  switch (moduleId) {
    case 'translator':
      return {
        rawRequirement: request.requirement,
        rawBusinessLogic: request.businessLogic,
        expectedOutcome: request.expectedOutcome,
        constraints: cloneSafe(request.constraints),
        sensitiveTerms: cloneSafe(request.sensitiveTerms),
        acceptanceCriteria: cloneSafe(request.acceptanceCriteria)
      };
    case 'router': {
      const translated = requireArtifact(artifacts, 'translated-requirement-v1', moduleId);
      return {
        translatedRequirement: cloneSafe(translated),
        requestedSequence: cloneSafe(request.moduleSequence),
        mode: request.mode,
        inputMode: request.inputMode,
        project: cloneSafe(request.project)
      };
    }
    case 'pm': {
      const translated = requireArtifact(artifacts, 'translated-requirement-v1', moduleId);
      return {
        translatedRequirement: cloneSafe(translated.normalizedRequirement || ''),
        translatedBusinessRules: cloneSafe(translated.translatedBusinessRules || []),
        expectedOutcome: request.expectedOutcome,
        constraints: cloneSafe(request.constraints),
        acceptanceCriteria: cloneSafe(request.acceptanceCriteria)
      };
    }
    case 'checker-pm':
      return { artifact: cloneSafe(requireArtifact(artifacts, 'pm-artifact-v1', moduleId)) };
    case 'sa':
      return {
        pmArtifact: cloneSafe(requireArtifact(artifacts, 'pm-artifact-v1', moduleId)),
        translatedBusinessRules: cloneSafe(
          requireArtifact(artifacts, 'translated-requirement-v1', moduleId).translatedBusinessRules || []
        ),
        project: cloneSafe(request.project)
      };
    case 'checker-sa':
      return { artifact: cloneSafe(requireArtifact(artifacts, 'sa-artifact-v1', moduleId)) };
    case 'sd':
      return {
        pmArtifact: cloneSafe(requireArtifact(artifacts, 'pm-artifact-v1', moduleId)),
        saArtifact: cloneSafe(requireArtifact(artifacts, 'sa-artifact-v1', moduleId)),
        constraints: cloneSafe(request.constraints),
        project: cloneSafe(request.project)
      };
    case 'checker-sd':
      return { artifact: cloneSafe(requireArtifact(artifacts, 'sd-artifact-v1', moduleId)) };
    case 'pg': {
      const pm = requireArtifact(artifacts, 'pm-artifact-v1', moduleId);
      const sd = requireArtifact(artifacts, 'sd-artifact-v1', moduleId);
      return {
        implementationPlan: cloneSafe(sd.implementationPlan || []),
        designContract: cloneSafe(sd.designContract || {}),
        allowedFiles: cloneSafe(sd.allowedFiles || []),
        acceptanceCriteria: cloneSafe(pm.acceptanceCriteria || request.acceptanceCriteria),
        forbiddenOperations: ['push', 'merge', 'deploy', 'db-write', 'dependency-change'],
        project: cloneSafe(request.project)
      };
    }
    case 'qa': {
      const pm = requireArtifact(artifacts, 'pm-artifact-v1', moduleId);
      const sa = requireArtifact(artifacts, 'sa-artifact-v1', moduleId);
      const sd = requireArtifact(artifacts, 'sd-artifact-v1', moduleId);
      const pg = requireArtifact(artifacts, 'pg-artifact-v1', moduleId);
      return {
        acceptanceCriteria: cloneSafe(pm.acceptanceCriteria || request.acceptanceCriteria),
        businessRules: cloneSafe(sa.businessRules || []),
        designContract: cloneSafe(sd.designContract || {}),
        pgArtifact: pickObjectFields(pg, [
          'changedFiles',
          'diffSummary',
          'diffPath',
          'buildResult',
          'testResult',
          'worktreePath'
        ]),
        project: cloneSafe(request.project)
      };
    }
    case 'approval-gate':
      return { qaArtifact: cloneSafe(requireArtifact(artifacts, 'qa-artifact-v1', moduleId)) };
    case 'documentation':
      return {
        pmArtifact: cloneSafe(requireArtifact(artifacts, 'pm-artifact-v1', moduleId)),
        saArtifact: artifacts['sa-artifact-v1'] ? cloneSafe(artifacts['sa-artifact-v1']) : undefined,
        sdArtifact: artifacts['sd-artifact-v1'] ? cloneSafe(artifacts['sd-artifact-v1']) : undefined,
        pgArtifact: artifacts['pg-artifact-v1']
          ? pickObjectFields(artifacts['pg-artifact-v1'], [
              'changedFiles',
              'diffSummary',
              'diffPath',
              'buildResult',
              'testResult',
              'worktreePath'
            ])
          : undefined,
        qaArtifact: cloneSafe(requireArtifact(artifacts, 'qa-artifact-v1', moduleId))
      };
    case 'memory-candidate':
      return {
        documentationArtifact: cloneSafe(requireArtifact(
          artifacts,
          'documentation-artifact-v1',
          moduleId
        )),
        qaArtifact: artifacts['qa-artifact-v1'] ? cloneSafe(artifacts['qa-artifact-v1']) : undefined
      };
    case 'need-to-know':
      return {
        selectedModules: cloneSafe(request.moduleSequence),
        artifactTypes: Object.keys(artifacts).sort()
      };
    default:
      throw new Error(`找不到工作流模組：${moduleId}`);
  }
}

function createTaskPackageBuilder(options = {}) {
  const { catalog } = options;
  if (!catalog || typeof catalog.get !== 'function') {
    throw new TypeError('catalog 必須提供 get()');
  }

  function build(input = {}) {
    const {
      runId,
      moduleId,
      request,
      artifacts = {},
      canaryTokens = []
    } = input;
    const module = catalog.get(moduleId);
    if (!module) {
      throw new Error(`找不到工作流模組：${moduleId}`);
    }
    if (!request || typeof request !== 'object') {
      throw new TypeError('request 不可為空');
    }

    const taskPackage = {
      runId: String(runId || ''),
      moduleId,
      objective: `執行 ${module.name} 模組並產生 ${module.produces[0]}`,
      allowedInputs: buildAllowedInputs(moduleId, request, artifacts),
      projectAccess: module.liveAccess,
      constraints: [
        '只使用 allowedInputs 內容',
        '不得讀取其他角色 Session',
        '不得回顯未授權敏感資訊'
      ],
      expectedOutputSchema: module.produces[0],
      canaryTokens: cloneSafe(canaryTokens)
    };
    return deepFreeze(taskPackage);
  }

  return Object.freeze({ build });
}

module.exports = {
  createTaskPackageBuilder
};
