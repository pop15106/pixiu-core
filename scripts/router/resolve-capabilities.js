#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function isNegatedMatch(text, index) {
  const prefix = text.slice(Math.max(0, index - 24), index);
  return /(?:先不要|暫時不要|不是要|不要|不用|別|取消|關閉|不開)[^。！？!?]{0,12}$/u.test(prefix);
}

function isAsciiWordChar(value) {
  return typeof value === 'string' && /^[a-z0-9_]$/iu.test(value);
}

function findMatch(normalized, phrase, { bounded = false } = {}) {
  if (!phrase) return -1;
  let cursor = 0;
  while (cursor <= normalized.length - phrase.length) {
    const index = normalized.indexOf(phrase, cursor);
    if (index < 0) return -1;

    const left = index > 0 ? normalized[index - 1] : '';
    const rightIndex = index + phrase.length;
    const right = rightIndex < normalized.length ? normalized[rightIndex] : '';
    const leftBlocked = bounded && isAsciiWordChar(phrase[0]) && isAsciiWordChar(left);
    const rightBlocked =
      bounded &&
      isAsciiWordChar(phrase[phrase.length - 1]) &&
      isAsciiWordChar(right);

    if (!leftBlocked && !rightBlocked && !isNegatedMatch(normalized, index)) {
      return index;
    }
    cursor = index + 1;
  }
  return -1;
}

function scoreCapability(request, capability) {
  const normalized = normalizeText(request);
  const keywordMatches = (Array.isArray(capability.keywords) ? capability.keywords : [])
    .map(normalizeText)
    .filter(keyword => findMatch(normalized, keyword) >= 0);
  const aliasMatches = (Array.isArray(capability.aliases) ? capability.aliases : [])
    .map(normalizeText)
    .filter(alias => findMatch(normalized, alias, { bounded: true }) >= 0);
  const matches = [...new Set([...keywordMatches, ...aliasMatches])];
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

function rankMatches(request, manifest) {
  return (manifest.capabilities || [])
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
    });
}

function resolveCapabilities(request, manifest, options = {}) {
  const requestedMaxCapabilities = isValidCapabilityLimit(options.maxCapabilities)
    ? options.maxCapabilities
    : isValidCapabilityLimit(manifest.maxCapabilitiesPerRequest)
      ? manifest.maxCapabilitiesPerRequest
      : 3;
  const maxCapabilities = Math.min(requestedMaxCapabilities, 3);

  if (maxCapabilities === 0) {
    return { capabilities: [], filesToLoad: [], reasons: [] };
  }

  const ranked = rankMatches(request, manifest);
  const required = ranked.filter(item => item.capability.requiredWhenMatched === true);
  const optional = ranked.filter(item => item.capability.requiredWhenMatched !== true);
  const selectedRanked = [];

  for (const item of required) {
    if (selectedRanked.length >= maxCapabilities) break;
    selectedRanked.push(item);
  }
  for (const item of optional) {
    if (selectedRanked.length >= maxCapabilities) break;
    selectedRanked.push(item);
  }

  const selected = selectedRanked.map(item => item.capability);

  return {
    capabilities: selected.map(capability => capability.id),
    filesToLoad: collectFiles(selected),
    reasons: selectedRanked.map(item => ({
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
