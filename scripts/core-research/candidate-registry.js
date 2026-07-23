'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const {
  appendFile,
  mkdir,
  readFile,
} = require('node:fs/promises');

const { normalizeCandidate } = require('./candidate-schema');
const { buildCanonicalKey } = require('./candidate-dedupe');

function createError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function normalizeEventTime(value) {
  const timestamp = value === undefined ? Date.now() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw createError('REGISTRY_EVENT_TIME_INVALID', '匯入時間不是有效日期');
  }
  return new Date(timestamp).toISOString();
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

async function readRegistry(registryPath) {
  let text;
  try {
    text = await readFile(registryPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return freezeArray([]);
    throw error;
  }

  const events = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      events.push(Object.freeze(JSON.parse(line)));
    } catch {
      throw createError(
        'REGISTRY_LINE_INVALID',
        `Registry 第 ${index + 1} 行不是有效 JSON`,
        { lineNumber: index + 1 },
      );
    }
  }
  return freezeArray(events);
}

function validateCandidateImportEvent(event) {
  if (event?.eventType !== 'CANDIDATE_IMPORTED') return null;
  if (
    event.schemaVersion !== 'pixiu.core-research/registry-event-v1'
    || typeof event.eventId !== 'string'
    || typeof event.eventAt !== 'string'
    || typeof event.canonicalKey !== 'string'
    || !event.candidate
  ) {
    throw createError('REGISTRY_EVENT_INVALID', '候選匯入事件格式不合法');
  }

  const candidate = normalizeCandidate(event.candidate);
  const expectedCanonicalKey = buildCanonicalKey(candidate);
  if (event.canonicalKey !== expectedCanonicalKey) {
    throw createError(
      'REGISTRY_CANONICAL_KEY_MISMATCH',
      'Registry Canonical Key 與候選內容不一致',
    );
  }
  return Object.freeze({ candidate, canonicalKey: expectedCanonicalKey });
}

function listLatestCandidates(events) {
  if (!Array.isArray(events)) {
    throw createError('REGISTRY_EVENTS_INVALID', 'Registry events 必須是陣列');
  }

  const byCanonicalKey = new Map();
  for (const event of events) {
    const validated = validateCandidateImportEvent(event);
    if (!validated) continue;
    byCanonicalKey.set(validated.canonicalKey, validated.candidate);
  }
  return freezeArray(byCanonicalKey.values());
}

function createImportEvent(candidate, canonicalKey, eventAt) {
  const digest = crypto
    .createHash('sha256')
    .update(`${canonicalKey}\n${eventAt}`)
    .digest('hex');

  return Object.freeze({
    schemaVersion: 'pixiu.core-research/registry-event-v1',
    eventType: 'CANDIDATE_IMPORTED',
    eventId: `event-${digest.slice(0, 24)}`,
    eventAt,
    canonicalKey,
    candidate,
  });
}

async function importCandidates({ registryPath, candidates, importedAt } = {}) {
  if (typeof registryPath !== 'string' || registryPath.trim() === '') {
    throw createError('REGISTRY_PATH_REQUIRED', 'registryPath 不可為空');
  }
  if (!Array.isArray(candidates)) {
    throw createError('CANDIDATE_LIST_INVALID', 'candidates 必須是陣列');
  }

  const eventAt = normalizeEventTime(importedAt);
  const existingEvents = await readRegistry(registryPath);
  const knownKeys = new Set();
  for (const event of existingEvents) {
    const validated = validateCandidateImportEvent(event);
    if (validated) knownKeys.add(validated.canonicalKey);
  }
  const imported = [];
  const duplicates = [];
  const newEvents = [];

  for (const input of candidates) {
    const candidate = normalizeCandidate(input);
    const canonicalKey = buildCanonicalKey(candidate);
    if (knownKeys.has(canonicalKey)) {
      duplicates.push(candidate);
      continue;
    }

    knownKeys.add(canonicalKey);
    imported.push(candidate);
    newEvents.push(createImportEvent(candidate, canonicalKey, eventAt));
  }

  if (newEvents.length > 0) {
    await mkdir(path.dirname(path.resolve(registryPath)), { recursive: true });
    const payload = `${newEvents.map((event) => JSON.stringify(event)).join('\n')}\n`;
    await appendFile(registryPath, payload, 'utf8');
  }

  return Object.freeze({
    imported: freezeArray(imported),
    duplicates: freezeArray(duplicates),
    eventsWritten: newEvents.length,
  });
}

module.exports = {
  importCandidates,
  readRegistry,
  listLatestCandidates,
};
