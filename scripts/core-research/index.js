'use strict';

const candidateSchema = require('./candidate-schema');
const candidateDedupe = require('./candidate-dedupe');
const candidateRegistry = require('./candidate-registry');
const candidateScorer = require('./candidate-scorer');
const weeklySelector = require('./weekly-selector');
const reportBuilder = require('./report-builder');
const repositorySourceGate = require('./repository-source-gate');
const evaluationTaskBuilder = require('./evaluation-task-builder');
const workspaceScanner = require('./workspace-scanner');
const sandboxEvidence = require('./sandbox-evidence');
const evaluationLedger = require('./evaluation-ledger');

module.exports = {
  ...candidateSchema,
  ...candidateDedupe,
  ...candidateRegistry,
  ...candidateScorer,
  ...weeklySelector,
  ...reportBuilder,
  ...repositorySourceGate,
  ...evaluationTaskBuilder,
  ...workspaceScanner,
  ...sandboxEvidence,
  ...evaluationLedger,
};
