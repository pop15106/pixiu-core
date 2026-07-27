#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function scoreCapability(request, capability) {
  const normalized = normalizeText(request);
  const keywords = Array.isArray(capability.keywords) ? capability.keywords : [];
  const matches = keywords.filter(keyword => normalized.includes(normalizeText(keyword)));
  return {
    score: matches.length,
    matches
  };
}

function collectFiles(capabilities) {
  const files = [];
  const seen = new Set();

  for (const capability of capabilities) {
    const load = capability.load || {};
    for (const file of [
      ...(load.skills || []),
      ...(load.contexts || []),
      ...(load.governance || [])
    ]) {
      if (!seen.has(file)) {
        seen.add(file);
        files.push(file);
      }
    }
  }

  return files;
}

function isValidCapabilityLimit(value) {
  return Number.isInteger(value) && value >= 0;
}

function resolveCapabilities(request, manifest, options = {}) {
  const requestedMaxCapabilities = isValidCapabilityLimit(options.maxCapabilities)
    ? options.maxCapabilities
    : isValidCapabilityLimit(manifest.maxCapabilitiesPerRequest)
      ? manifest.maxCapabilitiesPerRequest
      : 3;
  const maxCapabilities = Math.min(requestedMaxCapabilities, 3);

  const ranked = (manifest.capabilities || [])
    .map(capability => {
      const scored = scoreCapability(request, capability);
      return {
        capability,
        score: scored.score,
        matches: scored.matches
      };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => {
      const priorityDiff = (right.capability.priority || 0) - (left.capability.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) return scoreDiff;
      return left.capability.id.localeCompare(right.capability.id);
    })
    .slice(0, maxCapabilities);

  const selected = ranked.map(item => item.capability);

  return {
    capabilities: selected.map(capability => capability.id),
    filesToLoad: collectFiles(selected),
    reasons: ranked.map(item => ({
      capability: item.capability.id,
      matchedKeywords: item.matches
    }))
  };
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`找不到 Capability Manifest：${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function safeResolveFromFile(request, manifestPath, options = {}) {
  try {
    return {
      degraded: false,
      ...resolveCapabilities(request, loadManifest(manifestPath), options)
    };
  } catch (error) {
    return {
      degraded: true,
      capabilities: [],
      filesToLoad: [],
      reasons: [],
      error: error.message
    };
  }
}

if (require.main === module) {
  const request = process.argv[2] || '';
  const manifestPath = path.resolve(
    process.argv[3] || path.join(__dirname, '..', '..', 'vault', 'capabilities', 'capability-manifest.json')
  );

  const result = safeResolveFromFile(request, manifestPath);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.degraded) process.exitCode = 2;
}

module.exports = {
  normalizeText,
  scoreCapability,
  collectFiles,
  resolveCapabilities,
  loadManifest,
  safeResolveFromFile
};
