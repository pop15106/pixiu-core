#!/usr/bin/env node
'use strict';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function createResult(moduleId, now, input = {}) {
  const startedAt = now();
  return {
    moduleId,
    status: input.status || 'GREEN',
    artifact: input.artifact || null,
    evidence: ensureArray(input.evidence),
    warnings: ensureArray(input.warnings),
    exposureReport: input.exposureReport || {
      sensitiveMatches: [],
      canaryLeaks: []
    },
    recommendedModuleId: input.recommendedModuleId || null,
    reason: input.reason || null,
    startedAt,
    finishedAt: now()
  };
}

function splitRules(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(/\r?\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function missingFields(value, fields) {
  return fields.filter((field) => {
    const current = value ? value[field] : undefined;
    return current === undefined
      || current === null
      || current === ''
      || (Array.isArray(current) && current.length === 0);
  });
}

function checkerRequirements(moduleId) {
  if (moduleId === 'checker-pm') {
    return {
      fields: ['problemStatement', 'scope', 'acceptanceCriteria'],
      returnTo: 'pm'
    };
  }
  if (moduleId === 'checker-sa') {
    return {
      fields: ['asIs', 'businessRules', 'impactScope'],
      returnTo: 'sa'
    };
  }
  return {
    fields: ['toBe', 'designContract', 'implementationPlan', 'testStrategy', 'rollbackPlan'],
    returnTo: 'sd'
  };
}

function scanCanaries(value, canaryTokens) {
  const serialized = JSON.stringify(value);
  return ensureArray(canaryTokens).filter((token) => token && serialized.includes(token));
}

function createOfflineRunner(options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const delayMs = Number.isInteger(options.delayMs) ? options.delayMs : 1000;

  function waitForDelay(signal) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      const abort = () => {
        clearTimeout(timer);
        const error = new Error('Offline Contract 已取消');
        error.code = 'OFFLINE_EXECUTION_CANCELLED';
        reject(error);
      };
      if (signal) {
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) {
          abort();
        }
      }
    });
  }

  async function execute(input = {}) {
    const { moduleId, taskPackage = {}, context = {} } = input;
    const allowed = taskPackage.allowedInputs || {};
    const request = context.request || {};
    const redactor = context.redactor;
    let result;

    if (request.testScenario === 'delayed') {
      await waitForDelay(context.signal);
    }

    switch (moduleId) {
      case 'translator': {
        const rawRequirement = allowed.rawRequirement || '';
        const rawBusinessLogic = allowed.rawBusinessLogic || '';
        const useRaw = request.inputMode === 'raw-pass-through';
        const normalizedRequirement = useRaw
          ? rawRequirement.trim()
          : redactor.redactText(rawRequirement.trim());
        const translatedBusinessRules = splitRules(useRaw
          ? rawBusinessLogic
          : redactor.redactText(rawBusinessLogic));
        result = createResult(moduleId, now, {
          artifact: {
            type: 'translated-requirement-v1',
            value: {
              synthetic: true,
              normalizedRequirement,
              translatedBusinessRules,
              expectedOutcome: useRaw
                ? (allowed.expectedOutcome || '')
                : redactor.redactText(allowed.expectedOutcome || ''),
              sourceMode: request.inputMode || 'need-to-know'
            }
          },
          evidence: ['Offline Translator Contract']
        });
        break;
      }
      case 'router':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'workflow-route-v1',
            value: {
              synthetic: true,
              moduleSequence: ensureArray(allowed.requestedSequence),
              mode: allowed.mode || 'offline',
              inputMode: allowed.inputMode || 'need-to-know',
              approvals: request.requiresApproval || [],
              pgRequiresWorktree: ensureArray(allowed.requestedSequence).includes('pg')
            }
          },
          evidence: ['Offline Router Contract']
        });
        break;
      case 'pm': {
        const translatedRequirement = allowed.translatedRequirement || '未提供需求摘要';
        const acceptanceCriteria = ensureArray(allowed.acceptanceCriteria).length > 0
          ? ensureArray(allowed.acceptanceCriteria)
          : [`完成並驗證：${translatedRequirement}`];
        result = createResult(moduleId, now, {
          artifact: {
            type: 'pm-artifact-v1',
            value: {
              synthetic: true,
              problemStatement: translatedRequirement,
              goal: allowed.expectedOutcome || translatedRequirement,
              scope: [translatedRequirement],
              outOfScope: ['未經核准的需求擴張'],
              functionalRequirements: [translatedRequirement],
              nonFunctionalRequirements: ['可驗證', '可回滾', '敏感資訊遮罩'],
              acceptanceCriteria,
              unknowns: [],
              dependencies: [],
              risks: ensureArray(allowed.constraints)
            }
          },
          evidence: ['Offline PM Contract']
        });
        break;
      }
      case 'checker-pm':
      case 'checker-sa':
      case 'checker-sd': {
        const requirements = checkerRequirements(moduleId);
        const missing = missingFields(allowed.artifact, requirements.fields);
        const forcedRed = request.testScenario === 'checker-red' && !context.redResolved;
        const isRed = forcedRed || missing.length > 0;
        result = createResult(moduleId, now, {
          status: isRed ? 'RED' : 'GREEN',
          artifact: {
            type: 'checker-result-v1',
            value: {
              synthetic: true,
              verdict: isRed ? 'RED' : 'GREEN',
              missingFields: missing,
              checkedArtifactType: taskPackage.expectedOutputSchema
            }
          },
          recommendedModuleId: isRed ? requirements.returnTo : null,
          reason: isRed ? `產物契約缺失：${missing.join(', ') || 'fixture forced red'}` : null,
          evidence: ['Offline Checker Contract']
        });
        break;
      }
      case 'sa':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'sa-artifact-v1',
            value: {
              synthetic: true,
              asIs: ['依 PM 需求建立離線分析 Fixture'],
              businessRules: ensureArray(allowed.translatedBusinessRules).length > 0
                ? ensureArray(allowed.translatedBusinessRules)
                : ['未提供商業規則，使用 PM 需求作為合成分析基準'],
              dataFlow: ['輸入 → 驗證 → 執行 → 結果'],
              callChain: [],
              impactScope: ['需求涉及的目標模組'],
              rootCause: null,
              unverified: ['Offline 模式未讀取真實專案原始碼'],
              options: [
                { id: 'minimal', pros: ['改動小'], cons: ['擴充性有限'] },
                { id: 'structured', pros: ['邊界清楚'], cons: ['實作較多'] }
              ],
              regressionRisks: ['需由 Live SA 依檔案與行號驗證']
            }
          },
          warnings: ['Synthetic Fixture，不代表真實專案分析'],
          evidence: ['Offline SA Contract']
        });
        break;
      case 'sd':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'sd-artifact-v1',
            value: {
              synthetic: true,
              toBe: ['依 SA Artifact 建立可驗證技術流程'],
              architectureBoundaries: ['輸入', '核心邏輯', '持久化', '驗證'],
              designContract: {
                input: 'validated-request',
                output: 'verified-result',
                errors: ['INVALID_INPUT', 'EXECUTION_FAILED']
              },
              allowedFiles: [],
              implementationPlan: ['先測試', '最小實作', '完整驗證'],
              testStrategy: ['unit', 'integration', 'main-path'],
              rollbackPlan: ['保留隔離 Worktree', '不 Push', '不 Merge'],
              adr: {
                decision: '採用最小可驗證實作',
                alternatives: ['直接修改原 checkout（否決）']
              }
            }
          },
          warnings: ['Synthetic Fixture，不代表真實系統設計'],
          evidence: ['Offline SD Contract']
        });
        break;
      case 'pg':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'pg-artifact-v1',
            value: {
              synthetic: true,
              worktreeRequired: true,
              allowedFiles: ensureArray(allowed.allowedFiles),
              forbiddenOperations: ensureArray(allowed.forbiddenOperations),
              changedFiles: [],
              diffSummary: 'Offline Contract 不修改程式',
              buildResult: 'not-run',
              testResult: 'not-run'
            }
          },
          evidence: ['Offline PG Contract']
        });
        break;
      case 'qa': {
        const isRed = request.testScenario === 'qa-red' && !context.redResolved;
        result = createResult(moduleId, now, {
          status: isRed ? 'RED' : 'GREEN',
          artifact: {
            type: 'qa-artifact-v1',
            value: {
              synthetic: true,
              verdict: isRed ? 'RED' : 'GREEN',
              testMatrix: ['Acceptance Criteria', 'Business Rules', 'Design Contract', 'PG Evidence'],
              passed: isRed ? 3 : 4,
              failed: isRed ? 1 : 0,
              skipped: 0,
              defects: isRed ? [{ severity: 'HIGH', message: 'Fixture QA failure' }] : [],
              adversarialProbes: ['null', 'long-input', 'special-characters']
            }
          },
          recommendedModuleId: isRed ? 'pg' : null,
          reason: isRed ? 'QA Fixture 判定需要退回 PG' : null,
          evidence: ['Offline QA Contract']
        });
        break;
      }
      case 'approval-gate':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'approval-result-v1',
            value: {
              synthetic: true,
              approved: allowed.qaArtifact?.verdict === 'GREEN',
              source: 'offline-contract'
            }
          },
          evidence: ['Offline Approval Gate Contract']
        });
        break;
      case 'documentation':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'documentation-artifact-v1',
            value: {
              synthetic: true,
              summary: allowed.pmArtifact?.problemStatement || 'Workflow 完成',
              sections: [
                'PM Requirement',
                allowed.saArtifact ? 'SA Analysis' : null,
                allowed.sdArtifact ? 'SD Design' : null,
                allowed.pgArtifact ? 'PG Implementation' : null,
                'QA Result'
              ].filter(Boolean),
              qaVerdict: allowed.qaArtifact?.verdict || 'UNKNOWN',
              deploymentAllowed: false
            }
          },
          evidence: ['Offline Documentation Contract']
        });
        break;
      case 'memory-candidate':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'memory-candidate-v1',
            value: {
              synthetic: true,
              recapCandidate: allowed.documentationArtifact?.summary || 'Workflow 完成',
              decisionCandidates: [],
              observationCandidates: [],
              writeToVault: false
            }
          },
          evidence: ['Offline Memory Candidate Contract']
        });
        break;
      case 'need-to-know':
        result = createResult(moduleId, now, {
          artifact: {
            type: 'need-to-know-report-v1',
            value: {
              synthetic: true,
              selectedModules: ensureArray(allowed.selectedModules),
              visibleArtifactTypes: ensureArray(allowed.artifactTypes),
              rawRequirementVisible: false,
              rawBusinessLogicVisible: false
            }
          },
          evidence: ['Offline Need-to-Know Contract']
        });
        break;
      default:
        throw new Error(`Offline Runner 不支援模組：${moduleId}`);
    }

    if (result.artifact
      && request.testScenario === 'canary-leak'
      && !context.redResolved
      && taskPackage.canaryTokens?.[0]) {
      result.artifact.value.canaryProbe = taskPackage.canaryTokens[0];
    }

    if (result.artifact) {
      const canaryLeaks = scanCanaries(result.artifact.value, taskPackage.canaryTokens);
      if (canaryLeaks.length > 0) {
        result.status = 'RED';
        result.recommendedModuleId = 'translator';
        result.reason = 'Canary Secret 洩漏';
        result.exposureReport.canaryLeaks = canaryLeaks.map(() => '{{CANARY}}');
      }
    }
    return result;
  }

  return Object.freeze({ execute });
}

module.exports = {
  createOfflineRunner
};
