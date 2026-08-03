#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

class ArtifactStoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ArtifactStoreError';
    this.code = code;
  }
}

function cloneSerializable(value, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value;
  }
  if (['string', 'number', 'boolean'].includes(typeof value)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new ArtifactStoreError('INVALID_ARTIFACT_VALUE', 'Artifact 數值必須有限');
    }
    return value;
  }
  if (typeof value !== 'object') {
    throw new ArtifactStoreError('INVALID_ARTIFACT_VALUE', 'Artifact 只允許可序列化資料');
  }
  if (seen.has(value)) {
    throw new ArtifactStoreError('INVALID_ARTIFACT_VALUE', 'Artifact 不允許循環參照');
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => cloneSerializable(item, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new ArtifactStoreError('INVALID_ARTIFACT_VALUE', 'Artifact 只允許一般物件');
    }
    const result = {};
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new ArtifactStoreError('INVALID_ARTIFACT_KEY', `Artifact 包含禁止鍵：${key}`);
      }
      result[key] = cloneSerializable(value[key], seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function cloneRecord(record) {
  return cloneSerializable(record);
}

function createArtifactStore(options = {}) {
  const {
    redactor,
    idFactory = () => crypto.randomUUID(),
    now = () => new Date().toISOString(),
    maxArtifactBytes = 500000
  } = options;
  if (!redactor || typeof redactor.assertSafeForPersistence !== 'function') {
    throw new TypeError('redactor 必須提供 assertSafeForPersistence()');
  }
  if (!Number.isInteger(maxArtifactBytes) || maxArtifactBytes < 1) {
    throw new TypeError('maxArtifactBytes 必須是正整數');
  }

  const records = new Map();

  function save(input = {}) {
    const {
      runId,
      moduleId,
      type,
      value,
      persistence = 'durable'
    } = input;
    if (typeof runId !== 'string' || !runId) {
      throw new ArtifactStoreError('INVALID_ARTIFACT_METADATA', 'runId 不可為空');
    }
    if (typeof moduleId !== 'string' || !moduleId) {
      throw new ArtifactStoreError('INVALID_ARTIFACT_METADATA', 'moduleId 不可為空');
    }
    if (typeof type !== 'string' || !type) {
      throw new ArtifactStoreError('INVALID_ARTIFACT_METADATA', 'type 不可為空');
    }
    if (!['memory', 'durable'].includes(persistence)) {
      throw new ArtifactStoreError('INVALID_ARTIFACT_PERSISTENCE', 'persistence 值不允許');
    }

    const clonedValue = cloneSerializable(value);
    const serialized = JSON.stringify(clonedValue);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (bytes > maxArtifactBytes) {
      throw new ArtifactStoreError(
        'ARTIFACT_TOO_LARGE',
        `Artifact 大小 ${bytes} bytes 超過上限 ${maxArtifactBytes}`
      );
    }
    if (persistence === 'durable') {
      redactor.assertSafeForPersistence(clonedValue);
    }

    const record = {
      id: String(idFactory()),
      runId,
      moduleId,
      type,
      persistence,
      createdAt: now(),
      bytes,
      value: clonedValue
    };
    records.set(record.id, record);
    return cloneRecord(record);
  }

  function get(artifactId) {
    const record = records.get(artifactId);
    return record ? cloneRecord(record) : undefined;
  }

  function list(runId, options = {}) {
    const includeMemory = Boolean(options.includeMemory);
    return [...records.values()]
      .filter((record) => record.runId === runId && (includeMemory || record.persistence === 'durable'))
      .map(cloneRecord);
  }

  function listDurable(runId) {
    return list(runId, { includeMemory: false });
  }

  function snapshot(runId) {
    return {
      runId,
      artifacts: listDurable(runId).map((record) => ({
        id: record.id,
        runId: record.runId,
        moduleId: record.moduleId,
        type: record.type,
        persistence: record.persistence,
        createdAt: record.createdAt,
        bytes: record.bytes
      }))
    };
  }

  return Object.freeze({
    get,
    list,
    listDurable,
    save,
    snapshot
  });
}

module.exports = {
  ArtifactStoreError,
  createArtifactStore
};
