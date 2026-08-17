#!/usr/bin/env node
'use strict';

function traceCoverage(traceLinks) {
  if (!traceLinks) return false;
  return ['spec', 'acceptanceCriteria', 'tickets', 'tests']
    .every(key => Array.isArray(traceLinks[key]) && traceLinks[key].length > 0);
}

function harnessParity(input) {
  if (!input.invocation) return undefined;
  if (input.invocation === 'user') {
    return input.claudeDisableModelInvocation === true && input.codexAllowImplicitInvocation === false;
  }
  if (input.invocation === 'model') {
    return input.claudeDisableModelInvocation === false && input.codexAllowImplicitInvocation === true;
  }
  return false;
}

function evaluateScenario(input = {}) {
  const isGrillMe = input.explicitSkill === 'grill-me';
  const alreadyAnswered = input.alreadyAnswered === true;
  const requiresDecision = input.requiresDecision === true;
  const factResolvable = input.factResolvable === true;
  const invokeDecisionGrilling = isGrillMe || (!input.simpleImplementation && !alreadyAnswered && (requiresDecision || input.ambiguousPlanning === true));
  const askUser = !alreadyAnswered && !factResolvable && requiresDecision && input.resolver !== 'FACT';
  const sharedUnderstanding = input.sharedUnderstanding === true;
  const approved = input.approved === true;

  const result = {
    invokeDecisionGrilling,
    askUser,
    resolveFactFirst: factResolvable,
    maxQuestions: input.batch === true ? Infinity : 1,
    sideEffects: isGrillMe ? 'none' : undefined,
    mayWriteFormalSource: !isGrillMe && approved,
    maySpawnAgent: input.agentApproved === true,
    mayImplement: !isGrillMe && approved && sharedUnderstanding
  };

  const parity = harnessParity(input);
  if (parity !== undefined) result.harnessParity = parity;
  if (input.traceLinks) result.traceCoverage = traceCoverage(input.traceLinks);
  return result;
}

function normalizeExpected(value) {
  return value === 'Infinity' ? Infinity : value;
}

function validateBehaviorFixtures(fixtures) {
  const failures = [];
  for (const fixture of fixtures || []) {
    const actual = evaluateScenario(fixture.input || {});
    for (const [key, rawExpected] of Object.entries(fixture.expect || {})) {
      const expected = normalizeExpected(rawExpected);
      if (!Object.is(actual[key], expected)) {
        failures.push(`${fixture.name}: ${key} expected=${String(expected)} actual=${String(actual[key])}`);
      }
    }
  }
  return { total: (fixtures || []).length, failures };
}

module.exports = { evaluateScenario, validateBehaviorFixtures, traceCoverage, harnessParity };
