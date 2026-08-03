#!/usr/bin/env node
'use strict';

const DEFAULT_SEQUENCE = Object.freeze([
  'translator',
  'router',
  'pm',
  'checker-pm',
  'sa',
  'checker-sa',
  'sd',
  'checker-sd',
  'pg',
  'qa',
  'approval-gate',
  'documentation',
  'memory-candidate'
]);

const MODULE_DEFINITIONS = Object.freeze([
  {
    id: 'translator',
    name: '轉譯器',
    kind: 'role',
    requiredArtifacts: [],
    produces: ['translated-requirement-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 10
  },
  {
    id: 'router',
    name: '決策／路由',
    kind: 'control',
    requiredArtifacts: ['translated-requirement-v1'],
    produces: ['workflow-route-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 20
  },
  {
    id: 'pm',
    name: 'PM',
    kind: 'role',
    requiredArtifacts: ['translated-requirement-v1'],
    produces: ['pm-artifact-v1'],
    offline: true,
    liveAccess: 'read-only',
    defaultOrder: 30
  },
  {
    id: 'checker-pm',
    name: 'PM 檢核官',
    kind: 'checker',
    requiredArtifacts: ['pm-artifact-v1'],
    produces: ['checker-result-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 40
  },
  {
    id: 'sa',
    name: 'SA',
    kind: 'role',
    requiredArtifacts: ['pm-artifact-v1'],
    produces: ['sa-artifact-v1'],
    offline: true,
    liveAccess: 'read-only',
    defaultOrder: 50
  },
  {
    id: 'checker-sa',
    name: 'SA 檢核官',
    kind: 'checker',
    requiredArtifacts: ['sa-artifact-v1'],
    produces: ['checker-result-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 60
  },
  {
    id: 'sd',
    name: 'SD',
    kind: 'role',
    requiredArtifacts: ['pm-artifact-v1', 'sa-artifact-v1'],
    produces: ['sd-artifact-v1'],
    offline: true,
    liveAccess: 'read-only',
    defaultOrder: 70
  },
  {
    id: 'checker-sd',
    name: 'SD 檢核官',
    kind: 'checker',
    requiredArtifacts: ['sd-artifact-v1'],
    produces: ['checker-result-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 80
  },
  {
    id: 'pg',
    name: 'PG',
    kind: 'role',
    requiredArtifacts: ['sd-artifact-v1'],
    produces: ['pg-artifact-v1'],
    offline: true,
    liveAccess: 'worktree-write',
    defaultOrder: 90
  },
  {
    id: 'qa',
    name: 'QA',
    kind: 'role',
    requiredArtifacts: ['pm-artifact-v1', 'sa-artifact-v1', 'sd-artifact-v1', 'pg-artifact-v1'],
    produces: ['qa-artifact-v1'],
    offline: true,
    liveAccess: 'worktree-read',
    defaultOrder: 100
  },
  {
    id: 'approval-gate',
    name: '人工核准閘門',
    kind: 'control',
    requiredArtifacts: ['qa-artifact-v1'],
    produces: ['approval-result-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 110
  },
  {
    id: 'documentation',
    name: '文件',
    kind: 'role',
    requiredArtifacts: ['pm-artifact-v1', 'qa-artifact-v1'],
    produces: ['documentation-artifact-v1'],
    offline: true,
    liveAccess: 'read-only',
    defaultOrder: 120
  },
  {
    id: 'memory-candidate',
    name: '記憶候選',
    kind: 'control',
    requiredArtifacts: ['documentation-artifact-v1'],
    produces: ['memory-candidate-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 130
  },
  {
    id: 'need-to-know',
    name: 'Need-to-Know 診斷',
    kind: 'diagnostic',
    requiredArtifacts: [],
    produces: ['need-to-know-report-v1'],
    offline: true,
    liveAccess: 'none',
    defaultOrder: 140
  }
].map((definition) => Object.freeze({
  ...definition,
  requiredArtifacts: Object.freeze([...definition.requiredArtifacts]),
  produces: Object.freeze([...definition.produces])
})));

function createWorkflowCatalog() {
  const definitions = new Map(MODULE_DEFINITIONS.map((definition) => [definition.id, definition]));
  const outputOwners = new Map();
  for (const definition of MODULE_DEFINITIONS) {
    for (const output of definition.produces) {
      if (!outputOwners.has(output)) {
        outputOwners.set(output, definition.id);
      }
    }
  }

  function get(moduleId) {
    return definitions.get(moduleId);
  }

  function list() {
    return MODULE_DEFINITIONS.map(({ id, name, kind, offline, liveAccess, defaultOrder }) => ({
      id,
      name,
      kind,
      offline,
      liveAccess,
      defaultOrder
    }));
  }

  function validateSequence(moduleIds, options = {}) {
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
      throw new Error('流程至少需要一個模組');
    }
    const normalized = [...moduleIds];
    for (const moduleId of normalized) {
      if (!definitions.has(moduleId)) {
        throw new Error(`找不到工作流模組：${moduleId}`);
      }
    }

    const {
      advancedOrder = false,
      allowUnsafeOrder = false,
      fixtureMode = 'strict'
    } = options;

    if (!advancedOrder) {
      if (normalized.length === 1) {
        return normalized;
      }
      let lastIndex = -1;
      for (const moduleId of normalized) {
        const currentIndex = DEFAULT_SEQUENCE.indexOf(moduleId);
        if (currentIndex === -1 || currentIndex <= lastIndex) {
          throw new Error('一般模式只能依固定順序選擇模組');
        }
        lastIndex = currentIndex;
      }
      return normalized;
    }

    if (allowUnsafeOrder || fixtureMode === 'assisted-fixture') {
      return normalized;
    }

    const availableOutputs = new Set();
    for (const moduleId of normalized) {
      const definition = definitions.get(moduleId);
      const missing = definition.requiredArtifacts.filter((artifactType) => !availableOutputs.has(artifactType));
      if (missing.length > 0) {
        const owners = missing.map((artifactType) => outputOwners.get(artifactType) || artifactType);
        throw new Error(`模組 ${moduleId} 缺少必要上游產物：${owners.join(', ')}`);
      }
      for (const output of definition.produces) {
        availableOutputs.add(output);
      }
    }
    return normalized;
  }

  return Object.freeze({
    defaultSequence: DEFAULT_SEQUENCE,
    get,
    list,
    validateSequence
  });
}

module.exports = {
  DEFAULT_SEQUENCE,
  createWorkflowCatalog
};
