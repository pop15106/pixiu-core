'use strict';

const candidateSchema = require('./candidate-schema');
const candidateDedupe = require('./candidate-dedupe');
const candidateRegistry = require('./candidate-registry');
const candidateScorer = require('./candidate-scorer');
const weeklySelector = require('./weekly-selector');
const reportBuilder = require('./report-builder');

module.exports = {
  ...candidateSchema,
  ...candidateDedupe,
  ...candidateRegistry,
  ...candidateScorer,
  ...weeklySelector,
  ...reportBuilder,
};
